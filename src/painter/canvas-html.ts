import { KAKAO_STATIC_SPEC as SPEC } from '../constants/kakao-spec';
import { MOTION_MATH_JS, LONG_MOTION_PRESETS, ENTRANCE_REST, ENTRANCE_EXIT } from '../motion-math';

// Local-only Painter engine. Reference images are preview layers and never enter final export.
export const canvasHtml = `<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>
*{box-sizing:border-box}body{margin:0;background:#F4F4F5;font-family:system-ui;overflow:hidden}#viewport{height:100vh;overflow:auto;touch-action:none;overscroll-behavior:none}#surface{position:relative;background-color:#FFFFFF;margin:auto}#surface.paper{background-color:#FFFFFF;background-image:radial-gradient(#00000006 1px,transparent 1px);background-size:9px 9px}canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
</style></head><body><div id="viewport"><div id="surface"><canvas id="drawing" width="${SPEC.width}" height="${SPEC.height}"></canvas></div></div><script>
(function(){
const canvas=document.getElementById('drawing'),surface=document.getElementById('surface'),viewport=document.getElementById('viewport'),ctx=canvas.getContext('2d',{willReadFrequently:true});
const W=canvas.width,H=canvas.height;
let tool='pen',brush='pen',color='#242424',penWidth=5,eraserWidth=20,zoom=1,active=false,last=null,pointer=null,history=[],future=[],dirty=false,loading=false,saving=false,layers=[],references=[],activeLayerId='draw-1',activeDrawLayerId='draw-1',activeReferenceId=null,strokePending=false,pendingFill=null,steady=null,caption=null,selection=null,marquee=null,dragging=null,grabbing=null,focusLayerId=null,pivotPick=null,pivotRole='pivot',motion=null,playing=false,playStart=0,rafId=null,smoothing=true,captionPicked=false,captionDrag=null,captionHandle=null,captionDismiss=false,probe=false;
const touches=new Map();let multi=null,suppressDraw=false;
// 저장 요청 번호. 화면이 보낸 번호를 그대로 돌려주고, 그 번호의 응답만 받는다 — 늦게 온 응답이 다음 저장을 끝내 버리지 않게.
let saveToken=null;
function send(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m));}
function bitmap(){const c=document.createElement('canvas');c.width=W;c.height=H;return c;}
function copyOf(b){const c=bitmap();c.getContext('2d').drawImage(b,0,0);return c;}
function meta(l){return {id:l.id,name:l.name,visible:l.visible,opacity:l.opacity,x:l.x,y:l.y,scale:l.scale,rotation:l.rotation};}
function trace(what,extra){if(!probe)return;send(Object.assign({type:'trace',t:Math.round(performance.now()),what:what,has:!!selection,dx:selection?Math.round(selection.dx):null,dy:selection?Math.round(selection.dy):null},extra||{}));}
function state(){syncFrame();send({type:'state',frames:frames?frames.map(f=>({id:f.id,duration:f.duration})):null,frameIdx,onion,undo:history.length>0,redo:future.length>0,dirty,smoothing,captionPicked,picking,preset,brushOpacity,stabilizer,activeHidden:!!(activeDraw()&&!activeDraw().visible),activeLayerId,activeReferenceId,caption,motion,pivotPick,pivotRole,selection:selection&&{box:selection.box,dx:selection.dx,dy:selection.dy,scale:selection.scale,rot:selection.rot,flip:selection.flip},loop:Number(loopSeconds().toFixed(3)),clipped:motionClips(),playing,layers:layers.map(meta),references:references.map(l=>({...meta(l),path:l.path}))});}
// The words live in the exported picture, not in a separate text tool: one system font, centred,
// shrunk until it fits, with a light outline so it stays readable over the drawing.
//
// 문구는 이제 자리를 스스로 가진다. place(위/아래)는 **처음 놓이는 자리**이고, 그 뒤 사용자가 손가락으로
// 옮기거나 키우거나 돌린 값이 dx·dy·scale·rot 에 쌓인다. 없으면 예전처럼 위/아래 가운데에 놓인다 —
// 그래서 예전에 저장한 작품이 그대로 열린다.
// 글씨 성격(45.6차): 기기에 이미 있는 글꼴만 쓴다 — 기본(고딕)·또박(명조)·도톰(더 굵고 테두리도 두껍게).
function capFace(){const s=caption&&caption.style;
 if(s==='serif')return {w:'700',f:'serif',o:.22,bold:0};
 // bold: 글자 획을 얼마나 덧댈지(글자 크기 대비). 기기에 900 굵기가 없어도 이 값 때문에 확실히 굵어진다.
 if(s==='thick')return {w:'800',f:'system-ui, sans-serif',o:.24,bold:.05};
 return {w:'700',f:'system-ui, sans-serif',o:.22,bold:0};}
function capFont(px){const c=capFace();return c.w+' '+px+'px '+c.f;}
// 덧대는 양은 글자 크기에 따라 조금 줄인다. 작은 글자는 획 사이 틈이 한두 픽셀뿐이라, 같은 비율로 덧대면 속이 막힌다(45.12차).
function capBold(px){const b=capFace().bold||0;return b?b*Math.min(1,Math.max(.8,px/28)):0;}
function captionSpot(g){
 if(!caption||!caption.text.trim())return null;
 const text=caption.text.trim(),room=W-32,face=capFace();
 // 글자가 실제로 덮는 자리는 획 + 흰 테두리다. 테두리는 절반씩 양쪽으로 나가므로 한 번 더해 준다.
 // 덧대는 양은 크기마다 다르므로(capBold) 재는 크기에서 그때그때 구한다 — 그려지는 값과 같은 값으로 잰다.
 const edge=p=>Math.max(3,p*(face.o+capBold(p)));
 let px=Math.round(H*.11),wide=0,shown=0;
 for(;px>10;px--){g.font=capFont(px);wide=g.measureText(text).width+px*capBold(px);shown=wide+edge(px);if(shown<=room)break;}
 if(shown>room){px=Math.max(1,Math.floor(px*room/shown));g.font=capFont(px);wide=g.measureText(text).width+px*capBold(px);}
 const x=W/2+(caption.dx||0),y=(caption.place==='top'?Math.round(H*.06):H-Math.round(H*.06))+(caption.dy||0);
 const scale=caption.scale||1,rot=caption.rot||0;
 // 글자 상자. 기준선이 위/아래로 갈리므로 상자의 세로 위치도 그에 맞춘다.
 const h=px*1.25,top=caption.place==='top'?y:y-h;
 return {text,px,wide,x,y,scale,rot,box:{x:x-wide/2,y:top,w:Math.max(8,wide),h}};
}
function drawCaption(g,d){
 const spot=captionSpot(g);
 if(!spot)return;
 g.save();
 if(d){g.translate(d.px+d.dx,d.py+d.dy);g.rotate(d.rot*Math.PI/180);g.scale(d.sx,d.sy);g.translate(-d.px,-d.py);}
 // 사용자가 준 크기·회전은 글자 한가운데를 축으로 건다. 그래야 돌려도 제자리에서 돈다.
 const cx=spot.x,cy=spot.box.y+spot.box.h/2;
 g.translate(cx,cy);g.rotate(spot.rot*Math.PI/180);g.scale(spot.scale,spot.scale);g.translate(-cx,-cy);
 g.textAlign='center';g.textBaseline=caption.place==='top'?'top':'bottom';
 const face=capFace(),bold=capBold(spot.px);
 g.font=capFont(spot.px);
 g.lineJoin='round';g.lineCap='round';
 // 흰 테두리는 굵어진 글자 바깥을 감싸도록 덧댄 만큼 함께 넓힌다.
 g.lineWidth=Math.max(3,spot.px*(face.o+bold));g.strokeStyle='#FFFFFF';g.strokeText(spot.text,spot.x,spot.y);
 g.fillStyle=css(caption.color||'#242424');
 if(bold){g.lineWidth=spot.px*bold;g.strokeStyle=css(caption.color||'#242424');g.strokeText(spot.text,spot.x,spot.y);}
 g.fillText(spot.text,spot.x,spot.y);
 g.restore();
}
// 문구를 고르고 있을 때 그 둘레에 그리는 표시. 그림 선택과 **다른 색**을 쓴다 — 지금 무엇을 만지고
// 있는지가 색 하나로 갈린다(그림은 코랄 계열 점선, 문구는 파랑 계열 실선).
function captionOutline(g){
 if(playing||!captionPicked)return;
 const spot=captionSpot(g);
 if(!spot)return;
 const cx=spot.x,cy=spot.box.y+spot.box.h/2;
 g.save();
 g.translate(cx,cy);g.rotate(spot.rot*Math.PI/180);g.scale(spot.scale,spot.scale);g.translate(-cx,-cy);
 // 40차: 앱 색 체계(짙은 중립 얇은 선 + 노랑 손잡이). 기하·판정은 그대로다. 파일에는 들어가지 않는다.
 g.strokeStyle='rgba(23,23,23,.62)';g.lineWidth=Math.max(1.25,cssToCanvas(1.25));g.setLineDash([]);
 g.strokeRect(spot.box.x-6,spot.box.y-4,spot.box.w+12,spot.box.h+8);
 g.restore();
 // 크기 손잡이는 하나(오른쪽 아래). 폰에서 손가락으로 잡을 수 있게 캔버스 배율과 관계없이 화면 기준 같은 크기로 그린다.
 const hp=handlePoint();
 if(hp){const r=cssToCanvas(11);g.save();g.fillStyle='#FFFFFF';g.beginPath();g.arc(hp.x,hp.y,r+2,0,Math.PI*2);g.fill();g.fillStyle='#FFD02F';g.beginPath();g.arc(hp.x,hp.y,r,0,Math.PI*2);g.fill();
  g.strokeStyle='#20242C';g.lineWidth=Math.max(1.5,r*.18);g.beginPath();g.moveTo(hp.x-r*.45,hp.y-r*.45);g.lineTo(hp.x+r*.45,hp.y+r*.45);g.moveTo(hp.x+r*.05,hp.y+r*.45);g.lineTo(hp.x+r*.45,hp.y+r*.45);g.lineTo(hp.x+r*.45,hp.y+r*.05);g.stroke();g.restore();}
}
// 화면 px 을 캔버스 px 로. 손가락이 닿는 넓이는 화면 기준이어야 확대·축소와 관계없이 같다.
function cssToCanvas(n){const r=canvas.getBoundingClientRect();return n*W/(r.width||W);}
// 한 점을 문구 자신의 좌표계(돌리고 키우기 전)로 되돌린다.
function captionLocal(p){const spot=captionSpot(ctx);if(!spot)return null;const cx=spot.x,cy=spot.box.y+spot.box.h/2,a=-spot.rot*Math.PI/180,sc=spot.scale||1,dx=p.x-cx,dy=p.y-cy;return {spot,lx:(dx*Math.cos(a)-dy*Math.sin(a))/sc+cx,ly:(dx*Math.sin(a)+dy*Math.cos(a))/sc+cy};}
function onCaption(p){const c=captionLocal(p);if(!c)return false;const b=c.spot.box,pad=Math.max(14,cssToCanvas(12)/(c.spot.scale||1));return c.lx>=b.x-pad&&c.lx<=b.x+b.w+pad&&c.ly>=b.y-pad&&c.ly<=b.y+b.h+pad;}
// 손잡이는 오른쪽 아래가 기본이다. 글씨가 커져 그 모서리가 캔버스 밖으로 나가면 안쪽에 남은 모서리로 옮긴다 — 가장자리에 둔 큰 글씨도 잡을 수 있다.
function handlePoint(){const spot=captionSpot(ctx);if(!spot)return null;const cx=spot.x,cy=spot.box.y+spot.box.h/2,sc=spot.scale||1,a=spot.rot*Math.PI/180,m=cssToCanvas(14);
 const corners=[[spot.box.x+spot.box.w+6,spot.box.y+spot.box.h+4],[spot.box.x+spot.box.w+6,spot.box.y-4],[spot.box.x-6,spot.box.y+spot.box.h+4],[spot.box.x-6,spot.box.y-4]].map(([px,py])=>{const hx=(px-cx)*sc,hy=(py-cy)*sc;return {x:cx+hx*Math.cos(a)-hy*Math.sin(a),y:cy+hx*Math.sin(a)+hy*Math.cos(a),cx,cy};});
 return corners.find(c=>c.x>=m&&c.x<=W-m&&c.y>=m&&c.y<=H-m)||corners[0];}
function onCaptionHandle(p){const h=handlePoint();return !!h&&Math.hypot(p.x-h.x,p.y-h.y)<=cssToCanvas(26);}
// 글자 한가운데가 캔버스 안에 남도록만 막는다. 가장자리까지는 자유롭게 가고, 가운데로 끌어오지 않는다.
function clampCaption(){const spot=captionSpot(ctx);if(!spot)return;const cy=spot.box.y+spot.box.h/2;
 if(spot.x<0)caption.dx=(caption.dx||0)-spot.x;else if(spot.x>W)caption.dx=(caption.dx||0)-(spot.x-W);
 if(cy<0)caption.dy=(caption.dy||0)-cy;else if(cy>H)caption.dy=(caption.dy||0)-(cy-H);}
function stale(m){return saveToken!==null&&m.token!==undefined&&m.token!==saveToken;}
function defaults(id,name){return {id,name,visible:true,opacity:1,x:0,y:0,scale:1,rotation:0};}
// 지금 있는 장과 겹치지 않는 가장 작은 번호. 이미 겹친 옛 저장본을 열어도 그 id 들을 모두 피한다.
function nextLayerId(){let n=1;while(layers.some(l=>l.id==='draw-'+n))n++;return 'draw-'+n;}
function layerName(id){const n=String(id).slice(5);return '그림 '+(String(id).indexOf('draw-')===0&&n&&Number(n)>0?n:layers.length+1);}
function activeDraw(){return layers.find(l=>l.id===activeDrawLayerId)||layers[0];}
function activeReference(){return references.find(l=>l.id===activeReferenceId&&l.visible);}
function selectDrawLayer(id){const target=layers.find(l=>l.id===id)||layers[0];if(target){activeLayerId=target.id;activeDrawLayerId=target.id;}}
function snapshot(){return {layers:layers.map(l=>({...meta(l),pixels:l.bitmap.getContext('2d').getImageData(0,0,W,H)})),references:references.map(l=>({...l})),activeLayerId,activeDrawLayerId,activeReferenceId,caption:caption&&{...caption},motion:motion&&JSON.parse(JSON.stringify(motion)),selection:selection&&{...selection,bitmap:copyOf(selection.bitmap)}};}
function restore(s){trace('restore:before');extentCache=null;layers=s.layers.map(l=>{const b=bitmap();b.getContext('2d').putImageData(l.pixels,0,0);return {...meta(l),bitmap:b};});references=s.references;activeLayerId=s.activeLayerId;activeDrawLayerId=s.activeDrawLayerId||layers[0]?.id||'';activeReferenceId=s.activeReferenceId||null;caption=s.caption||null;motion=s.motion||null;selection=s.selection||null;render();state();trace('restore:after');}
function checkpoint(preserveFuture=false){history.push(snapshot());if(history.length>40)history.shift();if(!preserveFuture)future=[];dirty=true;}
function composite(g,l,d){if(!l.visible||(d&&d.hidden))return;g.save();g.globalAlpha=l.opacity;if(d){g.translate(d.px+d.dx,d.py+d.dy);g.rotate(d.rot*Math.PI/180);g.scale(d.sx,d.sy);g.translate(-d.px,-d.py);if(d.part){const q=d.part;g.translate(q.px+q.dx,q.py+q.dy);g.rotate(q.rot*Math.PI/180);g.scale(q.sx,q.sy);g.translate(-q.px,-q.py);}}g.translate(W/2+l.x,H/2+l.y);g.rotate(l.rotation*Math.PI/180);g.scale(l.scale,l.scale);g.drawImage(d&&d.boilK!=null?boiled(l,d.boilK):l.bitmap,-W/2,-H/2);g.restore();}
// ── 손그림 떨림(boil, 2026-10-14) ──────────────────────────────────────────────────────────────
// 그림을 고치지 않는다. 장마다 세 가지 '살짝 비튼 사본' 중 하나를 번갈아 보여 줘, 선이 다시 그려진 듯 떨린다.
// 비트는 법: 가로 띠마다 x 를, 세로 띠마다 y 를 부드러운 물결(사인 둘의 합)만큼 민다. 장(k)마다 물결의 위상이 다르다.
// 세기 1·2·3 = 최대 1·1.8·2.8px(360 기준). 사본은 그림·떨림이 바뀔 때 버린다(boilCache 비움).
// ── 애니메이션(장) ─────────────────────────────────────────────────────────────────────────────
// frames: [{id, duration(초), layers}] — 2장 이상일 때만 있다. 첫 장이 대표 그림(저장 미리보기·완성 판단)이다.
// layers 는 지금 장(frameIdx)의 레이어 배열이고, state() 가 그 배열을 frames 에 되돌려 둔다.
// 장을 바꾸면 되돌리기 기록을 비운다 — 다른 장의 기록이 지금 장에 덮어써지지 않게.
var frames=null,frameIdx=0,onion=true;
function syncFrame(){if(frames&&frames[frameIdx])frames[frameIdx].layers=layers;}
function animOn(){return !!(frames&&frames.length>1);}
function animTotal(){return frames.reduce((t,f)=>t+f.duration,0);}
function frameAtTime(t){const L=animTotal(),u=((t%L)+L)%L;let acc=0;for(const f of frames){acc+=f.duration;if(u<acc-1e-9)return f;}return frames[frames.length-1];}
function layersAt(t){return animOn()?frameAtTime(t).layers:layers;}
// 내보내기 한 장의 길이: 장 시간들의 최대공약수(0.1초 단위). 그래야 장이 바뀌는 순간이 프레임 경계와 맞는다.
function animStep(){const g=(a,b)=>b?g(b,a%b):a;let d=0;for(const f of frames)d=g(d,Math.max(1,Math.round(f.duration*10)));return Math.max(1,d)/10;}
function transformMotion(){return !!(motion&&(motion.preset||(motion.steps&&motion.steps.length)||(motion.parts&&motion.parts.length)||motion.alternate||motion.boil));}
function cloneLayers(src){return src.map(l=>{const b=bitmap();b.getContext('2d').drawImage(l.bitmap,0,0);return Object.assign({},l,{bitmap:b});});}
function blankLayers(src){return src.map(l=>Object.assign({},l,{bitmap:bitmap()}));}
function flatOf(list,size){const c=document.createElement('canvas');c.width=c.height=size||W;const g=c.getContext('2d');if(size)g.scale(size/W,size/H);list.forEach(l=>composite(g,l));return c;}
// 앞 장 비춰 보기: 앞 장을 옅은 보라 한 색으로 깐다(지금 장 선과 헷갈리지 않게). 재생 중·첫 장에서는 그리지 않는다.
function drawOnion(g){
 if(!animOn()||!onion||frameIdx<1||playing)return;
 const c=flatOf(frames[frameIdx-1].layers),cg=c.getContext('2d');
 cg.globalCompositeOperation='source-in';cg.fillStyle='#5B57D9';cg.fillRect(0,0,W,H);
 g.save();g.globalAlpha=.32;g.drawImage(c,0,0);g.restore();
}
function useFrame(i){syncFrame();frameIdx=Math.max(0,Math.min(frames.length-1,i));layers=frames[frameIdx].layers;if(!layers.some(l=>l.id===activeLayerId))activeLayerId=layers[0]?.id||'';activeDrawLayerId=activeLayerId;history=[];future=[];extentCache=null;boilCache.clear();}
var boilCache=new Map(),BOIL_FPS=8;
function boilSteps(L){return 3*Math.max(1,Math.round(L*BOIL_FPS/3));}
function boilAt(t){if(!motion||!motion.boil)return null;const L=loopSeconds(),n=boilSteps(L),u=((t/L)%1+1)%1;return Math.floor(u*n)%3;}
function boiled(l,k){
 const key=l.id+':'+k+':'+motion.boil;let c=boilCache.get(key);if(c&&c.src===l.bitmap)return c.out;
 const amp=[0,1,1.8,2.8][motion.boil]*W/360,band=Math.max(2,Math.round(3*W/360));
 const ph=[[0,1.7],[2.1,4.4],[4.2,.9]][k];
 const wave=(v,a,b)=>amp*(.65*Math.sin(v/(W*.11)+a)+.35*Math.sin(v/(W*.047)+b));
 const mid=bitmap(),mg=mid.getContext('2d');
 for(let y=0;y<H;y+=band)mg.drawImage(l.bitmap,0,y,W,band,wave(y,ph[0],ph[1]),y,W,band);
 const out=bitmap(),og=out.getContext('2d');
 for(let x=0;x<W;x+=band)og.drawImage(mid,x,0,band,H,x,wave(x,ph[1],ph[0]),band,H);
 boilCache.set(key,{src:l.bitmap,out});return out;
}
function render(t){ctx.clearRect(0,0,W,H);references.forEach(l=>composite(ctx,l));if(t===undefined)drawOnion(ctx);(t===undefined?layers:layersAt(t)).forEach(l=>{const d=t===undefined?null:deltaFor(l,t);composite(ctx,l,d);if(wet&&l.id===wetLayer)composite(ctx,{...l,bitmap:wetView(),opacity:l.opacity*wetAlpha},d);});drawSelection(ctx);drawFocus(ctx);drawTrail(ctx);drawPivot(ctx);if(t!==undefined)drawExtent(ctx);drawCaption(ctx,t===undefined||!motion||!motion.captionMoves?null:wholeDelta(t));selectionOutline(ctx);captionOutline(ctx);}
function size(){const n=Math.max(160,Math.min(window.innerWidth,window.innerHeight))*zoom;surface.style.width=n+'px';surface.style.height=n+'px';}
function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
function local(p,l){const x=p.x-W/2-l.x,y=p.y-H/2-l.y,a=-l.rotation*Math.PI/180;return {x:(x*Math.cos(a)-y*Math.sin(a))/l.scale+W/2,y:(x*Math.sin(a)+y*Math.cos(a))/l.scale+H/2};}
function style(g){const T=liveTool();g.globalCompositeOperation=T==='eraser'?'destination-out':'source-over';g.globalAlpha=T==='eraser'?1:(brush==='pencil'&&wet)?1:brush==='brush'?0.85:brush==='pencil'?0.55:1;g.lineWidth=T==='eraser'?eraserWidth:(brush==='brush'?penWidth*1.4:penWidth);g.strokeStyle=solid(color);g.fillStyle=solid(color);g.lineCap='round';g.lineJoin='round';const P=activePreset();if(P){g.globalAlpha=1;g.lineWidth=computeBrushWidth(penWidth*P.width,lastPressure,P)*(P.taper?Math.min(1,.3+.7*strokeLen/P.taper):1);g.lineCap=P.cap||'round';
  // 점선 펜만 점 간격을 건다. 프리셋이 없는 기본 펜·붓·연필은 이 줄을 지나지 않는다 — 예전 획이 한 픽셀도 바뀌지 않게.
  if(P.dash){g.setLineDash([Math.max(.6,g.lineWidth*.22),Math.max(1,g.lineWidth*P.dash)]);g.lineDashOffset=-strokeLen;}else g.setLineDash([]);}}
// 색 투명도. 획은 **불투명하게 따로 그린 뒤(wet) 손을 뗄 때 한 번에 투명도를 걸어 얹는다.** 짧은 선분마다
// 투명도를 걸면 겹치는 이음매마다 진해져 구슬 꿴 줄처럼 보인다. 불투명한 색은 이 길을 타지 않는다.
let wet=null,wetLayer=null,wetAlpha=1,picking=false,strokePath=[];
// 그리는 중인 획이 시작할 때 쥐고 있던 도구. 획 도중에 도구가 바뀌어도 이 획은 이것으로 끝낸다 —
// 반은 그려지고 반은 지워지는 획이 나오면 안 된다. 획이 없을 때는 null 이고 현재 도구를 쓴다.
let strokeTool=null;
function liveTool(){return strokeTool||tool;}
// 45.31 재료층. 새 프리셋(dab 이 있는 것)만 이 값을 쓴다.
// 씨앗은 획마다 정해지고, 획을 통째로 다시 그릴 때 처음부터 같은 순서로 흘러 결과가 흔들리지 않는다.
let strokeSeed=1,rand=()=>.5,strokeSpeed=0,lastMoveAt=0;
// 45.32 미감 수정. dab 의 기울기를 이어 주고(급회전에서 톱니 방지), 손을 대자마자 찍던 첫 자국을 없앴다.
let dabAng=null,tapDot=null,ribbonLen=0;
// 부드러운 잡음. 자리(획을 따라 잰 길이)만으로 정해져 다시 그려도 같은 결과가 나온다.
// 획 길이를 따라 굵기가 천천히 오르내린다. 마디가 짧으면 획이 애벌레처럼 울퉁불퉁해지므로
// 가장 짧은 마디도 15px 쯤으로 둔다 — 손글씨 한 획 안에서 한두 번만 출렁인다.
function wave(s,seed){const a=seed*.017;return Math.sin(s*.085+a)*.55+Math.sin(s*.19+a*2.3)*.30+Math.sin(s*.41+a*4.1)*.15;}
function seeded(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function resetRand(){rand=seeded(strokeSeed);}
// 종이결. 화면 자리에 붙은 값이라 같은 자리를 다시 칠하면 같은 결이 나온다 — 획을 다시 그려도 입자가 움직이지 않는다.
// 종이결. 예전에는 dab 마다 이 값을 알파에 곱했는데, 그러면 한 dab 이 통째로 옅어져
// 굵은 획이 **동그란 도장이 꿰인 줄**로 보였다(45.32 결함). 이제 결은 획을 다 그은 뒤
// 픽셀 단위로 판다 — dab 은 고르게 찍히고 결만 남는다.
function paperNoise(x,y,s){
 const h=(a,b)=>{let n=(a*73856093)^(b*19349663)^0x5bf03635;n=Math.imul(n^(n>>>13),0xC2B2AE35);return((n^(n>>>16))>>>0)/4294967296;};
 const one=(sc)=>{const gx=x/sc,gy=y/sc,x0=Math.floor(gx),y0=Math.floor(gy),fx=gx-x0,fy=gy-y0;
  const ex=fx*fx*(3-2*fx),ey=fy*fy*(3-2*fy);
  return (h(x0,y0)*(1-ex)+h(x0+1,y0)*ex)*(1-ey)+(h(x0,y0+1)*(1-ex)+h(x0+1,y0+1)*ex)*ey;};
 return one(Math.max(1.2,s))*.6+one(Math.max(2.4,s*2.4))*.4;
}
// 결이 파이는 정도. 종이는 **솟은 결이 색을 다 받고 골만 비는** 것이라, 절반을 깎는 무늬를 쓰면
// 획이 지지직거리는 잡티가 된다. 골(THR 아래)만 파고 나머지는 그대로 둔다.
const GRAIN_THR=.42;
// 굵기 s 마다 한 장씩 만들어 둔다(캔버스 크기는 바뀌지 않는다). 알파 = 1 - 결 이라
// destination-out 으로 얹으면 남은 알파 = 원래 알파 × ((1-결세기) + 결세기 × 결).
const paperMasks={};
function paperMask(scale){const key=String(scale);if(paperMasks[key])return paperMasks[key];
 const c=bitmap(),g=c.getContext('2d'),im=g.createImageData(W,H),d=im.data;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;d[i]=d[i+1]=d[i+2]=0;const v=paperNoise(x,y,scale),t=Math.max(0,Math.min(1,(GRAIN_THR-v)/GRAIN_THR));d[i+3]=Math.round(255*t*t*(3-2*t));}
 g.putImageData(im,0,0);paperMasks[key]=c;return c;}
function paperAt(x,y,scale){const s=Math.max(1,scale||3);let h=(Math.floor(x/s)*73856093)^(Math.floor(y/s)*19349663)^0x5bf03635;h=Math.imul(h^(h>>>13),0xC2B2AE35);return((h^(h>>>16))>>>0)/4294967296;}
// PRO 브러시. 무료 펜/붓/연필(brush)은 손대지 않고, preset 이 있을 때만 이 표를 쓴다. PRO 획은 전부 wet 버퍼에
// 불투명하게 그린 뒤 손을 뗄 때 (색 투명도 × 브러시 진하기 × 프리셋 기본 진하기)를 한 번에 얹는다 — 한 획 안의 겹침은 진해지지 않는다.
const PRESETS={
 ink:{alpha:1,width:1.05,ribbon:{taper:18,floor:.38}},
 soft:{alpha:1,width:1.35,soft:true},
 grain:{alpha:.85,width:.75,cap:'round',texture:true},
 marker:{alpha:.55,width:2,cap:'butt'},
 // 45.28차에 더한 PRO 네 종. 기존 네 종의 값은 건드리지 않았다 — 저장된 작품의 외형이 바뀌면 안 된다.
 calligraphy:{alpha:1,width:1.15,cap:'butt',taper:22},
 crayon:{alpha:.88,width:1.55,dab:{r:1.05,hard:.85,op:.9,per:3.4,grain:1,grainScale:5,jitter:.16,ratio:1.25,angle:'along'}},
 airbrush:{alpha:.45,width:2.4,soft:true},
 chisel:{alpha:1,width:1.9,cap:'butt'},
 rough:{alpha:.9,width:1.1,cap:'round',texture:true,taper:10},
 // ── 45.31: 무료 10 + PRO 20 구성(v2 구성표). 위의 값은 한 글자도 바꾸지 않는다 —
 // 저장된 작품이 쓰던 프리셋이 그대로 살아 있어야 한다. 새 이름은 전부 아래에만 있다.
 // dab 값의 출발점은 원본 .myb 의 radius/hardness/opaque/dabs_per_radius/offset_by_random/elliptical 이고,
 // 손가락 입력(압력 없음)에 맞게 다시 정했다. 원본 그대로가 아니다.
 //
 // ── 무료 10 ──
 // F02 자연 잉크 — irregular_ink(elliptical 1.66 · angle[stroke]). 중심선은 손을 그대로 따르고
 //     dab 의 기울기만 획을 따라 돌아 가장자리에만 미세한 변화가 생긴다. 중심을 흔들지 않는다.
 inknatural:{alpha:1,width:1.15,ribbon:{taper:5,floor:.72,wobble:.16}},
 // F04 붓펜 — PenBrush(radius[pressure]). 압력이 없으므로 속도로 굵기를 바꾼다: 천천히 그으면 굵고 빠르면 가늘다.
 brushpen2:{alpha:.95,width:1.9,ribbon:{taper:14,floor:.28,speed:.45,wobble:.08}},
 // F06 색연필 — 종이결에 색이 쌓인다. 결은 화면 자리에 붙어 있어 덧칠할수록 같은 골에 색이 얹힌다.
 // F05 연필 — 2B_pencil(hardness .2 · opaque .15 · offset .5). 고운 마른 입자. 해칭을 겹쳐도 형태가 뭉개지지 않게
 // 한 dab 은 옅고 촘촘하다. 예전 기본 연필(base pencil)은 호환용으로 그대로 남는다.
 pencil2:{alpha:.62,width:1,dab:{r:1,hard:.45,op:.3,per:4,grain:.55,grainScale:1,jitter:.22}},
 // F06 색연필 — 결이 굵은 종이에 색이 쌓인다. 연필보다 결이 크고 진하며, 덧칠할수록 같은 골에 색이 얹힌다.
 colorpencil:{alpha:.92,width:1.15,dab:{r:1.1,hard:.8,op:.55,per:5,grain:.95,grainScale:4,jitter:.1}},
 // F07 불투명 채색붓 — 100%_Opaque(hardness .95). 한 획 안에서 아무리 겹쳐도 면이 고르게 찬다.
 opaque:{alpha:1,width:1.6,dab:{r:1,hard:.95,op:1,per:2.2}},
 // F08 마커 — Marker(elliptical 5.46 · angle[direction] · hardness .5). 진행 방향에 직각인 납작 dab 이라
 //     이어붙임 자국이 없다. 예전 marker 는 아래 호환용으로 남는다.
 marker2:{alpha:.6,width:2,dab:{r:1,hard:.72,op:1,per:4,ratio:2.6,angle:'dir'}},
 // F10 납작 펜 — calligraphy(elliptical 5.46 · angle 45.9 고정). 팁 각도가 고정이라 가로·세로 획의 굵기가 다르다.
 flat:{alpha:1,width:1.5,dab:{r:1,hard:.97,op:1,per:9,nib:46,nibRatio:3.5}},
 //
 // ── PRO 20 ──
 // P01 거친 잉크 — textured_ink(hardness 1 · dabs 6). 속은 꽉 차고 가장자리만 거칠다.
 inkrough:{alpha:1,width:1.1,dab:{r:1,hard:1,op:1,per:5,jitter:.22,opRand:.15}},
 // P03 붓결 잉크 — rigger(angle 178 ≈ 진행 방향 · hardness 1). 털 여러 가닥이 획 방향으로 이어진다.
 bristle:{alpha:.95,width:1.55,dab:{r:1,hard:.85,op:.6,per:4.5,bristles:11,hair:.42,spread:.62,angle:'along',ratio:1.8}},
 // P04 볼펜 — ballpen(opaque .2 · hardness .2). 가늘고 옅어 해칭을 겹쳐 쌓는다.
 ballpen:{alpha:.7,width:.6,dab:{r:1,hard:.6,op:.5,per:3,opRand:.25}},
 // P07 소프트 파스텔 — Pastel_1 을 크레용과 갈라 쓴다: 덩어리 대신 고운 가루가 넓게 앉는다.
 pastel:{alpha:.88,width:1.85,dab:{r:.95,hard:.74,op:.32,per:5,grain:.8,grainScale:2,jitter:.18}},
 // P08 목탄 — charcoal(hardness .2 · offset 1.6 · dabs 5). 큰 결이 불규칙하게 번진다. 색은 고른 색 그대로.
 charcoal:{alpha:.85,width:1.6,dab:{r:.95,hard:.55,op:.34,per:5,jitter:.42,grain:.7,grainScale:4,opRand:.25}},
 // P09 연필 옆면 — 8B_Pencil(tilt 의존). 손가락에는 기울기가 없으므로 넓은 접촉면을 고정 프로필로 둔다.
 pencilside:{alpha:.88,width:2.2,dab:{r:1.35,hard:.78,op:.3,per:4,ratio:2.4,angle:'dir',grain:.85,grainScale:3}},
 // P10 입자 음영 — Grain(hardness .1 · elliptical 10[random]). 원본의 색 끌림(smudge)은 넣지 않았다.
 grainshade:{alpha:.85,width:2,dab:{r:.9,hard:.3,op:.14,per:8,ratio:1.8,angle:'rnd',jitter:.7,grain:.5,grainScale:2}},
 // P11 점묘 — puantilism(dabs 6 · offset 2). 경로 주변에 떨어진 점을 뿌린다. 점선처럼 일정 간격이 아니다.
 pointil:{alpha:1,width:1,dab:{r:.5,hard:.9,op:.95,per:.8,scatter:3,sizeRand:.45}},
 // P12 스프레이 — spray(offset 2 · dabs_per_basic 3.9). 더 넓게, 더 촘촘히, 크기가 제각각.
 spray:{alpha:.85,width:1.6,dab:{r:.3,hard:.7,op:.75,per:.35,scatter:4.5,sizeRand:.7}},
 // P13 드라이 평붓 — 넓은 납작 붓이 마르며 끊긴다. P02(가는 마른 잉크)의 확대판이 아니라 폭·털수·끊김이 다르다.
 dryflat:{alpha:.88,width:2.4,dab:{r:1,hard:.8,op:.5,per:4,bristles:11,hair:.34,spread:.72,angle:'along',ratio:1.5,drop:.18}},
 // P14 워시 — watercolor_glazing(elliptical 10 · hardness .41 · 얇게 여러 번). 겹칠수록 조금씩 짙어진다.
 wash:{alpha:.45,width:3,dab:{r:1,hard:.45,op:.1,per:3,ratio:1.3}},
 // P15 가장자리 수채 — 가운데는 옅고 가장자리에 색이 고인다. 이름만으로 되는 효과가 아니라 테두리를 따로 얹는다.
 wateredge:{alpha:.6,width:3,rim:1.4,dab:{r:1,hard:.5,op:.16,per:4,ratio:1.2}},
 // P16 오일 파스텔 — oil paint 원본은 오일 파스텔이 아니다. 두껍고 눌린 왁스가 되도록 따로 잡았다.
 oilpastel:{alpha:.95,width:2.2,dab:{r:1,hard:.85,op:.75,per:2.4,ratio:2.2,angle:'along',jitter:.22,grain:.35,grainScale:4}},
 // P19 평행선 펜 — 곡선 법선 방향으로 일정 간격의 여러 줄. 획 전체를 다시 그어 급회전에서도 이음매가 없다.
 parallelpen:{alpha:1,width:.5,repath:true,parallel:3,gap:1.8},
 // P20 발광 펜 — Glow_Airbrush(hardness .14). 또렷한 중심선 + 흐린 번짐. 배경을 밝게 만들지는 않는다.
 glowpen:{alpha:.9,width:1,glow:3.2,dab:{r:1,hard:.95,op:1,per:3}},
 // 45.29차: 승인 구성의 남은 네 종. 위 값은 그대로 둔다 — 저장된 작품이 쓰던 결과가 바뀌면 안 된다.
 brushpen:{alpha:.85,width:1.4,cap:'round'},
 chalk:{alpha:.7,width:2.3,cap:'round',texture:true,coarse:true},
 dotted:{alpha:1,width:1.1,cap:'round',dash:2.4},
 outline:{alpha:1,width:2.8,cap:'round',outline:.9}
};
// 선 보정 강도. light 는 예전 값 그대로다(무료 '선 보정' 켜짐과 같다).
const STAB={light:.55,medium:.3,strong:.16};
let preset=null,brushOpacity=1,stabilizer='light',strokeLen=0,lastRaw=null,lastPressure=null;
const PENCIL_ALPHA=.55;
function applyBrush(m){preset=m.preset&&PRESETS[m.preset]?m.preset:null;const o=Number(m.opacity);brushOpacity=Number.isFinite(o)?Math.max(.05,Math.min(1,o)):1;stabilizer=STAB[m.stabilizer]?m.stabilizer:'light';if(typeof m.smoothing==='boolean')smoothing=m.smoothing;}
// 필압 자리. 스타일러스(pointerType 'pen')의 0~1 값만 받는다. 지금 프리셋에는 pressure 반응이 없어 항상 기본값을 돌려준다 —
// 손가락·마우스의 체감은 바뀌지 않는다. 0·undefined·범위 밖 값은 없는 것으로 본다.
function validPressure(p){return Number.isFinite(p)&&p>0&&p<=1?p:null;}
function penPressure(e){return e&&e.pointerType==='pen'?validPressure(e.pressure):null;}
function computeBrushWidth(base,pressure,settings){const p=validPressure(pressure);if(p===null||!settings||!settings.pressure)return base;return base*Math.max(.25,Math.min(1.5,.5+p));}
function computeBrushAlpha(base,pressure,settings){const p=validPressure(pressure);if(p===null||!settings||!settings.pressure)return base;return base*Math.max(.1,Math.min(1,p*1.25));}
function activePreset(){return liveTool()!=='eraser'&&preset?PRESETS[preset]:null;}
function solid(hex){const p=rgba(hex);return '#'+[p[0],p[1],p[2]].map(n=>n.toString(16).padStart(2,'0')).join('');}
function css(hex){const p=rgba(hex);return p[3]>=255?solid(hex):'rgba('+p[0]+','+p[1]+','+p[2]+','+(p[3]/255).toFixed(3)+')';}
function inkAlpha(){return rgba(color)[3]/255;}
// 젖은 획의 가장자리에만 색을 더 앉힌다(수채가 마르며 테두리에 고이는 모양).
function poolEdge(c,amount){
 const g=c.getContext('2d',{willReadFrequently:true}),img=g.getImageData(0,0,W,H),d=img.data,out=new Uint8ClampedArray(d);
 const A=(x,y)=>(x<0||y<0||x>=W||y>=H)?0:d[(y*W+x)*4+3];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const i=(y*W+x)*4,a=d[i+3];if(a<8)continue;
  // 두 칸 안에 빈 곳이 있으면 가장자리다.
  let near=0;
  for(let k=1;k<=2&&!near;k++)if(A(x-k,y)<8||A(x+k,y)<8||A(x,y-k)<8||A(x,y+k)<8)near=1;
  if(near)out[i+3]=Math.min(255,Math.round(a*(1+amount)+18));
 }
 img.data.set(out);g.putImageData(img,0,0);
}
function dry(){if(!wet)return;{const P=activePreset();if(P&&P.rim)poolEdge(wet,P.rim);}const l=layers.find(x=>x.id===wetLayer);if(l){const g=l.bitmap.getContext('2d');g.save();g.globalAlpha=wetAlpha;g.drawImage(wetView(),0,0);g.restore();}wet=null;wetLayer=null;render();}
// 결 연필: 그은 선에 고정된 알갱이 무늬를 파낸다. 획마다 파내면 다음 선분의 둥근 끝이 다시 덮으므로, 보여 줄 때와 얹을 때 한 번에 건다 —
// 그리는 동안 보이는 결과 저장되는 결이 같다.
let grainMask=null,coarseMask=null,wetShown=null;
function makeMask(density,minR,spread){const c=bitmap(),m=c.getContext('2d');m.fillStyle='#000';for(let i=0;i<W*H*density;i++){m.globalAlpha=.45+Math.random()*.4;m.beginPath();m.arc(Math.random()*W,Math.random()*H,minR+Math.random()*spread,0,Math.PI*2);m.fill();}return c;}
function wetView(){const P=activePreset();
 if(!wet||!P)return wet;
 const D=P.dab;
 if(!P.texture&&!(D&&D.grain))return wet;
 if(D&&D.grain&&!P.texture){
  if(!wetShown)wetShown=bitmap();const t=wetShown.getContext('2d');
  t.globalCompositeOperation='source-over';t.clearRect(0,0,W,H);t.drawImage(wet,0,0);
  t.globalCompositeOperation='destination-out';t.globalAlpha=Math.max(0,Math.min(1,D.grain));
  t.drawImage(paperMask(D.grainScale??3),0,0);
  t.globalAlpha=1;t.globalCompositeOperation='source-over';return wetShown;
 }
 let mask;
 if(P.coarse){if(!coarseMask)coarseMask=makeMask(.008,1.4,2.2);mask=coarseMask;}
 else{if(!grainMask)grainMask=makeMask(.02,.6,.9);mask=grainMask;}
 if(!wetShown)wetShown=bitmap();const t=wetShown.getContext('2d');t.globalCompositeOperation='source-over';t.clearRect(0,0,W,H);t.drawImage(wet,0,0);t.globalCompositeOperation='destination-out';t.drawImage(mask,0,0);t.globalCompositeOperation='source-over';return wetShown;}
// 연필 입자. 그은 선 둘레에 작은 점을 뿌려 종이에 걸리는 느낌을 낸다. 굵기는 건드리지 않는다 —
// 필압을 흉내 내면 지원하지 않는 기능을 있는 척하게 된다.
function grain(g,a,b){
 if(activePreset()||brush!=='pencil'||tool==='eraser')return;
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
 if(len<0.5)return;
 const spread=Math.max(1,g.lineWidth*0.42),dots=Math.max(1,Math.round(len*0.9));
 g.save();g.globalAlpha=0.55;g.fillStyle=solid(color);
 for(let i=0;i<dots;i++){
  const t=Math.random(),px=a.x+dx*t,py=a.y+dy*t;
  const off=(Math.random()-0.5)*2*spread,perp=len?{x:-dy/len,y:dx/len}:{x:0,y:0};
  g.beginPath();g.arc(px+perp.x*off,py+perp.y*off,Math.max(0.4,g.lineWidth*0.11),0,Math.PI*2);g.fill();
 }
 g.restore();
}
function touchPoint(e){return {id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};}
function points(){return [...touches.values()];}
function firstTwo(){return points().slice(0,2);}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function middle(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
function canvasUnits(px){const r=canvas.getBoundingClientRect();return px*W/Math.max(1,r.width);}
function cancelStrokeForGesture(){captionDrag=null;captionHandle=null;captionDismiss=false;grabbing=null;if(!active)return;wet=null;wetLayer=null;active=false;strokeTool=null;pointer=null;strokePending=false;steady=null;if(history.length){const previous=history.pop();restore(previous);}}
function beginMulti(){
 const ps=firstTwo();if(ps.length<2)return;const [a,b]=ps,mid=middle(a,b),ref=activeReference();
 if(!multi){multi={started:Date.now(),maxCount:touches.size,moved:false,ids:[a.id,b.id],distance:Math.max(1,distance(a,b)),mid,zoom,scrollLeft:viewport.scrollLeft,scrollTop:viewport.scrollTop,refId:ref?.id||null,refX:ref?.x||0,refY:ref?.y||0,refScale:ref?.scale||1,didCheckpoint:false,capScale:caption?.scale||1,capRot:caption?.rot||0,angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI};}
 else multi.maxCount=Math.max(multi.maxCount,touches.size);
 suppressDraw=true;
}
function gesturePair(){if(!multi)return null;const a=touches.get(multi.ids[0]),b=touches.get(multi.ids[1]);return a&&b?[a,b]:null;}
function applyMulti(){
 const pair=gesturePair();if(!pair)return;const [a,b]=pair,mid=middle(a,b),d=Math.max(1,distance(a,b)),move=Math.hypot(mid.x-multi.mid.x,mid.y-multi.mid.y),pinch=Math.abs(d-multi.distance);
 if(move>10||pinch>10)multi.moved=true;if(!multi.moved)return;
 // 고른 문구 위의 두 손가락: 벌리면 크기, 비틀면 회전(8° 안쪽 흔들림은 무시).
 if(captionPicked&&caption){if(!multi.didCheckpoint){checkpoint();multi.didCheckpoint=true;}caption.scale=Math.max(.4,Math.min(3,multi.capScale*(d/multi.distance)));let turn=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI-multi.angle;if(turn>180)turn-=360;if(turn<-180)turn+=360;caption.rot=Math.abs(turn)<8?multi.capRot:Math.round((multi.capRot+turn)*10)/10;dirty=true;render();state();return;}
 const ref=multi.refId&&references.find(l=>l.id===multi.refId&&l.visible);
 if(ref){if(!multi.didCheckpoint){checkpoint();multi.didCheckpoint=true;}ref.scale=Math.max(.1,Math.min(4,multi.refScale*(d/multi.distance)));ref.x=multi.refX+canvasUnits(mid.x-multi.mid.x);ref.y=multi.refY+canvasUnits(mid.y-multi.mid.y);dirty=true;render();state();return;}
 const next=Math.max(1,Math.min(4,multi.zoom*(d/multi.distance)));zoom=next;size();const ratio=next/multi.zoom;viewport.scrollLeft=(multi.scrollLeft+multi.mid.x)*ratio-mid.x;viewport.scrollTop=(multi.scrollTop+multi.mid.y)*ratio-mid.y;send({type:'zoom',zoom});
}
function rgba(hex){let v=String(hex||'').replace('#','');if(v.length===3)v=v.split('').map(c=>c+c).join('');const n=parseInt(v.slice(0,6),16)||0,a=v.length>=8?parseInt(v.slice(6,8),16):255;return [n>>16&255,n>>8&255,n&255,Number.isFinite(a)?a:255];}
function fillAt(spot){
 const l=activeDraw();if(!l||!l.visible)return;
 const seed=local(spot,l),sx=Math.round(seed.x),sy=Math.round(seed.y);
 if(sx<0||sy<0||sx>=W||sy>=H)return;
 const g=l.bitmap.getContext('2d'),image=g.getImageData(0,0,W,H),d=image.data,start=(sy*W+sx)*4;
 const target=[d[start],d[start+1],d[start+2],d[start+3]],paint=rgba(color);
 if(Math.abs(target[3]-paint[3])<8&&Math.abs(target[0]-paint[0])<8&&Math.abs(target[1]-paint[1])<8&&Math.abs(target[2]-paint[2])<8)return;
 // Tolerance is fixed: line art only needs "is this the same flat area", never a numeric dial.
 const near=k=>{const da=d[k+3]-target[3];if(Math.abs(da)>64)return false;if(d[k+3]<8&&target[3]<8)return true;return Math.abs(d[k]-target[0])+Math.abs(d[k+1]-target[1])+Math.abs(d[k+2]-target[2])<=96;};
 const inside=new Uint8Array(W*H),stack=[sx,sy];
 while(stack.length){
  const y=stack.pop(),x=stack.pop();
  let left=x;while(left>=0&&!inside[y*W+left]&&near((y*W+left)*4))left--;
  let right=x+1;while(right<W&&!inside[y*W+right]&&near((y*W+right)*4))right++;
  for(let i=left+1;i<right;i++){
   inside[y*W+i]=1;
   if(y>0&&!inside[(y-1)*W+i]&&near(((y-1)*W+i)*4))stack.push(i,y-1);
   if(y<H-1&&!inside[(y+1)*W+i]&&near(((y+1)*W+i)*4))stack.push(i,y+1);
  }
 }
 // Grow one pixel into the anti-aliased rim so the fill meets the line instead of leaving a white hairline.
 const edge=[];
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  if(inside[y*W+x])continue;const k=(y*W+x)*4;if(d[k+3]>=250)continue;
  if((x>0&&inside[y*W+x-1])||(x<W-1&&inside[y*W+x+1])||(y>0&&inside[(y-1)*W+x])||(y<H-1&&inside[(y+1)*W+x]))edge.push(y*W+x);
 }
 for(const i of edge)inside[i]=1;
 let painted=0;
 for(let i=0;i<W*H;i++)if(inside[i]){const k=i*4;d[k]=paint[0];d[k+1]=paint[1];d[k+2]=paint[2];d[k+3]=paint[3];painted++;}
 if(!painted)return;
 checkpoint();g.putImageData(image,0,0);dirty=true;render();
}
// ── Movement ────────────────────────────────────────────────────────────────────────────────
// The drawing is never touched. Movement is an outer transform around a pivot, applied on top of
// each layer's own transform, so editing a cut keeps its movement and removing the movement
// leaves exactly the still cut that was always there.
// Everything runs on one loop of LOOP seconds and every component completes a whole number of
// cycles inside it, so the loop joins back to its own first frame with no seam.
function loopSeconds(){
 if(animOn())return Math.max(.2,animTotal());
 if(!motion)return 1;
 // V2 다중 동작: 한 바퀴 = 단계 길이 × 반복의 합(최대 3초 — 내보내기 24프레임 안에서 끊기지 않게).
 if(motion.steps&&motion.steps.length)return Math.max(.2,Math.min(3,stepTotal(motion.steps)));
 if(motion.alternate&&motion.alternate.interval>0)return Math.max(.2,motion.alternate.interval*2);
 const base=1.2-Math.max(0,Math.min(1,motion.speed==null?.5:motion.speed))*.8;
 // 들어오고 머무는 효과(뿅·쓱·빼꼼 …)는 한 바퀴가 두 배다 — 짧으면 들어오자마자 다시 시작해 읽히지 않는다.
 return motion.preset&&LONG_PRESETS.indexOf(motion.preset)>=0?base*2:base;
}
var LONG_PRESETS=${JSON.stringify(LONG_MOTION_PRESETS)},ENTRANCE_REST=${JSON.stringify(ENTRANCE_REST)},ENTRANCE_EXIT=${JSON.stringify(ENTRANCE_EXIT)};
function cyclesFor(speed){return Math.max(1,Math.min(4,Math.round((speed==null?.5:speed)*3)+1));}
function wholeDelta(t){
 if(motion&&motion.steps&&motion.steps.length){const a0=Math.max(.05,Math.min(1,motion.strength==null?.5:motion.strength));return stepDelta(motion.steps,t,a0,motion.direction,W,H);}
 if(!motion||!motion.preset)return {px:W/2,py:H/2,dx:0,dy:0,sx:1,sy:1,rot:0};
 // 세기 0 이면 효과를 골랐는데도 아무것도 움직이지 않았다(2026-10-05 '일부 움직임 미작동' 원인 중 하나). 가장 약한 값은 한 칸(0.05).
 const a=Math.max(.05,Math.min(1,motion.strength==null?.5:motion.strength));
 const L=loopSeconds(),u=((t/L)%1+1)%1;
 // 스무 가지 식은 motion-math.ts 한 곳에 있다(효과 견본과 같은 식). 앞의 여섯은 45.38 과 같은 값을 낸다.
 return presetDelta(motion.preset,u,a,motion.direction,W,H);
}
${MOTION_MATH_JS}
// One part moving on its own, combined with whatever the whole picture is doing.
// 2026-10-05: 부분 움직임은 **그림 전체 움직임 안쪽**에서 따로 건다(d.part). 예전에는 전체 효과의 크기·회전을
// 부분의 회전 중심(어깨 등)을 축으로 다시 걸어, 통통·까딱·쾅과 손 흔들기를 함께 쓰면 손이 몸에서 떨어져 나갔다(쾅은 41px).
function partDelta(part,t,base){
 const L=loopSeconds(),cycles=cyclesFor(part.speed);
 const local=((t-(part.delay||0))%L+L)%L;
 const phase=local/L*Math.PI*2*cycles;
 const d={px:part.pivotX*W,py:part.pivotY*H,dx:0,dy:0,sx:1,sy:1,rot:0};
 const wave=Math.sin(phase);
 if(part.effect==='rotate')d.rot=wave*part.amount;
 if(part.effect==='move'){
  if(Number.isFinite(part.fromX)&&Number.isFinite(part.toX)){
   const half=(wave+1)/2;
   d.dx=((part.toX-part.fromX)*W)*half;d.dy=((part.toY-part.fromY)*H)*half;
  } else {const r=part.angle*Math.PI/180,travel=wave*part.amount*W;d.dx=Math.cos(r)*travel;d.dy=Math.sin(r)*travel;}
 }
 if(part.effect==='scale'){const s=1+wave*part.amount;d.sx=s;d.sy=s;}
 return Object.assign({},base,{part:d});
}
// Two poses taking turns: the layers named in poseB replace the others for half the loop.
function poseHides(l,t){
 if(!motion||!motion.alternate)return false;
 const interval=motion.alternate.interval,inB=(Math.floor(t/interval)%2)===1;
 const isB=motion.alternate.poseB.indexOf(l.id)>=0;
 return inB?!isB:isB;
}
function deltaFor(l,t){
 if(!motion)return null;
 const base=wholeDelta(t);
 const part=(motion.parts||[]).find(p=>p.layerId===l.id&&!p.off);
 const d=part?partDelta(part,t,base):Object.assign({},base);
 d.hidden=poseHides(l,t);
 const k=boilAt(t);if(k!==null)d.boilK=k;
 return d;
}
// Does the movement push the drawing outside the picture at any point in the loop?
// 잘림 판단·안내선이 보는 시점(2026-10-06): 내보내기 프레임은 늘 한 바퀴의 i/n(n=2~MAX_FRAMES) 자리에 놓이므로 그 자리를 모두 본다.
// 예전에는 12곳만 봐서 쾅처럼 짧게 튀는 효과의 끝을 놓쳤고, '칸 안에 맞추기'가 잘림이 남은 배율에서 멈췄다(안내선·내보내기 GIF 는 여전히 칸 밖).
let clipUs=null;
function clipTimes(){if(clipUs)return clipUs;const set=new Set([0]);for(let n=2;n<=MAX_FRAMES;n++)for(let i=1;i<n;i++)set.add(Math.round(i/n*1e9)/1e9);return clipUs=[...set].sort((a,b)=>a-b);}
function motionClips(){
 if(!motion)return false;
 const L=loopSeconds(),us=clipTimes();
 // 밖에서 들어오는 효과는 들어오는 동안 밖에 있는 것이 정상이다. 들어온 뒤(머무는 동안)만 본다. 빼꼼은 늘 일부가 가려진다.
 // 단계(steps)가 있으면 preset 은 쓰이지 않는다 — 한 효과용 등장·퇴장 구간도 적용하지 않는다(단계별로 stepEntering 이 본다).
 const solo=motion.steps&&motion.steps.length?null:motion.preset;
 const rest=solo&&Object.prototype.hasOwnProperty.call(ENTRANCE_REST,solo)?ENTRANCE_REST[solo]:0;
 const exit=solo&&ENTRANCE_EXIT[solo]||1;
 for(const l of layers){
  if(!l.visible)continue;
  const hull=inkHull(l.bitmap);
  if(!hull)continue;
  for(const u of us){
   const part=(motion.parts||[]).some(pp=>pp.layerId===l.id&&!pp.off);
   if(rest===null&&!part)continue;
   if(rest&&(u<rest||u>=exit)&&!part)continue;
   if(motion.steps&&motion.steps.length&&!part&&stepEntering(motion.steps,L*u))continue;
   const d=deltaFor(l,L*u);
   if(!d||d.hidden)continue;
   // 레이어 자체 변환(위치·크기·회전)을 먼저 건다(2026-10-05: 예전에는 빠져 있어, 레이어를 옮기거나 줄여도 잘림 판단이 바뀌지 않았다).
   const lt={px:W/2,py:H/2,dx:l.x,dy:l.y,sx:l.scale,sy:l.scale,rot:l.rotation},lstep=(q,px,py)=>{const r=q.rot*Math.PI/180,ox=(px-q.px)*q.sx,oy=(py-q.py)*q.sy;return [q.px+q.dx+ox*Math.cos(r)-oy*Math.sin(r),q.py+q.dy+ox*Math.sin(r)+oy*Math.cos(r)];};
   // 칠해진 픽셀은 [min, max+1) 을 차지한다 — max 로 재면 1px 모자라 가장자리 줄에 그림이 남았다(2026-10-06).
   // 2026-10-06: 네모(잉크 상자)의 네 모서리 대신 **그림 윤곽(볼록 껍질)**을 돌린다. 빙글처럼 크게 도는 효과에서 상자 모서리는
   // 그림보다 훨씬 바깥을 지나가, 그림이 칸 안에 있어도 '칸 밖' 경고가 떴다. 볼록 껍질은 그림의 모든 칠한 픽셀을 감싸므로 놓치는 잘림은 없다.
   const corners=hull.map(([x,y])=>lstep(lt,x,y));
   for(const [x,y] of corners){
    // 그릴 때와 같은 순서: 부분(있으면) → 전체. 점 p 는 축 기준으로 크기 → 회전 → 이동.
    const step=(q,px,py)=>{const r=q.rot*Math.PI/180,ox=(px-q.px)*q.sx,oy=(py-q.py)*q.sy;return [q.px+q.dx+ox*Math.cos(r)-oy*Math.sin(r),q.py+q.dy+ox*Math.sin(r)+oy*Math.cos(r)];};
    const inner=d.part?step(d.part,x,y):[x,y],[rx,ry]=step(d,inner[0],inner[1]);
    if(rx<0||ry<0||rx>W||ry>H)return true;
   }
  }
 }
 return false;
}
// 칠한 픽셀 전체를 감싸는 볼록 껍질(꼭짓점 목록). 줄마다 가장 왼쪽·오른쪽 픽셀의 바깥 가장자리([x, x+1) × [y, y+1))를 모아
// 단조 사슬로 껍질을 만든다. 아무것도 없으면 null.
function inkHull(bitmap){
 const g=bitmap.getContext('2d',{willReadFrequently:true}),d=g.getImageData(0,0,W,H).data,pts=[];
 for(let y=0;y<H;y++){let lo=-1,hi=-1;const row=y*W*4;for(let x=0;x<W;x++){if(d[row+x*4+3]===0)continue;if(lo<0)lo=x;hi=x;}
  if(lo<0)continue;pts.push([lo,y],[lo,y+1],[hi+1,y],[hi+1,y+1]);}
 if(!pts.length)return null;
 pts.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
 const lower=[],upper=[];
 for(const p of pts){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);}
 for(let i=pts.length-1;i>=0;i--){const p=pts[i];while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);}
 return lower.slice(0,-1).concat(upper.slice(0,-1));
}
function inkBox(bitmap){
 const g=bitmap.getContext('2d',{willReadFrequently:true}),d=g.getImageData(0,0,W,H).data;
 let minX=W,minY=H,maxX=-1,maxY=-1;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(d[(y*W+x)*4+3]===0)continue;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
 return maxX<0?null:{minX,minY,maxX,maxY};
}

// ── GIF89a writer ───────────────────────────────────────────────────────────────────────────
// Hand written for the same reason the ZIP writer is: an emoticon is flat colour on a
// transparent ground, which GIF carries exactly, and a dependency for it would be a whole
// image stack. Colours are counted, not guessed: if a set uses more than the 255 a GIF allows,
// the least used are merged into their nearest neighbour and that fact is reported.
function now(){return (typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();}
function startPlaying(){if(playing)return;playing=true;extentCache=null;boilCache.clear();playStart=now();const step=()=>{if(!playing)return;render((now()-playStart)/1000%loopSeconds());rafId=requestAnimationFrame(step);};rafId=requestAnimationFrame(step);state();}
function stopPlaying(){if(!playing)return;playing=false;if(rafId)cancelAnimationFrame(rafId);rafId=null;}
function quantize(frames){
 // Anything below this alpha becomes the transparent index, which is how a sticker keeps its
 // shape on any chat background.
 // Colours are counted exactly. A drawing with a handful of colours — which is most of them —
 // gets those exact colours in the palette, so a chosen pen or fill comes back as the colour it
 // was and not a neighbour of it. Only a drawing with more than a palette's worth is grouped, and
 // then each group is represented by its own most common colour rather than the group's floor.
 const counts=new Map();
 for(const f of frames){
  const d=f.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;
  for(let i=0;i<d.length;i+=4){
   if(d[i+3]<128)continue;
   const key=(d[i]<<16)|(d[i+1]<<8)|d[i+2];
   counts.set(key,(counts.get(key)||0)+1);
  }
 }
 const spread=k=>[(k>>16)&255,(k>>8)&255,k&255];
 let palette,dropped;
 if(counts.size<=255){
  palette=[...counts.entries()].sort((a,b)=>b[1]-a[1]).map(e=>spread(e[0]));
  dropped=0;
 }else{
  const groups=new Map();
  for(const [key,n] of counts){
   const bin=(((key>>19)&31)<<10)|(((key>>11)&31)<<5)|((key>>3)&31);
   const g=groups.get(bin);
   if(!g)groups.set(bin,{total:n,best:key,bestCount:n});
   else{g.total+=n;if(n>g.bestCount){g.best=key;g.bestCount=n;}}
  }
  const ordered=[...groups.values()].sort((a,b)=>b.total-a.total).slice(0,255);
  palette=ordered.map(g=>spread(g.best));
  dropped=Math.max(0,groups.size-255);
 }
 while(palette.length<255)palette.push([0,0,0]);
 return {palette,dropped};
}
function nearest(palette,r,g,b,cache){
 const key=(r>>3<<10)|(g>>3<<5)|(b>>3);
 const hit=cache.get(key);if(hit!==undefined)return hit;
 let best=0,bestD=Infinity;
 for(let i=0;i<palette.length;i++){
  const p=palette[i],d=(p[0]-r)*(p[0]-r)+(p[1]-g)*(p[1]-g)+(p[2]-b)*(p[2]-b);
  if(d<bestD){bestD=d;best=i;}
 }
 cache.set(key,best);return best;
}
function lzw(indices,minCode){
 const out=[];let cur=0,bits=0;
 const clear=1<<minCode,end=clear+1;
 let dict=new Map(),next=end+1,size=minCode+1;
 const push=code=>{cur|=code<<bits;bits+=size;while(bits>=8){out.push(cur&255);cur>>=8;bits-=8;}};
 const reset=()=>{dict=new Map();next=end+1;size=minCode+1;};
 push(clear);reset();
 let prefix=indices[0];
 for(let i=1;i<indices.length;i++){
  const k=indices[i],key=prefix*4096+k;
  if(dict.has(key)){prefix=dict.get(key);continue;}
  push(prefix);
  dict.set(key,next++);
  if(next-1===(1<<size)&&size<12)size++;
  else if(next>4095){push(clear);reset();}
  prefix=k;
 }
 push(prefix);push(end);
 if(bits>0)out.push(cur&255);
 return out;
}
var MAX_FRAMES=24;var WEBP_LOOPS=4;
// ── Animated WebP writer ────────────────────────────────────────────────────────────────────
// RIFF 컨테이너를 직접 쓴다. 한 장짜리 WebP 인코딩은 브라우저(canvas.toDataURL)가 하고, 이 코드는
// 그 파일에서 알맹이(VP8/VP8L/ALPH)만 꺼내 ANMF 프레임으로 다시 묶는다.
function riffChunks(bytes){
 // RIFF....WEBP 다음부터 청크가 이어진다. 각 청크는 이름 4바이트 + 길이 4바이트 + 내용(짝수 정렬).
 const out=[];
 if(bytes.length<12)return out;
 let at=12;
 while(at+8<=bytes.length){
  const name=String.fromCharCode(bytes[at],bytes[at+1],bytes[at+2],bytes[at+3]);
  const size=bytes[at+4]|(bytes[at+5]<<8)|(bytes[at+6]<<16)|(bytes[at+7]*16777216);
  const body=bytes.subarray(at+8,at+8+size);
  out.push({name,body});
  at+=8+size+(size&1);
 }
 return out;
}
function u32(n){return [n&255,(n>>8)&255,(n>>16)&255,(n>>>24)&255];}
function u24(n){return [n&255,(n>>8)&255,(n>>16)&255];}
function chunk(name,body){
 const head=[name.charCodeAt(0),name.charCodeAt(1),name.charCodeAt(2),name.charCodeAt(3),...u32(body.length)];
 const pad=body.length&1?[0]:[];
 return [...head,...body,...pad];
}
function frameToWebp(canvas,quality){
 const url=canvas.toDataURL('image/webp',quality);
 if(url.indexOf('data:image/webp')!==0)return null;      // 이 기기가 WebP 인코딩을 못 한다
 const raw=atob(url.slice(url.indexOf(',')+1));
 const bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return bytes;
}
function encodeWebp(frames,delayMs,loops,quality){
 const parts=[];
 for(const frame of frames){
  const file=frameToWebp(frame,quality);
  if(!file)return null;
  const chunks=riffChunks(file);
  const alpha=chunks.find(c=>c.name==='ALPH');
  const image=chunks.find(c=>c.name==='VP8L'||c.name==='VP8 ');
  if(!image)return null;
  // ANMF: x/y(각 3바이트, 2픽셀 단위) · 너비-1/높이-1(각 3바이트) · 지속시간 3바이트 · 플래그 1바이트
  const head=[...u24(0),...u24(0),...u24(W-1),...u24(H-1),...u24(Math.max(1,delayMs)),alpha?2:0];
  const body=[...head];
  if(alpha)body.push(...chunk('ALPH',[...alpha.body]));
  body.push(...chunk(image.name,[...image.body]));
  parts.push(...chunk('ANMF',body));
 }
 // VP8X: 플래그(애니메이션+알파) · 예약 3바이트 · 너비-1/높이-1
 const vp8x=chunk('VP8X',[0x12,0,0,0,...u24(W-1),...u24(H-1)]);
 const anim=chunk('ANIM',[0,0,0,0,loops&255,(loops>>8)&255]);
 const payload=[0x57,0x45,0x42,0x50,...vp8x,...anim,...parts];   // 'WEBP'
 const file=[0x52,0x49,0x46,0x46,...u32(payload.length),...payload];  // 'RIFF'
 let binary='';
 for(let i=0;i<file.length;i+=8192)binary+=String.fromCharCode.apply(null,file.slice(i,i+8192));
 return {data:'data:image/webp;base64,'+btoa(binary),bytes:file.length};
}
// wantSheets: 공식 도구(WebPAnimator)에 넣을 360x360 PNG 프레임. 컷 하나당 최대 24장이라
// 다리를 건너오는 양이 크다. 그래서 실제로 필요할 때(내보낼 때)만 만든다.
function buildLoop(fps,wantSheets){
 boilCache.clear();syncFrame();
 fps=Math.max(6,Math.min(24,fps||12));
 const L=loopSeconds();
 if(animOn()&&!transformMotion())fps=Math.min(24,1/animStep());
 const count=Math.max(2,Math.min(MAX_FRAMES,Math.round(L*fps)));
 fps=count/L;
 const out=[];
 for(let i=0;i<count;i++){
  const frame=bitmap(),g=frame.getContext('2d'),t=L*i/count;
  layersAt(t).forEach(l=>composite(g,l,motion?deltaFor(l,t):null));
  drawCaption(g,motion&&motion.captionMoves?wholeDelta(t):null);
  out.push(frame);
 }
 const gif=encodeGif(out,Math.max(2,Math.round(100/fps)));
 const delayMs=Math.round(1000/fps);
 // 제출 형식. 만들지 못하는 기기도 있으므로 실패는 null 로 두고 GIF 는 그대로 간다.
 let webp=null;
 try{webp=encodeWebp(out,delayMs,WEBP_LOOPS,0.92);}catch(e){webp=null;}
 // 공식 도구(WebPAnimator)는 360×360 PNG 를 순서대로 받는다. 그 프레임을 그대로 내보낸다.
 const sheets=wantSheets?out.map(function(f){return f.toDataURL('image/png');}):null;
 return {count,fps:Number(fps.toFixed(2)),loop:Number(L.toFixed(3)),delayMs,data:gif.data,bytes:gif.bytes,droppedColours:gif.droppedColours,clipped:motionClips(),
  webp:webp?webp.data:null,webpBytes:webp?webp.bytes:0,sheets:sheets};
}
function encodeGif(frames,delayHundredths){
 const {palette,dropped}=quantize(frames);
 const bytes=[];
 const put=(...v)=>{for(const x of v)bytes.push(x&255);};
 const short=v=>{bytes.push(v&255);bytes.push((v>>8)&255);};
 'GIF89a'.split('').forEach(c=>bytes.push(c.charCodeAt(0)));
 short(W);short(H);
 put(0xF7,0,0);                       // global table, 256 entries, 8 bits per colour
 for(const c of palette)put(c[0],c[1],c[2]);
 put(0,0,0);                          // index 255: the transparent slot
 put(0x21,0xFF,0x0B);                 // application block: loop forever
 'NETSCAPE2.0'.split('').forEach(c=>bytes.push(c.charCodeAt(0)));
 put(3,1);short(0);put(0);
 const cache=new Map();
 for(const frame of frames){
  const d=frame.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;
  const indices=new Uint8Array(W*H);
  for(let i=0,p=0;i<d.length;i+=4,p++){
   indices[p]=d[i+3]<128?255:nearest(palette,d[i],d[i+1],d[i+2],cache);
  }
  put(0x21,0xF9,4,0x09);              // restore to background, transparency on
  short(delayHundredths);put(255,0);  // index 255 is transparent
  put(0x2C);short(0);short(0);short(W);short(H);put(0);
  put(8);
  const data=lzw(indices,8);
  for(let i=0;i<data.length;i+=255){
   const chunk=data.slice(i,i+255);
   put(chunk.length);for(const b of chunk)bytes.push(b);
  }
  put(0);
 }
 put(0x3B);
 let binary='';
 for(let i=0;i<bytes.length;i+=4096)binary+=String.fromCharCode.apply(null,bytes.slice(i,i+4096));
 return {data:'data:image/gif;base64,'+btoa(binary),bytes:bytes.length,droppedColours:dropped};
}

// ── Selection ───────────────────────────────────────────────────────────────────────────────
// Picking part of a drawing lifts those pixels out of the layer and floats them. The hole they
// leave is real: that is what stops a moved piece from appearing twice. Until it is applied the
// float can be moved, resized, turned, flipped, sent to its own layer, or put back untouched —
// and the layer as it was is on the undo stack the whole time.
function selectionBox(){
 if(!marquee)return null;
 const x=Math.max(0,Math.min(marquee.x0,marquee.x1)),y=Math.max(0,Math.min(marquee.y0,marquee.y1));
 const w=Math.min(W,Math.max(marquee.x0,marquee.x1))-x,h=Math.min(H,Math.max(marquee.y0,marquee.y1))-y;
 return w>4&&h>4?{x,y,w,h}:null;
}
function liftSelection(){
 const box=selectionBox(),l=activeDraw();
 marquee=null;
 if(!box||!l)return;
 const lifted=bitmap(),g=lifted.getContext('2d');
 g.drawImage(l.bitmap,box.x,box.y,box.w,box.h,box.x,box.y,box.w,box.h);
 const probe=g.getImageData(box.x,box.y,box.w,box.h).data;
 let any=false;for(let i=3;i<probe.length;i+=4)if(probe[i]!==0){any=true;break;}
 if(!any)return;                                     // an empty patch is not worth a selection
 checkpoint();
 l.bitmap.getContext('2d').clearRect(box.x,box.y,box.w,box.h);
 selection={box,bitmap:lifted,layerId:l.id,dx:0,dy:0,scale:1,rot:0,flip:1};
 trace('lift',{box:{x:Math.round(box.x),y:Math.round(box.y),w:Math.round(box.w),h:Math.round(box.h)}});
 dirty=true;render();state();
}
function drawSelection(g){
 if(!selection)return;
 const cx=selection.box.x+selection.box.w/2,cy=selection.box.y+selection.box.h/2;
 g.save();
 g.translate(cx+selection.dx,cy+selection.dy);
 g.rotate(selection.rot*Math.PI/180);
 g.scale(selection.scale*selection.flip,selection.scale);
 g.translate(-cx,-cy);
 g.drawImage(selection.bitmap,0,0);
 g.restore();
}
function drawFocus(g){
 if(!focusLayerId)return;
 const l=layers.find(x=>x.id===focusLayerId);if(!l)return;
 const box=inkBox(l.bitmap);if(!box)return;
 g.save();g.strokeStyle='#FF7A59';g.lineWidth=2;g.setLineDash([6,5]);
 g.strokeRect(box.minX-6,box.minY-6,box.maxX-box.minX+12,box.maxY-box.minY+12);
 g.restore();
}
function drawTrail(g){
 if(!focusLayerId||!motion||!motion.parts)return;
 const part=motion.parts.find(p=>p.layerId===focusLayerId&&!p.off);
 if(!part)return;
 const cx=part.pivotX*W,cy=part.pivotY*H;
 const box=(function(){const l=layers.find(x=>x.id===focusLayerId);return l?inkBox(l.bitmap):null;})();
 const reach=box?Math.max(30,Math.min(150,Math.hypot(box.maxX-box.minX,box.maxY-box.minY)/2)):60;
 g.save();g.strokeStyle='#FF7A59';g.fillStyle='#FF7A59';g.lineWidth=2.5;g.setLineDash([]);
 if(part.effect==='rotate'){
  // 중심점 둘레에 실제 회전 폭만큼 호를 그리고 양 끝에 화살촉을 둔다.
  const half=Math.max(6,Math.min(60,part.amount))*Math.PI/180;
  g.beginPath();g.arc(cx,cy,reach,-Math.PI/2-half,-Math.PI/2+half);g.stroke();
  for(const dir of [-1,1]){
   const at=-Math.PI/2+half*dir,x=cx+Math.cos(at)*reach,y=cy+Math.sin(at)*reach;
   const tip=at+dir*0.18;
   g.beginPath();
   g.moveTo(cx+Math.cos(tip)*reach,cy+Math.sin(tip)*reach);
   g.lineTo(x+Math.cos(at-Math.PI/2)*6,y+Math.sin(at-Math.PI/2)*6);
   g.lineTo(x-Math.cos(at-Math.PI/2)*6,y-Math.sin(at-Math.PI/2)*6);
   g.closePath();g.fill();
  }
 }else if(part.effect==='move'){
  // 이동은 직선 화살표다. 시작·끝을 손가락으로 찍었으면 그 두 점을, 아니면 방향과 거리를 쓴다.
  const has=Number.isFinite(part.fromX)&&Number.isFinite(part.toX);
  const x1=has?part.fromX*W:cx,y1=has?part.fromY*H:cy;
  const far=(part.amount||0.04)*W;
  const angle=(part.angle||0)*Math.PI/180;
  const x2=has?part.toX*W:cx+Math.cos(angle)*far,y2=has?part.toY*H:cy+Math.sin(angle)*far;
  g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
  const at=Math.atan2(y2-y1,x2-x1);
  g.beginPath();
  g.moveTo(x2,y2);
  g.lineTo(x2-Math.cos(at-0.4)*10,y2-Math.sin(at-0.4)*10);
  g.lineTo(x2-Math.cos(at+0.4)*10,y2-Math.sin(at+0.4)*10);
  g.closePath();g.fill();
 }else if(part.effect==='scale'){
  // 크기는 안팎으로 벌어지는 두 겹 원이다.
  const grow=1+Math.max(0.05,Math.min(0.4,part.amount||0.15));
  g.setLineDash([5,5]);
  g.beginPath();g.arc(cx,cy,reach,0,Math.PI*2);g.stroke();
  g.beginPath();g.arc(cx,cy,reach*grow,0,Math.PI*2);g.stroke();
 }
 g.restore();
}
// ── 움직임 범위 안내(2026-10-05) ── 미리보기 재생 중에만 그린다. 저장·내보내기 프레임(buildLoop·save)은 render 를 거치지 않아 들어가지 않는다.
// 한 바퀴 동안 그림이 지나가는 범위를 점선 상자로, 칸 밖으로 나가는 쪽은 그 가장자리에 빨간 띠로 보여 준다. 앱 안의 안내이며 플랫폼 제출 규격이 아니다.
let extentCache=null;
function motionExtent(){
 if(!motion)return null;
 const L=loopSeconds(),us=clipTimes();let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 const step=(q,px,py)=>{const r=q.rot*Math.PI/180,ox=(px-q.px)*q.sx,oy=(py-q.py)*q.sy;return [q.px+q.dx+ox*Math.cos(r)-oy*Math.sin(r),q.py+q.dy+ox*Math.sin(r)+oy*Math.cos(r)];};
 for(const l of layers){
  if(!l.visible)continue;const hull=inkHull(l.bitmap);if(!hull)continue;
  // 레이어 자체 변환(위치·크기·회전)까지 건 네 모서리
  const lc=hull.map(([x,y])=>step({px:W/2,py:H/2,dx:l.x,dy:l.y,sx:l.scale,sy:l.scale,rot:l.rotation},x,y));
  for(const u of us){const d=deltaFor(l,L*u);if(!d||d.hidden)continue;for(const [x,y] of lc){const inner=d.part?step(d.part,x,y):[x,y],[rx,ry]=step(d,inner[0],inner[1]);if(rx<minX)minX=rx;if(ry<minY)minY=ry;if(rx>maxX)maxX=rx;if(ry>maxY)maxY=ry;}}
 }
 return minX===Infinity?null:{minX,minY,maxX,maxY};
}
function drawExtent(g){
 if(!motion||!playing)return;
 if(extentCache===null)extentCache=motionExtent()||false;
 const e=extentCache;if(!e)return;
 g.save();g.setLineDash([6,5]);g.lineWidth=1.5;g.strokeStyle='rgba(42,35,32,.45)';
 const x0=Math.max(1,e.minX),y0=Math.max(1,e.minY),x1=Math.min(W-1,e.maxX),y1=Math.min(H-1,e.maxY);
 g.strokeRect(x0,y0,x1-x0,y1-y0);g.setLineDash([]);g.fillStyle='rgba(214,69,65,.85)';
 if(e.minX<0)g.fillRect(0,0,4,H);if(e.maxX>W)g.fillRect(W-4,0,4,H);if(e.minY<0)g.fillRect(0,0,W,4);if(e.maxY>H)g.fillRect(0,H-4,W,4);
 g.restore();
}
// 그림 전체 크기(2026-10-05): 모든 그림 레이어를 칸 가운데를 축으로 함께 키우거나 줄인다. 레이어 사이 위치·비율이 그대로이고,
// 부분 움직임의 회전 중심·이동 경로·이동 거리도 같은 배율로 옮겨 움직임이 그림에 붙어 있다. 참고 사진·문구는 작품 레이어가 아니라 그대로 둔다.
// 픽셀을 다시 그리지 않는 레이어 변환이라 되돌리기로 정확히 돌아간다.
function scaleBounds(){let lo=0,hi=Infinity;for(const l of layers){lo=Math.max(lo,.1/l.scale);hi=Math.min(hi,4/l.scale);}return [lo,hi];}
function applyScaleAll(f){
 for(const l of layers){l.scale=l.scale*f;l.x=l.x*f;l.y=l.y*f;}
 if(motion&&motion.parts)motion=Object.assign({},motion,{parts:motion.parts.map(p=>{const q=Object.assign({},p,{pivotX:.5+(p.pivotX-.5)*f,pivotY:.5+(p.pivotY-.5)*f});
  if(Number.isFinite(p.fromX)&&Number.isFinite(p.toX)){q.fromX=.5+(p.fromX-.5)*f;q.toX=.5+(p.toX-.5)*f;q.fromY=.5+(p.fromY-.5)*f;q.toY=.5+(p.toY-.5)*f;}
  else if(p.effect==='move')q.amount=p.amount*f;return q;})});
}
// 문구도 함께(2026-10-07, 사용자 선택): 켜면 문구의 가운데를 칸 가운데 기준으로 같은 배율만큼 옮기고 크기도 같은 배율로 바꾼다
// (문구 크기는 손가락 조절과 같은 0.4~3배 안). 끄면 예전처럼 문구는 그대로. 되돌리기 한 번에 그림·문구가 함께 돌아간다.
function scaleCaption(f){
 if(!caption||!caption.text.trim())return;const s=captionSpot(ctx);if(!s)return;
 const cx=s.x,cy=s.box.y+s.box.h/2;
 caption.dx=(caption.dx||0)+(W/2+(cx-W/2)*f-cx);caption.dy=(caption.dy||0)+(H/2+(cy-H/2)*f-cy);
 caption.scale=Math.max(.4,Math.min(3,(caption.scale||1)*f));
}
function scaleAll(f,withCaption){const [lo,hi]=scaleBounds();f=Math.max(lo,Math.min(hi,f));if(!(f>0)||Math.abs(f-1)<1e-4)return false;checkpoint();applyScaleAll(f);if(withCaption)scaleCaption(f);extentCache=null;return true;}
// 칸 안에 맞추기: 움직이는 동안 칸 밖으로 나가지 않는 가장 큰 배율(지금보다 키우지는 않는다)을 찾아 한 번에 건다. 사용자가 누를 때만.
function fitMotion(){
 if(!motion||!motionClips())return 1;
 const keep={layers:layers.map(l=>({l,scale:l.scale,x:l.x,y:l.y})),motion};
 const reset=()=>{keep.layers.forEach(k=>{k.l.scale=k.scale;k.l.x=k.x;k.l.y=k.y;});motion=keep.motion;};
 let lo=Math.max(.2,scaleBounds()[0]),hi=1;
 for(let i=0;i<12;i++){const mid=(lo+hi)/2;applyScaleAll(mid);const c=motionClips();reset();if(c)hi=mid;else lo=mid;}
 applyScaleAll(lo);const ok=!motionClips();reset();
 if(!ok)return 0;
 scaleAll(lo);return lo;
}
function drawPivot(g){
 if(!pivotPick||!motion||!motion.parts)return;
 const part=motion.parts.find(p=>p.id===pivotPick);if(!part)return;
 const x=part.pivotX*W,y=part.pivotY*H;
 g.save();g.strokeStyle='#FF7A59';g.lineWidth=3;g.beginPath();g.arc(x,y,14,0,Math.PI*2);g.stroke();
 g.beginPath();g.moveTo(x-20,y);g.lineTo(x+20,y);g.moveTo(x,y-20);g.lineTo(x,y+20);g.stroke();g.restore();
}
function selectionOutline(g){
 if(playing)return;
 if(!selection&&!marquee)return;
 const box=selection?selection.box:selectionBox();
 if(!box)return;
 g.save();
 if(selection){
  const cx=box.x+box.w/2,cy=box.y+box.h/2;
  g.translate(cx+selection.dx,cy+selection.dy);g.rotate(selection.rot*Math.PI/180);
  g.scale(selection.scale*selection.flip,selection.scale);g.translate(-cx,-cy);
 }
 g.strokeStyle='#FF7A59';g.lineWidth=2;g.setLineDash([8,6]);
 g.strokeRect(box.x,box.y,box.w,box.h);
 if(selection){
  g.setLineDash([]);g.fillStyle='#FFFFFF';g.lineWidth=2;
  for(const [hx,hy] of corners(box)){g.beginPath();g.arc(hx,hy,7,0,Math.PI*2);g.fill();g.stroke();}
  const rx=box.x+box.w/2,ry=box.y-22;
  g.beginPath();g.moveTo(rx,box.y);g.lineTo(rx,ry+7);g.stroke();
  g.beginPath();g.arc(rx,ry,9,0,Math.PI*2);g.fill();g.stroke();
  g.beginPath();g.arc(rx,ry,4,-Math.PI*0.6,Math.PI*0.8);g.stroke();
 }
 g.restore();
}
// The four corners of a selection, in the order a hit test walks them.
function corners(box){return [[box.x,box.y],[box.x+box.w,box.y],[box.x+box.w,box.y+box.h],[box.x,box.y+box.h]];}
// Which handle, if any, a touch landed on. Works in the selection's own space so a rotated or
// scaled float is still grabbed where it is drawn.
function handleAt(p){
 if(!selection)return null;
 const box=selection.box,cx=box.x+box.w/2,cy=box.y+box.h/2;
 const a=-selection.rot*Math.PI/180,s=selection.scale||1;
 const dx=(p.x-selection.dx-cx),dy=(p.y-selection.dy-cy);
 const lx=(dx*Math.cos(a)-dy*Math.sin(a))/(s*selection.flip)+cx;
 const ly=(dx*Math.sin(a)+dy*Math.cos(a))/s+cy;
 const near=(x,y,r)=>Math.hypot(lx-x,ly-y)<=r/s;
 if(near(box.x+box.w/2,box.y-22,16))return 'rotate';
 const list=corners(box);
 for(let i=0;i<list.length;i++)if(near(list[i][0],list[i][1],16))return 'corner'+i;
 return null;
}
// Putting the float back down. The pixels land where they are shown, and the layer keeps them.
function applySelection(toNewLayer,why){
 if(!selection){trace('apply:noop',{why:why||'?'});return;}
 trace('apply',{why:why||'?',toNewLayer:!!toNewLayer});
 const target=toNewLayer?null:layers.find(l=>l.id===selection.layerId)||activeDraw();
 if(toNewLayer&&layers.length>=4){send({type:'error',message:'그림은 4장까지예요. 기존 그림에 적용해 주세요.'});return;}
 checkpoint();
 let into=target;
 if(toNewLayer){
  const id=nextLayerId();
  into={...defaults(id,layerName(id)),bitmap:bitmap()};
  layers.push(into);selectDrawLayer(id);
 }
 drawSelection(into.bitmap.getContext('2d'));
 selection=null;dirty=true;render();state();
}
// Putting it back exactly as it was: the lift and everything since is undone in one step.
function cancelSelection(why){
 trace('cancel',{why:why||'?'});
 if(!selection){marquee=null;render();state();return;}
 selection=null;marquee=null;
 if(history.length)restore(history.pop());
 else{render();state();}
}

function undo(){if(history.length){future.push(snapshot());dirty=true;restore(history.pop());}}
function redo(){if(future.length){history.push(snapshot());dirty=true;restore(future.pop());}}
function finishMulti(){
 if(!multi)return;const tap=!multi.moved&&Date.now()-multi.started<450,count=multi.maxCount;
 if(tap&&count>=3)redo();else if(tap&&count===2)undo();
 multi=null;suppressDraw=false;state();
}
canvas.addEventListener('pointerdown',e=>{
 if(loading||saving)return;
 if(e.pointerType==='touch'){
   touches.set(e.pointerId,touchPoint(e));
   if(touches.size>=2){e.preventDefault();pendingFill=null;pointer=null;cancelStrokeForGesture();beginMulti();return;}
   if(suppressDraw)return;
 }
 if(active)return;
 // 스포이드: 보이는 그림(참고·그림·문구)에서 한 점의 색을 읽는다. 선택 점선 같은 화면 표시는 섞지 않는다. 숨긴 그림을 골라 두었어도 막지 않는다.
 if(picking){e.preventDefault();const p0=point(e),sx=Math.max(0,Math.min(W-1,Math.floor(p0.x))),sy=Math.max(0,Math.min(H-1,Math.floor(p0.y)));const out=bitmap(),pg=out.getContext('2d',{willReadFrequently:true});references.forEach(r=>composite(pg,r));layers.forEach(x=>composite(pg,x));drawCaption(pg);const px=pg.getImageData(sx,sy,1,1).data;picking=false;send({type:'picked',color:px[3]<8?null:'#'+[px[0],px[1],px[2]].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase(),x:sx,y:sy});state();return;}
 // 문구는 캔버스 위의 물건이다: 글자를 누르면 고르고 그대로 끌어 옮긴다. 고른 뒤 손잡이를 끌면 크기,
 // 글자 밖을 누르면 선택이 끝나고 그 손가락은 그림을 그리지 않는다. 움직이기 미리보기 중·중심점 고르기 중에는 건드리지 않는다.
 if(caption&&caption.text.trim()&&!playing&&!pivotPick){const p0=point(e);
  const onHandle=captionPicked&&onCaptionHandle(p0),onText=!onHandle&&onCaption(p0);
  if(onHandle||onText||captionPicked){e.preventDefault();canvas.setPointerCapture(e.pointerId);pointer=e.pointerId;
   if(onHandle){const hp=handlePoint();captionHandle={cx:hp.cx,cy:hp.cy,reach:Math.max(1,Math.hypot(p0.x-hp.cx,p0.y-hp.cy)),scale:caption.scale||1,moved:false};return;}
   if(onText){captionDrag={from:p0,dx:caption.dx||0,dy:caption.dy||0,wasPicked:captionPicked,moved:false};if(!captionPicked){if(selection)applySelection(false,'captionPick');captionPicked=true;render();state();}return;}
   captionPicked=false;captionDismiss=true;render();state();return;
  }
 }
 const l=activeDraw();
 if(!l||!l.visible){if(l)send({type:'blocked',reason:'hidden',id:l.id,name:l.name});return;}
 e.preventDefault();canvas.setPointerCapture(e.pointerId);pointer=e.pointerId;
 if(tool==='fill'){pendingFill={clientX:e.clientX,clientY:e.clientY,...point(e)};return;}
 if(pivotPick){const p0=point(e);send({type:'pivot',id:pivotPick,x:Number((p0.x/W).toFixed(3)),y:Number((p0.y/H).toFixed(3)),role:pivotRole});return;}
 if(tool==='select'){const p0=point(e);trace('pointerdown',{x:Math.round(p0.x),y:Math.round(p0.y)});
  if(selection){const cx=selection.box.x+selection.box.w/2+selection.dx,cy=selection.box.y+selection.box.h/2+selection.dy;
   const handle=handleAt(p0);
   if(handle){grabbing={handle,scale:selection.scale,rot:selection.rot,reach:Math.max(1,Math.hypot(p0.x-cx,p0.y-cy)),angle:Math.atan2(p0.y-cy,p0.x-cx)*180/Math.PI};return;}
   const reach=Math.max(selection.box.w,selection.box.h)*selection.scale/2+12;
   const inside=Math.abs(p0.x-cx)<=reach&&Math.abs(p0.y-cy)<=reach;
   if(probe)send({type:'probe',at:'pointerdown',tool:tool,pointerType:e.pointerType,
     screen:{x:Math.round(e.clientX),y:Math.round(e.clientY)},canvas:{x:Math.round(p0.x),y:Math.round(p0.y)},
     rect:(function(){const r=canvas.getBoundingClientRect();return {x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};})(),
     box:{x:Math.round(selection.box.x),y:Math.round(selection.box.y),w:Math.round(selection.box.w),h:Math.round(selection.box.h)},
     centre:{x:Math.round(cx),y:Math.round(cy)},reach:Math.round(reach),
     dist:{x:Math.round(Math.abs(p0.x-cx)),y:Math.round(Math.abs(p0.y-cy))},
     handle:handle?handle:null,branch:handle?'grab':inside?'move':'newMarquee'});
   if(inside){dragging={from:p0,dx:selection.dx,dy:selection.dy};return;}
   applySelection(false,'pointerdown-outside');}
  marquee={x0:p0.x,y0:p0.y,x1:p0.x,y1:p0.y};render();return;}
 checkpoint(true);strokePending=true;active=true;last=point(e);steady=last;
 strokeTool=tool;                      // 이 획은 끝까지 이 도구로 그린다
 const P0=activePreset();lastPressure=penPressure(e);strokeLen=0;lastRaw=last;strokePath=[];
 strokeSeed=(Date.now()^Math.round(last.x*7919)^Math.round(last.y*104729))>>>0;resetRand();strokeSpeed=0;lastMoveAt=Date.now();
 dabAng=null;tapDot=null;ribbonLen=0;
 const soft=(strokeTool!=='eraser'&&!P0&&brush==='pencil')?PENCIL_ALPHA:1;
 wetAlpha=strokeTool==='eraser'?1:computeBrushAlpha(inkAlpha()*brushOpacity*(P0?P0.alpha:1)*soft,lastPressure,P0);wet=(P0||wetAlpha<1)?bitmap():null;wetLayer=wet?l.id:null;
 const p=local(last,l),g=(wet||l.bitmap).getContext('2d');style(g);
 if(P0&&P0.outline){strokePath=[p];drawOutline(g);}
 else if(P0&&P0.repath){strokePath=[p];redrawStroke(g,P0);}
 else if(P0&&P0.ribbon){strokePath=[];}
 // dab 브러시는 아직 방향을 모른다. 여기서 찍으면 가로로 누운 자국이 획 끝에 남는다(45.32).
 // 손가락이 움직이면 첫 구간이 이 자리부터 그린다. 움직이지 않고 떼면 end() 가 둥근 점 하나를 찍는다.
 else if(P0&&P0.dab){tapDot={x:p.x,y:p.y};}
 else if(P0&&P0.soft)softStamp(g,p.x,p.y,g.lineWidth);
 else{g.beginPath();g.arc(p.x,p.y,g.lineWidth/2,0,Math.PI*2);g.fill();}
 render();state();
});
canvas.addEventListener('pointermove',e=>{
 if(e.pointerType==='touch'&&touches.has(e.pointerId)){const old=touches.get(e.pointerId);touches.set(e.pointerId,{...old,x:e.clientX,y:e.clientY});}
 if(multi&&touches.size>=2){e.preventDefault();multi.maxCount=Math.max(multi.maxCount,touches.size);applyMulti();return;}
 if(pendingFill&&e.pointerId===pointer){const moved=Math.hypot(e.clientX-pendingFill.clientX,e.clientY-pendingFill.clientY);if(moved>16)pendingFill=null;return;}
 if(captionHandle&&e.pointerId===pointer&&caption){const p1=point(e),h=captionHandle;
  if(!h.moved){checkpoint();h.moved=true;}
  caption.scale=Math.max(.4,Math.min(3,h.scale*Math.hypot(p1.x-h.cx,p1.y-h.cy)/h.reach));
  dirty=true;render();return;}
 if(captionDrag&&e.pointerId===pointer&&caption){const p1=point(e);
  // 살짝 떨린 누름은 옮기기가 아니다. 움직이기 시작할 때 한 번만 되돌리기 지점을 남긴다.
  if(!captionDrag.moved){if(Math.hypot(p1.x-captionDrag.from.x,p1.y-captionDrag.from.y)<cssToCanvas(6))return;checkpoint();captionDrag.moved=true;}
  caption.dx=captionDrag.dx+(p1.x-captionDrag.from.x);caption.dy=captionDrag.dy+(p1.y-captionDrag.from.y);clampCaption();
  dirty=true;render();return;}
 if(captionDismiss&&e.pointerId===pointer)return;
 if(tool==='select'&&e.pointerId===pointer){const p1=point(e);
  if(grabbing){
   const box=selection.box,cx=box.x+box.w/2+selection.dx,cy=box.y+box.h/2+selection.dy;
   if(grabbing.handle==='rotate'){
    const now=Math.atan2(p1.y-cy,p1.x-cx)*180/Math.PI;
    selection.rot=Math.round((grabbing.rot+(now-grabbing.angle))*10)/10;
   }else{
    const reach=Math.hypot(p1.x-cx,p1.y-cy)/(grabbing.reach||1);
    selection.scale=Math.max(.2,Math.min(4,grabbing.scale*reach));
   }
   dirty=true;render();return;
  }
  if(dragging){selection.dx=dragging.dx+(p1.x-dragging.from.x);selection.dy=dragging.dy+(p1.y-dragging.from.y);dirty=true;render();return;}
  if(marquee){marquee.x1=p1.x;marquee.y1=p1.y;render();return;}}
 if(!active||e.pointerId!==pointer)return;e.preventDefault();const l=activeDraw(),raw=point(e);if(!l)return;
 lastPressure=penPressure(e);lastRaw=raw;
 if(smoothing){const k=STAB[stabilizer]||.55;steady={x:steady.x+(raw.x-steady.x)*k,y:steady.y+(raw.y-steady.y)*k};}else{steady=raw;}const p=steady;
 // 손가락에는 압력이 없다. 대신 속도를 재서 굵기 반응에 쓴다(급격히 튀지 않게 이어 붙인다).
 {const now=Date.now(),dt=Math.max(8,now-lastMoveAt),v=Math.hypot(p.x-last.x,p.y-last.y)/dt*16;
  strokeSpeed=strokeSpeed*.7+v*.3;lastMoveAt=now;}
 inkSegment(l,last,p);
 dirty=true;last=p;render();
});
// 한 구간을 그린다. 무료 펜/붓/연필은 예전 그대로(3px 간격 선분 + 연필 입자), PRO 프리셋만 분기를 탄다.
function inkSegment(l,fromP,toP){
 const a=local(fromP,l),b=local(toP,l),g=(wet||l.bitmap).getContext('2d');style(g);const P=activePreset();
 if(P&&P.outline){strokePath.push(b);strokeLen+=Math.hypot(b.x-a.x,b.y-a.y);drawOutline(g);return;}
 // 45.31 재료층. repath 는 획 전체를 매번 다시 긋는다(마커 빗살·평행선). dab 은 경로 위에 찍는다.
 if(P&&P.repath){strokePath.push(b);strokeLen+=Math.hypot(b.x-a.x,b.y-a.y);redrawStroke(g,P);return;}
 if(P&&P.ribbon){
  const d=Math.hypot(b.x-a.x,b.y-a.y);strokeLen+=d;ribbonLen+=d;
  if(!strokePath.length)strokePath.push({x:a.x,y:a.y,s:0,v:0});
  strokePath.push({x:b.x,y:b.y,s:ribbonLen,v:Math.max(0,Math.min(1,strokeSpeed/26))});
  redrawRibbon(g,P);return;}
 if(P&&P.dab){
  if(P.glow)stampSegment(g,a,b,P,{r:P.glow,hard:.08,op:.1,per:2.4});
  strokeLen+=stampSegment(g,a,b,P,P.dab);return;}
 // Pointer events can arrive several pixels apart on Android. Fill the gap with
 // short connected segments so brush and pencil strokes never render as dots.
 const distance=Math.hypot(b.x-a.x,b.y-a.y),spacing=P&&P.soft?Math.max(.8,g.lineWidth*.18):3,steps=Math.max(1,Math.ceil(distance/spacing));
 let from=a;
 for(let i=1;i<=steps;i++){
   const t=i/steps,to={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
   if(P){strokeLen+=Math.hypot(to.x-from.x,to.y-from.y);style(g);}
   if(P&&P.soft)softStamp(g,to.x,to.y,g.lineWidth);
   else{g.beginPath();g.moveTo(from.x,from.y);g.lineTo(to.x,to.y);g.stroke();}
   if(!P)grain(g,from,to);
   from=to;
 }
}
// 자리마다 굵기가 다른 띠. 선분마다 굵기를 바꿔 이어 그으면 단이 지므로, 양쪽 가장자리를 따로 잇고
// 한 번에 채운다. 끝은 둥글게 마감해 바늘 끝이 생기지 않는다(45.32).
function ribbon(g,pts){
 if(pts.length<2){const p=pts[0];if(p){g.beginPath();g.arc(p.x,p.y,Math.max(.4,p.w/2),0,Math.PI*2);g.fill();}return;}
 const L=[],R=[];
 for(let i=0;i<pts.length;i++){
  const p=pts[i],a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
  const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,h=Math.max(.3,p.w/2);
  L.push([p.x+nx*h,p.y+ny*h]);R.push([p.x-nx*h,p.y-ny*h]);
 }
 g.beginPath();g.moveTo(L[0][0],L[0][1]);
 for(let i=1;i<L.length;i++)g.lineTo(L[i][0],L[i][1]);
 for(let i=R.length-1;i>=0;i--)g.lineTo(R[i][0],R[i][1]);
 g.closePath();g.fill();
 for(const p of [pts[0],pts[pts.length-1]]){g.beginPath();g.arc(p.x,p.y,Math.max(.3,p.w/2),0,Math.PI*2);g.fill();}
}
// 획 전체를 띠로 다시 그린다. 양 끝이 가늘어지고, 자리마다 굵기가 이어져 단이 지지 않는다.
function redrawRibbon(g,P){
 const B=P.ribbon;if(!strokePath.length)return;
 g.save();g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);g.fillStyle=solid(color);
 const W0=g.lineWidth;
 const total=strokePath[strokePath.length-1].s||0;
 // 테이퍼 길이가 고정이면 짧은 획은 **전부가 테이퍼**가 되어 나뭇잎·바늘 모양이 된다(45.32 결함).
 // 양 끝 테이퍼를 획 길이의 30% 로 묶는다 — 아무리 짧아도 가운데 40% 는 제 굵기를 낸다.
 const taper=Math.max(1,Math.min(B.taper??12,total*.3));
 // 게다가 끝 굵기의 바닥값도 획 길이를 따른다. 긴 획은 제 특징대로 뾰족하게 빠지고,
 // 손글씨처럼 짧은 획은 끝이 뭉툭하다 — 모든 짧은 획을 일률로 뾰족하게 만들지 않는다.
 const nominal=Math.max(1,B.taper??12);
 const short=1-Math.max(0,Math.min(1,total/(nominal*3)));
 const floor=(B.floor??.2)+(1-(B.floor??.2))*short;
 const pts=strokePath.map(p=>{
  // 양 끝에서 가늘어진다. 뿌리(sqrt)를 써서 갑자기 굵어지지 않는다.
  const near=Math.min(p.s,total-p.s);
  let k=floor+(1-floor)*Math.sqrt(Math.max(0,Math.min(1,near/taper)));
  if(B.wobble)k*=1+B.wobble*wave(p.s,strokeSeed&255);
  if(B.speed)k*=1-B.speed*p.v;
  return {x:p.x,y:p.y,w:Math.max(.6,W0*Math.max(.08,k))};
 });
 ribbon(g,pts);g.restore();
}
// 획 전체를 한 path 로 다시 긋는다. 구간마다 따로 stroke 하면 굽은 자리에서 토막이 벌어져 톱니가 남는다
// (45.30 에서 잰 값: 거칠기 1.78 → 1.10). 입자가 없는 브러시만 이 길을 탄다 — 다시 그려도 결과가 같다.
function redrawStroke(g,P){
 if(!strokePath.length)return;
 resetRand();
 g.save();g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);
 g.lineJoin='round';g.strokeStyle=solid(color);g.fillStyle=solid(color);
 const lines=P.parallel?P.parallel:1,gap=(P.gap??.9)*g.lineWidth;
 for(let k=0;k<lines;k++){
  const off=lines===1?0:(k/(lines-1)-.5)*2*gap*(lines-1)/2;
  g.beginPath();
  if(strokePath.length===1){g.arc(strokePath[0].x,strokePath[0].y,g.lineWidth/2,0,Math.PI*2);g.fill();}
  else for(let i=0;i<strokePath.length;i++){
   const p=strokePath[i];
   // 곡선 법선 방향으로 밀어 평행선을 만든다. 끝점은 이웃 점으로 방향을 잡는다.
   const q=strokePath[Math.min(strokePath.length-1,i+1)],o=strokePath[Math.max(0,i-1)];
   const dx=q.x-o.x,dy=q.y-o.y,len=Math.hypot(dx,dy)||1;
   const x=p.x+(-dy/len)*off,y=p.y+(dx/len)*off;
   if(i===0)g.moveTo(x,y);else g.lineTo(x,y);
  }
  if(strokePath.length>1)g.stroke();
 }
 g.restore();
}
// 테두리 펜: 지금까지의 획을 통째로 다시 긋고 가운데를 파낸다 — 속이 빈 선이 남는다.
// 구간마다 덧칠하면 앞 구간에 뚫어 둔 속을 다음 구간의 바깥선이 메우므로, 매번 처음부터 다시 그린다.
function drawOutline(g){
 const P=activePreset();if(!P||!strokePath.length)return;
 g.save();g.globalCompositeOperation='source-over';g.clearRect(0,0,W,H);
 const path=()=>{g.beginPath();g.moveTo(strokePath[0].x,strokePath[0].y);for(let i=1;i<strokePath.length;i++)g.lineTo(strokePath[i].x,strokePath[i].y);};
 g.lineCap='round';g.lineJoin='round';g.strokeStyle=solid(color);
 const outer=g.lineWidth;
 if(strokePath.length===1){g.beginPath();g.arc(strokePath[0].x,strokePath[0].y,outer/2,0,Math.PI*2);g.fill();}
 else{path();g.stroke();}
 const inner=Math.max(.5,outer-2*Math.max(.6,outer*P.outline*.34));
 g.globalCompositeOperation='destination-out';g.lineWidth=inner;
 if(strokePath.length===1){g.beginPath();g.arc(strokePath[0].x,strokePath[0].y,inner/2,0,Math.PI*2);g.fill();}
 else{path();g.stroke();}
 g.restore();
}
// 부드러운 펜: 가장자리로 갈수록 옅어지는 둥근 도장을 촘촘히 찍는다. 가운데는 겹쳐 차오르고 가장자리만 부드럽다.
// ── 재료층(45.31) ─────────────────────────────────────────────────────────────────────────────
// 원본 MyPaint 브러시(.myb)는 이 엔진에 그대로 들어가지 않는다. 그래서 **국소 알고리즘만** 옮겼다:
// 경로 위에 타원 dab 을 촘촘히 찍고, dab 마다 반지름·단단함·진하기·기울기·흔들림을 준다.
// 원본에서 읽은 값(radius·hardness·opaque·dabs_per_radius·offset_by_random·elliptical ratio/angle)을
// 출발점으로 삼되 손가락 입력에 맞게 다시 정했다. libmypaint: ISC(licenses/ 참조).
//
// dab 한 개. hard 가 1 이면 또렷한 원, 낮을수록 가장자리가 부드럽다. ratio 는 납작한 정도, ang 은 기울기(라디안).
function dabAt(g,x,y,r,hard,op,ratio,ang){
 if(!(r>.2)||!(op>0))return;
 const c=rgba(color),s='rgba('+c[0]+','+c[1]+','+c[2]+',';
 g.save();g.globalAlpha=Math.max(0,Math.min(1,op));
 g.translate(x,y);if(ang)g.rotate(ang);if(ratio&&ratio!==1)g.scale(1,1/ratio);
 if(hard>=.995){g.fillStyle=solid(color);}
 else{const grad=g.createRadialGradient(0,0,0,0,0,r);grad.addColorStop(0,s+'1)');grad.addColorStop(Math.max(0,Math.min(.97,hard)),s+'1)');grad.addColorStop(1,s+'0)');g.fillStyle=grad;}
 g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.fill();g.restore();
}
// 한 구간에 dab 을 줄지어 찍는다. 굵기는 style() 이 정한 lineWidth 의 절반을 기준 반지름으로 쓴다.
function stampSegment(g,a,b,P,D){
 const base=g.lineWidth/2*(D.r??1);
 const dist=Math.hypot(b.x-a.x,b.y-a.y);
 const per=D.per??2.2;                                   // dabs_per_actual_radius
 const step=Math.max(.3,base/Math.max(.5,per));
 const n=Math.max(1,Math.ceil(dist/step));
 const ux=dist?(b.x-a.x)/dist:1,uy=dist?(b.y-a.y)/dist:0; // 진행 방향
 const nx=-uy,ny=ux;                                      // 법선
 const dirAng=Math.atan2(uy,ux);
 const bristles=Math.max(1,D.bristles??1);
 // 급회전에서 납작한 dab 이 바깥으로 삐져나와 톱니(톱날)가 된다. 도는 정도를 재서 그만큼 둥글게 눕힌다.
 // 도는 반지름 R ≈ 간 거리 / 방향이 바뀐 각. R 이 dab 반지름보다 작으면 납작함을 버린다.
 let turn=0;
 if(dabAng!==null){let d=dirAng-dabAng;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;turn=Math.abs(d);}
 if(dist>0.01)dabAng=dirAng;
 for(let i=1;i<=n;i++){
  const t=i/n,px=a.x+(b.x-a.x)*t,py=a.y+(b.y-a.y)*t;
  // 속도에 따른 굵기(손가락에는 압력이 없다). fast 가 1 에 가까울수록 빠르다.
  const fast=Math.max(0,Math.min(1,strokeSpeed/26));
  let r=base;
  if(D.speed)r*=1-D.speed*fast;
  if(P.taper)r*=Math.min(1,.3+.7*strokeLen/P.taper);
  let op=D.op??1,hard=D.hard??.9;
  // 작은 굵기에서는 옅고 무른 dab 이 서로 닿지 않아 선이 끊겨 보인다. 반지름이 4px 아래로 내려갈수록
  // 단단하고 진하게 보정한다 — 큰 굵기의 결은 그대로 두고 작은 글씨만 또렷해진다.
  if(base<4){const k=Math.max(0,Math.min(1,(4-base)/3));hard=hard+(1-hard)*k*.8;op=Math.min(1,op*(1+k*1.1));}
  if(D.opRand)op*=1-D.opRand*rand();
  let ang=0,ratio=D.ratio??1;
  if(ratio>1&&turn>0.02&&dist>0.01){
   const R=(dist/Math.max(1,n))/Math.max(1e-4,turn/Math.max(1,n));   // 도는 반지름
   const k=Math.max(0,Math.min(1,(R-base)/(2*base)));
   ratio=1+(ratio-1)*k;
  }
  if(D.angle==='dir')ang=dirAng+Math.PI/2;
  else if(D.angle==='along')ang=dirAng;
  else if(D.angle==='rnd')ang=rand()*Math.PI*2;
  else if(typeof D.angle==='number')ang=D.angle*Math.PI/180;
  if(D.nib===undefined)for(let bIdx=0;bIdx<bristles;bIdx++){
   let ox=0,oy=0,br=r,bop=op;
   if(bristles>1){
    // 붓털: 법선 방향으로 고르게 벌려 놓고 털마다 굵기·진하기를 조금씩 다르게 한다(획 내내 같은 털).
    const u=bristles===1?0:(bIdx/(bristles-1)-.5)*2;
    ox=nx*u*base*(D.spread??.85);oy=ny*u*base*(D.spread??.85);
    br=base*(D.hair??.22)*(.6+bristleR[bIdx%bristleR.length]*.8);
    bop=op*(.45+bristleA[bIdx%bristleA.length]*.55);
   }
   if(D.jitter){const j=D.jitter*base;ox+=(rand()-.5)*2*j;oy+=(rand()-.5)*2*j;}
   if(D.scatter){const ang2=rand()*Math.PI*2,rad=Math.sqrt(rand())*D.scatter*base;ox+=Math.cos(ang2)*rad;oy+=Math.sin(ang2)*rad;
    if(D.sizeRand)br=br*(1-D.sizeRand+D.sizeRand*2*rand());}
   if(D.drop&&rand()<D.drop)continue;             // 마른 붓: 군데군데 닿지 않는다
   dabAt(g,px+ox,py+oy,br,hard,bop,ratio,ang);
  }
  // 납작 팁: 진행 방향과 팁 각도가 이루는 각으로 굵기가 달라진다(가로획은 굵고 세로획은 가늘게).
  if(D.nib!==undefined){
   const nib=D.nib*Math.PI/180,w=Math.abs(Math.sin(dirAng-nib));
   dabAt(g,px,py,base*(.4+.6*w),.97,op,D.nibRatio??6,nib+Math.PI/2);
  }
 }
 return dist;
}
// 붓털마다 고정된 굵기·진하기. 획이 다시 그려져도 같은 털이 같은 자리에 난다.
const bristleR=[.42,.91,.23,.77,.58,.12,.95,.35,.68,.05,.82,.49];
const bristleA=[.71,.24,.88,.45,.13,.97,.36,.62,.08,.79,.52,.31];
function softStamp(g,x,y,w){const r=Math.max(1,w/2),c=rgba(color),s='rgba('+c[0]+','+c[1]+','+c[2]+',';const grad=g.createRadialGradient(x,y,0,x,y,r);grad.addColorStop(0,s+'0.5)');grad.addColorStop(.55,s+'0.32)');grad.addColorStop(1,s+'0)');g.save();g.globalAlpha=1;g.fillStyle=grad;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();g.restore();}
function end(e){if(tool==='select')trace(e.type==='pointercancel'?'pointercancel':'pointerup',{id:e.pointerId,matched:e.pointerId===pointer});
 if(e.pointerType==='touch'&&touches.has(e.pointerId))touches.delete(e.pointerId);
 if(multi){if(touches.size===0)finishMulti();return;}
 if(e.pointerId!==pointer)return;
 if(captionHandle){captionHandle=null;pointer=null;state();return;}
 if(captionDismiss){captionDismiss=false;pointer=null;return;}
 // 이미 고른 문구를 움직이지 않고 한 번 더 누르면 내용 고치기.
 if(captionDrag){const d=captionDrag;captionDrag=null;pointer=null;if(!d.moved&&d.wasPicked)send({type:'captionEdit'});state();return;}
 if(pendingFill){const spot=pendingFill;pendingFill=null;pointer=null;fillAt(spot);state();return;}
 if(tool==='select'){pointer=null;if(grabbing){grabbing=null;state();return;}if(dragging){dragging=null;state();return;}if(marquee){liftSelection();}return;}
 if(active){
  // 중·강 보정은 손가락보다 선이 늦게 따라온다. 손을 뗄 때 남은 거리를 이어 그려 선 끝을 잃지 않는다(약·끔은 예전 그대로).
  // 보정이 셀수록 선이 손가락보다 뒤처진다. 남은 거리를 **한 번에 직선으로 잇지 않고** 몇 걸음에 나눠
  // 따라붙인다 — 한 번에 이으면 획 끝에 곧은 꼬리(혹)가 남는다(45.32).
  if(smoothing&&stabilizer!=='light'&&lastRaw&&steady&&Math.hypot(lastRaw.x-steady.x,lastRaw.y-steady.y)>.5){
   const l=layers.find(x=>x.id===wetLayer)||activeDraw();
   if(l){let from=steady;for(let i=1;i<=4;i++){const t=i/4,to={x:steady.x+(lastRaw.x-steady.x)*t,y:steady.y+(lastRaw.y-steady.y)*t};inkSegment(l,from,to);from=to;}last=lastRaw;}}
  // 움직이지 않고 뗀 손가락: 방향이 없으므로 둥근 점 하나를 찍는다.
  if(tapDot){const P1=activePreset(),l=layers.find(x=>x.id===wetLayer)||activeDraw();
   if(P1&&l){const g=(wet||l.bitmap).getContext('2d');style(g);
    dabAt(g,tapDot.x,tapDot.y,g.lineWidth/2*((P1.dab&&P1.dab.r)||1),(P1.dab&&P1.dab.hard)||.9,(P1.dab&&P1.dab.op)||1,1,0);}
   tapDot=null;}
  dry();
 }
 if(strokePending){future=[];strokePending=false;}active=false;pointer=null;steady=null;strokeTool=null;state();
}
canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
function image(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('이미지를 열 수 없습니다.'));i.src=src;});}
async function loadLayer(l){const b=bitmap();if(l.data){const i=await image(l.data),scale=Math.min(W/i.width,H/i.height),w=i.width*scale,h=i.height*scale;b.getContext('2d').drawImage(i,(W-w)/2,(H-h)/2,w,h);}return {...defaults(l.id,l.name),...l,bitmap:b,data:undefined};}
function metrics(c){const g=c.getContext('2d',{willReadFrequently:true}),w=c.width,h=c.height,d=g.getImageData(0,0,w,h).data;let n=0,xs=0,ys=0,minX=w,minY=h,maxX=0,maxY=0,r=0,green=0,b=0,transparent=false;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4;if(d[k+3]<255)transparent=true;if(d[k+3]>16){n++;xs+=x;ys+=y;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);r+=d[k];green+=d[k+1];b+=d[k+2];}}return {coverage:n/(w*h),centerX:n?xs/n/w:.5,centerY:n?ys/n/h:.5,width:n?(maxX-minX+1)/w:0,height:n?(maxY-minY+1)/h:0,color:n?[r/n/255,green/n/255,b/n/255]:[0,0,0],transparent};}
async function command(m){try{
 // 조용한 자동저장이 도는 동안에도 **다음 획의 준비**는 받아야 한다. 아래 명령은 그림(레이어 비트맵)을
 // 건드리지 않고 '다음에 무엇으로 그릴지'만 정하므로 저장 결과를 흐트러뜨리지 않는다.
 // 이걸 버리면 지우개 → 펜 전환이 조용히 사라져 다음 획이 지워진다(45.34에서 픽셀로 재현).
 // 저장은 시작할 때 선택을 이미 확정하므로(applySelection) 저장 중 'tool' 이 그림을 바꿀 일은 없다.
 const SAFE_WHILE_SAVING=['saved','saveFailed','analyze','save','tool','brush','brushSettings','color','width'];
 if(saving&&!SAFE_WHILE_SAVING.includes(m.type))return;
 if(m.type==='init'){
   loading=true;const input=m.layers||[{...defaults('draw-1','그림 1'),data:m.drawing}];
   if(m.color)color=m.color;if(m.brush)applyBrush(m.brush);if(Number.isFinite(m.penWidth))penWidth=m.penWidth;if(Number.isFinite(m.eraserWidth))eraserWidth=m.eraserWidth;
   layers=await Promise.all(input.map(l=>loadLayer(l)));frames=null;frameIdx=0;
   if(Array.isArray(m.frames)&&m.frames.length>1){frames=await Promise.all(m.frames.map(async f=>({id:f.id,duration:f.duration,layers:await Promise.all(f.layers.map(l=>loadLayer(l)))})));layers=frames[0].layers;}
   references=await Promise.all((m.references||[]).map(l=>loadLayer(l)));activeLayerId=m.activeLayerId||'draw-1';if(!layers.some(l=>l.id===activeLayerId))activeLayerId=layers[0]?.id||'';activeDrawLayerId=activeLayerId;activeReferenceId=null;wet=null;wetLayer=null;picking=false;caption=m.caption||null;motion=m.motion||motion;history=[];future=[];dirty=false;loading=false;render();state();send({type:'initialized',id:m.id});
 }
 if(m.type==='tool'){if(selection&&m.tool!=='select')applySelection(false,'toolChange:'+m.tool);tool=m.tool;}
 if(m.type==='brush')brush=m.brush;
 if(m.type==='color')color=m.color;
 if(m.type==='eyedrop'){picking=!!m.on;state();}
 if(m.type==='sample'){const vr=viewport.getBoundingClientRect(),r=canvas.getBoundingClientRect();
  const cx=vr.left+m.vx*vr.width,cy=vr.top+m.vy*vr.height;
  const sx=Math.max(0,Math.min(W-1,Math.floor((cx-r.left)*W/r.width))),sy=Math.max(0,Math.min(H-1,Math.floor((cy-r.top)*H/r.height)));
  const out=bitmap(),pg=out.getContext('2d',{willReadFrequently:true});references.forEach(l=>composite(pg,l));layers.forEach(l=>composite(pg,l));drawCaption(pg);
  const px=pg.getImageData(sx,sy,1,1).data;
  send({type:'sampled',color:px[3]<8?null:'#'+[px[0],px[1],px[2]].map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase()});return;}
 if(m.type==='brushSettings'){applyBrush(m);state();}
 if(m.type==='width'){if(m.tool==='eraser')eraserWidth=m.width;else penWidth=m.width;}
 if(m.type==='zoom'){zoom=Math.max(1,Math.min(4,m.zoom));size();send({type:'zoom',zoom});}
 if(m.type==='select'){const l=layers.find(l=>l.id===m.id);if(l){selectDrawLayer(l.id);state();}}
 if(m.type==='setActiveReference'){const ref=references.find(l=>l.id===m.id);activeReferenceId=ref?.id||null;state();}
 if(m.type==='toggleReference'){
   const target=references.find(l=>l.id===m.id);if(target){checkpoint();const turnOff=target.visible&&activeReferenceId===target.id;references.forEach(l=>l.visible=false);if(turnOff){activeReferenceId=null;}else{target.visible=true;activeReferenceId=target.id;}render();state();}
 }
 if(m.type==='transform'){const l=[...layers,...references].find(l=>l.id===(m.id||activeLayerId));if(l){checkpoint();extentCache=null;for(const k of ['x','y','rotation'])if(Number.isFinite(m[k]))l[k]=m[k];if(Number.isFinite(m.scale))l.scale=Math.max(.1,Math.min(4,m.scale));if(Number.isFinite(m.opacity))l.opacity=Math.max(0,Math.min(1,m.opacity));if(typeof m.visible==='boolean')l.visible=m.visible;render();state();}}
 if(m.type==='addReferences'){const added=await Promise.all(m.references.map(l=>loadLayer(l)));checkpoint();references.push(...added);if(!activeReferenceId&&added[0]){references.forEach(l=>l.visible=false);added[0].visible=true;activeReferenceId=added[0].id;}render();state();}
 if(m.type==='removeReference'){const index=references.findIndex(l=>l.id===m.id);if(index>=0){checkpoint();const removed=references[index];references.splice(index,1);if(activeReferenceId===removed.id)activeReferenceId=null;render();state();}}
 if(m.type==='undo')undo();
 if(m.type==='redo')redo();
 if(m.type==='removeLayer'){
  const i=layers.findIndex(l=>l.id===m.id);
  if(i>=0&&layers.length>1){
   checkpoint();
   layers.splice(i,1);
   if(motion&&motion.parts){const left=motion.parts.filter(p=>p.layerId!==m.id);motion=Object.assign({},motion,{parts:left.length?left:undefined});}
   if(motion&&motion.alternate){const poseB=motion.alternate.poseB.filter(id=>id!==m.id);motion=Object.assign({},motion,{alternate:Object.assign({},motion.alternate,{poseB})});}
   selectDrawLayer(layers[Math.max(0,i-1)].id);
   dirty=true;render();state();
  }
 }
 if(m.type==='duplicateLayer'){
   const src=layers.find(l=>l.id===m.id)||activeDraw();
   if(!src){}
   else if(layers.length>=4){send({type:'error',message:'그림은 4장까지예요. 한 장을 지우고 다시 해 주세요.'});}
   else{checkpoint();const id=nextLayerId();
    const copy={...defaults(id,layerName(id)),bitmap:copyOf(src.bitmap)};
    layers.push(copy);selectDrawLayer(id);dirty=true;render();
    send({type:'duplicated',id});state();}
 }
 if(m.type==='importDrawing'){
   if(layers.length>=4){send({type:'error',message:'그림은 4장까지예요.'});}
   else{checkpoint();const id=nextLayerId();
    const added=await loadLayer({...defaults(id,layerName(id)),data:m.data});
    layers.push(added);selectDrawLayer(id);dirty=true;render();state();}
 }
 if(m.type==='addLayer'){if(layers.length<4){checkpoint();
   const wanted=typeof m.id==='string'&&m.id&&!layers.some(l=>l.id===m.id)?m.id:nextLayerId();
   const l={...defaults(wanted,wanted===m.id&&m.name?m.name:layerName(wanted)),bitmap:bitmap()};
   layers.push(l);selectDrawLayer(l.id);render();state();}}
 if(m.type==='moveLayer'){
   const i=layers.findIndex(l=>l.id===m.id);
   if(i>=0){const to=Math.max(0,Math.min(layers.length-1,i+(m.by>0?1:-1)));
    if(to!==i){checkpoint();const moved=layers.splice(i,1)[0];layers.splice(to,0,moved);dirty=true;render();state();}}
 }
 if(m.type==='renameLayer'){const l=layers.find(x=>x.id===m.id);if(l&&typeof m.name==='string'&&m.name.trim()){checkpoint();l.name=m.name.trim().slice(0,12);dirty=true;state();}}
 if(m.type==='selectionImage'){
  if(!selection){send({type:'selectionImage',id:m.id,message:'고른 부분이 없어요.'});}
  else{
   const box=selection.box,cut=document.createElement('canvas');
   cut.width=Math.max(1,Math.round(box.w));cut.height=Math.max(1,Math.round(box.h));
   cut.getContext('2d').drawImage(selection.bitmap,box.x,box.y,box.w,box.h,0,0,cut.width,cut.height);
   send({type:'selectionImage',id:m.id,data:cut.toDataURL('image/png'),width:cut.width,height:cut.height});
  }
 }
 if(m.type==='focusPart'){focusLayerId=m.layerId||null;render();}
 // 부분 움직임 중심점 추정(2026-10-15): 그 레이어 그림을 감싼 상자에서 **캔버스 가운데(몸 쪽)에 가장 가까운 변의 가운데**.
 // 오른쪽에 붙은 팔 → 왼쪽 변(어깨), 머리 위 귀 → 아래 변(귀뿌리). 추정일 뿐이라 화면에서 '중심점 옮기기'로 고친다.
 if(m.type==='partGuess'){
  const l=layers.find(x=>x.id===m.layerId);const hull=l&&inkHull(l.bitmap);
  if(!l||!hull||!hull.length){send({type:'partGuess',id:m.id,found:false});return;}
  const r=l.rotation*Math.PI/180,pt=([x,y])=>{const ox=(x-W/2)*l.scale,oy=(y-H/2)*l.scale;return [W/2+l.x+ox*Math.cos(r)-oy*Math.sin(r),H/2+l.y+ox*Math.sin(r)+oy*Math.cos(r)];};
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const q of hull.map(pt)){x0=Math.min(x0,q[0]);y0=Math.min(y0,q[1]);x1=Math.max(x1,q[0]);y1=Math.max(y1,q[1]);}
  const cx=(x0+x1)/2,cy=(y0+y1)/2,edges=[[x0,cy],[x1,cy],[cx,y0],[cx,y1]];
  const best=edges.reduce((b,e)=>Math.hypot(e[0]-W/2,e[1]-H/2)<Math.hypot(b[0]-W/2,b[1]-H/2)?e:b);
  // 레이어가 캔버스를 거의 다 덮으면(몸 전체 등) 가운데로 둔다.
  const whole=(x1-x0)>W*.8&&(y1-y0)>H*.8;
  send({type:'partGuess',id:m.id,found:true,x:whole?.5:Math.max(0,Math.min(1,best[0]/W)),y:whole?.5:Math.max(0,Math.min(1,best[1]/H)),box:[x0/W,y0/H,x1/W,y1/H]});
 }
 if(m.type==='layerThumbs'){
  const size=m.size||72;
  send({type:'layerThumbs',thumbs:layers.map(function(l){
   const c=document.createElement('canvas');c.width=c.height=size;
   c.getContext('2d').drawImage(l.bitmap,0,0,W,H,0,0,size,size);
   return {id:l.id,data:c.toDataURL('image/png')};
  })});
 }
 if(m.type==='smooth'){smoothing=m.on!==false;state();}
 if(m.type==='clear'){const l=activeDraw();if(l){checkpoint();l.bitmap.getContext('2d').clearRect(0,0,W,H);render();state();}}
 if(m.type==='caption'){checkpoint();const face=['basic','serif','thick'].indexOf(m.caption&&m.caption.style)>=0?m.caption.style:(caption&&caption.style)||'basic';
  caption=m.caption&&m.caption.text.trim()?{...(caption||{}),text:m.caption.text,place:m.caption.place==='top'?'top':'bottom',color:m.caption.color||caption?.color||'#242424',style:face}:null;dirty=true;render();state();}
 // An explicit copy of another cut. Every bitmap is decoded fresh here, so editing or clearing
 // the copy can never reach back into the drawing it came from.
 if(m.type==='copyWork'){
   checkpoint();
   const copied=await Promise.all((m.layers||[]).map(l=>loadLayer(l)));
   if(copied.length){layers=copied;selectDrawLayer(copied[0].id);}
   caption=m.caption?{...m.caption}:null;dirty=true;render();state();
 }
 // Movement is set, previewed and exported from the same numbers, so what plays is what ships.
 if(m.type==='selectTransform'&&selection){
  if(Number.isFinite(m.dx))selection.dx+=m.dx;if(Number.isFinite(m.dy))selection.dy+=m.dy;
  if(Number.isFinite(m.scale))selection.scale=Math.max(.2,Math.min(4,selection.scale*m.scale));
  if(Number.isFinite(m.rot))selection.rot+=m.rot;
  if(m.flip)selection.flip*=-1;
  dirty=true;render();state();}
 if(m.type==='pivotPick'){pivotPick=m.id||null;pivotRole=m.role||'pivot';state();}
 if(m.type==='selectApply'&&selection){applySelection(!!m.toNewLayer,'message');}
 if(m.type==='selectCancel'){cancelSelection('message');}
 // 문구를 고른다. 그림 선택이 열려 있으면 먼저 내려놓는다 — 둘을 동시에 고르면 무엇을 만지는지 모른다.
 if(m.type==='captionPick'){if(selection)applySelection(false,'captionPick');captionPicked=!!m.on&&!!(caption&&caption.text.trim());render();state();}
 // 손가락으로 옮기기·크기·회전. 값은 문구 자체에 쌓이므로 저장·재실행·출력까지 그대로 따라간다.
 if(m.type==='captionTransform'&&caption){
  checkpoint();
  if(m.dx!==undefined)caption.dx=(caption.dx||0)+m.dx;
  if(m.dy!==undefined)caption.dy=(caption.dy||0)+m.dy;
  if(m.scale!==undefined)caption.scale=Math.max(.4,Math.min(3,(caption.scale||1)*m.scale));
  if(m.rot!==undefined)caption.rot=Math.round(((caption.rot||0)+m.rot)*10)/10;
  if(m.reset){caption.dx=0;caption.dy=0;caption.scale=1;caption.rot=0;}
  dirty=true;render();state();
 }
 if(m.type==='scaleAll'){if(scaleAll(Number(m.factor),!!m.withCaption))dirty=true;render(playing?(now()-playStart)/1000:undefined);state();send({type:'scaled',factor:Number(m.factor)});}
 if(m.type==='fitMotion'){const f=fitMotion();if(f>0&&f<1)dirty=true;render(playing?(now()-playStart)/1000:undefined);state();send({type:'fitted',factor:f});}
 if(m.type==='motion'){checkpoint();motion=m.motion||null;boilCache.clear();dirty=true;extentCache=null;if(!motion)stopPlaying();render(playing?(now()-playStart)/1000:undefined);state();}
 if(m.type==='play'){startPlaying();}
 if(m.type==='stop'){stopPlaying();render();state();}
 if(m.type==='frames'){const was=playing;stopPlaying();send({type:'frames',id:m.id,gif:buildLoop(m.fps,!!m.sheets)});if(was)startPlaying();else{render();state();}}
 if(m.type==='save'){dry();if(selection)applySelection(false,'save');syncFrame();saving=true;saveToken=m.token===undefined?null:m.token;const first=animOn()?frames[0].layers:layers;const out=bitmap(),g=out.getContext('2d');first.forEach(l=>composite(g,l));drawCaption(g);send({type:'save',token:saveToken,dirty,data:out.toDataURL('image/png'),metrics:metrics(out),activeLayerId,caption,motion,gif:(m.gif&&(motion||animOn()))?buildLoop(12,false):undefined,layers:first.map(l=>({...meta(l),data:l.bitmap.toDataURL('image/png')})),
   frames:animOn()?frames.map((f,i)=>({id:f.id,duration:f.duration,layers:i===0?null:f.layers.map(l=>({...meta(l),data:l.bitmap.toDataURL('image/png')}))})):undefined,references:references.map(l=>({...meta(l),path:l.path}))});}
 // ── 장 명령 ──
 if(m.type==='animStart'){if(animOn())return;if(selection)applySelection(false,'frame');const d=Number.isFinite(m.duration)?m.duration:.3;frames=[{id:'f1',duration:d,layers},{id:'f2',duration:d,layers:cloneLayers(layers)}];frameIdx=0;useFrame(1);dirty=true;stopPlaying();render();state();}
 if(m.type==='frameAdd'&&animOn()){if(frames.length>=MAX_FRAMES)return;if(selection)applySelection(false,'frame');syncFrame();const src=frames[frameIdx];let n=frames.length+1;while(frames.some(f=>f.id==='f'+n))n++;frames.splice(frameIdx+1,0,{id:'f'+n,duration:src.duration,layers:m.blank?blankLayers(src.layers):cloneLayers(src.layers)});useFrame(frameIdx+1);dirty=true;stopPlaying();render();state();}
 if(m.type==='frameSelect'&&animOn()){if(selection)applySelection(false,'frame');useFrame(m.index|0);stopPlaying();render();state();}
 if(m.type==='frameDelete'&&animOn()){syncFrame();const i=Number.isFinite(m.index)?m.index:frameIdx;frames.splice(i,1);if(frames.length<2){layers=frames[0].layers;frames=null;frameIdx=0;history=[];future=[];}else useFrame(Math.min(i,frames.length-1));dirty=true;stopPlaying();render();state();}
 if(m.type==='frameDuration'&&animOn()){const f=frames[Number.isFinite(m.index)?m.index:frameIdx];if(f){f.duration=Math.max(.1,Math.min(2,Math.round(m.duration*10)/10));dirty=true;state();}}
 if(m.type==='frameMove'&&animOn()){syncFrame();const a=m.from|0,b=m.to|0;if(b<0||b>=frames.length||a===b)return;const cur=frames[frameIdx];const [x]=frames.splice(a,1);frames.splice(b,0,x);frameIdx=frames.indexOf(cur);dirty=true;render();state();}
 if(m.type==='animOff'&&animOn()){syncFrame();layers=frames[0].layers;frames=null;frameIdx=0;history=[];future=[];dirty=true;stopPlaying();render();state();}
 if(m.type==='onion'){onion=m.on!==false;render();state();}
 if(m.type==='frameThumbs'&&animOn()){syncFrame();const size=m.size||64;send({type:'frameThumbs',thumbs:frames.map(f=>({id:f.id,data:flatOf(f.layers,size).toDataURL('image/png')}))});}
 // 번호가 다른 응답(먼저 보낸 저장의 뒤늦은 대답)은 흘려보낸다. 지금 저장의 대답만 상태를 바꾼다.
 if(m.type==='saved'){if(stale(m))return;saving=false;saveToken=null;dirty=false;state();}
 if(m.type==='saveFailed'){if(stale(m))return;saving=false;saveToken=null;state();}
 if(m.type==='probe'){probe=!!m.on;return;}
 if(m.type==='paper'){surface.classList.toggle('paper',!!m.on);return;}
 if(m.type==='analyze'){const i=await image(m.data),c=document.createElement('canvas');const scale=Math.min(1,720/Math.max(i.width,i.height));c.width=Math.max(1,Math.round(i.width*scale));c.height=Math.max(1,Math.round(i.height*scale));c.getContext('2d').drawImage(i,0,0,c.width,c.height);send({type:'analysis',id:m.id,metrics:metrics(c)});}
 }catch(error){loading=false;saving=false;send({type:'error',id:m.id,message:String(error)});}}
let pending=Promise.resolve();window.command=m=>{pending=pending.then(()=>command(m));return pending;};window.addEventListener('resize',size);size();send({type:'ready'});
})();
</script></body></html>`;
