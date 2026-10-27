// 획이 길어질 때 한 번의 입력이 얼마나 걸리는지 잰다. **대체 렌더가 아니라 실제 엔진**이다.
// 재는 자리: pointermove 하나를 보내고 그 처리가 끝날 때까지의 시간.
// 획 전체를 다시 긋는 브러시(테두리 펜·평행선 펜)는 길이에 따라 비용이 늘 수 있어 따로 본다.
// **기기가 아니라 이 컴퓨터의 브라우저 값이다. 기기 성능 PASS 가 아니다.**
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { loader } = require('./load-ts.cjs');

const PORT = Number(process.argv[2] || 4780);
const OUT = process.argv[3] || 'verification/round45_31';
const { canvasHtml } = loader({})('src/painter/canvas-html.ts');

// 재는 대상: 획 전체를 다시 긋는 둘 + 견줄 기준 셋.
const KINDS = [
  ['pen', '기본 펜', null, '선분마다 그림'],
  ['marker2', '마커', 'marker2', 'dab 찍기'],
  ['spray', '스프레이', 'spray', 'dab 뿌리기(가장 많이 찍는 축)'],
  ['outline', '테두리 펜', 'outline', '획 전체 다시 긋기'],
  ['parallelpen', '평행선 펜', 'parallelpen', '획 전체 다시 긋기 ×3'],
];

const HOST = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>브러시 비용</title>
<style>html,body{margin:0;background:#14161A;color:#E7E9EE;font:13px/1.7 system-ui}
#log{padding:12px;white-space:pre-wrap}iframe{width:360px;height:420px;border:0;display:block;margin:0 12px}</style></head>
<body><div id="log">엔진을 띄우는 중…</div><iframe id="engine" src="engine.html"></iframe>
<script>
const log=document.getElementById('log'),engine=document.getElementById('engine');
const kinds=${JSON.stringify(KINDS)};
let waiting=null,token=0;
const post=m=>engine.contentWindow.command(m);
const wait=t=>new Promise(r=>{waiting={type:t,r};});
const rest=(ms=60)=>new Promise(r=>setTimeout(r,ms));
window.addEventListener('message',e=>{let m;try{m=JSON.parse(e.data);}catch{return;}
 if(waiting&&m.type===waiting.type){const r=waiting.r;waiting=null;r(m);}
 if(m.type==='ready')start();});
const dom=()=>engine.contentDocument;
function ev(type,p){const c=dom().getElementById('drawing'),r=c.getBoundingClientRect();
 c.dispatchEvent(new (dom().defaultView.PointerEvent)(type,{pointerId:1,pointerType:'pen',isPrimary:true,bubbles:true,cancelable:true,pressure:.5,
  clientX:r.left+p[0]*r.width,clientY:r.top+p[1]*r.height}));}
// 아주 긴 연속 획: 캔버스를 가로지르며 위아래로 흔들리는 400 점. 빠른 왕복도 함께 들어간다.
const N=400;
const long=[];for(let i=0;i<=N;i++){const t=i/N;long.push([.06+.88*t,.5+.34*Math.sin(t*Math.PI*9)]);}
async function start(){
 const out=[];
 for(const [key,name,preset,how] of kinds){
  await post({type:'init',id:'perf-'+key,color:'#17191D',penWidth:14,
   brush:{preset:preset,opacity:1,stabilizer:'light',smoothing:true},
   layers:[{id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0}]});
  await wait('initialized');
  await post({type:'brush',brush:'pen'});
  await post({type:'tool',tool:'pen'});
  await rest(50);
  const times=[];
  ev('pointerdown',long[0]);
  for(let i=1;i<=N;i++){const t0=performance.now();ev('pointermove',long[i]);times.push(performance.now()-t0);}
  ev('pointerup',long[N]);
  await rest(200);
  await post({type:'save',token:++token});
  const saved=await wait('save');
  post({type:'saved',token:saved.token});
  const sorted=[...times].sort((a,b)=>a-b);
  const at=q=>+sorted[Math.min(sorted.length-1,Math.floor(sorted.length*q))].toFixed(2);
  // 앞 50번과 뒤 50번을 견준다 — 획이 길어질수록 느려지는지가 핵심이다.
  const mean=a=>+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2);
  out.push({key,name,how,first50:mean(times.slice(0,50)),last50:mean(times.slice(-50)),median:at(.5),p95:at(.95),max:+Math.max(...times).toFixed(2),total:+times.reduce((x,y)=>x+y,0).toFixed(0)});
  log.textContent+='\\n'+name+' — 중앙 '+at(.5)+'ms · 앞50 '+mean(times.slice(0,50))+' → 뒤50 '+mean(times.slice(-50))+'ms';
 }
 await fetch('/result',{method:'POST',body:JSON.stringify(out)});
 log.textContent+='\\n끝났습니다.';
}
</script></body></html>`;

const SHIM = `<script>window.ReactNativeWebView = { postMessage: m => parent.postMessage(m, '*') };</script>`;
const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/result') {
    let body = ''; req.on('data', c => { body += c; });
    req.on('end', () => {
      const rows = JSON.parse(body);
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, 'brush-perf.json'), JSON.stringify(rows, null, 2));
      const pad = (t, n) => { let w = 0; for (const ch of String(t)) w += ch.charCodeAt(0) > 0x2000 ? 2 : 1; return String(t) + ' '.repeat(Math.max(1, n - w)); };
      console.log('  브러시        그리는 방식                    중앙   앞50   뒤50   p95    최대   400번 합');
      for (const r of rows) console.log('  ' + pad(r.name, 14) + pad(r.how, 30) + pad(r.median + 'ms', 7) + pad(r.first50 + 'ms', 7) + pad(r.last50 + 'ms', 7) + pad(r.p95 + 'ms', 7) + pad(r.max + 'ms', 7) + r.total + 'ms');
      res.end('ok'); setTimeout(() => process.exit(0), 300);
    });
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.url.startsWith('/engine') ? canvasHtml.replace('</head>', SHIM + '</head>') : HOST);
});
server.listen(PORT, () => console.log('http://localhost:' + PORT + '/ 를 열면 400번 입력을 보내 잰다'));
