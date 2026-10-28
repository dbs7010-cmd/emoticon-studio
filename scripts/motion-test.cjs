// Movement, in a real browser, ending in a real GIF that a decoder other than ours will open.
// Covers: the three free effects, PRO parts moving on their own, two poses taking turns,
// the loop joining back to its first frame, the words staying still, and non-destructiveness.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { canvasHtml } = loader()('src/painter/canvas-html.ts');
// Test-only windows into the engine, injected here so the app itself carries no test code.
const hooks = "window.__renderInto=(g,t)=>{layers.forEach(l=>composite(g,l,motion?deltaFor(l,t):null));drawCaption(g,motion&&motion.captionMoves?wholeDelta(t):null);};window.__renderLayer=(g,id,t)=>{const l=layers.find(x=>x.id===id);if(l)composite(g,l,motion?deltaFor(l,t):null);};window.__loop=()=>loopSeconds();window.__renderStill=(g)=>{layers.forEach(l=>composite(g,l,null));};";
const instrumented = canvasHtml.replace("window.addEventListener('resize',size);", hooks + "window.addEventListener('resize',size);");

const out = path.resolve('verification/motion');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const say = t => console.log('  ' + t);


// 우리가 만든 애니메이션 WebP 를 작성기가 아닌 쪽에서 다시 뜯어 본다. GIF 판독기와 같은 목적이다.
function readWebp(bytes) {
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'RIFF', 'RIFF 헤더');
  assert.equal(String.fromCharCode(...bytes.slice(8, 12)), 'WEBP', 'WEBP 형식');
  const size = bytes.readUInt32LE(4);
  assert.equal(size, bytes.length - 8, '파일 길이가 헤더와 맞는다');
  const chunks = [];
  let at = 12;
  while (at + 8 <= bytes.length) {
    const name = String.fromCharCode(...bytes.slice(at, at + 4));
    const len = bytes.readUInt32LE(at + 4);
    chunks.push({ name, at: at + 8, len });
    at += 8 + len + (len & 1);
  }
  assert.equal(at, bytes.length, '청크가 파일 끝에 딱 맞는다');
  const vp8x = chunks.find(c => c.name === 'VP8X');
  assert.ok(vp8x, 'VP8X 확장 헤더가 있다');
  const flags = bytes[vp8x.at];
  const width = 1 + (bytes[vp8x.at + 4] | (bytes[vp8x.at + 5] << 8) | (bytes[vp8x.at + 6] << 16));
  const height = 1 + (bytes[vp8x.at + 7] | (bytes[vp8x.at + 8] << 8) | (bytes[vp8x.at + 9] << 16));
  const anim = chunks.find(c => c.name === 'ANIM');
  assert.ok(anim, 'ANIM 청크가 있다');
  const loops = bytes[anim.at + 4] | (bytes[anim.at + 5] << 8);
  const frames = chunks.filter(c => c.name === 'ANMF').map(c => ({
    duration: bytes[c.at + 12] | (bytes[c.at + 13] << 8) | (bytes[c.at + 14] << 16),
    hasAlpha: (bytes[c.at + 15] & 2) === 2,
  }));
  return { width, height, loops, frames, animated: (flags & 2) === 2, alpha: (flags & 16) === 16 };
}
// A GIF reader that is not the writer: walks the blocks the way an unpacker does.
function readGif(bytes) {
  const u = new Uint8Array(bytes);
  assert.equal(String.fromCharCode(...u.slice(0, 6)), 'GIF89a', 'GIF89a header');
  const width = u[6] | (u[7] << 8), height = u[8] | (u[9] << 8);
  const flags = u[10], tableSize = 2 << (flags & 7);
  let at = 13 + (flags & 0x80 ? tableSize * 3 : 0);
  const frames = []; let loops = null, transparentIndex = null;
  while (at < u.length) {
    const marker = u[at];
    if (marker === 0x3B) break;
    if (marker === 0x21) {
      const label = u[at + 1];
      if (label === 0xF9) { transparentIndex = u[at + 6]; frames.push({ delay: u[at + 4] | (u[at + 5] << 8) }); at += 8; continue; }
      if (label === 0xFF) { const size = u[at + 2]; const name = String.fromCharCode(...u.slice(at + 3, at + 3 + size)); at += 3 + size; let sub = u[at]; if (name === 'NETSCAPE2.0') loops = u[at + 2] | (u[at + 3] << 8); while (sub) { at += sub + 1; sub = u[at]; } at += 1; continue; }
      at += 2; let sub = u[at]; while (sub) { at += sub + 1; sub = u[at]; } at += 1; continue;
    }
    if (marker === 0x2C) {
      at += 10; const local = u[at - 1];
      if (local & 0x80) at += (2 << (local & 7)) * 3;
      at += 1; let sub = u[at]; while (sub) { at += sub + 1; sub = u[at]; } at += 1; continue;
    }
    throw new Error('알 수 없는 GIF 블록: 0x' + marker.toString(16) + ' at ' + at);
  }
  return { width, height, frames, loops, transparentIndex };
}

