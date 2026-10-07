// Multi-touch gesture classification and undo/redo history for the Painter canvas engine.
// Runs the shipped canvas script in a minimal DOM shim; pixel fidelity is covered by test:painter.
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loader } = require('./load-ts.cjs');
const { canvasHtml } = loader()('src/painter/canvas-html.ts');
// Test-only probe into the closure; the shipped script is otherwise untouched.
const source = canvasHtml.split('<script>')[1].split('</script>')[0].replace(
  "window.addEventListener('resize',size);",
  "window.__stacks=()=>({past:history.length,future:future.length});window.addEventListener('resize',size);");

// Each context records the stroke marks drawn into it, so undo/redo restore a verifiable canvas identity.
function context2d() {
  const g = { globalAlpha: 1, globalCompositeOperation: 'source-over', lineWidth: 1, strokeStyle: '#000', fillStyle: '#000', lineCap: 'round', lineJoin: 'round', marks: [] };
  for (const name of ['save', 'restore', 'translate', 'rotate', 'scale', 'beginPath', 'arc', 'fill', 'moveTo', 'stroke']) g[name] = () => {};
  g.clearRect = () => { g.marks = []; };
  g.lineTo = (x, y) => g.marks.push(Math.round(x) + ',' + Math.round(y));
  g.drawImage = from => { if (from && from.getContext) g.marks.push(...from.getContext().marks); };
  g.getImageData = () => ({ data: new Uint8ClampedArray(4), marks: g.marks.slice() });
  g.putImageData = image => { g.marks = (image.marks || []).slice(); };
  return g;
}
function element() {
  const node = { width: 360, height: 360, style: {}, scrollLeft: 0, scrollTop: 0, handlers: {} };
  let ctx = null;
  node.getContext = () => (ctx = ctx || context2d());
  node.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 360 });
  node.setPointerCapture = () => {};
  node.addEventListener = (type, fn) => { (node.handlers[type] = node.handlers[type] || []).push(fn); };
  node.toDataURL = () => 'data:image/png;base64,';
  return node;
}
const canvas = element(), surface = element(), viewport = element();
const messages = [];
const sandbox = {
  Image: class { set src(_value) { this.width = 360; this.height = 360; setTimeout(() => this.onload && this.onload(), 0); } },
  setTimeout, clearTimeout, console,
  document: { getElementById: id => ({ drawing: canvas, surface, viewport }[id]), createElement: () => element() },
};
sandbox.window = { innerWidth: 390, innerHeight: 600, addEventListener: () => {}, ReactNativeWebView: { postMessage: m => messages.push(JSON.parse(m)) } };
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'canvas-html.ts' });

const fire = (type, event) => (canvas.handlers[type] || []).forEach(fn => fn({ pointerType: 'touch', preventDefault() {}, ...event }));
const down = (id, x, y) => fire('pointerdown', { pointerId: id, clientX: x, clientY: y });
const move = (id, x, y) => fire('pointermove', { pointerId: id, clientX: x, clientY: y });
const up = id => fire('pointerup', { pointerId: id, clientX: 0, clientY: 0 });
const state = () => messages.filter(m => m.type === 'state').at(-1);
const reference = () => state().references[0];
const command = m => sandbox.window.command(m);
const stacks = () => ({ ...sandbox.window.__stacks() });
const shown = () => canvas.getContext().marks.join(' ');
const stroke = (x, y) => { down(1, x, y); move(1, x + 30, y + 30); up(1); };
// A real finger jitters before the other fingers land; that must not count as a committed stroke.
const tap = ids => { ids.forEach((id, i) => { down(id, 100 + i * 40, 100); if (i === 0) move(id, 101, 100); }); [...ids].reverse().forEach(up); };
const tick = () => new Promise(resolve => setTimeout(resolve, 5));

