// 45.2차 UI 구조 잠금. 기능이 아니라 **순서와 노출 조건**이 되돌아가지 않게 막는다.
//   홈(세트 0·1·4·10 × 공지 꺼짐/켜짐) · 그리기(기본·브러시·색·레이어·문구·참고·선택·확대) ·
//   움직이기(빈 칸·효과·재사용·PRO) · 보드(빈·일부·완성) · 내보내기(일부·손볼 곳·자세히).
// 실제 앱을 그려(react-test-renderer) 순서를 읽는다. 픽셀·손맛 판정은 실기기가 맡는다.
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
const keyboardListeners = {};
const commands = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n]));
Object.assign(rn, { Keyboard: { addListener: (name, fn) => { (keyboardListeners[name] = keyboardListeners[name] || []).push(fn); return { remove() {} }; }, dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} }, Linking: { openURL: async () => {} } });
const png = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(360, 16); png.writeUInt32BE(360, 20);
const pngData = 'data:image/png;base64,' + png.toString('base64');
const mocks = {
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'bundled://art', uri: 'bundled://art' }) }) } }, 'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-constants': { default: { expoConfig: { extra: {} } } }, 'react-native-webview': { WebView },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => {} }, 'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  './src/components/image-analyzer': { ImageAnalyzer: () => null },
  './src/components/extra-composer': { ExtraComposer: React.forwardRef(() => null), placeInFrame: () => ({ x: 0, y: 0, w: 1, h: 1 }) },
  './src/components/motion-baker': { MotionBaker: React.forwardRef(() => null) },
};
const real = loader(mocks)('src/services/images.ts');
const images = { dataUrl: async () => pngData, pickImages: async () => [], savePainterWork: (...a) => real.savePainterWork(...a), saveCutout: (...a) => real.saveCutout(...a), saveMotionLoop: () => ({ path: 'moving.gif', width: 360, height: 360 }), saveSubmitLoop: () => undefined };
const base = { ...mocks, './src/services/images': images, '../services/images': images };
const load = loader(base);
const { saveStore, loadStore } = load('src/services/storage.ts');
const { createProject } = load('src/project.ts');
const App = load('App.tsx').default;
// 공지가 켜진 홈은 같은 화면을 다른 자료로 그린 것이다. 자료(asset-slots)만 갈아끼워 같은 App 을 다시 그린다.
const slotSource = load('src/design/asset-slots.ts');
const noticeOn = { ...slotSource, HOME_NOTICE: { ...slotSource.HOME_NOTICE, enabled: true, title: '첫 공지', body: '짧은 정보 한 줄' } };
const AppNotice = loader({ ...base, './src/design/asset-slots': noticeOn, '../design/asset-slots': noticeOn })('App.tsx').default;
// 기본 레퍼런스는 아직 준비 중이라 제품 화면에서 감춰 둔다. 안쪽 동작은 ready 를 켠 이 자료로 검사한다.
const builtinOn = { ...slotSource, BUILTIN_REFERENCES: { ...slotSource.BUILTIN_REFERENCES, ready: true } };
const AppBuiltin = loader({ ...base, './src/design/asset-slots': builtinOn, '../design/asset-slots': builtinOn })('App.tsx').default;

let tree, scene;
const flat = style => Object.assign({}, ...[style].flat(9).filter(Boolean).map(s => typeof s === 'function' ? s({ pressed: false }) : s));
const all = () => tree.root.findAll(() => true);
const anyLabel = label => tree.root.findAll(n => n.props.accessibilityLabel === label);
 const labelled = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const press = async label => { const m = labelled(label); assert.equal(m.length, 1, 'button ' + label + ' (' + m.length + ')'); await act(async () => m[0].props.onPress()); };
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
const lastCommand = type => sent().filter(m => m.type === type).at(-1);
 const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
