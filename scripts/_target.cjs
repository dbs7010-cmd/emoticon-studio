// C — 수정 목표 시안. **제품 화면이 아니고 승인 시안도 아니다.**
// 승인 보드 01/02 의 배치를 기준으로 삼되, 최신 사용자 요구와 LOCKED(흰색·차콜·소량 노랑)를 얹어
// '이렇게 고치자'를 그림으로 보인 것이다. 앱의 실제 색 토큰과 실제 엔진 획 견본만 쓴다.
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const OUT = 'verification/round45_27/C';
// 앱의 색 토큰과 같은 값(src/components/ui.tsx). visual-system-test 가 이 값들을 못 박고 있어 어긋나면 검사가 잡는다.
const T = { ink: '#17191D', muted: '#555D69', faint: '#8B93A0', line: '#E3E6EC', lineStrong: '#CBD0DA',
  accent: '#FFD52A', accentSoft: '#FFF3B0', accentBorder: '#EFD25E', surface2: '#F5F6F8', paper: '#FFFFFF' };
const COMMIT = (() => { try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return '?'; } })();
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const ART = b64(path.resolve(__dirname, '..', 'assets', 'expression-guides', 'greeting-thanks-polite.png'));
const CANVAS = b64('verification/round45_23/screens/assets/canvas-sample.png');
const STROKE = k => b64(path.resolve(__dirname, '..', 'assets', 'art', 'stroke-' + k + '.png'));

