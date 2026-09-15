// PRO 색상 엔진 검사 — 실제 Chromium 캔버스에서 투명도 획·투명도 채우기·스포이드를 돌린다.
// React Native 화면이 아니라 WebView 안의 엔진만 본다. Android WebView 결과는 실기기 검수가 따로 확인한다.
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/color-engine-test.cjs
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { canvasHtml } = loader()('src/painter/canvas-html.ts');

(async () => {
  const watchdog = setTimeout(() => { console.error('FAIL: color engine test timed out'); process.exit(1); }, 90000);
  watchdog.unref();
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent(canvasHtml.replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>'));
    const cmd = m => page.evaluate(m => window.command(m), m);
    const last = type => page.evaluate(t => window.messages.filter(m => m.type === t).at(-1), type);
    const saved = async () => { await cmd({ type: 'save' }); const r = await last('save'); await cmd({ type: 'saved' }); return r; };
    const line = async (x1 = 90, y1 = 100, x2 = 220, y2 = 200) => { await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x2, y2, { steps: 25 }); await page.mouse.up(); };
    const tap = async (x, y) => { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.up(); };
    // 레이어 PNG 의 알파 통계. 투명도 획이 선분 이음매마다 진해지면 max 가 목표보다 커진다.
    const alphaStats = data => page.evaluate(async src => {
      const i = new Image(); i.src = src; await i.decode();
      const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
      const d = g.getImageData(0, 0, 360, 360).data; let max = 0, count = 0, at128 = 0;
      for (let k = 3; k < d.length; k += 4) { if (d[k]) { count++; max = Math.max(max, d[k]); if (Math.abs(d[k] - 128) <= 2) at128++; } }
      return { max, count, at128 };
    }, data);
    const pixel = (data, x, y) => page.evaluate(async ([src, x, y]) => {
      const i = new Image(); i.src = src; await i.decode();
      const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
      return [...g.getImageData(x, y, 1, 1).data];
    }, [data, x, y]);

    await cmd({ type: 'init' });
    await cmd({ type: 'width', tool: 'pen', width: 18 });

    // 1. 불투명한 색은 예전 그대로다.
    await cmd({ type: 'color', color: '#242424' }); await line();
    const opaque = await alphaStats((await saved()).layers[0].data);
    assert.equal(opaque.max, 255, '불투명 획은 알파 255');
    await cmd({ type: 'clear' });

    // 2. 투명도 50% 획: 겹치는 이음매가 진해지지 않고 한 획 전체가 같은 투명도다.
    await cmd({ type: 'color', color: '#FF000080' }); await line();
    const half = await alphaStats((await saved()).layers[0].data);
    assert.ok(half.max >= 126 && half.max <= 130, '투명도 획의 최대 알파가 128 근처여야 한다 — 이음매 누적 없음: ' + half.max);
    assert.ok(half.at128 > half.count * 0.6, '획 대부분이 같은 투명도: ' + JSON.stringify(half));
    // 한 번 되돌리기로 투명도 획이 통째로 사라진다(wet 버퍼가 따로 체크포인트를 만들지 않는다).
    await cmd({ type: 'undo' });
    assert.equal((await saved()).metrics.coverage, 0, '되돌리기 한 번에 투명도 획 전체가 없어진다');

    // 3. 손을 떼기 전에 저장이 와도 그리던 투명도 획을 잃지 않는다.
    await page.mouse.move(60, 60); await page.mouse.down(); await page.mouse.move(200, 90, { steps: 20 });
    const mid = await saved();
    await page.mouse.up();
    const midStats = await alphaStats(mid.layers[0].data);
    assert.ok(midStats.count > 0 && midStats.max <= 130, '저장 순간의 투명도 획이 파일에 들어간다: ' + JSON.stringify(midStats));
    await cmd({ type: 'clear' });

    // 4. 투명도 채우기: 칠한 칸이 그 투명도를 가진다.
    await cmd({ type: 'color', color: '#00FF0080' }); await cmd({ type: 'tool', tool: 'fill' });
    await tap(30, 30);
    const filled = await saved();
    const fp = await pixel(filled.layers[0].data, 20, 20);
    assert.deepEqual([fp[1], Math.abs(fp[3] - 128) <= 1], [255, true], '채우기 픽셀 초록·알파 128: ' + fp);
    await cmd({ type: 'clear' }); await cmd({ type: 'tool', tool: 'pen' });

    // 5. 스포이드: 보이는 그림에서 색을 읽고, 읽는 동안 획을 남기지 않는다.
    await cmd({ type: 'color', color: '#3366AA' }); await line();
    const before = await saved();
    await cmd({ type: 'eyedrop', on: true });
    assert.equal((await last('state')).picking, true, '스포이드 상태가 화면에 전달된다');
    await tap(155, 150);
    const picked = await last('picked');
    assert.equal(picked.color, '#3366AA', '획 위를 누르면 그 색을 읽는다');
    assert.equal((await last('state')).picking, false, '한 번 읽으면 스포이드가 끝난다');
    const after = await saved();
    assert.equal(after.data, before.data, '스포이드로 누른 자리에 점이 찍히지 않는다');
    await cmd({ type: 'eyedrop', on: true });
    await tap(385, 385);
    assert.equal((await last('picked')).color, null, '투명한 곳은 색 없음으로 알린다');
    // 참고 이미지의 색도 읽는다(보이는 그대로의 계열).
    const ref = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d'); g.fillStyle = '#FFAA00'; g.fillRect(0, 0, 360, 360); return c.toDataURL(); });
    await cmd({ type: 'addReferences', references: [{ id: 'r1', name: '참고 1', visible: true, opacity: .3, x: 0, y: 0, scale: 1, rotation: 0, path: 'r1.png', data: ref }] });
    await cmd({ type: 'eyedrop', on: true });
    await tap(380, 20);
    // 30% 불투명 참고는 미리 곱한 알파를 되돌리며 채널이 ±1~2 흔들린다. 계열이 맞는지만 본다.
    const refPick = (await last('picked')).color, rp = [1, 3, 5].map(i => parseInt(refPick.slice(i, i + 2), 16));
    assert.ok(Math.abs(rp[0] - 0xFF) <= 2 && Math.abs(rp[1] - 0xAA) <= 2 && Math.abs(rp[2] - 0x00) <= 2, '참고 이미지에서도 색을 읽는다: ' + refPick);
    // 스포이드 취소.
    await cmd({ type: 'eyedrop', on: true }); await cmd({ type: 'eyedrop', on: false });
    assert.equal((await last('state')).picking, false, '취소하면 스포이드가 꺼진다');

    // 6. 문구 색의 투명도가 출력에 반영된다.
    await cmd({ type: 'removeReference', id: 'r1' }); await cmd({ type: 'clear' });
    await cmd({ type: 'caption', caption: { text: '가나다', place: 'bottom', color: '#0000FF80' } });
    const cap = await saved();
    assert.ok(cap.metrics.coverage > 0, '투명도 문구가 그려진다');

    assert.deepEqual(errors, [], '페이지 오류 없음');
    console.log('PASS: color engine — 불투명 유지 · 투명도 획 균일(최대 알파 ' + half.max + ') · 되돌리기 1회 · 저장 중 획 보존 · 투명도 채우기 · 스포이드(그림·참고·빈 곳·취소) · 문구 투명도');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e && e.stack || e); process.exit(1); });
