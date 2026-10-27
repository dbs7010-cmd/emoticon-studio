// 홍보용 오리지널 캐릭터(2026-10-03 · emoti 이모티 스토어 그림용). 앱 사용자 작품이 아니라 운영자 쪽에서 만든 예시다.
// 주인공 '몽이'(동그란 모찌 고양이) 12 표현 + 보조 캐릭터 2종('삐약' 병아리 · '두부' 곰).
// 모든 그림은 360×360(앱 캔버스와 같은 크기) SVG. 자세(팔 각도 · 몸 기울기 · 뜀) · 눈 · 입 · 소품으로 표현이 갈린다 —
// 같은 그림에 글자만 바꾼 칸은 없다. 부분 움직임 예시(안녕)는 흔드는 팔을 따로 뗀 레이어로도 낸다.
const INK = '#2A2320', CHEEK = '#FFB4A2', PINK = '#FF6F91', SKY = '#8EC5FF', LEMON = '#F5E642';
const SW = 7;   // 외곽선 굵기

const SPECIES = {
  mongi: { name: '몽이', fill: '#FFFFFF', inner: '#FFC9C0', ears: 'cat' },
  piyak: { name: '삐약', fill: '#FFC75A', inner: '#FF9F43', ears: 'tuft', beak: true },
  dubu: { name: '두부', fill: '#D9A77A', inner: '#B98157', ears: 'round', snout: true },
};

