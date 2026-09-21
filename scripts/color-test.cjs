// 색·브러시 화면 검사 — 38차부터 색(스포이드·내 팔레트·RGB·투명도)과 진하기·선 보정은 무료다. PRO 는 고급 브러시 네 가지뿐이고,
// 무료 사용자에게는 브러시 시트에 '고급 브러시 PRO' 한 줄로만 보인다. 실제 동작(값이 캔버스·저장소로 가는가)을 본다.
// 네이티브 모듈과 WebView 는 흉내다. 캔버스 엔진 쪽은 color-engine-test, Android 화면은 실기기 검수가 맡는다.
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { loader } = require('./load-ts.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const files = new Map();
class Directory { constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); } create() {} }
class File {
  constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); }
  get name() { return this.uri.split('/').pop(); }
  get exists() { return files.has(this.uri); }
  write(data, options) { files.set(this.uri, options?.encoding === 'base64' ? Buffer.from(data, 'base64') : data); }
  textSync() { return files.get(this.uri); }
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
  delete() { files.delete(this.uri); }
}
const commands = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const alerts = [];
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const images = { dataUrl: async () => 'data:image/png;base64,test', pickImages: async () => [], savePainterWork: () => ({}), saveCutout: () => ({}), saveMotionLoop: () => ({ path: 'moving.gif', width: 360, height: 360 }) };
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n]));
Object.assign(rn, { Keyboard: { addListener: () => ({ remove() {} }), dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert(title, message, buttons) { alerts.push({ title, message, buttons }); } }, Linking: { openURL: async () => {} } });
const load = loader({
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'bundled://art', uri: 'bundled://art' }) }) } },
  'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-constants': { default: { expoConfig: { extra: {} } } }, 'react-native-webview': { WebView },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => {} },
  'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  './src/services/images': images, '../services/images': images,
  './src/components/image-analyzer': { ImageAnalyzer: () => null },
  './src/components/extra-composer': { ExtraComposer: React.forwardRef(() => null), placeInFrame: () => ({ x: 0, y: 0, w: 1, h: 1 }) },
  './src/components/motion-baker': { MotionBaker: React.forwardRef(() => null) },
});
const { createProject } = load('src/project.ts');
const { loadStore, saveStore } = load('src/services/storage.ts');
const color = load('src/painter/color.ts');
const App = load('App.tsx').default;

let tree;
const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
const lastCommand = type => sent().filter(m => m.type === type).at(-1);
const labelled = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const press = async label => { const m = labelled(label); assert.equal(m.length, 1, 'button ' + label + ' (' + m.length + ')'); assert.ok(!m[0].props.disabled, 'enabled ' + label); await act(async () => m[0].props.onPress()); };
const range = label => { const m = tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === label); return m; };
const nudge = async (label, action, times = 1) => { for (let i = 0; i < times; i++) { const [r] = range(label); assert.ok(r, 'range ' + label); await act(async () => r.props.onAccessibilityAction({ nativeEvent: { actionName: action } })); } };
const hexInput = () => tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === 'HEX 색 값');
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
const sleep = ms => act(async () => { await new Promise(r => setTimeout(r, ms)); });
const scene = { type: 'state', undo: false, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null, caption: null, layers: [], references: [] };
async function openPainter() {
  await act(async () => { tree = create(React.createElement(App)); });
  await press('색 세트');
  const tile = tree.root.findAll(n => n.type === 'Pressable' && n.props.testID === 'slot-1');
  await act(async () => tile[0].props.onPress());
  await message({ type: 'ready' });
  await message(scene); await message({ type: 'initialized' });
}

