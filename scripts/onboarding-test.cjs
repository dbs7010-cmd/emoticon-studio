// 첫 실행 한 장 · 작가명 정하기(2026-10-08). 화면 부품을 직접 그려 본다 — 서버는 가짜(실제 규칙은 server/firebase 에뮬레이터 검사).
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { loader } = require('./load-ts.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'Image', 'Modal'].map(n => [n, n]));
Object.assign(rn, { StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), Animated: require('./_rn-animated-mock.cjs') });
const load = loader({
  'react-native': rn, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' }, '@expo/ui': { Host: 'Host' },
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-file-system': { Directory: class {}, File: class {}, Paths: { document: 'document' } },
});
const { StartScreen, ArtistNameScreen } = load('src/components/onboarding.tsx');
const { artistNameFormat } = load('src/services/cloud/account.ts');

let tree;
const texts = () => tree.root.findAll(n => n.type === 'Text').map(n => [n.props.children].flat(9).filter(x => typeof x === 'string').join(''));
const btn = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  // 1) 서버 없는 빌드: '시작하기' 하나
  let started = 0;
  await act(async () => { tree = create(React.createElement(StartScreen, { providers: null, onLogin() {}, onStart: () => started++ })); });
  assert.ok(texts().some(t => t.includes('움직이는 이모티콘')), '제목이 움직이는 이모티콘을 앞세운다');
  assert.ok(texts().includes('내 그림에 움직임을 고르기만 하면 돼요.'));
  assert.ok(!texts().some(t => /내보내기/.test(t)), '첫 화면은 내보내기를 앞세우지 않는다');
  assert.equal(btn('카카오로 시작하기').length, 0);
  await act(async () => btn('시작하기')[0].props.onPress()); assert.equal(started, 1);

  // 2) 서버 있는 빌드: 세 회사 버튼 · 설정 안 된 회사는 잠김 · 약관 안내
  const calls = [];
  await act(async () => { tree = create(React.createElement(StartScreen, { providers: { kakao: true, naver: false, google: true }, onLogin: p => calls.push(p), onStart() {} })); });
  assert.equal(btn('시작하기').length, 0, '서버가 있으면 로그인 없이 시작할 수 없다');
  assert.equal(btn('네이버로 시작하기 · 준비 중')[0].props.disabled, true);
  await act(async () => btn('카카오로 시작하기')[0].props.onPress());
  await act(async () => btn('Google로 시작하기')[0].props.onPress());
  assert.deepEqual(calls, ['kakao', 'google']);
  assert.ok(texts().some(t => t.includes('이용약관과 개인정보처리방침')));
  await act(async () => { tree.update(React.createElement(StartScreen, { providers: { kakao: true, naver: true, google: true }, onLogin() {}, onStart() {}, error: '로그인을 확인하지 못했어요.' })); });
  assert.ok(texts().includes('로그인을 확인하지 못했어요.'), '실패 이유를 말한다');

  // 3) 작가명: 형식 → 서버 확인(금지어·중복) → 완료
  const taken = new Set(['몽이작가']); const saved = [];
  const check = async name => taken.has(name) ? { ok: false, reason: '이미 쓰는 작가명이에요.' } : /운영자/.test(name) ? { ok: false, reason: '쓸 수 없는 단어가 들어 있어요.' } : { ok: true };
  await act(async () => { tree = create(React.createElement(ArtistNameScreen, { check, formatError: artistNameFormat, save: async n => { saved.push(n); } })); });
  assert.ok(texts().includes('작가명을 입력해주세요'));
  assert.ok(texts().some(t => t.includes('바꿀 수 없어요')), '바꿀 수 없다고 미리 말한다');
  const input = () => tree.root.findAll(n => n.type === 'TextInput')[0];
  const type = async v => { await act(async () => input().props.onChangeText(v)); await act(async () => { await wait(450); }); };
  const status = () => tree.root.findAll(n => n.props.testID === '작가명 확인' && n.type === 'Text').map(n => [n.props.children].flat().join(''))[0];
  const done = () => btn('완료')[0].props.disabled;
  await type('a'); assert.match(status(), /2~12자/); assert.equal(done(), true);
  await type('몽이!'); assert.match(status(), /2~12자/);
  await type('몽이 작가'); assert.equal(input().props.value, '몽이작가', '띄어쓰기는 넣을 수 없다');
  assert.equal(status(), '이미 쓰는 작가명이에요.'); assert.equal(done(), true);
  await type('운영자몽이'); assert.equal(status(), '쓸 수 없는 단어가 들어 있어요.');
  await type('새벽작가'); assert.equal(status(), '쓸 수 있는 작가명이에요'); assert.equal(done(), false);
  await act(async () => { await btn('완료')[0].props.onPress(); });
  assert.deepEqual(saved, ['새벽작가']);
  // 저장 중 서버가 거절하면(그 사이 누가 가져감) 이유를 보여 준다
  await act(async () => { tree = create(React.createElement(ArtistNameScreen, { check: async () => ({ ok: true }), formatError: artistNameFormat, save: async () => { throw new Error('이미 쓰는 작가명이에요.'); } })); });
  await type('늦은작가'); await act(async () => { await btn('완료')[0].props.onPress(); });
  assert.equal(status(), '이미 쓰는 작가명이에요.');
  console.log('PASS: onboarding — 첫 실행 한 장(움직이는 이모티콘 강조, 서버 없으면 시작하기 하나, 서버 있으면 카카오·네이버·구글 버튼만·설정 안 된 회사 잠김·실패 이유), 작가명(형식 2~12자·띄어쓰기 막음·서버 금지어/중복 이유·바꿀 수 없음 안내·확인돼야 완료·저장 거절 이유). 서버는 가짜 — 실제 규칙은 server/firebase 에뮬레이터, 실제 로그인은 운영 키 설정 뒤 실기기.');
})().catch(e => { console.error(e); process.exit(1); });
