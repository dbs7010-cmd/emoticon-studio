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
    const line = async () => { await page.mouse.move(90,100); await page.mouse.down(); await page.mouse.move(220,200,{steps:15}); await page.mouse.up(); };
    await cmd({ type: 'init' });
    console.log('Canvas: initialized');
    const ref = await page.evaluate(() => { const c=document.createElement('canvas');c.width=c.height=360;const g=c.getContext('2d');g.fillStyle='red';g.fillRect(0,0,360,360);return c.toDataURL(); });
    await cmd({ type: 'reference', data: ref, visible: true, opacity: 1 });
    assert.equal((await saved()).metrics.coverage, 0, 'reference must not enter export');
    await cmd({ type: 'width', width: 15 }); await line();
    const drawing = await saved(); assert.ok(drawing.metrics.coverage > 0); assert.equal(drawing.metrics.transparent, true);
    await cmd({ type: 'reference', data: ref, visible: false, opacity: 1 }); await sameImage((await saved()).data, drawing.data);
    await cmd({ type: 'undo' }); assert.equal((await saved()).metrics.coverage, 0);
    await cmd({ type: 'redo' }); await sameImage((await saved()).data, drawing.data);
    await cmd({ type: 'tool', tool: 'eraser' }); await cmd({ type: 'width', width: 32 }); await line(); assert.ok((await saved()).metrics.coverage < drawing.metrics.coverage);
    await cmd({ type: 'undo' }); await sameImage((await saved()).data, drawing.data);
    await cmd({ type: 'clear' }); assert.equal((await saved()).metrics.coverage, 0);
    await cmd({ type: 'undo' }); await sameImage((await saved()).data, drawing.data);
    await cmd({ type: 'zoom', zoom: 2 }); assert.equal(await page.locator('#surface').evaluate(e=>e.getBoundingClientRect().width),780);
    await cmd({ type: 'init', drawing: drawing.data }); await sameImage((await saved()).data,drawing.data,'reopen preserves exported pixels');
    await cmd({ type: 'analyze', id: 1, data: ref }); const analysis=await page.evaluate(()=>window.messages.find(m=>m.type==='analysis'));
    assert.equal(analysis.metrics.transparent,false); assert.equal(analysis.metrics.coverage,1);
    // Two references / two independent drawing layers, transforms, export and reload.
    await cmd({type:'init'}); await cmd({type:'zoom',zoom:1}); await cmd({type:'tool',tool:'pen'});
    const base = (id,name) => ({id,name,visible:true,opacity:1,x:0,y:0,scale:1,rotation:0});
    const refs = [{...base('r1','Reference 1'),path:'r1.png',data:ref},{...base('r2','Reference 2'),path:'r2.png',data:ref,visible:false}];
    await cmd({type:'addReferences',references:refs});
    assert.equal((await saved()).metrics.coverage,0);
    await cmd({type:'select',id:'draw-1'});await cmd({type:'width',width:8});await line();
    const first=await saved();assert.equal(first.layers.length,2);assert.equal(first.references.length,2);
    await cmd({type:'select',id:'r1'});await cmd({type:'transform',visible:false});
    await cmd({type:'select',id:'r2'});await cmd({type:'transform',visible:true,x:40,y:-20,scale:.7,rotation:25,opacity:.4});
    await sameImage((await saved()).data,first.data,'reference transforms never enter final export');
    await cmd({type:'select',id:'draw-2'});await cmd({type:'color',color:'#548aca'});
    assert.equal(await page.evaluate(()=>window.messages.filter(m=>m.type==='state').at(-1).activeLayerId),'draw-2');
    await page.mouse.move(230,80);await page.mouse.down();await page.mouse.move(290,170,{steps:10});await page.mouse.up();
    const second=await saved();
    await sameImage(second.layers[0].data,first.layers[0].data);await differentImage(second.data,first.data);
    await cmd({type:'transform',visible:false});await sameImage((await saved()).data,first.data,'hidden drawing excluded');
    await cmd({type:'transform',visible:true});await cmd({type:'tool',tool:'move'});
    await page.mouse.move(230,80);await page.mouse.down();await page.mouse.move(255,100,{steps:4});await page.mouse.up();
    const moved=await saved();assert.notEqual(moved.layers[1].x,0);await differentImage(moved.data,second.data);await sameImage(moved.layers[1].data,second.layers[1].data,'move preserves original pixels');
    await cmd({type:'undo'});await sameImage((await saved()).data,second.data);await cmd({type:'redo'});
    await cmd({type:'transform',scale:.8,rotation:15,opacity:.6});
    const transformed=await saved();await sameImage(transformed.layers[0].data,first.layers[0].data);
    await cmd({type:'init',layers:transformed.layers,references:transformed.references.map(r=>({...r,data:ref})),activeLayerId:transformed.activeLayerId});
    const reopened=await saved();await sameImage(reopened.data,transformed.data,'layered reopen is pixel-exact');assert.deepEqual(reopened.references,transformed.references);for(let i=0;i<2;i++){await sameImage(reopened.layers[i].data,transformed.layers[i].data);const {data:a,...am}=reopened.layers[i],{data:b,...bm}=transformed.layers[i];assert.deepEqual(am,bm);};
    await cmd({type:'tool',tool:'eraser'});await cmd({type:'width',tool:'eraser',width:48});await line();
    await sameImage((await saved()).layers[0].data,first.layers[0].data,'eraser cannot change another layer');
    for(const brush of ['pen','marker','pencil']){await cmd({type:'tool',tool:'pen'});await cmd({type:'brush',brush});await line();}
    const png=Buffer.from(drawing.data.split(',')[1],'base64'); assert.equal(png.readUInt32BE(16),360);assert.equal(png.readUInt32BE(20),360);
    fs.mkdirSync('verification',{recursive:true});fs.writeFileSync('verification/painter-output.png',png);
    await cmd({type:'zoom',zoom:1});await page.screenshot({path:'verification/painter.png'});
    assert.deepEqual(errors,[]);
    console.log('PASS: Canvas brushes/eraser/Undo/Redo/Clear; 2 references on/off/transform; 2 independent drawing layers, move/opacity/scale/rotation; reference-free PNG; pixel-exact layered save/reopen. Desktop Chromium; not native WebView/device test.');
  } catch (error) { console.error(error.stack.split('\n').filter(line => /^\s+at /.test(line)).join('\n')); throw new Error('Canvas assertion failed: ' + error.operator); } finally {
    // Terminate only the browser process created above; avoid a hanging Windows taskkill shell.
    if (process.platform === 'win32') server.process().kill('SIGKILL');
    await server.kill(); await browser.close(); clearTimeout(watchdog);
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
