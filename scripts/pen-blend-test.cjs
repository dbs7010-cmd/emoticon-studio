// S펜·애플펜슬·필압 조절·레이어 섞기(2026-11-03) — 실제 Chrome 에서 앱과 같은 엔진(canvas-html)으로 확인한다.
// 1) 레이어 섞기: 위 장을 '곱하기'로 두면 겹친 자리가 어두워지고, 저장(state)·되돌리기에 남는다.
// 2) 손바닥: 펜을 쓴 뒤 손가락 한 개는 선을 긋지 않고, 펜으로 긋는 중에 닿은 손바닥이 펜 선을 지우지 않는다.
// 3) 필압: 세기 0 이면 힘과 상관없이 같은 굵기, 곡선을 올리면 같은 힘에서 가늘어진다.
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core node scripts/pen-blend-test.cjs
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent(canvasHtml.replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>'));
    const cmd = m => page.evaluate(m => window.command(m), m);
    const last = type => page.evaluate(t => window.messages.filter(m => m.type === t).at(-1), type);
    // 문서 비율 좌표로 획을 보낸다. id·종류·필압을 고를 수 있다.
    const stroke = (pts, { id = 1, type = 'touch', pressure = .5, up = true } = {}) => page.evaluate(async ({ pts, id, type, pressure, up }) => {
      const c = document.getElementById('drawing'), r = c.getBoundingClientRect();
      const ev = (t, p) => c.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: type, isPrimary: true, pressure, bubbles: true, cancelable: true, clientX: r.left + p[0] * r.width, clientY: r.top + p[1] * r.height }));
      ev('pointerdown', pts[0]);
      for (const p of pts.slice(1)) { ev('pointermove', p); await new Promise(res => setTimeout(res, 8)); }
      if (up) ev('pointerup', pts[pts.length - 1]);
    }, { pts, id, type, pressure, up });
    const lift = (p, id, type = 'pen') => page.evaluate(({ p, id, type }) => { const c = document.getElementById('drawing'), r = c.getBoundingClientRect(); c.dispatchEvent(new PointerEvent('pointerup', { pointerId: id, pointerType: type, bubbles: true, clientX: r.left + p[0] * r.width, clientY: r.top + p[1] * r.height })); }, { p, id, type });
    const line = (x1, y1, x2, y2, n = 30) => Array.from({ length: n + 1 }, (_, i) => [x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n]);
    // 화면 캔버스(합성 결과)의 한 점.
    const pixel = (x, y) => page.evaluate(({ x, y }) => { const c = document.getElementById('drawing'); return [...c.getContext('2d').getImageData(Math.round(x * c.width), Math.round(y * c.height), 1, 1).data]; }, { x, y });
    // 세로 선을 가로로 훑어 칠해진 칸 수(굵기).
    const thickness = x => page.evaluate(x => { const c = document.getElementById('drawing'), g = c.getContext('2d'), w = Math.round(.05 * c.width), px = Math.round(x * c.width); const d = g.getImageData(px - w, Math.round(.3 * c.height), w * 2, 1).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++; return n; }, x);

    await cmd({ type: 'init', layers: [{ id: 'draw-1', name: '그림 1' }, { id: 'draw-2', name: '그림 2' }], activeLayerId: 'draw-1', penWidth: 16, color: '#E02020', brush: { preset: null, opacity: 1, stabilizer: 'light', smoothing: true } });
    await page.waitForTimeout(200);
    await cmd({ type: 'tool', tool: 'pen' });

    // 1) 섞기
    await stroke(line(.2, .3, .8, .3));
    await cmd({ type: 'select', id: 'draw-2' });
    await cmd({ type: 'color', color: '#2040E0' });
    await stroke(line(.5, .15, .5, .45));
    const normal = await pixel(.5, .3);
    assert.ok(normal[2] > 180 && normal[0] < 80, '보통: 겹친 자리는 위 장(파랑)이 덮는다 ' + normal);
    await cmd({ type: 'transform', id: 'draw-2', blend: 'multiply' });
    const mult = await pixel(.5, .3);
    assert.ok(mult[0] < 80 && mult[2] < 80 && mult[3] > 200, '곱하기: 빨강 × 파랑 = 어둡다 ' + mult);
    const alone = await pixel(.5, .2);
    assert.ok(alone[2] > 180, '곱하기여도 아래가 빈 자리는 제 색 ' + alone);
    const st = await last('state');
    assert.equal(st.layers.find(l => l.id === 'draw-2').blend, 'multiply', '섞기가 레이어 정보에 남는다');
    assert.equal(st.layers.find(l => l.id === 'draw-1').blend, undefined, '보통은 저장하지 않는다');
    await cmd({ type: 'undo' });
    assert.ok((await pixel(.5, .3))[2] > 180, '되돌리면 보통으로 돌아온다');
    await cmd({ type: 'redo' });
    assert.ok((await pixel(.5, .3))[2] < 80, '다시 하면 곱하기');
    await cmd({ type: 'transform', id: 'draw-2', blend: 'normal' });
    assert.equal((await last('state')).layers.find(l => l.id === 'draw-2').blend, undefined, '보통으로 되돌리면 정보에서 빠진다');

    // 2) 손바닥
    await cmd({ type: 'clear' }).catch(() => {});
    await cmd({ type: 'select', id: 'draw-1' });
    await stroke(line(.1, .6, .9, .6), { type: 'pen', id: 7 });
    assert.ok((await pixel(.5, .6))[3] > 200, '펜 선이 그려진다');
    await stroke(line(.1, .75, .9, .75), { type: 'touch', id: 2 });
    assert.ok((await pixel(.5, .75))[3] < 10, '펜을 쓴 뒤 손가락 한 개는 선을 긋지 않는다');
    // 펜으로 긋는 중에 손바닥 두 군데가 닿아도 펜 선은 남는다.
    await stroke(line(.1, .85, .5, .85), { type: 'pen', id: 8, up: false });
    await stroke([[.9, .95], [.92, .95]], { type: 'touch', id: 3, up: false });
    await stroke([[.8, .95], [.82, .95]], { type: 'touch', id: 4, up: false });
    await lift([.5, .85], 8);
    await lift([.92, .95], 3, 'touch'); await lift([.82, .95], 4, 'touch');
    assert.ok((await pixel(.3, .85))[3] > 200, '손바닥이 닿아도 펜 선이 지워지지 않는다');

    // 3) 필압
    await cmd({ type: 'tool', tool: 'pen' });
    const at = async (settings, pressure, x) => { await cmd({ type: 'brushSettings', preset: null, opacity: 1, stabilizer: 'light', smoothing: true, ...settings }); await stroke(line(x, .05, x, .5, 20), { type: 'pen', id: 20, pressure }); return thickness(x); };
    await cmd({ type: 'select', id: 'draw-2' });
    await cmd({ type: 'removeLayer', id: 'draw-1' }).catch(() => {});
    const full = await at({ pressure: 100, pressureCurve: 0 }, .1, .1), fullHard = await at({ pressure: 100, pressureCurve: 0 }, .9, .2);
    const flatSoft = await at({ pressure: 0 }, .1, .3), flatHard = await at({ pressure: 0 }, .9, .4);
    const curvedUp = await at({ pressure: 100, pressureCurve: 50 }, .5, .5), curvedFlat = await at({ pressure: 100, pressureCurve: 0 }, .5, .6);
    console.log('굵기(px)', { full, fullHard, flatSoft, flatHard, curvedUp, curvedFlat });
    assert.ok(fullHard > full * 1.5, '필압 100: 세게 누르면 확실히 굵다');
    assert.ok(Math.abs(flatSoft - flatHard) <= 2, '필압 0: 힘과 상관없이 같은 굵기');
    assert.ok(curvedUp < curvedFlat, '곡선을 올리면 같은 힘에서 가늘다');

    // 4) 움직이기·애니메이션 탭은 보기 전용: 한 손가락은 선을 긋지 않는다(2026-11-04 잔렉).
    // 펜을 쓴 지 1분 안이라 손가락은 어차피 막히므로, 여기서는 펜으로 확인한다.
    await cmd({ type: 'color', color: '#20A040' });
    await cmd({ type: 'viewOnly', on: true });
    await stroke(line(.1, .97, .9, .97), { type: 'pen', id: 30 });
    assert.ok((await pixel(.5, .97))[3] < 10, '보기 전용에서는 펜도 선을 긋지 않는다');
    await cmd({ type: 'viewOnly', on: false });
    await stroke(line(.1, .97, .9, .97), { type: 'pen', id: 31 });
    assert.ok((await pixel(.5, .97))[3] > 200, '보기 전용을 끄면 다시 그린다');

    // 5) 레이어 크기 줄이 열려 있으면 한 손가락은 그 레이어 옮기기, 두 손가락은 크기(2026-11-04).
    const layerOf = async id => (await last('state')).layers.find(l => l.id === id);
    await cmd({ type: 'adjustLayer', id: 'draw-2' });
    await stroke(line(.5, .5, .6, .5, 10), { type: 'pen', id: 32 });
    const moved = await layerOf('draw-2');
    assert.ok(moved.x > 25 && Math.abs(moved.y) < 3, '한 손가락(펜)으로 끌면 레이어가 그만큼 옮겨진다: ' + moved.x);
    // 두 손가락 벌리기 → 크기가 커진다.
    await page.evaluate(async () => {
      const c = document.getElementById('drawing'), r = c.getBoundingClientRect();
      const ev = (t, id, x, y) => c.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', bubbles: true, cancelable: true, clientX: r.left + x * r.width, clientY: r.top + y * r.height }));
      ev('pointerdown', 41, .4, .5); ev('pointerdown', 42, .6, .5);
      for (let i = 1; i <= 10; i++) { ev('pointermove', 41, .4 - i * .01, .5); ev('pointermove', 42, .6 + i * .01, .5); await new Promise(res => setTimeout(res, 8)); }
      ev('pointerup', 41, .3, .5); ev('pointerup', 42, .7, .5);
    });
    const scaled = await layerOf('draw-2');
    assert.ok(scaled.scale > 1.6, '두 손가락으로 벌리면 레이어가 커진다: ' + scaled.scale);
    // 두 손가락 비틀기 → 회전(8° 안쪽 흔들림은 무시).
    await page.evaluate(async () => {
      const c = document.getElementById('drawing'), r = c.getBoundingClientRect();
      const ev = (t, id, x, y) => c.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', bubbles: true, cancelable: true, clientX: r.left + x * r.width, clientY: r.top + y * r.height }));
      ev('pointerdown', 43, .4, .5); ev('pointerdown', 44, .6, .5);
      for (let i = 1; i <= 10; i++) { const a = i * Math.PI / 60; ev('pointermove', 43, .5 - .1 * Math.cos(a), .5 - .1 * Math.sin(a)); ev('pointermove', 44, .5 + .1 * Math.cos(a), .5 + .1 * Math.sin(a)); await new Promise(res => setTimeout(res, 8)); }
      ev('pointerup', 43, .4, .5); ev('pointerup', 44, .6, .5);
    });
    const turned = await layerOf('draw-2');
    assert.ok(turned.rotation > 20 && turned.rotation < 40, '두 손가락으로 비틀면 레이어가 돈다: ' + turned.rotation);
    await cmd({ type: 'undo' });
    await cmd({ type: 'undo' });
    assert.ok((await layerOf('draw-2')).scale < 1.05, '되돌리면 크기도 돌아온다');
    await cmd({ type: 'adjustLayer', id: null });

    assert.deepEqual(errors, [], '페이지 오류 없음');
    console.log('pen-blend-test PASS');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
