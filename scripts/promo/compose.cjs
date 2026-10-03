// 홍보 그림 구성(1차: 그래픽 이미지 1024×500 · 휴대전화 ① 1080×1920).
// 캐릭터는 character.cjs 의 벡터 원본, 움직임 순간은 engine-run.cjs 가 앱 엔진에서 꺼낸 변환값(engine-motion.json)을
// 엔진의 composite() 와 같은 순서(translate(px+dx,py+dy) · rotate · scale · translate(-px,-py))로 적용한다 — 지어낸 자세가 아니다.
// 앱 화면 칸은 --ui <png>(대체 렌더 또는 실기기 캡처). 대체 렌더면 그 칸에 'DRAFT 화면' 표시가 붙는다.
// 사용: node scripts/promo/compose.cjs <나갈 폴더> --ui <앱 화면 png> [--ui-is-device]
const fs = require('fs');
const path = require('path');
const C = require('./character.cjs');
const root = path.resolve(__dirname, '../..');
const out = path.resolve(process.argv[2] || 'verification/promo/store');
const uiIdx = process.argv.indexOf('--ui');
const ui = uiIdx > 0 ? path.resolve(process.argv[uiIdx + 1]) : null;
const uiIsDevice = process.argv.includes('--ui-is-device');
fs.mkdirSync(out, { recursive: true });
const motion = JSON.parse(fs.readFileSync(path.join(root, 'verification/promo/motion/engine-motion.json'), 'utf8'));
const url = p => 'file:///' + p.replace(/\\/g, '/');
const LEMON = '#F5E642', LEMON_SOFT = '#FAF2A0', INK = C.INK;
const FONT = `@font-face{font-family:Jua;src:url('${url(path.join(root, 'assets/fonts/Jua-Regular.ttf'))}')}body{margin:0;font-family:'Malgun Gothic',sans-serif;color:${INK}}`;
const tf = d => d ? `translate(${d.px + d.dx} ${d.py + d.dy}) rotate(${d.rot}) scale(${d.sx} ${d.sy}) translate(${-d.px} ${-d.py})` : '';
// 엔진 순간 하나를 그린 캐릭터(svg). layers: [[poseKey, part, layerId]]
const moment = (caseName, idx, layers, size, extra = '') => {
  const m = motion[caseName].moments[idx];
  const g = layers.map(([pose, part, id]) => `<g transform="${tf(m.deltas.find(x => x.id === id).d)}">${C.drawPose(pose, 'mongi', part)}</g>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 360 360" style="overflow:visible;${extra}">${g}</svg>`;
};
const still = (pose, size, sp = 'mongi') => `<svg width="${size}" height="${size}" viewBox="0 0 360 360">${C.drawPose(pose, sp)}</svg>`;
const shadow = (w, o = .18) => `<div style="width:${w}px;height:${w * .16}px;border-radius:50%;background:rgba(42,35,32,${o});margin:-${w * .1}px auto 0"></div>`;

// ── 그래픽 이미지 1024×500 ───────────────────────────────────────────────────────────
// 왼쪽: 이름과 메시지. 가운데~오른쪽: 주인공의 '통통' 세 순간(땅에 눌림 → 공중 → 땅) + 둘레에 다른 표정 셋(작게).
const bounce = (i, size) => moment('bounce-excited', i, [['excited', 'all', 'draw-1']], size);
const feature = `<!doctype html><meta charset="utf-8"><style>${FONT}
.c{width:1024px;height:500px;background:${LEMON};position:relative;overflow:hidden}
.blob{position:absolute;left:470px;top:-120px;width:620px;height:620px;border-radius:50%;background:${LEMON_SOFT}}
.t{position:absolute;left:54px;top:118px;width:380px}
.brand{display:flex;align-items:baseline;gap:12px}.brand b{font-family:Jua;font-weight:400;font-size:86px;line-height:1}.brand span{font-family:Jua;font-size:34px;color:#5A5040}
.msg{margin-top:20px;font-size:34px;line-height:1.32;font-weight:800;letter-spacing:-.6px}
.free{margin-top:22px;font-size:20px;font-weight:700;color:#5A5040}
.hop{position:absolute;left:452px;top:96px;width:430px;height:330px}
.arc{position:absolute;left:0;top:0}
.m{position:absolute}
.side{position:absolute;filter:drop-shadow(0 4px 0 rgba(42,35,32,.12))}
</style><div class="c"><div class="blob"></div>
<div class="t"><div class="brand"><b>emoti</b><span>이모티</span></div>
<div class="msg">내 그림을<br>움직이는 이모티콘으로</div></div>
<div class="hop">
  <svg class="arc" width="430" height="330" viewBox="0 0 430 330"><path d="M84 248 Q215 40 346 248" fill="none" stroke="${INK}" stroke-width="5" stroke-dasharray="4 14" stroke-linecap="round" opacity=".55"/></svg>
  <div class="m" style="left:-6px;top:150px;opacity:.5">${bounce(0, 170)}</div>
  <div class="m" style="left:262px;top:150px;opacity:.5">${bounce(2, 170)}</div>
  <div class="m" style="left:96px;top:-10px">${bounce(1, 250)}</div>
  <div style="position:absolute;left:160px;top:296px;width:120px">${shadow(120, .16)}</div>
</div>
<div class="side" style="left:880px;top:30px">${still('thanks', 130)}</div>
<div class="side" style="left:884px;top:180px">${still('surprised', 124)}</div>
<div class="side" style="left:870px;top:330px">${still('goodnight', 140)}</div>
</div>`;
fs.writeFileSync(path.join(out, 'feature-graphic-1024x500.html'), feature);

// ── 휴대전화 ① 1080×1920: 내 그림에 움직임을 더해요 ──────────────────────────────────
// 위: 문구. 가운데: 주인공 '통통'의 세 순간을 크게(엔진 값). 아래: 실제 움직이기 화면(폰 위쪽만, 글자가 읽히는 크기).
const SW = 600; // 폰 화면 폭(px). 대체 렌더 PNG(2배)에서 화면 영역은 x 110~890 · y 116~1804
const shot = ui ? `<img src="${url(ui)}" style="position:absolute;width:${1000 * SW / 780}px;left:${-110 * SW / 780}px;top:${-116 * SW / 780}px">` : '';
const phone1 = `<!doctype html><meta charset="utf-8"><style>${FONT}
.c{width:1080px;height:1920px;background:${LEMON};position:relative;overflow:hidden}
.h{position:absolute;left:0;right:0;top:112px;text-align:center;font-family:Jua;font-size:96px;line-height:1.15;letter-spacing:-1px}
.s{position:absolute;left:0;right:0;top:362px;text-align:center;font-size:38px;font-weight:700;color:#4A4236}
.stage{position:absolute;left:0;right:0;top:420px;height:500px;transform:scale(.82);transform-origin:50% 0}
.chip{position:absolute;left:50%;transform:translateX(-50%);top:860px;height:64px;padding:0 28px;border-radius:32px;background:#fff;border:4px solid ${INK};display:flex;align-items:center;gap:12px;font-size:34px;font-weight:800;white-space:nowrap}
.ph{position:absolute;left:222px;top:960px;width:636px;height:960px;border-radius:56px 56px 0 0;background:${INK};padding:18px 18px 0;box-sizing:border-box}
.scr{position:relative;width:600px;height:942px;border-radius:40px 40px 0 0;overflow:hidden;background:#fff}
.mark{position:absolute;right:22px;top:22px;background:#D2574F;color:#fff;font:800 24px sans-serif;padding:8px 14px;border-radius:10px;z-index:2}
</style><div class="c">
<div class="h">내 그림에<br>움직임을 더해요</div>
<div class="s">그린 그림에 움직임을 골라 바로 미리 봐요</div>
<div class="stage">
  <svg style="position:absolute;left:0;top:0" width="1080" height="620" viewBox="0 0 1080 620"><path d="M250 470 Q540 40 830 470" fill="none" stroke="${INK}" stroke-width="7" stroke-dasharray="6 20" stroke-linecap="round" opacity=".5"/></svg>
  <div style="position:absolute;left:40px;top:250px;opacity:.45">${bounce(0, 360)}</div>
  <div style="position:absolute;left:680px;top:250px;opacity:.45">${bounce(2, 360)}</div>
  <div style="position:absolute;left:290px;top:0">${bounce(1, 500)}</div>
  <div style="position:absolute;left:420px;top:560px;width:240px">${shadow(240, .14)}</div>
</div>
<div class="chip"><span style="font-family:Jua;font-weight:400">통통</span><span style="font-size:26px;color:#6B655E">무료 움직임</span></div>
<div class="ph"><div class="scr">${shot}${uiIsDevice ? '' : '<div class="mark">DRAFT 화면 · 대체 렌더</div>'}</div></div>
</div>`;
fs.writeFileSync(path.join(out, uiIsDevice ? 'phone-01.html' : 'phone-01-DRAFT.html'), phone1);
console.log(out);
