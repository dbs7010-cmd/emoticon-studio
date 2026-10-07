// 전체 움직임의 계산식(45.39). 엔진(canvas-html 안의 문자열)과 효과 견본(RN)이 **같은 식**을 쓴다.
//
// 엔진은 WebView 안에서 도는 문자열이라 TS 함수를 그대로 넘길 수 없다(릴리스 번들의 함수는 소스를 잃는다).
// 그래서 식을 두 벌 둔다: MOTION_MATH_JS(엔진에 들어가는 글자) 와 presetDelta(RN 견본).
// motion-preset-test 가 두 벌을 여러 시점·세기·방향에서 비교해 한 글자라도 어긋나면 실패한다.
//
// 모든 식은 한 바퀴(u: 0→1) 안에서 끝나고 u=1 이 u=0 과 같다 — 반복해도 이음매가 없다.
// 들어오는 효과(뿅·쓱·쿵)는 끝에 짧게 빠져나간다(작아지거나 들어온 쪽으로 나감). 그래서 다시 들어올 때 튀지 않는다.
// 앞의 여섯(float·bounce·pulse·tilt·shake·jitter)은 45.34~45.38 과 **같은 값**을 낸다. 저장된 칸이 달라 보이면 안 된다.
import type { MotionPreset, MotionStep } from './types';

export type MotionDirection = 'left' | 'right' | 'up' | 'down';
export type Delta = { px: number; py: number; dx: number; dy: number; sx: number; sy: number; rot: number };

// 무료 6종(45.39 사용자 확정). 나머지는 PRO. 이미 칸에 들어간 효과는 PRO 가 없어도 재생·내보내기 된다.
export const FREE_MOTION_PRESETS: readonly MotionPreset[] = ['pop', 'bounce', 'float', 'tilt', 'shake', 'pulse'];
export const isProPreset = (preset?: MotionPreset | null): boolean => !!preset && !FREE_MOTION_PRESETS.includes(preset);
// 들어오고 머무는 효과는 한 바퀴가 길어야 읽힌다(기본 한 바퀴의 두 배).
export const LONG_MOTION_PRESETS: readonly MotionPreset[] = ['pop', 'slide', 'peek', 'drop', 'vanish', 'hop', 'bow', 'spin', 'punch'];
export const loopScale = (preset?: MotionPreset | null): number => preset && LONG_MOTION_PRESETS.includes(preset) ? 2 : 1;
// 일부러 캔버스 밖에서 들어오는 효과. '칸 밖으로 나가요' 경고는 들어온 뒤(머무는 동안)만 본다. 빼꼼은 늘 일부가 가려진다.
export const ENTRANCE_REST: Partial<Record<MotionPreset, number | null>> = { slide: .5, drop: .55, peek: null };
// 머문 뒤 일부러 칸 밖으로 나가는 구간의 시작(쓱은 .88 부터 들어온 쪽으로 빠진다). 경고는 이 구간도 보지 않는다 —
// 잘림 판단이 한 바퀴의 모든 내보내기 프레임 시점을 보게 된 뒤(2026-10-06) 이 구간이 잡혀 쓱이 늘 '칸 밖' 경고를 받았다.
export const ENTRANCE_EXIT: Partial<Record<MotionPreset, number>> = { slide: .88 };

