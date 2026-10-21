// 30종을 **실제 엔진**으로 같은 조건에서 긋고 받아 온다. 꾸민 그림이 아니다.
// ACCEPTANCE.md 의 비교 조건을 그대로 쓴다: 점 · 짧은 획 · S곡선 · 급회전 · 원 · 겹치는 획 · 넓은 채색.
// window.command 는 약속으로 줄 세워 처리하므로 매번 기다린다.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');

const PORT = Number(process.argv[2] || 4760);
const OUT = process.argv[3] || 'verification/round45_31/strokes';
const SHAPE = process.argv[4] || 'curve';   // curve | dot | short | turn | circle | overlap | fill
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');

// 문서 ID → 엔진 ID. **문서 ID 를 엔진 ID 로 그대로 쓰지 않는다.**
const LIST = [
  ['F01', '기본 펜', 'free', { base: 'pen' }],
  ['F02', '자연 잉크', 'free', { preset: 'inknatural' }],
  ['F03', '테이퍼 펜', 'free', { preset: 'ink' }],
  ['F04', '붓펜', 'free', { preset: 'brushpen2' }],
  ['F05', '연필', 'free', { preset: 'pencil2' }],
  ['F06', '색연필', 'free', { preset: 'colorpencil' }],
  ['F07', '불투명 채색붓', 'free', { preset: 'opaque' }],
  ['F08', '마커', 'free', { preset: 'marker2' }],
  ['F09', '에어브러시', 'free', { preset: 'airbrush' }],
  ['F10', '납작 펜', 'free', { preset: 'flat' }],
  ['P01', '거친 잉크', 'pro', { preset: 'inkrough' }],
  ['P02', '드라이 잉크', 'pro', { preset: 'rough' }],
  ['P03', '붓결 잉크', 'pro', { preset: 'bristle' }],
  ['P04', '볼펜', 'pro', { preset: 'ballpen' }],
  ['P05', '크레용', 'pro', { preset: 'crayon' }],
  ['P06', '분필', 'pro', { preset: 'chalk' }],
  ['P07', '소프트 파스텔', 'pro', { preset: 'pastel' }],
  ['P08', '목탄', 'pro', { preset: 'charcoal' }],
  ['P09', '연필 옆면', 'pro', { preset: 'pencilside' }],
  ['P10', '입자 음영', 'pro', { preset: 'grainshade' }],
  ['P11', '점묘', 'pro', { preset: 'pointil' }],
  ['P12', '스프레이', 'pro', { preset: 'spray' }],
  ['P13', '드라이 평붓', 'pro', { preset: 'dryflat' }],
  ['P14', '워시', 'pro', { preset: 'wash' }],
  ['P15', '가장자리 수채', 'pro', { preset: 'wateredge' }],
  ['P16', '오일 파스텔', 'pro', { preset: 'oilpastel' }],
  ['P17', '테두리 펜', 'pro', { preset: 'outline' }],
  ['P18', '점선 펜', 'pro', { preset: 'dotted' }],
  ['P19', '평행선 펜', 'pro', { preset: 'parallelpen' }],
  ['P20', '발광 펜', 'pro', { preset: 'glowpen' }],
  // 호환용(30종에 세지 않는다): 예전 저장본이 쓰는 값이 그대로 사는지 함께 본다.
  ['L01', '예전 마커', 'legacy', { preset: 'marker' }],
  ['L02', '예전 붓펜', 'legacy', { preset: 'brushpen' }],
  ['L03', '부드러운 펜', 'legacy', { preset: 'soft' }],
  ['L04', '예전 붓', 'legacy', { base: 'brush' }],
  ['L05', '예전 연필', 'legacy', { base: 'pencil' }],
];
module.exports = { LIST };

const HOST = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>30종 획</title>
<style>html,body{margin:0;background:#14161A;color:#E7E9EE;font:13px/1.7 system-ui}
#log{padding:12px;white-space:pre-wrap}iframe{width:360px;height:420px;border:0;display:block;margin:0 12px}</style></head>
<body><div id="log">엔진을 띄우는 중…</div><iframe id="engine" src="engine.html"></iframe>
<script>
const log=document.getElementById('log'),engine=document.getElementById('engine');
const list=${JSON.stringify(LIST)};
const shape=${JSON.stringify(SHAPE)};
let token=0,waiting=null;
const post=m=>engine.contentWindow.command(m);       // 약속을 돌려준다 — 반드시 await
const wait=t=>new Promise(r=>{waiting={type:t,r};});
// 숨은 탭에서 setTimeout 은 1초로 늦춰진다(획마다 1초 = 한 종에 80초). 메시지 한 바퀴는 늦춰지지 않으므로
// 그걸로 시간을 센다. 하는 일은 같다 — 그 시간만큼 기다렸다가 다음 획으로 간다.
const tick=()=>new Promise(r=>{const c=new MessageChannel();c.port1.onmessage=()=>r();c.port2.postMessage(0);});
const rest=async(ms=60)=>{const t0=performance.now();while(performance.now()-t0<ms)await tick();};
window.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
 if(waiting&&m.type===waiting.type){const r=waiting.r;waiting=null;r(m);}
 if(m.type==='ready')start();});