(async () => {
  await command({ type: 'init' });
  assert.equal(state().undo, false, 'fresh canvas has nothing to undo');

  // One finger draws.
  down(1, 100, 100); move(1, 150, 160); up(1);
  assert.equal(state().undo, true, 'single finger stroke is undoable');
  assert.equal(state().redo, false);

  // Two-finger tap = undo. (device PASS - must not regress)
  down(1, 100, 100); down(2, 140, 100); up(1); up(2);
  assert.equal(state().undo, false, 'two-finger tap undoes the stroke');
  assert.equal(state().redo, true, 'undo fills the redo stack');

  // Three-finger tap = redo, even when the first finger leaves before the others.
  down(1, 100, 100); down(2, 140, 100); down(3, 180, 100);
  move(1, 101, 101); move(2, 141, 101); move(3, 181, 101);
  up(1);
  move(2, 142, 102); move(3, 182, 102);
  up(2); up(3);
  assert.equal(state().redo, false, 'three-finger tap redoes even if the first finger lifts first');
  assert.equal(state().undo, true, 'redo refills the undo stack');

  // A real two-finger drag must never be classified as a tap.
  const beforeDrag = state();
  down(1, 100, 100); down(2, 140, 100); move(1, 100, 200); move(2, 140, 200); up(1); up(2);
  assert.equal(state().undo, beforeDrag.undo, 'two-finger drag is not an undo');
  assert.equal(state().redo, beforeDrag.redo, 'two-finger drag is not a redo');

  // Repeated undo/redo must walk the whole history, not only the first step. (device FAIL round 6)
  await command({ type: 'init' });
  const empty = shown();
  stroke(10, 10); const afterA = shown();
  stroke(20, 20); const afterB = shown();
  stroke(30, 30); const afterC = shown();
  assert.equal(new Set([empty, afterA, afterB, afterC]).size, 4, 'each stroke leaves a distinct canvas');
  assert.deepEqual(stacks(), { past: 3, future: 0 }, 'three strokes stack three undo steps');

  const undone = [];
  for (let i = 0; i < 3; i++) { tap([1, 2]); undone.push({ shown: shown(), ...stacks() }); }
  assert.deepEqual(undone, [
    { shown: afterB, past: 2, future: 1 },
    { shown: afterA, past: 1, future: 2 },
    { shown: empty, past: 0, future: 3 },
  ], 'three two-finger taps undo three strokes and keep every redo step');

  const redone = [];
  for (let i = 0; i < 3; i++) { tap([1, 2, 3]); redone.push({ shown: shown(), ...stacks() }); }
  assert.deepEqual(redone, [
    { shown: afterA, past: 1, future: 2 },
    { shown: afterB, past: 2, future: 1 },
    { shown: afterC, past: 3, future: 0 },
  ], 'three three-finger taps redo all three strokes in order');

  // A committed stroke still drops the redo branch.
  tap([1, 2]);
  assert.equal(stacks().future, 1, 'undo after redo refills the redo stack');
  stroke(40, 40);
  assert.equal(stacks().future, 0, 'a new stroke clears the redo branch');

  // Active reference moves and scales under two fingers. (device PASS - must not regress)
  await command({ type: 'addReferences', references: [{ id: 'r1', name: '참고 1', path: 'r1.png', data: 'data:image/png;base64,x' }] });
  await tick();
  assert.equal(state().activeReferenceId, 'r1', 'added reference becomes the active one');
  const start = reference();
  down(1, 100, 100); down(2, 140, 100); move(1, 160, 160); move(2, 200, 160); up(1); up(2);
  const moved = reference();
  assert.equal(moved.x, start.x + 60, 'two-finger drag moves the reference itself');
  assert.equal(moved.y, start.y + 60);
  assert.equal(moved.scale, start.scale, 'a pure drag does not rescale the reference');
  down(1, 100, 100); down(2, 140, 100); move(1, 60, 100); move(2, 180, 100); up(1); up(2);
  assert.ok(reference().scale > moved.scale, 'two-finger pinch scales the reference itself');

  console.log('PASS: one-finger stroke, two-finger tap undo, three-finger tap redo across staggered lifts, drag is not a tap, three consecutive undo+redo steps restore every state in order, new stroke clears redo, reference move/pinch. DOM shimmed; Android touch delivery still requires device test.');
})().catch(e => { console.error(e); process.exitCode = 1; });
