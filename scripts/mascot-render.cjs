// 대표 캐릭터 '콘'(옥수수) — 2026-10-26 v2 디자인(HQ/Codex 시안 kon-v2-character-sheet · kon-friends-v2, docs/design/mascot-v2-src/).
//   통통한 달걀형 몸 · 잎사귀 옷(앞에서 겹침) · 새싹 잎 두 장 · 둥근 갈색 선 · 작은 손발 · 복숭아 볼.
//   이전(2026-10-16 K5: 긴 몸 + 검은 선)은 git 이력에 있다. 파일 이름·동작 이름은 그대로라 앱 자리·강좌·PRO GIF 가 같이 바뀐다.
// 원본은 이 파일의 SVG 조각이다. 실행하면 assets/mascot/ 에 SVG 와 512px PNG 를 쓴다(투명 바탕).
// 손 흔들기는 몸(+왼손)과 오른손을 따로 굽는다 — PRO 비교 '부분 움직임'에서 손 레이어만 움직이기 위해서다(scripts/pro-clips.cjs).
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/mascot-render.cjs
const fs = require('node:fs');
const path = require('node:path');

const INK = '#5B3A22', CORN = '#FFE07A', PIP = '#F8C843', LEAF = '#93C46E', VEIN = '#6E9F4E', BLUSH = '#F7A98E', MOUTH = '#F27D6B';
const sw = `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"`;
const thin = c => `fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round"`;
const EGG = 'M48 17 C66 17 77 35 77 57 C77 76 65 87 48 87 C31 87 19 76 19 57 C19 35 30 17 48 17 Z';
// 새싹: 왼쪽 큰 잎 + 오른쪽 작은 잎(몸 뒤)
const sprout = `<path d="M47 19 C42 6 31 2 24 4 C27 14 36 20 47 20 Z" fill="${LEAF}" ${sw}/><path d="M45 18 C39 12 33 9 29 7" ${thin(VEIN)}/><path d="M50 19 C54 10 62 8 69 10 C66 17 58 21 50 20 Z" fill="${LEAF}" ${sw}/>`;
const feet = `<ellipse cx="37" cy="88" rx="6.5" ry="4" fill="${CORN}" ${sw}/><ellipse cx="59" cy="88" rx="6.5" ry="4" fill="${CORN}" ${sw}/>`;
// 몸: 노란 달걀 + 알갱이 + 잎사귀 옷(몸 모양으로 잘라 앞에서 겹침) + 바깥선은 맨 위에 다시
const coat = `<path d="M17 56 C30 55 45 62 54 92 L10 92 Z" fill="${LEAF}" ${sw}/><path d="M24 66 C32 67 40 74 44 84" ${thin(VEIN)}/><path d="M79 56 C66 55 51 62 42 92 L86 92 Z" fill="${LEAF}" ${sw}/><path d="M72 66 C64 67 56 74 52 84" ${thin(VEIN)}/>`;
const body = `<defs><clipPath id="egg"><path d="${EGG}"/></clipPath></defs><path d="${EGG}" fill="${CORN}"/><g fill="${PIP}"><circle cx="43" cy="27" r="3.6"/><circle cx="53" cy="25" r="3.2"/><circle cx="57" cy="33" r="3.4"/><circle cx="47" cy="34" r="2.6"/></g><g clip-path="url(#egg)">${coat}</g><path d="${EGG}" fill="none" ${sw}/>`;
const blush = (y = 55) => `<ellipse cx="32" cy="${y}" rx="5" ry="3" fill="${BLUSH}" opacity=".85"/><ellipse cx="64" cy="${y}" rx="5" ry="3" fill="${BLUSH}" opacity=".85"/>`;
const hand = (x, y, r = 0, c = CORN) => `<ellipse cx="${x}" cy="${y}" rx="5.2" ry="6.2" transform="rotate(${r} ${x} ${y})" fill="${c}" ${sw}/>`;
const ticks = (x, y, s = 1) => `<path d="M${x} ${y} l${-3 * s} -5 M${x + 6 * s} ${y - 3} l${-1 * s} -6 M${x - 5 * s} ${y + 6} l${-6 * s} -2" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`;
const eyes = (y = 47) => `<ellipse cx="39" cy="${y}" rx="2.8" ry="3.5" fill="${INK}"/><ellipse cx="57" cy="${y}" rx="2.8" ry="3.5" fill="${INK}"/>`;
const arc = (y = 47, up = true) => `<path d="M35 ${y + 1} q4 ${up ? -5 : 4} 8 0 M53 ${y + 1} q4 ${up ? -5 : 4} 8 0" fill="none" ${sw}/>`;
const face = (dy = 0) => ({
  smile: eyes(47 + dy) + `<path d="M44 ${53 + dy} q4 4 8 0" fill="none" ${sw}/>`,
  happy: arc(47 + dy) + `<path d="M44 ${52 + dy} q4 6 8 0 Z" fill="${MOUTH}" ${sw}/>`,
  calm: arc(47 + dy, false) + `<path d="M45 ${54 + dy} q3 3 6 0" fill="none" ${sw}/>`,
  cheer: arc(47 + dy) + `<path d="M42 ${51 + dy} q6 9 12 0 Z" fill="${MOUTH}" ${sw}/>`,
  sad: `<path d="M35 46 q4 4 8 2 M53 48 q4 2 8 -2" fill="none" ${sw}/><path d="M44 57 q4 -4 8 0" fill="none" ${sw}/><path d="M36 51 q-2 4 0 6 q2 -2 0 -6 Z" fill="#A9D2FF" stroke="${INK}" stroke-width="1.6"/>`,
  angry: `<path d="M34 41 l9 4 M62 41 l-9 4" fill="none" ${sw}/>` + eyes(48) + `<path d="M43 56 l2.5 -2 2.5 2 2.5 -2 2.5 2" fill="none" ${sw}/>`,
  shy: arc(47) + `<path d="M46 54 q2 2 4 0" fill="none" ${sw}/>`,
  flat: eyes(47) + `<path d="M44 55 h8" fill="none" ${sw}/>`,
});
const faces = face();
const handsDown = hand(19, 64, 20) + hand(77, 64, -20);
const waveHand = hand(78, 44, -25) + ticks(84, 34);
const svg = inner => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 104 104" width="512" height="512">${inner}</svg>`;
const kon = (f, front = '') => sprout + feet + body + faces[f] + blush() + front;

