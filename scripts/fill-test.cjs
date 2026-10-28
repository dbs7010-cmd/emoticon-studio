// Flood fill on a real pixel buffer: closed areas fill, lines hold, undo/redo work,
// and neither references nor the other drawing layer are touched.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loader } = require('./load-ts.cjs');
const { canvasHtml } = loader()('src/painter/canvas-html.ts');
const source = canvasHtml.split('<script>')[1].split('</script>')[0].replace(
  "window.addEventListener('resize',size);",
  "window.__layer=id=>(layers.find(l=>l.id===id)||activeDraw()).bitmap.getContext('2d').buffer;window.__reference=i=>references[i].bitmap.getContext('2d').buffer;window.addEventListener('resize',size);");

const SIZE = 360;
function context2d() {
  const buffer = new Uint8ClampedArray(SIZE * SIZE * 4);
  const g = { buffer, globalAlpha: 1, globalCompositeOperation: 'source-over', lineWidth: 1, strokeStyle: '#000', fillStyle: '#000', lineCap: 'round', lineJoin: 'round' };
  let path = [];
  const parse = hex => { const v = hex.replace('#', ''); const n = parseInt(v.length === 3 ? v.split('').map(c => c + c).join('') : v, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const stamp = (cx, cy, radius, colour) => {
    const erase = g.globalCompositeOperation === 'destination-out';
    for (let y = Math.floor(cy - radius); y <= cy + radius; y++) for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      const distance = Math.hypot(x - cx, y - cy);
      if (distance > radius + .5) continue;
      const coverage = Math.min(1, Math.max(0, radius + .5 - distance));
      const k = (y * SIZE + x) * 4;
      if (erase) { buffer[k + 3] = Math.round(buffer[k + 3] * (1 - coverage)); continue; }
      const alpha = 255 * g.globalAlpha * coverage;
      if (alpha <= buffer[k + 3]) continue;
      buffer[k] = colour[0]; buffer[k + 1] = colour[1]; buffer[k + 2] = colour[2]; buffer[k + 3] = Math.round(alpha);
    }
  };
  for (const name of ['save', 'restore', 'translate', 'rotate', 'scale', 'drawImage']) g[name] = () => {};
  g.clearRect = () => buffer.fill(0);
  g.beginPath = () => { path = []; };
  g.moveTo = (x, y) => { path = [[x, y]]; };
  g.lineTo = (x, y) => path.push([x, y]);
  g.arc = (x, y, r) => { path = [[x, y]]; g.__radius = r; };
  g.fill = () => stamp(path[0][0], path[0][1], g.__radius ?? g.lineWidth / 2, parse(g.fillStyle));
  g.stroke = () => {
    const colour = parse(g.strokeStyle), radius = g.lineWidth / 2;
    for (let i = 1; i < path.length; i++) {
      const [x1, y1] = path[i - 1], [x2, y2] = path[i], steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
      for (let t = 0; t <= steps; t++) stamp(x1 + (x2 - x1) * t / steps, y1 + (y2 - y1) * t / steps, radius, colour);
    }
  };
  // Text is stamped as a blob at its anchor: enough to prove where the words are burned in.
  g.font = ''; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const fontSize = () => Number((/(\d+)px/.exec(g.font) || [0, 10])[1]);
  g.measureText = text => ({ width: text.length * fontSize() * .6 });
  g.fillText = (text, x, y) => { g.__caption = { text, font: g.font, width: g.measureText(text).width }; stamp(x, y, 5, parse(g.fillStyle)); };
  g.strokeText = (text, x, y) => { (g.__strokes = g.__strokes || []).push({ text, style: String(g.strokeStyle).toUpperCase(), width: g.lineWidth, font: g.font }); };
  g.getImageData = () => ({ data: buffer.slice(), width: SIZE, height: SIZE });
  g.putImageData = image => buffer.set(image.data);
  return g;
}
function element() {
  const node = { width: SIZE, height: SIZE, style: {}, scrollLeft: 0, scrollTop: 0, handlers: {} };
  let ctx = null;
  node.getContext = () => (ctx = ctx || context2d());
  node.getBoundingClientRect = () => ({ left: 0, top: 0, width: SIZE, height: SIZE });
  node.setPointerCapture = () => {};
  node.addEventListener = (type, fn) => { (node.handlers[type] = node.handlers[type] || []).push(fn); };
  node.toDataURL = () => 'data:image/png;base64,';
  return node;
}
const canvas = element(), surface = element(), viewport = element(), messages = [], made = [];
const sandbox = {
  Image: class { set src(_v) { this.width = SIZE; this.height = SIZE; setTimeout(() => this.onload && this.onload(), 0); } },
  setTimeout, clearTimeout, console,
  document: { getElementById: id => ({ drawing: canvas, surface, viewport }[id]), createElement: () => { const node = element(); made.push(node); return node; } },
};
sandbox.window = { innerWidth: 390, innerHeight: 600, addEventListener: () => {}, ReactNativeWebView: { postMessage: m => messages.push(JSON.parse(m)) } };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'canvas-html.ts' });

