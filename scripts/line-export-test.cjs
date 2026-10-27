// LINE 움직이는 스티커 출력(2026-10-27, EM-G07) — 앱과 같은 캔버스 엔진으로 실제 그림(Codex 콘)을 굽고,
// 앱과 같은 코드(src/services/line-export.ts)로 APNG 를 묶어 LINE 규격을 검사한다. 마지막으로 Chrome 이 그 APNG 를
// 움직이는 그림으로 읽는지(장마다 화면이 달라지는지)까지 본다. 카카오 경로(frames)는 그대로인지도 함께 확인.
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/line-export-test.cjs [나갈 폴더]
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
// 파일 저장은 쓰지 않는다 — expo-file-system 은 빈 흉내로 둔다.
const load = loader({ 'expo-file-system': { Directory: class {}, File: class {}, Paths: { document: 'document' } } });
const { canvasHtml } = load('src/painter/canvas-html.ts');
const L = load('src/services/line-export.ts');
const { decodeDataUrl, readZipNames } = load('src/services/export.ts');
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : null;

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent(canvasHtml.replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>'));
    const cmd = m => page.evaluate(m => window.command(m), m);
    const last = type => page.evaluate(t => window.messages.filter(m => m.type === t).at(-1), type);
    const png = name => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '..', 'assets', 'mascot', name + '.png')).toString('base64');
    await cmd({ type: 'init', layers: [{ id: 'draw-1', name: '그림', data: png('corn-base') }], activeLayerId: 'draw-1' });
    await page.waitForTimeout(300);
    await cmd({ type: 'scaleAll', factor: .8 });

    let id = 0;
    const line = async (motion, spec) => { await cmd({ type: 'motion', motion }); await cmd({ type: 'lineFrames', id: ++id, spec }); return (await last('lineFrames')).line; };
    const files = [];
    // 비어서 시작하는 효과(뿅): LINE 은 첫 장을 멈춘 그림으로 쓴다 → 첫 장에 그림이 보여야 한다(2026-10-28 에뮬레이터에서 발견).
    {
      const pop = await line({ version: 1, preset: 'pop', speed: .5, strength: .5 }, { w: L.LINE_STICKER.w, h: L.LINE_STICKER.h, count: 0 });
      const cover = await page.evaluate(async url => { const img = new Image(); img.src = url; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 16) n++; return n / (c.width * c.height); }, pop.sheets[0]);
      assert.ok(cover > .1, '뿅도 첫 장에 그림이 보인다(덮인 비율 ' + cover.toFixed(2) + ')');
    }
    const motions = { bounce: .5, hop: .5, tilt: .5, float: .5, nod: .5, bow: .5, dance: .5, sway: .5 };
    for (const [i, preset] of Object.keys(motions).entries()) {
      const made = await line({ version: 1, preset, speed: .5, strength: .5 }, { w: L.LINE_STICKER.w, h: L.LINE_STICKER.h, count: 0 });
      const plan = L.linePlan(made.loop, made.count);
      assert.ok(plan, preset + ' 한 바퀴 4초 이하');
      assert.ok(made.count >= 5 && made.count <= 20, preset + ' 5~20장');
      const data = L.assembleApng(made.sheets.map(decodeDataUrl), plan.delayMs, plan.plays);
      const info = L.inspectPng(data);
      assert.deepEqual(L.lineProblems(info, 'sticker'), [], preset + ' LINE 규격');
      assert.equal(info.frames, made.count); assert.ok(info.seconds * info.plays <= 4.0001);
      files.push({ name: L.lineName(i), data, kind: 'sticker', problems: [] });
      console.log(`  ${L.lineName(i)} ${preset}: ${info.w}×${info.h} · ${info.frames}장 · 한 바퀴 ${info.seconds.toFixed(2)}초 × ${info.plays}회 · ${(info.bytes / 1024).toFixed(0)}KB`);
    }
    const main = await line({ version: 1, preset: 'bounce', speed: .5, strength: .5 }, { w: 240, h: 240, count: 0 });
    const mp = L.linePlan(main.loop, main.count), mainData = L.assembleApng(main.sheets.map(decodeDataUrl), mp.delayMs, mp.plays);
    assert.deepEqual(L.lineProblems(L.inspectPng(mainData), 'main'), [], 'main 규격');
    const tab = await line({ version: 1, preset: 'bounce', speed: .5, strength: .5 }, { w: 96, h: 74, count: 1, still: true });
    const tabData = decodeDataUrl(tab.sheets[0]);
    assert.deepEqual(L.lineProblems(L.inspectPng(tabData), 'tab'), [], 'tab 규격');
    files.push({ name: 'main.png', data: mainData, kind: 'main', problems: [] }, { name: 'tab.png', data: tabData, kind: 'tab', problems: [] });
    const zip = L.lineZip(files);
    assert.deepEqual(readZipNames(zip), [...files.map(f => f.name)]);

    // 일반(멈춘) 스티커: 움직이는 칸이어도 멈춘 모습 하나 · 370×320 · 여백 10px · 짝수 · 1MB · 투명 · APNG 아님
    {
      const st = await line({ version: 1, preset: 'hop', speed: .5, strength: .5 }, { w: L.LINE_STILL_STICKER.w, h: L.LINE_STILL_STICKER.h, count: 1, still: true, pad: L.LINE_STILL.pad });
      assert.equal(st.sheets.length, 1, '일반 스티커는 한 장');
      const d = decodeDataUrl(st.sheets[0]), info = L.inspectPng(d);
      assert.deepEqual(L.lineStillProblems(info, 'sticker'), [], '일반 스티커 규격');
      assert.deepEqual([info.w, info.h, info.animated], [370, 320, false]);
      const edge = await page.evaluate(async url => { const img = new Image(); img.src = url; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const px = g.getImageData(0, 0, c.width, c.height).data; let hit = 0; for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if ((x < 10 || y < 10 || x >= c.width - 10 || y >= c.height - 10) && px[(y * c.width + x) * 4 + 3] > 8) hit++; return hit; }, st.sheets[0]);
      assert.equal(edge, 0, '둘레 10px 안은 비어 있다(LINE 여백)');
      for (const [w, h, kind] of [[240, 240, 'main'], [96, 74, 'tab']]) {
        const x = await line({ version: 1, speed: .5, strength: .5 }, { w, h, count: 1, still: true, pad: 4 });
        assert.deepEqual(L.lineStillProblems(L.inspectPng(decodeDataUrl(x.sheets[0])), kind), [], kind + ' 규격');
      }
      assert.ok(L.lineStillProblems({ w: 371, h: 321, colorType: 6, frames: 1, plays: 0, seconds: 0, bytes: 1e4, animated: false }, 'sticker').length >= 2, '370×320 넘음·홀수 거절');
      assert.ok(L.lineStillProblems({ w: 370, h: 320, colorType: 6, frames: 5, plays: 1, seconds: 1, bytes: 1e4, animated: true }, 'sticker').length, 'APNG 거절');
      const proj = n => ({ slots: Array.from({ length: 32 }, (_, i) => ({ number: i + 1, ...(i < n ? { finalImage: { path: 'x' }, work: { layers: [] } } : {}) })) });
      assert.deepEqual([7, 8, 15, 16, 32, 33].map(n => L.lineStillCuts(proj(Math.min(n, 32))).size), [null, 8, 8, 16, 32, 32], '세트 8/16/24/32/40 중 가장 큰 수');
    }
    // 검사기가 실제로 거절하는지(규격 밖 예)
    assert.ok(L.lineProblems({ w: 360, h: 360, colorType: 6, frames: 24, plays: 4, seconds: 1.5, bytes: 2e6, animated: true }, 'sticker').length >= 3);
    assert.ok(L.lineProblems({ w: 270, h: 270, colorType: 6, frames: 1, plays: 0, seconds: 0, bytes: 1e4, animated: false }, 'sticker').length);
    assert.equal(L.linePlan(4.5), null, '한 바퀴 4초 넘으면 만들지 않음');
    assert.deepEqual(L.shrinkSteps(20), [20, 16, 12, 9, 7, 5]);
    assert.throws(() => L.lineZip([{ name: '01.png', data: new Uint8Array(1), kind: 'sticker', problems: ['x'] }]));

    // 장마다 제대로 풀리는가: APNG 를 장별 PNG 로 다시 나눠(IHDR + 그 장의 데이터, CRC 다시 계산) Chrome 이 디코드하게 하고,
    // 장끼리 그림이 달라지는지 본다(헤드리스 Chrome 캔버스는 움직이는 그림의 첫 장만 그려서 재생 확인으로는 못 쓴다).
    const { crc32 } = load('src/services/export.ts');
    const split = apng => {
      const ck = [], dv = new DataView(apng.buffer, apng.byteOffset);
      for (let at = 8; at < apng.length;) { const n = dv.getUint32(at), t = String.fromCharCode(...apng.subarray(at + 4, at + 8)); ck.push({ t, d: apng.subarray(at + 8, at + 8 + n), crc: dv.getUint32(at + 8 + n) }); at += 12 + n; }
      for (const c of ck) assert.equal(c.crc, crc32(Buffer.concat([Buffer.from(c.t, 'latin1'), c.d])), c.t + ' CRC');
      const seqs = ck.filter(c => c.t === 'fcTL' || c.t === 'fdAT').map(c => new DataView(c.d.buffer, c.d.byteOffset).getUint32(0));
      assert.deepEqual(seqs, seqs.map((_, i) => i), '순번 0부터 빠짐없이');
      const mk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4, 'latin1'); Buffer.from(d).copy(b, 8); b.writeUInt32BE(crc32(Buffer.concat([Buffer.from(t, 'latin1'), Buffer.from(d)])), 8 + d.length); return b; };
      const ihdr = ck.find(c => c.t === 'IHDR').d, frames = []; let cur = null;
      for (const c of ck) { if (c.t === 'fcTL') { cur = []; frames.push(cur); } else if (c.t === 'IDAT') cur.push(c.d); else if (c.t === 'fdAT') cur.push(c.d.subarray(4)); }
      return frames.map(parts => Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), mk('IHDR', ihdr), ...parts.map(p => mk('IDAT', p)), mk('IEND', [])]).toString('base64'));
    };
    const decoded = await page.evaluate(async list => Promise.all(list.map(async b64 => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); return c.toDataURL();
    })), split(files[1].data));
    assert.equal(decoded.length, L.inspectPng(files[1].data).frames, '장 수만큼 풀림');
    assert.ok(new Set(decoded).size >= Math.min(5, decoded.length), '장마다 그림이 달라짐(LINE: 같은 장만 있으면 업로드 오류)');

    // 카카오 경로는 그대로(360×360 프레임 · GIF)
    await cmd({ type: 'motion', motion: { version: 1, preset: 'bounce', speed: .5, strength: .5 } });
    await cmd({ type: 'frames', id: ++id, fps: 12, sheets: true });
    const k = (await last('frames')).gif;
    const kinfo = L.inspectPng(decodeDataUrl(k.sheets[0]));
    assert.equal(kinfo.w, 360); assert.equal(kinfo.h, 360); assert.ok(k.data.startsWith('data:image/gif'));
    assert.deepEqual(errors, [], errors.join(' | '));
    if (OUT) { fs.mkdirSync(OUT, { recursive: true }); for (const f of files) fs.writeFileSync(path.join(OUT, f.name), f.data); fs.writeFileSync(path.join(OUT, 'LINE-test.zip'), zip); }
    console.log(`PASS: line export — 콘 8칸 APNG(270×270, 5~20장, ≤4초, 1~4회, ≤1MB, 투명) + main 240×240 APNG + tab 96×74 PNG, ZIP ${(zip.length / 1024).toFixed(0)}KB · 규격 밖 거절 · 장별 디코드·서로 다름 확인 · 카카오 프레임 그대로 · 일반 스티커 370×320 PNG(여백 10px·짝수)·세트 8~40`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
