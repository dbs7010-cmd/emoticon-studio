import { KAKAO_STATIC_SPEC as SPEC } from '../constants/kakao-spec';

// Local-only Painter engine. Reference images are preview layers and never enter final export.
export const canvasHtml = `<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>
*{box-sizing:border-box}body{margin:0;background:#F4F4F5;font-family:system-ui;overflow:hidden}#viewport{height:100vh;overflow:auto;touch-action:none;overscroll-behavior:none}#surface{position:relative;background-color:white;background-image:conic-gradient(#F1F1F3 25%,transparent 0 50%,#F1F1F3 0 75%,transparent 0);background-size:28px 28px;margin:auto}#surface.paper{background-color:#FBFAF7;background-image:radial-gradient(#00000009 1px,transparent 1px),radial-gradient(#00000007 1px,transparent 1px);background-size:7px 7px,11px 11px;background-position:0 0,4px 5px}canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none}
</style></head><body><div id="viewport"><div id="surface"><canvas id="drawing" width="${SPEC.width}" height="${SPEC.height}"></canvas></div></div><script>
(function(){
const canvas=document.getElementById('drawing'),surface=document.getElementById('surface'),viewport=document.getElementById('viewport'),ctx=canvas.getContext('2d',{willReadFrequently:true});
const W=canvas.width,H=canvas.height;
let tool='pen',brush='pen',color='#242424',penWidth=5,eraserWidth=20,zoom=1,active=false,last=null,pointer=null,history=[],future=[],dirty=false,loading=false,saving=false,layers=[],references=[],activeLayerId='draw-1',activeDrawLayerId='draw-1',activeReferenceId=null,strokePending=false,pendingFill=null,steady=null,caption=null,selection=null,marquee=null,dragging=null,grabbing=null,focusLayerId=null,pivotPick=null,pivotRole='pivot',motion=null,playing=false,playStart=0,rafId=null,smoothing=true,captionPicked=false,captionDrag=null,captionHandle=null,captionDismiss=false,probe=false;
const touches=new Map();let multi=null,suppressDraw=false;
function send(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m));}
function bitmap(){const c=document.createElement('canvas');c.width=W;c.height=H;return c;}
function copyOf(b){const c=bitmap();c.getContext('2d').drawImage(b,0,0);return c;}
function meta(l){return {id:l.id,name:l.name,visible:l.visible,opacity:l.opacity,x:l.x,y:l.y,scale:l.scale,rotation:l.rotation};}
function trace(what,extra){if(!probe)return;send(Object.assign({type:'trace',t:Math.round(performance.now()),what:what,has:!!selection,dx:selection?Math.round(selection.dx):null,dy:selection?Math.round(selection.dy):null},extra||{}));}
function state(){send({type:'state',undo:history.length>0,redo:future.length>0,dirty,smoothing,captionPicked,picking,preset,brushOpacity,stabilizer,activeHidden:!!(activeDraw()&&!activeDraw().visible),activeLayerId,activeReferenceId,caption,motion,pivotPick,pivotRole,selection:selection&&{box:selection.box,dx:selection.dx,dy:selection.dy,scale:selection.scale,rot:selection.rot,flip:selection.flip},loop:Number(loopSeconds().toFixed(3)),clipped:motionClips(),playing,layers:layers.map(meta),references:references.map(l=>({...meta(l),path:l.path}))});}
// The words live in the exported picture, not in a separate text tool: one system font, centred,
// shrunk until it fits, with a light outline so it stays readable over the drawing.
//
// 문구는 이제 자리를 스스로 가진다. place(위/아래)는 **처음 놓이는 자리**이고, 그 뒤 사용자가 손가락으로
// 옮기거나 키우거나 돌린 값이 dx·dy·scale·rot 에 쌓인다. 없으면 예전처럼 위/아래 가운데에 놓인다 —
// 그래서 예전에 저장한 작품이 그대로 열린다.
// 글씨 성격(45.6차): 기기에 이미 있는 글꼴만 쓴다 — 기본(고딕)·또박(명조)·도톰(더 굵고 테두리도 두껍게).
function capFace(){const s=caption&&caption.style;
 if(s==='serif')return {w:'700',f:'serif',o:.22};
 if(s==='thick')return {w:'900',f:'system-ui, sans-serif',o:.36};
 return {w:'700',f:'system-ui, sans-serif',o:.22};}
function capFont(px){const c=capFace();return c.w+' '+px+'px '+c.f;}
function captionSpot(g){
 if(!caption||!caption.text.trim())return null;
 const text=caption.text.trim(),room=W-32;
 let px=Math.round(H*.11),wide=0;
 for(;px>10;px--){g.font=capFont(px);wide=g.measureText(text).width;if(wide<=room)break;}
 if(wide>room){px=Math.max(1,Math.floor(px*room/wide));g.font=capFont(px);wide=g.measureText(text).width;}
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
 g.font=capFont(spot.px);
 g.lineJoin='round';g.lineWidth=Math.max(3,spot.px*capFace().o);g.strokeStyle='#FFFFFF';g.strokeText(spot.text,spot.x,spot.y);
 g.fillStyle=css(caption.color||'#242424');g.fillText(spot.text,spot.x,spot.y);
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
function defaults(id,name){return {id,name,visible:true,opacity:1,x:0,y:0,scale:1,rotation:0};}
function activeDraw(){return layers.find(l=>l.id===activeDrawLayerId)||layers[0];}
function activeReference(){return references.find(l=>l.id===activeReferenceId&&l.visible);}
function selectDrawLayer(id){const target=layers.find(l=>l.id===id)||layers[0];if(target){activeLayerId=target.id;activeDrawLayerId=target.id;}}
function snapshot(){return {layers:layers.map(l=>({...meta(l),pixels:l.bitmap.getContext('2d').getImageData(0,0,W,H)})),references:references.map(l=>({...l})),activeLayerId,activeDrawLayerId,activeReferenceId,caption:caption&&{...caption},motion:motion&&JSON.parse(JSON.stringify(motion)),selection:selection&&{...selection,bitmap:copyOf(selection.bitmap)}};}
function restore(s){trace('restore:before');layers=s.layers.map(l=>{const b=bitmap();b.getContext('2d').putImageData(l.pixels,0,0);return {...meta(l),bitmap:b};});references=s.references;activeLayerId=s.activeLayerId;activeDrawLayerId=s.activeDrawLayerId||layers[0]?.id||'';activeReferenceId=s.activeReferenceId||null;caption=s.caption||null;motion=s.motion||null;selection=s.selection||null;render();state();trace('restore:after');}
function checkpoint(preserveFuture=false){history.push(snapshot());if(history.length>40)history.shift();if(!preserveFuture)future=[];dirty=true;}
function composite(g,l,d){if(!l.visible||(d&&d.hidden))return;g.save();g.globalAlpha=l.opacity;if(d){g.translate(d.px+d.dx,d.py+d.dy);g.rotate(d.rot*Math.PI/180);g.scale(d.sx,d.sy);g.translate(-d.px,-d.py);}g.translate(W/2+l.x,H/2+l.y);g.rotate(l.rotation*Math.PI/180);g.scale(l.scale,l.scale);g.drawImage(l.bitmap,-W/2,-H/2);g.restore();}
function render(t){ctx.clearRect(0,0,W,H);references.forEach(l=>composite(ctx,l));layers.forEach(l=>{const d=t===undefined?null:deltaFor(l,t);composite(ctx,l,d);if(wet&&l.id===wetLayer)composite(ctx,{...l,bitmap:wetView(),opacity:l.opacity*wetAlpha},d);});drawSelection(ctx);drawFocus(ctx);drawTrail(ctx);drawPivot(ctx);drawCaption(ctx,t===undefined||!motion||!motion.captionMoves?null:wholeDelta(t));selectionOutline(ctx);captionOutline(ctx);}
function size(){const n=Math.max(160,Math.min(window.innerWidth,window.innerHeight))*zoom;surface.style.width=n+'px';surface.style.height=n+'px';}
function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
function local(p,l){const x=p.x-W/2-l.x,y=p.y-H/2-l.y,a=-l.rotation*Math.PI/180;return {x:(x*Math.cos(a)-y*Math.sin(a))/l.scale+W/2,y:(x*Math.sin(a)+y*Math.cos(a))/l.scale+H/2};}
function style(g){g.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';g.globalAlpha=tool==='eraser'?1:brush==='brush'?0.85:brush==='pencil'?0.55:1;g.lineWidth=tool==='eraser'?eraserWidth:(brush==='brush'?penWidth*1.4:penWidth);g.strokeStyle=solid(color);g.fillStyle=solid(color);g.lineCap='round';g.lineJoin='round';const P=activePreset();if(P){g.globalAlpha=1;g.lineWidth=computeBrushWidth(penWidth*P.width,lastPressure,P)*(P.taper?Math.min(1,.3+.7*strokeLen/P.taper):1);g.lineCap=P.cap||'round';}}
// 색 투명도. 획은 **불투명하게 따로 그린 뒤(wet) 손을 뗄 때 한 번에 투명도를 걸어 얹는다.** 짧은 선분마다
// 투명도를 걸면 겹치는 이음매마다 진해져 구슬 꿴 줄처럼 보인다. 불투명한 색은 이 길을 타지 않는다.
let wet=null,wetLayer=null,wetAlpha=1,picking=false;
// PRO 브러시. 무료 펜/붓/연필(brush)은 손대지 않고, preset 이 있을 때만 이 표를 쓴다. PRO 획은 전부 wet 버퍼에
// 불투명하게 그린 뒤 손을 뗄 때 (색 투명도 × 브러시 진하기 × 프리셋 기본 진하기)를 한 번에 얹는다 — 한 획 안의 겹침은 진해지지 않는다.
const PRESETS={
 ink:{alpha:1,width:1,cap:'round',taper:16},
 soft:{alpha:1,width:1.35,soft:true},
 grain:{alpha:.85,width:.75,cap:'round',texture:true},
 marker:{alpha:.55,width:2,cap:'butt'}
};
// 선 보정 강도. light 는 예전 값 그대로다(무료 '선 보정' 켜짐과 같다).
const STAB={light:.55,medium:.3,strong:.16};
let preset=null,brushOpacity=1,stabilizer='light',strokeLen=0,lastRaw=null,lastPressure=null;
function applyBrush(m){preset=m.preset&&PRESETS[m.preset]?m.preset:null;const o=Number(m.opacity);brushOpacity=Number.isFinite(o)?Math.max(.05,Math.min(1,o)):1;stabilizer=STAB[m.stabilizer]?m.stabilizer:'light';if(typeof m.smoothing==='boolean')smoothing=m.smoothing;}
// 필압 자리. 스타일러스(pointerType 'pen')의 0~1 값만 받는다. 지금 프리셋에는 pressure 반응이 없어 항상 기본값을 돌려준다 —
// 손가락·마우스의 체감은 바뀌지 않는다. 0·undefined·범위 밖 값은 없는 것으로 본다.
function validPressure(p){return Number.isFinite(p)&&p>0&&p<=1?p:null;}
function penPressure(e){return e&&e.pointerType==='pen'?validPressure(e.pressure):null;}
function computeBrushWidth(base,pressure,settings){const p=validPressure(pressure);if(p===null||!settings||!settings.pressure)return base;return base*Math.max(.25,Math.min(1.5,.5+p));}
function computeBrushAlpha(base,pressure,settings){const p=validPressure(pressure);if(p===null||!settings||!settings.pressure)return base;return base*Math.max(.1,Math.min(1,p*1.25));}
function activePreset(){return tool!=='eraser'&&preset?PRESETS[preset]:null;}
function solid(hex){const p=rgba(hex);return '#'+[p[0],p[1],p[2]].map(n=>n.toString(16).padStart(2,'0')).join('');}
function css(hex){const p=rgba(hex);return p[3]>=255?solid(hex):'rgba('+p[0]+','+p[1]+','+p[2]+','+(p[3]/255).toFixed(3)+')';}
function inkAlpha(){return rgba(color)[3]/255;}
function dry(){if(!wet)return;const l=layers.find(x=>x.id===wetLayer);if(l){const g=l.bitmap.getContext('2d');g.save();g.globalAlpha=wetAlpha;g.drawImage(wetView(),0,0);g.restore();}wet=null;wetLayer=null;render();}
// 결 연필: 그은 선에 고정된 알갱이 무늬를 파낸다. 획마다 파내면 다음 선분의 둥근 끝이 다시 덮으므로, 보여 줄 때와 얹을 때 한 번에 건다 —
// 그리는 동안 보이는 결과 저장되는 결이 같다.
let grainMask=null,wetShown=null;
function wetView(){const P=activePreset();if(!wet||!P||!P.texture)return wet;if(!grainMask){grainMask=bitmap();const m=grainMask.getContext('2d');m.fillStyle='#000';for(let i=0;i<W*H*.02;i++){m.globalAlpha=.45+Math.random()*.4;m.beginPath();m.arc(Math.random()*W,Math.random()*H,.6+Math.random()*.9,0,Math.PI*2);m.fill();}}if(!wetShown)wetShown=bitmap();const t=wetShown.getContext('2d');t.globalCompositeOperation='source-over';t.clearRect(0,0,W,H);t.drawImage(wet,0,0);t.globalCompositeOperation='destination-out';t.drawImage(grainMask,0,0);t.globalCompositeOperation='source-over';return wetShown;}
// 연필 입자. 그은 선 둘레에 작은 점을 뿌려 종이에 걸리는 느낌을 낸다. 굵기는 건드리지 않는다 —
// 필압을 흉내 내면 지원하지 않는 기능을 있는 척하게 된다.
function grain(g,a,b){
 if(activePreset()||brush!=='pencil'||tool==='eraser')return;
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
 if(len<0.5)return;
 const spread=Math.max(1,g.lineWidth*0.42),dots=Math.max(1,Math.round(len*0.9));
 g.save();g.globalAlpha=0.30;g.fillStyle=solid(color);
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
function cancelStrokeForGesture(){captionDrag=null;captionHandle=null;captionDismiss=false;grabbing=null;if(!active)return;wet=null;wetLayer=null;active=false;pointer=null;strokePending=false;steady=null;if(history.length){const previous=history.pop();restore(previous);}}
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
 if(!motion)return 1;
 if(motion.alternate&&motion.alternate.interval>0)return Math.max(.2,motion.alternate.interval*2);
 return 1.2-Math.max(0,Math.min(1,motion.speed==null?.5:motion.speed))*.8;
}
function cyclesFor(speed){return Math.max(1,Math.min(4,Math.round((speed==null?.5:speed)*3)+1));}
function wholeDelta(t){
 const d={px:W/2,py:H/2,dx:0,dy:0,sx:1,sy:1,rot:0};
 if(!motion||!motion.preset)return d;
 const a=Math.max(0,Math.min(1,motion.strength==null?.5:motion.strength));
 const phase=t/loopSeconds()*Math.PI*2;
 if(motion.preset==='bounce'){d.dy=-Math.abs(Math.sin(phase))*(H*.055)*a;d.sy=1+Math.sin(phase*2)*.03*a;}
 if(motion.preset==='shake'){d.dx=Math.sin(phase)*(W*.04)*a;d.rot=Math.sin(phase)*4*a;}
 if(motion.preset==='pulse'){const s=1+Math.sin(phase)*.07*a;d.sx=s;d.sy=s;}
 return d;
}
// One part moving on its own, combined with whatever the whole picture is doing.
function partDelta(part,t,base){
 const L=loopSeconds(),cycles=cyclesFor(part.speed);
 const local=((t-(part.delay||0))%L+L)%L;
 const phase=local/L*Math.PI*2*cycles;
 const d={px:part.pivotX*W,py:part.pivotY*H,dx:base.dx,dy:base.dy,sx:base.sx,sy:base.sy,rot:base.rot};
 const wave=Math.sin(phase);
 if(part.effect==='rotate')d.rot=base.rot+wave*part.amount;
 if(part.effect==='move'){
  if(Number.isFinite(part.fromX)&&Number.isFinite(part.toX)){
   const half=(wave+1)/2;
   d.dx=base.dx+((part.toX-part.fromX)*W)*half;d.dy=base.dy+((part.toY-part.fromY)*H)*half;
  } else {const r=part.angle*Math.PI/180,travel=wave*part.amount*W;d.dx=base.dx+Math.cos(r)*travel;d.dy=base.dy+Math.sin(r)*travel;}
 }
 if(part.effect==='scale'){const s=1+wave*part.amount;d.sx=base.sx*s;d.sy=base.sy*s;}
 return d;
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
 const d=part?partDelta(part,t,base):base;
 d.hidden=poseHides(l,t);
 return d;
}
// Does the movement push the drawing outside the picture at any point in the loop?
function motionClips(){
 if(!motion)return false;
 const L=loopSeconds(),steps=12;
 for(const l of layers){
  if(!l.visible)continue;
  const box=inkBox(l.bitmap);
  if(!box)continue;
  for(let i=0;i<steps;i++){
   const d=deltaFor(l,L*i/steps);
   if(!d||d.hidden)continue;
   const corners=[[box.minX,box.minY],[box.maxX,box.minY],[box.minX,box.maxY],[box.maxX,box.maxY]];
   for(const [x,y] of corners){
    const ox=(x-d.px)*d.sx+d.px+d.dx,oy=(y-d.py)*d.sy+d.py+d.dy;
    const r=d.rot*Math.PI/180,rx=(ox-d.px)*Math.cos(r)-(oy-d.py)*Math.sin(r)+d.px,ry=(ox-d.px)*Math.sin(r)+(oy-d.py)*Math.cos(r)+d.py;
    if(rx<0||ry<0||rx>W-1||ry>H-1)return true;
   }
  }
 }
 return false;
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
function startPlaying(){if(playing)return;playing=true;playStart=now();const step=()=>{if(!playing)return;render((now()-playStart)/1000%loopSeconds());rafId=requestAnimationFrame(step);};rafId=requestAnimationFrame(step);state();}
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
 fps=Math.max(6,Math.min(24,fps||12));
 const L=loopSeconds();
 const count=Math.max(2,Math.min(MAX_FRAMES,Math.round(L*fps)));
 fps=count/L;
 const out=[];
 for(let i=0;i<count;i++){
  const frame=bitmap(),g=frame.getContext('2d'),t=L*i/count;
  layers.forEach(l=>composite(g,l,motion?deltaFor(l,t):null));
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
  const id='draw-'+(layers.length+1);
  into={...defaults(id,'그림 '+(layers.length+1)),bitmap:bitmap()};
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
 const P0=activePreset();lastPressure=penPressure(e);strokeLen=0;lastRaw=last;
 wetAlpha=tool==='eraser'?1:computeBrushAlpha(inkAlpha()*brushOpacity*(P0?P0.alpha:1),lastPressure,P0);wet=(P0||wetAlpha<1)?bitmap():null;wetLayer=wet?l.id:null;
 const p=local(last,l),g=(wet||l.bitmap).getContext('2d');style(g);if(P0&&P0.soft)softStamp(g,p.x,p.y,g.lineWidth);else{g.beginPath();g.arc(p.x,p.y,g.lineWidth/2,0,Math.PI*2);g.fill();}render();state();
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
 inkSegment(l,last,p);
 dirty=true;last=p;render();
});
// 한 구간을 그린다. 무료 펜/붓/연필은 예전 그대로(3px 간격 선분 + 연필 입자), PRO 프리셋만 분기를 탄다.
function inkSegment(l,fromP,toP){
 const a=local(fromP,l),b=local(toP,l),g=(wet||l.bitmap).getContext('2d');style(g);const P=activePreset();
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
// 부드러운 펜: 가장자리로 갈수록 옅어지는 둥근 도장을 촘촘히 찍는다. 가운데는 겹쳐 차오르고 가장자리만 부드럽다.
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
  if(smoothing&&stabilizer!=='light'&&lastRaw&&steady&&Math.hypot(lastRaw.x-steady.x,lastRaw.y-steady.y)>.5){const l=layers.find(x=>x.id===wetLayer)||activeDraw();if(l){inkSegment(l,steady,lastRaw);last=lastRaw;}}
  dry();
 }
 if(strokePending){future=[];strokePending=false;}active=false;pointer=null;steady=null;state();
}
canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
function image(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('이미지를 열 수 없습니다.'));i.src=src;});}
async function loadLayer(l){const b=bitmap();if(l.data){const i=await image(l.data),scale=Math.min(W/i.width,H/i.height),w=i.width*scale,h=i.height*scale;b.getContext('2d').drawImage(i,(W-w)/2,(H-h)/2,w,h);}return {...defaults(l.id,l.name),...l,bitmap:b,data:undefined};}
function metrics(c){const g=c.getContext('2d',{willReadFrequently:true}),w=c.width,h=c.height,d=g.getImageData(0,0,w,h).data;let n=0,xs=0,ys=0,minX=w,minY=h,maxX=0,maxY=0,r=0,green=0,b=0,transparent=false;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4;if(d[k+3]<255)transparent=true;if(d[k+3]>16){n++;xs+=x;ys+=y;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);r+=d[k];green+=d[k+1];b+=d[k+2];}}return {coverage:n/(w*h),centerX:n?xs/n/w:.5,centerY:n?ys/n/h:.5,width:n?(maxX-minX+1)/w:0,height:n?(maxY-minY+1)/h:0,color:n?[r/n/255,green/n/255,b/n/255]:[0,0,0],transparent};}
async function command(m){try{
 if(saving&&!['saved','saveFailed','analyze'].includes(m.type))return;
 if(m.type==='init'){
   loading=true;const input=m.layers||[{...defaults('draw-1','그림 1'),data:m.drawing},{...defaults('draw-2','그림 2')}];
   if(m.color)color=m.color;if(m.brush)applyBrush(m.brush);if(Number.isFinite(m.penWidth))penWidth=m.penWidth;if(Number.isFinite(m.eraserWidth))eraserWidth=m.eraserWidth;
   layers=await Promise.all(input.map(l=>loadLayer(l)));references=await Promise.all((m.references||[]).map(l=>loadLayer(l)));activeLayerId=m.activeLayerId||'draw-1';if(!layers.some(l=>l.id===activeLayerId))activeLayerId=layers[0]?.id||'';activeDrawLayerId=activeLayerId;activeReferenceId=null;wet=null;wetLayer=null;picking=false;caption=m.caption||null;motion=m.motion||motion;history=[];future=[];dirty=false;loading=false;render();state();send({type:'initialized',id:m.id});
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
 if(m.type==='transform'){const l=[...layers,...references].find(l=>l.id===(m.id||activeLayerId));if(l){checkpoint();for(const k of ['x','y','rotation'])if(Number.isFinite(m[k]))l[k]=m[k];if(Number.isFinite(m.scale))l.scale=Math.max(.1,Math.min(4,m.scale));if(Number.isFinite(m.opacity))l.opacity=Math.max(0,Math.min(1,m.opacity));if(typeof m.visible==='boolean')l.visible=m.visible;render();state();}}
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
   else{checkpoint();const id='draw-'+(layers.length+1);
    const copy={...defaults(id,'그림 '+(layers.length+1)),bitmap:copyOf(src.bitmap)};
    layers.push(copy);selectDrawLayer(id);dirty=true;render();
    send({type:'duplicated',id});state();}
 }
 if(m.type==='importDrawing'){
   if(layers.length>=4){send({type:'error',message:'그림은 4장까지예요.'});}
   else{checkpoint();const id='draw-'+(layers.length+1);
    const added=await loadLayer({...defaults(id,'그림 '+(layers.length+1)),data:m.data});
    layers.push(added);selectDrawLayer(id);dirty=true;render();state();}
 }
 if(m.type==='addLayer'){if(layers.length<4){checkpoint();const l={...defaults(m.id,m.name),bitmap:bitmap()};layers.push(l);selectDrawLayer(l.id);render();state();}}
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
 if(m.type==='motion'){checkpoint();motion=m.motion||null;dirty=true;if(!motion)stopPlaying();render(playing?(now()-playStart)/1000:undefined);state();}
 if(m.type==='play'){startPlaying();}
 if(m.type==='stop'){stopPlaying();render();state();}
 if(m.type==='frames'){const was=playing;stopPlaying();send({type:'frames',id:m.id,gif:buildLoop(m.fps,!!m.sheets)});if(was)startPlaying();else{render();state();}}
 if(m.type==='save'){dry();if(selection)applySelection(false,'save');saving=true;const out=bitmap(),g=out.getContext('2d');layers.forEach(l=>composite(g,l));drawCaption(g);send({type:'save',dirty,data:out.toDataURL('image/png'),metrics:metrics(out),activeLayerId,caption,motion,gif:(m.gif&&motion)?buildLoop(12,false):undefined,layers:layers.map(l=>({...meta(l),data:l.bitmap.toDataURL('image/png')})),references:references.map(l=>({...meta(l),path:l.path}))});}
 if(m.type==='saved'){saving=false;dirty=false;state();}
 if(m.type==='saveFailed'){saving=false;state();}
 if(m.type==='probe'){probe=!!m.on;return;}
 if(m.type==='paper'){surface.classList.toggle('paper',!!m.on);return;}
 if(m.type==='analyze'){const i=await image(m.data),c=document.createElement('canvas');const scale=Math.min(1,720/Math.max(i.width,i.height));c.width=Math.max(1,Math.round(i.width*scale));c.height=Math.max(1,Math.round(i.height*scale));c.getContext('2d').drawImage(i,0,0,c.width,c.height);send({type:'analysis',id:m.id,metrics:metrics(c)});}
 }catch(error){loading=false;saving=false;send({type:'error',id:m.id,message:String(error)});}}
let pending=Promise.resolve();window.command=m=>{pending=pending.then(()=>command(m));return pending;};window.addEventListener('resize',size);size();send({type:'ready'});
})();
</script></body></html>`;
