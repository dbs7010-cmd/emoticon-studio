// 표시용 그림을 만든다. 원본은 선만 있고 속이 비어 있어(불투명 4% · 선 사이 80% 투명),
// 파스텔 카드 위에 올리면 배경색이 캐릭터 몸 안으로 비친다.
//
// 하는 일: 테두리에서 시작해 투명한 곳을 타고 들어가며 '바깥'을 표시한다. 그러고도 닿지 않은
// 투명한 곳이 '몸 안'이다. 거기에만 흰색을 깔고 원본을 그 위에 합성한다.
//   - 바깥은 그대로 투명하다. 그림 전체를 흰 사각형으로 덮지 않는다.
//   - 원본 파일은 건드리지 않는다. 결과는 assets/expression-guides/display/ 에 따로 쓴다.
//   - 선이 끊겨 흰색이 바깥으로 샐 수 있는 그림은 **만들지 않고 목록으로 보고한다**.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const SRC = path.resolve(__dirname, '..', 'assets', 'expression-guides');
const OUT = path.join(SRC, 'display');

const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return b => { let c = 0xFFFFFFFF; for (const x of b) c = t[(c ^ x) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
})();

function readPng(file) {
  const b = fs.readFileSync(file);
  let off = 8, w = 0, h = 0, depth = 0, type = 0; const idat = [];
  while (off < b.length) {
    const len = b.readUInt32BE(off), tag = b.slice(off + 4, off + 8).toString('latin1');
    const data = b.slice(off + 8, off + 8 + len);
    if (tag === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; }
    if (tag === 'IDAT') idat.push(data);
    if (tag === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || type !== 6) return { w, h, depth, type, rgba: null };
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp, out = Buffer.alloc(h * stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    for (let x = 0; x < stride; x++) {
      const cur = raw[p + x];
      const a = x >= bpp ? out[y * stride + x - bpp] : 0;
      const bb = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = (x >= bpp && y > 0) ? out[(y - 1) * stride + x - bpp] : 0;
      let v;
      if (filter === 0) v = cur; else if (filter === 1) v = cur + a; else if (filter === 2) v = cur + bb;
      else if (filter === 3) v = cur + ((a + bb) >> 1);
      else { const pa = Math.abs(bb - c), pb = Math.abs(a - c), pc = Math.abs(a + bb - 2 * c); v = cur + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c); }
      out[y * stride + x] = v & 255;
    }
    p += stride;
  }
  return { w, h, depth, type, rgba: out };
}

function writePng(file, w, h, rgba) {
  const stride = w * 4, raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) { raw[y * (stride + 1)] = 0; rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const chunk = (tag, data) => {
    const out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0); out.write(tag, 4, 'latin1'); data.copy(out, 8);
    out.writeUInt32BE(CRC(Buffer.concat([Buffer.from(tag, 'latin1'), data])), 8 + data.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

// 바깥에서 타고 들어갈 수 있는 투명한 곳을 표시한다(4방향). 남은 투명한 곳이 '몸 안'이다.
const EMPTY = 24;          // 이보다 옅으면 '비어 있다'고 본다
function insideMask(w, h, rgba, widenBy = 0) {
  // 그림이 **틀 가장자리에서 잘려** 나가면(이불·책상처럼 화면 밖으로 이어지는 것) 윤곽이 거기서 끊긴다.
  // 그러면 몸 안이 가장자리를 타고 바깥과 이어져 버려 '안'으로 세어지지 않는다 — '잘 자 · 이불' 이 그랬다.
  // 한 변에서 선이 두 번 이상 닿으면, 그 사이의 가장자리는 그 그림의 **잘린 밑변**이다. 거기를 벽으로 막는다.
  // 한 번만 닿으면(스쳐 지나감) 막지 않는다 — 진짜 바깥을 잘못 칠하지 않기 위해서다.
  let wall = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3] > EMPTY) wall[i] = 1;
  const ink = Uint8Array.from(wall);
  if (widenBy > 0) wall = widen(w, h, wall, widenBy);
  const sealed = [];
  const sealEdge = (at, n) => {
    let first = -1, last = -1, groups = 0, was = false;
    for (let k = 0; k < n; k++) {
      const on = wall[at(k)] === 1;
      if (on && !was) { groups++; if (first < 0) first = k; }
      if (on) last = k;
      was = on;
    }
    if (groups < 2 || first < 0) return 0;
    let added = 0;
    for (let k = first; k <= last; k++) { const i = at(k); if (!wall[i]) { wall[i] = 1; added++; } }
    return added;
  };
  const before = sealEdge(k => k, w);                       // 위
  const after = sealEdge(k => (h - 1) * w + k, w);          // 아래
  const left = sealEdge(k => k * w, h);                     // 왼쪽
  const right = sealEdge(k => k * w + (w - 1), h);          // 오른쪽
  const sealedCount = before + after + left + right;
  if (before) sealed.push('위'); if (after) sealed.push('아래'); if (left) sealed.push('왼쪽'); if (right) sealed.push('오른쪽');

  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = y * w + x;
    if (seen[i] || wall[i]) return;
    seen[i] = 1; stack.push(i);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i - x) / w;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  const inside = new Uint8Array(w * h);
  let count = 0;
  // 굵힌 선 안쪽만 '안'으로 잡힌다. 굵힌 만큼 도로 넓혀 원래 선 바로 안까지 채운다.
  let core = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if (!seen[i] && !wall[i]) core[i] = 1;
  if (widenBy > 0) core = widen(w, h, core, widenBy);
  for (let i = 0; i < w * h; i++) { if (ink[i]) core[i] = 0; if (core[i]) { inside[i] = 1; count++; } }
  return { inside, count, outside: seen, sealed, sealedCount, wall };
}