// ── 엔진에 들어가는 글자 ─────────────────────────────────────────────────────────────
export const MOTION_MATH_JS = `
function presetDelta(p,u,a,dir,W,H){
 var d={px:W/2,py:H/2,dx:0,dy:0,sx:1,sy:1,rot:0};
 var T=Math.PI*2,phase=u*T,k=.4+1.2*a;
 function cl(x){return x<0?0:x>1?1:x;}
 function seg(f,t){return cl((u-f)/(t-f));}
 function back(x,c){x=x-1;return 1+(c+1)*x*x*x+c*x*x;}
 function outc(x){return 1-Math.pow(1-x,3);}
 function inout(x){return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;}
 if(p==='float'){d.dy=Math.sin(phase)*(H*.035)*a;}
 else if(p==='bounce'){var up=Math.abs(Math.sin(phase));d.dy=-up*(H*.07)*a;var sq=(1-up)*(1-up)*.12*a;d.sy=1-sq;d.sx=1+sq*.8;}
 else if(p==='pulse'){var s0=1+Math.sin(phase)*.07*a;d.sx=s0;d.sy=s0;}
 else if(p==='tilt'){d.rot=Math.sin(phase)*7*a;}
 else if(p==='shake'){d.dx=Math.sin(phase*2)*(W*.035)*a;}
 else if(p==='jitter'){d.dx=Math.sin(phase*7)*(W*.012)*a;d.dy=Math.cos(phase*9)*(H*.010)*a;d.rot=Math.sin(phase*8)*1.5*a;}
 else if(p==='pop'){var s1=u<.06?.001:u<.9?back(seg(.06,.4),1+1.4*a):1-inout(seg(.9,1));s1=Math.max(.001,s1);d.sx=s1;d.sy=s1;}
 else if(p==='slide'){var o=u<.88?1-back(seg(0,.34),.6+1.2*a):inout(seg(.88,1));
  if(dir==='right')d.dx=o*W*1.02;else if(dir==='up')d.dy=-o*H*1.02;else if(dir==='down')d.dy=o*H*1.02;else d.dx=-o*W*1.02;}
 else if(p==='peek'){d.py=H;var rest=H*(.36-.26*a),hid=H*.85,y;
  if(u<.22)y=hid+(rest-hid)*outc(seg(0,.22));
  else if(u<.72)y=rest+Math.sin((u-.22)/.5*T*2)*H*.008;
  else y=rest+(hid-rest)*inout(seg(.72,.95));
  d.dy=y;}
 else if(p==='drop'){d.py=H*.92;
  if(u<.26){var f=seg(0,.26);d.dy=-(1-f*f)*H*1.05;}
  else if(u<.9){var g=seg(.26,.5),q=.18*k*(1-g)*(1-g)*Math.cos(g*Math.PI*3);d.sy=1-q;d.sx=1+q*.8;}
  else{var z=Math.max(.001,1-inout(seg(.9,1)));d.sx=z;d.sy=z;}}
 else if(p==='vanish'){var s2;
  if(u<.4)s2=1;
  else if(u<.52)s2=1+.1*k*Math.sin(seg(.4,.52)*Math.PI/2);
  else if(u<.72)s2=(1+.1*k)*(1-inout(seg(.52,.72)));
  else if(u<.86)s2=0;
  else s2=back(seg(.86,1),1.2);
  s2=Math.max(.001,s2);d.sx=s2;d.sy=s2;}
 else if(p==='hop'){d.py=H*.92;
  if(u<.18){var h1=Math.sin(seg(0,.18)*Math.PI);d.sy=1-.12*k*h1;d.sx=1+.1*k*h1;}
  else if(u<.66){var h2=seg(.18,.66);d.dy=-Math.sin(h2*Math.PI)*H*.16*k;d.sy=1+.05*k*Math.sin(h2*T);d.sx=1-.03*k*Math.sin(h2*T);}
  else if(u<.82){var h3=Math.sin(seg(.66,.82)*Math.PI);d.sy=1-.1*k*h3;d.sx=1+.08*k*h3;}}
 else if(p==='nod'){d.py=H*.92;if(u<.5){var n=Math.pow(Math.sin(seg(0,.5)*T),2);d.dy=n*H*.025*k;d.sy=1-n*.05*k;}}
 else if(p==='bow'){d.py=H*.92;var b=u<.15?0:u<.42?inout(seg(.15,.42)):u<.62?1:u<.85?1-inout(seg(.62,.85)):0;
  d.sy=1-.2*k*b;d.sx=1+.04*k*b;d.dy=b*H*.02*k;}
 else if(p==='dance'){d.py=H*.92;d.dx=Math.sin(phase)*W*.035*k;d.dy=-(1-Math.abs(Math.sin(phase)))*H*.03*k;d.rot=Math.sin(phase)*6*k;}
 else if(p==='sway'){d.py=H*.95;d.rot=Math.sin(phase)*10*k;}
 else if(p==='spin'){d.rot=u<.7?360*inout(seg(0,.7)):0;}
 else if(p==='shiver'){d.dx=Math.sin(phase*9)*W*.022*k;d.dy=Math.cos(phase*11)*H*.006*k;d.rot=Math.sin(phase*7)*2.5*k;}
 else if(p==='punch'){var s3=1;
  if(u>=.3&&u<.4)s3=1+.32*k*outc(seg(.3,.4));
  else if(u>=.4&&u<.75){var v=seg(.4,.75);s3=1+.32*k*Math.cos(v*Math.PI*2.5)*(1-v)*(1-v);}
  d.sx=s3;d.sy=s3;}
 else if(p==='stretch'){d.py=H*.92;var w=Math.sin(phase);d.sy=1+.15*k*w;d.sx=1-.11*k*w;}
 return d;
}
var STEP_ENTER={pop:.6,slide:.6,drop:.7},STEP_BLEND=.12,STEP_REST={slide:.5,drop:.55};
function stepTotal(steps){var t=0;for(var i=0;i<steps.length;i++)t+=steps[i].duration*steps[i].repeat;return t;}
function stepLocal(st,local){var u=(local%st.duration)/st.duration;if(STEP_ENTER[st.preset]!==undefined)u=(local>=st.duration?1:u)*STEP_ENTER[st.preset];return u;}
function stepEndU(st){return STEP_ENTER[st.preset]!==undefined?STEP_ENTER[st.preset]:.9999;}
function stepAt(steps,t){var total=stepTotal(steps),tt=((t%total)+total)%total,acc=0;for(var i=0;i<steps.length;i++){var len=steps[i].duration*steps[i].repeat;if(tt<acc+len||i===steps.length-1)return {i:i,local:Math.min(tt-acc,len)};acc+=len;}return {i:0,local:0};}
function stepDelta(steps,t,a,dir,W,H){
 var at=stepAt(steps,t),st=steps[at.i],sa=st.strength==null?a:st.strength,sd=st.direction||dir;
 var d=presetDelta(st.preset,stepLocal(st,at.local),sa,sd,W,H);
 if(steps.length>1&&at.local<STEP_BLEND){var pv=steps[(at.i+steps.length-1)%steps.length],pa=pv.strength==null?a:pv.strength,e=presetDelta(pv.preset,stepEndU(pv),pa,pv.direction||dir,W,H),m=at.local/STEP_BLEND;m=m*m*(3-2*m);
  d={px:e.px+(d.px-e.px)*m,py:e.py+(d.py-e.py)*m,dx:e.dx+(d.dx-e.dx)*m,dy:e.dy+(d.dy-e.dy)*m,sx:e.sx+(d.sx-e.sx)*m,sy:e.sy+(d.sy-e.sy)*m,rot:e.rot+(d.rot-e.rot)*m};}
 return d;
}
function stepEntering(steps,t){var at=stepAt(steps,t),st=steps[at.i];return STEP_REST[st.preset]!==undefined&&at.local<st.duration&&stepLocal(st,at.local)<STEP_REST[st.preset];}
`;

