// 지우개 → 펜 전환이 실제로 먹히는지 **픽셀로** 확인한다. UI 선택값이 아니라 캔버스 결과를 본다.
// 사용자 증상: 지우개를 쓴 뒤 펜으로 바꾸면 UI 는 펜인데 새 획이 지워진다.
// 의심 경로: 자동저장이 도는 동안 엔진이 'tool' 명령을 통째로 버린다.
//   engine: if(saving && !['saved','saveFailed','analyze','save'].includes(m.type)) return;
// 쓰는 법: node scripts/_eraser-probe.cjs <포트> <나갈폴더>
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');

const PORT = Number(process.argv[2] || 4900);
const OUT = process.argv[3] || 'verification/round45_34/eraser';
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');

const HOST = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>지우개 전환 확인</title>
<style>html,body{margin:0;background:#14161A;color:#E7E9EE;font:13px/1.7 system-ui}
#log{padding:12px;white-space:pre-wrap}iframe{width:360px;height:420px;border:0;display:block;margin:0 12px}</style></head>
<body><div id="log">엔진을 띄우는 중…</div><iframe id="engine" src="engine.html"></iframe>
<script>
const log=document.getElementById('log'),engine=document.getElementById('engine');
let waiting=null,token=0,started=false;const inbox={};
const post=m=>engine.contentWindow.command(m);
const wait=t=>new Promise(r=>{if(inbox[t]){const m=inbox[t];delete inbox[t];r(m);return;}waiting={type:t,r};});
const tick=()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();c.port2.postMessage(0);});
const rest=async(ms=40)=>{const t0=performance.now();while(performance.now()-t0<ms)await tick();};
window.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
 if(waiting&&m.type===waiting.type){const r=waiting.r;waiting=null;r(m);}else inbox[m.type]=m;
 if(m.type==='ready')start();});
setTimeout(()=>{if(!started)start();},1500);
const dom=()=>engine.contentDocument;
function ev(type,p){const c=dom().getElementById('drawing'),r=c.getBoundingClientRect();
 c.dispatchEvent(new (dom().defaultView.PointerEvent)(type,{pointerId:1,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,pressure:.5,
  clientX:r.left+p[0]*r.width,clientY:r.top+p[1]*r.height}));}
function draw(pts){ev('pointerdown',pts[0]);for(const p of pts.slice(1))ev('pointermove',p);ev('pointerup',pts.at(-1));}
const line=(y)=>Array.from({length:21},(_,i)=>[.1+.8*i/20,y]);
// 캔버스에서 한 줄의 잉크량을 읽는다(0 = 아무것도 없음).
function inkAt(y){const c=dom().getElementById('drawing');const g=c.getContext('2d',{willReadFrequently:true});
 const py=Math.round(y*c.height),d=g.getImageData(Math.round(c.width*.12),Math.max(0,py-6),Math.round(c.width*.76),12).data;
 let n=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>40)n++;return n;}
async function fresh(id){
 await post({type:'init',id:id,color:'#17191D',penWidth:14,eraserWidth:26,
  brush:{preset:null,opacity:1,stabilizer:'light',smoothing:true},
  layers:[{id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0}]});
 await wait('initialized');
 await post({type:'tool',tool:'pen'});await post({type:'brush',brush:'pen'});
}
const results=[];let FULL=0;
function record(name,detail,ok){results.push({name,detail,ok});log.textContent+='\\n'+(ok?'통과  ':'실패  ')+name+' — '+detail;}