// 선을 n 칸 굵힌다(4방향). 끊어진 윤곽을 잠깐 잇기 위한 것이고, 채운 뒤 같은 만큼 물린다.
function widen(w, h, mask, n) {
  let cur = mask;
  for (let step = 0; step < n; step++) {
    const next = Uint8Array.from(cur);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (cur[i]) continue;
      if ((x > 0 && cur[i - 1]) || (x < w - 1 && cur[i + 1]) || (y > 0 && cur[i - w]) || (y < h - 1 && cur[i + w])) next[i] = 1;
    }
    cur = next;
  }
  return cur;
}

// 끊긴 윤곽을 이어 가며 '몸 안'을 찾는다. 멀쩡한 그림은 첫판(굵히지 않음)에서 바로 끝난다.
// 건강한 그림의 채움 넓이는 22~39% 다. 그 절반도 안 되면 선이 끊긴 것으로 보고 한 칸씩 굵혀 본다.
const HEALTHY = 0.18, MAX_WIDEN = 5;
function closedInside(w, h, rgba) {
  let best = null, base = null;
  for (const n of [0, 2, 3, 4, 5, 6]) {
    if (n > MAX_WIDEN) break;
    const r = insideMask(w, h, rgba, n);
    const ratio = r.count / (w * h);
    // 채운 자리가 틀 가장자리에 닿았다면 바깥으로 샌 것이다 — 그 판은 버린다.
    let leaked = false;
    for (let x = 0; x < w && !leaked; x++) if (r.inside[x] || r.inside[(h - 1) * w + x]) leaked = true;
    for (let y = 0; y < h && !leaked; y++) if (r.inside[y * w] || r.inside[y * w + w - 1]) leaked = true;
    if (leaked) continue;
    // 선을 굵히면 **좁은 부위**(팔과 얼굴이 만나는 자리 같은 곳)가 통째로 막혀 채워지지 않는다.
    // 굵히기는 안쪽을 더 찾기 위한 것이지 이미 찾은 안쪽을 잃기 위한 것이 아니다 —
    // 굵히지 않았을 때 안쪽이던 자리가 하나라도 빠지면 그 판은 버린다(카드 색이 홈으로 비친다).
    if (n > 0) {
      if (!base) base = insideMask(w, h, rgba, 0);
      let lost = 0, gained = 0;
      for (let i = 0; i < w * h; i++) {
        if (base.inside[i] && !r.inside[i]) lost++;
        if (!base.inside[i] && r.inside[i]) gained++;
      }
      // 굵히기는 안쪽을 **더 찾기 위한** 것이다. 좁은 부위(팔과 얼굴이 만나는 자리)가 통째로 막혀
      // 이미 찾은 안쪽을 잃으면 그 자리에 카드 색이 홈으로 비친다. 얻는 것이 잃는 것보다
      // 열 배는 많아야 하고, 잃는 양 자체도 그림의 1% 를 넘지 않아야 한다.
      if (lost > w * h * 0.01) continue;
      if (lost > 0 && gained < lost * 10) continue;
    }
    if (!best || ratio > best.ratio) best = { ...r, ratio, widen: n };
    if (ratio >= HEALTHY) return { ...r, ratio, widen: n };
  }
  return best;
}