// 눈
const eyes = (type) => {
  const L = 146, R = 214, Y = 196;
  const dot = (x, r = 9) => `<circle cx="${x}" cy="${Y}" r="${r}" fill="${INK}"/><circle cx="${x - 3}" cy="${Y - 3}" r="${r / 3}" fill="#fff"/>`;
  const arc = (x, up) => `<path d="M${x - 11} ${Y + (up ? 3 : -3)} Q${x} ${Y + (up ? -11 : 9)} ${x + 11} ${Y + (up ? 3 : -3)}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  switch (type) {
    case 'happy': return arc(L, true) + arc(R, true);
    case 'closed': return arc(L, false) + arc(R, false);
    case 'wink': return dot(L) + arc(R, true);
    case 'wide': return [L, R].map(x => `<circle cx="${x}" cy="${Y}" r="15" fill="#fff" stroke="${INK}" stroke-width="5"/><circle cx="${x}" cy="${Y + 1}" r="6.5" fill="${INK}"/>`).join('');
    case 'teary': return [L, R].map(x => `<circle cx="${x}" cy="${Y}" r="12" fill="${INK}"/><circle cx="${x - 4}" cy="${Y - 4}" r="4.5" fill="#fff"/><circle cx="${x + 4}" cy="${Y + 4}" r="2" fill="#fff"/>`).join('');
    case 'sleepy': return [L, R].map(x => `<path d="M${x - 11} ${Y + 2} Q${x} ${Y + 7} ${x + 11} ${Y + 2}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M${x - 12} ${Y - 4} L${x + 12} ${Y - 4}" stroke="${INK}" stroke-width="4" stroke-linecap="round" opacity=".55"/>`).join('');
    case 'sorry': return `<path d="M${L - 10} ${Y - 9} L${L + 9} ${Y} L${L - 10} ${Y + 9}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M${R + 10} ${Y - 9} L${R - 9} ${Y} L${R + 10} ${Y + 9}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'determined': return dot(L, 9) + dot(R, 9) + `<path d="M${L - 13} ${Y - 20} L${L + 9} ${Y - 13}M${R + 13} ${Y - 20} L${R - 9} ${Y - 13}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
    case 'side': return [L, R].map(x => `<circle cx="${x + 5}" cy="${Y + 1}" r="8" fill="${INK}"/>`).join('') + `<path d="M${L - 12} ${Y - 18} L${L + 10} ${Y - 12}M${R + 12} ${Y - 18} L${R - 10} ${Y - 12}" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>`;
    default: return dot(L) + dot(R);
  }
};
// 입
const mouth = (type, sp) => {
  const X = 180, Y = 222;
  if (sp.beak) return type === 'open' || type === 'yawn' || type === 'o'
    ? `<path d="M${X - 15} ${Y - 6} L${X + 15} ${Y - 6} L${X} ${Y + 12} Z" fill="#FF8A3D" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M${X - 12} ${Y + 2} L${X + 12} ${Y + 2}" stroke="${INK}" stroke-width="4"/>`
    : `<path d="M${X - 14} ${Y - 6} L${X + 14} ${Y - 6} L${X} ${Y + 8} Z" fill="#FF8A3D" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
  const snout = sp.snout ? `<ellipse cx="${X}" cy="${Y - 4}" rx="24" ry="17" fill="#F3D9BE" stroke="${INK}" stroke-width="5"/><ellipse cx="${X}" cy="${Y - 11}" rx="7" ry="5" fill="${INK}"/>` : '';
  const m = {
    smile: `<path d="M${X - 13} ${Y} Q${X} ${Y + 13} ${X + 13} ${Y}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`,
    cat: `<path d="M${X - 14} ${Y} q7 9 14 0 q7 9 14 0" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    open: `<path d="M${X - 16} ${Y - 3} Q${X} ${Y + 26} ${X + 16} ${Y - 3} Z" fill="${INK}"/><path d="M${X - 8} ${Y + 11} Q${X} ${Y + 4} ${X + 8} ${Y + 11} Q${X} ${Y + 17} ${X - 8} ${Y + 11}" fill="${PINK}"/>`,
    o: `<ellipse cx="${X}" cy="${Y + 4}" rx="8" ry="11" fill="${INK}"/>`,
    yawn: `<ellipse cx="${X}" cy="${Y + 6}" rx="13" ry="16" fill="${INK}"/><ellipse cx="${X}" cy="${Y + 14}" rx="7" ry="5" fill="${PINK}"/>`,
    wavy: `<path d="M${X - 16} ${Y + 6} q5.3 -7 10.6 0 t10.6 0 t10.6 0" fill="none" stroke="${INK}" stroke-width="5.5" stroke-linecap="round"/>`,
    frown: `<path d="M${X - 12} ${Y + 10} Q${X} ${Y} ${X + 12} ${Y + 10}" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`,
    pout: `<path d="M${X - 6} ${Y + 2} q6 -6 12 0 q-6 6 -12 0" fill="${INK}"/>`,
  }[type] || '';
  return snout + (sp.snout ? `<g transform="translate(0 8)">${m}</g>` : m);
};
// 귀
const ears = (sp) => {
  if (sp.ears === 'cat') return `<path d="M112 168 C104 110 120 92 156 126 Z" fill="${sp.fill}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/><path d="M122 150 C118 120 126 112 144 128 Z" fill="${sp.inner}"/>
    <path d="M248 168 C256 110 240 92 204 126 Z" fill="${sp.fill}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/><path d="M238 150 C242 120 234 112 216 128 Z" fill="${sp.inner}"/>`;
  if (sp.ears === 'round') return [128, 232].map(x => `<circle cx="${x}" cy="128" r="26" fill="${sp.fill}" stroke="${INK}" stroke-width="${SW}"/><circle cx="${x}" cy="130" r="13" fill="${sp.inner}"/>`).join('');
  return `<path d="M176 120 C168 96 186 92 182 112 C194 94 204 104 188 124" fill="${sp.fill}" stroke="${INK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
};
// 팔: 어깨에서 시작하는 둥근 막대. a = 각도(0 = 아래, 왼팔은 + 로 바깥·위, 오른팔은 - 로 바깥·위)
const SH = { L: [110, 222], R: [250, 222] };
const arm = (side, a, sp, len = 52, hand = '') => {
  const [x, y] = SH[side];
  return `<g transform="translate(${x} ${y}) rotate(${a})"><rect x="-15" y="-8" width="30" height="${len + 8}" rx="15" fill="${sp.fill}" stroke="${INK}" stroke-width="${SW - 1}"/>${hand}</g>`;
};
const thumb = (sp) => `<circle cx="0" cy="44" r="16" fill="${sp.fill}" stroke="${INK}" stroke-width="6"/><rect x="-6" y="56" width="12" height="20" rx="6" fill="${sp.fill}" stroke="${INK}" stroke-width="5"/>`;

const extras = {
  sparkle: (x, y, s = 1, c = LEMON) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 -16 L4 -4 L16 0 L4 4 L0 16 L-4 4 L-16 0 L-4 -4 Z" fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  heart: (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s}) rotate(-12)" d="M0 10 C-22 -6 -12 -24 0 -12 C12 -24 22 -6 0 10 Z" fill="${PINK}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`,
  sweat: (x, y) => `<path d="M${x} ${y} q10 16 0 22 q-10 -6 0 -22 Z" fill="${SKY}" stroke="${INK}" stroke-width="3.5"/>`,
  tear: (x, y) => `<path d="M${x} ${y} q8 14 0 20 q-8 -6 0 -20 Z" fill="${SKY}" stroke="${INK}" stroke-width="3"/>`,
  zz: (x, y) => `<text x="${x}" y="${y}" font-family="Arial Rounded MT Bold,Arial" font-weight="900" font-size="34" fill="${INK}">Z</text><text x="${x + 26}" y="${y - 22}" font-family="Arial" font-weight="900" font-size="22" fill="${INK}">z</text>`,
  shout: (x, y) => `<path d="M${x} ${y} l-8 -22 M${x + 22} ${y - 6} l0 -24 M${x + 44} ${y} l8 -22" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`,
  waveLines: (x, y) => `<path d="M${x} ${y} q8 -10 0 -20 M${x + 12} ${y + 4} q10 -14 0 -28" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
  vein: (x, y) => `<g transform="translate(${x} ${y})" stroke="#E5484D" stroke-width="5" stroke-linecap="round" fill="none"><path d="M-12 -4 q6 0 6 -8 M4 -12 q0 6 8 6 M12 4 q-6 0 -6 8 M-4 12 q0 -6 -8 -6"/></g>`,
  confetti: () => [[70, 90, PINK, 20], [292, 82, SKY, -30], [300, 150, LEMON, 15], [58, 160, LEMON, -20], [250, 56, PINK, 40], [100, 52, SKY, 10]]
    .map(([x, y, c, r]) => `<rect x="${x}" y="${y}" width="16" height="9" rx="2" fill="${c}" stroke="${INK}" stroke-width="2.5" transform="rotate(${r} ${x} ${y})"/>`).join(''),
  popper: () => `<g transform="translate(72 118) rotate(-28)"><path d="M0 0 L22 60 L-22 60 Z" fill="${LEMON}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M-10 30 L12 30M-15 45 L16 45" stroke="${PINK}" stroke-width="5"/></g>`,
  flag: () => `<g transform="translate(280 70)"><rect x="-3" y="0" width="7" height="104" rx="3" fill="${INK}"/><path d="M4 4 L66 18 L4 40 Z" fill="${LEMON}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/></g>`,
  moon: () => `<path d="M300 70 a30 30 0 1 0 22 46 a24 24 0 1 1 -22 -46 Z" fill="${LEMON}" stroke="${INK}" stroke-width="4"/>` + `<path transform="translate(62 80) scale(.7)" d="M0 -16 L4 -4 L16 0 L4 4 L0 16 L-4 4 L-16 0 L-4 -4 Z" fill="#fff" stroke="${INK}" stroke-width="3"/>`,
  nightcap: (sp) => `<path d="M128 140 Q176 40 252 92 Q236 120 232 146 Z" fill="${SKY}" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><circle cx="254" cy="90" r="13" fill="#fff" stroke="${INK}" stroke-width="5"/>`,
  pillow: () => `<rect x="118" y="232" width="124" height="56" rx="26" fill="#fff" stroke="${INK}" stroke-width="6"/><path d="M140 250 q40 10 80 0" fill="none" stroke="${INK}" stroke-width="3" opacity=".4"/>`,
};

