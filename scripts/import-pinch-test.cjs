// 가져온 그림 · 두 손가락(2026-10-30 사용자 지적: "이미지 가져오기 하면 참고·이미지 둘 다 잔렉, 이미지는 손가락으로 크기 조정을 못해").
// 실제 Chrome 에서 앱과 같은 엔진(canvas-html, res 3)으로 확인한다.
//  1) 가져온 그림(place)은 바로 '고른 부분'이 되고 선택 도구로 바뀐다.
//  2) 그 위의 두 손가락: 벌리면 크기, 같이 끌면 옮기기. 적용하면 그림 장에 남는다.
//  3) 두 손가락으로 참고 그림을 키워도 움직일 때마다 앱으로 상태를 보내지 않는다(손을 뗄 때 한 번).
//  4) 손가락 움직임이 한 프레임에 여러 번 와도 화면은 프레임마다 한 번만 다시 그린다.
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/import-pinch-test.cjs
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
    await cmd({ type: 'init', res: 3, layers: [{ id: 'draw-1', name: '그림 1' }], activeLayerId: 'draw-1', penWidth: 6, color: '#202020', brush: { preset: null, opacity: 1, stabilizer: 'light', smoothing: false } });
    await page.waitForTimeout(200);
    // 가로로 긴 빨간 그림(200×100) — 캔버스에 맞춰 들어온다.
    const data = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 100; const g = c.getContext('2d'); g.fillStyle = '#e94f4f'; g.fillRect(0, 0, 200, 100); return c.toDataURL('image/png'); });
    // 두 손가락: 비율 좌표(캔버스 왼쪽 위 기준)로 각 손가락의 시작·끝을 주고 steps 번에 나눠 움직인다.
    const pinch = (a0, a1, b0, b1, steps = 12, gap = 8) => page.evaluate(async ({ a0, a1, b0, b1, steps, gap }) => {
      const c = document.getElementById('drawing'), r = c.getBoundingClientRect();
      const ev = (t, id, p) => c.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, bubbles: true, cancelable: true, clientX: r.left + p[0] * r.width, clientY: r.top + p[1] * r.height }));
      ev('pointerdown', 1, a0); ev('pointerdown', 2, b0);
      for (let i = 1; i <= steps; i++) {
        const k = i / steps, lerp = (p, q) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
        ev('pointermove', 1, lerp(a0, a1)); ev('pointermove', 2, lerp(b0, b1));
        if (gap) await new Promise(res => setTimeout(res, gap));   // gap 0 = 한 프레임 안에 몰아서
      }
      ev('pointerup', 2, b1); ev('pointerup', 1, a1);
    }, { a0, a1, b0, b1, steps, gap });

    // 1) 가져오면 바로 고른 부분
    await cmd({ type: 'importDrawing', data, place: true });
    await page.waitForTimeout(300);
    let s = await last('state');
    assert.ok(s.selection, '가져온 그림이 바로 고른 부분이 된다');
    assert.ok(Math.abs(s.selection.box.w - 360) < 2 && Math.abs(s.selection.box.h - 180) < 2, '고른 부분 = 가져온 그림의 자리(360×180) ' + JSON.stringify(s.selection.box));
    assert.equal(s.layers.length, 2, '그림은 새 장으로 들어온다');

    // 2) 두 손가락으로 벌리기(거리 2배) + 같이 오른쪽으로
    await pinch([.4, .5], [.3, .5], [.6, .5], [.7, .5]);
    await page.waitForTimeout(100);
    s = await last('state');
    assert.ok(s.selection.scale > 1.8 && s.selection.scale < 2.2, '벌린 만큼 커진다 (' + s.selection.scale + ')');
    assert.equal(s.selection.rot, 0, '나란히 벌리면 돌지 않는다');
    await pinch([.4, .5], [.5, .5], [.6, .5], [.7, .5]);
    s = await last('state');
    assert.ok(s.selection.dx > 30, '두 손가락을 같이 끌면 옮겨진다 (' + s.selection.dx + ')');
    // 적용하면 고른 부분이 장에 남는다(가져온 그림 장에 다시 그려진다).
    await cmd({ type: 'selectApply' });
    await page.waitForTimeout(150);
    s = await last('state');
    assert.equal(s.selection, null, '적용하면 고른 상태가 끝난다');

    // 3·4) 참고 그림을 두 손가락으로 키운다 — 움직이는 동안 상태 메시지는 없고, 다시 그리기는 프레임마다 한 번.
    await cmd({ type: 'tool', tool: 'pen' });
    await cmd({ type: 'addReferences', references: [{ id: 'ref-1', name: '참고 1', data }] });
    await page.waitForTimeout(300);
    const before = await page.evaluate(() => ({ states: window.messages.filter(m => m.type === 'state').length, renders: window.__bench.renders() }));
    // 40번 움직임을 기다림 없이 한꺼번에 보낸다(휴대폰이 한 프레임에 몰아 주는 경우).
    await pinch([.4, .5], [.3, .5], [.6, .5], [.7, .5], 40, 0);
    const during = await page.evaluate(() => ({ states: window.messages.filter(m => m.type === 'state').length, renders: window.__bench.renders() }));
    assert.ok(during.renders - before.renders <= 3, '한꺼번에 온 40번 움직임에 화면은 몇 번만 다시 그린다 (' + (during.renders - before.renders) + ')');
    assert.ok(during.states - before.states <= 3, '40번 움직이는 동안 앱으로 상태를 보내지 않는다 — 손가락을 대고 뗄 때만(전에는 움직일 때마다 40번 넘게) (' + (during.states - before.states) + ')');
    await page.waitForTimeout(100);
    s = await last('state');
    const ref = s.references.find(r => r.id === 'ref-1');
    assert.ok(ref.scale > 1.8, '참고 그림이 벌린 만큼 커진다 (' + ref.scale + ')');

    assert.deepEqual(errors, [], '페이지 오류 없음');
    console.log('PASS: imported picture is picked at once and two fingers resize/move it (apply keeps it); two-finger moves redraw once per frame and send no state while moving — real Chrome, same engine; a device pinch still to check');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
