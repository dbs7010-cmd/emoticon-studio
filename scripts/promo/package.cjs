// 홍보 그림 2차 묶음: 스토어 그림(초안) · 엔진 출력 GIF · 홍보 세트 백업 · 안내를 한 폴더로 모은다.
// 엔진 출력(가공 없음)과 홍보용 재구성 그림을 폴더·파일 이름·보기 화면에서 나눠 둔다.
// 사용: node scripts/promo/package.cjs <나갈 폴더>
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const out = path.resolve(process.argv[2]);
const commit = execSync('git rev-parse --short HEAD', { cwd: root, encoding: 'utf8' }).trim();
const dirs = { store: path.join(out, '1_스토어그림_재구성'), gif: path.join(out, '2_엔진출력_GIF_가공없음'), backup: path.join(out, '3_홍보세트_백업') };
Object.values(dirs).forEach(d => fs.mkdirSync(d, { recursive: true }));
const fin = (src, dest, w, h, max) => execFileSync('node', [path.join(root, 'scripts/store-finalize.cjs'), src, dest, String(w), String(h), String(max)], { stdio: 'inherit' });
const S = path.join(root, 'verification/promo/store-v2');
fin(path.join(S, 'feature-graphic-1024x500.png'), path.join(dirs.store, 'feature-graphic-1024x500.png'), 1024, 500, 1024 * 1024);
for (const n of [1, 2, 3, 4]) fin(path.join(S, `phone-0${n}-DRAFT.png`), path.join(dirs.store, `phone-0${n}-DRAFT.png`), 1080, 1920, 8 * 1024 * 1024);
const M = path.join(root, 'assets/promo/motion');
const GIFS = [['bounce-excited.gif', '통통(bounce) · 무료 · 몽이 신나', '세기 0.7 · 속도 0.5 · 제자리 위아래(dx 0, 최고점 dy −17.6/360)'],
  ['shake-pouty.gif', '흔들기(shake) · 무료 · 몽이 삐짐', '세기 0.7 · 속도 0.5 · 좌우 ±8.8/360'],
  ['part-wave-hello.gif', '부분 움직임 · PRO · 몽이 안녕', '손 레이어만 회전 ±30°(축 250,222) · 몸 레이어 그대로']];
for (const [f] of GIFS) fs.copyFileSync(path.join(M, f), path.join(dirs.gif, f));
fs.copyFileSync(path.join(M, 'engine-motion.json'), path.join(dirs.gif, 'engine-motion.json'));
const B = path.join(root, 'verification/promo/backup');
for (const f of ['emoti-promo-backup-mongi-day.zip', 'backup-check.json']) fs.copyFileSync(path.join(B, f), path.join(dirs.backup, f));

// 보기 화면: 파일 하나에 그림을 모두 넣는다(어디서 열어도 GIF 가 움직인다).
const data = (p, type) => `data:${type};base64,${fs.readFileSync(p).toString('base64')}`;
const card = (src, title, note) => `<figure><img src="${src}" alt="${title}"><figcaption><b>${title}</b><br><small>${note}</small></figcaption></figure>`;
const viewer = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>emoti 홍보 그림 2차</title>
<style>body{margin:0;padding:20px 16px 40px;background:#FBF8EC;color:#2A2320;font-family:'Malgun Gothic',-apple-system,sans-serif}
h1{font-size:20px;margin:0 0 6px}h2{font-size:16px;margin:28px 0 6px}p{font-size:13px;color:#5A5040;margin:0 0 10px;line-height:1.6}
.g{display:flex;flex-wrap:wrap;gap:14px}figure{margin:0;background:#fff;border:1px solid #E6E1D3;border-radius:14px;padding:10px;max-width:100%}
figure img{display:block;max-width:100%;height:auto}figcaption{font-size:13px;margin-top:8px;line-height:1.5}small{color:#6B655E}
.eng figure img{width:240px;height:240px;background:repeating-conic-gradient(#EEE 0 25%,#fff 0 50%) 0 0/20px 20px}
.ph figure img{width:270px}.tag{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:6px;margin-left:6px}
.t1{background:#2A2320;color:#fff}.t2{background:#D2574F;color:#fff}</style></head><body>
<h1>emoti 이모티 · 홍보 그림 2차 (${commit})</h1>
<p>세트 예시: <b>몽이의 하루</b>(몽이 12표현). 실기기 캡처는 아직 없다 — 휴대전화 그림의 앱 화면은 <b>대체 렌더(초안)</b>다.</p>
<h2>A. 앱 엔진 출력 GIF<span class="tag t1">가공 없음</span></h2>
<p>앱의 실제 움직임 엔진(src/painter/canvas-html.ts)이 만든 파일 그대로. 360×360 · 0.8초 · 10프레임.</p>
<div class="g eng">${GIFS.map(([f, t, n]) => card(data(path.join(M, f), 'image/gif'), t, n)).join('')}</div>
<h2>B. 홍보용 재구성 그림<span class="tag t2">재구성 · 초안</span></h2>
<p>캐릭터 벡터 원본에 엔진이 계산한 움직임 값(위치·크기·회전)을 그대로 적용해 한 장에 겹친 것. 엔진 출력 그 자체가 아니다.</p>
<div class="g">${card(data(path.join(dirs.store, 'feature-graphic-1024x500.png'), 'image/png'), '그래픽 이미지 1024×500', '통통 — 같은 세로축: 눌린 잔상(t0) + 뜬 순간(t0.25) + 바닥 그림자')}</div>
<div class="g ph" style="margin-top:14px">${[1, 2, 3, 4].map(n => card(data(path.join(dirs.store, `phone-0${n}-DRAFT.png`), 'image/png'), `휴대전화 ${'①②③④'[n - 1]} (DRAFT)`, ['통통 적용 · 세기/속도 화면', '그리기 · 응원', '부분만 움직이기 · 손 회전 · PRO', '보드 · 12개 완성 / 32칸'][n - 1])).join('')}</div>
</body></html>`;
fs.writeFileSync(path.join(out, '보기.html'), viewer);
console.log(out);