(async () => {
  const watchdog = setTimeout(() => { console.error('FAIL: motion test timed out'); process.exit(1); }, 240000);
  watchdog.unref();
  const server = await chromium.launchServer({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const browser = await chromium.connect(server.wsEndpoint());
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setContent(instrumented.replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>'));
    await page.waitForFunction(() => window.messages.some(m => m.type === 'ready'));
    const cmd = m => page.evaluate(m => window.command(m), m);
    const state = () => page.evaluate(() => window.messages.filter(m => m.type === 'state').at(-1));
    const saved = async () => { await cmd({ type: 'save' }); const r = await page.evaluate(() => window.messages.filter(m => m.type === 'save').at(-1)); await cmd({ type: 'saved' }); return r; };
    const stroke = async points => {
      await page.mouse.move(points[0][0], points[0][1]); await page.mouse.down();
      for (const [x, y] of points.slice(1)) await page.mouse.move(x, y, { steps: 10 });
      await page.mouse.up();
    };
    // Pixels of one frame of the loop, straight out of the engine.
    const frameAt = t => page.evaluate(t => {
      const c = document.createElement('canvas'); c.width = c.height = 360;
      const g = c.getContext('2d');
      window.__renderInto(g, t);
      const d = g.getImageData(0, 0, 360, 360).data;
      let ink = 0, minX = 360, maxX = -1, minY = 360, maxY = -1;
      for (let y = 0; y < 360; y++) for (let x = 0; x < 360; x++) {
        if (d[(y * 360 + x) * 4 + 3] === 0) continue;
        ink++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      return { ink, minX, maxX, minY, maxY };
    }, t);

    const line = async (x1,y1,x2,y2) => { await page.mouse.move(x1,y1); await page.mouse.down(); await page.mouse.move(x2,y2,{steps:12}); await page.mouse.up(); };

    // ── 선택 영역: 실제 드래그로 고르고, 옮기고, 되돌린다 ───────────────────────────────────
    // Pixels are counted in two windows: where the piece started and where it is moved to.
    const inkIn = (x, y, w, h) => page.evaluate(([x, y, w, h]) => {
      const c = document.createElement('canvas'); c.width = c.height = 360;
      const g = c.getContext('2d');
      window.__renderInto(g, 0);
      const d = g.getImageData(x, y, w, h).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) n++;
      return n;
    }, [x, y, w, h]);
    const toPage = async ([x, y]) => {
      const rect = await page.evaluate(() => { const r = document.querySelector('canvas').getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; });
      return [rect.left + x * rect.width / 360, rect.top + y * rect.height / 360];
    };
    const drag = async (from, to) => {
      await page.mouse.move(from[0], from[1]); await page.mouse.down();
      await page.mouse.move(to[0], to[1], { steps: 12 }); await page.mouse.up();
    };

    await cmd({ type: 'init', color: '#242424', penWidth: 12, eraserWidth: 24 });
    await cmd({ type: 'tool', tool: 'pen' });
    await line(100, 110, 240, 110);                       // a bar near the top
    await line(100, 300, 240, 300);                       // another near the bottom
    const topBefore = await inkIn(80, 80, 200, 70), bottomBefore = await inkIn(80, 270, 200, 70);
    assert.ok(topBefore > 0 && bottomBefore > 0, 'two separate marks to work with');

    await cmd({ type: 'tool', tool: 'select' });
    await drag([80, 80], [280, 150]);                     // marquee around the top bar
    const picked = await page.evaluate(() => window.messages.filter(m => m.type === 'state').at(-1).selection);
    assert.ok(picked, 'dragging with the select tool picks a piece up');
    assert.equal(await inkIn(80, 80, 200, 70), 0, 'and the layer really has a hole where it was');

    await drag([180, 115], [180, 205]);                   // carry it down by 90
    const moved = await page.evaluate(() => window.messages.filter(m => m.type === 'state').at(-1).selection);
    assert.ok(Math.abs(moved.dy - 90) < 12, 'dragging inside the piece carries it: dy=' + moved.dy);
    // 시안 A3의 손잡이. 위쪽 손잡이를 돌리면 돌아가고, 모서리를 끌면 커진다. 손잡이 자체는 화면에만
    // 그려지고 저장되는 그림에는 남지 않아야 한다. 한 번에 하나씩 해야 다음 손잡이의 자리를 알 수 있다.
    {
      const before = await page.evaluate(() => window.messages.filter(m => m.type === 'state').at(-1).selection);
      const box = before.box, cx = box.x + box.w / 2 + before.dx, cy = box.y + box.h / 2 + before.dy;
      await drag(await toPage([cx, box.y + before.dy - 22]), await toPage([cx + 70, cy]));
      const turned = await page.evaluate(() => window.messages.filter(m => m.type === 'state').at(-1).selection);
      assert.ok(Math.abs(turned.rot) > 10, '위쪽 손잡이를 끌면 돌아간다: ' + turned.rot + '°');
      await cmd({ type: 'selectTransform', rot: -turned.rot });

      const corner = [box.x + box.w + before.dx, box.y + box.h + before.dy];
      await drag(await toPage(corner), await toPage([cx + (corner[0] - cx) * 1.6, cy + (corner[1] - cy) * 1.6]));
      const bigger = await page.evaluate(() => window.messages.filter(m => m.type === 'state').at(-1).selection);
      assert.ok(bigger.scale > before.scale * 1.3, '모서리 손잡이를 끌면 커진다: ' + before.scale + ' → ' + bigger.scale);

      // 손잡이와 점선은 화면 표시다. 저장되는 그림에는 들어가지 않는다.
      const drawn = await page.evaluate(() => {
        const c = document.createElement('canvas'); c.width = c.height = 360;
        window.__renderStill(c.getContext('2d'));
        const d = c.getContext('2d').getImageData(0, 0, 360, 360).data;
        let coral = 0, white = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] < 128) continue;
          if (d[i] > 240 && d[i + 1] > 110 && d[i + 1] < 140 && d[i + 2] > 70 && d[i + 2] < 100) coral++;
          if (d[i] === 255 && d[i + 1] === 255 && d[i + 2] === 255) white++;
        }
        return { coral, white };
      });
      assert.equal(drawn.coral, 0, '코랄 손잡이와 점선은 그림에 섞이지 않는다');
      assert.equal(drawn.white, 0, '흰 손잡이도 마찬가지다');
      await cmd({ type: 'selectTransform', scale: before.scale / bigger.scale });
      say('선택 손잡이: 회전 ' + turned.rot.toFixed(0) + '°, 모서리로 ' + before.scale.toFixed(2) + '→' + bigger.scale.toFixed(2) + '배, 출력에는 남지 않음');
    }
    await cmd({ type: 'selectTransform', scale: 1.1 });
    await cmd({ type: 'selectTransform', rot: 15 });
    await cmd({ type: 'selectTransform', flip: true });
    const shaped = await page.evaluate(() => window.messages.filter(m => m.type === 'state').at(-1).selection);
    assert.ok(shaped.scale > 1 && shaped.rot === 15 && shaped.flip === -1, 'it can be resized, turned and flipped');

    await cmd({ type: 'selectApply' });
    assert.equal(await page.evaluate(() => window.messages.filter(m => m.type === 'state').at(-1).selection), null, 'applying puts it down');
    assert.equal(await inkIn(80, 80, 200, 70), 0, 'the place it came from stays empty');
    assert.ok(await inkIn(60, 160, 260, 110) > 0, 'and it is where it was carried to');
    assert.ok(await inkIn(80, 270, 200, 70) > 0, 'the mark that was never selected is untouched');

    // Undo takes the whole move back in one step, including the lift.
    await cmd({ type: 'undo' }); await cmd({ type: 'undo' });
    assert.ok(await inkIn(80, 80, 200, 70) > 0, 'undo brings the piece back where it started');

    // Cancel is the same promise without saving: the drawing returns untouched.
    await cmd({ type: 'tool', tool: 'select' });
    await drag([80, 80], [280, 150]);
    await drag([180, 115], [180, 240]);
    await cmd({ type: 'selectCancel' });
    assert.ok(await inkIn(80, 80, 200, 70) > 0, 'cancelling restores the original exactly');

    // Splitting a piece onto its own layer is what PRO part movement needs.
    await cmd({ type: 'tool', tool: 'select' });
    await drag([80, 80], [280, 150]);
    const layersBefore = (await state()).layers.length;
    await cmd({ type: 'selectApply', toNewLayer: true });
    const after = await state();
    assert.equal(after.layers.length, layersBefore + 1, 'the piece can become its own drawing');
    assert.equal(await inkIn(80, 80, 200, 70) > 0, true, 'it still shows in the same place');
    const split = await page.evaluate(id => {
      const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d');
      window.__renderLayer(g, id, undefined);
      const d = g.getImageData(0, 0, 360, 360).data;
      let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) n++;
      return n;
    }, after.layers.at(-1).id);
    assert.ok(split > 0, 'and the new drawing is the piece, not an empty layer');
    say(`선택: 들어올리기·끌어 옮기기·크기·회전·반전·적용·취소·따로 분리 (새 그림 ${split}px)`);

    await cmd({ type: 'init', color: '#242424', penWidth: 14, eraserWidth: 24 });
    await cmd({ type: 'tool', tool: 'pen' });
    await stroke([[120, 150], [260, 150], [260, 280], [120, 280], [120, 150]]);
    await cmd({ type: 'addLayer', id: 'draw-2' }); await cmd({ type: 'select', id: 'draw-2' });   // 장은 더해야 생긴다
    await cmd({ type: 'color', color: '#E94F4F' });
    await stroke([[280, 120], [320, 160]]);                    // a second layer: the "hand"
    const still = await saved();
    assert.ok(still.metrics.coverage > 0, 'there is a drawing to move');
    say(`그림 준비: coverage ${(still.metrics.coverage * 100).toFixed(1)}%`);

    // ── 무료: 전체 움직임 3종 ────────────────────────────────────────────────────────────────
    for (const preset of ['bounce', 'shake', 'pulse']) {
      await cmd({ type: 'motion', motion: { version: 1, preset, speed: .5, strength: .6, captionMoves: false } });
      const s = await state();
      assert.equal(s.motion.preset, preset, preset + ' is set on the cut');
      assert.ok(s.loop > 0, 'and the loop has a length');
      const a = await frameAt(0), wrap = await frameAt(s.loop);
      const moved = [];for(const part of [8,4,3]) moved.push(await frameAt(s.loop / part));
      assert.deepEqual(wrap, a, preset + ': the loop ends exactly where it began — no seam');
      assert.ok(moved.some(f => JSON.stringify(f) !== JSON.stringify(a)), preset + ': and something actually moves in between');
      assert.equal(s.clipped, false, preset + ': nothing is pushed out of the picture');
      say(`${preset}: loop ${s.loop}s · 경계 이음새 없음 · 잘림 없음`);
    }

    // 그림을 고쳐도 움직임은 남는다.
    await cmd({ type: 'select', id: 'draw-1' });
    await stroke([[150, 320], [230, 320]]);
    const afterEdit = await state();
    assert.equal(afterEdit.motion.preset, 'pulse', 'editing the drawing keeps the movement');
    assert.ok((await saved()).metrics.coverage > still.metrics.coverage, 'and the edit really landed');
    say('그림 수정 후에도 움직임 유지');

    // ── PRO: 부분 움직임 ────────────────────────────────────────────────────────────────────
    const partMotion = {
      version: 1, preset: 'bounce', speed: .5, strength: .3, captionMoves: false, play: 'together',
      parts: [
        { id: 'p1', layerId: 'draw-2', effect: 'rotate', pivotX: .78, pivotY: .33, amount: 30, angle: 0, speed: .6, delay: 0 },
        { id: 'p2', layerId: 'draw-1', effect: 'move', pivotX: .5, pivotY: .5, amount: .02, angle: 90, speed: .3, delay: .1 },
      ],
    };
    await cmd({ type: 'motion', motion: partMotion });
    const pro = await state();
    assert.equal(pro.motion.parts.length, 2, 'two parts move on their own');
    const p0 = await frameAt(0), pw = await frameAt(pro.loop);
    assert.deepEqual(pw, p0, 'the loop with parts is seamless too');
    // The hand must move differently from the body: compare the two layers' own boxes over time.
    const handTravel = await page.evaluate(() => {
      const box = t => { const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d'); window.__renderLayer(g, 'draw-2', t); const d = g.getImageData(0, 0, 360, 360).data; let minY = 360, maxY = -1, minX = 360, maxX = -1; for (let y = 0; y < 360; y++) for (let x = 0; x < 360; x++) { if (d[(y * 360 + x) * 4 + 3] === 0) continue; if (y < minY) minY = y; if (y > maxY) maxY = y; if (x < minX) minX = x; if (x > maxX) maxX = x; } return { minY, maxY, minX, maxX }; };
      // 한 바퀴 안 여러 때를 본다 — 부분 움직임은 속도·지연이 따로라 1/4 바퀴에 제자리로 돌아와 있을 수도 있다.
      const a = box(0), seen = [1, 2, 3, 5, 6, 7].map(k => box(window.__loop() * k / 8));
      return { a, seen, moved: seen.some(b => a.minY !== b.minY || a.maxY !== b.maxY || a.minX !== b.minX || a.maxX !== b.maxX) };
    });
    assert.equal(handTravel.moved, true, 'the hand alone changes position during the loop');
    say('부분 움직임: 손만 회전, 몸은 별도 이동 — 각각 적용됨');

    // ── PRO: 두 모습 교대 ───────────────────────────────────────────────────────────────────
    await cmd({ type: 'motion', motion: { version: 1, speed: .5, strength: .5, captionMoves: false, alternate: { poseB: ['draw-2'], interval: .4 } } });
    const alt = await state();
    assert.equal(alt.loop, .8, 'two poses make a loop of exactly two intervals');
    const poseA = await frameAt(.1), poseB = await frameAt(.5);
    assert.notDeepEqual(poseA, poseB, 'the two poses really differ');
    assert.deepEqual(await frameAt(alt.loop + .1), poseA, 'and the pair repeats cleanly');
    say('두 모습 교대: loop 0.8s, 두 모습이 서로 다르고 반복이 매끈함');

    // ── 문구는 기본적으로 움직이지 않는다 ───────────────────────────────────────────────────
    await cmd({ type: 'caption', caption: { text: '고마워요', place: 'bottom', color: '#242424' } });
    await cmd({ type: 'motion', motion: { version: 1, preset: 'shake', speed: .8, strength: 1, captionMoves: false } });
    const capLoop = (await state()).loop;
    const bottomAt = t => page.evaluate(t => {
      const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d');
      window.__renderInto(g, t);
      const d = g.getImageData(0, 300, 360, 60).data;
      let minX = 360, maxX = -1;
      for (let y = 0; y < 60; y++) for (let x = 0; x < 360; x++) { if (d[(y * 360 + x) * 4 + 3] === 0) continue; if (x < minX) minX = x; if (x > maxX) maxX = x; }
      return { minX, maxX };
    }, t);
    assert.deepEqual(await bottomAt(capLoop / 4), await bottomAt(0), '문구는 흔들리지 않는다');
    await cmd({ type: 'motion', motion: { version: 1, preset: 'shake', speed: .8, strength: 1, captionMoves: true } });
    // 흔들기는 한 바퀴에 여러 번 오가서 1/4 바퀴에 마침 제자리일 수 있다 — 여러 때를 본다.
    { const at0 = JSON.stringify(await bottomAt(0)); let moved = false; for (const k of [1, 2, 3, 5, 6, 7]) if (JSON.stringify(await bottomAt(capLoop * k / 8)) !== at0) moved = true;
      assert.equal(moved, true, '켜면 문구도 함께 움직인다'); }
    await cmd({ type: 'motion', motion: { version: 1, preset: 'bounce', speed: .5, strength: .5, captionMoves: false } });

    // ── 어느 부분을 만지는 중인지 그림에서 보인다 ────────────────────────────────────────────
    // 사용자 평가: 부분 움직임에서 무엇을 고르고 있는지 그림에서 구별되지 않는다. 고른 부분에
    // 표시가 뜨되, 그 표시가 저장되는 그림에는 절대 남지 않아야 한다.
    {
      const clean = (await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 360; window.__renderStill(c.getContext('2d')); return c.toDataURL(); }));
      await cmd({ type: 'focusPart', layerId: 'draw-1' });
      const onScreen = await page.evaluate(() => {
        const g = document.querySelector('canvas').getContext('2d');
        const d = g.getImageData(0, 0, 360, 360).data;
        let coral = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100 && d[i] > 240 && d[i + 1] > 110 && d[i + 1] < 140) coral++;
        return coral;
      });
      const inFile = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 360; window.__renderStill(c.getContext('2d')); return c.toDataURL(); });
      assert.ok(onScreen > 0, '고른 부분에 표시가 뜬다: ' + onScreen + 'px');

      // 시안 A6 의 회전 궤적. 지금 만지는 부분이 어느 방향으로 얼마나 도는지 그림 위에 보여야 한다.
      // 테두리만 있을 때와 견줘 코랄 픽셀이 늘어나는 것으로 확인한다.
      const coralNow = () => page.evaluate(() => {
        const d = document.querySelector('canvas').getContext('2d').getImageData(0, 0, 360, 360).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 100 && d[i] > 240 && d[i + 1] > 110 && d[i + 1] < 140) n++;
        return n;
      });
      const motionBefore = await page.evaluate(() => window.messages.filter(m => m.type === 'state').at(-1).motion);
      const outlineOnly = await coralNow();
      await cmd({ type: 'motion', motion: { version: 1, speed: .5, strength: .5, parts: [{ id: 'trail', layerId: 'draw-1', effect: 'rotate', pivotX: .5, pivotY: .5, amount: 40, angle: 0, speed: .5, delay: 0 }] } });
      await cmd({ type: 'focusPart', layerId: 'draw-1' });
      const withArc = await coralNow();
      assert.ok(withArc > outlineOnly + 100, '회전 궤적이 실제로 더 그려진다: ' + outlineOnly + ' → ' + withArc + 'px');
      // 이동은 직선 화살표로 바뀐다.
      await cmd({ type: 'motion', motion: { version: 1, speed: .5, strength: .5, parts: [{ id: 'trail', layerId: 'draw-1', effect: 'move', pivotX: .5, pivotY: .5, amount: .08, angle: 0, speed: .5, delay: 0 }] } });
      const withArrow = await coralNow();
      assert.ok(withArrow > outlineOnly, '이동도 방향 표시가 그려진다: ' + withArrow + 'px');
      assert.notEqual(withArrow, withArc, '회전과 이동의 표시가 다르다');
      say('조작 표시: 테두리만 ' + outlineOnly + 'px · 회전 궤적 ' + withArc + 'px · 이동 화살표 ' + withArrow + 'px');
      // 검사 뒤에는 원래 움직임을 돌려놓는다. 다음 검사가 그 위에서 이어지기 때문이다.
      await cmd({ type: 'motion', motion: motionBefore });
      assert.equal(inFile, clean, '그 표시는 저장되는 그림을 바꾸지 않는다');
      await cmd({ type: 'focusPart', layerId: null });
      say('부분 표시: 화면에 ' + onScreen + 'px, 저장 그림은 그대로');
    }

    // ── 실제 GIF ────────────────────────────────────────────────────────────────────────────
    await cmd({ type: 'frames', fps: 12 });
    const result = await page.evaluate(() => window.messages.filter(m => m.type === 'frames').at(-1));
    assert.ok(result && result.gif && result.gif.data.startsWith('data:image/gif;base64,'), 'a GIF comes back');
    const gifBytes = Buffer.from(result.gif.data.split(',')[1], 'base64');
    fs.writeFileSync(path.join(out, 'loop.gif'), gifBytes);
    const read = readGif(gifBytes);
    assert.equal(read.width, 360); assert.equal(read.height, 360);
    assert.equal(read.frames.length, result.gif.count, 'every frame of the loop is in the file');
    assert.equal(read.loops, 0, 'and it loops forever');
    assert.equal(read.transparentIndex, 255, 'with a transparent background index');
    assert.ok(read.frames.every(f => f.delay === Math.round(100 / result.gif.fps)), 'each frame carries the same delay');
    const totalMs = read.frames.reduce((n, f) => n + f.delay * 10, 0);
    assert.ok(Math.abs(totalMs - result.gif.loop * 1000) <= 60, `the file lasts as long as the loop: ${totalMs}ms vs ${result.gif.loop * 1000}ms`);
    say(`GIF: ${read.width}×${read.height} · ${read.frames.length}프레임 · ${totalMs}ms · ${gifBytes.length}B · 투명 index ${read.transparentIndex}`);

    // ── 제출 형식(WebP) ────────────────────────────────────────────────────────────────────
    // 카카오는 움직이는 이모티콘을 WebP 로 받는다(제안 3개, 출시 24개). 만든 파일이 규격을 지키는지
    // 컨테이너를 직접 뜯어 보고, 브라우저가 실제로 그림으로 읽는지까지 확인한다.
    assert.ok(result.gif.webp, 'WebP 가 함께 만들어진다');
    const webpBytes = Buffer.from(result.gif.webp.split(',')[1], 'base64');
    fs.writeFileSync(path.join(out, 'loop.webp'), webpBytes);
    const web = readWebp(webpBytes);
    assert.equal(web.width, 360, '가로 360');
    assert.equal(web.height, 360, '세로 360');
    assert.ok(web.animated, '애니메이션 표시가 켜져 있다');
    assert.ok(web.alpha, '알파 표시가 켜져 있다');
    assert.equal(web.loops, 4, '공식 가이드대로 4회 반복');
    assert.equal(web.frames.length, result.gif.count, '프레임 수가 루프와 같다');
    assert.ok(web.frames.length <= 24, '24프레임 상한을 지킨다: ' + web.frames.length);
    assert.ok(web.frames.every(f => f.duration === result.gif.delayMs), '프레임마다 같은 시간');
    assert.ok(web.frames.every(f => f.hasAlpha), '프레임마다 알파가 실려 있다');
    assert.ok(webpBytes.length <= 650 * 1024, '650KB 상한을 지킨다: ' + webpBytes.length + 'B');
    // 브라우저가 읽어 주는지. 우리 판독기만으로는 '읽히는 파일'이라고 말할 수 없다.
    const shownWebp = await page.evaluate(async src => {
      const i = new Image(); i.src = src; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      c.getContext('2d').drawImage(i, 0, 0);
      const d = c.getContext('2d').getImageData(0, 0, i.width, i.height).data;
      let ink = 0, clear = 0;
      for (let k = 3; k < d.length; k += 4) { if (d[k] === 0) clear++; else ink++; }
      return { width: i.width, height: i.height, ink, clear };
    }, result.gif.webp);
    assert.equal(shownWebp.width, 360, '브라우저가 읽은 가로도 360');
    assert.ok(shownWebp.ink > 0, '브라우저가 그림을 읽는다: ' + shownWebp.ink + 'px');
    assert.ok(shownWebp.clear > 0, '그리고 배경이 투명하다: ' + shownWebp.clear + 'px');
    say(`WebP: ${web.width}×${web.height} · ${web.frames.length}프레임 · ${web.frames[0].duration}ms · 반복 ${web.loops}회 · ${Math.round(webpBytes.length / 1024)}KB · 브라우저 디코드 잉크 ${shownWebp.ink}px`);

    // The browser, not our reader, must be able to draw it.
    const decoded = await page.evaluate(async src => {
      const i = new Image(); i.src = src; await i.decode();
      const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
      c.getContext('2d').drawImage(i, 0, 0);
      const d = c.getContext('2d').getImageData(0, 0, i.width, i.height).data;
      let ink = 0, clear = 0;
      for (let k = 0; k < d.length; k += 4) { if (d[k + 3] === 0) clear++; else ink++; }
      return { width: i.width, height: i.height, ink, clear };
    }, result.gif.data);
    assert.equal(decoded.width, 360); assert.equal(decoded.height, 360);
    assert.ok(decoded.ink > 0, 'the decoded first frame has the drawing in it');
    assert.ok(decoded.clear > 0, 'and a transparent background survives the encode');
    say(`브라우저 디코드: 그림 ${decoded.ink}px · 투명 ${decoded.clear}px`);


    // ── 움직임은 그림을 건드리지 않는다 ─────────────────────────────────────────────────────
    const afterAll = await saved();
    assert.equal(afterAll.layers.length, 2, 'the layers are untouched by all of this');
    assert.deepEqual(afterAll.caption, { text: '고마워요', place: 'bottom', color: '#242424', style: 'basic' }, 'and so are the words');
    // Undo reaches movement like any other edit.
    await cmd({ type: 'undo' });
    assert.notEqual((await state()).motion && (await state()).motion.preset, 'bounce', 'undo takes the last movement change back');
    await cmd({ type: 'redo' });
    assert.equal((await state()).motion.preset, 'bounce', 'and redo puts it back');
    // Removing movement leaves the still cut exactly as it was.
    await cmd({ type: 'motion', motion: null });
    assert.equal((await state()).motion, null, 'movement can be taken off entirely');
    const stillAgain = await saved();
    assert.equal(stillAgain.layers.length, 2, 'and the still cut is still the still cut');
    say('움직임 적용·Undo·제거 모두 그림을 보존');

    // ── GIF가 실제로 위험한 지점들 ──────────────────────────────────────────────────────────
    // One sample proves the format parses. These are the cases that actually break emoticons:
    // hairline strokes disappearing, flat fills banding, words turning to mush, a part that moves
    // while the rest stands still, and a loop long enough to blow the file up.
    const buildCase = async (name, prepare, fps) => {
      await cmd({ type: 'init', layers: [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }, { id: 'draw-2', name: '그림 2', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }], references: [], activeLayerId: 'draw-1', caption: null, color: '#242424', penWidth: 6, eraserWidth: 24 });
      await prepare();
      await cmd({ type: 'frames', fps: fps || 12 });
      const built = (await page.evaluate(() => window.messages.filter(m => m.type === 'frames').at(-1))).gif;
      const bytes = Buffer.from(built.data.split(',')[1], 'base64');
      const read = readGif(bytes);
      fs.writeFileSync(path.join(out, name + '.gif'), bytes);
      // Decoded by the browser, not by our writer.
      const shown = await page.evaluate(async src => {
        const i = new Image(); i.src = src; await i.decode();
        const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
        c.getContext('2d').drawImage(i, 0, 0);
        const d = c.getContext('2d').getImageData(0, 0, i.width, i.height).data;
        const colours = new Set(); let ink = 0, clear = 0;
        for (let k = 0; k < d.length; k += 4) {
          if (d[k + 3] === 0) { clear++; continue; }
          ink++; colours.add((d[k] << 16) | (d[k + 1] << 8) | d[k + 2]);
        }
        return { ink, clear, colours: colours.size };
      }, built.data);
      // Pixel counts only say something survived. Shape, colour and clipping say whether it is still
      // the drawing: where the ink sits, whether the colours came back unshifted, and whether any of
      // it ran off the canvas.
      const detail = await page.evaluate(async src => {
        const i = new Image(); i.src = src; await i.decode();
        const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
        const g = c.getContext('2d'); g.drawImage(i, 0, 0);
        const d = g.getImageData(0, 0, i.width, i.height).data;
        const W = i.width, H = i.height;
        const columns = new Array(W).fill(0), rows = new Array(H).fill(0), tally = new Map();
        let left = W, right = -1, top = H, bottom = -1;
        const hex = n => '#' + n.toString(16).padStart(6, '0').toUpperCase();
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const k = (y * W + x) * 4;
          if (d[k + 3] === 0) continue;
          columns[x]++; rows[y]++;
          const rgb = (d[k] << 16) | (d[k + 1] << 8) | d[k + 2];
          tally.set(rgb, (tally.get(rgb) || 0) + 1);
          if (x < left) left = x; if (x > right) right = x;
          if (y < top) top = y; if (y > bottom) bottom = y;
        }
        // Runs of neighbouring columns that carry ink: one run per separate shape across the page.
        const runs = (list) => {
          const found = []; let start = -1;
          for (let n = 0; n < list.length; n++) {
            if (list[n] > 0 && start < 0) start = n;
            else if (list[n] === 0 && start >= 0) { found.push({ from: start, to: n - 1 }); start = -1; }
          }
          if (start >= 0) found.push({ from: start, to: list.length - 1 });
          return found;
        };
        return {
          W, H, box: { left, right, top, bottom },
          columnRuns: runs(columns), rowRuns: runs(rows),
          edge: { left: columns[0], right: columns[W - 1], top: rows[0], bottom: rows[H - 1] },
          top5: [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([rgb, n]) => ({ colour: hex(rgb), pixels: n })),
          colours: [...tally.keys()].map(hex),
        };
      }, built.data);
      return { built, read, shown, detail, bytes: bytes.length };
    };

    // 1. 얇은 선 — 1px 획이 프레임마다 사라지지 않아야 한다.
    const hair = await buildCase('risk-thin-lines', async () => {
      await cmd({ type: 'width', tool: 'pen', width: 1 });
      for (let i = 0; i < 6; i++) await stroke([[60 + i * 40, 60], [60 + i * 40, 300]]);
      await cmd({ type: 'motion', motion: { version: 1, preset: 'pulse', speed: .5, strength: .3, captionMoves: false } });
    });
    assert.ok(hair.shown.ink > 300, '1px 선이 GIF에서 살아남는다: ' + hair.shown.ink + 'px');
    // Ink left over is not the same as six strokes left over. The six drawn lines have to come back
    // as six separate columns of ink, each near where it was drawn, each still the pen's own colour.
    assert.equal(hair.detail.columnRuns.length, 6, '여섯 획이 여섯 덩어리로 그대로 돌아온다: ' + hair.detail.columnRuns.length + '덩어리');
    // The sampled frame is mid-pulse, so the whole drawing is scaled about its centre: what has to
    // hold is the spacing between the strokes, evenly, and each stroke still one stroke wide.
    const centres = hair.detail.columnRuns.map(r => (r.from + r.to) / 2);
    const gaps = centres.slice(1).map((c, i) => c - centres[i]);
    const zoom = gaps.reduce((n, g) => n + g, 0) / gaps.length / 40;
    assert.ok(Math.max(...gaps) - Math.min(...gaps) <= 2, '획 간격이 고르다: ' + gaps.join('/'));
    assert.ok(zoom > .85 && zoom < 1.2, '움직임 한 프레임의 확대율이 그럴듯하다: ' + zoom.toFixed(3));
    hair.detail.columnRuns.forEach((run, i) => {
      assert.ok(run.to - run.from <= 4, `${i + 1}번째 획이 뭉개져 굵어지지 않았다: ${run.to - run.from + 1}px`);
    });
    // A 1px stroke is an antialiased edge all the way through, so its colour arrives rounded by the
    // canvas itself. What must not happen is the palette moving it somewhere else: one level of
    // rounding is the drawing, eight would be the quantiser giving up on the pen colour.
    const levels = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const drift = hair.detail.top5.map(t => Math.max(...levels(t.colour).map(v => Math.abs(v - 0x24))));
    assert.ok(Math.min(...drift) <= 2, '펜 색이 팔레트에서 다른 색으로 옮겨가지 않았다: ' + hair.detail.top5.map(t => t.colour).join(' '));
    assert.deepEqual({ l: hair.detail.edge.left, r: hair.detail.edge.right, t: hair.detail.edge.top, b: hair.detail.edge.bottom }, { l: 0, r: 0, t: 0, b: 0 }, '어느 획도 캔버스 가장자리에서 잘리지 않았다');
    assert.equal(hair.read.frames.length, hair.built.count);
    say(`얇은 선(1px ×6): 획 ${hair.detail.columnRuns.length}개 · 간격 ${gaps.join('/')}px · 확대 ${zoom.toFixed(2)}× · 폭 ${hair.detail.columnRuns.map(r => r.to - r.from + 1).join('/')}px · 색 ${hair.detail.top5.map(t => t.colour).join(' ')} · 가장자리 잉크 0 · ${hair.read.frames.length}프레임 · ${hair.bytes}B`);

    // 2. 넓은 채색 — 평평한 면이 띠지거나 투명이 새지 않아야 한다.
    const filled = await buildCase('risk-flat-fill', async () => {
      await cmd({ type: 'width', tool: 'pen', width: 12 });
      await stroke([[90, 90], [270, 90], [270, 270], [90, 270], [90, 80], [140, 80]]);
      await cmd({ type: 'tool', tool: 'fill' });
      await cmd({ type: 'color', color: '#FFD15C' });
      await page.mouse.move(180, 180); await page.mouse.down(); await page.mouse.up();
      await cmd({ type: 'tool', tool: 'pen' });
      await cmd({ type: 'motion', motion: { version: 1, preset: 'bounce', speed: .4, strength: .4, captionMoves: false } });
    });
    assert.ok(filled.shown.ink > 20000, '채운 면이 통째로 들어간다: ' + filled.shown.ink + 'px');
    assert.ok(filled.shown.clear > 0, '그리고 바깥은 여전히 투명하다');
    assert.ok(filled.shown.colours <= 255, '색 수가 GIF 한계 안에 있다: ' + filled.shown.colours);
    assert.equal(filled.built.droppedColours, 0, '색을 버리지 않았다');
    // The fill has to come back as the colour that was poured, not a neighbour of it, and as one
    // block the width of the box — a banded or leaked fill would show up as several runs.
    const fill = filled.detail.top5.find(t => t.colour === '#FFD15C');
    assert.ok(fill && fill.pixels > 15000, '부은 색이 그 색 그대로 넓게 남아 있다: ' + JSON.stringify(filled.detail.top5.slice(0, 3)));
    assert.equal(filled.detail.columnRuns.length, 1, '칠한 면이 띠지지 않고 한 덩어리다: ' + filled.detail.columnRuns.length);
    assert.ok(filled.detail.box.left > 0 && filled.detail.box.right < 359 && filled.detail.box.top > 0 && filled.detail.box.bottom < 359, '움직여도 네 변 어디에도 닿지 않는다: ' + JSON.stringify(filled.detail.box));
    say(`넓은 채색: 부은 색 #FFD15C ${fill.pixels}px · 덩어리 ${filled.detail.columnRuns.length}개 · 테두리상자 ${JSON.stringify(filled.detail.box)} · 색 ${filled.shown.colours}개 · 버린 색 ${filled.built.droppedColours} · ${filled.bytes}B`);

    // 3. 문구 — 한글이 프레임마다 같은 자리에 또렷하게 남아야 한다.
    const worded = await buildCase('risk-caption', async () => {
      await cmd({ type: 'width', tool: 'pen', width: 10 });
      await stroke([[120, 120], [240, 120], [240, 240], [120, 240], [120, 120]]);
      await cmd({ type: 'caption', caption: { text: '고마워요 오늘도', place: 'bottom', color: '#E94F4F' } });
      await cmd({ type: 'motion', motion: { version: 1, preset: 'shake', speed: .6, strength: .5, captionMoves: false } });
    });
    const captionInk = await page.evaluate(async src => {
      const i = new Image(); i.src = src; await i.decode();
      const c = document.createElement('canvas'); c.width = c.height = 360;
      c.getContext('2d').drawImage(i, 0, 0);
      const d = c.getContext('2d').getImageData(0, 300, 360, 60).data;
      let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k] !== 0) n++;
      return n;
    }, worded.built.data);
    assert.ok(captionInk > 200, '문구가 GIF 아래쪽에 남아 있다: ' + captionInk + 'px');
    // "Ink at the bottom" would also be true of a smudge. 고마워요 오늘도 is seven letters with one
    // space, so the letters have to come back as separate blocks, in the colour they were typed, with
    // clear margins on both sides — that is what "not clipped, not mush" means for Korean text.
    const letters = await page.evaluate(async src => {
      const i = new Image(); i.src = src; await i.decode();
      const c = document.createElement('canvas'); c.width = c.height = 360;
      const g = c.getContext('2d'); g.drawImage(i, 0, 0);
      const d = g.getImageData(0, 290, 360, 70).data;
      const columns = new Array(360).fill(0), tally = new Map();
      for (let y = 0; y < 70; y++) for (let x = 0; x < 360; x++) {
        const k = (y * 360 + x) * 4;
        if (d[k + 3] < 128) continue;
        columns[x]++;
        const hex = '#' + (((d[k] << 16) | (d[k + 1] << 8) | d[k + 2]) >>> 0).toString(16).padStart(6, '0').toUpperCase();
        tally.set(hex, (tally.get(hex) || 0) + 1);
      }
      const blocks = []; let start = -1;
      for (let x = 0; x < 360; x++) {
        if (columns[x] > 0 && start < 0) start = x;
        else if (columns[x] === 0 && start >= 0) { blocks.push({ from: start, to: x - 1 }); start = -1; }
      }
      if (start >= 0) blocks.push({ from: start, to: 359 });
      return { blocks, top: [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([colour, pixels]) => ({ colour, pixels })) };
    }, worded.built.data);
    // 고마워요 오늘도 is two words with one space. Korean letters sit shoulder to shoulder, so the
    // space is the only gap there should be: one block means the words ran together, three or more
    // means letters broke apart. The two blocks also have to keep their 4:3 width, which is what
    // says the letters are still letters and not a smear.
    assert.equal(letters.blocks.length, 2, '띄어쓰기 하나만큼만 떨어져 있다: ' + letters.blocks.length + '덩어리 ' + JSON.stringify(letters.blocks));
    const widths = letters.blocks.map(b => b.to - b.from + 1);
    assert.ok(Math.abs(widths[0] / widths[1] - 4 / 3) < .3, '네 글자와 세 글자의 너비 비가 유지된다: ' + widths.join(':'));
    assert.ok(letters.blocks[1].from - letters.blocks[0].to >= 3, '두 낱말이 붙어버리지 않았다: ' + (letters.blocks[1].from - letters.blocks[0].to) + 'px');
    assert.equal(worded.detail.edge.bottom, 0, '문구가 아래 변에 닿아 잘리지 않았다');
    // The white outline the guide asks for is the biggest colour in the band, so both it and the
    // chosen text colour have to be there — the text colour exactly, not a neighbour of it.
    const textColour = letters.top.find(t => t.colour === '#E94F4F');
    assert.ok(textColour && textColour.pixels > 150, '고른 문구 색이 그 색 그대로 남아 있다: ' + JSON.stringify(letters.top));
    assert.ok(letters.top.some(t => t.colour === '#FFFFFF'), '흰색 아웃라인도 함께 남아 있다: ' + JSON.stringify(letters.top));
    assert.ok(letters.blocks[0].from > 4 && letters.blocks.at(-1).to < 355, '문구 양끝이 화면 밖으로 잘리지 않았다: ' + letters.blocks[0].from + '~' + letters.blocks.at(-1).to);
    say(`문구: 낱말 ${letters.blocks.length}덩어리 · 너비 ${letters.blocks.map(b => b.to - b.from + 1).join(':')}px · 좌우 여백 ${letters.blocks[0].from}px/${359 - letters.blocks.at(-1).to}px · 글자색 ${textColour.pixels}px/아웃라인 포함 ${letters.top.map(t => t.colour).join(' ')} · 아래쪽 잉크 ${captionInk}px · ${worded.read.frames.length}프레임 · ${worded.bytes}B`);

    // 4. 부분 움직임 — 한쪽만 움직이는 것이 파일에서도 사실이어야 한다.
    const parted = await buildCase('risk-part-motion', async () => {
      await cmd({ type: 'width', tool: 'pen', width: 12 });
      await stroke([[110, 200], [250, 200]]);
      await cmd({ type: 'select', id: 'draw-2' });
      await cmd({ type: 'color', color: '#54A9E8' });
      await stroke([[270, 120], [310, 160]]);
      await cmd({ type: 'motion', motion: { version: 1, speed: .5, strength: .5, captionMoves: false, parts: [{ id: 'p1', layerId: 'draw-2', effect: 'rotate', pivotX: .78, pivotY: .36, amount: 40, angle: 0, speed: .6, delay: 0 }] } });
    });
    // The two halves of the picture must differ across the loop in different ways.
    const half = (src, x, w) => page.evaluate(async ([src, x, w]) => {
      const i = new Image(); i.src = src; await i.decode();
      const c = document.createElement('canvas'); c.width = c.height = 360;
      c.getContext('2d').drawImage(i, 0, 0);
      const d = c.getContext('2d').getImageData(x, 0, w, 360).data;
      let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k] !== 0) n++;
      return n;
    }, [src, x, w]);
    assert.ok(await half(parted.built.data, 60, 200) > 0, '움직이지 않는 쪽이 그대로 있다');
    assert.ok(await half(parted.built.data, 240, 120) > 0, '움직이는 쪽도 들어 있다');
    say(`부분 움직임: 고정 ${await half(parted.built.data, 60, 200)}px · 움직임 ${await half(parted.built.data, 240, 120)}px · ${parted.bytes}B`);

    // 5. 긴 반복 — 느린 설정에서 프레임 수와 파일 크기가 감당 가능한가.
    const longLoop = await buildCase('risk-long-loop', async () => {
      await cmd({ type: 'width', tool: 'pen', width: 10 });
      await stroke([[100, 150], [260, 150], [260, 260], [100, 260], [100, 150]]);
      await cmd({ type: 'motion', motion: { version: 1, speed: 0, strength: .6, captionMoves: false, alternate: { poseB: ['draw-2'], interval: 1.2 } } });
    }, 24);
    assert.ok(longLoop.read.frames.length >= 24, '긴 반복이 프레임으로 다 들어간다: ' + longLoop.read.frames.length);
    const longMs = longLoop.read.frames.reduce((n, f) => n + f.delay * 10, 0);
    assert.ok(Math.abs(longMs - longLoop.built.loop * 1000) <= 80, `길이가 설정과 맞는다: ${longMs}ms vs ${longLoop.built.loop * 1000}ms`);
    assert.ok(longLoop.bytes < 3 * 1024 * 1024, '파일이 감당 못 할 만큼 커지지 않는다: ' + longLoop.bytes + 'B');
    say(`긴 반복: ${longLoop.read.frames.length}프레임 · ${longMs}ms · ${longLoop.bytes}B`);


    assert.deepEqual(errors, [], 'no page errors');
    say('문구: 기본은 고정, 켜면 함께 움직임');
    await cmd({ type: 'init' });  // 글자 끝을 재려면 그림이 없어야 한다. 이 검사만 빈 장면에서 돈다.
    // ── 문구 자유 배치: 옮기고 키우고 돌린 자리가 출력까지 그대로 간다 ─────────────────────────
    // 화면에서만 옮겨 놓고 저장 파일은 예전 자리로 나가면, 사용자는 만든 것과 다른 것을 제출하게 된다.
    // 그래서 '보이는 자리'가 아니라 '나가는 파일'에서 확인한다.
    {
      await cmd({ type: 'motion', motion: null });  // 움직임이 걸려 있으면 자리를 잴 수 없다
      await cmd({ type: 'caption', caption: { text: '고마워요', place: 'bottom', color: '#242424' } });
      await cmd({ type: 'captionPick', on: true });
      // 글자만 남기고 재어야 그림에 섞이지 않는다. 아래 띠에서 글자의 좌우 끝과 세로 위치를 본다.
      const band = () => page.evaluate(() => {
        const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d');
        window.__renderInto(g, 0);
        const d = g.getImageData(0, 0, 360, 360).data;
        let minX = 360, maxX = -1, minY = 360, maxY = -1;
        for (let y = 0; y < 360; y++) for (let x = 0; x < 360; x++) {
          if (d[(y * 360 + x) * 4 + 3] === 0) continue;
          if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
        return { minX, maxX, minY, maxY, w: maxX - minX, h: maxY - minY };
      });
      const start = await band();

      await cmd({ type: 'captionTransform', dx: -40, dy: -70 });
      const moved = await band();
      assert.ok(moved.minY < start.minY - 40, '문구를 위로 옮기면 실제로 위에서 그려진다: ' + start.minY + ' → ' + moved.minY);

      await cmd({ type: 'captionTransform', scale: 1.5 });
      const bigger = await band();
      assert.ok(bigger.w > moved.w + 8, '키우면 실제로 넓어진다: ' + moved.w + ' → ' + bigger.w);

      await cmd({ type: 'captionTransform', rot: 20 });
      const turned = await band();
      assert.ok(turned.h > bigger.h + 4, '돌리면 차지하는 높이가 달라진다: ' + bigger.h + ' → ' + turned.h);

      // 고르는 표시는 **작품에 섞이지 않는다.** 저장 경로가 만드는 그림에는 파란 테두리가 없어야 한다.
      const blues = await page.evaluate(() => {
        const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d');
        window.__renderInto(g, 0);
        const d = g.getImageData(0, 0, 360, 360).data;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 16 && d[i + 2] > 150 && d[i + 2] - d[i] > 60) n++;
        return n;
      });
      assert.equal(blues, 0, '고르는 표시(파랑)가 저장되는 그림에 섞이지 않는다: ' + blues + 'px');

      // 되돌리기 한 번이면 방금 돌린 것이 풀린다.
      await cmd({ type: 'undo' });
      const undone = await band();
      assert.ok(Math.abs(undone.h - bigger.h) <= 2, '되돌리기로 회전이 풀린다: ' + turned.h + ' → ' + undone.h);

      await cmd({ type: 'captionTransform', reset: true });
      await cmd({ type: 'captionPick', on: false });
      const back = await band();
      assert.ok(Math.abs(back.minY - start.minY) <= 2 && Math.abs(back.w - start.w) <= 2, '제자리로 되돌릴 수 있다');
      say(`문구 자유 배치: 위로 ${start.minY - moved.minY}px · 폭 ${moved.w}→${bigger.w}px · 회전 후 높이 ${bigger.h}→${turned.h}px · 표시 섞임 0px`);
    }

    console.log('PASS: 선택 영역 들어올리기·이동·크기·회전·반전·적용·취소·분리, 무료 전체 움직임 3종(이음새 없는 반복·잘림 없음), 그림 수정 후 움직임 유지, PRO 부분 회전·이동 동시 적용, 두 모습 교대, 문구 고정/동행, 실제 GIF 생성과 외부 판독(치수·프레임·시간·투명·무한반복), 움직임의 비파괴성. 얇은 선·채색·문구·부분 움직임·긴 반복은 남은 픽셀 수가 아니라 디코딩된 형태(획 수·간격·낱말 덩어리·너비 비)·색(고른 색 그대로인지)·잘림(네 변에 닿는지)으로 확인. 증거: verification/motion/');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (process.platform === 'win32') server.process().kill('SIGKILL');
    await server.kill(); await browser.close();
  }
})();
