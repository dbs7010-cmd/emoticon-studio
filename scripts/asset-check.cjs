#!/usr/bin/env node
// 출시 에셋 검사 — 이미지를 만들거나 고치지 않는다. 읽고 판정만 한다.
//
// 기준은 assets/asset-contract.json 하나다. 확인하는 것:
//   1. 계약에 적힌 파일이 있는가 / 형식·크기·용량·알파 채널·투명 픽셀 규칙을 지키는가
//   2. Expo 템플릿 이미지(해시로 식별)가 브랜드 자리에 들어가 있지 않은가
//   3. 실제 앱 설정(app.config.js 결과)이 템플릿 파일을 가리키지 않는가 · 스플래시가 연결됐는가
//   4. android/(prebuild 결과)에 템플릿으로 만든 런처·스플래시 리소스가 남아 있지 않은가
// P0 가 하나라도 FAIL 이면 종료 코드 1. P2 는 경고만.
//
// 사용: node scripts/asset-check.cjs            (사람이 읽는 표)
//       node scripts/asset-check.cjs --json out.json
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');

function readPng(buf) {
  if (buf.length < 33 || buf.readUInt32BE(0) !== 0x89504e47 || buf.readUInt32BE(4) !== 0x0d0a1a0a) return null;
  let off = 8, ihdr = null, trns = null;
  const idat = [];
  while (off + 12 <= buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9], interlace: data[12] };
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  return ihdr ? { ...ihdr, trns, idat: Buffer.concat(idat) } : null;
}

function readJpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  while (off + 4 <= buf.length) {
    if (buf[off] !== 0xff) { off++; continue; }
    const marker = buf[off + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) { off += marker === 0xff ? 1 : 2; continue; }
    const len = buf.readUInt16BE(off + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
    off += 2 + len;
  }
  return null;
}

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
// 알파 채널이 있는가, 실제로 투명한 픽셀이 있는가(true / false / 'unknown').
function transparency(png) {
  const { colorType, bitDepth, trns } = png;
  if (colorType === 3) return { alphaChannel: !!trns, transparentPixels: !!trns && [...trns].some(v => v < 255) };
  if (colorType === 0 || colorType === 2) return { alphaChannel: !!trns, transparentPixels: trns ? 'unknown' : false };
  if (colorType !== 4 && colorType !== 6) return { alphaChannel: false, transparentPixels: 'unknown' };
  if (png.interlace !== 0 || (bitDepth !== 8 && bitDepth !== 16)) return { alphaChannel: true, transparentPixels: 'unknown' };
  const raw = zlib.inflateSync(png.idat);
  const channels = CHANNELS[colorType], sample = bitDepth / 8, bpp = channels * sample, stride = png.width * bpp;
  let prev = Buffer.alloc(stride), row = Buffer.alloc(stride), p = 0;
  for (let y = 0; y < png.height; y++) {
    const filter = raw[p++];
    raw.copy(row, 0, p, p + stride); p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = row[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      row[i] = v & 255;
    }
    for (let x = 0; x < png.width; x++) {
      const i = x * bpp + (channels - 1) * sample;
      const alpha = sample === 1 ? row[i] : (row[i] << 8) | row[i + 1];
      if (alpha < (sample === 1 ? 255 : 65535)) return { alphaChannel: true, transparentPixels: true };
    }
    const t = prev; prev = row; row = t;
  }
  return { alphaChannel: true, transparentPixels: false };
}

function inspectFile(file) {
  const buf = fs.readFileSync(file);
  const png = readPng(buf);
  if (png) return { format: 'png', width: png.width, height: png.height, bytes: buf.length, sha256: sha256(buf), ...transparency(png) };
  const jpg = readJpeg(buf);
  if (jpg) return { format: 'jpeg', width: jpg.width, height: jpg.height, bytes: buf.length, sha256: sha256(buf), alphaChannel: false, transparentPixels: false };
  return { format: 'unknown', bytes: buf.length, sha256: sha256(buf) };
}