(async () => {
  // 순수 변환 — 불투명은 6자리 그대로(기존 저장본 호환), 투명도는 8자리.
  assert.equal(color.toHex({ r: 255, g: 0, b: 0, a: 255 }), '#FF0000');
  assert.equal(color.toHex({ r: 255, g: 0, b: 0, a: 128 }), '#FF000080');
  assert.deepEqual(color.parseHex('#3366AA80'), { r: 0x33, g: 0x66, b: 0xAA, a: 0x80 });
  assert.equal(color.typedHex('3366aa', false), '#3366AA');
  assert.equal(color.typedHex('#3366AA80', false), null, '무료 HEX 는 투명도 자리를 받지 않는다');
  assert.equal(color.typedHex('#3366AA80', true), '#3366AA80');
  assert.equal(color.typedHex('#3366AAFF', true), '#3366AA', '완전 불투명은 6자리로 정리');
  assert.equal(color.hsvOf(color.hsv(210, .5, .8)).h, 210, '색상환 ↔ 색 왕복');

  const icons = (root, name) => root.findAll(n => n.type === 'Icon' && n.props.name === name).length;
  // 45.4: 스포이드는 누르기도 되고 누른 채 캔버스로 끌 수도 있는 손잡이(Pressable 이 아니라 responder 를 가진 View).
  const dropper = () => tree.root.findAll(n => n.props && n.props.accessibilityLabel === '스포이드')[0];
  const dropTap = async () => { await act(async () => dropper().props.onResponderGrant({ nativeEvent: { pageX: 0, pageY: 0 } })); await act(async () => dropper() && dropper().props.onResponderRelease({ nativeEvent: { pageX: 0, pageY: 0 } })); };
  // ── PRO ─────────────────────────────────────────────────────────────────────────────────────
  const p = createProject('색 세트', '콩이');
  saveStore({ version: 1, revision: 1, projects: [p], entitlement: { plan: 'yearly', source: 'store', verified: true, expiresAt: '2099-01-01T00:00:00.000Z' } });
  await openPainter();
  await press('색');
  assert.ok(dropper(), '스포이드');
  assert.equal(labelled('내 팔레트에 저장').length, 1, '내 팔레트 저장');
  await press('직접 선택');
  // 45.4: 계열·진하기는 둥근 색상환에서, 밝기는 막대 하나로. 긴 RGB 막대 세 줄은 없앴다(투명도는 남는다).
  for (const name of ['밝기', '투명도']) assert.equal(range(name).length, 1, name + ' 막대');
  for (const name of ['빨강', '초록', '파랑', '색상']) assert.equal(range(name).length, 0, name + ' 막대는 색상환이 대신한다');
  const wheel = () => tree.root.findAll(n => n.props && n.props.accessibilityLabel === '색상환')[0];
  assert.ok(wheel(), '색상환 하나로 색을 고른다');
  // 가운데에서 오른쪽 끝(각도 0°) = 빨강 계열, 가장자리 = 가장 진하게.
  await act(async () => wheel().props.onResponderGrant({ nativeEvent: { locationX: 128, locationY: 66 } }));
  await act(async () => wheel().props.onResponderRelease({ nativeEvent: { locationX: 128, locationY: 66 } }));
  const wheelColor = lastCommand('color').color;
  assert.ok(wheelColor, '색상환에서 고른 색이 캔버스로 간다');
  assert.ok(Math.abs(color.hsvOf(wheelColor).h) <= 8 || Math.abs(color.hsvOf(wheelColor).h - 360) <= 8, '오른쪽 끝은 빨강 계열: ' + wheelColor);
  assert.ok(color.hsvOf(wheelColor).s > .8, '가장자리는 진한 색: ' + wheelColor);
  await nudge('투명도', 'decrement', 50);
  const tinted = lastCommand('color').color;
  const t = color.parseHex(tinted);
  assert.equal(tinted.length, 9, '투명도가 색 값에 들어간다: ' + tinted);
  assert.ok(Math.abs(t.a - 128) <= 2, '투명도 50% ≈ 알파 128: ' + t.a);
  assert.ok(!(loadStore().store.palette ?? []).includes(tinted), '막대를 끄는 동안에는 최근 색을 매번 쓰지 않는다');
  await sleep(800);
  assert.equal(loadStore().store.palette[0], tinted, '손을 멈추면 한 번 최근 색에 남는다');

  await press('내 팔레트에 저장');
  assert.deepEqual(loadStore().store.userPalette, [tinted], '내 팔레트에 저장된다');
  assert.equal(labelled('내 팔레트에 있음').length, 1, '이미 저장한 색이라고 말한다');

  await dropTap();
  assert.deepEqual(lastCommand('eyedrop'), { type: 'eyedrop', on: true }, '캔버스에 스포이드를 켠다');
  assert.equal(labelled('팔레트 닫기').length, 0, '캔버스를 보도록 패널이 내려간다');
  await message({ ...scene, picking: true });
  assert.equal(labelled('스포이드 취소').length, 1, '스포이드 중이라고 알리고 취소할 수 있다');
  await message({ type: 'picked', color: '#3366AA', x: 10, y: 10 });
  assert.equal(lastCommand('color').color, color.withAlpha('#3366AA', t.a), '읽은 색 계열 + 지금 투명도가 캔버스로 간다');
  assert.equal(hexInput().length, 1, '패널이 직접 선택으로 다시 올라온다');
  await message({ ...scene, picking: false });
  await message({ type: 'picked', color: null });
  assert.ok(alerts.at(-1).title.includes('색이 없는 곳'), '투명한 곳은 그렇게 말한다');

  // 45.4: 누른 채 끌어서 집기 — 끄는 동안 읽은 색이 보이고, 떼는 순간 확정되어 그리기로 돌아간다.
  if (!dropper()) await press('색');
  // 실제 기기처럼 캔버스 사각형 크기를 정해 준다(레이아웃 한 번).
  const area = tree.root.findAll(n => n.type === 'View' && typeof n.props.onLayout === 'function' && n.props.style && n.props.style.flex === 1)[0];
  if (area) await act(async () => area.props.onLayout({ nativeEvent: { layout: { width: 360, height: 640 } } }));
  await act(async () => dropper().props.onResponderGrant({ nativeEvent: { pageX: 40, pageY: 500 } }));
  await act(async () => dropper().props.onResponderMove({ nativeEvent: { pageX: 180, pageY: 200 } }));
  const asked = lastCommand('sample');
  assert.ok(asked && asked.vx >= 0 && asked.vx <= 1 && asked.vy >= 0 && asked.vy <= 1, '끄는 자리의 색을 캔버스에 물어본다');
  await message({ type: 'sampled', color: '#22AA44' });
  assert.ok(tree.root.findAll(n => n.props && n.props.testID === '스포이드 미리보기').length === 1, '집히는 색을 손가락에 가리지 않게 보여 준다');
  await act(async () => dropper().props.onResponderRelease({ nativeEvent: { pageX: 180, pageY: 200 } }));
  assert.equal(color.parseHex(lastCommand('color').color).r, color.parseHex('#22AA44').r, '떼면 그 색이 캔버스 색이 된다');
  assert.deepEqual(lastCommand('eyedrop'), { type: 'eyedrop', on: false }, '집고 나면 스포이드는 꺼진다');
  assert.equal(tree.root.findAll(n => n.props && n.props.testID === '스포이드 미리보기').length, 0, '손을 떼면 미리보기도 사라진다');
  if (!hexInput().length) { await press('색'); await press('직접 선택'); }
  await act(async () => hexInput()[0].props.onChangeText('#11223380'));
  assert.equal(lastCommand('color').color, '#11223380', 'HEX 는 투명도 2자리를 받는다');

  await press('팔레트');
  await press('내 팔레트 ' + tinted);
  assert.equal(lastCommand('color').color, tinted, '내 팔레트 색을 다시 쓴다');
  await press('색');
  await press('내 팔레트 정리');
  await press('내 팔레트 ' + tinted + ' 지우기');
  assert.deepEqual(loadStore().store.userPalette, [], '내 팔레트에서 지운다');
  await press('팔레트 닫기');

  // ── PRO 고급 브러시 ─────────────────────────────────────────────────────────────────────────
  // 브러시 도구는 이미 골라져 있다. 한 번 더 누르면 브러시 설정이 열린다.
  const brushCmd = () => lastCommand('brushSettings');
  await press('브러시');
  for (const t of ['매끈한 잉크', '부드러운 펜', '결 연필', '마커']) assert.equal(labelled('브러시 ' + t).length, 1, 'PRO 고급 브러시 ' + t);
  assert.equal(icons(tree.root, 'lock-outline'), 0, 'PRO 사용자에게 자물쇠가 없다');
  await press('브러시 마커');
  assert.equal(brushCmd().preset, 'marker', '프리셋이 캔버스로 간다');
  assert.ok(labelled('펜').every(n => !n.props.accessibilityState.selected), '기본 펜 카드는 선택에서 내려온다');
  assert.equal(labelled('브러시 닫기').length, 1, '프리셋을 골라도 설정은 열려 있다');
  assert.equal(labelled('굵기 12').length, 0, '굵기는 브러시 설정에 없다 — 캔버스 가장자리에서 바꾼다');
  assert.equal(range('진하기').length, 0, '진하기는 세부 설정 안에 접혀 있다');
  await press('세부 설정');
  await nudge('진하기', 'decrement', 50);
  assert.equal(brushCmd().opacity, .5, '브러시 진하기 50%');
  assert.ok(!(loadStore().store.projects[0].brush?.opacity === .5), '진하기를 끄는 동안에는 매번 저장하지 않는다');
  await press('보정 강');
  assert.deepEqual([brushCmd().stabilizer, brushCmd().smoothing], ['strong', true], '선 보정 강');
  await sleep(800);
  assert.deepEqual(loadStore().store.projects[0].brush, { preset: 'marker', opacity: .5, stabilizer: 'strong' }, '브러시 설정이 프로젝트에 저장된다');
  await press('브러시 닫기');
  const brushTool = labelled('브러시')[0];
  assert.equal(icons(brushTool, 'brush-variant'), 1, '도구 줄의 브러시 아이콘이 고급 브러시를 보여 준다');
  await act(async () => tree.unmount());
  commands.length = 0;
  await openPainter();
  assert.deepEqual([brushCmd().preset, brushCmd().opacity, brushCmd().stabilizer, brushCmd().smoothing], ['marker', .5, 'strong', true], '다시 열면 브러시 설정이 복원된다');
  await press('브러시'); await press('연필');
  assert.equal(brushCmd().preset, null, '기본 연필을 고르면 프리셋에서 내려온다');
  assert.equal(lastCommand('brush').brush, 'pencil');
  await press('브러시 마커'); await press('브러시 닫기');
  assert.equal(loadStore().store.projects[0].brush.preset, 'marker');
  await act(async () => tree.unmount());

  // ── 무료 ────────────────────────────────────────────────────────────────────────────────────
  const s = loadStore().store;
  saveStore({ ...s, revision: s.revision + 1, entitlement: undefined, userPalette: ['#ABCDEF'] });
  commands.length = 0;
  await openPainter();
  // 무료: 고급 브러시 효력만 멈춘다. 진하기·선 보정은 무료라 저장된 값 그대로다.
  assert.deepEqual([brushCmd().preset, brushCmd().opacity, brushCmd().stabilizer], [null, .5, 'strong'], '무료: 고급 브러시만 효력이 멈추고 진하기·보정은 유지된다');
  assert.equal(loadStore().store.projects[0].brush.preset, 'marker', '무료: 저장된 고급 브러시 설정은 지우지 않는다');
  await press('브러시');
  assert.equal(icons(tree.root, 'lock-outline'), 0, '무료: 브러시 시트에 자물쇠가 하나도 없다');
  assert.equal(labelled('브러시 마커').length, 0, '무료: 잠긴 고급 브러시 카드를 줄지어 보여 주지 않는다');
  assert.equal(tree.root.findAll(n => n.type === 'Text' && String(n.children?.join('')) === 'PRO').length, 1, '무료: PRO 표시는 고급 브러시 한 줄뿐이다');
  const before = sent().filter(m => m.type === 'brushSettings').length;
  await press('고급 브러시 PRO');
  assert.equal(labelled('PRO 닫기').length, 1, '무료: 고급 브러시는 PRO 안내로 간다');
  assert.equal(sent().filter(m => m.type === 'brushSettings').length, before, '무료: 안내를 여는 것만으로 캔버스가 바뀌지 않는다');
  await press('PRO 닫기');
  assert.equal(range('진하기').length, 0, '무료: 진하기는 세부 설정 안에 접혀 있다');
  await press('세부 설정');
  assert.equal(range('진하기').length, 1, '무료: 세부 설정을 펼치면 진하기 막대');
  await nudge('진하기', 'increment', 10);
  assert.equal(brushCmd().opacity, .6, '무료: 진하기를 바꾼다');
  await press('보정 중');
  assert.equal(brushCmd().stabilizer, 'medium', '무료: 선 보정 중');
  await press('선 보정');
  assert.equal(brushCmd().smoothing, false, '무료: 선 보정 끄기');
  assert.equal(labelled('보정 약').length, 0, '꺼져 있으면 단계는 숨는다');
  await press('선 보정');
  assert.equal(brushCmd().smoothing, true, '무료: 다시 켜기');
  await press('브러시 닫기');
  await press('색');
  assert.equal(labelled('색 #54A9E8').length, 1, '무료: 팔레트 견본');
  assert.equal(icons(tree.root, 'lock-outline'), 0, '무료: 색 패널에도 자물쇠가 없다');
  await dropTap();
  assert.deepEqual(lastCommand('eyedrop'), { type: 'eyedrop', on: true }, '무료: 스포이드를 쓴다');
  await message({ ...scene, picking: true });
  await press('스포이드 취소');
  await message({ ...scene, picking: false });
  const current = lastCommand('color')?.color ?? lastCommand('init').color;
  await press('내 팔레트에 저장');
  assert.deepEqual(loadStore().store.userPalette, [current, '#ABCDEF'], '무료: 내 팔레트에 저장된다');
  await press('내 팔레트 #ABCDEF');
  assert.equal(lastCommand('color').color, '#ABCDEF', '무료: 모아 둔 색을 쓴다');
  await press('색');
  await press('직접 선택');
  assert.ok(tree.root.findAll(n => n.props && n.props.accessibilityLabel === '색상환')[0], '무료: 색상환');
  assert.equal(range('밝기').length, 1, '무료: 밝기 막대');
  assert.equal(range('투명도').length, 1, '무료: 투명도 막대');
  const free = () => tree.root.findAll(n => n.props && n.props.accessibilityLabel === '색상환')[0];
  await act(async () => free().props.onResponderGrant({ nativeEvent: { locationX: 4, locationY: 66 } }));
  await act(async () => free().props.onResponderRelease({ nativeEvent: { locationX: 4, locationY: 66 } }));
  const leftSide = lastCommand('color').color;
  assert.ok(Math.abs(color.hsvOf(leftSide).h - 180) <= 8, '무료: 색상환 왼쪽 끝은 하늘 계열: ' + leftSide);
  await act(async () => hexInput()[0].props.onChangeText('#11223380'));
  assert.equal(lastCommand('color').color, '#11223380', '무료: HEX 투명도도 받는다');
  assert.equal(labelled('PRO 닫기').length, 0, '무료: 색과 브러시 조절 어디에서도 결제 화면이 열리지 않았다');
  await act(async () => tree.unmount());
  console.log('PASS: color — 색상환·밝기·투명도가 캔버스 색을 바꾸고 최근 색은 멈춘 뒤 한 번만 기록, 스포이드 켜기·취소·읽은 색 반영·빈 곳 안내·누른 채 끌어 집기(끄는 동안 미리보기, 떼면 확정), 내 팔레트 저장·재사용·정리, HEX 투명도, 브러시 도구 다시 누르기로 설정, 고급 브러시 저장·복원. 무료: 색·진하기·선 보정 전부 사용, 자물쇠 0, PRO 표시는 고급 브러시 한 줄, 누르면 안내로 가고 캔버스는 그대로. Native/WebView mocked.');
})().catch(e => { console.error(e); process.exit(1); });
