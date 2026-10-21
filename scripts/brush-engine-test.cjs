// PRO 브러시 엔진 검사 — 실제 Chromium 캔버스에서 프리셋 차이·브러시 진하기·선 보정·필압 자리·회귀를 본다.
// WebView 안의 엔진만 본다. React Native 화면과 Android WebView 결과는 실기기 검수가 따로 확인한다.
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/brush-engine-test.cjs
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { loader } = require('./load-ts.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { canvasHtml } = loader()('src/painter/canvas-html.ts');

// 브러시 작업 이전 엔진(stash 'pre-r27-color snapshot'). 무료 펜/붓/연필이 픽셀 하나까지 같은지 비교하는 기준이다.
// 그 사이 바뀐 것은 색 처리뿐이고, 불투명 색에서는 같은 결과를 내야 한다.
function previousEngine() {
  const ref = process.env.BRUSH_BASELINE_REF || 'stash@{0}';
  const source = execFileSync('git', ['show', ref + ':src/painter/canvas-html.ts'], { encoding: 'utf8' });
  const body = source.replace(/^import[^\n]*\n/m, '').replace('export const canvasHtml =', 'return');
  return new Function('SPEC', body)({ width: 360, height: 360 });
}

(async () => {
  const watchdog = setTimeout(() => { console.error('FAIL: brush engine test timed out'); process.exit(1); }, 150000);
  watchdog.unref();
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const errors = [];
  const open = async html => {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    page.on('pageerror', e => errors.push(e.message));
    await page.setContent(html.replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>'));
    const cmd = m => page.evaluate(m => window.command(m), m);
    const last = type => page.evaluate(t => window.messages.filter(m => m.type === t).at(-1), type);
    const saved = async () => { await cmd({ type: 'save' }); const r = await last('save'); await cmd({ type: 'saved' }); return r; };
    // 같은 입력이면 같은 연필 입자가 나오도록 난수를 고정한다.
    const seed = () => page.evaluate(() => { let s = 12345; Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; });
    const drag = async (points, stepsEach = 1) => { await page.mouse.move(points[0][0], points[0][1]); await page.mouse.down(); for (const [x, y] of points.slice(1)) await page.mouse.move(x, y, { steps: stepsEach }); await page.mouse.up(); };
    const line = (y = 160, x1 = 60, x2 = 330) => drag([[x1, y], [x2, y]], 30);
    // 레이어 PNG 분석: 알파 통계, 세로 두께(열별), 열별 중심선 흔들림, 오른쪽 끝.
    const analyse = data => page.evaluate(async src => {
      const i = new Image(); i.src = src; await i.decode();
      const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
      const d = g.getImageData(0, 0, 360, 360).data;
      let count = 0, max = 0, partial = 0, maxX = 0;
      const thick = new Array(360).fill(0), ys = new Array(360).fill(0), ns = new Array(360).fill(0);
      for (let y = 0; y < 360; y++) for (let x = 0; x < 360; x++) {
        const a = d[(y * 360 + x) * 4 + 3];
        if (!a) continue;
        count++; max = Math.max(max, a); if (a > 20 && a < 200) partial++;
        if (a > 60) { thick[x]++; ys[x] += y; ns[x]++; maxX = Math.max(maxX, x); }
      }
      const centres = []; for (let x = 90; x <= 270; x++) if (ns[x]) centres.push(ys[x] / ns[x]);
      const mean = centres.reduce((s, v) => s + v, 0) / Math.max(1, centres.length);
      const rough = Math.sqrt(centres.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, centres.length));
      // 획 한가운데 띠에서 알파가 낮은(파인) 픽셀 비율 — 결 연필의 결.
      let core = 0, holes = 0;
      for (let x = 120; x <= 240; x++) for (let y = 145; y <= 151; y++) { const a = d[(y * 360 + x) * 4 + 3]; core++; if (a < 200) holes++; }
      return { count, max, partial, partialRatio: partial / Math.max(1, count), thickStart: thick[60], thickMid: thick[180], rough, maxX, holeRatio: holes / core };
    }, data);
    const diff = (a, b) => page.evaluate(async ([a, b]) => {
      const px = async src => { const i = new Image(); i.src = src; await i.decode(); const c = document.createElement('canvas'); c.width = c.height = 360; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, 360, 360).data; };
      const x = await px(a), y = await px(b); let n = 0; for (let k = 3; k < x.length; k += 4) if (Math.abs(x[k] - y[k]) > 8 || Math.abs(x[k - 1] - y[k - 1]) > 8) n++; return n;
    }, [a, b]);
    return { page, cmd, last, saved, seed, drag, line, analyse, diff };
  };

  try {
    const E = await open(canvasHtml);
    const fresh = async (settings, width = 20, color = '#3366AA') => {
      await E.cmd({ type: 'init' }); await E.cmd({ type: 'width', tool: 'pen', width }); await E.cmd({ type: 'color', color });
      await E.cmd({ type: 'brushSettings', ...settings }); await E.seed();
    };

    // ── A. 프리셋 네 가지가 같은 입력·굵기·색에서 서로 분명히 다르다 ──────────────────────────
    const shots = {};
    for (const preset of ['ink', 'soft', 'grain', 'marker']) {
      await fresh({ preset, opacity: 1, stabilizer: 'light', smoothing: true });
      await E.line();
      shots[preset] = (await E.saved()).layers[0].data;
    }
    const keys = Object.keys(shots), pairs = [];
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const n = await E.diff(shots[keys[i]], shots[keys[j]]); pairs.push(keys[i] + '/' + keys[j] + ' ' + n);
      assert.ok(n > 800, '프리셋 ' + keys[i] + ' 와 ' + keys[j] + ' 는 눈에 띄게 달라야 한다(다른 픽셀 ' + n + ')');
    }
    const S = {}; for (const k of keys) S[k] = await E.analyse(shots[k]);
    assert.equal(S.ink.max, 255, '매끈한 잉크: 불투명한 선');
    assert.ok(S.ink.thickStart < S.ink.thickMid, '매끈한 잉크: 시작이 가늘고 가운데가 굵다(' + S.ink.thickStart + ' < ' + S.ink.thickMid + ')');
    assert.ok(S.soft.partialRatio > S.ink.partialRatio * 2, '부드러운 펜: 반투명 가장자리가 잉크보다 넓다(' + S.soft.partialRatio.toFixed(3) + ' vs ' + S.ink.partialRatio.toFixed(3) + ')');
    assert.ok(S.grain.holeRatio > .05 && S.ink.holeRatio < .01, '결 연필: 선 안쪽에 결이 있다(' + S.grain.holeRatio.toFixed(3) + ')');
    assert.ok(Math.abs(S.marker.max - 140) <= 4, '마커: 한 획이 고르게 반투명(최대 알파 ' + S.marker.max + ')');
    assert.ok(S.marker.thickMid > S.ink.thickMid * 1.6, '마커: 넓다(' + S.marker.thickMid + ' vs ' + S.ink.thickMid + ')');

    // ── B. 브러시 진하기 · 색 투명도와의 결합 · 겹침 ─────────────────────────────────────────
    await fresh({ preset: 'ink', opacity: .5, stabilizer: 'light', smoothing: true }); await E.line();
    const half = await E.analyse((await E.saved()).layers[0].data);
    assert.ok(Math.abs(half.max - 128) <= 3, '진하기 50%: 최대 알파 128 근처(' + half.max + ')');
    await fresh({ preset: 'ink', opacity: .5, stabilizer: 'light', smoothing: true }, 20, '#3366AA80'); await E.line();
    const both = await E.analyse((await E.saved()).layers[0].data);
    assert.ok(Math.abs(both.max - 64) <= 3, '진하기 50% × 색 투명도 50%: 알파 64 근처(' + both.max + ')');
    await fresh({ preset: null, opacity: .5, stabilizer: 'light', smoothing: true }); await E.line();
    const freePenHalf = await E.analyse((await E.saved()).layers[0].data);
    assert.ok(Math.abs(freePenHalf.max - 128) <= 3, '기본 펜에도 PRO 진하기가 고르게 걸린다(' + freePenHalf.max + ')');
    // 한 획 안에서 되돌아 겹쳐도 진해지지 않고, 두 번째 획이 겹친 자리만 예측대로 진해진다(1-(0.5×0.5)=0.75 → 191).
    await fresh({ preset: 'ink', opacity: .5, stabilizer: 'light', smoothing: false });
    await E.drag([[60, 160], [330, 160], [80, 162]], 30);
    const self = await E.analyse((await E.saved()).layers[0].data);
    assert.ok(self.max <= 131, '한 획 안의 겹침은 진해지지 않는다(' + self.max + ')');
    await E.drag([[195, 60], [195, 300]], 30);
    const cross = await E.analyse((await E.saved()).layers[0].data);
    assert.ok(Math.abs(cross.max - 191) <= 4, '다른 획이 겹친 자리는 0.75 진하기(' + cross.max + ')');

    // ── C. 선 보정: 같은 흔들리는 입력에서 강하게 보정하면 덜 흔들리고, 선 끝을 잃지 않는다 ──────
    const noisy = []; for (let i = 0; i <= 60; i++) noisy.push([60 + i * 4.5, 160 + (i % 2 ? 7 : -7)]);
    const shake = async settings => { await fresh(settings, 6); await E.drag(noisy, 1); return E.analyse((await E.saved()).layers[0].data); };
    const off = await shake({ preset: null, opacity: 1, stabilizer: 'light', smoothing: false });
    const light = await shake({ preset: null, opacity: 1, stabilizer: 'light', smoothing: true });
    const strong = await shake({ preset: null, opacity: 1, stabilizer: 'strong', smoothing: true });
    assert.ok(strong.rough < off.rough * .5, '강 보정은 흔들림이 절반 아래(' + strong.rough.toFixed(2) + ' vs 끔 ' + off.rough.toFixed(2) + ')');
    assert.ok(strong.rough < light.rough, '강 보정이 약보다 덜 흔들린다(' + strong.rough.toFixed(2) + ' vs 약 ' + light.rough.toFixed(2) + ')');
    assert.ok(strong.maxX >= off.maxX - 4, '강 보정도 손을 뗀 곳까지 선이 닿는다(' + strong.maxX + ' vs ' + off.maxX + ')');

    // ── D. 되돌리기 한 번 · 손 떼기 전 저장 ───────────────────────────────────────────────
    await fresh({ preset: 'marker', opacity: 1, stabilizer: 'strong', smoothing: true }); await E.line();
    await E.cmd({ type: 'undo' });
    assert.equal((await E.saved()).metrics.coverage, 0, '프리셋 획도 되돌리기 한 번에 사라진다');
    await E.page.mouse.move(60, 100); await E.page.mouse.down(); await E.page.mouse.move(250, 120, { steps: 20 });
    const mid = await E.saved(); await E.page.mouse.up();
    const midS = await E.analyse(mid.layers[0].data);
    assert.ok(midS.count > 0 && midS.max <= 144, '손을 떼기 전 저장에도 마커 획이 들어간다(' + JSON.stringify({ count: midS.count, max: midS.max }) + ')');

    // ── E. 필압 자리: 지금은 반응이 없어야 한다(손가락·펜 결과 동일), 비정상 값에도 그린다 ─────
    const penStroke = async pressure => {
      await fresh({ preset: 'ink', opacity: 1, stabilizer: 'light', smoothing: false });
      await E.page.evaluate(p => {
        const c = document.getElementById('drawing'); c.setPointerCapture = () => {};
        const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 9, pointerType: 'pen', pressure: p, clientX: x, clientY: y, bubbles: true, cancelable: true }));
        ev('pointerdown', 60, 160); for (let i = 1; i <= 30; i++) ev('pointermove', 60 + i * 9, 160); ev('pointerup', 330, 160);
      }, pressure);
      return (await E.saved()).layers[0].data;
    };
    // 브라우저는 NaN 필압 이벤트를 만들지 않는다. 범위 밖 값(1.5)으로 비정상 입력을 대신한다.
    const p20 = await penStroke(.2), p100 = await penStroke(1), pBad = await penStroke(1.5), p0 = await penStroke(0);
    assert.equal(await E.diff(p20, p100), 0, '필압 0.2 와 1.0 이 지금은 같은 선(반응 미연결)');
    assert.equal(await E.diff(pBad, p100), 0, '범위 밖 필압(1.5)도 기본값으로 그린다');
    assert.equal(await E.diff(p0, p100), 0, '필압 0 도 기본값으로 그린다');

    // ── F. 회귀: 무료 펜/붓/연필(보정 약·기본 진하기)은 이전 엔진과 픽셀이 같다 ──────────────
    const O = await open(previousEngine());
    for (const brush of ['pen', 'brush', 'pencil']) {
      const run = async (X, withBrushCmd) => {
        await X.cmd({ type: 'init' }); await X.cmd({ type: 'width', tool: 'pen', width: 14 }); await X.cmd({ type: 'color', color: '#242424' }); await X.cmd({ type: 'brush', brush });
        if (withBrushCmd) await X.cmd({ type: 'brushSettings', preset: null, opacity: 1, stabilizer: 'light', smoothing: true });
        await X.seed(); await X.drag(noisy, 1);
        return (await X.saved()).layers[0].data;
      };
      const now = await run(E, true), before = await run(O, false);
      assert.equal(await E.diff(now, before), 0, '무료 ' + brush + ' 는 이전 엔진과 같은 픽셀');
    }
    // 지우개도 그대로.
    await E.cmd({ type: 'init' }); await O.cmd({ type: 'init' });

    assert.deepEqual(errors, [], '페이지 오류 없음');
    console.log('PASS: brush engine — 프리셋 4종 서로 다름(' + pairs.join(', ') + '), 잉크 시작 가늚·부드러운 가장자리 ' + S.soft.partialRatio.toFixed(2) + '·결 ' + S.grain.holeRatio.toFixed(2) + '·마커 알파 ' + S.marker.max + ', 진하기 50% 알파 ' + half.max + '·×색50% ' + both.max + '·겹침 ' + cross.max + ', 흔들림 끔 ' + off.rough.toFixed(2) + ' 약 ' + light.rough.toFixed(2) + ' 강 ' + strong.rough.toFixed(2) + '(끝 ' + strong.maxX + '/' + off.maxX + '), 되돌리기 1회·저장 중 획 보존, 필압 자리 무반응·비정상 값 안전, 무료 펜/붓/연필 이전 엔진과 픽셀 동일');
  } finally { await browser.close(); }
})().catch(e => { console.error('FAIL:', e && e.stack || e); process.exit(1); });
