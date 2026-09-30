// 45.42 S3 — 공통 상태 부품(EmptyState 새 모양 · SaveToast · CompleteCard · ProBadge · useMicro · 선택/비활성 규칙).
// 부품 단위 검사다. react-native 와 Animated 는 검사 대역이라 애니메이션은 곧바로 끝 값이 되고, react-native-svg 는 검사 로더의 목이다.
// 여기서 보는 것은 '무엇을 어떤 색·접근성으로 그리는가'까지 — 실제 움직임과 SVG 렌더링은 APK 에서 본다.
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { loader } = require('./load-ts.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal', 'ActivityIndicator'].map(n => [n, n]));
rn.Animated = require('./_rn-animated-mock.cjs');
Object.assign(rn, { StyleSheet: { create: x => x }, Platform: { OS: 'android' } });
// 애니메이션이 네이티브 구동으로 돌아가는지 본다(JS 구동이면 느린 폰에서 끊긴다).
const timings = [];
const timing = rn.Animated.timing;
rn.Animated = { ...rn.Animated, timing: (v, cfg) => { timings.push(cfg); return timing(v, cfg); } };
const load = loader({
  'react-native': rn, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  '../services/storage': { imageUri: p => p },
});
const U = load('src/components/ui.tsx');
const { T, S, Motion } = U;
const flat = st => Object.assign({}, ...[typeof st === 'function' ? st({ pressed: false }) : st].flat(9).filter(Boolean));
const texts = tree => tree.root.findAll(n => n.type === 'Text').map(n => [n.props.children].flat(9).filter(x => typeof x === 'string' || typeof x === 'number').join(''));
const icons = tree => tree.root.findAll(n => n.type === 'Svg').map(n => n.props.testID);
const render = async el => { let t; await act(async () => { t = create(el); }); return t; };

