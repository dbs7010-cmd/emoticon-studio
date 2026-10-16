// 대표 캐릭터 '콘'(옥수수, 2026-10-16 확정 — 디자인 캔버스 K5: A 얼굴형 + A2 새싹·반짝 눈·고양이 입 + 노란 손).
// 원본은 이 파일의 SVG 조각이다. 실행하면 assets/mascot/ 에 SVG 와 512px PNG 를 쓴다(투명 바탕).
// 손 흔들기는 몸(+왼손)과 오른팔을 따로 굽는다 — PRO 비교 '부분 움직임'에서 팔 레이어만 움직이기 위해서다(scripts/pro-clips.cjs).
// 실행: PLAYWRIGHT_MODULE_PATH=playwright-core CHROME_PATH=<chrome.exe> node scripts/mascot-render.cjs
const fs = require('node:fs');
const path = require('node:path');

const INK = '#191F28', CORN = '#FFE14D', PIP = '#F5CB1A', LEAF = '#8ACF72', LEAF2 = '#B9E29F', BLUSH = '#FFA3B5', MOUTH = '#FF8A9E';
const sw = 'stroke="' + INK + '" stroke-width="2.4"';
const sprout = `<path d="M48 15 Q40 1 29 3 Q35 13 48 16 Z" fill="${LEAF}" ${sw} stroke-linejoin="round"/><path d="M48 15 Q57 -1 68 1 Q61 13 48 16 Z" fill="${LEAF2}" ${sw} stroke-linejoin="round"/>`;
const body = `<rect x="30" y="14" width="36" height="68" rx="18" fill="${CORN}" ${sw}/><g fill="${PIP}"><rect x="37" y="21" width="6" height="5" rx="2.5"/><rect x="45" y="19" width="6" height="5" rx="2.5"/><rect x="53" y="21" width="6" height="5" rx="2.5"/><rect x="41" y="28" width="6" height="5" rx="2.5"/><rect x="49" y="28" width="6" height="5" rx="2.5"/></g>`;
const blush = `<ellipse cx="35" cy="52" rx="3.6" ry="2.2" fill="${BLUSH}"/><ellipse cx="61" cy="52" rx="3.6" ry="2.2" fill="${BLUSH}"/>`;
const skirt = `<path d="M48 90 Q33 90 27 73 Q40 75 47 84 Z" fill="${LEAF}" ${sw} stroke-linejoin="round"/><path d="M48 90 Q63 90 69 73 Q56 75 49 84 Z" fill="${LEAF}" ${sw} stroke-linejoin="round"/>`;
const hand = (x, y) => `<circle cx="${x}" cy="${y}" r="4.4" fill="${CORN}" ${sw}/>`;
const line = d => `<path d="${d}" fill="none" ${sw} stroke-linecap="round"/>`;
const faces = {
  smile: `<ellipse cx="41" cy="45" rx="3.4" ry="4.4" fill="${INK}"/><circle cx="42.4" cy="43" r="1.4" fill="#fff"/><ellipse cx="55" cy="45" rx="3.4" ry="4.4" fill="${INK}"/><circle cx="56.4" cy="43" r="1.4" fill="#fff"/><path d="M43 53 q2.5 3 5 0 q2.5 3 5 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  happy: `<path d="M37 45 q4-5 8 0 M51 45 q4-5 8 0" fill="none" ${sw} stroke-linecap="round"/><path d="M44 51 q4 6 8 0 Z" fill="${MOUTH}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`,
  calm: `<path d="M37 45 q4 4 8 0 M51 45 q4 4 8 0" fill="none" ${sw} stroke-linecap="round"/><path d="M45 52 q3 3 6 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  cheer: `<path d="M37 45 q4-5 8 0 M51 45 q4-5 8 0" fill="none" ${sw} stroke-linecap="round"/><path d="M42 51 q6 8 12 0 Z" fill="${MOUTH}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>`,
  // 강좌용 표정(2026-10-16): 슬픔 · 화남 · 수줍음 · 아니
  sad: `<path d="M37 43 q4 4 8 1 M51 44 q4 3 8-1" fill="none" ${sw} stroke-linecap="round"/><path d="M44 55 q4-4 8 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/><path d="M38 49 q-2 4 0 6 q2-2 0-6 Z" fill="#A9D2FF" stroke="${INK}" stroke-width="1.6"/>`,
  angry: `<path d="M36 39 l9 4 M60 39 l-9 4" fill="none" ${sw} stroke-linecap="round"/><circle cx="41" cy="46" r="2.6" fill="${INK}"/><circle cx="55" cy="46" r="2.6" fill="${INK}"/><path d="M43 55 l2.5-2 2.5 2 2.5-2 2.5 2" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  shy: `<path d="M37 45 q4-5 8 0 M51 45 q4-5 8 0" fill="none" ${sw} stroke-linecap="round"/><path d="M46 53 q2 2 4 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  flat: `<ellipse cx="41" cy="45" rx="3.2" ry="4" fill="${INK}"/><ellipse cx="55" cy="45" rx="3.2" ry="4" fill="${INK}"/><path d="M44 54 h8" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
};
const armL = line('M30 52 Q23 56 21 63') + hand(20, 66);
const armR = line('M66 52 Q73 56 75 63') + hand(76, 66);
const armWave = line('M65 52 Q73 46 76 37') + hand(77, 33);
const svg = inner => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 104 104" width="512" height="512">${inner}</svg>`;