const fire = (type, event) => (canvas.handlers[type] || []).forEach(fn => fn({ pointerType: 'touch', preventDefault() {}, ...event }));
const down = (id, x, y) => fire('pointerdown', { pointerId: id, clientX: x, clientY: y });
const move = (id, x, y) => fire('pointermove', { pointerId: id, clientX: x, clientY: y });
const up = (id, x = 0, y = 0) => fire('pointerup', { pointerId: id, clientX: x, clientY: y });
const command = m => sandbox.window.command(m);
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
// Smoothing means a single jump never reaches the target; a real finger sends a stream of moves.
const line = (x1, y1, x2, y2) => {
  down(1, x1, y1);
  for (let t = 1; t <= 24; t++) move(1, x1 + (x2 - x1) * t / 24, y1 + (y2 - y1) * t / 24);
  up(1, x2, y2);
};
const tap = ids => { ids.forEach((id, i) => down(id, 100 + i * 40, 300)); [...ids].reverse().forEach(id => up(id)); };
const at = (buffer, x, y) => { const k = (y * SIZE + x) * 4; return [buffer[k], buffer[k + 1], buffer[k + 2], buffer[k + 3]]; };
const drawing = id => sandbox.window.__layer(id);

(async () => {
  await command({ type: 'init' });
  await command({ type: 'color', color: '#000000' });
  await command({ type: 'width', tool: 'pen', width: 6 });

  // A closed box on 그림 1.
  line(100, 100, 240, 100); line(240, 100, 240, 240); line(240, 240, 100, 240); line(100, 240, 100, 100);
  const layer = () => drawing('draw-1');
  assert.equal(at(layer(), 170, 100)[3] > 200, true, 'the box outline is drawn');
  assert.equal(at(layer(), 170, 170)[3], 0, 'the inside of the box starts transparent');
  assert.equal(at(layer(), 30, 30)[3], 0, 'the outside starts transparent');

  // Tap inside with the fill tool.
  await command({ type: 'tool', tool: 'fill' });
  await command({ type: 'color', color: '#FF7A59' });
  const beforeFill = layer().slice();
  down(1, 170, 170); up(1, 170, 170);
  assert.deepEqual(at(layer(), 170, 170), [255, 122, 89, 255], 'the closed area takes the current colour');
  assert.deepEqual(at(layer(), 110, 230), [255, 122, 89, 255], 'the fill reaches the far corner inside');
  assert.equal(at(layer(), 30, 30)[3], 0, 'the fill never escapes the outline');
  assert.equal(at(layer(), 170, 100)[0] < 60, true, 'the outline itself is not repainted');
  let rim = 104; while (rim < 140 && at(layer(), 170, rim)[3] > 200 && at(layer(), 170, rim)[0] < 60) rim++;
  assert.ok(rim < 140, 'found the inner edge of the outline');
  assert.equal(at(layer(), 170, rim)[3], 255, 'no transparent hairline is left where the fill meets the line');

  // The fill sits on the undo stack like any other edit.
  tap([1, 2]);
  assert.deepEqual([...layer()], [...beforeFill], 'two-finger tap restores exactly the pre-fill drawing');
  tap([1, 2, 3]);
  assert.deepEqual(at(layer(), 170, 170), [255, 122, 89, 255], 'three-finger tap redoes the fill');

  // A fill lands on the active drawing only.
  // 45.10: 새 칸은 그림 한 장으로 열린다 — 둘째 장은 앱에서처럼 '레이어 추가'로 만든다.
  await command({ type: 'addLayer', id: 'draw-2', name: '그림 2' });
  await command({ type: 'select', id: 'draw-2' });
  const beforeOther = drawing('draw-1').slice();
  await command({ type: 'color', color: '#54A9E8' });
  down(1, 40, 40); up(1, 40, 40);
  assert.deepEqual(at(drawing('draw-2'), 40, 40), [84, 169, 232, 255], 'the empty layer fills');
  assert.deepEqual([...drawing('draw-1')], [...beforeOther], 'the other drawing is untouched');

  // References are preview layers: a fill must not reach them, and they stay out of the export.
  await command({ type: 'addReferences', references: [{ id: 'r1', name: '참고 1', path: 'r1.png', data: 'data:image/png;base64,x' }] });
  await tick();
  const referenceBefore = sandbox.window.__reference(0).slice();
  await command({ type: 'select', id: 'draw-1' });
  down(1, 300, 300); up(1, 300, 300);
  assert.deepEqual([...sandbox.window.__reference(0)], [...referenceBefore], 'the reference bitmap is never filled');

  // Tapping an area already in the current colour changes nothing and costs no undo step.
  const stable = drawing('draw-1').slice();
  down(1, 300, 300); up(1, 300, 300);
  assert.deepEqual([...drawing('draw-1')], [...stable], 'refilling the same colour is a no-op');

  // A second finger claims the gesture, so a two-finger undo never leaves a stray fill.
  const beforeGesture = drawing('draw-1').slice();
  down(1, 60, 300); down(2, 120, 300); up(2); up(1);
  assert.notDeepEqual([...drawing('draw-1')], [...beforeGesture], 'the two-finger tap still undid something');
  await command({ type: 'redo' });

  // ── Words are drawn into the exported picture, and stay editable ───────────────────────────
  await command({ type: 'select', id: 'draw-1' });
  const layerBeforeCaption = drawing('draw-1').slice();
  await command({ type: 'caption', caption: { text: '고마워요', place: 'bottom', color: '#E94F4F' } });
  const withWords = messages.filter(m => m.type === 'state').at(-1);
  // 45.6: 글씨체는 선택 항목이지만 캔버스는 늘 아는 값 하나로 정리해서 돌려준다(없던 저장본은 'basic').
  assert.deepEqual(withWords.caption, { text: '고마워요', place: 'bottom', color: '#E94F4F', style: 'basic', layout: 'line' }, 'the words are part of the scene');
  assert.equal(withWords.dirty, true, 'and count as unsaved work');
  assert.deepEqual([...drawing('draw-1')], [...layerBeforeCaption], 'but they are never burned into a drawing layer');

  made.length = 0;
  await command({ type: 'save' });
  const exported = made.at(-1).getContext().buffer;
  const saved = messages.filter(m => m.type === 'save').at(-1);
  assert.deepEqual(saved.caption, withWords.caption, 'the save payload carries the words');
  const anchor = SIZE - Math.round(SIZE * .06);
  assert.equal(at(exported, SIZE / 2, anchor)[3] > 0, true, 'and the exported picture has them painted in');
  assert.deepEqual(at(exported, SIZE / 2, anchor).slice(0, 3), [233, 79, 79], 'in the colour that was chosen');
  assert.ok(saved.metrics.coverage > 0, 'so a words-only cut is not read as empty');
  await command({ type: 'saved' });

  // Undo reaches the words like any other edit, and clearing them is just another caption.
  tap([1, 2]);
  assert.equal(messages.filter(m => m.type === 'state').at(-1).caption, null, 'two-finger tap takes the words back off');
  tap([1, 2, 3]);
  assert.equal(messages.filter(m => m.type === 'state').at(-1).caption.text, '고마워요', 'and puts them back');
  await command({ type: 'caption', caption: null });
  assert.equal(messages.filter(m => m.type === 'state').at(-1).caption, null, 'no words at all stays reachable');

  // A caption that cannot fit is scaled until it does. Nothing may be cut off the picture.
  const room = 360 - 32;
  for (const text of ['고마워요', '가'.repeat(42), '가'.repeat(200)]) {
    made.length = 0;
    await command({ type: 'caption', caption: { text, place: 'bottom', color: '#242424' } });
    await command({ type: 'save' });
    const drawn = made.at(-1).getContext().__caption;
    assert.equal(drawn.text, text, 'the words that were typed are the words that are drawn');
    assert.ok(drawn.width <= room, `"${text.slice(0, 6)}…" (${text.length}자) fits the reserved width: ${Math.round(drawn.width)} <= ${room}`);
    await command({ type: 'saved' });
  }
  await command({ type: 'caption', caption: null });

  // ── Copying another cut hands over its own bitmaps ─────────────────────────────────────────
  const beforeCopy = drawing('draw-1').slice();
  const bitmapBefore = sandbox.window.__layer('draw-1');
  await command({ type: 'copyWork', layers: [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, data: 'data:image/png;base64,copy' }], caption: { text: '복사', place: 'top', color: '#242424' } });
  await tick();
  assert.notEqual(sandbox.window.__layer('draw-1'), bitmapBefore, 'the copy is decoded into a fresh bitmap, not a shared one');
  const copiedState = messages.filter(m => m.type === 'state').at(-1);
  assert.equal(copiedState.caption.text, '복사', 'the words come with it');
  assert.equal(copiedState.dirty, true, 'and the cut counts as unsaved work');
  tap([1, 2]);
  assert.deepEqual([...drawing('draw-1')], [...beforeCopy], 'and a copy can be undone like any other edit');

  // ── The canvas opens on the colour and widths the tool bar is showing ──────────────────────
  await command({ type: 'init', color: '#65C47A', penWidth: 9, eraserWidth: 30 });
  await command({ type: 'tool', tool: 'pen' });
  await tick();
  line(60, 60, 200, 60);
  assert.deepEqual(at(drawing('draw-1'), 130, 60).slice(0, 3), [101, 196, 122], 'the first stroke of a cut uses the remembered colour, not the engine default');
  const thickness = () => { let n = 0; for (let y = 0; y < SIZE; y++) if (at(drawing('draw-1'), 130, y)[3] > 200) n++; return n; };
  assert.ok(Math.abs(thickness() - 9) <= 2, 'and the remembered pen width, got ' + thickness());

  // ── 45.9: 글씨체 도톰은 글자 자체를 굵게 그린다 · 연필은 겹쳐도 고르게 연하다 ──────────────────
  // (시험용 캔버스는 글자 모양을 실제로 칠하지 않는다. 그래서 '무엇을 어떻게 그렸는지'로 확인하고,
  //  실제 굵기 비교는 verification/round45_9 의 브라우저 렌더 증거가 맡는다.)
  const exportNow = async () => { made.length = 0; await command({ type: 'save' }); const img = made.at(-1); await command({ type: 'saved' }); return img; };
  await command({ type: 'caption', caption: { text: '안녕하세요', place: 'bottom', color: '#242424', style: 'basic' } });
  const plainShot = await exportNow();
  const plainStrokes = plainShot.getContext().__strokes || [];
  await command({ type: 'caption', caption: { text: '안녕하세요', place: 'bottom', color: '#242424', style: 'thick' } });
  const boldShot = await exportNow();
  const boldStrokes = boldShot.getContext().__strokes || [];
  const inked = list => list.filter(s2 => s2.text === '안녕하세요' && s2.style.startsWith('#24'));
  assert.equal(inked(plainStrokes).length, 0, '기본은 글자에 획을 덧대지 않는다');
  assert.equal(inked(boldStrokes).length, 1, '도톰은 글자 색으로 획을 한 번 덧대 굵게 만든다');
  assert.ok(inked(boldStrokes)[0].width > 0, '덧대는 획에는 두께가 있다: ' + inked(boldStrokes)[0].width);
  assert.equal(boldShot.getContext().__caption.text, '안녕하세요', '굵게 그려도 같은 글자를 같은 자리에 쓴다');

  // 45.12: 덧대는 획은 글자 크기의 5% 이하이고, 작은 글자에서는 더 얇다(획 사이가 붙지 않게).
  const px = stroke => Number(String(stroke.font).split('px')[0].split(' ').pop());
  const boldOf = shot => { const list = (shot.getContext().__strokes || []).filter(s2 => s2.style.startsWith('#24')); return list.length ? list[0].width / px(list[0]) : 0; };
  const bigRatio = boldOf(boldShot);
  assert.ok(bigRatio > 0 && bigRatio <= .0501, '큰 글자의 덧댐은 5% 이하: ' + bigRatio.toFixed(4));
  await command({ type: 'caption', caption: { text: '오늘 하루도 수고 많으셨어요 정말로', place: 'bottom', color: '#242424', style: 'thick' } });
  const smallBold = await exportNow();
  const smallRatio = boldOf(smallBold);
  assert.ok(smallRatio > 0, '작은 글자도 덧대기는 한다(기본과 구별되어야 한다)');
  assert.ok(smallRatio < bigRatio, '작은 글자는 덜 덧댄다: ' + smallRatio.toFixed(4) + ' < ' + bigRatio.toFixed(4));
  assert.ok(smallRatio >= bigRatio * .75, '그렇다고 기본과 같아질 만큼 줄이지는 않는다: ' + smallRatio.toFixed(4));
  await command({ type: 'caption', caption: null });

  // ── 45.11: 칸 맞춤은 흰 테두리까지 센다 ──────────────────────────────────────────────
  // 45.10 까지는 글자 획만 재서, 긴 문구가 16px 여백을 넘어 14px 자리까지 나왔다
  // (verification/round45_11 의 실제 렌더 측정). 이제 테두리를 더한 폭으로 크기를 고른다.
  await command({ type: 'caption', caption: { text: '오늘 하루도 수고 많으셨어', place: 'bottom', color: '#242424', style: 'serif' } });
  const longShot = await exportNow();
  const longCaption = longShot.getContext().__caption;
  const longEdge = (longShot.getContext().__strokes || []).filter(s2 => s2.style === '#FFFFFF').at(-1);
  assert.ok(longEdge, '문구에는 흰 테두리가 있다');
  assert.ok(longCaption.width + longEdge.width <= SIZE - 32,
    '글자와 테두리가 함께 칸 여백(16px) 안에 들어온다: ' + Math.round(longCaption.width + longEdge.width) + ' > ' + (SIZE - 32));
  await command({ type: 'caption', caption: null });

  // 연필의 '겹쳐도 고르게 연하다'는 이 시험용 캔버스로는 잴 수 없다(drawImage 합성을 흉내 내지 않는다).
  // 실제 렌더 증거는 verification/round45_9/ 에 있다: 18px 에서 펜 평균알파 245 vs 연필 135, 한 획 안 겹침도 138 로 고름.

  // ── 45.7: 장의 차례 바꾸기 — 겹치는 차례가 실제로 바뀌고, 양 끝에서는 움직이지 않는다 ──────
  const order = () => messages.filter(m => m.type === 'state').at(-1).layers.map(l => l.id);
  if (order().length < 2) await command({ type: 'addLayer', id: 'draw-' + (order().length + 1), name: '그림 ' + (order().length + 1) });
  const stack = order();
  assert.ok(stack.length >= 2, '차례를 바꾸려면 장이 둘 이상이어야 한다');
  const first = stack[0], swapped = [stack[1], stack[0], ...stack.slice(2)];
  await command({ type: 'moveLayer', id: first, by: 1 });
  assert.deepEqual(order(), swapped, '한 칸 앞으로 보내면 차례가 바뀐다');
  await command({ type: 'moveLayer', id: order().at(-1), by: 1 });
  assert.deepEqual(order(), swapped, '맨 앞에서는 더 가지 않는다');
  await command({ type: 'undo' });
  assert.deepEqual(order(), stack, '되돌리기로 차례가 되돌아온다');

  // ── 45.11: 새 장의 id 는 이미 쓰는 id 와 겹치지 않는다 ─────────────────────────────────
  // 예전에는 '장 수 + 1' 로 지어서, 가운데 장을 지우고 추가하면 같은 id 가 둘 생겼다.
  // 그러면 새 획이 옛 그림 위에 얹히고, 숨김·지우기·부분 움직임이 엉뚱한 장을 잡았다.
  await command({ type: 'init' });
  const scene = () => messages.filter(m => m.type === 'state').at(-1);
  const layerIds = () => scene().layers.map(l => l.id);
  const uniqueIds = where => assert.equal(new Set(layerIds()).size, layerIds().length, where + ': 장 id 가 겹치지 않는다 (' + layerIds().join(',') + ')');
  // 화면이 하는 그대로 id 를 지어 보낸다(painter.tsx addDrawing).
  const appAdd = async () => { let n = 1; while (layerIds().includes('draw-' + n)) n++; await command({ type: 'addLayer', id: 'draw-' + n, name: '그림 ' + n }); };
  const inkOf = id => { const b = drawing(id); let n = 0; for (let i = 3; i < b.length; i += 4) if (b[i] > 8) n++; return n; };
  const scribble = async (id, y) => { await command({ type: 'select', id }); await command({ type: 'tool', tool: 'pen' }); await command({ type: 'color', color: '#000000' }); line(60, y, 300, y); };

  await appAdd(); await appAdd();
  assert.deepEqual(layerIds(), ['draw-1', 'draw-2', 'draw-3'], '세 장을 차례로 만든다');
  await scribble('draw-1', 80); await scribble('draw-2', 160); await scribble('draw-3', 240);
  const keptInk = inkOf('draw-3');
  assert.ok(keptInk > 0, '마지막 장에 그림이 있다');
  await command({ type: 'motion', motion: { preset: 'none', parts: [{ id: 'part-a', layerId: 'draw-3', effect: 'sway', pivotX: .5, pivotY: .5, amount: 1, angle: 0, speed: .5, delay: 0 }] } });

  // ① 가운데 장을 지우고 추가 — 옛 id 로 돌아가지 않는다.
  await command({ type: 'removeLayer', id: 'draw-2' });
  assert.deepEqual(layerIds(), ['draw-1', 'draw-3'], '가운데 장만 지워진다');
  assert.deepEqual(scene().motion.parts.map(p => p.layerId), ['draw-3'], '남은 장의 부분 움직임은 그대로다');
  // 옛 방식(장 수 + 1)으로 보내 오는 경우까지 엔진이 막는지 여기서 본다.
  await command({ type: 'addLayer', id: 'draw-' + (layerIds().length + 1), name: '그림 ' + (layerIds().length + 1) });
  uniqueIds('가운데 지우고 추가');
  assert.equal(layerIds().filter(id => id === 'draw-3').length, 1, '옛 draw-3 이 둘이 되지 않는다');
  assert.equal(inkOf('draw-3'), keptInk, '먼저 그린 장의 그림이 그대로 남는다');
  const fresh = layerIds().find(id => id !== 'draw-1' && id !== 'draw-3');
  assert.equal(scene().activeLayerId, fresh, '새로 만든 빈 장이 선택된다');
  assert.equal(inkOf(fresh), 0, '새 장은 비어 있다');
  await scribble(fresh, 300);
  assert.equal(inkOf('draw-3'), keptInk, '새 획은 옛 그림에 얹히지 않는다');
  assert.deepEqual(scene().motion.parts.map(p => p.layerId), ['draw-3'], '부분 움직임이 가리키는 장이 바뀌지 않는다');

  // ② 마지막 장을 지우고 추가 · ③ 지우고 추가를 되풀이해도 겹치지 않는다.
  for (let round = 0; round < 3; round++) {
    await command({ type: 'removeLayer', id: layerIds().at(-1) });
    await appAdd();
    uniqueIds('지우고 추가 ' + (round + 1) + '회');
    assert.equal(inkOf('draw-3'), keptInk, '되풀이해도 옛 그림은 그대로다(' + (round + 1) + '회)');
  }

  // ④ 저장 → 다시 열기 → 추가. 옛 저장본의 id·차례·부분 움직임을 그대로 쓰고, 새 id 만 피해서 짓는다.
  await command({ type: 'save' });
  const reopenSave = messages.filter(m => m.type === 'save').at(-1);
  await command({ type: 'saved' }); // 앱이 저장을 마치면 보내는 응답 — 이게 없으면 엔진이 저장 중으로 멈춰 있다.
  assert.deepEqual(reopenSave.layers.map(l => l.id), layerIds(), '저장한 장 목록이 화면과 같다');
  await command({ type: 'init', layers: reopenSave.layers, activeLayerId: reopenSave.activeLayerId, motion: reopenSave.motion });
  await tick();
  assert.deepEqual(layerIds(), reopenSave.layers.map(l => l.id), '다시 열어도 id 와 차례가 그대로다');
  assert.deepEqual(scene().motion.parts.map(p => p.layerId), ['draw-3'], '다시 열어도 부분 움직임 대상이 그대로다');
  const reopened = layerIds().slice();
  await command({ type: 'removeLayer', id: reopened[0] });
  await appAdd();
  uniqueIds('저장본을 열고 지우고 추가');
  assert.deepEqual(scene().motion.parts.map(p => p.layerId), ['draw-3'], '다른 장을 지워도 움직임 대상은 남는다');

  // ⑤ 화면이 이미 쓰는 id 를 보내와도 엔진이 막는다(마지막 방어선).
  const before = layerIds().slice();
  if (before.length < 4) {
    await command({ type: 'addLayer', id: before[0], name: '겹치는 이름' });
    uniqueIds('겹치는 id 를 받아도');
    assert.equal(layerIds().length, before.length + 1, '장은 하나만 늘어난다');
  }
  // 복제·붙이기도 같은 규칙을 쓴다(장이 넷이면 더 만들지 않으므로 한 장을 비운 뒤 확인).
  while (layerIds().length > 2) await command({ type: 'removeLayer', id: layerIds().at(-1) });
  await command({ type: 'duplicateLayer', id: layerIds()[0] });
  uniqueIds('복제');

  // ── 45.12: 지운 장의 번호를 다시 써도 옛 부분 움직임이 새 장에 붙지 않는다 ────────────────
  await command({ type: 'init' });
  await command({ type: 'addLayer', id: 'draw-2', name: '그림 2' });
  await command({ type: 'select', id: 'draw-2' });
  line(60, 160, 300, 160);
  await command({ type: 'motion', motion: { preset: 'none', parts: [{ id: 'part-A', layerId: 'draw-2', effect: 'sway', pivotX: .5, pivotY: .5, amount: 1, angle: 0, speed: .5, delay: 0 }] } });
  assert.deepEqual((scene().motion.parts || []).map(p => p.layerId), ['draw-2'], '부분 움직임이 그 장을 가리킨다');
  await command({ type: 'removeLayer', id: 'draw-2' });
  assert.equal((scene().motion && scene().motion.parts) || null, null, '장을 지우면 그 장의 부분 움직임도 함께 지워진다');
  await command({ type: 'addLayer' });
  assert.deepEqual(scene().layers.map(l => l.id), ['draw-1', 'draw-2'], '빈 번호를 다시 쓴다');
  assert.equal((scene().motion && scene().motion.parts) || null, null, '같은 번호의 새 장에 옛 움직임이 붙지 않는다');
  assert.equal(scene().layers[1].id === 'draw-2' && inkOf('draw-2'), 0, '새 장은 비어 있다');
  await command({ type: 'undo' });
  await command({ type: 'undo' });
  assert.deepEqual((scene().motion.parts || []).map(p => p.layerId), ['draw-2'], '되돌리면 장과 그 장의 움직임이 함께 돌아온다');
  assert.ok(inkOf('draw-2') > 0, '되살아난 장에는 그림이 그대로 있다');
  await command({ type: 'redo' });
  assert.equal((scene().motion && scene().motion.parts) || null, null, '다시 실행하면 삭제가 그대로 다시 적용된다');

  // ── 45.12: 저장 응답이 사라져도 다시 저장할 수 있고, 늦게 온 옛 응답은 무시한다 ──────────
  // 예전에는 저장 중에 들어온 명령을 모두 버려서, 응답이 한 번 사라지면 화면이 20초(앱 쪽 시간초과)
  // 동안 굳었다. 그동안 그은 획은 캔버스에 닿지도 않았다(verification/round45_12/save-lock-repro).
  await command({ type: 'init' });
  await command({ type: 'tool', tool: 'pen' });
  line(60, 120, 300, 120);
  assert.equal(scene().dirty, true, '그린 뒤에는 저장할 것이 있다');
  const saveCount = () => messages.filter(m => m.type === 'save').length;
  await command({ type: 'save', token: 11 });
  assert.equal(messages.filter(m => m.type === 'save').at(-1).token, 11, '저장 응답에 요청 번호가 함께 온다');
  const afterFirst = saveCount();
  await command({ type: 'save', token: 12 });
  assert.equal(saveCount(), afterFirst + 1, '응답이 오지 않아도 다시 저장하면 새 그림을 준다(재시도가 된다)');
  assert.equal(messages.filter(m => m.type === 'save').at(-1).token, 12, '새 응답은 새 번호를 단다');
  await command({ type: 'saved', token: 11 });
  assert.equal(scene().dirty, true, '늦게 온 옛 응답은 지금 저장을 끝내지 못한다');
  await command({ type: 'saveFailed', token: 11 });
  assert.equal(scene().dirty, true, '늦게 온 옛 실패 응답도 지금 저장을 건드리지 않는다');
  await command({ type: 'saved', token: 12 });
  assert.equal(scene().dirty, false, '지금 응답이 와야 저장이 끝난다');
  // 실패 응답은 저장하지 않은 그림을 그대로 둔다.
  line(60, 200, 300, 200);
  await command({ type: 'save', token: 13 });
  await command({ type: 'saveFailed', token: 13 });
  assert.equal(scene().dirty, true, '저장에 실패하면 저장할 것이 남아 있다고 말한다');
  const beforeRetry = [...drawing('draw-1')];
  line(60, 260, 300, 260);
  assert.notDeepEqual([...drawing('draw-1')], beforeRetry, '실패 뒤에도 계속 그릴 수 있다');

  console.log('PASS: 새 장 id 가 겹치지 않는다(가운데·마지막·되풀이·저장 후·복제) · 장의 차례 바꾸기(앞으로·양 끝 멈춤·되돌리기) · flood fill stays inside closed line art, respects undo/redo, touches only the active drawing, never reaches references, and yields to multi-touch gestures; captions are painted into the export but never into a layer, survive undo, and travel with a copied cut. Canvas rasteriser is a test double; device test still required.');
})().catch(e => { console.error(e); process.exitCode = 1; });