// 표현 12종 — 자세·눈·입·소품이 칸마다 다르다
const POSES = {
  hello:     { label: '안녕',  eyes: 'happy', mouth: 'open', L: 18, R: -150, fx: s => extras.waveLines(306, 112) },
  excited:   { label: '신나',  eyes: 'happy', mouth: 'open', L: 150, R: -150, dy: -22, feetApart: 1, fx: () => extras.sparkle(60, 120, 1.1) + extras.sparkle(300, 110, .9) + extras.sparkle(286, 270, .7) },
  thanks:    { label: '고마워', eyes: 'closed', mouth: 'smile', L: -38, R: 38, tilt: 0, bow: 10, fx: () => extras.heart(282, 112, 1.3) },
  sorry:     { label: '미안해', eyes: 'sorry', mouth: 'wavy', L: 12, R: -168, tilt: -8, fx: () => extras.sweat(270, 132) },
  good:      { label: '좋아',  eyes: 'wink', mouth: 'cat', L: 14, R: -118, thumbR: 1, fx: () => extras.sparkle(300, 110, .9) },
  congrats:  { label: '축하해', eyes: 'happy', mouth: 'open', L: 140, R: -24, fx: s => extras.popper() + extras.confetti() },
  sleepy:    { label: '졸려',  eyes: 'sleepy', mouth: 'yawn', L: 8, R: -8, tilt: 7, fx: () => extras.zz(264, 120) },
  teary:     { label: '울먹',  eyes: 'teary', mouth: 'frown', L: -24, R: 24, tilt: 0, fx: () => extras.tear(140, 214) + extras.tear(222, 214) },
  surprised: { label: '놀람',  eyes: 'wide', mouth: 'o', L: 118, R: -118, dy: -6, fx: () => extras.shout(150, 92) },
  cheer:     { label: '응원',  eyes: 'determined', mouth: 'open', L: 44, R: -170, fx: () => extras.flag() + extras.sparkle(66, 150, .8) },
  pouty:     { label: '삐짐',  eyes: 'side', mouth: 'pout', L: -58, R: 58, crossed: 1, tilt: -6, fx: () => extras.vein(248, 128) },
  goodnight: { label: '잘 자', eyes: 'closed', mouth: 'smile', L: -46, R: 46, hugPillow: 1, cap: 1, fx: () => extras.moon() },
};
const ORDER = ['hello', 'excited', 'thanks', 'sorry', 'good', 'congrats', 'sleepy', 'teary', 'surprised', 'cheer', 'pouty', 'goodnight'];

