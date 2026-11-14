// As close to an Android device as this machine gets. NOT a device test.
// Two things it does that the other suites cannot:
//   1. real touch input — Chrome synthesises genuine touch pointer events through CDP, so the
//      two/three-finger gestures run against the real engine instead of a DOM shim.
//   2. Korean text measured in Noto Sans KR — the typeface Android actually uses for Hangul —
//      so the caption's shrink-to-fit rule is checked against those metrics, not Windows ones.
// What it still cannot answer: React Native's own screens, Android touch delivery into a WebView,
// the share sheet, and background/kill behaviour. Those stay unverified until a device runs them.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { canvasHtml } = loader()('src/painter/canvas-html.ts');

const out = path.resolve('verification/device-proxy');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const say = t => console.log('  ' + t);

// The caption rule is mirrored below to measure it under another font. If the engine's rule
// changes, these guards fail instead of the mirror drifting out of date silently.
const rule = {
  room: "room=W-32",
  start: "let px=Math.round(H*.11),wide=0;",
  loop: "for(;px>10;px--){g.font='700 '+px+'px system-ui, sans-serif';wide=g.measureText(text).width;if(wide<=room)break;}",
  clamp: "if(wide>room){px=Math.max(1,Math.floor(px*room/wide));g.font='700 '+px+'px system-ui, sans-serif';wide=g.measureText(text).width;}",
  bottom: "const x=W/2+(caption.dx||0),y=(caption.place==='top'?Math.round(H*.06):H-Math.round(H*.06))+(caption.dy||0);",
};
for (const [name, fragment] of Object.entries(rule)) assert.ok(canvasHtml.includes(fragment), `caption rule "${name}" still reads as the test expects`);