const POSES = {
  // 기본: 홈·빈 칸·움직임 견본
  base: svg(kon('smile', handsDown)),
  // 안녕: 홈 첫 화면(어서 와요)
  wave: svg(kon('happy', hand(19, 64, 20) + waveHand)),
  // 꾸벅: 두 손 모으기
  bow: svg(kon('calm', hand(44, 66, 10) + hand(52, 66, -10))),
  // 신나: 내보내기 완료 · PRO 시작
  cheer: svg(kon('cheer', hand(16, 40, 25) + hand(80, 40, -25) + ticks(10, 30, -1) + ticks(86, 30))),
  // 강좌용 동작(2026-10-16)
  sad: svg(kon('sad', hand(22, 70, 10) + hand(74, 70, -10))),
  angry: svg(kon('angry', handsDown + `<path d="M76 12 l4 -4 M80 18 l6 -2 M72 8 l0 -6" fill="none" stroke="#E5484D" stroke-width="2.6" stroke-linecap="round"/>`)),
  shy: svg(kon('shy', `<ellipse cx="32" cy="55" rx="6.5" ry="3.8" fill="${BLUSH}"/><ellipse cx="64" cy="55" rx="6.5" ry="3.8" fill="${BLUSH}"/>` + hand(42, 60, 15) + hand(54, 60, -15))),
  no: svg(kon('flat', hand(43, 64, 40) + hand(53, 64, -40))),
  nod: svg(`<g transform="rotate(-12 48 88)">` + kon('happy', handsDown) + `</g><path d="M12 30 q-4 8 0 16 M6 26 q-6 12 0 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`),
  heart: svg(`<path d="M48 -2 c-6 -8 -18 -2 -12 8 l12 10 12 -10 c6 -10 -6 -16 -12 -8 Z" fill="#FF8A9E" ${sw}/>` + kon('happy', hand(22, 34, 30) + hand(74, 34, -30))),
  sorry: svg(`<g transform="rotate(10 48 88)">` + kon('sad', hand(44, 66, 10) + hand(52, 66, -10)) + `</g>`),
  // 손 흔들기를 레이어 둘로: 몸(+왼손) / 오른손(흔드는 손 + 반짝 선)
  'wave-body': svg(kon('happy', hand(19, 64, 20))),
  'wave-arm': svg(waveHand),
};
// 콘의 친구(2026-10-16 확정 A: 고구마 + 완두콩) — 2026-10-26 v2 시안 모양으로 다시 그림. 같은 갈색 선·눈·볼·손.
// B 감자 + 토마토는 docs/design/mascot-b/ 에 예전 그림으로 저장만 되어 있다(앱 묶음에 들어가지 않음).
const FBODY = {
  // 고구마: 위가 좁은 자주색 몸 + 머리 위 노란 단면 + 결 무늬, 분홍 발
  goguma: { hand: '#A8649A', feet: '#D99AB5',
    body: `<path d="M50 16 C64 18 76 40 76 60 C76 78 64 87 48 87 C32 87 20 78 20 60 C20 38 36 15 50 16 Z" fill="#A8649A" ${sw}/><path d="M42 21 C46 15 56 14 59 19 C56 25 46 26 42 21 Z" fill="#F2CC5B" ${sw}/><path d="M27 48 q3 -1 5 1 M66 42 q3 0 4 2 M65 72 q3 0 4 -2 M29 72 q2 1 4 0 M47 79 q3 1 5 0" fill="none" stroke="#7E4574" stroke-width="1.8" stroke-linecap="round"/>` },
  // 완두콩: 초록 꼬투리 몸 + 앞에 콩 두 알 + 줄기 덩굴과 잎
  kong: { hand: '#F5D35A', feet: '#F5D35A',
    body: `<path d="M50 22 q-2 -9 4 -12 q5 -2 6 3" fill="none" ${sw}/><path d="M53 16 C58 8 68 8 72 12 C68 19 60 21 53 18 Z" fill="${LEAF}" ${sw}/><path d="M48 19 C67 19 78 36 78 57 C78 77 64 87 48 87 C32 87 18 77 18 57 C18 36 29 19 48 19 Z" fill="#A9CF6B" ${sw}/><path d="M25 40 C34 29 62 29 71 40" fill="none" stroke="${VEIN}" stroke-width="1.8" stroke-linecap="round"/><circle cx="41" cy="73" r="9" fill="#C2E08A" ${sw}/><circle cx="56" cy="73" r="9" fill="#C2E08A" ${sw}/>` },
};
const ffeet = c => `<ellipse cx="37" cy="88" rx="6.5" ry="4" fill="${c}" ${sw}/><ellipse cx="59" cy="88" rx="6.5" ry="4" fill="${c}" ${sw}/>`;
const fhands = (c, pose) => pose === 'cheer' ? hand(16, 42, 25, c) + hand(80, 42, -25, c) + ticks(10, 32, -1) + ticks(86, 32)
  : pose === 'wave' ? hand(19, 64, 20, c) + hand(80, 42, -25, c) + ticks(86, 32) : hand(19, 64, 20, c) + hand(77, 64, -20, c);