const head = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css">
<style>
 :root{--ink:${T.ink};--muted:${T.muted};--faint:${T.faint};--line:${T.line};--strong:${T.lineStrong};
  --accent:${T.accent};--soft:${T.accentSoft};--border:${T.accentBorder};--surface2:${T.surface2};--paper:${T.paper}}
 *{box-sizing:border-box;margin:0;font-family:-apple-system,"Segoe UI",Roboto,"Noto Sans KR",sans-serif}
 body{background:#2A2D33;display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px}
 h1{color:#E7E9EE;font-size:14px;font-weight:700}
 .phone{width:390px;height:844px;background:#fff;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.45);position:relative}
 .hd{display:flex;align-items:center;gap:4px;height:52px;padding:0 6px;border-bottom:1px solid var(--line)}
 .hd .t{flex:1;font-size:15px;font-weight:800;color:var(--ink);margin-left:4px}
 .ic{width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:20px}
 .done{height:36px;padding:0 14px;border-radius:12px;background:var(--accent);color:var(--ink);font-size:14px;font-weight:800;display:flex;align-items:center}
 .canvas{flex:1;min-height:0;background:var(--surface2);display:flex;align-items:center;justify-content:center}
 .square{aspect-ratio:1;height:100%;max-width:100%;background:#fff url(${CANVAS}) center/contain no-repeat}
 .cards{display:flex;gap:6px;padding:8px 12px 0}
 .card{flex:1;height:74px;border:1px solid var(--line);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;background:#fff}
 .card.on{background:var(--soft);border-color:var(--border)}
 .card img{width:72%;height:26px;object-fit:contain}
 .card span{font-size:12px;font-weight:700;color:var(--ink)}
 .row{display:flex;align-items:center;gap:10px;padding:8px 12px}
 .dot{width:28px;height:28px;border-radius:14px;background:#54A9E8;border:1px solid var(--strong)}
 .lbl{font-size:13px;font-weight:700;color:var(--muted)}
 .track{flex:1;height:6px;border-radius:3px;background:var(--surface2);position:relative}
 .track i{position:absolute;inset:0 50% 0 0;background:var(--accent);border-radius:3px}
 .track b{position:absolute;left:50%;top:-7px;width:20px;height:20px;border-radius:10px;background:#fff;border:1px solid var(--strong);transform:translateX(-50%)}
 .num{font-size:13px;font-weight:800;color:var(--ink);width:24px;text-align:right}
 .tools{display:flex;border-top:1px solid var(--line)}
 .tool{flex:1;height:64px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:var(--muted);font-size:12px;font-weight:600}
 .tool.on{color:var(--ink);font-weight:800}
 .tool .p{width:56px;height:34px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px}
 .tool.on .p{background:var(--soft)}
 .sheet{border-top:1px solid var(--line);background:#fff;padding:8px 12px 10px}
 .sheet h2{font-size:15px;font-weight:800;color:var(--ink);display:flex;align-items:center;height:40px}
 .sheet h2 span{flex:1}
 .ref{border-bottom:1px solid var(--line);background:#fff}
 .ref .top{display:flex;align-items:center;gap:6px;height:44px;padding:0 4px 0 12px}
 .ref .top b{flex:1;font-size:13px;font-weight:800;color:var(--ink)}
 .ref .body{display:flex;gap:10px;padding:0 12px 10px}
 .ref .body img{width:84px;height:84px;object-fit:contain;background:var(--surface2);border-radius:12px}
 .ref .body div{flex:1;display:flex;flex-direction:column;gap:6px}
 .ref .body p{font-size:13px;color:var(--muted)}
 .ref .body button{height:40px;border:0;border-radius:12px;background:var(--surface2);font-size:13px;font-weight:700;color:var(--ink)}
 .sw{display:flex;flex-wrap:wrap;gap:10px}
 .sw i{width:34px;height:34px;border-radius:10px;border:1px solid #17171718}
 .sv{height:130px;border-radius:12px;background:linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,#54A9E8)}
 .hue{width:22px;height:130px;border-radius:11px;background:linear-gradient(to bottom,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)}
 .note{color:#9BA2AE;font-size:12px;max-width:520px;text-align:center;line-height:1.6}
 .tag{position:absolute;top:0;left:0;right:0;height:22px;background:#B42318;color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;letter-spacing:.3px}
 .phone>.pad{height:22px;flex:none}
</style>`;

const header = (title, right) => `<div class="hd"><i class="mdi mdi-chevron-left ic"></i><div class="t">${title}</div>${right}</div>`;
const cmd = `<i class="mdi mdi-undo-variant ic"></i><i class="mdi mdi-redo-variant ic" style="color:${T.faint}"></i><div class="done">완료</div>`;
const cards = on => `<div class="cards">${[['pen', '펜'], ['brush', '붓'], ['pencil', '연필']].map(([k, n]) =>
  `<div class="card${on === k ? ' on' : ''}"><img src="${STROKE(k)}"><span>${n}</span></div>`).join('')}</div>`;
const widthRow = `<div class="row"><div class="dot"></div><div class="lbl">굵기</div><div class="track"><i></i><b></b></div><div class="num">12</div></div>`;
const toolBar = on => `<div class="tools">${[['pen', '펜', 'fountain-pen-tip'], ['eraser', '지우개', 'eraser'], ['fill', '채우기', 'format-color-fill'], ['select', '선택', 'select-drag']].map(([k, n, i]) =>
  `<div class="tool${on === k ? ' on' : ''}"><div class="p"><i class="mdi mdi-${i}"></i></div>${n}</div>`).join('')}</div>`;
const refArea = `<div class="ref"><div class="top"><i class="mdi mdi-lightbulb-on-outline" style="color:${T.muted};font-size:15px"></i><b>고마워 · 정중하게</b><i class="mdi mdi-chevron-up ic"></i><i class="mdi mdi-close ic"></i></div>
  <div class="body"><img src="${ART}"><div><p>두 손 모으고 깊게 꾸벅</p><button>밑그림으로 넣기</button></div></div></div>`;

const page = (id, title, body, note) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${title}</title>${head}</head>
<body><h1>C · 수정 목표 시안 — ${title} · 390dp</h1>
<div class="phone"><div class="tag">C — 수정 목표 시안 · 제품 화면 아님 · 승인 시안 아님 (기준 ${COMMIT})</div><div class="pad"></div>${body}</div>
<p class="note">${note}</p></body></html>`;

const screens = {
  'draw-base': ['기본 그리기', header('그리기', cmd) + `<div class="canvas"><div class="square"></div></div>` + cards('pen') + widthRow + toolBar('pen'),
    '승인 보드 01 배치: 머리줄에 되돌리기·다시 실행·완료 · 캔버스 아래 펜 3종 상시 노출 · 그 아래 색과 굵기 한 줄 · 맨 아래 네 도구. 완료 버튼은 시안의 파랑 대신 LOCKED 의 노랑을 쓴다.'],
  'draw-brush': ['펜/브러시 선택', header('그리기', cmd) + `<div class="canvas"><div class="square"></div></div>` + cards('brush') +
    `<div class="sheet"><h2><span>브러시 세부 설정</span><i class="mdi mdi-close ic"></i></h2>
      <div class="row" style="padding:4px 0"><div class="lbl" style="width:56px">진하기</div><div class="track"><i style="inset:0 20% 0 0"></i><b style="left:80%"></b></div><div class="num">100</div></div>
      <div class="row" style="padding:4px 0"><div class="lbl" style="width:56px">선 보정</div><div class="track"><i style="inset:0 70% 0 0"></i><b style="left:30%"></b></div><div class="num">약</div></div>
      <div class="row" style="padding:6px 0 0"><i class="mdi mdi-brush-variant" style="color:${T.muted}"></i><div class="lbl" style="flex:1">고급 브러시</div><div class="lbl" style="color:${T.faint}">4종</div><i class="mdi mdi-chevron-right" style="color:${T.faint}"></i></div></div>` + toolBar('pen'),
    '3종은 이미 캔버스 아래에 있으므로 카드를 누르면 바로 바뀌고 아무 판도 열리지 않는다. 열리는 것은 세부 설정뿐이고, 굵기는 여기 없다(위 한 줄에 있다).'],
  'draw-color': ['색 선택', header('그리기', cmd) + `<div class="canvas"><div class="square"></div></div>` +
    `<div class="sheet"><h2><span>색</span><i class="mdi mdi-close ic"></i></h2>
      <div class="row" style="padding:0 0 8px"><div class="lbl">최근</div><div class="sw" style="flex:1">${['#54A9E8', '#E94F4F', '#FFD15C'].map(c => `<i style="background:${c}"></i>`).join('')}</div>
        <div style="display:flex;flex-direction:column;align-items:center;color:${T.muted};font-size:9px"><i class="mdi mdi-eyedropper-variant" style="font-size:18px;color:${T.ink}"></i>색 추출</div>
        <div style="display:flex;flex-direction:column;align-items:center;color:${T.muted};font-size:9px"><i class="mdi mdi-palette-swatch-outline" style="font-size:18px;color:${T.ink}"></i>색 저장</div></div>
      <div style="display:flex;gap:10px"><div class="sv" style="flex:1"></div><div class="hue"></div></div>
      <div class="row" style="padding:8px 0 0"><div class="dot"></div><div class="lbl" style="flex:1">#54A9E8</div></div></div>` + toolBar('pen'),
    '승인 보드 01 의 색 시트 배치(프리셋 한 줄 · SV 사각 + 색상 막대 · 현재 색 값)로 되돌린다. 지금 쓰는 색상환은 이 자리에 SV 사각과 막대로 바뀐다 — 결정 필요 항목이다.'],
  'draw-reference': ['참고를 보면서 그리기', header('그리기', cmd) + refArea + `<div class="canvas"><div class="square"></div></div>` + cards('pen') + widthRow + toolBar('pen'),
    '승인 보드 02 는 참고를 캔버스 위 떠 있는 창으로 그렸지만, 최신 요구는 "작업 중인 그림을 가리지 않아야 한다"이다. 충돌을 캔버스 **밖** 전용 영역으로 푼다(접기·펼치기·닫기). 접으면 머리줄 한 줄만 남는다.'],
};
fs.mkdirSync(OUT, { recursive: true });
const made = [];
for (const [id, [title, body, note]] of Object.entries(screens)) {
  fs.writeFileSync(path.join(OUT, id + '.html'), page(id, title, body, note));
  made.push({ id, title, file: id + '.html' });
}
fs.writeFileSync(path.join(OUT, 'screens.json'), JSON.stringify(made, null, 2));
console.log('  C 수정 목표 시안 ' + made.length + '장 → ' + OUT);
