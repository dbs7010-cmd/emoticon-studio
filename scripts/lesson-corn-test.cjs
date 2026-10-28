// 강좌 예시(대표 캐릭터 콘, 2026-10-16)가 실제 앱 엔진에서 규격대로 출력되는지 본다.
// 강좌에서 보여 주는 세 가지 — ① 통통(전체 움직임) ② 하트만 둥실(부분 움직임 · 통통 튀기 출발점) ③ 윙크 애니메이션(3장: 0.8 · 0.5 · 0.2초) —
// 를 같은 엔진으로 구워 GIF 장 수(≤24) · 크기(360×360) · 용량(≤650KB) · 칸 밖 잘림 없음 · 장마다 그림이 실제로 달라지는지 확인한다.
// 또 강좌 데이터: 11편(10-29 대사) · 그림/영상 파일 존재 · 무료 그룹 유지 · 옛 캐릭터 이름(고양이·몽이) 없음.
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/lesson-corn-test.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { canvasHtml } = loader()('src/painter/canvas-html.ts');
const { PART_STARTERS } = loader()('src/painter/motion-recipes.ts');
const { KAKAO_ANIMATED_SPEC } = loader()('src/constants/kakao-spec.ts');
const ROOT = path.join(__dirname, '..');
const png = name => 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'mascot', `corn-${name}.png`)).toString('base64');

// ── 강좌 데이터 ──
const src = fs.readFileSync(path.join(ROOT, 'src/constants/lessons.ts'), 'utf8');
const files = [...src.matchAll(/require\('\.\.\/\.\.\/(assets\/lessons\/[^']+)'\)/g)].map(m => m[1]);
assert.ok(files.length >= 30, '강좌 그림·영상 ' + files.length);
for (const f of files) assert.ok(fs.existsSync(path.join(ROOT, f)), '파일 있음: ' + f);
assert.equal((src.match(/^\s{4}id: '/gm) || []).length, 11, '강좌 11편(10-29 대사 넣기 추가)');
assert.ok(!/고양이|몽이|귀를|꼬리/.test(src.replace(/^\s*\/\/.*$/gm, '')), '옛 캐릭터·없는 부위를 설명하지 않는다(주석 제외)');
assert.ok(/group: 'app'/.test(src) && /group: 'draw'/.test(src) && loader()('src/constants/lessons.ts').LESSON_GROUPS.some(g => g.title === '무료 · 앱 사용법' && g.free), '무료 강좌 그룹 유지');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent(canvasHtml.replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>'));
    const cmd = m => page.evaluate(m => window.command(m), m);
    const last = t => page.evaluate(t => window.messages.filter(m => m.type === t).at(-1), t);
    const check = async (label, id) => {
      await cmd({ type: 'frames', id, fps: 12 });
      const { gif } = await last('frames');
      const bytes = Buffer.from(gif.data.split(',')[1], 'base64');
      const w = bytes.readUInt16LE(6), h = bytes.readUInt16LE(8);
      assert.equal(gif.clipped, false, label + ': 칸 밖으로 나가지 않는다');
      assert.ok(gif.count >= 2 && gif.count <= KAKAO_ANIMATED_SPEC.maxFrames, label + ' 장 수 ' + gif.count);
      assert.ok(w === KAKAO_ANIMATED_SPEC.width && h === KAKAO_ANIMATED_SPEC.height, label + ` 크기 ${w}×${h}`);
      assert.ok(bytes.length <= KAKAO_ANIMATED_SPEC.maxBytes, label + ' 용량 ' + bytes.length);
      console.log(`  ${label}: ${gif.count}장 · ${w}×${h} · ${(bytes.length / 1024).toFixed(0)}KB · 한 바퀴 ${gif.loop}초`);
      return gif;
    };
    // 콘(몸) + 하트(소품 레이어) — 강좌 영상과 같은 구성
    const heart = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d');
      g.fillStyle = '#FF6E7A'; g.beginPath(); g.moveTo(290, 80); g.bezierCurveTo(290, 55, 330, 55, 330, 80); g.bezierCurveTo(330, 100, 300, 112, 290, 125); g.bezierCurveTo(280, 112, 250, 100, 250, 80); g.bezierCurveTo(250, 55, 290, 55, 290, 80); g.fill(); return c.toDataURL(); });
    await cmd({ type: 'init', layers: [{ id: 'draw-1', name: '레이어 1', data: png('base') }, { id: 'draw-2', name: '레이어 2', data: heart }], activeLayerId: 'draw-1' });
    await page.waitForTimeout(300);
    await cmd({ type: 'scaleAll', factor: .85 });
    // ① 통통
    await cmd({ type: 'motion', motion: { version: 1, preset: 'bounce', speed: .5, strength: .5 } });
    await check('통통(전체)', 1);
    // ② 하트만 — 강좌 4단계의 '통통 튀기' 출발점
    const bob = PART_STARTERS.find(s => s.id === 'bob');
    await cmd({ type: 'partGuess', id: 'p', layerId: 'draw-2' }); const g = await last('partGuess');
    await cmd({ type: 'motion', motion: { version: 1, speed: .5, strength: .5, parts: [{ id: 'p', layerId: 'draw-2', effect: bob.effect, amount: bob.amount, angle: bob.angle, speed: bob.speed, delay: 0, pivotX: g.x, pivotY: g.y }] } });
    await check('하트만 통통 튀기(부분)', 2);
    // ③ 윙크 애니메이션: 1장(눈 뜸) · 2장(복제) · 3장(윙크 — 콘 '신나' 얼굴로 바꿈)
    await cmd({ type: 'motion', motion: null });
    await cmd({ type: 'animStart', duration: .8 });
    await cmd({ type: 'frameDuration', index: 1, duration: .5 });
    await cmd({ type: 'frameAdd' });
    await cmd({ type: 'frameDuration', index: 2, duration: .2 });
    await cmd({ type: 'clear' });
    await page.evaluate(src => new Promise(res => { const i = new Image(); i.onload = () => { window.command({ type: 'importDrawing', data: src }); setTimeout(res, 300); }; i.src = src; }), png('nod'));
    const st = await last('state');
    assert.deepEqual(st.frames.map(f => f.duration), [.8, .5, .2], '장 시간 0.8 · 0.5 · 0.2');
    const anim = await check('윙크 애니메이션(3장)', 3);
    assert.ok(Math.abs(anim.loop - 1.5) < .01, '한 바퀴 = 장 시간 합 1.5초');
    assert.deepEqual(errors, [], errors.join(' | '));
    console.log('PASS: lesson corn — 강좌 11편 파일·무료 그룹·옛 캐릭터 문구 없음, 콘 예시 세 가지(통통 · 하트만 · 윙크 3장)가 앱 엔진에서 ≤24장 · 360×360 · ≤650KB · 잘림 없음');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
