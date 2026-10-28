// Reproducible approved artwork: thumbnails retain 960x540, strokes use the actual painter engine.
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const ROOT = path.resolve(__dirname, '..');
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');
const data = file => 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, file)).toString('base64');
const topics = [
  ['first-set', 'APP BASICS', '내 캐릭터의\n첫 번째 세트', 'wave', '#F8F1DD'],
  ['brush-layer', 'DRAWING TOOLS', '나에게 맞는 선,\n차곡차곡 레이어', 'base', '#F0EDF7'],
  ['motion', 'MOTION CLASS', '작은 움직임,\n살아나는 표정', 'cheer', '#F0EDF7'],
  ['animation', 'FRAME ANIMATION', '한 장, 또 한 장\n내 손으로 움직임', 'nod', '#EDF2F1'],
  ['export', 'EXPORT GUIDE', '완성한 내 세트,\n파일로 꺼내기', 'wave', '#EDF2F1'],
  ['contest', 'CONTEST GUIDE', '나의 캐릭터로\n새로운 도전', 'cheer', '#F5EEF2'],
  ['character', 'CHARACTER DESIGN', '작지만 또렷한\n나만의 캐릭터', 'base', '#F8F1DD'],
  ['expressions', 'EXPRESSION CLASS', '마음을 전하는\n다양한 표정', 'heart', '#F8F1DD'],
  ['set-plan', 'SET PLANNING', '한 칸에서\n하나의 세트로', 'cheer', '#EEF2E9'],
  ['make-lesson', 'CREATOR GUIDE', '내가 아는 것을\n하나의 강좌로', 'base', '#F0EDF7'],
];
(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
    for (const [id, category, title, pose, bg] of topics) {
      await page.setContent('<div id="cover"><div id="words"><small></small><strong></strong></div><img alt=""></div>');
      await page.addStyleTag({ content: `body{margin:0;font-family:'Malgun Gothic',sans-serif}#cover{width:960px;height:540px;background:${bg};position:relative;overflow:hidden}#words{position:absolute;left:58px;top:119px;z-index:1;width:510px}small{display:block;font-size:21px;letter-spacing:2px;color:#887957;margin-bottom:32px}strong{display:block;font-size:61px;line-height:1.36;letter-spacing:-2px;white-space:pre-line;color:#29272e;font-weight:700}img{position:absolute;right:10px;bottom:0;width:465px;height:520px;object-fit:contain}` });
      await page.evaluate(({ category, title, src }) => { document.querySelector('small').textContent = category; document.querySelector('strong').textContent = title; document.querySelector('img').src = src; }, { category, title, src: data('assets/mascot/corn-' + pose + '.png') });
      await page.evaluate(() => document.querySelector('img').decode());
      await page.locator('#cover').screenshot({ path: path.join(ROOT, 'assets/lessons/thumbs', id + '.png') });
    }
    await page.setViewportSize({ width: 1170, height: 390 });
    for (const [id, pose, bg] of [['book', 'wave', '#FFF4CD'], ['contest', 'cheer', '#F0EDF7']]) {
      await page.setContent('<div id="banner"><img alt=""></div>');
      await page.addStyleTag({ content: `body{margin:0}#banner{position:relative;width:1170px;height:390px;background:${bg};overflow:hidden}img{position:absolute;right:65px;top:20px;width:340px;height:340px;object-fit:contain}` });
      await page.evaluate(src => { document.querySelector('img').src = src; }, data('assets/mascot/corn-' + pose + '.png'));
      await page.evaluate(() => document.querySelector('img').decode());
      await page.locator('#banner').screenshot({ path: path.join(ROOT, 'assets/notices', id + '.png') });
    }
    await page.setViewportSize({ width: 360, height: 420 });
    await page.setContent(canvasHtml.replace('<head>', '<head><script>window.__messages=[];window.ReactNativeWebView={postMessage:m=>window.__messages.push(JSON.parse(m))};</script>'));
    await page.waitForFunction(() => window.__messages?.some(m => m.type === 'ready'));
    for (const [key, width] of [['pen', 8], ['pencil2', 10], ['marker2', 18]]) {
      await page.evaluate(async ({ key, width }) => {
        window.__messages.length = 0;
        await window.command({ type: 'init', id: 'calm-' + key, layers: [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }], color: '#29272e', penWidth: width,
          brush: { preset: key === 'pen' ? null : key, opacity: 1, stabilizer: 'off', smoothing: true } });
      }, { key, width });
      await page.waitForFunction(() => window.__messages.some(m => m.type === 'initialized'));
      await page.evaluate(async () => {
        await window.command({ type: 'brush', brush: 'pen' });
        await window.command({ type: 'tool', tool: 'pen' });
        const c = document.getElementById('drawing'), r = c.getBoundingClientRect();
        const point = t => ({ x: .08 + .84 * t, y: .57 - .13 * t - .065 * Math.sin(t * Math.PI * 1.45) });
        const emit = (type, t) => { const p = point(t); c.dispatchEvent(new PointerEvent(type, { pointerId: 1, pointerType: 'pen', isPrimary: true, bubbles: true, cancelable: true,
          pressure: .18 + .62 * Math.pow(Math.sin(Math.PI * t), .7), clientX: r.left + p.x * r.width, clientY: r.top + p.y * r.height })); };
        emit('pointerdown', 0);
        for (let i = 1; i <= 72; i++) { emit('pointermove', i / 72); await new Promise(requestAnimationFrame); }
        emit('pointerup', 1);
      });
      await page.waitForTimeout(150);
      await page.evaluate(async () => { await window.command({ type: 'save', token: 1 }); });
      await page.waitForFunction(() => window.__messages.some(m => m.type === 'save'));
      const saved = await page.evaluate(() => window.__messages.findLast(m => m.type === 'save'));
      fs.writeFileSync(path.join(ROOT, 'verification/visual-direction-v24', 'engine-stroke-' + key + '.png'), Buffer.from(saved.data.split(',')[1], 'base64'));
      const preview = await page.evaluate(async data => {
        const image = new Image(); image.src = data; await image.decode();
        // Preserve the existing stroke slot (360x86), including transparent margins.
        const c = document.createElement('canvas'); c.width = 360; c.height = 86;
        c.getContext('2d').drawImage(image, 0, 135, 360, 100, 0, 0, 360, 86);
        return c.toDataURL('image/png');
      }, saved.data);
      fs.writeFileSync(path.join(ROOT, 'assets/art', 'stroke-' + key + '.png'), Buffer.from(preview.split(',')[1], 'base64'));
      await page.evaluate(async () => { await window.command({ type: 'saved', token: 1 }); });
      console.log('engine stroke', key);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
