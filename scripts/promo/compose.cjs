// 홍보 그림 구성: 그래픽 이미지 1024×500 + 휴대전화 ①~④ 1080×1920.
// 캐릭터는 character.cjs 의 벡터 원본, 움직임 순간은 engine-run.cjs 가 앱 엔진에서 꺼낸 변환값(engine-motion.json)을
// 엔진의 composite() 와 같은 순서(translate(px+dx,py+dy) · rotate · scale · translate(-px,-py))로 적용한다 — 지어낸 자세가 아니다.
//   통통(bounce): 엔진값은 dx=0 — **제자리 위아래**다. 그래서 잔상은 같은 세로축에 겹친다(눌림 t0 → 뜀 t1 → 착지 t2=t0).
//   부분 움직임(rotate): 손 레이어만 −30°/0°/+30°, 몸 레이어는 변환 없음.
// 앱 화면 칸은 scripts/_screens.cjs 의 홍보 장면(PROMO_SCENES=1) 대체 렌더 PNG, 또는 실기기 캡처(--device <폴더>).
// 대체 렌더면 화면 칸에 'DRAFT 화면 · 대체 렌더' 표시가 붙는다.
// 사용: node scripts/promo/compose.cjs <나갈 폴더> --ui <대체 렌더 폴더> [--device <캡처 폴더: phone-1.png … phone-4.png>]
const fs = require('fs');
const path = require('path');
const C = require('./character.cjs');
const root = path.resolve(__dirname, '../..');
const out = path.resolve(process.argv[2] || 'verification/promo/store');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? path.resolve(process.argv[i + 1]) : null; };
const uiDir = arg('--ui'), deviceDir = arg('--device');
fs.mkdirSync(out, { recursive: true });
const motion = JSON.parse(fs.readFileSync(path.join(root, 'verification/promo/motion/engine-motion.json'), 'utf8'));
const url = p => 'file:///' + p.replace(/\\/g, '/');
const LEMON = '#F5E642', LEMON_SOFT = '#FAF2A0', INK = C.INK;
const FONT = `@font-face{font-family:Jua;src:url('${url(path.join(root, 'assets/fonts/Jua-Regular.ttf'))}')}body{margin:0;font-family:'Malgun Gothic',sans-serif;color:${INK}}`;
const tf = d => d ? `translate(${d.px + d.dx} ${d.py + d.dy}) rotate(${d.rot}) scale(${d.sx} ${d.sy}) translate(${-d.px} ${-d.py})` : '';
const delta = (caseName, idx, id) => motion[caseName].moments[idx].deltas.find(x => x.id === id).d;
// 엔진 순간 하나의 레이어(svg 안쪽 g)
const g = (caseName, idx, pose, part, id, attrs = '') => `<g transform="${tf(delta(caseName, idx, id))}" ${attrs}>${C.drawPose(pose, 'mongi', part)}</g>`;
const box = (inner, size, extra = '') => `<svg width="${size}" height="${size}" viewBox="0 0 360 360" style="overflow:visible;${extra}">${inner}</svg>`;
const still = (pose, size) => box(C.drawPose(pose), size);