const text = n => [n.props.children].flat(9).filter(x => typeof x === 'string' || typeof x === 'number').join('');
const texts = () => tree.root.findAll(n => n.type === 'Text').map(text);
const byTestID = id => tree.root.findAll(n => n.props.testID === id);
const render = async (Component = App) => { if (tree) await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(Component)); }); };
async function ready() {
  await message({ type: 'ready' });
  const init = sent().filter(m => m.type === 'init').at(-1);
  scene = { type: 'state', undo: false, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null, caption: null, motion: null, layers: init.layers.map(l => ({ id: l.id, name: l.name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 })), references: [] };
  await message(scene); await message({ type: 'initialized' });
}
const setStore = (projects, revision) => saveStore({ version: 1, revision, projects, palette: ['#54A9E8'] });
const makeProjects = (count, from = 1) => Array.from({ length: count }, (_, i) => {
  const p = createProject('세트 ' + (from + i), '콩이');
  p.updatedAt = new Date(Date.UTC(2026, 8, from + i)).toISOString();
  return p;
});
const drawn = path => ({ path, width: 360, height: 360 });
// 홈에서 보이는 큰 덩어리를 그려진 차례대로 읽는다.
const homeSections = () => {
  const out = [];
  for (const n of all()) {
    const id = n.props?.testID, label = n.props?.accessibilityLabel;
    if (id === '홈 창작 표면') out.push('창작');
    else if (id === 'asset-slot-homeEmptyArtwork') out.push('빈 상태');
    else if (id === '홈 알림') out.push('공지');
    else if (n.type === 'Pressable' && label === '표현 가이드') out.push('가이드');
    else if (n.type === 'Text' && text(n) === '최근 작업') out.push('최근 작업');
    else if (n.type === 'Pressable' && /^세트 \d+$/.test(label ?? '')) out.push('카드');
  }
  return out.filter((s, i) => s !== '카드' || out[i - 1] !== '카드');
};


// 45.4 편의성 회귀. 손이 하는 일을 그대로 흉내 내서, 한 번의 손가락이 두 가지 일을 하지 않는지 본다.
const styleOf = n => Object.assign({}, ...[n.props.style].flat(9).filter(Boolean).map(x => typeof x === 'function' ? x({ pressed: false }) : x));