async function start(){
 if(started)return;started=true;

 // ① 기준: 평범하게 펜 → 지우개 → 펜. 자동저장 없음.
 await fresh('e1');
 draw(line(.30));await rest(120);
 await post({type:'tool',tool:'eraser'});draw(line(.30));await rest(120);
 await post({type:'tool',tool:'pen'});draw(line(.60));await rest(140);
 FULL=inkAt(.60);
 record('자동저장 없이 전환','지운 줄 '+inkAt(.30)+'px · 새 줄 '+FULL+'px',FULL>200);

 // ② 증상 재현: **자동저장이 도는 동안** 펜으로 바꾼다.
 //    앱은 획을 끝낼 때마다 조용히 저장한다. 그 사이 도구를 바꾸면 명령이 버려진다.
 await fresh('e2');
 draw(line(.30));await rest(120);
 await post({type:'tool',tool:'eraser'});draw(line(.30));await rest(120);
 await post({type:'save',token:++token});           // 자동저장 시작 → saving=true
 const saved=await wait('save');
 await post({type:'tool',tool:'pen'});              // ← 저장 중에 도구를 바꾼다
 await post({type:'saved',token:saved.token});      // 저장 끝
 await rest(60);
 draw(line(.60));await rest(140);                   // 펜으로 그렸다고 믿고 긋는다
 record('자동저장 중 전환','새 줄 '+inkAt(.60)+'px (0 이면 지워진 것)',inkAt(.60)>200);

 // ③ 저장이 끝난 **뒤** 바꾸면 되는가 — 원인이 저장 중 버림인지 가른다.
 await fresh('e3');
 draw(line(.30));await rest(120);
 await post({type:'tool',tool:'eraser'});draw(line(.30));await rest(120);
 await post({type:'save',token:++token});
 const s3=await wait('save');
 await post({type:'saved',token:s3.token});
 await post({type:'tool',tool:'pen'});              // ← 저장이 끝난 뒤
 await rest(60);
 draw(line(.60));await rest(140);
 record('자동저장 끝난 뒤 전환','새 줄 '+inkAt(.60)+'px',inkAt(.60)>200);

 // ④ 획 도중에 도구가 바뀌면 그 획이 반으로 갈리는가.
 await fresh('e4');
 const pts=line(.45);
 ev('pointerdown',pts[0]);
 for(const p of pts.slice(1,10))ev('pointermove',p);
 await post({type:'tool',tool:'eraser'});           // 획 한가운데에서 지우개로
 for(const p of pts.slice(10))ev('pointermove',p);
 ev('pointerup',pts.at(-1));
 await rest(140);
 record('획 도중 도구 변경','획 '+inkAt(.45)+'px / 온전한 획 '+FULL+'px',inkAt(.45)>FULL*0.95);

 // ⑤ 지우개가 활성 레이어만 지우는가.
 await post({type:'init',id:'e5',color:'#17191D',penWidth:14,eraserWidth:40,
  brush:{preset:null,opacity:1,stabilizer:'light',smoothing:true},
  layers:[{id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0},
          {id:'draw-2',name:'그림 2',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0}]});
 await wait('initialized');
 await post({type:'tool',tool:'pen'});await post({type:'brush',brush:'pen'});
 await post({type:'select',id:'draw-1'});draw(line(.35));await rest(120);
 await post({type:'select',id:'draw-2'});draw(line(.65));await rest(120);
 await post({type:'tool',tool:'eraser'});draw(line(.35));await rest(140);   // 아래 레이어 자리를 위 레이어에서 지운다
 record('지우개는 활성 레이어만','아래 레이어 줄 '+inkAt(.35)+'px (남아야 한다)',inkAt(.35)>200);

 await post({type:'save',token:++token});
 const fin=await wait('save');post({type:'saved',token:fin.token});
 await fetch('/save',{method:'POST',body:fin.data});
 await fetch('/done',{method:'POST',body:JSON.stringify(results)});
 log.textContent+='\\n끝났습니다.';
}
</script></body></html>`;

const SHIM = `<script>window.ReactNativeWebView = { postMessage: m => parent.postMessage(m, '*') };</script>`;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/save') {
    let b = ''; req.on('data', c => { b += c; });
    req.on('end', () => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'last.png'), Buffer.from(b.split(',')[1], 'base64')); res.end('ok'); });
    return;
  }
  if (req.method === 'POST' && req.url === '/done') {
    let b = ''; req.on('data', c => { b += c; });
    req.on('end', () => {
      const rows = JSON.parse(b); fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(rows, null, 2));
      for (const r of rows) console.log('  ' + (r.ok ? '통과' : '실패') + '  ' + r.name + ' — ' + r.detail);
      const bad = rows.filter(r => !r.ok).length;
      console.log('  ' + (rows.length - bad) + '/' + rows.length + ' 통과');
      res.end('ok'); setTimeout(() => process.exit(bad ? 1 : 0), 300);
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.url.startsWith('/engine') ? canvasHtml.replace('</head>', SHIM + '</head>') : HOST);
});
server.listen(PORT, () => console.log('http://localhost:' + PORT + '/ · 지우개 전환 5가지'));