const dom=()=>engine.contentDocument;
function ev(type,p,extra){const c=dom().getElementById('drawing'),r=c.getBoundingClientRect();
 c.dispatchEvent(new (dom().defaultView.PointerEvent)(type,{pointerId:1,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,pressure:.5,
  clientX:r.left+p[0]*r.width,clientY:r.top+p[1]*r.height,...extra}));}
function draw(pts){ev('pointerdown',pts[0]);for(const p of pts.slice(1))ev('pointermove',p);ev('pointerup',pts.at(-1));}
// ACCEPTANCE 의 입력 경로들
function path(kind){
 const c=[];
 if(kind==='curve'){for(let i=0;i<=40;i++){const t=i/40;c.push([[.08+.84*t,.5+.26*Math.sin(t*Math.PI*1.6-.5)]]);}return [c.map(x=>x[0])];}
 if(kind==='dot')return [[[.5,.5]]];
 if(kind==='short')return [[[.3,.5],[.42,.5],[.55,.5]]];
 if(kind==='turn'){const a=[];for(let i=0;i<=24;i++){const t=i/24;a.push([.15+.35*t,.3+.05*t]);}
  for(let i=1;i<=24;i++){const t=i/24;a.push([.5-.35*t,.35+.3*t]);}return [a];}
 if(kind==='circle'){const a=[];for(let i=0;i<=48;i++){const t=i/48*Math.PI*2;a.push([.5+.26*Math.cos(t),.5+.26*Math.sin(t)]);}return [a];}
 if(kind==='overlap'){const a=[],b=[];for(let i=0;i<=30;i++){const t=i/30;a.push([.15+.7*t,.36]);b.push([.15+.7*t,.5]);}
  const d=[];for(let i=0;i<=30;i++){const t=i/30;d.push([.35+.3*t,.2+.5*t]);}return [a,b,d];}
 if(kind==='fill'){const rows=[];for(let r=0;r<7;r++){const a=[];const y=.24+r*.07;
  for(let i=0;i<=24;i++){const t=i/24;a.push([r%2?.78-.56*t:.22+.56*t,y]);}rows.push(a);}return rows;}
 return [];
}
async function start(){
 for(const [id,name,tier,how] of list){
  await post({type:'init',id:'b-'+id,color:'#17191D',penWidth:14,
   brush:{preset:how.preset??null,opacity:1,stabilizer:'light',smoothing:true},
   layers:[{id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0}]});
  await wait('initialized');
  await post({type:'brush',brush:how.base??'pen'});
  await post({type:'tool',tool:'pen'});
  await rest(50);
  for(const pts of path(shape)){draw(pts);await rest(90);}
  await rest(160);
  await post({type:'save',token:++token});
  const saved=await wait('save');
  post({type:'saved',token:saved.token});
  await fetch('/save/'+id,{method:'POST',body:saved.data});
  log.textContent+='\\n'+id+' '+name+' — 덮인 넓이 '+Math.round((saved.metrics?.coverage??0)*1000)/10+'%';
 }
 await fetch('/done',{method:'POST'});
 log.textContent+='\\n끝났습니다.';
}
</script></body></html>`;

const SHIM = `<script>window.ReactNativeWebView = { postMessage: m => parent.postMessage(m, '*') };</script>`;
if (require.main === module) {
  let saved = 0;
  const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url.startsWith('/save/')) {
      const id = req.url.slice(6).replace(/[^A-Z0-9]/gi, '');
      let body = ''; req.on('data', c => { body += c; });
      req.on('end', () => { fs.mkdirSync(path.join(OUT, SHAPE), { recursive: true });
        fs.writeFileSync(path.join(OUT, SHAPE, id + '.png'), Buffer.from(body.split(',')[1], 'base64'));
        saved++; res.end('ok'); });
      return;
    }
    if (req.method === 'POST' && req.url === '/done') { res.end('ok'); console.log('  ' + saved + '장 → ' + path.join(OUT, SHAPE)); setTimeout(() => process.exit(0), 300); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(req.url.startsWith('/engine') ? canvasHtml.replace('</head>', SHIM + '</head>') : HOST);
  });
  server.listen(PORT, () => console.log('http://localhost:' + PORT + '/ · 경로 ' + SHAPE));
}