(async () => {
  const p = createProject('편의 세트', '콩이');
  saveStore({ version: 1, revision: 1, projects: [p], palette: ['#54A9E8'] });
  await act(async () => { tree = create(React.createElement(App)); });
  await press('편의 세트');
  await act(async () => byTestID('slot-1')[0].props.onPress());
  await ready();
  const area = tree.root.findAll(n => n.type === 'View' && typeof n.props.onLayout === 'function' && !Array.isArray(n.props.style) && n.props.style?.flex === 1)[0];
  await act(async () => area.props.onLayout({ nativeEvent: { layout: { width: 360, height: 620 } } }));

  // ── 1. 패널을 연 채 캔버스를 누르면: 패널만 닫힌다. 그 손가락은 그림에 닿지 않는다 ──────────────
  const veil = () => byTestID('패널 닫기 막');
  const openers = [['브러시', '브러시 닫기'], ['색', '팔레트 닫기'], ['문구', '문구 닫기'], ['레이어', null]];
  for (const [open, close] of openers) {
    await press(open);
    assert.equal(veil().length, 1, open + ': 캔버스에 닫기 막이 생긴다');
    const before = sent().length;
    await act(async () => veil()[0].props.onPress());
    assert.equal(sent().length, before, open + ': 닫는 손가락은 캔버스에 아무 명령도 보내지 않는다');
    assert.equal(veil().length, 0, open + ': 막이 사라지고 그리기로 돌아온다');
    if (close) assert.equal(labelled(close).length, 0, open + ': 패널이 닫혔다');
  }

  // ── 2. 채우기·지우개처럼 한 번의 터치가 그림을 바꾸는 도구에서도 같은 규칙 ─────────────────────
  for (const tool of ['채우기', '지우개']) {
    await press(tool);
    await press('색');
    const before = sent().filter(m => ['fill', 'down', 'up', 'move'].includes(m.type)).length;
    await act(async () => veil()[0].props.onPress());
    assert.equal(sent().filter(m => ['fill', 'down', 'up', 'move'].includes(m.type)).length, before, tool + ': 패널을 닫는 터치가 그림을 바꾸지 않는다');
  }
  await press('브러시');

  // ── 3. 패널을 여닫아도 확대·이동은 그대로 ────────────────────────────────────────────────────
  await message({ type: 'zoom', zoom: 2 });
  assert.equal(labelled('원래 크기로 보기').length, 1, '확대 중');
  await press('색');
  const zoomCommands = sent().filter(m => m.type === 'zoom').length;
  await act(async () => veil()[0].props.onPress());
  assert.equal(sent().filter(m => m.type === 'zoom').length, zoomCommands, '패널을 여닫아도 확대 값을 건드리지 않는다');
  assert.ok(texts().includes('200%'), '돌아와도 같은 배율');
  await message({ type: 'zoom', zoom: 1 });

  // ── 4. 색상환: 고른 색이 캔버스로 가고, 칸을 옮겨도 최근 색으로 남는다 ─────────────────────────
  await press('색');
  await press('직접 선택');
  const wheel = () => anyLabel('색상환')[0];
  await act(async () => wheel().props.onResponderGrant({ nativeEvent: { locationX: 128, locationY: 66 } }));
  await act(async () => wheel().props.onResponderRelease({ nativeEvent: { locationX: 128, locationY: 66 } }));
  const picked = lastCommand('color').color;
  assert.ok(picked, '색상환에서 고른 색이 캔버스로 간다');
  await new Promise(r => setTimeout(r, 900));
  assert.equal(loadStore().store.palette[0], picked, '손을 멈추면 최근 색에 남는다');
  await press('팔레트 닫기');

  // ── 5. 스포이드: 끌어서 집고 떼면 그 색으로 다시 그린다(도구는 그대로) ────────────────────────
  await press('색');
  const dropper = () => anyLabel('스포이드')[0];
  await act(async () => dropper().props.onResponderGrant({ nativeEvent: { pageX: 40, pageY: 500 } }));
  await act(async () => dropper().props.onResponderMove({ nativeEvent: { pageX: 120, pageY: 220 } }));
  assert.ok(lastCommand('sample'), '끄는 자리의 색을 물어본다');
  await message({ type: 'sampled', color: '#123456' });
  assert.equal(byTestID('스포이드 미리보기').length, 1, '집히는 색이 보인다');
  await act(async () => dropper().props.onResponderRelease({ nativeEvent: { pageX: 120, pageY: 220 } }));
  assert.equal(lastCommand('color').color.slice(0, 7), '#123456', '뗀 자리 색이 그리기 색이 된다');
  assert.deepEqual(lastCommand('eyedrop'), { type: 'eyedrop', on: false }, '스포이드는 꺼진다');
  assert.equal(labelled('브러시')[0].props.accessibilityState.selected, true, '쓰던 도구로 돌아온다');
  assert.equal(labelled('팔레트 닫기').length, 0, '패널도 내려가 캔버스로 돌아온다');

  // ── 6. 기본 레퍼런스: 아직 준비 중이라 제품 화면에는 이 갈래가 없다 ─────────────────────────
  //   칸별 자료도 고르는 동작도 없는 격자를 사용자에게 보이지 않는다(자료는 지우지 않았다).
  //   안쪽 동작(자세 넘기기·다시 찾기)은 ready 를 켠 자료로 파일 끝에서 그대로 검사한다.
  await press('참고');
  assert.equal(labelled('기본 레퍼런스').length, 0, '준비 중인 기본 레퍼런스 갈래는 화면에 없다');
  assert.equal(byTestID('기본 레퍼런스 격자').length, 0, '준비 중인 격자도 없다');
  assert.equal(labelled('참고 사진 추가').length, 1, '내 사진 참고는 그대로 쓸 수 있다');
  await press('참고');

  // ── 7. 선택 → 움직이기: 그림은 그대로다 ──────────────────────────────────────────────────────
  await press('선택');
  scene = { ...scene, selection: { box: { x: 10, y: 10, w: 50, h: 50 }, dx: 0, dy: 0, scale: 1, rot: 0 } };
  await message(scene);
  const destructive = sent().filter(m => ['clear', 'removeLayer', 'discard'].includes(m.type)).length;
  await press('움직이기');
  assert.equal(sent().filter(m => ['clear', 'removeLayer', 'discard'].includes(m.type)).length, destructive, '선택한 채 움직이기로 가도 그림을 지우지 않는다');
  await press('그리기');


  // 앞 단계에서 켜 둔 선택은 끄고 본다(선택 중에는 아래 줄이 선택 도구 줄로 바뀐다).
  scene = { ...scene, selection: null }; await message(scene);
  // ── 8. 45.5 정보구조: 문구는 위 줄에 하나, 아래 줄은 브러시·색이 주인공 ─────────────────────
  const top = () => byTestID('도구 줄')[0];
  const quick = () => byTestID('빠른 모드')[0];
  assert.equal(labelled('문구').length, 1, '문구 입구는 하나');
  assert.equal(top().findAll(n => n.props.accessibilityLabel === '문구').length, 0, '문구는 아래 도구 줄에 없다');
  assert.deepEqual(top().findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel).map(n => n.props.accessibilityLabel),
    ['브러시', '색', '지우개', '채우기', '선택'], '아래 줄: 브러시·색 다음에 빠른 모드 셋');
  assert.deepEqual(quick().findAll(n => n.type === 'Pressable').map(n => n.props.accessibilityLabel), ['지우개', '채우기', '선택'], '빠른 모드는 셋뿐(중복 없음)');
  const cell = label => top().findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label)[0];
  assert.ok(styleOf(cell('브러시')).flex > (styleOf(cell('지우개')).flex ?? 0), '브러시가 빠른 모드보다 크게 선다');
  assert.ok(styleOf(cell('색')).flex >= 1 && !styleOf(cell('지우개')).flex, '색도 넓게, 빠른 모드는 좁은 칸');
  for (const name of ['지우개', '채우기', '선택']) assert.ok((styleOf(cell(name)).minHeight ?? 0) >= 44, name + ': 손가락 자리는 그대로');

  // ── 9. 도구를 열고 닫아도 캔버스는 제자리 ───────────────────────────────────────────────────
  const canvasBox = () => {
    const areaNode = tree.root.findAll(n => n.type === 'View' && typeof n.props.onLayout === 'function' && !Array.isArray(n.props.style) && n.props.style?.flex === 1)[0];
    const square = areaNode.findAll(n => n.type === 'View' && !Array.isArray(n.props.style) && n.props.style?.overflow === 'hidden' && typeof n.props.style?.width === 'number')[0];
    return { align: areaNode.props.style.justifyContent, w: square?.props.style.width, h: square?.props.style.height };
  };
  // 브러시 패널을 열려면 먼저 브러시가 골라져 있어야 한다(다시 누르기 = 설정 열기).
  if (!labelled('브러시')[0].props.accessibilityState.selected) await press('브러시');
  const before = canvasBox();
  const zooms = () => sent().filter(m => m.type === 'zoom').length;
  const zoomBefore = zooms();
  for (const [open, close] of [['브러시', '브러시 닫기'], ['색', '팔레트 닫기'], ['레이어', null], ['문구', '문구 닫기']]) {
    await press(open);
    assert.deepEqual(canvasBox(), before, open + ': 패널을 열어도 캔버스 자리·크기가 그대로');
    if (close) await press(close); else await act(async () => veil()[0].props.onPress());
    assert.deepEqual(canvasBox(), before, open + ': 닫아도 그대로');
  }
  assert.equal(zooms(), zoomBefore, '패널을 여닫는 동안 확대·이동 값을 건드리지 않는다');

  // ── 10. 선 종류: 이름만이 아니라 실제 선 견본으로 고른다 ─────────────────────────────────────
  await press('브러시');
  const kinds = byTestID('선 종류')[0].findAll(n => n.type === 'Pressable');
  assert.deepEqual(kinds.map(n => n.props.accessibilityLabel), ['펜', '붓', '연필'], '선 종류 셋');
  for (const k of kinds) assert.equal(k.findAll(n => n.type === 'Image').length, 1, k.props.accessibilityLabel + ': 실제 선 견본이 보인다');
  assert.ok(kinds.every(n => (styleOf(n).minHeight ?? 0) >= 44), '누르는 자리는 44dp 이상');
  await press('붓');
  assert.equal(lastCommand('brush').brush, 'brush', '견본을 누르면 그 선으로 바뀐다');
  await press('브러시 닫기');

  // ── 11. 문구: 색이 실제로 바뀌고, 키보드가 닫히면 남는 것이 없다 ─────────────────────────────
  scene = { ...scene, caption: { text: '고마워', place: 'bottom', color: '#242424' } };
  await message(scene);
  await press('문구');
  const swatch = tree.root.findAll(n => n.type === 'Pressable' && /^문구 색 #/.test(n.props.accessibilityLabel ?? ''))[0];
  assert.ok(swatch, '문구 자리에서 색을 고를 수 있다');
  await act(async () => swatch.props.onPress());
  const painted = lastCommand('caption').caption;
  assert.equal(painted.text, '고마워', '글자는 그대로');
  assert.equal(painted.color.toUpperCase(), swatch.props.accessibilityLabel.replace('문구 색 ', '').toUpperCase(), '고른 색이 캔버스의 문구에 바로 간다');
  assert.equal(lastCommand('color').color.toUpperCase(), painted.color.toUpperCase(), '그리는 색도 같은 색이 된다');
  // 키보드 → 적용 → 정리
  await act(async () => { for (const fn of keyboardListeners.keyboardDidShow || []) fn({ endCoordinates: { height: 320 } }); });
  const input = tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === '문구 내용')[0];
  assert.ok(input, '키보드가 올라와도 입력칸은 같은 자리');
  await act(async () => input.props.onChangeText('안녕'));
  await press('문구 적용');
  await act(async () => { for (const fn of keyboardListeners.keyboardDidHide || []) fn({}); });
  assert.equal(tree.root.findAll(n => n.type === 'TextInput').length, 0, '적용하면 입력칸이 남지 않는다');
  assert.equal(labelled('문구 닫기').length, 0, '문구 패널도 닫힌다');
  assert.deepEqual(lastCommand('captionPick'), { type: 'captionPick', on: true }, '적용한 글씨는 골라진 채로 캔버스에 남는다');
  assert.equal(lastCommand('caption').caption.text, '안녕', '고친 글자가 캔버스로 간다');

  // ── 12. 45.6 빠른 도구: 뜻이 분명한 것은 아이콘만, 접근성 이름은 그대로 ─────────────────────
  assert.equal(byTestID('빠른 지우개')[0].findAll(n => n.type === 'Text').length, 0, '지우개는 그림만으로 통한다');
  assert.equal(byTestID('빠른 채우기')[0].findAll(n => n.type === 'Text').length, 0, '채우기도 이름을 떼었다');
  assert.equal(byTestID('빠른 선택')[0].findAll(n => n.type === 'Text').length, 1, '선택은 아이콘만으로 알기 어려워 짧은 이름을 남긴다');
  for (const name of ['지우개', '채우기', '선택']) {
    assert.equal(labelled(name).length, 1, name + ': 접근성 이름은 그대로 하나');
    assert.ok((styleOf(labelled(name)[0]).minHeight ?? 0) >= 44, name + ': 손가락 자리 유지');
  }
  await press('지우개');
  assert.equal(styleOf(labelled('지우개')[0]).backgroundColor, '#FFF2B6', '고른 빠른 도구는 옅은 노랑으로 바로 구분된다');
  assert.equal(styleOf(labelled('채우기')[0]).backgroundColor, 'transparent', '고르지 않은 것은 조용하다');
  await press('브러시');

  // ── 13. 문구 글씨체: 고르면 캔버스에 바로, 저장에도 남고, 없던 저장본도 그대로 열린다 ─────────
  scene = { ...scene, caption: { text: '고마워', place: 'bottom', color: '#242424', style: 'basic' } };
  await message(scene);
  await press('문구');
  await press('문구 글씨 또박');
  assert.equal(lastCommand('caption').caption.style, 'serif', '고른 글씨체가 캔버스로 간다');
  assert.equal(lastCommand('caption').caption.text, '고마워', '글자와 자리는 그대로');
  await press('문구 글씨 도톰');
  assert.equal(lastCommand('caption').caption.style, 'thick', '다른 성격으로도 바꾼다');
  await press('문구 닫기');
  // 예전 저장본: 글씨체 항목이 아예 없어도 그대로 읽히고, 없는 채로 보존된다(옮겨 심기 필요 없음).
  const old = loadStore().store;
  const oldCut = { ...old.projects[0].slots[0], work: { version: 1, activeLayerId: 'draw-1', layers: [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }], references: [], caption: { text: '옛 문구', place: 'top', color: '#242424' } } };
  saveStore({ ...old, revision: old.revision + 1, projects: [{ ...old.projects[0], slots: old.projects[0].slots.map((x, i) => i === 0 ? oldCut : x) }] });
  const reread = loadStore().store.projects[0].slots[0].work.caption;
  assert.deepEqual(reread, { text: '옛 문구', place: 'top', color: '#242424' }, '글씨체가 없던 저장본은 그대로 남는다(값을 몰래 넣지 않는다)');
  // ── 14. 45.7 레이어 차례 바꾸기: 메뉴 안 버튼 둘, 양 끝에서는 나오지 않는다 ─────────────────
  scene = { ...scene, layers: [scene.layers[0], { id: 'draw-2', name: '그림 2', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }], activeLayerId: 'draw-2' };
  await message(scene);
  await press('레이어');
  await press('레이어 1 관리');
  assert.equal(labelled('앞으로 보내기').length, 1, '맨 뒤 장은 앞으로만 보낼 수 있다');
  assert.equal(labelled('뒤로 보내기').length, 0, '맨 뒤에서는 더 뒤로 가지 않는다');
  await press('앞으로 보내기');
  assert.deepEqual(lastCommand('moveLayer'), { type: 'moveLayer', id: 'draw-1', by: 1 }, '그 장을 한 칸 앞으로 보낸다');
  scene = { ...scene, layers: [scene.layers[1], scene.layers[0]] };
  await message(scene);
  await press('레이어 1 관리');
  assert.equal(labelled('뒤로 보내기').length, 1, '맨 앞으로 간 장은 이제 뒤로만 갈 수 있다');
  assert.equal(labelled('앞으로 보내기').length, 0, '맨 앞에서는 더 앞으로 가지 않는다');
  await press('레이어');
  // ── 15. 45.10 기존 저장본 보존: 장이 여럿인 옛 칸은 그대로 열리고, 부분 움직임이 가리키는 장도 그대로 ──
  await press('그리기 닫기');
  const keep = loadStore().store;
  const oldWork = { version: 1, activeLayerId: 'draw-2', references: [],
    layers: [
      { id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, image: drawn('old-1.png') },
      { id: 'draw-2', name: '밑그림', visible: false, opacity: .6, x: 3, y: -2, scale: 1.1, rotation: 5, image: drawn('old-2.png') },
      { id: 'draw-3', name: '그림 3', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, image: drawn('old-3.png') },
    ] };
  const oldMotion = { version: 1, speed: .5, strength: .5, captionMoves: false,
    parts: [{ id: 'p1', layerId: 'draw-2', effect: 'rotate', pivotX: .5, pivotY: .5, amount: 8, angle: 0, speed: .5, delay: 0 }] };
  const target = keep.projects.find(pr => pr.projectName === '편의 세트') || keep.projects[0];
  const withOld = { ...keep, revision: keep.revision + 1, projects: keep.projects.map(pr => pr.id === target.id
    ? { ...pr, slots: pr.slots.map(s2 => s2.number === 2 ? { ...s2, finalImage: drawn('old-1.png'), work: oldWork, motion: oldMotion } : s2) } : pr) };
  saveStore(withOld);
  await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(App)); });
  const keptCut = loadStore().store.projects.find(pr => pr.id === target.id).slots.find(s2 => s2.number === 2);
  assert.deepEqual(keptCut.work.layers.map(l => l.id), ['draw-1', 'draw-2', 'draw-3'], '옛 저장본의 장 수·차례·id 가 그대로');
  assert.equal(keptCut.work.layers[1].name, '밑그림', '장 이름도 그대로');
  assert.equal(keptCut.work.layers[1].visible, false, '숨김 상태도 그대로');
  assert.equal(keptCut.work.activeLayerId, 'draw-2', '마지막으로 쓰던 장도 그대로');
  assert.equal(keptCut.motion.parts[0].layerId, 'draw-2', '부분 움직임이 가리키는 장이 바뀌지 않는다');
  await press('편의 세트');
  // 재시작하면 마지막에 열었던 칸이 바로 열릴 수 있다 — 닫고 원하는 칸을 연다.
  if (labelled('그리기 닫기').length) await press('그리기 닫기');
  await act(async () => byTestID('slot-2')[0].props.onPress());
  await ready();
  const opened = sent().filter(m => m.type === 'init').at(-1);
  assert.deepEqual(opened.layers.map(l => l.id), ['draw-1', 'draw-2', 'draw-3'], '다시 열 때도 그 장들을 그대로 싣는다');
  assert.equal(opened.activeLayerId, 'draw-2', '쓰던 장을 그대로 연다');

  // 새 칸은 한 장으로 연다(빈 둘째 장을 만들지 않는다).
  await act(async () => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === '그리기 닫기')[0].props.onPress());
  await act(async () => byTestID('slot-4')[0].props.onPress());
  await ready();
  const fresh = sent().filter(m => m.type === 'init').at(-1);
  assert.deepEqual(fresh.layers.map(l => l.id), ['draw-1'], '새 칸은 그림 한 장으로 시작한다');
  // ── 8. 기본 레퍼런스 안쪽 동작: ready 를 켠 자료로 그대로 검사한다(감췄다고 검사를 없애지 않는다) ──
  await render(AppBuiltin);
  await press('편의 세트');
  await act(async () => byTestID('slot-1')[0].props.onPress());
  await ready();
  await press('참고');
  await press('기본 레퍼런스');
  await press('포즈 기본 레퍼런스 1');
  const strip = () => byTestID('자세 넘기기')[0];
  const at = () => Number(texts().filter(t => t.endsWith(' / 8')).at(-1).split(' / ')[0]);
  assert.ok(strip(), '고른 뒤에는 자세 넘기기 줄이 나온다');
  assert.equal(at(), 1, '고른 자세가 첫 번째');
  const swipe = async (dx) => {
    const drawing = sent().filter(m => ['down', 'move', 'up', 'fill'].includes(m.type)).length;
    await act(async () => strip().props.onResponderGrant({ nativeEvent: { pageX: 200 } }));
    await act(async () => strip().props.onResponderMove({ nativeEvent: { pageX: 200 + dx } }));
    await act(async () => strip().props.onResponderRelease({ nativeEvent: { pageX: 200 + dx } }));
    assert.equal(sent().filter(m => ['down', 'move', 'up', 'fill'].includes(m.type)).length, drawing, '넘기는 손가락은 그림을 그리지 않는다');
  };
  await swipe(-80);
  assert.equal(at(), 2, '왼쪽으로 넘기면 다음 자세');
  await swipe(80);
  assert.equal(at(), 1, '오른쪽으로 넘기면 이전 자세');
  await swipe(80);
  assert.equal(at(), 1, '첫 자세에서 더 뒤로 가지 않는다(돌지 않는다)');
  for (let i = 0; i < 9; i++) await swipe(-80);
  assert.equal(at(), 8, '마지막 자세에서 더 앞으로 가지 않는다');
  await press('기본 레퍼런스 다시 찾기');
  assert.equal(byTestID('기본 레퍼런스 격자').length, 1, '다시 찾기로 격자가 돌아온다');
  await press('참고');

  await act(async () => tree.unmount());
  console.log('PASS: convenience — 새 칸 한 장·옛 다중 장 저장본과 부분 움직임 참조 보존, 레이어 차례 앞으로/뒤로(양 끝 멈춤), 빠른 도구 아이콘만(접근성 이름 유지)·고른 상태 노랑, 문구 글씨체 셋 적용·옛 저장본 호환, 문구 입구 위 한 곳·아래 줄은 브러시/색 + 빠른 모드 셋, 패널 여닫기에도 캔버스 자리 불변, 선 종류 실제 견본, 문구 색 즉시 반영·키보드 정리, 패널을 닫는 첫 터치가 그림에 닿지 않음(브러시·색·문구·레이어·채우기·지우개), 패널 여닫기 후 확대 유지, 색상환 선택과 최근 색, 스포이드 끌어 집기(미리보기·확정·도구 복귀·패널 복귀), 기본 레퍼런스 자세 넘기기(다음·이전·양 끝 멈춤·획 없음)와 다시 찾기, 선택 → 움직이기에서 그림 보존. Native/WebView mocked.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
