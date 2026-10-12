// 채팅에서 써 보기 · 이용 가이드북 · 홈 공지 슬라이드(2026-10-13). 부품을 직접 그려 본다.
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { loader } = require('./load-ts.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'Image', 'Modal', 'KeyboardAvoidingView'].map(n => [n, n]));
Object.assign(rn, { StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), Animated: require('./_rn-animated-mock.cjs') });
const load = loader({
  'react-native': rn, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' }, '@expo/ui': { Host: 'Host' },
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-file-system': { Directory: class {}, File: class {}, Paths: { document: 'document' } },
});
const { ChatSim } = load('src/components/chat-sim.tsx');
const { NoticeCarousel } = load('src/components/notice-carousel.tsx');
const { GUIDEBOOK } = load('src/constants/guidebook.ts');
const spec = load('src/constants/kakao-spec.ts');

let tree;
const texts = () => tree.root.findAll(n => n.type === 'Text').map(n => [n.props.children].flat(9).filter(x => typeof x === 'string').join(''));
const btn = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const stickersShown = () => tree.root.findAll(n => n.type === 'Image' && /번 이모티콘$/.test(n.props.accessibilityLabel ?? '')).length;

(async () => {
  // 1) 가이드북: 여섯 장 · 규격 장은 공식 가이드 값 그대로 · 팁 장은 공식 기준이라고 말하지 않는다
  assert.deepEqual(GUIDEBOOK.map(c => c.id), ['start', 'motion', 'finish', 'spec', 'tips', 'account']);
  const specCh = GUIDEBOOK.find(c => c.id === 'spec');
  assert.equal(specCh.source, spec.SPEC_SOURCE.guide, '규격 장은 공식 가이드 링크를 준다');
  const specText = specCh.items.map(i => i.body).join(' ');
  for (const v of ['360×360', '150KB', '650KB', '24프레임', '78×78', '600×166']) assert.ok(specText.includes(v), '규격 값 ' + v);
  const tips = GUIDEBOOK.find(c => c.id === 'tips');
  assert.ok(tips.items.some(i => /공식 가이드/.test(i.body)), '팁 장은 최종 기준이 공식 가이드라고 말한다');
  assert.ok(!tips.items.some(i => /심사 기준(입니다|이에요)|반드시 승인|승인 보장/.test(i.body)), '팁을 카카오 심사 기준으로 내세우지 않는다');
  for (const c of GUIDEBOOK) assert.ok(c.items.length && c.items.every(i => i.title && i.body), '빈 항목 없음 ' + c.id);

  // 2) 공지 슬라이드: 슬라이드마다 누를 수 있고, 여러 장이면 '1 / n'
  const pressed = [];
  const slide = (key, label) => ({ key, kicker: key, title: key + ' 제목', tone: '#fff', art: null, label, onPress: () => pressed.push(key) });
  await act(async () => { tree = create(React.createElement(NoticeCarousel, { guessWidth: 358, slides: [slide('book', '가이드북 열기'), slide('contest', '공모전 현황 보기')] })); });
  assert.ok(texts().includes('1 / 2'), '몇 번째인지 보인다');
  await act(async () => btn('공모전 현황 보기')[0].props.onPress());
  assert.deepEqual(pressed, ['contest']);
  const w = tree.root.findAll(n => n.type === 'Pressable')[0].props.style({ pressed: false }).width;
  assert.equal(w, 358, '슬라이드 한 장이 줄 폭을 꽉 채운다');
  await act(async () => { tree = create(React.createElement(NoticeCarousel, { guessWidth: 358, slides: [] })); });
  assert.equal(tree.toJSON(), null, '공지가 없으면 자리도 없다');

  // 3) 채팅에서 써 보기: 이모티콘은 고른 뒤 보내기로 들어간다 · 글 · 친구 · 처음부터 · 바탕 바꾸기
  const stickers = [{ number: 1, uri: 'file:///1.png' }, { number: 7, uri: 'file:///7.gif' }];
  let closed = 0;
  await act(async () => { tree = create(React.createElement(ChatSim, { visible: true, setName: '몽이의 하루', stickers, onClose: () => closed++ })); });
  assert.ok(texts().some(t => t.includes('아무에게도 보내지지 않아요')), '연습용이라고 말한다');
  assert.equal(btn('보내기')[0].props.disabled, true, '아무것도 없으면 보내기 꺼짐');
  await act(async () => btn('7번 이모티콘 고르기')[0].props.onPress());
  assert.equal(stickersShown(), 0, '고르기만 하면 아직 대화에 없다');
  await act(async () => btn('보내기')[0].props.onPress());
  assert.equal(stickersShown(), 1, '보내기를 누르면 대화에 들어간다');
  const input = tree.root.findAll(n => n.type === 'TextInput')[0];
  await act(async () => input.props.onChangeText('ㅋㅋ 이거 귀엽다'));
  await act(async () => btn('보내는 사람: 나')[0].props.onPress());
  await act(async () => btn('보내기')[0].props.onPress());
  assert.ok(texts().includes('ㅋㅋ 이거 귀엽다'));
  assert.ok(texts().filter(t => t === '친구').length >= 2, '친구가 보낸 말로 들어간다');
  await act(async () => btn('어두운 바탕')[0].props.onPress());
  assert.equal(btn('어두운 바탕')[0].props.accessibilityState.checked, true);
  await act(async () => btn('대화 처음부터')[0].props.onPress());
  assert.equal(stickersShown(), 0, '처음부터 누르면 대화가 비워진다');
  await act(async () => btn('닫기')[0].props.onPress()); assert.equal(closed, 1);
  await act(async () => { tree = create(React.createElement(ChatSim, { visible: true, setName: '빈 세트', stickers: [], onClose() {} })); });
  assert.ok(texts().some(t => t.includes('아직 그린 칸이 없어요')));

  console.log('PASS: chat sim + guidebook + notice slides — 가이드북 6장(공식 규격 값·링크, 팁은 공식 기준이라 하지 않음), 공지 슬라이드(꽉 찬 폭·n/전체·누르면 열기·없으면 자리 없음), 채팅(고른 뒤 보내기·나/친구·글·어두운 바탕·처음부터·빈 세트 안내)');
})().catch(e => { console.error(e); process.exit(1); });
