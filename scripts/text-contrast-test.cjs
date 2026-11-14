// 45.42 보완 — 실제 화면의 글자 대비. 토큰끼리 견주는 것이 아니라, 그려진 글자마다 **실제로 깔린 바탕**(조상 상자의 바탕색,
// 반투명이면 아래 바탕과 섞음)과 **조상 투명도**를 반영해 WCAG 대비를 계산한다.
// · 일반 글자: 4.5:1 이상. 큰 글자(24 이상, 또는 18.66 이상 굵게): 3:1 이상.
// · 비활성 컨트롤(disabled · accessibilityState.disabled) 안의 글자는 WCAG 1.4.3 예외 — 따로 세어 보고만 한다.
// · 그림(Image) 위 글자처럼 바탕을 알 수 없는 곳은 '흰 바탕 위'로 가정한다(작품 칸 바탕이 흰색·투명이라서).
// 한계: 검사 대역으로 그린 트리다(글꼴 렌더·안티에일리어싱·실제 그림 위 픽셀은 보지 않는다). 기기 픽셀 대비는 실기기에서.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const H = require('./_harness.cjs');

const hex = c => {
  if (typeof c !== 'string') return null;
  const m = c.trim().match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (m) return { rgb: [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16)), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  if (/^#fff$/i.test(c.trim())) return { rgb: [255, 255, 255], a: 1 };
  const r = c.match(/^rgba?\(([^)]+)\)$/);
  if (r) { const v = r[1].split(',').map(Number); return { rgb: v.slice(0, 3), a: v[3] ?? 1 }; }
  if (c === 'transparent') return { rgb: [0, 0, 0], a: 0 };
  return null;
};
const mix = (top, a, under) => top.map((v, i) => v * a + under[i] * (1 - a));
const lum = rgb => { const v = rgb.map(x => x / 255).map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
const WHITE = [255, 255, 255];

function textOf(n) { return [n.props.children].flat(9).filter(x => typeof x === 'string' || typeof x === 'number').join('').trim(); }

(async () => {
  const fails = [], exempt = [], seen = { texts: 0, screens: 0 };
  for (const width of [360, 390]) {
    await H.walk(width, async (id, title, tree, flat) => {
      seen.screens++;
      const visit = (node, ctx) => {
        if (!node || typeof node !== 'object' || !node.props) return;
        let { bg, op, disabled, color, size, weight } = ctx;
        const host = typeof node.type === 'string';
        const st = host ? flat(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style) : {};
        if (host) {
          if (node.props.disabled === true || node.props.accessibilityState?.disabled === true) disabled = true;
          if (typeof st.opacity === 'number') op *= st.opacity;
          const b = hex(st.backgroundColor);
          if (b && b.a > 0) bg = mix(b.rgb, b.a, bg);
          if (node.type === 'Modal' && node.props.transparent) bg = bg;   // 모달 바탕은 안쪽 상자가 정한다
          if (node.type === 'Text') {
            if (st.color) color = st.color;
            if (st.fontSize) size = st.fontSize;
            if (st.fontWeight) weight = st.fontWeight;
            const own = (node.children ?? []).filter(c => typeof c === 'string' || typeof c === 'number').join('').trim();
            if (own) {
              seen.texts++;
              const fg = hex(color ?? '#000000');
              const shown = mix(mix(fg.rgb, fg.a, bg), op, bg);
              const r = ratio(shown, bg);
              const large = size >= 24 || (size >= 18.66 && Number(weight) >= 700);
              const need = large ? 3 : 4.5;
              if (r + 1e-9 < need) (disabled ? exempt : fails).push(`${width}dp ${id}: "${own.slice(0, 24)}" ${color} ${r.toFixed(2)}:1 (필요 ${need}, 글자 ${size}${op < 1 ? `, 투명도 ${op.toFixed(2)}` : ''})`);
            }
          }
        }
        for (const c of node.children ?? []) if (typeof c === 'object') visit(c, { bg, op, disabled, color, size, weight });
      };
      visit(tree.root, { bg: WHITE, op: 1, disabled: false, color: undefined, size: 14, weight: '400' });
    });
  }
  fs.mkdirSync('verification/_latest', { recursive: true });
  fs.writeFileSync('verification/_latest/text-contrast.txt', ['[미달]', ...fails, '', '[비활성 예외]', ...exempt].join('\n'));
  assert.equal(fails.length, 0, '일반 글자 대비 미달 ' + fails.length + '곳:\n' + fails.join('\n'));
  console.log(`PASS: text contrast — ${seen.screens}개 화면(360·390dp) 글자 ${seen.texts}개: 일반 4.5:1 · 큰 글자 3:1 이상(실제 조상 바탕·반투명 섞음·투명도 반영). 비활성 컨트롤 안 글자 ${exempt.length}곳은 WCAG 1.4.3 예외로 따로 셈. 검사 대역 트리 기준 — 기기 픽셀 대비는 실기기에서.`);
})().catch(e => { console.error(e.message ?? e); process.exit(1); });
