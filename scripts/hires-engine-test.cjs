// 고해상도 그리기 엔진(2026-10-28) — 실제 Chrome 에서 앱과 같은 엔진(canvas-html)을 res:3 으로 띄워 확인한다.
// 문서 좌표는 360 그대로, 장 픽셀만 1080. 저장 완성본·카카오 프레임은 360, 장 PNG 는 1080, 옛 360 장도 그대로 열린다.
// 되돌리기는 GPU 사본을 쓰고 바뀌지 않은 장은 사본을 같이 쓴다(메모리). 채우기·선택 옮기기·스포이드도 고해상도에서 맞다.
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/hires-engine-test.cjs
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
    const size = url => page.evaluate(async u => { const i = new Image(); i.src = u; await i.decode(); return [i.width, i.height]; }, url);
    // 화면 좌표(캔버스 왼쪽 위 기준 비율)로 손가락 획을 보낸다. 실제 시간 간격을 둔다(보정이 시간 기준).
    const stroke = (pts, gap = 8) => page.evaluate(async ({ pts, gap }) => {
      const c = document.getElementById('drawing'), r = c.getBoundingClientRect();
      const ev = (t, p) => c.dispatchEvent(new PointerEvent(t, { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: r.left + p[0] * r.width, clientY: r.top + p[1] * r.height }));
      ev('pointerdown', pts[0]);
      for (const p of pts.slice(1)) { ev('pointermove', p); await new Promise(res => setTimeout(res, gap)); }
      ev('pointerup', pts[pts.length - 1]);
    }, { pts, gap });
    const line = (x1, y1, x2, y2, n = 30) => Array.from({ length: n + 1 }, (_, i) => [x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n]);
    // 장 픽셀을 그대로 읽는다(문서 좌표 x,y → 고해상도 픽셀).
    const alphaAt = (x, y, layer = 0) => page.evaluate(({ x, y, layer }) => window.__hires.alpha(layer, x, y), { x, y, layer });

    // 측정용 창: 장 픽셀·화면 캔버스 크기·되돌리기 사본 수를 읽는다(엔진에 이미 있는 __bench 와 같은 성격).
    await page.evaluate(() => { window.__hires = null; });
    await cmd({ type: 'init', res: 3, layers: [{ id: 'draw-1', name: '그림 1' }, { id: 'draw-2', name: '그림 2' }], activeLayerId: 'draw-1', penWidth: 6, color: '#202020', brush: { preset: null, opacity: 1, stabilizer: 'light', smoothing: false } });
    await page.waitForTimeout(200);
    const probe = await page.evaluate(() => window.__bench && window.__bench.hires && window.__bench.hires());
    assert.ok(probe, '엔진이 고해상도 측정 창을 연다');
    assert.deepEqual([probe.canvas, probe.layer, probe.res], [[1080, 1080], [1080, 1080], 3], '화면 캔버스와 장이 1080, RES 3');
    await page.evaluate(() => { window.__hires = { alpha: (i, x, y) => window.__bench.hires().alphaAt(i, x, y) }; });

    // 1) 선: 문서 좌표 그대로 그려지고, 3배 촘촘하다(선 가장자리에 중간 알파가 1px 단위로 있다).
    await cmd({ type: 'tool', tool: 'pen' });
    await stroke(line(.2, .5, .8, .5));
    assert.ok(await alphaAt(180, 180) > 200, '선 가운데가 칠해진다(문서 180,180)');
    assert.equal(await alphaAt(180, 140), 0, '선에서 먼 곳은 비어 있다');
    const edge = await page.evaluate(() => window.__bench.hires().edgeProfile(0, 180, 180));
    assert.ok(edge.solid >= 12 && edge.solid <= 24, '굵기 6(문서) = 고해상도 약 18픽셀 (' + edge.solid + ')');

    // 2) 저장: 완성본 360, 장 PNG 1080.
    await cmd({ type: 'save', token: 1 });
    const saved = await last('save');
    assert.deepEqual(await size(saved.data), [360, 360], '저장 완성본은 카카오 규격 360');
    assert.deepEqual(await size(saved.layers[0].data), [1080, 1080], '장 PNG 는 1080');
    assert.ok(saved.metrics.coverage > 0, '완성본 판정(덮인 비율)도 360 기준으로 잰다');
    await cmd({ type: 'saved', token: 1 });

    // 3) 되돌리기: 세 획 → 세 번 되돌리기 → 세 번 다시 하기가 픽셀까지 맞다. 바뀌지 않은 장(그림 2)은 사본을 같이 쓴다.
    const pix = () => page.evaluate(() => window.__bench.hires().sum(0));
    const s0 = await pix();
    await stroke(line(.2, .3, .8, .3)); const s1 = await pix();
    await stroke(line(.2, .7, .8, .7)); const s2 = await pix();
    await stroke(line(.5, .1, .5, .9)); const s3 = await pix();
    assert.equal(new Set([s0, s1, s2, s3]).size, 4, '획마다 장이 달라진다');
    const copies = await page.evaluate(() => window.__bench.hires().copies());
    assert.ok(copies.unique <= copies.steps + 2, '되돌리기 사본은 단계마다 장 하나꼴(바뀌지 않은 장은 공유) — 사본 ' + copies.unique + ' · 단계 ' + copies.steps);
    for (const want of [s2, s1, s0]) { await cmd({ type: 'undo' }); assert.equal(await pix(), want, '되돌리기가 그 전 픽셀로 돌아간다'); }
    for (const want of [s1, s2, s3]) { await cmd({ type: 'redo' }); assert.equal(await pix(), want, '다시 하기가 그 뒤 픽셀로 돌아간다'); }

    // 4) 많이 그려도 사본 수에 상한이 있다(1080 사본 하나 ≈ 4.7MB).
    for (let i = 0; i < 45; i++) await stroke(line(.1 + i * .015, .15, .1 + i * .015, .25, 4), 2);
    const many = await page.evaluate(() => window.__bench.hires().copies());
    assert.ok(many.unique <= 24, '되돌리기 사본 상한 24 (' + many.unique + ')');
    assert.ok(many.steps >= 20, '그래도 20단계 넘게 되돌릴 수 있다 (' + many.steps + ')');

    // 5) 채우기: 닫힌 네모 안이 고해상도에서 선까지 꽉 찬다.
    await cmd({ type: 'init', res: 3, layers: [{ id: 'draw-1', name: '그림 1' }], activeLayerId: 'draw-1', penWidth: 4, color: '#000000', brush: { preset: null, opacity: 1, stabilizer: 'light', smoothing: false } });
    await page.waitForTimeout(100);
    await cmd({ type: 'tool', tool: 'pen' });
    for (const seg of [[.3, .3, .7, .3], [.7, .3, .7, .7], [.7, .7, .3, .7], [.3, .7, .3, .3]]) await stroke(line(...seg));
    await cmd({ type: 'color', color: '#FF0000' }); await cmd({ type: 'tool', tool: 'fill' });
    await stroke([[.5, .5], [.5, .5]]);
    await page.waitForTimeout(50);
    const inside = await page.evaluate(() => window.__bench.hires().rgbaAt(0, 180, 180));
    assert.deepEqual(inside.slice(0, 3), [255, 0, 0], '네모 안이 빨강으로 찬다');
    assert.equal(await alphaAt(60, 60), 0, '네모 밖은 비어 있다');
    const gap = await page.evaluate(() => window.__bench.hires().fillGap(0, 180, 108.5));
    assert.ok(gap <= 2, '칠과 선 사이 흰 틈 없음(고해상도 픽셀 ' + gap + ')');

    // 6) 옛 360 장(예전 저장본)이 그대로 열리고, 같은 자리에 같은 그림이 있다.
    const old = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d'); g.fillStyle = '#123456'; g.fillRect(100, 100, 50, 50); return c.toDataURL('image/png'); });
    await cmd({ type: 'init', res: 3, layers: [{ id: 'draw-1', name: '그림 1', data: old }], activeLayerId: 'draw-1' });
    await page.waitForTimeout(150);
    assert.ok(await alphaAt(125, 125) > 250, '옛 360 그림이 같은 자리에 열린다');
    assert.equal(await alphaAt(90, 125), 0, '옛 그림 바깥은 비어 있다');
    await cmd({ type: 'save', token: 2 });
    const reopened = await last('save');
    assert.deepEqual(await size(reopened.data), [360, 360]);
    await cmd({ type: 'saved', token: 2 });

    // 7) 카카오 움직이는 파일은 360 프레임, LINE 은 고해상도에서 줄여 만든다.
    await cmd({ type: 'motion', motion: { version: 1, preset: 'hop', speed: .5, strength: .5 } });
    await cmd({ type: 'frames', id: 9, fps: 12, sheets: true });
    const frames = await last('frames');
    assert.ok(frames.gif.count >= 2, '움직이는 프레임이 만들어진다');
    assert.deepEqual(await size(frames.gif.sheets[0]), [360, 360], '카카오 프레임은 360');
    assert.ok(frames.gif.data.startsWith('data:image/gif'), 'GIF 도 만들어진다');
    await cmd({ type: 'lineFrames', id: 10, spec: { w: 370, h: 320, count: 1, still: true, pad: 10 } });
    const lf = await last('lineFrames');
    assert.deepEqual(await size(lf.line.sheets[0]), [370, 320], 'LINE 일반 스티커 칸');

    // 8) 스포이드: 문서 좌표 자리의 색을 읽는다.
    await cmd({ type: 'eyedrop', on: true });
    await stroke([[125 / 360, 125 / 360], [125 / 360, 125 / 360]]);
    const picked = await last('picked');
    assert.equal(picked.color, '#123456', '스포이드가 고해상도에서도 그 자리 색');

    // 9) 1배(res 1)로 다시 열면 예전과 같은 360 장이다(앱이 res 를 주지 않는 경우).
    await cmd({ type: 'init', res: 1, layers: [{ id: 'draw-1', name: '그림 1' }], activeLayerId: 'draw-1' });
    await page.waitForTimeout(100);
    const one = await page.evaluate(() => window.__bench.hires());
    assert.deepEqual([one.canvas, one.layer, one.res], [[360, 360], [360, 360], 1], '1배는 예전 그대로');

    assert.deepEqual(errors, [], '페이지 오류 없음');
    console.log('PASS: hires engine — 화면·장 1080(문서 좌표 360 그대로), 선 굵기 3배 촘촘, 저장 완성본 360 · 장 PNG 1080, 되돌리기/다시하기 픽셀 일치 + 바뀌지 않은 장 사본 공유 + 사본 상한 24, 채우기 틈 없음, 옛 360 장 그대로 열림, 카카오 프레임 360 · GIF · LINE 칸, 스포이드, 1배 그대로.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