// 채운 뒤에도 남은 '홈'을 센다. 비어 있는데 둘레가 거의 다 선이거나 몸 안인 자리다 —
// 카드 위에 올리면 그 자리로 배경색이 비쳐 보인다.
function pockets(w, h, rgba, inside) {
  const R = 3;
  let n = 0;
  for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) {
    const i = y * w + x;
    if (inside[i] || rgba[i * 4 + 3] > EMPTY) continue;
    let filled = 0, total = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const j = (y + dy) * w + (x + dx); total++;
      if (inside[j] || rgba[j * 4 + 3] > EMPTY) filled++;
    }
    if (filled / total >= 0.8) n++;
  }
  return n;
}

// 흰 바탕 위에 원본을 얹는다(알파 합성). 몸 안에서만 바탕이 흰색이고, 바깥은 바탕이 없다.
function compose(w, h, rgba, inside) {
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3] / 255;
    // 바탕: 몸 안이거나, 몸 안에 닿아 있는 반투명 가장자리.
    const bg = inside[i] ? 1 : 0;
    const outA = a + (1 - a) * bg;
    for (let c = 0; c < 3; c++) {
      const src = rgba[i * 4 + c] * a, back = 255 * bg * (1 - a);
      out[i * 4 + c] = outA > 0 ? Math.round((src + back) / outA) : 0;
    }
    out[i * 4 + 3] = Math.round(outA * 255);
  }
  return out;
}

// 반투명 가장자리 안쪽까지 흰 바탕을 한 칸 넓힌다 — 그러지 않으면 선 안쪽에 회색 테가 남는다.
function grow(w, h, inside) {
  const next = Uint8Array.from(inside);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (inside[i]) continue;
    if ((x > 0 && inside[i - 1]) || (x < w - 1 && inside[i + 1]) || (y > 0 && inside[i - w]) || (y < h - 1 && inside[i + w])) next[i] = 1;
  }
  return next;
}

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.png')).sort();
fs.mkdirSync(OUT, { recursive: true });
const made = [], skipped = [];
for (const name of files) {
  const { w, h, rgba, depth, type } = readPng(path.join(SRC, name));
  if (!rgba) { skipped.push({ name, why: '8bit RGBA 가 아니다 (depth ' + depth + ' type ' + type + ')' }); continue; }
  const found = closedInside(w, h, rgba);
  const { inside, count, sealed } = found || { inside: new Uint8Array(w * h), count: 0, sealed: [] };
  const ratio = count / (w * h);
  const widenBy = found ? found.widen : 0;
  // 선이 끊겨 바깥과 이어져 있으면 채울 '안'이 거의 없다. 억지로 칠하지 않고 목록으로 남긴다.
  if (ratio < 0.04) { skipped.push({ name, why: '몸 안으로 닫힌 자리가 거의 없다 (' + (ratio * 100).toFixed(1) + '%) — 선이 끊겼을 수 있다', 채움: +(ratio * 100).toFixed(1), 할일: '원본의 끊긴 윤곽선을 이어야 한다' }); continue; }
  // 채우고도 홈이 남으면 카드에서 배경색이 그 자리로 비친다. 그대로 내보내지 않는다.
  const hole = pockets(w, h, rgba, grow(w, h, inside));
  if (hole > w * h * 0.004) {
    skipped.push({ name, why: '채우고도 몸 안에 빈 자리가 남는다 (' + hole + 'px) — 윤곽선이 끊긴 곳이 있다',
      채움: +(ratio * 100).toFixed(1), 홈: hole, 할일: '원본에서 팔·얼굴이 만나는 자리의 끊긴 선을 이어야 한다' });
    continue;
  }
  writePng(path.join(OUT, name), w, h, compose(w, h, rgba, grow(w, h, inside)));
  // 남은 홈은 숨기지 않고 함께 적는다. 몸 전체가 비치는 것보다는 낫지만 원본을 고치면 없어진다.
  made.push({ name, fill: +(ratio * 100).toFixed(1), ...(hole ? { 남은홈: hole } : {}), ...(sealed.length ? { 잘린변: sealed } : {}), ...(widenBy ? { 이어붙인틈: widenBy } : {}) });
}
console.log('  표시용 그림 ' + made.length + '장 · 만들지 않음 ' + skipped.length + '장');
console.log('  채운 넓이: 최소 ' + Math.min(...made.map(m => m.fill)) + '% · 중앙값 ' +
  made.map(m => m.fill).sort((a, b) => a - b)[made.length >> 1] + '% · 최대 ' + Math.max(...made.map(m => m.fill)) + '%');
for (const s of skipped) console.log('    만들지 않음: ' + s.name + ' — ' + s.why);
fs.writeFileSync(path.join(OUT, 'INDEX.json'), JSON.stringify({ made, skipped }, null, 2));
