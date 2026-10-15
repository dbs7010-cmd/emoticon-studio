// 애니메이션(장 그리기) 엔진 검사 — 실제 Chromium 캔버스에서 장 만들기·복제·고르기·시간·삭제·저장·다시 열기·굽기를 돌린다.
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/anim-engine-test.cjs
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { canvasHtml } = loader()('src/painter/canvas-html.ts');

(async () => {
  const watchdog = setTimeout(() => { console.error('FAIL: anim engine test timed out'); process.exit(1); }, 120000);
  watchdog.unref();
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent(canvasHtml.replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>'));
    const cmd = m => page.evaluate(m => window.command(m), m);
    const last = type => page.evaluate(t => window.messages.filter(m => m.type === t).at(-1), type);
    const saved = async (extra = {}) => { await cmd({ type: 'save', ...extra }); const r = await last('save'); await cmd({ type: 'saved' }); return r; };
    const line = async (x1, y1, x2, y2) => { await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x2, y2, { steps: 20 }); await page.mouse.up(); };
    // PNG 의 칠한 픽셀 수(알파 > 0)
    const inked = data => page.evaluate(async src => {
      const i = new Image(); i.src = src; await i.decode();
      const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
      const d = g.getImageData(0, 0, 360, 360).data; let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k]) n++; return n;
    }, data);
    // 화면 캔버스 한 점의 색
    const screen = (x, y) => page.evaluate(([x, y]) => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); const sx = c.width / r.width; return [...c.getContext('2d').getImageData(Math.round(x * sx), Math.round(y * sx), 1, 1).data]; }, [x, y]);

    await cmd({ type: 'init' });
    await cmd({ type: 'width', tool: 'pen', width: 16 });
    await cmd({ type: 'color', color: '#242424' });
    await line(60, 60, 160, 60);                                 // 1장: 위쪽 가로선
    let st = await last('state');
    assert.equal(st.frames, null, '처음에는 장이 없다');

    // 1. 애니메이션 시작 = 2장(둘째는 첫 장 복제), 둘째 장이 열린다.
    await cmd({ type: 'animStart', duration: .3 });
    st = await last('state');
    assert.equal(st.frames.length, 2); assert.equal(st.frameIdx, 1); assert.equal(st.undo, false, '장을 바꾸면 되돌리기 기록이 비워진다');
    assert.deepEqual(st.frames.map(f => f.duration), [.3, .3]);

    // 2. 둘째 장에만 아래쪽 선을 더 그린다. 첫 장에는 없어야 한다.
    await line(60, 220, 160, 220);
    let s = await saved();
    assert.equal(s.frames.length, 2, '저장에 장 목록이 실린다');
    assert.equal(s.frames[0].layers, null, '첫 장 레이어는 layers 로 따로 간다(중복 전송 없음)');
    const first = await inked(s.layers[0].data), second = await inked(s.frames[1].layers[0].data);
    assert.ok(first > 500 && second > first * 1.6, `첫 장은 선 하나, 둘째 장은 선 둘: ${first} / ${second}`);
    assert.equal(await inked(s.data), first, '대표 그림(data)은 첫 장이다');

    // 3. 앞 장 비춰 보기: 둘째 장 화면에서 첫 장 선은 같은 자리라 보이고, 첫 장으로 가면 아래쪽 선이 없다.
    await cmd({ type: 'frameSelect', index: 0 });
    st = await last('state'); assert.equal(st.frameIdx, 0);
    const blank = await screen(110, 220);
    assert.equal(blank[3], 0, '첫 장에는 아래쪽 선이 없다(장마다 따로 그린다)');
    await cmd({ type: 'frameSelect', index: 1 });
    await cmd({ type: 'onion', on: true });

    // 4. 장 추가(복제) · 시간 · 순서 · 삭제
    await cmd({ type: 'frameAdd' });
    st = await last('state'); assert.equal(st.frames.length, 3); assert.equal(st.frameIdx, 2, '복제한 장은 지금 장 바로 뒤에 들어가 열린다');
    await cmd({ type: 'frameDuration', index: 2, duration: .6 });
    st = await last('state'); assert.deepEqual(st.frames.map(f => f.duration), [.3, .3, .6]);
    await cmd({ type: 'frameMove', from: 2, to: 0 });
    st = await last('state'); assert.equal(st.frameIdx, 0, '옮긴 장을 계속 따라간다'); assert.deepEqual(st.frames.map(f => f.duration), [.6, .3, .3]);
    await cmd({ type: 'frameMove', from: 0, to: 2 });
    assert.ok(Math.abs((await last('state')).loop - 1.2) < 1e-6, '한 바퀴 = 장 시간 합');

    // 5. 굽기: 움직임 효과가 없으면 장 경계(최대공약수 0.3초)에 맞춰 4장.
    await cmd({ type: 'frames', id: 1, fps: 12 });
    const loop = (await last('frames')).gif;
    assert.equal(loop.count, 4, '0.3+0.3+0.6초 = 0.3초 간격 4장: ' + loop.count);
    assert.ok(loop.data.startsWith('data:image/gif'), 'GIF 가 만들어진다');
    // 움직임 효과(통통)가 같이 있으면 부드럽게 12fps(최대 24장)
    await cmd({ type: 'motion', motion: { version: 1, preset: 'bounce', speed: .5, strength: .5 } });
    await cmd({ type: 'frames', id: 2, fps: 12 });
    const moving = (await last('frames')).gif;
    assert.ok(moving.count > 4 && moving.count <= 24, '효과가 있으면 촘촘히(≤24): ' + moving.count);
    await cmd({ type: 'motion', motion: null });

    // 6. 저장 → 다시 열기: 장 수·시간·그림이 그대로
    s = await saved({ gif: true });
    assert.ok(s.gif && s.gif.data, '움직임 효과 없이 장만 있어도 움직이는 파일을 만든다');
    const frames = s.frames.map((f, i) => ({ id: f.id, duration: f.duration, layers: i === 0 ? s.layers : f.layers }));
    await cmd({ type: 'init', layers: s.layers, frames, activeLayerId: s.activeLayerId });
    st = await last('state');
    assert.equal(st.frames.length, 3); assert.equal(st.frameIdx, 0, '다시 열면 첫 장');
    const again = await saved();
    assert.equal(await inked(again.frames[1].layers[0].data), second, '둘째 장 그림이 그대로 돌아온다');

    // 7. 장 삭제: 2장 아래로 내려가면 애니메이션이 꺼지고 남은 장이 그림이 된다.
    await cmd({ type: 'frameDelete', index: 2 });
    st = await last('state'); assert.equal(st.frames.length, 2);
    await cmd({ type: 'frameSelect', index: 1 });
    await cmd({ type: 'frameDelete', index: 0 });
    st = await last('state'); assert.equal(st.frames, null, '한 장만 남으면 장 목록이 없어진다');
    assert.equal(await inked((await saved()).layers[0].data), second, '남은 장(선 둘)이 그림이 된다');

    // 8. 끄기: 첫 장만 남는다
    await cmd({ type: 'animStart' }); await cmd({ type: 'animOff' });
    st = await last('state'); assert.equal(st.frames, null);
    // 9. 부분 움직임 중심점 추정(2026-10-15): 오른쪽에 그린 팔 → 왼쪽 변(몸 쪽), 위에 그린 귀 → 아래 변
    await cmd({ type: 'init', layers: [{ id: 'draw-1', name: '몸' }, { id: 'draw-2', name: '팔' }], activeLayerId: 'draw-2' });
    await cmd({ type: 'width', tool: 'pen', width: 10 });
    await line(250, 150, 330, 150);                     // 화면 오른쪽 가로 막대(팔)
    await cmd({ type: 'partGuess', id: 'p1', layerId: 'draw-2' });
    const arm = await last('partGuess');
    assert.ok(arm.found && arm.x < arm.box[2] - .05 && Math.abs(arm.x - arm.box[0]) < .02, '팔: 몸 쪽(왼쪽) 끝이 축 ' + JSON.stringify(arm));
    await cmd({ type: 'clear' }); await line(160, 30, 200, 30);   // 위쪽 귀
    await cmd({ type: 'partGuess', id: 'p2', layerId: 'draw-2' });
    const ear = await last('partGuess');
    assert.ok(ear.found && Math.abs(ear.y - ear.box[3]) < .02, '귀: 아래(귀뿌리)가 축 ' + JSON.stringify(ear));
    await cmd({ type: 'partGuess', id: 'p3', layerId: 'draw-1' });
    assert.equal((await last('partGuess')).found, false, '빈 레이어는 추정하지 않는다(가운데 그대로)');
    assert.deepEqual(errors, [], '페이지 오류 없음: ' + errors.join(' | '));
    console.log('PASS: anim engine — 시작 2장(복제)·장마다 따로 그림·대표 그림은 첫 장·앞 장 비춰 보기·추가/시간/순서/삭제·한 바퀴=시간 합·굽기(장 경계 4장, 효과 있으면 ≤24)·저장/다시 열기·한 장 남으면 해제·끄기');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
