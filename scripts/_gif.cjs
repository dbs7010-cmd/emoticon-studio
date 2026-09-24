// GIF 를 프레임으로 푼다. 엔진이 구운 실제 출력 파일을 그대로 읽기 위한 것이다 —
// 움직임을 눈이 아니라 **내보낸 결과**로 재고, 프레임 수·간격·투명도도 같이 확인한다.
// 필요한 만큼만 구현했다: GIF87a/89a · 전역/지역 색표 · LZW · 투명 색인 · 프레임 배치.
function decode(buf) {
  let p = 0;
  const u8 = () => buf[p++];
  const u16 = () => { const v = buf[p] | (buf[p + 1] << 8); p += 2; return v; };
  const sig = buf.slice(0, 6).toString('latin1');
  if (sig !== 'GIF87a' && sig !== 'GIF89a') throw new Error('GIF 가 아니다: ' + sig);
  p = 6;
  const width = u16(), height = u16();
  const packed = u8(); u8(); u8();
  let global = null;
  if (packed & 0x80) {
    const n = 2 << (packed & 7);
    global = buf.slice(p, p + n * 3); p += n * 3;
  }
  const frames = [];
  let delay = 0, transparent = -1, disposal = 0;
  const blocks = () => {                      // 하위 블록을 하나로 잇는다
    const out = [];
    for (;;) { const n = u8(); if (!n) break; out.push(buf.slice(p, p + n)); p += n; }
    return Buffer.concat(out);
  };
  for (;;) {
    if (p >= buf.length) break;
    const b = u8();
    if (b === 0x3B) break;                    // trailer
    if (b === 0x21) {                         // extension
      const label = u8();
      if (label === 0xF9) {                   // graphic control
        const n = u8(); const flags = buf[p]; delay = buf[p + 1] | (buf[p + 2] << 8);
        transparent = (flags & 1) ? buf[p + 3] : -1;
        disposal = (flags >> 2) & 7;
        p += n; u8();
      } else { blocks(); }
      continue;
    }
    if (b !== 0x2C) throw new Error('모르는 블록 0x' + b.toString(16) + ' at ' + (p - 1));
    const x = u16(), y = u16(), w = u16(), h = u16();
    const lf = u8();
    let table = global;
    if (lf & 0x80) { const n = 2 << (lf & 7); table = buf.slice(p, p + n * 3); p += n * 3; }
    const interlaced = !!(lf & 0x40);
    const minCode = u8();
    const data = blocks();
    const idx = lzw(data, minCode, w * h);
    frames.push({ x, y, w, h, delay: delay * 10, transparent, disposal, interlaced, idx, table });
    delay = 0; transparent = -1; disposal = 0;
  }
  return { width, height, frames };
}

function lzw(data, minCode, expect) {
  const clear = 1 << minCode, end = clear + 1;
  let size = minCode + 1, mask = (1 << size) - 1;
  let next = end + 1;
  const prefix = new Int32Array(4096), suffix = new Int32Array(4096), first = new Int32Array(4096);
  for (let i = 0; i < clear; i++) { prefix[i] = -1; suffix[i] = i; first[i] = i; }
  const out = new Uint8Array(expect);
  let o = 0, bit = 0, prev = -1;
  const stack = new Int32Array(4096);
  const read = () => {
    let v = 0;
    for (let i = 0; i < size; i++) {
      const byte = data[(bit >> 3)];
      if (byte === undefined) return -1;
      v |= ((byte >> (bit & 7)) & 1) << i;
      bit++;
    }
    return v & mask;
  };
  for (;;) {
    const code = read();
    if (code < 0 || code === end) break;
    if (code === clear) { size = minCode + 1; mask = (1 << size) - 1; next = end + 1; prev = -1; continue; }
    let cur = code, sp = 0;
    if (code === next && prev >= 0) { stack[sp++] = first[prev]; cur = prev; }
    while (cur >= 0 && sp < 4096) { stack[sp++] = suffix[cur]; cur = prefix[cur]; }
    while (sp > 0 && o < expect) out[o++] = stack[--sp];
    if (prev >= 0 && next < 4096) {
      prefix[next] = prev; suffix[next] = first[code < next ? code : prev];
      first[next] = first[prev]; next++;
      if ((next & mask) === 0 && next < 4096) { size++; mask = (1 << size) - 1; }
    }
    prev = code;
    if (o >= expect) break;
  }
  return out;
}

// 프레임을 차례로 합성해 화면 한 장씩을 만든다(폐기 방식 반영).
function compose(gif) {
  const { width: W, height: H, frames } = gif;
  const screen = new Uint8Array(W * H * 4);   // RGBA
  const shots = [];
  for (const f of frames) {
    const before = f.disposal === 3 ? Uint8Array.from(screen) : null;
    const rows = f.interlaced ? deinterlace(f.h) : null;
    for (let row = 0; row < f.h; row++) {
      const sy = rows ? rows[row] : row;
      for (let col = 0; col < f.w; col++) {
        const c = f.idx[row * f.w + col];
        if (c === f.transparent) continue;
        const dx = f.x + col, dy = f.y + sy;
        if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
        const d = (dy * W + dx) * 4;
        screen[d] = f.table[c * 3]; screen[d + 1] = f.table[c * 3 + 1]; screen[d + 2] = f.table[c * 3 + 2]; screen[d + 3] = 255;
      }
    }
    shots.push({ delay: f.delay, rgba: Uint8Array.from(screen), disposal: f.disposal, transparent: f.transparent >= 0 });
    if (f.disposal === 2) {                    // 배경으로 되돌리기
      for (let row = 0; row < f.h; row++) for (let col = 0; col < f.w; col++) {
        const dx = f.x + col, dy = f.y + row;
        if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
        const d = (dy * W + dx) * 4; screen[d] = screen[d + 1] = screen[d + 2] = screen[d + 3] = 0;
      }
    } else if (f.disposal === 3 && before) screen.set(before);
  }
  return { width: W, height: H, shots };
}
function deinterlace(h) {
  const out = []; for (const [start, step] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let y = start; y < h; y += step) out.push(y);
  return out;
}
module.exports = { decode, compose };