(async () => {
  const watchdog = setTimeout(() => { console.error('FAIL: device proxy timed out'); process.exit(1); }, 180000);
  watchdog.unref();
  const server = await chromium.launchServer({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const browser = await chromium.connect(server.wsEndpoint());
  try {
    // A phone-shaped context that reports touch support, the way an Android WebView does.
    const context = await browser.newContext({ viewport: { width: 390, height: 600 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const cdp = await context.newCDPSession(page);
    await page.setContent(canvasHtml.replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>'));
    await page.waitForFunction(() => window.messages.some(m => m.type === 'ready'));
    const cmd = m => page.evaluate(m => window.command(m), m);
    const state = () => page.evaluate(() => window.messages.filter(m => m.type === 'state').at(-1));
    const save = async () => { await cmd({ type: 'save' }); const r = await page.evaluate(() => window.messages.filter(m => m.type === 'save').at(-1)); await cmd({ type: 'saved' }); return r; };
    const zoomLevel = () => page.evaluate(() => (window.messages.filter(m => m.type === 'zoom').at(-1) || { zoom: 1 }).zoom);

    // ── Real touch, dispatched by the browser itself ─────────────────────────────────────────
    // Chrome generates one pointer event per changed point, so a sequence is expressed as the
    // full set of points that are down at each moment.
    const point = p => ({ x: p.x, y: p.y, id: p.id, radiusX: 6, radiusY: 6, force: 1 });
    const touch = async (type, points) => { await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(point) }); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => r()))); };
    const fingerStroke = async (from, to, steps = 10) => {
      await touch('touchStart', [{ id: 1, ...from }]);
      for (let i = 1; i <= steps; i++) await touch('touchMove', [{ id: 1, x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }]);
      await touch('touchEnd', []);
    };
    const fingerTap = async (count) => {
      const points = Array.from({ length: count }, (_, i) => ({ id: i + 1, x: 90 + i * 45, y: 300 }));
      for (let i = 0; i < count; i++) await touch('touchStart', points.slice(0, i + 1));
      for (let i = count - 1; i >= 0; i--) await touch('touchEnd', points.slice(0, i));
    };

    await cmd({ type: 'init', color: '#242424', penWidth: 12, eraserWidth: 24 });
    await cmd({ type: 'tool', tool: 'pen' });
    const blank = await save();
    assert.equal(blank.metrics.coverage, 0);

    await fingerStroke({ x: 90, y: 120 }, { x: 280, y: 190 });
    const oneFinger = await save();
    assert.ok(oneFinger.metrics.coverage > 0, 'one finger draws');
    say(`한 손가락 그리기: coverage ${(oneFinger.metrics.coverage * 100).toFixed(2)}%`);
    assert.equal((await state()).undo, true, 'and the stroke is on the undo stack');

    await fingerStroke({ x: 90, y: 230 }, { x: 280, y: 300 });
    const twoStrokes = await save();
    assert.ok(twoStrokes.metrics.coverage > oneFinger.metrics.coverage, 'a second stroke adds ink');

    await fingerTap(2);
    const undone = await save();
    assert.ok(Math.abs(undone.metrics.coverage - oneFinger.metrics.coverage) < 1e-9, '두 손가락 탭 = 되돌리기 (real touch)');
    say('두 손가락 탭 → 되돌리기 동작');
    await fingerTap(3);
    const redone = await save();
    assert.ok(Math.abs(redone.metrics.coverage - twoStrokes.metrics.coverage) < 1e-9, '세 손가락 탭 = 다시 실행 (real touch)');
    say('세 손가락 탭 → 다시 실행 동작');

    // Three in a row, the case a device reported broken before.
    await fingerStroke({ x: 300, y: 120 }, { x: 330, y: 300 });
    const three = await save();
    for (const [i, expected] of [[1, twoStrokes], [2, oneFinger], [3, blank]]) {
      await fingerTap(2);
      const back = await save();
      assert.ok(Math.abs(back.metrics.coverage - expected.metrics.coverage) < 1e-9, `연속 되돌리기 ${i}단계`);
    }
    for (const [i, expected] of [[1, oneFinger], [2, twoStrokes], [3, three]]) {
      await fingerTap(3);
      const forward = await save();
      assert.ok(Math.abs(forward.metrics.coverage - expected.metrics.coverage) < 1e-9, `연속 다시 실행 ${i}단계`);
    }
    say('연속 되돌리기 ×3 → 다시 실행 ×3 모두 순서대로 복구');

    // A drag is a drag, never a tap.
    const beforeDrag = await save();
    await touch('touchStart', [{ id: 1, x: 120, y: 300 }]);
    await touch('touchStart', [{ id: 1, x: 120, y: 300 }, { id: 2, x: 220, y: 300 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ id: 1, x: 120, y: 300 - i * 12 }, { id: 2, x: 220, y: 300 - i * 12 }]);
    await touch('touchEnd', [{ id: 1, x: 120, y: 228 }]);
    await touch('touchEnd', []);
    const afterDrag = await save();
    assert.equal(afterDrag.metrics.coverage, beforeDrag.metrics.coverage, '두 손가락 끌기는 되돌리기가 아니다');
    assert.ok(await zoomLevel() >= 1, 'and it moves the canvas instead');
    say('두 손가락 끌기 → 되돌리기로 오인되지 않음');

    // With a reference selected, two fingers move and pinch the reference itself.
    const red = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d'); g.fillStyle = '#E94F4F'; g.fillRect(60, 60, 240, 240); return c.toDataURL(); });
    await cmd({ type: 'zoom', zoom: 1 });
    await cmd({ type: 'addReferences', references: [{ id: 'r1', name: '참고 1', visible: true, opacity: .4, x: 0, y: 0, scale: 1, rotation: 0, path: 'r1.png', data: red } ] });
    await cmd({ type: 'setActiveReference', id: 'r1' });
    const refBefore = (await state()).references[0];
    await touch('touchStart', [{ id: 1, x: 140, y: 260 }]);
    await touch('touchStart', [{ id: 1, x: 140, y: 260 }, { id: 2, x: 240, y: 260 }]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [{ id: 1, x: 140 - i * 5, y: 260 - i * 4 }, { id: 2, x: 240 + i * 5, y: 260 - i * 4 }]);
    await touch('touchEnd', [{ id: 1, x: 100, y: 228 }]);
    await touch('touchEnd', []);
    const refAfter = (await state()).references[0];
    assert.ok(refAfter.scale > refBefore.scale, '활성 참고 핀치 = 참고 확대');
    assert.ok(refAfter.y !== refBefore.y, '활성 참고 두 손가락 이동 = 참고 이동');
    assert.equal(await zoomLevel(), 1, 'and the canvas itself does not zoom while a reference is being handled');
    const exported = await save();
    assert.equal(exported.metrics.coverage, afterDrag.metrics.coverage, '참고를 아무리 움직여도 출력 그림은 그대로다');
    say(`활성 참고 이동/확대: scale ${refBefore.scale} → ${refAfter.scale.toFixed(2)}, 출력 불변`);
    await page.screenshot({ path: path.join(out, '01-touch-reference.png') });

    // ── The caption, measured in the font Android uses for Hangul ────────────────────────────
    const fontCheck = await page.evaluate(async () => {
      await document.fonts.load("700 40px 'Noto Sans KR'");
      return { noto: document.fonts.check("700 40px 'Noto Sans KR'"), systemUi: document.fonts.check('700 40px system-ui') };
    });
    assert.equal(fontCheck.noto, true, 'Noto Sans KR is available to measure against');
    // Same rule as the engine: start at 11% of the canvas, shrink until it fits W-32, floor at 10.
    const measure = (text, family) => page.evaluate(([text, family]) => {
      const W = 360, H = 360, room = W - 32;
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.textAlign = 'center'; g.textBaseline = 'bottom';
      let px = Math.round(H * .11), wide = 0;
      for (; px > 10; px--) { g.font = '700 ' + px + 'px ' + family; wide = g.measureText(text).width; if (wide <= room) break; }
      if (wide > room) { px = Math.max(1, Math.floor(px * room / wide)); g.font = '700 ' + px + 'px ' + family; }
      const x = W / 2, y = H - Math.round(H * .06);
      g.lineJoin = 'round'; g.lineWidth = Math.max(3, px * .22); g.strokeStyle = '#FFFFFF'; g.strokeText(text, x, y);
      g.fillStyle = '#242424'; g.fillText(text, x, y);
      const d = g.getImageData(0, 0, W, H).data;
      let minX = W, maxX = -1, minY = H, maxY = -1, ink = 0;
      for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
        if (d[(yy * W + xx) * 4 + 3] === 0) continue;
        ink++; if (xx < minX) minX = xx; if (xx > maxX) maxX = xx; if (yy < minY) minY = yy; if (yy > maxY) maxY = yy;
      }
      return { px, width: g.measureText(text).width, minX, maxX, minY, maxY, ink, data: c.toDataURL() };
    }, [text, family]);

    const captions = ['고마워요', '헐', 'ㅋㅋㅋㅋㅋ', '정말정말 고마워요 오늘도 화이팅!', '잘자 내일 또 만나 :)', '가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차카타파하'];
    const gallery = [];
    for (const text of captions) {
      const noto = await measure(text, "'Noto Sans KR', sans-serif");
      const windows = await measure(text, 'system-ui, sans-serif');
      assert.ok(noto.ink > 0, `"${text}" renders glyphs in Noto Sans KR, not blanks`);
      assert.ok(noto.minX >= 0 && noto.maxX < 360, `"${text}" stays inside the canvas left/right in Noto: ${noto.minX}..${noto.maxX}`);
      assert.ok(noto.minY >= 0 && noto.maxY < 360, `"${text}" stays inside the canvas top/bottom in Noto: ${noto.minY}..${noto.maxY}`);
      assert.ok(noto.width <= 360 - 32, `"${text}" fits the width the rule reserves, in Noto: ${Math.round(noto.width)}`);
      const shift = Math.abs(noto.px - windows.px);
      say(`"${text}" · Noto ${noto.px}px 잉크 ${noto.minX}..${noto.maxX} × ${noto.minY}..${noto.maxY} / Windows ${windows.px}px (차이 ${shift}px)`);
      gallery.push({ text, noto: noto.data });
    }
    // One picture of the Hangul as Android's typeface draws it.
    await page.evaluate(items => {
      document.body.innerHTML = '<div id="g" style="background:#fff;padding:8px;display:flex;flex-direction:column;gap:4px"></div>';
      for (const item of items) { const i = new Image(); i.src = item.noto; i.style.width = '180px'; i.style.border = '1px solid #ddd'; document.getElementById('g').appendChild(i); }
    }, gallery);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, '02-caption-noto-sans-kr.png'), fullPage: true });

    assert.deepEqual(errors, [], 'no page errors during the run');
    console.log('PASS: 실제 터치 이벤트로 한 손가락 그리기 · 두 손가락 되돌리기 · 세 손가락 다시 실행 · 연속 3단계 · 끌기 오인 없음 · 활성 참고 이동/핀치와 출력 불변을 확인했고, 한글 문구를 Android와 같은 Noto Sans KR 메트릭으로 측정해 잘림 없이 캔버스 안에 들어오는 것을 확인했다. 증거: verification/device-proxy/. 실기기 검증이 아니다.');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (process.platform === 'win32') server.process().kill('SIGKILL');
    await server.kill(); await browser.close();
  }
})();
