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
  for (const name of ['save', 'restore', 'translate', 'rotate', 'scale', 'beginPath', 'arc', 'fill', 'moveTo', 'stroke', 'strokeRect', 'strokeText', 'fillText', 'setLineDash']) g[name] = () => {};
  // 글자 폭: 글꼴 px × 0.6 × 글자 수. 문구의 자리·상자 계산에 쓰인다.
  g.measureText = text => ({ width: String(text).length * (Number((/(\d+)px/.exec(g.font || '') || [])[1]) || 10) * .6 });
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

  // ── 문구: 캔버스 위 물건처럼 직접 고르고·옮기고·키운다 ────────────────────────────────────
  // 360×360 캔버스에서 '안녕'(40px) 상자는 x 156~204, y 288~338, 한가운데 (180, 313).
  await command({ type: 'init' });
  await command({ type: 'caption', caption: { text: '안녕', place: 'bottom', color: '#242424' } });
  const cap = () => state().caption;
  const edits = () => messages.filter(m => m.type === 'captionEdit').length;
  const pastBefore = stacks().past;
  down(1, 180, 313); up(1);
  assert.equal(state().captionPicked, true, '글씨를 누르면 메뉴를 거치지 않고 바로 골라진다');
  assert.equal(stacks().past, pastBefore, '누르기만 해서는 되돌리기 기록이 생기지 않는다(그림도 그려지지 않는다)');
  assert.equal(edits(), 0, '처음 누름은 고르기일 뿐 편집을 열지 않는다');
  down(1, 180, 313); up(1);
  assert.equal(edits(), 1, '고른 글씨를 한 번 더 누르면 내용 고치기를 요청한다');
  down(1, 180, 313); move(1, 181, 314); up(1);
  assert.equal(cap().dx ?? 0, 0, '손가락 떨림(6px 미만)은 옮기기가 아니다');
  assert.equal(edits(), 2, '떨린 누름은 누름으로 본다 — 고른 글씨를 누른 것이라 내용 고치기');
  assert.equal(stacks().past, pastBefore, '떨림은 되돌리기 기록을 남기지 않는다');
  down(1, 180, 313); move(1, 230, 280); up(1);
  assert.deepEqual([cap().dx, cap().dy], [50, -33], '글씨 자체를 끌어 원하는 자리로 옮긴다');
  assert.equal(stacks().past, pastBefore + 1, '옮기기는 되돌리기 한 번');
  assert.equal(edits(), 2, '끌어 옮긴 누름은 편집을 열지 않는다');
  // 손잡이(오른쪽 아래)를 끌면 크기. 화면 기준 26px 안이면 잡힌다.
  down(1, 262, 311); move(1, 292, 341); up(1);
  assert.ok(cap().scale > 1.8 && cap().scale < 2.2, '손잡이를 바깥으로 끌면 커진다: ' + cap().scale);
  assert.deepEqual([cap().dx, cap().dy], [50, -33], '크기를 바꿔도 자리는 그대로');
  // 두 손가락: 벌리면 크기(상한 3), 비틀면 회전.
  const sizedTo = cap().scale;
  down(1, 200, 280); down(2, 260, 280); move(1, 170, 280); move(2, 290, 280); up(1); up(2);
  assert.equal(cap().scale, Math.min(3, sizedTo * 2), '고른 글씨 위의 두 손가락 벌리기는 글씨 크기');
  assert.equal(cap().rot ?? 0, 0, '비틀지 않으면 돌지 않는다');
  down(1, 200, 280); down(2, 260, 280); move(2, 250, 330); up(1); up(2);
  assert.ok(Math.abs(cap().rot - 45) < 1, '두 손가락으로 비틀면 돈다: ' + cap().rot);
  // 경계: 끝까지 끌어도 글씨 한가운데는 캔버스 안에 남는다(가운데로 끌어오지는 않는다).
  const { dx: beforeFar } = cap();
  down(1, 230, 280); move(1, 2000, 280); up(1);
  assert.ok(180 + cap().dx <= 360 && 180 + cap().dx >= 300, '오른쪽 끝에서 멈추되 가장자리까지는 간다: ' + (180 + cap().dx) + ' (전 ' + beforeFar + ')');
  // 글씨 밖을 누르면 선택이 끝나고, 그 손가락은 그림을 그리지 않는다.
  // 손잡이는 늘 캔버스 안에서 잡을 수 있다: 글씨를 오른쪽 가장자리로 보내고 키워도 안쪽 모서리에 그려진다.
  const handleMarks = shown().split(' ').filter(Boolean).map(p => p.split(',').map(Number));
  assert.ok(handleMarks.length > 0 && handleMarks.every(([x, y]) => x >= 0 && x <= 360 && y >= 0 && y <= 360), '가장자리에 둔 큰 글씨의 손잡이도 캔버스 안에 있다: ' + shown());
  const pastOutside = stacks().past;
  down(1, 40, 40); move(1, 90, 90); up(1);
  assert.equal(state().captionPicked, false, '다른 곳을 누르면 자연스럽게 선택이 끝난다');
  assert.ok(!shown().split(' ').includes('90,90'), '선택을 끝낸 손가락은 선을 긋지 않는다');
  assert.equal(stacks().past, pastOutside, '되돌리기 기록도 없다');
  stroke(40, 40);
  assert.equal(stacks().past, pastOutside + 1, '선택이 끝난 뒤에는 평소처럼 그린다');
  // 저장되는 문구(파일·출력의 원천)는 화면에서 조절한 그 값이다.
  const onCanvas = cap();
  await command({ type: 'save' });
  assert.deepEqual(messages.filter(m => m.type === 'save').at(-1).caption, onCanvas, '저장 값 = 캔버스에서 옮기고 키우고 돌린 값');
  await command({ type: 'saved' });

  console.log('PASS: one-finger stroke, two-finger tap undo, three-finger tap redo across staggered lifts, drag is not a tap, three consecutive undo+redo steps restore every state in order, new stroke clears redo, reference move/pinch, caption: tap selects (no stroke, no undo step), tap again asks to edit, jitter is not a move, drag moves the words, handle drag scales, two-finger pinch scales (cap 3) and twist rotates, soft bounds keep the centre on the canvas, tapping elsewhere ends the selection without drawing, saved caption equals the on-canvas one. DOM shimmed; Android touch delivery still requires device test.');
})().catch(e => { console.error(e); process.exitCode = 1; });