// 한 표현의 SVG 조각. part: 'all' | 'body'(흔드는 오른팔 빼고) | 'armR'(오른팔만)
function drawPose(key, speciesKey = 'mongi', part = 'all') {
  const p = POSES[key], sp = SPECIES[speciesKey];
  const feetDx = p.feetApart ? 10 : 0;
  const bodyCore = `
    ${ears(sp)}
    <ellipse cx="${148 - feetDx}" cy="286" rx="25" ry="15" fill="${sp.fill}" stroke="${INK}" stroke-width="${SW - 1}"/>
    <ellipse cx="${212 + feetDx}" cy="286" rx="25" ry="15" fill="${sp.fill}" stroke="${INK}" stroke-width="${SW - 1}"/>
    <path d="M86 214 C86 146 128 124 180 124 C232 124 274 146 274 214 C274 266 236 290 180 290 C124 290 86 266 86 214 Z" fill="${sp.fill}" stroke="${INK}" stroke-width="${SW}"/>
    ${sp.ears === 'tuft' ? '' : ''}
    <g transform="translate(0 ${p.bow || 0})">
      <ellipse cx="124" cy="222" rx="13" ry="8" fill="${CHEEK}" opacity=".9"/><ellipse cx="236" cy="222" rx="13" ry="8" fill="${CHEEK}" opacity=".9"/>
      ${eyes(p.eyes)}${mouth(p.mouth, sp)}
    </g>
    ${p.cap ? extras.nightcap(sp) : ''}
    ${p.hugPillow ? extras.pillow() : ''}`;
  const armL = arm('L', p.L, sp);
  const armR = arm('R', p.R, sp, 52, p.thumbR ? thumb(sp) : '');
  // 팔짱: 두 팔이 몸 앞에서 겹친다(왼팔이 위)
  const arms = p.crossed ? `${arm('R', 70, sp, 62)}${arm('L', -70, sp, 62)}` : `${armL}${armR}`;
  const tf = `translate(0 ${p.dy || 0}) rotate(${p.tilt || 0} 180 210)`;
  if (part === 'armR') return `<g transform="${tf}">${armR}</g>`;
  if (part === 'body') return `<g transform="${tf}">${bodyCore}${armL}</g>${p.fx ? p.fx(sp) : ''}`;
  return `<g transform="${tf}">${bodyCore}${arms}</g>${p.fx ? p.fx(sp) : ''}`;
}
const svg = (inner, size = 360) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 360 360">${inner}</svg>`;

module.exports = { POSES, ORDER, SPECIES, drawPose, svg, INK, LEMON, SHOULDER_R: SH.R };