// ── RN 견본이 쓰는 같은 식 ──────────────────────────────────────────────────────────
export function presetDelta(p: MotionPreset | undefined, u: number, a: number, dir: MotionDirection | undefined, W: number, H: number): Delta {
  const d: Delta = { px: W / 2, py: H / 2, dx: 0, dy: 0, sx: 1, sy: 1, rot: 0 };
  const T = Math.PI * 2, phase = u * T, k = .4 + 1.2 * a;
  const cl = (x: number) => x < 0 ? 0 : x > 1 ? 1 : x;
  const seg = (f: number, t: number) => cl((u - f) / (t - f));
  const back = (x: number, c: number) => { x = x - 1; return 1 + (c + 1) * x * x * x + c * x * x; };
  const outc = (x: number) => 1 - Math.pow(1 - x, 3);
  const inout = (x: number) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  if (p === 'float') { d.dy = Math.sin(phase) * (H * .035) * a; }
  else if (p === 'bounce') { const up = Math.abs(Math.sin(phase)); d.dy = -up * (H * .07) * a; const sq = (1 - up) * (1 - up) * .12 * a; d.sy = 1 - sq; d.sx = 1 + sq * .8; }
  else if (p === 'pulse') { const s0 = 1 + Math.sin(phase) * .07 * a; d.sx = s0; d.sy = s0; }
  else if (p === 'tilt') { d.rot = Math.sin(phase) * 7 * a; }
  else if (p === 'shake') { d.dx = Math.sin(phase * 2) * (W * .035) * a; }
  else if (p === 'jitter') { d.dx = Math.sin(phase * 7) * (W * .012) * a; d.dy = Math.cos(phase * 9) * (H * .010) * a; d.rot = Math.sin(phase * 8) * 1.5 * a; }
  else if (p === 'pop') { let s1 = u < .06 ? .001 : u < .9 ? back(seg(.06, .4), 1 + 1.4 * a) : 1 - inout(seg(.9, 1)); s1 = Math.max(.001, s1); d.sx = s1; d.sy = s1; }
  else if (p === 'slide') {
    const o = u < .88 ? 1 - back(seg(0, .34), .6 + 1.2 * a) : inout(seg(.88, 1));
    if (dir === 'right') d.dx = o * W * 1.02; else if (dir === 'up') d.dy = -o * H * 1.02; else if (dir === 'down') d.dy = o * H * 1.02; else d.dx = -o * W * 1.02;
  }
  else if (p === 'peek') {
    d.py = H; const rest = H * (.36 - .26 * a), hid = H * .85; let y: number;
    if (u < .22) y = hid + (rest - hid) * outc(seg(0, .22));
    else if (u < .72) y = rest + Math.sin((u - .22) / .5 * T * 2) * H * .008;
    else y = rest + (hid - rest) * inout(seg(.72, .95));
    d.dy = y;
  }
  else if (p === 'drop') {
    d.py = H * .92;
    if (u < .26) { const f = seg(0, .26); d.dy = -(1 - f * f) * H * 1.05; }
    else if (u < .9) { const g = seg(.26, .5), q = .18 * k * (1 - g) * (1 - g) * Math.cos(g * Math.PI * 3); d.sy = 1 - q; d.sx = 1 + q * .8; }
    else { const z = Math.max(.001, 1 - inout(seg(.9, 1))); d.sx = z; d.sy = z; }
  }
  else if (p === 'vanish') {
    let s2: number;
    if (u < .4) s2 = 1;
    else if (u < .52) s2 = 1 + .1 * k * Math.sin(seg(.4, .52) * Math.PI / 2);
    else if (u < .72) s2 = (1 + .1 * k) * (1 - inout(seg(.52, .72)));
    else if (u < .86) s2 = 0;
    else s2 = back(seg(.86, 1), 1.2);
    s2 = Math.max(.001, s2); d.sx = s2; d.sy = s2;
  }
  else if (p === 'hop') {
    d.py = H * .92;
    if (u < .18) { const h1 = Math.sin(seg(0, .18) * Math.PI); d.sy = 1 - .12 * k * h1; d.sx = 1 + .1 * k * h1; }
    else if (u < .66) { const h2 = seg(.18, .66); d.dy = -Math.sin(h2 * Math.PI) * H * .16 * k; d.sy = 1 + .05 * k * Math.sin(h2 * T); d.sx = 1 - .03 * k * Math.sin(h2 * T); }
    else if (u < .82) { const h3 = Math.sin(seg(.66, .82) * Math.PI); d.sy = 1 - .1 * k * h3; d.sx = 1 + .08 * k * h3; }
  }
  else if (p === 'nod') { d.py = H * .92; if (u < .5) { const n = Math.pow(Math.sin(seg(0, .5) * T), 2); d.dy = n * H * .025 * k; d.sy = 1 - n * .05 * k; } }
  else if (p === 'bow') {
    d.py = H * .92; const b = u < .15 ? 0 : u < .42 ? inout(seg(.15, .42)) : u < .62 ? 1 : u < .85 ? 1 - inout(seg(.62, .85)) : 0;
    d.sy = 1 - .2 * k * b; d.sx = 1 + .04 * k * b; d.dy = b * H * .02 * k;
  }
  else if (p === 'dance') { d.py = H * .92; d.dx = Math.sin(phase) * W * .035 * k; d.dy = -(1 - Math.abs(Math.sin(phase))) * H * .03 * k; d.rot = Math.sin(phase) * 6 * k; }
  else if (p === 'sway') { d.py = H * .95; d.rot = Math.sin(phase) * 10 * k; }
  else if (p === 'spin') { d.rot = u < .7 ? 360 * inout(seg(0, .7)) : 0; }
  else if (p === 'shiver') { d.dx = Math.sin(phase * 9) * W * .022 * k; d.dy = Math.cos(phase * 11) * H * .006 * k; d.rot = Math.sin(phase * 7) * 2.5 * k; }
  else if (p === 'punch') {
    let s3 = 1;
    if (u >= .3 && u < .4) s3 = 1 + .32 * k * outc(seg(.3, .4));
    else if (u >= .4 && u < .75) { const v = seg(.4, .75); s3 = 1 + .32 * k * Math.cos(v * Math.PI * 2.5) * (1 - v) * (1 - v); }
    d.sx = s3; d.sy = s3;
  }
  else if (p === 'stretch') { d.py = H * .92; const w = Math.sin(phase); d.sy = 1 + .15 * k * w; d.sx = 1 - .11 * k * w; }
  return d;
}

