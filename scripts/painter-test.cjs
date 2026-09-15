const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loader } = require('./load-ts.cjs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const { canvasHtml } = loader()('src/painter/canvas-html.ts');
(async () => {
  const watchdog = setTimeout(() => { console.error('FAIL: Canvas test timed out'); process.exit(1); }, 90000);
  watchdog.unref();
  const server = await chromium.launchServer({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  const browser = await chromium.connect(server.wsEndpoint());
  console.log('Canvas: browser ready');
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 600 } });
    const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
    await page.setContent(canvasHtml.replace('<script>', '<script>window.messages=[];window.ReactNativeWebView={postMessage:m=>window.messages.push(JSON.parse(m))};</script><script>'));
    const pixelDifference = (a,b) => page.evaluate(async pair => {
      const pixels=async src=>{const i=new Image();i.src=src;await i.decode();const c=document.createElement('canvas');c.width=c.height=360;c.getContext('2d').drawImage(i,0,0);return c.getContext('2d').getImageData(0,0,360,360).data;};
      const a=await pixels(pair[0]),b=await pixels(pair[1]);let changed=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])changed++;return changed;
    },[a,b]);
    const sameImage=async(a,b,label)=>assert.equal(await pixelDifference(a,b),0,label);
    const differentImage=async(a,b)=>assert.ok(await pixelDifference(a,b)>0);
    const cmd = m => page.evaluate(m => window.command(m), m);
    const saved = async () => { await cmd({ type: 'save' }); const result = await page.evaluate(() => window.messages.filter(m => m.type === 'save').at(-1)); await cmd({ type: 'saved' }); return result; };
    const line = async (x1=90,y1=100,x2=220,y2=200) => { await page.mouse.move(x1,y1); await page.mouse.down(); await page.mouse.move(x2,y2,{steps:15}); await page.mouse.up(); };
    const base = (id,name) => ({id,name,visible:true,opacity:1,x:0,y:0,scale:1,rotation:0});

    await cmd({ type: 'init' });
    console.log('Canvas: initialized');
    const ref = await page.evaluate(() => { const c=document.createElement('canvas');c.width=c.height=360;const g=c.getContext('2d');g.fillStyle='red';g.fillRect(0,0,360,360);return c.toDataURL(); });
    await cmd({ type: 'addReferences', references: [{...base('r1','참고 1'),path:'r1.png',data:ref}] });
    assert.equal((await saved()).metrics.coverage, 0, 'reference must not enter export');
    await cmd({ type: 'width', tool:'pen', width: 15 }); await line();
    const drawing = await saved(); assert.ok(drawing.metrics.coverage > 0); assert.equal(drawing.metrics.transparent, true);
    await cmd({ type: 'undo' }); assert.equal((await saved()).metrics.coverage, 0);
    await cmd({ type: 'redo' }); await sameImage((await saved()).data, drawing.data);
    await cmd({ type: 'tool', tool: 'eraser' }); await cmd({ type: 'width', tool:'eraser', width: 32 }); await line(); assert.ok((await saved()).metrics.coverage < drawing.metrics.coverage);
    await cmd({ type: 'undo' }); await sameImage((await saved()).data, drawing.data);
    await cmd({ type: 'clear' }); assert.equal((await saved()).metrics.coverage, 0);
    await cmd({ type: 'undo' }); await sameImage((await saved()).data, drawing.data);
    await cmd({ type: 'zoom', zoom: 2 }); assert.equal(await page.locator('#surface').evaluate(e=>e.getBoundingClientRect().width),780);
    await cmd({ type: 'init', layers:[{...base('draw-1','그림 1'),data:drawing.layers[0].data},{...base('draw-2','그림 2')}], references:[{...base('r1','참고 1'),path:'r1.png',data:ref}], activeLayerId:'draw-1' });
    await sameImage((await saved()).data,drawing.data,'reopen preserves exported pixels');
    await cmd({ type: 'analyze', id: 1, data: ref }); const analysis=await page.evaluate(()=>window.messages.find(m=>m.type==='analysis'));
    assert.equal(analysis.metrics.transparent,false); assert.equal(analysis.metrics.coverage,1);

    // Reference transform is independent from drawing layer and never enters final export.
    const beforeRefTransform = await saved();
    await cmd({type:'setActiveReference',id:'r1'});
    assert.equal(await page.evaluate(()=>window.messages.filter(m=>m.type==='state').at(-1).activeReferenceId),'r1');
    await cmd({type:'transform',id:'r1',x:55,y:-30,scale:.65,rotation:20,opacity:.35});
    await sameImage((await saved()).data,beforeRefTransform.data,'reference transform never enters final export');
    const refState=await page.evaluate(()=>window.messages.filter(m=>m.type==='state').at(-1).references[0]);
    assert.equal(refState.x,55);assert.equal(refState.y,-30);assert.equal(refState.scale,.65);

    // Toggle reference keeps draw selection independent.
    await cmd({type:'toggleReference',id:'r1'});
    assert.equal(await page.evaluate(()=>window.messages.filter(m=>m.type==='state').at(-1).activeReferenceId),null);
    await cmd({type:'toggleReference',id:'r1'});
    assert.equal(await page.evaluate(()=>window.messages.filter(m=>m.type==='state').at(-1).activeReferenceId),'r1');

    // Two independent drawing layers.
    await cmd({type:'select',id:'draw-2'});await cmd({type:'tool',tool:'pen'});await cmd({type:'color',color:'#548aca'});await cmd({type:'width',tool:'pen',width:8});
    assert.equal(await page.evaluate(()=>window.messages.filter(m=>m.type==='state').at(-1).activeLayerId),'draw-2');
    await line(230,80,290,170);
    const second=await saved();await sameImage(second.layers[0].data,drawing.layers[0].data);await differentImage(second.data,beforeRefTransform.data);
    await cmd({type:'transform',id:'draw-2',visible:false});await sameImage((await saved()).data,beforeRefTransform.data,'hidden drawing layer excluded');
    await cmd({type:'transform',id:'draw-2',visible:true,opacity:.6,scale:.8,rotation:15});
    const transformed=await saved();await sameImage(transformed.layers[0].data,drawing.layers[0].data);
    await cmd({type:'init',layers:transformed.layers,references:transformed.references.map(r=>({...r,data:ref})),activeLayerId:transformed.activeLayerId});
    const reopened=await saved();await sameImage(reopened.data,transformed.data,'layered reopen is pixel-exact');assert.deepEqual(reopened.references,transformed.references);
    for(let i=0;i<2;i++){await sameImage(reopened.layers[i].data,transformed.layers[i].data);const {data:a,...am}=reopened.layers[i],{data:b,...bm}=transformed.layers[i];assert.deepEqual(am,bm);}
    await cmd({type:'tool',tool:'eraser'});await cmd({type:'width',tool:'eraser',width:48});await line();
    await sameImage((await saved()).layers[0].data,drawing.layers[0].data,'eraser cannot change another layer');
    for(const brush of ['pen','brush','pencil']){await cmd({type:'tool',tool:'pen'});await cmd({type:'brush',brush});await line();}

    const png=Buffer.from(drawing.data.split(',')[1],'base64'); assert.equal(png.readUInt32BE(16),360);assert.equal(png.readUInt32BE(20),360);
    fs.mkdirSync('verification',{recursive:true});fs.writeFileSync('verification/painter-output.png',png);
    await cmd({type:'zoom',zoom:1});await page.screenshot({path:'verification/painter.png'});
    fs.mkdirSync('verification/states',{recursive:true});
    await cmd({ type: 'init' });
    await page.screenshot({path:'verification/states/canvas-empty.png'});
    const checker=await page.evaluate(()=>getComputedStyle(document.getElementById('surface')).backgroundImage);
    // 투명을 알리는 무늬일 뿐인데 예전에는 #eee 20px 로 그림보다 눈에 띄었다.
    assert.ok(checker.includes('rgb(241, 241, 243)'),'투명 무늬가 옅은 중립색이다: '+checker);
    assert.ok(!checker.includes('rgb(238, 238, 238)'),'예전의 진한 무늬(#eee)가 남아 있지 않다: '+checker);
    await line(120,150,240,210);
    await page.screenshot({path:'verification/states/canvas-scribble.png'});

    console.log('  상태 캡처: verification/states/canvas-empty.png, canvas-scribble.png');

    // ── 패널 크기가 바뀐 뒤의 좌표 ──────────────────────────────────────────────────────────
    // 저장되는 그림 그대로에서 센다. 화면 표시가 아니라 실제로 남는 픽셀이 기준이다.
    const inkIn = async (src,x,y,w,h) => page.evaluate(async arg => {
      const i = new Image(); i.src = arg.src; await i.decode();
      const c = document.createElement('canvas'); c.width = c.height = 360;
      c.getContext('2d').drawImage(i, 0, 0);
      const d = c.getContext('2d').getImageData(arg.x, arg.y, arg.w, arg.h).data;
      let n = 0; for (let k = 3; k < d.length; k += 4) if (d[k] !== 0) n++; return n;
    }, { src, x, y, w, h });
    const canvasPoint = async ([cx,cy]) => {
      const r = await page.evaluate(() => { const b = document.querySelector('canvas').getBoundingClientRect(); return { left: b.left, top: b.top, width: b.width, height: b.height }; });
      return [r.left + cx * r.width / 360, r.top + cy * r.height / 360];
    };
    for (const size of [{ width: 390, height: 600 }, { width: 390, height: 380 }, { width: 320, height: 720 }]) {
      await page.setViewportSize(size);
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      await cmd({ type: 'init' });
      const from = await canvasPoint([100,100]), to = await canvasPoint([260,260]);
      await page.mouse.move(from[0], from[1]); await page.mouse.down();
      await page.mouse.move(to[0], to[1], { steps: 12 }); await page.mouse.up();
      const shot = (await saved()).data;
      const onPath = await inkIn(shot, 150, 150, 60, 60), offPath = await inkIn(shot, 20, 280, 60, 60);
      assert.ok(onPath > 0, size.width + '×' + size.height + ': 짚은 자리에 그려진다 (' + onPath + 'px)');
      assert.equal(offPath, 0, size.width + '×' + size.height + ': 엉뚱한 자리에 그려지지 않는다');
    }
    await page.setViewportSize({ width: 390, height: 600 });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    console.log('  패널 높이가 바뀌어도 손가락 자리와 획 자리가 맞는다 (390×600 / 390×380 / 320×720)');

    // ── 종이 질감은 그리는 판에만 깔리고 작품에는 섞이지 않는다 ─────────────────────────────
    // 질감이 저장 파일이나 썸네일에 따라 들어가면 투명 배경 규격을 어기고, 사용자는 자기가 그리지
    // 않은 무늬를 제출하게 된다. 그래서 '보이는 판'과 '나가는 픽셀'을 갈라 확인한다.
    {
      await cmd({ type: 'paper', on: true });
      const surfaceHasPaper = await page.evaluate(() => document.getElementById('surface').classList.contains('paper'));
      assert.ok(surfaceHasPaper, '켜면 그리는 판에 종이 질감이 깔린다');
      const bg = await page.evaluate(() => getComputedStyle(document.getElementById('surface')).backgroundImage);
      assert.ok(bg.includes('radial-gradient'), '질감은 판의 배경으로만 있다: ' + bg.slice(0, 60));

      // 나가는 픽셀에는 질감이 없다. 앞 검사에서 그린 것을 지우고 빈 상태로 재어 본다.
      await cmd({ type: 'clear' });
      const clear = await page.evaluate(() => {
        const d = document.querySelector('canvas').getContext('2d').getImageData(0, 0, 360, 360).data;
        let opaque = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) opaque++;
        return opaque;
      });
      assert.equal(clear, 0, '질감을 켜도 작품 픽셀은 그대로 투명하다: ' + clear + 'px');

      // 저장 경로에도 질감이 따라가지 않는다. 화면의 판과 나가는 그림은 다른 것이다.
      await cmd({ type: 'paper', on: true });
      await cmd({ type: 'clear' });
      await page.evaluate(() => { window.messages.length = 0; });
      await cmd({ type: 'save' });
      await page.waitForTimeout(400);
      const saved = await page.evaluate(() => window.messages.filter(m => m.type === 'save').at(-1));
      const opaqueInSaved = await page.evaluate(async data => {
        const img = new Image(); img.src = data;
        await new Promise(r => { img.onload = r; });
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height).data;
        let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
        return n;
      }, saved.data);
      assert.equal(opaqueInSaved, 0, '질감을 켜고 저장해도 나가는 그림은 완전히 투명하다: ' + opaqueInSaved + 'px');
      assert.ok(saved.metrics.transparent, '저장 검사도 투명으로 읽는다');
      await cmd({ type: 'saved' });
      await cmd({ type: 'paper', on: false });
      await cmd({ type: 'paper', on: false });
      assert.ok(!(await page.evaluate(() => document.getElementById('surface').classList.contains('paper'))), '끄면 사라진다');
      console.log('  종이 질감: 판에만 깔리고 작품 픽셀 0px');
    }
    if(errors.length)console.log("PAGEERRORS",JSON.stringify(errors));
    assert.deepEqual(errors,[]);
    console.log('PASS: Canvas brushes/eraser/Undo/Redo/Clear; active-reference toggle/transform independent from draw layer; 2 drawing layers; reference-free PNG; layered save/reopen. Desktop Chromium; native multi-touch still requires device test.');
  } catch (error) { console.error(error.stack.split('\n').filter(line => /^\s+at /.test(line)).join('\n')); throw new Error('Canvas assertion failed: ' + error.operator); } finally {
    if (process.platform === 'win32') server.process().kill('SIGKILL');
    await server.kill(); await browser.close(); clearTimeout(watchdog);
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
