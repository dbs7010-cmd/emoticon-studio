// 대체 렌더: 누를 수 있는 것마다 **보이는 크기**와 **실제 손가락 자리**를 나눠 잰다.
// 손가락 자리 = 상자 크기 + hitSlop. 명세 §2 는 48dp 를 요구한다.
// 크기를 적지 않은 상자(내용에 따라 늘어나는 것)는 '내용 크기'로 두고 따로 센다 — 여기서 못 박을 수 없다.
const fs = require('node:fs');
const { walk } = require('./_harness.cjs');

const slop = s => typeof s === 'number' ? { top: s, bottom: s, left: s, right: s } : { top: 0, bottom: 0, left: 0, right: 0, ...(s ?? {}) };
const found = new Map();   // 이름 → 가장 작은 기록 하나

(async () => {
  await walk(390, async (id, title, tree, flat) => {
    for (const node of tree.root.findAll(n => (n.type === 'Pressable' || n.type === 'View') && typeof n.props.onPress === 'function')) {
      const st = flat(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);
      const hs = slop(node.props.hitSlop);
      const box = {
        w: st.width ?? st.minWidth ?? null,
        h: st.height ?? st.minHeight ?? null,
      };
      // 안쪽 여백도 손가락 자리에 들어간다 — 크기를 적지 않은 상자는 내용 + 여백만큼 커진다.
      const padY = (st.paddingVertical ?? st.padding ?? 0) * 2 + (st.paddingTop ?? 0) + (st.paddingBottom ?? 0);
      const padX = (st.paddingHorizontal ?? st.padding ?? 0) * 2 + (st.paddingLeft ?? 0) + (st.paddingRight ?? 0);
      const tapW = box.w === null ? null : box.w + hs.left + hs.right;
      const tapH = box.h === null ? null : box.h + hs.top + hs.bottom;
      const name = node.props.accessibilityLabel ?? node.props.testID ?? '(이름 없음)';
      // 크기를 적지 않은 것은 무엇이 크기를 정하는지 적어 둔다 — '모름'으로 남기지 않는다.
      const grows = [st.flex ? 'flex:' + st.flex : null, st.aspectRatio ? '비율 ' + st.aspectRatio : null,
        st.position === 'absolute' ? '화면 전체 덮개' : null, padY >= 20 ? '여백 ' + padY : null].filter(Boolean).join(' · ') || null;
      const row = { name, screen: id, boxW: box.w, boxH: box.h, padX, padY, grows, hitSlop: hs.top || hs.left ? hs : null, tapW, tapH };
      const worst = Math.min(tapW ?? 999, tapH ?? 999);
      const old = found.get(name);
      if (!old || worst < Math.min(old.tapW ?? 999, old.tapH ?? 999)) found.set(name, row);
    }
  });

  const rows = [...found.values()];
  const small = rows.filter(r => (r.tapW !== null && r.tapW < 48) || (r.tapH !== null && r.tapH < 48));
  const unknown = rows.filter(r => r.tapW === null && r.tapH === null);
  const ok = rows.length - small.length - unknown.length;

  console.log('  누를 수 있는 것 ' + rows.length + '가지 · 손가락 자리 48dp 이상 ' + ok + ' · 미달 ' + small.length + ' · 크기를 적지 않고 늘어나는 것 ' + unknown.length);
  for (const r of unknown) console.log('    늘어남: ' + r.name.padEnd(22) + (r.grows ?? '?') + '   (' + r.screen + ')');
  if (small.length) {
    console.log('\n  이름                                 보이는 크기   hitSlop   손가락 자리   화면');
    for (const r of small.sort((a, b) => Math.min(a.tapW ?? 999, a.tapH ?? 999) - Math.min(b.tapW ?? 999, b.tapH ?? 999))) {
      const box = `${r.boxW ?? '-'}×${r.boxH ?? '-'}`;
      const hs = r.hitSlop ? `${r.hitSlop.top}/${r.hitSlop.left}` : '없음';
      console.log('  ' + r.name.padEnd(34) + box.padEnd(12) + hs.padEnd(10) + `${r.tapW ?? '-'}×${r.tapH ?? '-'}`.padEnd(13) + r.screen);
    }
  }
  fs.mkdirSync('verification/round45_23', { recursive: true });
  fs.writeFileSync('verification/round45_23/touch-targets.json', JSON.stringify({ total: rows.length, ok, small: small.length, unknown: unknown.length, rows: rows.sort((a, b) => a.name.localeCompare(b.name, 'ko')) }, null, 2));
  process.exit(small.length ? 2 : 0);
})().catch(e => { console.error(e); process.exit(1); });