const ff = face(2);
for (const [name, f] of Object.entries(FBODY)) for (const pose of ['base', 'wave', 'cheer'])
  POSES[`${name}-${pose}`] = svg(ffeet(f.feet) + f.body + (pose === 'base' ? ff.smile : ff.happy) + blush(57) + fhands(f.hand, pose));
module.exports = { POSES };

if (require.main === module) (async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
  const out = path.join(__dirname, '..', 'assets', 'mascot');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage();
    const saved = path.join(__dirname, '..', 'docs', 'design', 'mascot-b');
    fs.mkdirSync(saved, { recursive: true });
    for (const [name, text] of Object.entries(POSES)) {
      const friend = /^(goguma|kong|gamja|tomato)-/.test(name), dir = /^(gamja|tomato)-/.test(name) ? saved : out, file = friend ? name : `corn-${name}`;
      fs.writeFileSync(path.join(dir, `${file}.svg`), text);
      const png = await page.evaluate(async src => {
        const i = new Image(); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); await i.decode();
        const c = document.createElement('canvas'); c.width = c.height = 512; c.getContext('2d').drawImage(i, 0, 0, 512, 512);
        return c.toDataURL('image/png');
      }, text);
      const bytes = Buffer.from(png.split(',')[1], 'base64');
      fs.writeFileSync(path.join(dir, `${file}.png`), bytes);
      console.log(name, (bytes.length / 1024).toFixed(0) + 'KB');
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
