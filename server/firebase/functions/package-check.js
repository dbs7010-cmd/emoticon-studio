// 공모전 제출 묶음 검사(2026-10-07). 앱의 '이 세트 내보내기' ZIP(src/services/export.ts 규칙)을 그대로 받는다.
//  - 칸 파일: 맨 위의 NN.png / NN.webp / NN.gif (01 부터 빠짐없이). 공식 도구용 프레임(webp-animator/)·아이콘·공유 이미지는 함께 와도 된다.
//  - 확장자만 믿지 않고 파일 첫 바이트(PNG·WebP·GIF 서명)를 본다. 모든 항목의 CRC 를 확인한다(끊기거나 바뀐 묶음 거절).
//  - 공모전 규격: still = 칸 수만큼 PNG 전부 / moving = 칸 수 + 움직이는 칸(WebP·GIF) 최소 개수.
const zlib = require('node:zlib');

function readZip(buf) {
  if (buf.length < 22) throw new Error('ZIP 이 아니에요.');
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (buf.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('ZIP 끝을 찾지 못했어요(끊긴 파일).');
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const out = [];
  for (let i = 0; i < count; i++) {
    if (at + 46 > buf.length || buf.readUInt32LE(at) !== 0x02014b50) throw new Error('ZIP 목록이 깨졌어요.');
    const method = buf.readUInt16LE(at + 10), crc = buf.readUInt32LE(at + 16), csize = buf.readUInt32LE(at + 20), usize = buf.readUInt32LE(at + 24);
    const nlen = buf.readUInt16LE(at + 28), xlen = buf.readUInt16LE(at + 30), clen = buf.readUInt16LE(at + 32), off = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + nlen).toString('utf8');
    if (off + 30 > buf.length || buf.readUInt32LE(off) !== 0x04034b50) throw new Error('ZIP 내용이 깨졌어요.');
    const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
    if (start + csize > buf.length) throw new Error('ZIP 내용이 잘렸어요.');
    const raw = buf.subarray(start, start + csize);
    const data = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : null;
    if (!data) throw new Error('지원하지 않는 압축 방식이에요.');
    if (data.length !== usize || zlib.crc32(data) !== crc) throw new Error('ZIP 안의 파일이 손상됐어요(' + name + ').');
    out.push({ name, data });
    at += 46 + nlen + xlen + clen;
  }
  return out;
}

const kindOf = d => d.length >= 8 && d.readUInt32BE(0) === 0x89504e47 ? 'png'
  : d.length >= 12 && d.toString('ascii', 0, 4) === 'RIFF' && d.toString('ascii', 8, 12) === 'WEBP' ? 'webp'
  : d.length >= 6 && d.toString('ascii', 0, 4) === 'GIF8' ? 'gif' : null;

function checkPackage(buf, req) {
  let entries;
  try { entries = readZip(buf); } catch (e) { return { ok: false, reason: e.message }; }
  const cuts = new Map();
  for (const e of entries) {
    const m = /^(\d{2})\.(png|webp|gif)$/.exec(e.name);
    if (!m) continue;
    const real = kindOf(e.data);
    if (real !== m[2]) return { ok: false, reason: `${e.name} 파일 내용이 확장자와 달라요.` };
    if (cuts.has(m[1])) return { ok: false, reason: `${m[1]}번 칸이 두 번 들어 있어요.` };
    cuts.set(m[1], real);
  }
  const n = cuts.size, want = Number(req.cuts || 0);
  for (let i = 1; i <= n; i++) if (!cuts.has(String(i).padStart(2, '0'))) return { ok: false, reason: `${String(i).padStart(2, '0')}번 칸이 빠져 있어요.` };
  if (want && n !== want) return { ok: false, reason: `이 공모전은 ${want}칸 세트를 받아요(지금 ${n}칸).` };
  const formats = [...cuts.values()], animated = formats.filter(k => k !== 'png').length;
  if (req.kind === 'still' && animated) return { ok: false, reason: '멈춰 있는 세트 공모전이에요 — 움직이는 칸이 들어 있어요.' };
  if (req.kind === 'moving' && animated < Number(req.minAnimated || 1)) return { ok: false, reason: `움직이는 칸이 ${Number(req.minAnimated || 1)}개 이상 필요해요(지금 ${animated}개).` };
  const tally = formats.reduce((t, k) => ({ ...t, [k]: (t[k] || 0) + 1 }), {});
  return { ok: true, cuts: n, animated, formats: tally };
}

module.exports = { checkPackage, readZip, kindOf };
