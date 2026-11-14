// 그리기 지연을 잰다 — 실제 엔진(canvas-html)에 손가락 획을 실시간 간격으로 보낸다.
// 재는 것: ① 선 끝이 손가락보다 몇 ms 늦는지(보정 단계별, 빠르게 · 멈춘 뒤 · 천천히 떨면서) ①-2 떨림이 선에 얼마나 남는지(1 = 그대로)
//          ② pointermove 한 번 처리 시간 ③ 1초에 화면을 몇 번 다시 그리는지.
// CPU 를 느리게(기본 4배) 해 휴대폰에 가깝게 본다. **기기 값이 아니다 — 같은 조건 전후 비교용.**
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/draw-latency-bench.cjs [CPU배수] [입력Hz]
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { loader } = require('./load-ts.cjs');
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');

const SLOW = Number(process.argv[2] || 4), HZ = Number(process.argv[3] || 120);
const SHIM = `<script>window.ReactNativeWebView={postMessage:m=>window.__msgs.push(JSON.parse(m))};window.__msgs=[];</script>`;

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 400, height: 460 } });
  const cdp = await page.context().newCDPSession(page);
  await page.setContent(canvasHtml.replace('</head>', SHIM + '</head>'));
  await page.waitForFunction(() => window.__msgs.some(m => m.type === 'ready'));
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW });
  const rows = [];
  for (const level of ['off', 'light', 'medium', 'strong']) {
    const r = await page.evaluate(async ({ level, HZ }) => {
      window.__msgs = [];
      window.command({ type: 'init', id: 'bench-' + level, color: '#17191D', penWidth: 6,
        brush: { preset: null, opacity: 1, stabilizer: level === 'off' ? 'light' : level, smoothing: level !== 'off' },
        layers: [1, 2, 3].map(i => ({ id: 'draw-' + i, name: '그림 ' + i, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 })) });
      await new Promise(res => { const t = setInterval(() => { if (window.__msgs.some(m => m.type === 'initialized')) { clearInterval(t); res(); } }, 10); });
      window.command({ type: 'tool', tool: 'pen' });
      const c = document.getElementById('drawing'), box = c.getBoundingClientRect(), k = c.width / box.width;
      const ev = (type, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: box.left + x, clientY: box.top + y }));
      const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length), q = (a, p) => [...a].sort((x, y) => x - y)[Math.floor(a.length * p)] || 0;
      const rough = pts => mean(pts.slice(2).map((p, i) => Math.hypot(p.x - 2 * pts[i + 1].x + pts[i].x, p.y - 2 * pts[i + 1].y + pts[i].y)));
      // 손가락이 지름 200px 원을 T ms 에 한 바퀴 돈 뒤 0.4초 멈춘다. noise: 손떨림(화면 px, 고른 잡음).
      async function run(T, loops, noise) {
        const cx = box.width / 2, cy = box.height / 2, R = 100, at = t => { const a = t / T * 2 * Math.PI; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; };
        const r0 = window.__bench.renders();
        ev('pointerdown', ...at(0));
        const lag = [], cost = [], outPts = [], inPts = [], start = performance.now(); let still = null, settle = null, pos;
        await new Promise(res => {
          const tick = () => {
            const t = performance.now() - start;
            if (t < loops * T) pos = at(t); else if (still === null) still = performance.now();
            const shake = still === null ? [(Math.random() - .5) * 2 * noise, (Math.random() - .5) * 2 * noise] : [0, 0];
            const t0 = performance.now(); ev('pointermove', pos[0] + shake[0], pos[1] + shake[1]); cost.push(performance.now() - t0);
            const { steady: s, lastRaw: raw } = window.__bench.tip();
            if (s && raw) {
              const clean = { x: (box.left + pos[0] - box.left) * k, y: pos[1] * k };
              const d = Math.hypot(clean.x - s.x, clean.y - s.y) / k;
              if (t > 300 && still === null) { lag.push(d / (2 * Math.PI * R / T)); outPts.push(s); inPts.push(raw); }
              if (still !== null && settle === null && d < 1) settle = performance.now() - still;
            }
            if (still !== null && performance.now() - still > 400) return res();
            setTimeout(tick, 1000 / HZ);
          };
          tick();
        });
        ev('pointerup', ...pos);
        const secs = (performance.now() - start) / 1000;
        return { lag: +mean(lag).toFixed(1), settle: settle === null ? '>400' : Math.round(settle), smooth: +(rough(outPts) / Math.max(1e-6, rough(inPts))).toFixed(2), cost: +mean(cost).toFixed(2), p95: +q(cost, .95).toFixed(2), rps: Math.round((window.__bench.renders() - r0) / secs) };
      }
      const fast = await run(1200, 2, 0), slow = await run(4000, 1, 1.5);
      return { level, '빠름 지연ms': fast.lag, '멈춘뒤ms': fast.settle, '느림+떨림 지연ms': slow.lag, '떨림 남는비율': slow.smooth, '처리ms': fast.cost, 'p95ms': fast.p95, '다시그림/초': fast.rps };
    }, { level, HZ });
    rows.push(r);
  }
  console.log(`CPU ×${SLOW} · 입력 ${HZ}Hz 목표`);
  console.table(rows);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
