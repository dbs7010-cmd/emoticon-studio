// PRO 안내 화면의 비교 그림 세 장(2026-10-15)을 **앱의 실제 움직임 엔진**으로 만든다.
// 같은 그림(대표 캐릭터 콘: 몸 레이어 + 팔 레이어) 하나에 ① 무료 통통 ② PRO 부분(손 흔들기, 축은 앱의 추정값) ③ PRO 단계(등장→인사) 를 걸어 GIF 로 굽는다.
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/pro-clips.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { loader } = require('./load-ts.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { canvasHtml } = loader()('src/painter/canvas-html.ts');
const { PART_STARTERS, MOTION_COMBOS } = loader()('src/painter/motion-recipes.ts');
const OUT = path.join(__dirname, '..', 'assets', 'pro');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent(canvasHtml.replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>'));
    const cmd = m => page.evaluate(m => window.command(m), m);
    const last = type => page.evaluate(t => window.messages.filter(m => m.type === t).at(-1), type);
    // 2026-10-16: 대표 캐릭터 콘(손 흔들기)을 레이어 둘로 넣는다 — 몸(+왼손) / 오른팔. 원본: scripts/mascot-cutout.cjs(Codex 그림에서 오림)
    const png = name => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '..', 'assets', 'mascot', 'corn-' + name + '.png')).toString('base64');
    await cmd({ type: 'init', layers: [{ id: 'draw-1', name: '몸', data: png('wave-body') }, { id: 'draw-2', name: '팔', data: png('wave-arm') }], activeLayerId: 'draw-1' });
    await page.waitForTimeout(300);
    // 통통·쓱이 칸 밖으로 나가지 않게 그림 전체를 조금 줄인다(앱의 '칸 안에 맞추기'와 같은 명령).
    await cmd({ type: 'scaleAll', factor: .82 });

    await cmd({ type: 'partGuess', id: 'arm', layerId: 'draw-2' });
    const guess = await last('partGuess');
    assert.ok(guess.found, '팔 축 추정');
    const wave = PART_STARTERS.find(s => s.id === 'wave');
    const hello = MOTION_COMBOS.find(c => c.id === 'hello');
    const clips = {
      basic: { version: 1, preset: 'bounce', speed: .5, strength: .5 },
      part: { version: 1, speed: wave.speed, strength: .5, parts: [{ id: 'arm', layerId: 'draw-2', effect: wave.effect, amount: wave.amount, angle: wave.angle, speed: wave.speed, delay: 0, pivotX: guess.x, pivotY: guess.y }] },
      steps: { version: 1, speed: .5, strength: .5, steps: hello.steps.map((s, i) => ({ id: 'h' + i, ...s })) },
    };
    fs.mkdirSync(OUT, { recursive: true });
    let n = 0;
    for (const [name, motion] of Object.entries(clips)) {
      await cmd({ type: 'motion', motion });
      await cmd({ type: 'frames', id: ++n, fps: 12 });
      const { gif } = await last('frames');
      assert.equal(gif.clipped, false, name + ' 은 칸 안에서 움직인다');
      const bytes = Buffer.from(gif.data.split(',')[1], 'base64');
      fs.writeFileSync(path.join(OUT, name + '.gif'), bytes);
      console.log(name, gif.count + '장', (bytes.length / 1024).toFixed(0) + 'KB', '한 바퀴 ' + gif.loop + '초');
    }
    assert.deepEqual(errors, [], errors.join(' | '));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
