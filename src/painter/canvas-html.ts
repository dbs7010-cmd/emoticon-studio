import { KAKAO_STATIC_SPEC as SPEC } from '../constants/kakao-spec';

// Local-only Painter engine. Reference images are preview layers and never enter final export.
export const canvasHtml = `<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>
*{box-sizing:border-box}body{margin:0;background:#eeeae3;font-family:system-ui;overflow:hidden}#viewport{height:100vh;overflow:auto;touch-action:none;overscroll-behavior:none}#surface{position:relative;background-color:white;background-image:conic-gradient(#eee 25%,transparent 0 50%,#eee 0 75%,transparent 0);background-size:20px 20px;margin:auto}canvas,img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}canvas{touch-action:none}img{pointer-events:none}#hint{position:fixed;bottom:5px;left:6px;background:#fff9;font-size:10px;pointer-events:none}
</style></head><body><div id="viewport"><div id="surface"><canvas id="drawing" width="${SPEC.width}" height="${SPEC.height}"></canvas></div></div><div id="hint">체크 무늬 = 투명</div><script>
(function(){
const canvas=document.getElementById('drawing'),surface=document.getElementById('surface'),viewport=document.getElementById('viewport'),ctx=canvas.getContext('2d',{willReadFrequently:true});
const W=canvas.width,H=canvas.height;
let tool='pen',brush='pen',color='#242424',penWidth=5,eraserWidth=20,zoom=1,active=false,last=null,pointer=null,history=[],future=[],dirty=false,loading=false,saving=false,layers=[],references=[],activeLayerId='draw-1',activeDrawLayerId='draw-1';
const touches=new Map();let multi=null,suppressDraw=false;
function send(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m));}
function bitmap(){const c=document.createElement('canvas');c.width=W;c.height=H;return c;}
function meta(l){return {id:l.id,name:l.name,visible:l.visible,opacity:l.opacity,x:l.x,y:l.y,scale:l.scale,rotation:l.rotation};}
function state(){send({type:'state',undo:history.length>0,redo:future.length>0,dirty,activeLayerId,layers:layers.map(meta),references:references.map(l=>({...meta(l),path:l.path}))});}
function defaults(id,name){return {id,name,visible:true,opacity:1,x:0,y:0,scale:1,rotation:0};}
function selected(){return [...layers,...references].find(l=>l.id===activeLayerId);}
function selectedReference(){return references.find(l=>l.id===activeLayerId);}
function selectDrawLayer(){const target=layers.find(l=>l.id===activeDrawLayerId)||layers[0];if(target){activeLayerId=target.id;activeDrawLayerId=target.id;}}
function snapshot(){return {layers:layers.map(l=>({...meta(l),pixels:l.bitmap.getContext('2d').getImageData(0,0,W,H)})),references:references.map(l=>({...l})),activeLayerId,activeDrawLayerId};}
function restore(s){layers=s.layers.map(l=>{const b=bitmap();b.getContext('2d').putImageData(l.pixels,0,0);return {...meta(l),bitmap:b};});references=s.references;activeLayerId=s.activeLayerId;activeDrawLayerId=s.activeDrawLayerId||layers[0]?.id||'';render();state();}
function checkpoint(){history.push(snapshot());if(history.length>40)history.shift();future=[];dirty=true;}
function composite(g,l){if(!l.visible)return;g.save();g.globalAlpha=l.opacity;g.translate(W/2+l.x,H/2+l.y);g.rotate(l.rotation*Math.PI/180);g.scale(l.scale,l.scale);g.drawImage(l.bitmap,-W/2,-H/2);g.restore();}
function render(){ctx.clearRect(0,0,W,H);references.forEach(l=>composite(ctx,l));layers.forEach(l=>composite(ctx,l));}
function size(){const n=Math.max(160,Math.min(window.innerWidth,window.innerHeight))*zoom;surface.style.width=n+'px';surface.style.height=n+'px';}
function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height};}
function local(p,l){const x=p.x-W/2-l.x,y=p.y-H/2-l.y,a=-l.rotation*Math.PI/180;return {x:(x*Math.cos(a)-y*Math.sin(a))/l.scale+W/2,y:(x*Math.sin(a)+y*Math.cos(a))/l.scale+H/2};}
function style(g){g.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';g.globalAlpha=tool==='eraser'?1:brush==='marker'?0.28:brush==='pencil'?0.7:1;g.lineWidth=tool==='eraser'?eraserWidth:penWidth;g.strokeStyle=color;g.fillStyle=color;g.lineCap=brush==='marker'&&tool!=='eraser'?'square':'round';g.lineJoin='round';}
function touchPoint(e){return {x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY};}
function points(){return [...touches.values()];}
function firstTwo(){return points().slice(0,2);}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function middle(a,b){return {x:(a.x+b.x)/2,y:(a.y+b.y)/2};}
function canvasUnits(px){const r=canvas.getBoundingClientRect();return px*W/Math.max(1,r.width);}
function cancelStrokeForGesture(){if(!active)return;active=false;pointer=null;if(history.length){const previous=history.pop();restore(previous);future=[];dirty=true;}}
function beginMulti(){
 const ps=firstTwo();if(ps.length<2)return;const [a,b]=ps,mid=middle(a,b),ref=selectedReference();
 if(!multi){checkpoint();multi={started:Date.now(),maxCount:touches.size,moved:false,distance:Math.max(1,distance(a,b)),mid,zoom,scrollLeft:viewport.scrollLeft,scrollTop:viewport.scrollTop,refId:ref?.id,refX:ref?.x||0,refY:ref?.y||0,refScale:ref?.scale||1};}
 else multi.maxCount=Math.max(multi.maxCount,touches.size);
 suppressDraw=true;
}
function applyMulti(){
 if(!multi||touches.size<2)return;const [a,b]=firstTwo(),mid=middle(a,b),d=Math.max(1,distance(a,b)),move=Math.hypot(mid.x-multi.mid.x,mid.y-multi.mid.y),pinch=Math.abs(d-multi.distance);
 if(move>5||pinch>5)multi.moved=true;if(!multi.moved)return;
 const ref=multi.refId&&references.find(l=>l.id===multi.refId);
 if(ref){ref.scale=Math.max(.1,Math.min(4,multi.refScale*(d/multi.distance)));ref.x=multi.refX+canvasUnits(mid.x-multi.mid.x);ref.y=multi.refY+canvasUnits(mid.y-multi.mid.y);render();state();return;}
 const next=Math.max(1,Math.min(4,multi.zoom*(d/multi.distance)));zoom=next;size();const ratio=next/multi.zoom;viewport.scrollLeft=(multi.scrollLeft+multi.mid.x)*ratio-mid.x;viewport.scrollTop=(multi.scrollTop+multi.mid.y)*ratio-mid.y;send({type:'zoom',zoom});
}
function undo(){if(history.length){future.push(snapshot());dirty=true;restore(history.pop());}}
function redo(){if(future.length){history.push(snapshot());dirty=true;restore(future.pop());}}
function finishMulti(){
 if(!multi)return;const tap=!multi.moved&&Date.now()-multi.started<360,count=multi.maxCount;const hadCheckpoint=history.length>0;
 if(tap&&hadCheckpoint)history.pop();
 if(tap&&count>=3)redo();else if(tap&&count===2)undo();
 multi=null;suppressDraw=false;state();
}
canvas.addEventListener('pointerdown',e=>{
 if(loading||saving)return;
 if(e.pointerType==='touch'){
   touches.set(e.pointerId,touchPoint(e));
   if(touches.size>=2){e.preventDefault();cancelStrokeForGesture();beginMulti();return;}
   if(suppressDraw)return;
 }
 if(active||tool==='pan')return;
 if(tool==='pen'||tool==='eraser')selectDrawLayer();
 const l=selected();if(!l||!l.visible)return;
 if(tool!=='move'&&!layers.includes(l)){send({type:'hint',message:'그림 레이어를 선택하세요.'});return;}
 e.preventDefault();canvas.setPointerCapture(e.pointerId);pointer=e.pointerId;checkpoint();active=true;last=point(e);
 if(tool!=='move'){const p=local(last,l),g=l.bitmap.getContext('2d');style(g);g.beginPath();g.arc(p.x,p.y,g.lineWidth/2,0,Math.PI*2);g.fill();}render();state();
});
canvas.addEventListener('pointermove',e=>{
 if(e.pointerType==='touch'&&touches.has(e.pointerId)){const old=touches.get(e.pointerId);touches.set(e.pointerId,{...old,x:e.clientX,y:e.clientY});}
 if(multi&&touches.size>=2){e.preventDefault();multi.maxCount=Math.max(multi.maxCount,touches.size);applyMulti();return;}
 if(!active||e.pointerId!==pointer)return;e.preventDefault();const l=selected(),p=point(e);
 if(tool==='move'){l.x+=p.x-last.x;l.y+=p.y-last.y;dirty=true;}else{const a=local(last,l),b=local(p,l),g=l.bitmap.getContext('2d');style(g);g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();dirty=true;}last=p;render();
});
function end(e){
 if(e.pointerType==='touch'&&touches.has(e.pointerId))touches.delete(e.pointerId);
 if(multi){if(touches.size===0)finishMulti();return;}
 if(e.pointerId!==pointer)return;active=false;pointer=null;state();
}
canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
function image(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('이미지를 열 수 없습니다.'));i.src=src;});}
async function loadLayer(l){const b=bitmap();if(l.data){const i=await image(l.data),scale=Math.min(W/i.width,H/i.height),w=i.width*scale,h=i.height*scale;b.getContext('2d').drawImage(i,(W-w)/2,(H-h)/2,w,h);}return {...defaults(l.id,l.name),...l,bitmap:b,data:undefined};}
function metrics(c){const g=c.getContext('2d',{willReadFrequently:true}),w=c.width,h=c.height,d=g.getImageData(0,0,w,h).data;let n=0,xs=0,ys=0,minX=w,minY=h,maxX=0,maxY=0,r=0,green=0,b=0,transparent=false;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4;if(d[k+3]<255)transparent=true;if(d[k+3]>16){n++;xs+=x;ys+=y;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);r+=d[k];green+=d[k+1];b+=d[k+2];}}return {coverage:n/(w*h),centerX:n?xs/n/w:.5,centerY:n?ys/n/h:.5,width:n?(maxX-minX+1)/w:0,height:n?(maxY-minY+1)/h:0,color:n?[r/n/255,green/n/255,b/n/255]:[0,0,0],transparent};}
async function command(m){try{
 if(saving&&!['saved','saveFailed','analyze'].includes(m.type))return;
 if(m.type==='init'){
   loading=true;const input=m.layers||[{...defaults('draw-1','그림 1'),data:m.drawing},{...defaults('draw-2','그림 2')}];
   layers=await Promise.all(input.map(l=>loadLayer(l)));references=await Promise.all((m.references||[]).map(l=>loadLayer(l)));activeLayerId=m.activeLayerId||'draw-1';if(!selected())activeLayerId=layers[0].id;activeDrawLayerId=layers.some(l=>l.id===activeLayerId)?activeLayerId:(layers[0]?.id||'');history=[];future=[];dirty=false;loading=false;render();state();send({type:'initialized'});
 }
 if(m.type==='tool'){tool=m.tool;if(tool==='pen'||tool==='eraser'){selectDrawLayer();state();}}
 if(m.type==='brush')brush=m.brush;
 if(m.type==='color')color=m.color;
 if(m.type==='width'){if(m.tool==='eraser')eraserWidth=m.width;else penWidth=m.width;}
 if(m.type==='zoom'){zoom=Math.max(1,Math.min(4,m.zoom));size();send({type:'zoom',zoom});}
 if(m.type==='select'){const l=[...layers,...references].find(l=>l.id===m.id);if(l){activeLayerId=l.id;if(layers.includes(l))activeDrawLayerId=l.id;state();}}
 if(m.type==='transform'){const l=selected();if(l){checkpoint();for(const k of ['x','y','rotation'])if(Number.isFinite(m[k]))l[k]=m[k];if(Number.isFinite(m.scale))l.scale=Math.max(.1,Math.min(4,m.scale));if(Number.isFinite(m.opacity))l.opacity=Math.max(0,Math.min(1,m.opacity));if(typeof m.visible==='boolean')l.visible=m.visible;render();state();}}
 if(m.type==='addReferences'){const added=await Promise.all(m.references.map(l=>loadLayer(l)));checkpoint();references.push(...added);render();state();}
 if(m.type==='soloReference'){
   const target=references.find(l=>l.id===m.id);if(target){checkpoint();const onlyTarget=target.visible&&references.every(l=>l.id===target.id||!l.visible);references.forEach(l=>{l.visible=onlyTarget?false:l.id===target.id;});if(!onlyTarget)activeLayerId=target.id;render();state();}
 }
 if(m.type==='removeReference'){const index=references.findIndex(l=>l.id===m.id);if(index>=0){checkpoint();const removed=references[index];references.splice(index,1);if(activeLayerId===removed.id)selectDrawLayer();render();state();}}
 if(m.type==='undo')undo();
 if(m.type==='redo')redo();
 if(m.type==='clear'){selectDrawLayer();const l=selected();if(l&&layers.includes(l)){checkpoint();l.bitmap.getContext('2d').clearRect(0,0,W,H);render();state();}}
 if(m.type==='save'){saving=true;const out=bitmap(),g=out.getContext('2d');layers.forEach(l=>composite(g,l));send({type:'save',dirty,data:out.toDataURL('image/png'),metrics:metrics(out),activeLayerId,layers:layers.map(l=>({...meta(l),data:l.bitmap.toDataURL('image/png')})),references:references.map(l=>({...meta(l),path:l.path}))});}
 if(m.type==='saved'){saving=false;dirty=false;state();}
 if(m.type==='saveFailed'){saving=false;state();}
 if(m.type==='analyze'){const i=await image(m.data),c=document.createElement('canvas');const scale=Math.min(1,720/Math.max(i.width,i.height));c.width=Math.max(1,Math.round(i.width*scale));c.height=Math.max(1,Math.round(i.height*scale));c.getContext('2d').drawImage(i,0,0,c.width,c.height);send({type:'analysis',id:m.id,metrics:metrics(c)});}
 }catch(error){loading=false;saving=false;send({type:'error',id:m.id,message:String(error)});}}
let pending=Promise.resolve();window.command=m=>{pending=pending.then(()=>command(m));return pending;};window.addEventListener('resize',size);size();send({type:'ready'});
})();
</script></body></html>`;