(async () => {
  // ── 선택 · 비활성 규칙 ──
  assert.deepEqual(U.selectedFace(true), { backgroundColor: T.accent, borderColor: T.edge }, '도구 선택 = 노란 면 + 잉크 가장자리');
  assert.equal(U.selectedFace(true, 'list').backgroundColor, T.accentSoft, '목록 선택 = 옅은 노랑 면');
  assert.equal(U.selectedFace(false).backgroundColor, 'transparent');
  assert.equal(U.inkFor(true), T.faint); assert.equal(U.inkFor(false), T.ink);

  // ── EmptyState 새 모양: 제목·설명·노란 행동 하나·흐름 아이콘 ──
  let pressed = 0;
  let t = await render(React.createElement(U.EmptyState, { title: '첫 이모티콘을 만들어 볼까요?', body: '한 칸씩 그려 32칸 세트를 채워요.', actionLabel: '새 세트 만들기', onAction: () => pressed++, flow: true, testID: '빈 홈' }));
  assert.deepEqual(texts(t).slice(0, 2), ['첫 이모티콘을 만들어 볼까요?', '한 칸씩 그려 32칸 세트를 채워요.']);
  const cta = t.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === '새 세트 만들기');
  assert.equal(cta.length, 1, '행동은 하나'); await act(async () => cta[0].props.onPress()); assert.equal(pressed, 1);
  assert.equal(flat(cta[0].props.style).backgroundColor, T.accent, '행동은 노란 주요 버튼');
  assert.deepEqual(t.root.findAll(n => n.type === 'View' && n.props.testID === '흐름 아이콘')[0].findAll(n => n.type === 'Svg').map(n => n.props.testID).filter(x => x !== 'icon-next'), ['icon-brush', 'icon-motion', 'icon-export'], '흐름 아이콘: 그리기 › 움직이기 › 내보내기');
  assert.equal(t.root.findAll(n => n.props.testID === '흐름 아이콘' && n.props.accessibilityLabel).length, 1, '흐름은 한 문장으로 읽힌다');
  assert.equal(flat(t.root.findAll(n => n.type === 'View' && n.props.testID === '빈 홈')[0].props.style).backgroundColor, T.surface2, '가라앉은 면 위');
  // 예전 모양(참고 패널의 빈 목록)은 그대로 남는다 — S7 전까지 그리기 화면을 바꾸지 않는다.
  t = await render(React.createElement(U.EmptyState, { icon: 'image-outline', message: '참고 사진을 추가해 보세요.', action: null }));
  assert.ok(texts(t).includes('참고 사진을 추가해 보세요.')); assert.equal(t.root.findAll(n => n.type === 'Icon').length, 1);

  // ── SaveToast: 흰 알약 + 초록 체크 + 칸 번호 + 잉크 '다음 칸', 올라오며 나타남 ──
  timings.length = 0; let next = 0;
  t = await render(React.createElement(U.SaveToast, { slot: 7, onNext: () => next++ }));
  const toast = t.root.findAll(n => n.props.testID === '저장 알림')[0];
  assert.equal(toast.props.accessibilityLiveRegion, 'polite', '화면 읽기가 저장을 알린다'); assert.equal(toast.props.accessibilityLabel, '7번 칸 저장됨');
  const ts = flat(toast.props.style);
  assert.equal(ts.backgroundColor, T.paper, '흰 알약(경고창처럼 노랑·빨강 바탕이 아니다)'); assert.equal(ts.borderRadius, 999);
  assert.ok(![T.accent, T.danger, T.dangerSoft, T.warningSoft].includes(ts.backgroundColor));
  assert.ok(texts(t).includes('7번 칸 저장됨'));
  assert.ok(t.root.findAll(n => n.type === 'View' && flat(n.props.style).backgroundColor === T.success).length === 1, '초록은 체크 한 점에만');
  const nextBtn = t.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === '다음 칸')[0];
  assert.equal(flat(nextBtn.props.style).backgroundColor, T.ink, '다음 칸 = 잉크 버튼'); await act(async () => nextBtn.props.onPress()); assert.equal(next, 1);
  assert.ok(flat(nextBtn.props.style).minHeight + 2 * nextBtn.props.hitSlop >= T.tap, '누르는 자리 48 이상(보이는 크기 + 여유)');
  assert.ok(timings.length >= 2 && timings.every(c => c.useNativeDriver === true), '네이티브 구동');
  assert.ok(timings.every(c => c.duration === Motion.rise), '0.24초');
  assert.equal(ts.opacity.__getValue(), 1, '끝나면 완전히 보인다'); assert.equal(ts.transform[0].translateY.__getValue(), 0);
  t = await render(React.createElement(U.SaveToast, { slot: 3 }));
  assert.equal(t.root.findAll(n => n.type === 'Pressable').length, 0, '다음 칸이 없으면 버튼도 없다');

  // ── CompleteCard: 흰 카드 + 노란 체크 튀어 오름 + 'N칸 완성!' + 작품 + 노란 행동 하나 ──
  timings.length = 0; let go = 0;
  t = await render(React.createElement(U.CompleteCard, { total: 32, actionLabel: '파일 묶음 만들기', onAction: () => go++ }, React.createElement('View', { testID: '작품 격자' })));
  assert.ok(texts(t).includes('32칸 완성!'));
  assert.equal(flat(t.root.findAll(n => n.type === 'View' && n.props.testID === '완성 카드')[0].props.style).backgroundColor, T.paper, '흰 카드');
  const check = flat(t.root.findAll(n => n.props.testID === '완성 체크')[0].props.style);
  assert.equal(check.backgroundColor, T.accent); assert.equal(check.transform[0].scale.__getValue(), 1, '튀어 올라 제 크기');
  assert.ok(timings.some(c => c.duration === Motion.pop) && timings.every(c => c.useNativeDriver), '0.28초 · 네이티브 구동');
  assert.equal(t.root.findAll(n => n.props.testID === '작품 격자').length, 1, '작품 격자 자리');
  const done = t.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === '파일 묶음 만들기');
  assert.equal(done.length, 1); await act(async () => done[0].props.onPress()); assert.equal(go, 1);

  // ── ProBadge: 보라 없음 · 잉크 테두리 · 반짝 아이콘 · 누르는 자리 48 ──
  let opened = 0;
  t = await render(React.createElement(U.ProBadge, { onPress: () => opened++ }));
  const badge = t.root.findAll(n => n.type === 'Pressable')[0];
  assert.equal(badge.props.accessibilityLabel, 'PRO 이용'); assert.ok(flat(badge.props.style).minHeight >= T.tap && flat(badge.props.style).minWidth >= T.tap);
  const face = t.root.findAll(n => n.type === 'View' && flat(n.props.style).borderColor === T.edge)[0];
  assert.equal(flat(face.props.style).backgroundColor, T.paper, '흰 바탕 · 잉크 테두리'); assert.deepEqual(icons(t), ['icon-pro']);
  assert.ok(!JSON.stringify(t.toJSON()).toUpperCase().includes('#5B47E0'), '보라 없음');
  await act(async () => badge.props.onPress()); assert.equal(opened, 1);
  t = await render(React.createElement(U.ProBadge, {}));
  assert.equal(t.root.findAll(n => n.type === 'Pressable').length, 0, '누를 것이 없으면 버튼이 아니다');

  // ── 비활성 버튼: 실제 disabled 와 접근성 상태는 그대로 ──
  t = await render(React.createElement(U.Action, { title: '저장', onPress: () => { throw new Error('눌리면 안 된다'); }, disabled: true, primary: true }));
  const off = t.root.findAll(n => n.type === 'Pressable')[0];
  assert.equal(off.props.disabled, true); assert.equal(off.props.accessibilityState.disabled, true);
  assert.ok(Object.values(S).length >= 5);
  console.log('PASS: state ui — 선택(노란 면+잉크/옅은 노랑)·비활성(옅은 색, disabled·접근성 유지) 규칙, 빈 상태 새 모양(제목·설명·노란 행동 하나·흐름 아이콘, 예전 모양 유지), 저장 알림(흰 알약·초록 체크 한 점·잉크 다음 칸·0.24초 네이티브), 완성 카드(흰 카드·노란 체크 0.28초·행동 하나), PRO 배지(잉크 테두리·반짝 아이콘·48dp·보라 없음). Animated·SVG 는 검사 대역 — 실제 움직임과 그림은 APK 에서.');
})().catch(e => { console.error(e); process.exit(1); });
