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
  g.strokeText = () => {};
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
  assert.deepEqual(withWords.caption, { text: '고마워요', place: 'bottom', color: '#E94F4F', style: 'basic' }, 'the words are part of the scene');
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

  console.log('PASS: flood fill stays inside closed line art, respects undo/redo, touches only the active drawing, never reaches references, and yields to multi-touch gestures; captions are painted into the export but never into a layer, survive undo, and travel with a copied cut. Canvas rasteriser is a test double; device test still required.');
})().catch(e => { console.error(e); process.exitCode = 1; });