// 통통: 같은 세로축에 겹친다. 바닥 그림자 → 눌린 잔상(t0, 옅게) → 뜬 순간(t1, 진하게) → 발밑 세로 속도선.
// 세로 이동은 엔진값(dy −17.64 · 360 기준) 그대로다. 잔상과 본 그림은 x 가 같다.
const bounceStack = size => {
  const peak = delta('bounce-excited', 1, 'draw-1');
  const footPeak = 300 + peak.dy;           // 뜬 순간 발 아래(그림 좌표)
  return box(`
    <ellipse cx="180" cy="308" rx="${92 * 1.07}" ry="13" fill="${INK}" opacity=".10"/>
    <ellipse cx="180" cy="308" rx="70" ry="10" fill="${INK}" opacity=".12"/>
    ${g('bounce-excited', 0, 'excited', 'all', 'draw-1', 'opacity=".28"')}
    ${g('bounce-excited', 1, 'excited', 'all', 'draw-1')}
    <g stroke="${INK}" stroke-width="5" stroke-linecap="round" opacity=".55">
      <path d="M150 ${footPeak + 12} v14"/><path d="M180 ${footPeak + 16} v16"/><path d="M210 ${footPeak + 12} v14"/>
    </g>`, size);
};
// 부분 움직임: 몸(변환 없음) + 손 세 순간(+30° 잔상 · 0° 잔상 · −30° 본 그림). 어깨 축 점과 회전 화살표.
const [PX, PY] = C.SHOULDER_R;
// 어깨 축 둘레 호(화면 각도, 도). 손이 −30°~+30° 오가는 범위를 가리킨다.
const pt = (r, a) => [PX + r * Math.cos(a * Math.PI / 180), PY + r * Math.sin(a * Math.PI / 180)];
const arcPath = (r, a0, a1) => { const [x0, y0] = pt(r, a0), [x1, y1] = pt(r, a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
const arrowHead = (r, a, dir) => { const [x, y] = pt(r, a), t = (a + 90 * dir) * Math.PI / 180, n = a * Math.PI / 180;
  const back = [x - 13 * Math.cos(t), y - 13 * Math.sin(t)];
  return `<path d="M${(back[0] + 8 * Math.cos(n)).toFixed(1)} ${(back[1] + 8 * Math.sin(n)).toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)} L${(back[0] - 8 * Math.cos(n)).toFixed(1)} ${(back[1] - 8 * Math.sin(n)).toFixed(1)}"/>`; };
const waveStack = size => box(`
  ${g('part-wave-hello', 0, 'hello', 'body', 'draw-1')}
  ${g('part-wave-hello', 3, 'hello', 'armR', 'draw-2', 'opacity=".45"')}
  ${g('part-wave-hello', 0, 'hello', 'armR', 'draw-2', 'opacity=".6"')}
  <g fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="${arcPath(80, -98, -24)}"/>
    ${arrowHead(80, -98, -1)}${arrowHead(80, -24, 1)}
  </g>
  ${g('part-wave-hello', 1, 'hello', 'armR', 'draw-2')}
  <circle cx="${PX}" cy="${PY}" r="7" fill="${LEMON}" stroke="${INK}" stroke-width="4"/>`, size);

// ── 그래픽 이미지 1024×500 ───────────────────────────────────────────────────────────
const feature = `<!doctype html><meta charset="utf-8"><style>${FONT}
.c{width:1024px;height:500px;background:${LEMON};position:relative;overflow:hidden}
.blob{position:absolute;left:470px;top:-120px;width:620px;height:620px;border-radius:50%;background:${LEMON_SOFT}}
.t{position:absolute;left:54px;top:118px;width:380px}
.brand{display:flex;align-items:baseline;gap:12px}.brand b{font-family:Jua;font-weight:400;font-size:86px;line-height:1}.brand span{font-family:Jua;font-size:34px;color:#5A5040}
.msg{margin-top:20px;font-size:34px;line-height:1.32;font-weight:800;letter-spacing:-.6px}
.side{position:absolute;filter:drop-shadow(0 4px 0 rgba(42,35,32,.12))}
</style><div class="c"><div class="blob"></div>
<div class="t"><div class="brand"><b>emoti</b><span>이모티</span></div>
<div class="msg">내 그림을<br>움직이는 이모티콘으로</div></div>
<div style="position:absolute;left:512px;top:42px">${bounceStack(420)}</div>
<div class="side" style="left:886px;top:30px">${still('thanks', 128)}</div>
<div class="side" style="left:890px;top:178px">${still('surprised', 122)}</div>
<div class="side" style="left:876px;top:326px">${still('goodnight', 138)}</div>
</div>`;
fs.writeFileSync(path.join(out, 'feature-graphic-1024x500.html'), feature);

// ── 휴대전화 1080×1920 공통 틀 ─────────────────────────────────────────────────────────
// 대체 렌더 PNG(2배)에서 화면 영역은 x 110~890 · y 116~1804(390×844dp). s = 1dp 의 그림 px.
// 화면 칸은 위에서부터 보이며 아래는 그림 밖으로 이어진다(폰이 아래로 잘린 구도).
const PHONE_TOP = 770;
const phone = ({ n, title, sub, hero, s, chip = '', pro = false, ui }) => {
  const sw = Math.round(390 * s);
  const device = deviceDir && fs.existsSync(path.join(deviceDir, `phone-${n}.png`)) ? path.join(deviceDir, `phone-${n}.png`) : null;
  // 실기기 캡처(1080 폭 등 기기 해상도)는 화면 폭에 맞춰 위에서부터, 대체 렌더는 화면 영역만 잘라 맞춘다.
  const shot = device
    // 기기 캡처의 맨 위 상태 표시줄(시계·아이콘, 1080 폭 기준 70px)은 잘라 낸다 — 캡처마다 달라 그림이 어수선해진다.
    ? `<img src="${url(device)}" style="position:absolute;left:0;top:${-70 * sw / 1080}px;width:${sw}px">`
    : `<img src="${url(ui)}" style="position:absolute;width:${500 * s}px;left:${-55 * s}px;top:${-58 * s}px">`;
  const html = `<!doctype html><meta charset="utf-8"><style>${FONT}
.c{width:1080px;height:1920px;background:${LEMON};position:relative;overflow:hidden}
.h{position:absolute;left:0;right:0;top:96px;text-align:center;font-family:Jua;font-size:92px;line-height:1.15;letter-spacing:-1px}
.s{position:absolute;left:0;right:0;top:330px;text-align:center;font-size:36px;font-weight:700;color:#4A4236}
.pro{display:inline-flex;align-items:center;height:62px;padding:0 20px;margin-left:16px;border-radius:16px;border:5px solid ${INK};background:#fff;font:900 40px 'Malgun Gothic',sans-serif;letter-spacing:1px;vertical-align:16px}
.stage{position:absolute;left:0;right:0;top:384px;height:380px}
.chip{position:absolute;left:50%;transform:translateX(-50%);height:58px;padding:0 26px;border-radius:29px;background:#fff;border:4px solid ${INK};display:flex;align-items:center;gap:12px;font-size:30px;font-weight:800;white-space:nowrap;z-index:3}
.ph{position:absolute;left:${540 - sw / 2 - 18}px;top:${PHONE_TOP}px;width:${sw + 36}px;height:${1920 - PHONE_TOP + 40}px;border-radius:56px;background:${INK};padding:18px;box-sizing:border-box}
.scr{position:relative;width:${sw}px;height:100%;border-radius:40px;overflow:hidden;background:#fff}
.mark{position:absolute;right:24px;top:${PHONE_TOP - 62}px;background:#D2574F;color:#fff;font:800 24px sans-serif;padding:8px 14px;border-radius:10px;z-index:4}
</style><div class="c">
<div class="h">${title}</div>
<div class="s">${sub}</div>
<div class="stage"><div style="position:absolute;left:340px;top:-6px;width:400px;height:400px;border-radius:50%;background:${LEMON_SOFT}"></div>${hero}</div>
${chip}
<div class="ph"><div class="scr">${shot}</div></div>
${device ? '' : '<div class="mark">DRAFT 화면 · 대체 렌더</div>'}
</div>`;
  const name = `phone-0${n}${device ? '' : '-DRAFT'}`;
  fs.writeFileSync(path.join(out, name + '.html'), html);
  return name;
};
const at = (left, top, inner) => `<div style="position:absolute;left:${left}px;top:${top}px">${inner}</div>`;
const tag = (left, top, text, strong = true) => `<div style="position:absolute;left:${left}px;top:${top}px;height:50px;padding:0 20px;border-radius:25px;background:#fff;border:4px solid ${INK};display:flex;align-items:center;font-size:27px;font-weight:${strong ? 800 : 700};white-space:nowrap">${text}</div>`;
const uiPng = id => path.join(uiDir, id + '.png');
const made = [];

// ① 내 그림에 움직임을 더해요 — 신나 · 통통(제자리 위아래). 화면: 통통 선택 + 세기·속도.
made.push(phone({ n: 1, s: 1.56, ui: uiPng('promo-1-motion'),
  title: '내 그림에<br>움직임을 더해요', sub: '그린 그림에 움직임을 골라 바로 미리 봐요',
  hero: at(540 - 200, -24, bounceStack(400)) + tag(722, 150, '통통') + tag(722, 214, '뛰었다가 착지할 때 눌려요', false).replace('font-size:27px', 'font-size:22px;height:42px') }));
// ② 나만의 캐릭터를 그려요 — 응원. 화면: 그리기(펜·브러시).
made.push(phone({ n: 2, s: 1.34, ui: uiPng('promo-2-draw'),
  title: '나만의 캐릭터를<br>그려요', sub: '펜·연필·마커로 내 손그림 그대로',
  hero: at(540 - 190, -20, still('cheer', 380)) }));
// ③ 손만 까딱, 원하는 부분만 — 안녕 · 손 레이어만 회전(PRO). 화면: 부분만 움직이기.
made.push(phone({ n: 3, s: 1.56, ui: uiPng('promo-3-parts'),
  title: '손만 까딱,<br>원하는 부분만<span class="pro">PRO</span>', sub: '레이어를 골라 그 부분만 움직여요',
  hero: at(540 - 230, -58, waveStack(460)) + tag(120, 250, '몸 · 그대로') + tag(800, 40, '손 · 회전') }));
// ④ 다양한 표정을 한 세트에 — 축하해. 화면: '몽이의 하루' 보드(12개 완성 / 32칸).
made.push(phone({ n: 4, s: 1.34, ui: uiPng('promo-4-board'),
  title: '다양한 표정을<br>한 세트에', sub: '완성한 이모티콘을 파일로 내보내요',
  hero: at(540 - 180, -10, still('congrats', 360)) }));
console.log(out, made.join(' '));