const POSES = {
  // 기본: 홈·빈 칸·움직임 견본
  base: svg(sprout + armL + armR + body + faces.smile + blush + skirt),
  // 안녕: 홈 첫 화면(어서 와요)
  wave: svg(sprout + armL + armWave + body + faces.happy + blush + skirt),
  // 꾸벅: 두 손 모으기
  bow: svg(sprout + body + faces.calm + blush + line('M31 60 Q38 66 44 66 M65 60 Q58 66 52 66') + hand(45, 66) + hand(51, 66) + skirt),
  // 신나: 내보내기 완료 · PRO 시작
  cheer: svg(sprout + line('M31 48 Q23 42 20 32 M65 48 Q73 42 76 32') + hand(19, 28) + hand(77, 28) + body + faces.cheer + blush + skirt),
  // 강좌용 동작(2026-10-16)
  sad: svg(sprout + body + faces.sad + line('M30 54 Q25 62 25 70 M66 54 Q71 62 71 70') + hand(25, 72) + hand(71, 72) + skirt),
  angry: svg(sprout + armL + armR + body + faces.angry + `<path d="M74 14 l4 -4 M78 20 l6 -2 M70 10 l0 -6" fill="none" stroke="#E5484D" stroke-width="2.6" stroke-linecap="round"/>` + skirt),
  shy: svg(sprout + body + faces.shy + `<ellipse cx="35" cy="52" rx="5" ry="3" fill="${BLUSH}"/><ellipse cx="61" cy="52" rx="5" ry="3" fill="${BLUSH}"/>` + line('M30 60 Q30 56 31 52 M66 60 Q66 56 65 52') + hand(32, 50) + hand(64, 50) + skirt),
  no: svg(sprout + body + faces.flat + blush + line('M30 54 Q40 64 52 68 M66 54 Q56 64 44 68') + hand(52, 68) + hand(44, 68) + skirt),
  nod: svg(`<g transform="rotate(-12 48 88)">` + sprout + armL + armR + body + faces.happy + blush + `</g>` + `<path d="M14 30 q-4 8 0 16 M8 26 q-6 12 0 24" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>` + skirt),
  heart: svg(`<path d="M48 -1 c-6-8-18-2-12 8 l12 10 12-10 c6-10-6-16-12-8 Z" fill="#FF8A9E" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>` + line('M31 46 Q24 30 34 14 M65 46 Q72 30 62 14') + hand(35, 12) + hand(61, 12) + body + faces.happy + blush + skirt),
  sorry: svg(`<g transform="rotate(10 48 88)">` + sprout + body + faces.sad + blush + line('M31 60 Q38 66 44 66 M65 60 Q58 66 52 66') + hand(45, 66) + hand(51, 66) + `</g>` + skirt),
  // 손 흔들기를 레이어 둘로: 몸(+왼손) / 오른팔(어깨에서 손끝까지)
  'wave-body': svg(sprout + armL + body + faces.happy + blush + skirt),
  'wave-arm': svg(armWave),
};
module.exports = { POSES };

if (require.main === module) (async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
  const out = path.join(__dirname, '..', 'assets', 'mascot');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
  try {
    const page = await browser.newPage();
    for (const [name, text] of Object.entries(POSES)) {
      fs.writeFileSync(path.join(out, `corn-${name}.svg`), text);
      const png = await page.evaluate(async src => {
        const i = new Image(); i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src); await i.decode();
        const c = document.createElement('canvas'); c.width = c.height = 512; c.getContext('2d').drawImage(i, 0, 0, 512, 512);
        return c.toDataURL('image/png');
      }, text);
      const bytes = Buffer.from(png.split(',')[1], 'base64');
      fs.writeFileSync(path.join(out, `corn-${name}.png`), bytes);
      console.log(name, (bytes.length / 1024).toFixed(0) + 'KB');
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