// ── V2 다중 동작(2026-10-07): 엔진 문자열(stepDelta)과 같은 식. motion-step-test 가 두 벌을 비교한다. ──────────────
export const STEP_LIMITS = { maxSteps: 3, minDuration: .4, maxDuration: 2, maxRepeat: 4, maxTotal: 3 } as const;
// 들어오는 효과는 '머무는 자세'까지만 재생하고 멈춘다(그 뒤 원래 식의 빠져나가기 구간을 쓰지 않음).
export const STEP_ENTER: Partial<Record<MotionPreset, number>> = { pop: .6, slide: .6, drop: .7 };
// 단계로 이을 수 없는 효과: 빼꼼(늘 일부가 가려진 자세로 끝남)·사라지기(보이지 않는 자세로 끝남) — 다음 단계로 튄다.
export const STEP_EXCLUDED: readonly MotionPreset[] = ['peek', 'vanish'];
const STEP_BLEND = .12, STEP_REST: Partial<Record<MotionPreset, number>> = { slide: .5, drop: .55 };
export const stepTotal = (steps: MotionStep[]) => steps.reduce((t, s) => t + s.duration * s.repeat, 0);
const stepLocal = (st: MotionStep, local: number) => { let u = (local % st.duration) / st.duration; const e = STEP_ENTER[st.preset]; if (e !== undefined) u = (local >= st.duration ? 1 : u) * e; return u; };
const stepEndU = (st: MotionStep) => STEP_ENTER[st.preset] ?? .9999;
export function stepAt(steps: MotionStep[], t: number): { i: number; local: number } {
  const total = stepTotal(steps), tt = ((t % total) + total) % total;
  let acc = 0;
  for (let i = 0; i < steps.length; i++) { const len = steps[i].duration * steps[i].repeat; if (tt < acc + len || i === steps.length - 1) return { i, local: Math.min(tt - acc, len) }; acc += len; }
  return { i: 0, local: 0 };
}
export function stepDelta(steps: MotionStep[], t: number, a: number, dir: MotionDirection | undefined, W: number, H: number): Delta {
  const at = stepAt(steps, t), st = steps[at.i], sa = st.strength ?? a;
  let d = presetDelta(st.preset, stepLocal(st, at.local), sa, st.direction ?? dir, W, H);
  if (steps.length > 1 && at.local < STEP_BLEND) {
    const pv = steps[(at.i + steps.length - 1) % steps.length], e = presetDelta(pv.preset, stepEndU(pv), pv.strength ?? a, pv.direction ?? dir, W, H);
    let m = at.local / STEP_BLEND; m = m * m * (3 - 2 * m);
    d = { px: e.px + (d.px - e.px) * m, py: e.py + (d.py - e.py) * m, dx: e.dx + (d.dx - e.dx) * m, dy: e.dy + (d.dy - e.dy) * m, sx: e.sx + (d.sx - e.sx) * m, sy: e.sy + (d.sy - e.sy) * m, rot: e.rot + (d.rot - e.rot) * m };
  }
  return d;
}
export const stepEntering = (steps: MotionStep[], t: number) => { const at = stepAt(steps, t), st = steps[at.i], r = STEP_REST[st.preset]; return r !== undefined && at.local < st.duration && stepLocal(st, at.local) < r; };
