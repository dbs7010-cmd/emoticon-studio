// 45.42 S1 — 「임티 라인」 아이콘 부품 규칙.
// react-native-svg 는 검사 로더의 목(이름 붙은 빈 요소)으로 그려진다. 여기서 확인하는 것은 '어떤 요소를 어떤 속성으로 그리는가'이고,
// 실제 SVG 렌더링(잘림·가독성)은 scripts/_icon-sheet.cjs 가 브라우저에서, 최종으로는 APK 에서 본다.
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { loader } = require('./load-ts.cjs');
const load = loader({});
const I = load('src/design/icons.tsx');

(async () => {
  const names = Object.keys(I.ICON_PATHS);
  assert.equal(names.length, 23, '아이콘은 핵심 11 + 시스템 12: ' + names.length);
  for (const k of ['brush', 'eraser', 'fill', 'color', 'reference', 'layer', 'caption', 'motion', 'export', 'save', 'pro']) assert.ok(names.includes(k), '핵심 아이콘 ' + k);
  for (const k of ['back', 'next', 'close', 'plus', 'delete', 'eye', 'eyeOff', 'undo', 'redo', 'more', 'check', 'settings']) assert.ok(names.includes(k), '시스템 아이콘 ' + k);
  assert.deepEqual(Object.values(I.IconSize), [22, 18, 14], '크기는 도구 22 · 목록 18 · 보조 14 세 가지뿐');
  for (const name of names) for (const size of [14, 18, 22]) {
    let tree; await act(async () => { tree = create(React.createElement(I.ImtiIcon, { name, size })); });
    const svg = tree.root.findByType('Svg');
    assert.equal(svg.props.width, size); assert.equal(svg.props.height, size); assert.equal(svg.props.viewBox, '0 0 24 24', name + ': 24 격자');
    const marks = tree.root.findAll(n => ['SvgPath', 'SvgCircle', 'SvgRect'].includes(n.type));
    assert.ok(marks.length > 0, name + ': 그릴 선이 있다');
    for (const m of marks) {
      assert.equal(m.props.strokeWidth, I.ICON_STROKE, name + ': 선 1.8');
      assert.equal(m.props.fill, 'none', name + ': 채움 없음(선 아이콘)');
      assert.equal(m.props.strokeLinecap, 'round'); assert.equal(m.props.strokeLinejoin, 'round');
      assert.equal(m.props.stroke, I.ICON_INK, name + ': 기본 색은 잉크');
    }
    // 글자와 함께 쓰는 기본 아이콘은 화면 읽기에서 숨는다.
    assert.equal(svg.props.accessible, false); assert.equal(svg.props.importantForAccessibility, 'no-hide-descendants');
    tree.unmount();
  }
  // 비활성: 선 색만 옅게. 이름을 주면 이미지로 읽힌다.
  let t; await act(async () => { t = create(React.createElement(I.ImtiIcon, { name: 'brush', disabled: true, accessibilityLabel: '펜' })); });
  assert.ok(t.root.findAll(n => n.type === 'SvgPath').every(p => p.props.stroke === I.ICON_FAINT), '비활성은 옅은 선');
  assert.equal(t.root.findByType('Svg').props.accessibilityLabel, '펜'); assert.equal(t.root.findByType('Svg').props.accessible, true);
  assert.equal(t.root.findAll(n => n.props && n.props.opacity !== undefined).length, 0, '투명도로 흐리지 않는다');
  console.log(`PASS: icons — 「임티 라인」 ${names.length}종 × 14/18/22 모두 24 격자·선 1.8·둥근 끝·채움 없음·잉크 색, 비활성은 옅은 선(투명도 아님), 기본은 화면 읽기에서 숨고 이름을 주면 이미지로 읽힘. SVG 는 검사 로더의 목 — 실제 렌더링은 _icon-sheet(브라우저)·APK 에서 확인.`);
})().catch(e => { console.error(e); process.exit(1); });