// 한 장의 규칙 위반 목록. 빈 배열이면 통과.
function imageProblems(rule, info, templateHashes) {
  const out = [];
  if (!rule.formats.includes(info.format)) out.push(`형식 ${info.format} — ${rule.formats.join('/')} 이어야 해요`);
  if (rule.width && (info.width !== rule.width || info.height !== rule.height)) out.push(`크기 ${info.width}×${info.height} — ${rule.width}×${rule.height} 이어야 해요`);
  if (rule.alphaChannel === 'forbidden' && info.alphaChannel) out.push('알파 채널이 없어야 해요(불투명 24비트)');
  if (rule.alphaChannel === 'required' && info.alphaChannel === false) out.push('알파 채널이 있어야 해요');
  if (rule.transparentPixels === 'forbidden' && info.transparentPixels === true) out.push('투명한 픽셀이 없어야 해요');
  if (rule.transparentPixels === 'required' && info.transparentPixels === false) out.push('배경이 투명해야 해요');
  if (rule.transparentPixels === 'required' && info.transparentPixels === 'unknown') out.push('투명도를 읽지 못했어요 — 8/16비트 비인터레이스 PNG 로 저장해 주세요');
  if (rule.maxBytes && info.bytes > rule.maxBytes) out.push(`용량 ${Math.ceil(info.bytes / 1024)}KB — ${Math.round(rule.maxBytes / 1024)}KB 이하여야 해요`);
  if (templateHashes.has(info.sha256)) out.push('Expo 템플릿 이미지 그대로예요');
  return out;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

// root: 저장소 경로 / contract: 계약 객체 / config: 실제 앱 설정(없으면 설정 검사 생략)
// splashModuleInstalled: expo-splash-screen 설치 여부 / nativeDir: android res 경로(없으면 생략)
function checkAll({ root, contract, config, splashModuleInstalled, nativeDir }) {
  const templateHashes = new Set(Object.entries(contract.templateFingerprints).filter(([k]) => k !== 'note').map(([, v]) => v));
  const results = [];
  const add = (id, priority, problems, warnings = [], files = []) => results.push({
    id, priority, files,
    status: problems.length ? (priority === 'P0' ? 'FAIL' : 'WARN') : warnings.length ? 'WARN' : 'PASS',
    messages: [...problems, ...warnings],
  });

  for (const entry of contract.assets) {
    if (entry.kind === 'file') {
      const candidates = [entry.destination, ...(entry.alternatives ?? [])].filter(p => fs.existsSync(path.join(root, p)));
      if (!candidates.length) { add(entry.id, entry.priority, [`파일 없음: ${entry.destination}`]); continue; }
      const info = inspectFile(path.join(root, candidates[0]));
      add(entry.id, entry.priority, imageProblems(entry, info, templateHashes), [], [candidates[0]]);
    } else if (entry.kind === 'files') {
      const problems = [];
      for (const dest of entry.destinations) {
        if (!fs.existsSync(path.join(root, dest))) { problems.push(`파일 없음: ${dest}`); continue; }
        for (const p of imageProblems(entry, inspectFile(path.join(root, dest)), templateHashes)) problems.push(`${path.basename(dest)}: ${p}`);
      }
      add(entry.id, entry.priority, problems, [], entry.destinations);
    } else if (entry.kind === 'set') {
      const dir = path.join(root, entry.directory), re = new RegExp(entry.pattern, 'i');
      const shots = fs.existsSync(dir) ? fs.readdirSync(dir).filter(n => re.test(n)).sort() : [];
      const problems = [], warnings = [];
      if (shots.length < entry.minCount) problems.push(`${entry.directory}/phone-01.png… ${shots.length}장 — ${entry.minCount}장 이상 필요해요`);
      if (shots.length > entry.maxCount) problems.push(`${shots.length}장 — ${entry.maxCount}장 이하여야 해요`);
      for (const name of shots) {
        const info = inspectFile(path.join(dir, name));
        for (const p of imageProblems(entry, info, templateHashes)) problems.push(`${name}: ${p}`);
        if (info.width && info.height) {
          const short = Math.min(info.width, info.height), long = Math.max(info.width, info.height);
          if (short < entry.minSide || long > entry.maxSide) problems.push(`${name}: 변 길이 ${info.width}×${info.height} — ${entry.minSide}~${entry.maxSide}px`);
          if (long > short * entry.maxAspect) problems.push(`${name}: 긴 변이 짧은 변의 ${entry.maxAspect}배를 넘어요`);
          if (short < entry.recommendedMinSide) warnings.push(`${name}: 짧은 변 ${short}px — 홍보용 권장 ${entry.recommendedMinSide}px 이상`);
        }
      }
      add(entry.id, entry.priority, problems, warnings, shots.map(n => `${entry.directory}/${n}`));
    }
  }

  if (config) {
    const problems = [];
    const refs = [
      ['expo.icon', config.icon],
      ['android.adaptiveIcon.foregroundImage', config.android?.adaptiveIcon?.foregroundImage],
      ['android.adaptiveIcon.backgroundImage', config.android?.adaptiveIcon?.backgroundImage],
      ['android.adaptiveIcon.monochromeImage', config.android?.adaptiveIcon?.monochromeImage],
    ];
    for (const [key, ref] of refs) {
      if (!ref) { if (key !== 'android.adaptiveIcon.backgroundImage') problems.push(`${key} 이 비어 있어요`); continue; }
      const file = path.join(root, ref);
      if (!fs.existsSync(file)) { problems.push(`${key} → ${ref} 파일이 없어요`); continue; }
      if (templateHashes.has(sha256(fs.readFileSync(file)))) problems.push(`${key} → ${ref} 는 Expo 템플릿 이미지예요`);
    }
    const splash = (config.plugins ?? []).find(p => (Array.isArray(p) ? p[0] : p) === 'expo-splash-screen');
    if (!splashModuleInstalled) problems.push('expo-splash-screen 이 설치되지 않았어요 — npx expo install expo-splash-screen');
    if (!splash) problems.push('스플래시가 설정에 연결되지 않았어요(assets/brand/splash-icon.png 를 넣으면 app.config.js 가 연결)');
    else {
      const image = Array.isArray(splash) ? splash[1]?.image : undefined;
      if (!image || !fs.existsSync(path.join(root, image))) problems.push(`스플래시 이미지 ${image ?? '(없음)'} 를 찾지 못했어요`);
      else if (templateHashes.has(sha256(fs.readFileSync(path.join(root, image))))) problems.push('스플래시 이미지가 Expo 템플릿이에요');
    }
    add('app_config', 'P0', problems);
  }

  if (nativeDir && fs.existsSync(nativeDir)) {
    const fingerprints = new Set(contract.nativeTemplateFingerprints.sha256);
    const stale = walk(nativeDir).filter(f => /(splashscreen_logo|ic_launcher)/.test(path.basename(f)) && fingerprints.has(sha256(fs.readFileSync(f))));
    add('native_resources', 'P0', stale.length ? [`android/ 에 템플릿으로 만든 리소스 ${stale.length}개가 남아 있어요 — 에셋을 넣은 뒤 npx expo prebuild --platform android --clean`] : [], [], stale.map(f => path.relative(root, f)));
  }
  return results;
}

module.exports = { readPng, readJpeg, transparency, inspectFile, imageProblems, checkAll };

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const contract = JSON.parse(fs.readFileSync(path.join(root, 'assets/asset-contract.json'), 'utf8'));
  const config = require(path.join(root, 'app.config.js'))();
  let splashModuleInstalled = false;
  try { require.resolve('expo-splash-screen/package.json', { paths: [root] }); splashModuleInstalled = true; } catch { /* 미설치 */ }
  const results = checkAll({ root, contract, config, splashModuleInstalled, nativeDir: path.join(root, contract.nativeTemplateFingerprints.directory) });
  for (const r of results) {
    console.log(`${r.status.padEnd(4)} ${r.priority} ${r.id}`);
    for (const m of r.messages) console.log('       · ' + m);
  }
  const fail = results.filter(r => r.status === 'FAIL').length, warn = results.filter(r => r.status === 'WARN').length;
  console.log(`\n출시 에셋 검사: FAIL ${fail} · WARN ${warn} · PASS ${results.length - fail - warn}`);
  const jsonAt = process.argv.indexOf('--json');
  if (jsonAt > 0 && process.argv[jsonAt + 1]) fs.writeFileSync(process.argv[jsonAt + 1], JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  process.exit(fail ? 1 : 0);
}
