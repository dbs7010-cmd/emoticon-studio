// PRODUCT UX 회귀 검사 (38차 UX RESET).
// 감사에서 사람이 찾아낸 결함 유형을 다시 사람이 찾지 않도록, 문자열 하나가 아니라 실제 App 을 그려 누르고 상태를 본다.
//   1 이름과 동작: 도구를 다시 누르면 그 설정, "펜"이 도구·선 종류 두 뜻으로 쓰이지 않음
//   2 잠금 밀도: 자주 여는 작업 패널의 자물쇠·PRO 표시
//   3 중복 입구: 참고·문구·움직이기, 저장 버튼 없음
//   4 24컷: 새 칸·재시작에서 선 종류·굵기·지우개 크기·도구 유지, 빈 칸에서 이전 그림 이어받기(확인창 없음)
//   5 움직이기: 가짜 재생 막대 없음, 효과 견본이 실제로 움직임, 설정은 고른 뒤, PRO 는 시작 전에 안내
//   6 FREE 핵심 흐름에 결제 화면이 끼어들지 않음
//   7 열었다 닫기만 하면 저장된 세트가 바이트까지 같음
//   8 약속 문구 모순("제출 파일"/"작업 파일") 없음, 개발자 문구·오류 원문·글자 기호 아이콘 없음
// 네이티브 모듈과 WebView 는 흉내다. 손가락 크기·실제 렌더링은 실기기가 맡는다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
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
const commands = [], alerts = [], shared = [], appStates = [];
// 반복 제작 벤치마크: 손가락 행동을 센다(누르기·끌기).
let taps = 0, drags = 0;
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n]));
Object.assign(rn, { Keyboard: { addListener: () => ({ remove() {} }), dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: (_type, fn) => { appStates.push(fn); return { remove() {} }; } }, Alert: { alert(title, message, buttons) { alerts.push({ title, message, buttons }); } }, Linking: { openURL: async () => {} } });
const mocks = {
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'bundled://art', uri: 'bundled://art' }) }) } },
  'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-constants': { default: { expoConfig: { extra: {} } } }, 'react-native-webview': { WebView },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async (uri, options) => { shared.push({ uri, options }); } },
  'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  './src/components/image-analyzer': { ImageAnalyzer: () => null },
  './src/components/extra-composer': { ExtraComposer: React.forwardRef(() => null), placeInFrame: () => ({ x: 0, y: 0, w: 1, h: 1 }) },
  './src/components/motion-baker': { MotionBaker: React.forwardRef((props, ref) => { if (ref) ref.current = { bake: async () => ({ count: 8, fps: 10, loop: .8, delayMs: 100, data: 'data:image/gif;base64,R0lGODlh', bytes: 2048, droppedColours: 0, clipped: false }) }; return null; }) },
};
const png = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(360, 16); png.writeUInt32BE(360, 20);
const pngData = 'data:image/png;base64,' + png.toString('base64');
const real = loader(mocks)('src/services/images.ts');
// 움직이는 파일 흉내도 실제 파일을 남긴다 — 내보내기는 진짜 코드가 파일을 읽어 묶기 때문이다.
const saveMotionLoop = () => { files.set('document/emoticon-studio/moving.gif', Buffer.from('GIF89a\x68\x01\x68\x01', 'latin1')); return { path: 'moving.gif', width: 360, height: 360 }; };
const images = { dataUrl: async () => pngData, pickImages: async () => [], savePainterWork: (...a) => real.savePainterWork(...a), saveCutout: (...a) => real.saveCutout(...a), saveMotionLoop, saveSubmitLoop: () => undefined };
const load = loader({ ...mocks, './src/services/images': images, '../services/images': images });
const { loadStore, saveStore } = load('src/services/storage.ts');
const App = load('App.tsx').default;
const { BASE_H } = load('src/painter/painter.tsx');
const { T } = load('src/components/ui.tsx');

const metrics = { coverage: .2, centerX: .5, centerY: .5, width: .5, height: .5, color: [.2, .2, .2], transparent: true };
let tree, scene;
const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
const lastCommand = type => sent().filter(m => m.type === type).at(-1);
const afterInit = () => { const all = sent(); return all.slice(all.map(m => m.type).lastIndexOf('init') + 1); };
const labelled = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const press = async label => { const m = labelled(label); assert.equal(m.length, 1, 'button ' + label + ' (' + m.length + ')'); assert.ok(!m[0].props.disabled, 'enabled ' + label); taps++; await act(async () => m[0].props.onPress()); };
// 45.5: 홈은 최근 세트 하나만 보여 준다 — 다른 세트는 전체 작업에서 연다.
const setButtons = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const openSet = async name => { if (setButtons(name).length === 0 && setButtons('전체 작업 보기').length === 1) await press('전체 작업 보기'); await press(name); };
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
const ranges = label => tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === label);
const nudge = async (label, action, times) => { for (let i = 0; i < times; i++) await act(async () => ranges(label)[0].props.onAccessibilityAction({ nativeEvent: { actionName: action } })); };
// 굵기는 캔버스 **왼쪽 밖** 세로 조절대다. 실제 네이티브 이벤트처럼 pageY(화면 좌표)와 locationY(홈 안 좌표)를 함께 준다.
// 홈은 화면 위에서 RAIL_TOP 만큼 내려와 있다 — 0 에 두면 '화면 좌표 − 홈 위치' 계산을 전혀 시험하지 못한다(45.36 의 검사가 그랬다).
// 누른 뒤의 move 에는 **엉뚱한 locationY** 를 준다: 제품이 끄는 동안 locationY 를 쓰면 값이 틀려 여기서 잡힌다(45.36-R1 G19).
// 끄는 동안의 값은 손잡이 옆 말풍선에만 적히고, 캔버스에는 아무것도 뜨지 않는다.
// 조절대 높이 200dp 를 알려 준 뒤, 원하는 굵기가 나오는 자리를 눌러 끈다.
const SIZE_RAIL = 200, RAIL_HANDLE = 34, RAIL_TOP = 300;
const atWidth = n => Math.round(RAIL_HANDLE / 2 + (1 - (n - 1) / 47) * (SIZE_RAIL - RAIL_HANDLE));
const bubbleText = id => tree.root.findAll(n => n.type === 'View' && n.props.testID === id)
  .map(n => n.findAll(x => x.type === 'Text').map(x => String(x.children?.join(''))).join(''));
const dragSize = async (label, want) => {
  const node = () => tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === label)[0];
  assert.ok(node(), 'size control ' + label);
  drags++;
  const y = atWidth(want);
  await act(async () => node().props.onLayout({ nativeEvent: { layout: { width: 60, height: SIZE_RAIL } } }));
  await act(async () => node().props.onResponderGrant({ nativeEvent: { pageY: RAIL_TOP + SIZE_RAIL, locationY: SIZE_RAIL } }));
  await act(async () => node().props.onResponderMove({ nativeEvent: { pageY: RAIL_TOP + y, locationY: 7 } }));
  const during = bubbleText('굵기 말풍선');
  await act(async () => node().props.onResponderRelease({ nativeEvent: { pageY: RAIL_TOP + y, locationY: 7 } }));
  return during;
};
const texts = () => tree.root.findAll(n => n.type === 'Text').map(n => [n.props.children].flat(9).filter(x => typeof x === 'string' || typeof x === 'number').join(''));
const locks = (root = tree.root) => root.findAll(n => n.type === 'Icon' && n.props.name === 'lock-outline').length;
const proMarks = (root = tree.root) => root.findAll(n => n.type === 'Text' && String(n.children?.join('')) === 'PRO').length;
const tiles = () => tree.root.findAll(n => n.type === 'Pressable' && /^slot-\d+$/.test(n.props.testID));
const publicLayer = l => Object.fromEntries(['id', 'name', 'visible', 'opacity', 'x', 'y', 'scale', 'rotation'].map(k => [k, l[k]]));
async function ready() {
  await message({ type: 'ready' });
  const init = lastCommand('init');
  scene = { type: 'state', undo: false, redo: false, dirty: false, activeLayerId: init.activeLayerId || 'draw-1', activeReferenceId: null, caption: init.caption || null, motion: init.motion ?? null, layers: init.layers.map(publicLayer), references: [] };
  await message(scene); await message({ type: 'initialized' });
  return init;
}
const saved = async (dirty = true) => {
  // 45.12: 엔진은 저장 요청 번호를 그대로 돌려준다.
  await message({ type: 'save', token: (lastCommand('save') || {}).token, dirty, data: pngData, metrics, activeLayerId: scene.activeLayerId, caption: scene.caption || undefined, motion: scene.motion ?? null,
    gif: scene.motion ? { count: 9, fps: 12, loop: .8, delayMs: 83, data: 'data:image/gif;base64,R0lGODlh', bytes: 2048, droppedColours: 0, clipped: false } : undefined,
    layers: scene.layers.map(l => ({ ...publicLayer(l), data: pngData })), references: [] });
  await act(async () => {});
};

(async () => {
  saveStore({ version: 1, revision: 1, projects: [] });
  await act(async () => { tree = create(React.createElement(App)); });
  const seen = [];
  const collect = () => seen.push(...texts());
  const noPaywall = where => assert.equal(labelled('PRO 닫기').length, 0, 'FREE 핵심 흐름에 결제 화면이 끼어들지 않는다: ' + where);
  collect();
  await press('새 이모티콘 만들기');
  await press('만들기');
  await ready();
  collect();

  // ── 1. 도구: 이름과 동작이 일치한다 ─────────────────────────────────────────────────────────
  const toolRow = ['펜', '지우개', '채우기', '선택'];   // 45.28: 네 칸 균등
  for (const t of toolRow) assert.ok(tree.root.findAll(n => n.props.testID === '도구 ' + t).length === 1, '도구 줄: ' + t);
  // 45.29: 브러시 카드는 '기본 펜', 도구 줄은 '펜' — 보이는 글자부터 다르다.
  // 읽어 주는 이름도 갈라 둔다: 카드 '기본 펜' · 도구 '그리기 도구 펜'. 그냥 '펜'으로 읽히는 것은 없다.
  assert.equal(labelled('펜').length, 0, "그냥 '펜'으로 읽히는 것은 없다");
  assert.equal(labelled('기본 펜').length, 1, '브러시 카드는 기본 펜');
  assert.equal(labelled('그리기 도구 펜').length, 1, '도구 줄의 펜은 따로 읽힌다');
  assert.equal(labelled('펜 굵기').length + labelled('펜 설정 닫기').length, 0, '정체불명 설정 칩·펜 설정 시트가 없다');
  await press('브러시 전체');
  assert.equal(labelled('브러시 닫기').length, 1, "'전체'를 누르면 브러시 창이 열린다");
  // 45.35: 목록은 선·채색·질감·효과 네 갈래다. 한 갈래 안에서는 마지막 줄까지 한 번의 스크롤로 닿고,
  // 네 갈래를 합치면 서른 종이 모두 있다. 갈래를 넘겨 가며 센다.
  const GROUP_TABS = ['선', '채색', '질감', '효과'];
  const variants = [];
  let listLocks = 0, listPro = 0;
  for (const g of GROUP_TABS) {
    await press('브러시 분류 ' + g);
    const list = tree.root.findAll(n => n.props.testID === '브러시 목록')[0];
    variants.push(...list.findAll(n => n.type === 'Pressable' && /^브러시 /.test(n.props.accessibilityLabel ?? '')).map(n => n.props.accessibilityLabel));
    assert.ok(list.findAll(n => n.type === 'Pressable').length >= 4, g + ' 갈래에도 줄이 여럿 있다 — 한 줄짜리 목록 자리는 없다');
    listLocks += locks(); listPro += proMarks();
  }
  assert.equal(variants.length, 30, '전체 목록은 무료 10 + PRO 20 = 30종: ' + variants.length);
  assert.equal(new Set(variants).size, 30, '같은 브러시가 두 갈래에 겹쳐 있지 않다');
  assert.ok(variants.every(v => /^브러시 /.test(v)), '목록의 이름은 도구 줄과 섞이지 않게 모두 \'브러시 …\' 다: ' + JSON.stringify(variants));

  // ── 2. 잠금 밀도: 브러시 설정 ─────────────────────────────────────────────────────────────
  assert.equal(listLocks, 0, '브러시 창: 자물쇠 0');
  // 45.31: 분류 목록에서는 줄마다 무료/PRO 를 적는다. 자물쇠는 여전히 0 이고, 잠긴 것도 견본이 보인다.
  assert.equal(listPro, 20, '브러시 목록: PRO 표시는 PRO 브러시 수와 같다, got ' + listPro);
  const showBrush = async name => { for (const g of GROUP_TABS) { if (labelled('브러시 ' + name).length) return; await press('브러시 분류 ' + g); } };
  await showBrush('마커');
  assert.equal(labelled('브러시 마커').length, 1, '마커는 무료 10종이라 목록에 그대로 있다');
  await showBrush('연필');
  await press('브러시 연필');   // 무료 사용자라 무료 브러시로 고른다
  // 45.25: 고르면 선택판이 닫힌다. 세부 설정을 보려면 다시 연다 — 그것이 '고르기'와 '맞추기'를 가르는 자리다.
  assert.equal(labelled('세부 설정').length, 0, '브러시를 고르면 선택판이 닫힌다');
  await press('브러시 전체');
  // 브러시 시트는 브러시를 고르는 곳: 굵기 줄이 없고, 진하기·보정은 세부 설정 안에 접혀 있다.
  assert.equal(labelled('굵기 24').length, 0, '굵기 버튼 줄은 브러시 시트에 없다');
  assert.equal(ranges('진하기').length, 0, '진하기는 처음에 접혀 있다');
  await press('세부 설정');
  await nudge('진하기', 'decrement', 4);
  await press('보정 강');
  noPaywall('브러시 설정(진하기·보정)');
  collect();
  // 45.35 §4: 도구 창을 열고 닫아도 **캔버스와 아래 줄의 높이는 그대로다**. 브러시 창은 화면 전체를
  // 덮는 독립 창이라 아래 줄을 접을 이유가 없어졌다(45.34 는 접느라 여닫을 때 캔버스가 커졌다 작아졌다 했다).
  assert.equal(tree.root.findAll(n => n.props.testID === '빠른 브러시').length, 1, '창이 열려도 아래 줄의 자리는 그대로다');
  assert.equal(tree.root.findAll(n => n.props.testID === '브러시 창 배경').length, 1, '창 뒤는 가볍게 어두워진다');
  assert.equal(tree.root.findAll(n => n.type === 'View' && !Array.isArray(n.props.style) && n.props.style?.height === BASE_H).length, 1, '창이 열려도 아래 줄 높이가 바뀌지 않는다');
  // 세부 설정은 같은 창의 다른 화면이다. 뒤로 가면 보던 갈래로 돌아온다.
  assert.equal(labelled('브러시 목록으로').length, 1, '세부 설정에는 목록으로 돌아가는 길이 있다');
  await press('브러시 목록으로');
  assert.equal(ranges('진하기').length, 0, '목록으로 돌아오면 설정 막대는 접힌다');
  await press('브러시 닫기');
  assert.equal(labelled('브러시 닫기').length, 0, '닫기를 누르면 닫힌다');
  assert.equal(tree.root.findAll(n => n.props.testID === '브러시 창 배경').length, 0, '창이 사라지면 어둡던 것도 걷힌다');
  assert.equal(labelled('브러시 전체').length, 1, '아래 줄의 전체 입구는 그대로다');

  // ── 굵기(45.35 승인 시안: 캔버스 왼쪽 세로 조절대. 값은 손잡이 옆 말풍선에만 적힌다) ──
  assert.equal(tree.root.findAll(n => n.props.testID === '굵기 미리보기').length, 0, '캔버스 한가운데 검은 미리보기 상자는 없다');
  assert.equal(tree.root.findAll(n => n.type === 'View' && n.props.testID === '굵기 말풍선').length, 1, '굵기 값은 손잡이 옆 한 곳에만 적힌다');
  assert.ok(ranges('브러시 굵기')[0].props.style.height >= 56, '조절대 홈 길이: ' + ranges('브러시 굵기')[0].props.style.height);
  let during = await dragSize('브러시 굵기', 24);
  assert.deepEqual(during, ['24'], '끄는 동안 말풍선이 지금 값을 말한다');
  assert.equal(lastCommand('width').width, 24, '브러시 굵기가 캔버스로 간다');
  assert.equal(loadStore().store.projects[0].brush.width, 24, '손을 떼면 굵기가 세트에 남는다');
  // 손가락이 홈 밖으로 한참 나가도 값은 끝에서 멈춘다 — 튀거나 거꾸로 가지 않는다(45.36-R1 G19).
  {
    const rail = () => ranges('브러시 굵기')[0];
    await act(async () => rail().props.onLayout({ nativeEvent: { layout: { width: 60, height: SIZE_RAIL } } }));
    await act(async () => rail().props.onResponderGrant({ nativeEvent: { pageY: RAIL_TOP + 100, locationY: 100 } }));
    await act(async () => rail().props.onResponderMove({ nativeEvent: { pageY: RAIL_TOP - 400, locationY: 3 } }));
    assert.deepEqual(bubbleText('굵기 말풍선'), ['48'], '홈 위로 한참 나가면 최댓값에서 멈춘다');
    await act(async () => rail().props.onResponderMove({ nativeEvent: { pageY: RAIL_TOP + SIZE_RAIL + 600, locationY: 3 } }));
    assert.deepEqual(bubbleText('굵기 말풍선'), ['1'], '홈 아래로 한참 나가면 최솟값에서 멈춘다');
    const widthsBefore = commands.filter(c => c.includes('"width"')).length;
    await act(async () => rail().props.onResponderRelease({ nativeEvent: { pageY: RAIL_TOP + SIZE_RAIL + 600, locationY: 3 } }));
    assert.equal(lastCommand('width').width, 1, '손을 떼면 마지막 값(1)이 캔버스로 간다');
    assert.equal(commands.filter(c => c.includes('"width"')).length, widthsBefore + 1, '끄는 동안이 아니라 손을 뗄 때 한 번만 보낸다');
    await dragSize('브러시 굵기', 24);
  }
  await press('지우개');
  assert.equal(lastCommand('tool').tool, 'eraser', '다른 도구는 처음 누르면 고르기만 한다');
  await press('지우개');
  assert.equal(tree.root.findAll(n => n.type === 'Pressable' && / 닫기$/.test(n.props.accessibilityLabel ?? '') && n.props.accessibilityLabel !== '그리기 닫기').length, 0, '지우개는 따로 여는 설정 시트가 없다');
  assert.equal(ranges('브러시 굵기').length, 0, '지우개일 때는 같은 자리가 지우개 굵기');
  during = await dragSize('지우개 굵기', 40);
  assert.deepEqual([during[0], lastCommand('width')], ['40', { type: 'width', tool: 'eraser', width: 40 }], '지우개 굵기도 같은 조작');
  assert.equal(loadStore().store.projects[0].brush.eraserWidth, 40, '지우개 굵기도 세트에 남는다');
  await press('그리기 도구 펜');   // 그리기로 돌아온다
  assert.equal(ranges('브러시 굵기')[0].props.accessibilityValue.now, 24, '브러시 → 지우개 → 브러시: 브러시 굵기 그대로');
  assert.equal(lastCommand('brushSettings').preset, 'pencil2', '고른 연필도 그대로');
  await press('채우기'); await press('채우기');
  assert.equal(tree.root.findAll(n => n.type === 'Pressable' && / 닫기$/.test(n.props.accessibilityLabel ?? '') && n.props.accessibilityLabel !== '그리기 닫기').length, 0, '설정이 없는 도구는 다시 눌러도 시트를 열지 않는다');
  await press('지우개');

  // ── 43.1차: 이미 있는 두 손가락 확대를 알 수 있게 — 확대한 동안에만 작은 배율 표시, 누르면 100% ──────────────
  const canvasAreaNode = () => tree.root.findAll(n => n.type === 'View' && n.props.testID === '캔버스 영역')[0];
  assert.equal(labelled('원래 크기로 보기').length, 0, '100% 에서는 배율 표시가 없다');
  await message({ type: 'zoom', zoom: 1.5 });
  assert.equal(labelled('원래 크기로 보기').length, 1, '확대하면 작은 배율 표시가 뜬다');
  assert.equal(labelled('원래 크기로 보기')[0].findAll(n => n.type === 'Text' && String(n.children?.join('')) === '150%').length, 1, '배율은 150% 처럼 보인다');
  await press('원래 크기로 보기');
  assert.deepEqual(lastCommand('zoom'), { type: 'zoom', zoom: 1 }, '누르면 캔버스가 100% 로 돌아간다');
  assert.equal(labelled('원래 크기로 보기').length, 0, '100% 로 돌아오면 표시가 사라진다');

  // ── 44.2차 참고 ─────────────────────────────────────────────────────────────────────
  //   기본 레퍼런스 32칸은 칸별 자료도 고르는 동작도 없어 제품 화면에서 감춰 뒀다.
  //   격자·고르기·다시 찾기의 기존 동작은 ready 를 켠 자료로 convenience-test 8절이 그대로 검사한다.
  await press('참고');
  assert.equal(labelled('기본 레퍼런스').length, 0, '준비 중인 기본 레퍼런스 갈래는 제품 화면에 없다');
  assert.equal(tree.root.findAll(n => n.props.testID === '기본 레퍼런스 격자').length, 0, '준비 중인 격자도 없다');
  assert.equal(labelled('참고 사진 추가').length, 1, '내 사진 참고는 그대로다');
  await press('참고');

  // ── 2. 잠금 밀도: 색 ─────────────────────────────────────────────────────────────────────
  await press('색');
  // 45.5: 도구를 연다고 그림이 움직이지 않는다 — 색 패널을 열어도 캔버스는 같은 자리(45.36-R1 부터 영역 맨 위)에 그대로 선다.
  assert.equal(canvasAreaNode().props.style.justifyContent, 'flex-start', '색 패널을 열어도 캔버스는 제자리다(45.5차)');
  assert.equal(locks() + proMarks(), 0, '색(팔레트): 자물쇠·PRO 표시 0');
  // 45.4: 스포이드는 누르기도 되고 누른 채 캔버스로 끌 수도 있는 손잡이다.
  const dropper = () => tree.root.findAll(n => n.props && n.props.accessibilityLabel === '스포이드')[0];
  assert.ok(dropper(), '색 패널에 스포이드가 있다');
  taps++;
  await act(async () => dropper().props.onResponderGrant({ nativeEvent: { pageX: 0, pageY: 0 } }));
  await act(async () => dropper() && dropper().props.onResponderRelease({ nativeEvent: { pageX: 0, pageY: 0 } }));
  await message({ ...scene, picking: true }); await press('스포이드 취소'); await message({ ...scene, picking: false });
  await press('내 팔레트에 저장');
  await press('직접 선택');
  assert.equal(locks() + proMarks(), 0, '색(직접 선택): 자물쇠·PRO 표시 0');
  assert.equal(ranges('투명도').length, 1, '투명도는 무료');
  noPaywall('색(스포이드·내 팔레트·RGB)');
  collect();
  await press('팔레트 닫기');

  // ── 3. 중복 입구 ──────────────────────────────────────────────────────────────────────────
  const count = list => list.reduce((n, l) => n + labelled(l).length, 0);
  assert.equal(count(['참고', '참고 열기', '기준 그림 보기', '직전 그림 보기', '기획 보기']), 1, '참고 입구는 하나');
  assert.equal(count(['움직이기', '움직이기로 넘어가기']), 1, '움직이기 입구는 하나');
  assert.equal(count(['문구', '문구 넣기', '문구 고치기', '문구 고르기']), 1, '문구 입구는 하나');
  assert.equal(labelled('저장').length, 0, '저장 버튼으로 저장을 관리하게 하지 않는다');
  await press('더보기');
  assert.equal(count(['문구 넣기', '문구 고치기', '이 그림을 기준 그림으로', '기준 그림 보기']), 0, '더보기가 다른 입구를 되풀이하지 않는다');
  // 45.2: 캐릭터 기준은 세트 전체의 일이라 더보기 한 곳에만 있다(참고 줄에는 없다).
  assert.equal(count(['이 칸을 캐릭터 기준으로', '이 칸을 캐릭터 기준으로 바꾸기']), 1, '캐릭터 기준 입구는 더보기에 하나');
  await press('더보기 닫기');
  await press('참고');
  assert.equal(count(['이 칸을 캐릭터 기준으로', '이 칸을 캐릭터 기준으로 바꾸기', '캐릭터 기준 보기']), 0, '참고 줄은 볼 그림만 다룬다');
  await press('참고');

  await press('문구');
  await act(async () => tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === '문구 내용')[0].props.onChangeText('안녕'));
  assert.equal(count(['문구 위', '문구 아래', '문구 위치 조절', '문구 크게', '문구 작게']), 0, '글씨 자리를 버튼으로 옮기는 간접 배치가 없다');
  taps++; await act(async () => tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === '문구 내용')[0].props.onSubmitEditing());
  assert.equal(tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === '문구 내용').length, 0, '키보드 완료로 입력이 끝나고 패널이 내려간다');
  assert.deepEqual(lastCommand('captionPick'), { type: 'captionPick', on: true }, '입력을 마치면 글씨가 골라진 상태로 캔버스에 남는다');
  assert.ok(!texts().some(t => t.includes('지금 고른 색으로')), '문구 색은 설명문이 아니라 견본으로 보인다');
  // 엔진이 돌려주는 모양: 손가락으로 옮기고 키운 문구.
  const placed = { ...lastCommand('caption').caption, dx: 40, dy: -60, scale: 1.4 };
  scene = { ...scene, caption: placed, captionPicked: true, dirty: true, undo: true }; await message(scene);
  assert.equal(count(['문구 내용 고치기', '문구 선택 끝']), 2, '글씨를 고른 동안에는 내용 고치기·끝만');
  // 45.35: 조절대는 늘 같은 자리를 지킨다(사라지면 화면이 흔들린다). 대신 뜻이 없는 동안에는
  // 비활성이 되고 값 말풍선도 내려간다 — 지금 바꿀 수 있는 것처럼 보이지 않는다.
  const sizeRail = [...ranges('브러시 굵기'), ...ranges('지우개 굵기')];
  assert.equal(sizeRail.length, 1, '굵기 조절대는 그 자리에 그대로 있다');
  assert.equal(sizeRail[0].props.accessibilityState.disabled, true, '글씨를 고른 동안 굵기 조절은 비활성이다');
  assert.equal(tree.root.findAll(n => n.type === 'View' && n.props.testID === '굵기 말풍선').length, 0, '비활성인 동안에는 값 말풍선을 띄우지 않는다');
  await message({ type: 'captionEdit' });
  assert.equal(tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === '문구 내용').length, 1, '고른 글씨를 한 번 더 누르면 내용 고치기가 열린다');
  await press('문구 닫기');
  await press('문구 선택 끝');
  assert.deepEqual(lastCommand('captionPick'), { type: 'captionPick', on: false });
  scene = { ...scene, captionPicked: false }; await message(scene);

  // ── 5. 움직이기 ───────────────────────────────────────────────────────────────────────────
  await press('움직이기');
  const fakeBars = tree.root.findAll(n => n.type === 'View' && !!n.props.style && !Array.isArray(n.props.style) && ['0%', '100%'].includes(n.props.style.width) && n.props.style.height === 6);
  assert.equal(fakeBars.length, 0, '0%/100% 로만 바뀌는 가짜 재생 막대가 없다');
  assert.ok(!texts().some(t => t.includes('초 반복')), '반복 길이 줄이 없다');
  const sampleStyles = () => tree.root.findAll(n => n.type === 'Image' && Array.isArray(n.props.style) && n.props.style.some(s => s && s.transform)).map(n => JSON.stringify(n.props.style[1]));
  // 45.34: 전체 움직임이 셋에서 여섯으로 늘었다(둥실·통통·두근거리기·까딱·흔들기·부르르).
  // 개수를 글자로 박지 않고 화면이 내놓는 효과 수와 견준다 — 수를 늘릴 때마다 여기가 막히면 안 된다.
  const { PRESETS: MOTION_PRESETS } = load('src/painter/motion-panel.tsx');
  assert.ok(MOTION_PRESETS.length >= 6, '전체 움직임은 최소 여섯 가지: ' + MOTION_PRESETS.length);
  assert.equal(new Set(MOTION_PRESETS.map(e => e.id)).size, MOTION_PRESETS.length, '효과 id 가 겹치지 않는다');
  assert.equal(sampleStyles().length, MOTION_PRESETS.length, '효과 카드가 모두 움직이는 견본을 가진다');
  const first = JSON.stringify(sampleStyles());
  await act(async () => { await new Promise(r => setTimeout(r, 250)); });
  assert.notEqual(JSON.stringify(sampleStyles()), first, '견본이 실제로 움직인다');
  // 견본이 서로 달라야 이름만 다른 효과가 아니다.
  assert.equal(new Set(sampleStyles()).size > 1, true, '효과마다 견본이 다르게 움직인다');
  assert.equal(ranges('속도').length, 0, '효과를 고르기 전에는 설정표가 먼저 나오지 않는다');
  assert.equal(locks(), 0, '움직이기: 자물쇠 0');
  assert.equal(proMarks(), 1, '움직이기 기본 화면: PRO 표시는 부분 움직임 한 줄');
  await press('통통');
  scene = { ...scene, motion: lastCommand('motion').motion }; await message(scene);
  assert.equal(ranges('속도').length, 1, '고르면 속도가 나온다');
  assert.equal(labelled('글씨도 같이 움직이기').length, 1, '문구가 있을 때만, 결과를 예상할 수 있는 말로');
  const partsRow = labelled('부분만 움직이기')[0];
  assert.equal(proMarks(partsRow), 1, 'PRO 부분 움직임은 누르기 전에 PRO 라고 보인다');
  const motionsBefore = sent().filter(m => m.type === 'motion').length;
  await press('부분만 움직이기');
  assert.equal(labelled('PRO 닫기').length, 1, '무료 사용자는 만들기 전에 PRO 안내로 간다');
  assert.equal(sent().filter(m => m.type === 'motion').length, motionsBefore, '안내를 여는 것만으로 칸이 바뀌지 않는다');
  await press('PRO 닫기');
  noPaywall('움직이기(무료 효과)');
  collect();
  await press('완성 후 다음');
  await saved(true);
  assert.ok(!alerts.some(a => /PRO/.test(a.title ?? '')), '저장할 때 PRO 알림이 끼어들지 않았다');
  assert.equal(loadStore().store.projects[0].slots[0].done, true, '움직이기 탭에서도 완성할 수 있다');

  // ── 4. 새 칸: 제작 설정이 이어진다 ──────────────────────────────────────────────────────────
  let init = await ready();
  assert.equal(init.penWidth, 24, '새 칸: 브러시 굵기 유지');
  assert.equal(init.eraserWidth, 40, '새 칸: 지우개 크기 유지');
  assert.ok(afterInit().some(m => m.type === 'brushSettings' && m.preset === 'pencil2'), '새 칸: 선 종류(연필) 유지');
  assert.ok(afterInit().some(m => m.type === 'tool' && m.tool === 'eraser'), '새 칸: 고른 도구(지우개) 유지');
  assert.ok(labelled('지우개')[0].props.accessibilityState.selected, '새 칸: 도구 줄도 지우개');
  assert.equal(lastCommand('brushSettings').stabilizer, 'strong', '새 칸: 선 보정 유지');
  const onDisk = loadStore().store.projects[0].brush;
  assert.deepEqual([onDisk.preset, onDisk.width, onDisk.eraserWidth, onDisk.stabilizer], ['pencil2', 24, 40, 'strong'], '설정은 세트에 저장된다');

  // 빈 칸에서 이전 그림으로 시작: 한 번 누르면 된다(비어 있는 칸이라 확인창 없음).
  assert.equal(labelled('이전 칸 그림으로 시작').length, 1, '빈 다음 칸이 이전 칸 그림으로 시작을 제안한다');
  const alertsBefore = alerts.length;
  await press('이전 칸 그림으로 시작');
  await act(async () => {});
  assert.ok(lastCommand('copyWork'), '누르면 이전 그림이 들어온다');
  assert.equal(alerts.length, alertsBefore, '빈 칸에서는 확인창을 띄우지 않는다');
  assert.equal(labelled('이전 칸 그림으로 시작').length, 0, '한 번 쓰면 사라진다');
  scene = { ...scene, dirty: true, undo: true }; await message(scene);

  // ── 직전 칸 움직임 다시 쓰기(무료) ─────────────────────────────────────────────────────────
  await press('움직이기');
  assert.equal(labelled('직전 칸 움직임 다시 쓰기').length, 1, '움직임 없는 칸에서 직전 칸 움직임을 한 번에 다시 쓴다');
  await press('직전 칸 움직임 다시 쓰기');
  assert.deepEqual(lastCommand('motion').motion, loadStore().store.projects[0].slots[0].motion, '직전 칸 설정(효과·속도·세기) 그대로');
  noPaywall('직전 칸 움직임 다시 쓰기');
  scene = { ...scene, motion: lastCommand('motion').motion }; await message(scene);
  await press('그리기');

  // ── 조용한 자동저장: 그리기를 멈추게 하지 않고, 짧게 확신만 준다 ──────────────────────────────
  const saves = () => sent().filter(m => m.type === 'save').length;
  const mark = () => tree.root.findAll(n => n.props.testID === '저장 표시')[0].props.accessibilityLabel;
  const toolbar = () => tree.root.findAll(n => n.type === 'View' && !Array.isArray(n.props.style) && n.props.style?.height === BASE_H)[0];
  assert.equal(mark(), undefined, '평소에는 저장 표시가 없다');
  let savesAt = saves();
  await act(async () => appStates.at(-1)('background'));
  assert.equal(saves(), savesAt + 1, '앱을 내리면 자동저장');
  assert.equal(mark(), '저장 중', '저장 중에는 작은 표시');
  assert.equal(toolbar().props.pointerEvents, 'auto', '자동저장이 도구 줄을 잠그지 않는다');
  // 45.34 에서 뒤집힌 규칙. 예전에는 저장이 끝날 때까지 도구 명령을 모아 뒀는데, 그 사이에 그은 획이
  // **이전 도구로** 그려졌다 — 지우개 → 펜 전환이 사라져 새 획이 지워지는 증상을 픽셀로 재현했다
  // (verification/round45_34/eraser-before). 도구·브러시·색·굵기는 그림을 건드리지 않고
  // '다음에 무엇으로 그릴지'만 정하므로 저장 중에도 **바로** 보낸다.
  const toolsBefore = sent().filter(m => m.type === 'tool').length;
  await press('채우기');
  assert.equal(sent().filter(m => m.type === 'tool').length, toolsBefore + 1, '저장 중에 누른 도구도 바로 간다 — 미뤘다가 보내면 그 사이 획이 이전 도구로 그려진다');
  assert.deepEqual(sent().filter(m => m.type === 'tool').at(-1), { type: 'tool', tool: 'fill' }, '보낸 것이 방금 고른 도구다');
  await saved(true);
  assert.equal(mark(), '저장됨', '끝나면 짧은 체크');
  await act(async () => { await new Promise(r => setTimeout(r, 1300)); });
  assert.equal(mark(), undefined, '체크는 스스로 사라진다');
  await press('브러시 전체');
  // 자동저장 중에 누른 완성은 잃지 않고, 겹쳐 저장하지 않고, 끝난 뒤 이어서 한다.
  scene = { ...scene, dirty: true }; await message(scene);
  savesAt = saves();
  await act(async () => appStates.at(-1)('background'));
  await press('완성 후 다음');
  assert.equal(saves(), savesAt + 1, '자동저장 중 완성은 겹쳐 저장하지 않는다');
  await saved(true);
  await act(async () => { await new Promise(r => setTimeout(r, 30)); });
  assert.equal(saves(), savesAt + 2, '기다리던 완성이 이어서 저장된다');
  await saved(true);
  assert.equal(loadStore().store.projects[0].slots[1].done, true, '2번 칸이 완성된다');
  await ready();
  await press('그리기 닫기');
  await saved(false);
  collect();

  // ── 보드: 작품이 먼저, 아래 줄에는 지금 할 일 ──────────────────────────────────────────────
  const dock = tree.root.findAll(n => n.props.testID === 'board-action-dock')[0];
  assert.deepEqual(dock.findAll(n => n.type === 'Pressable').map(n => n.props.accessibilityLabel), ['이어서 그리기', '내보내기'], '보드 아래 줄: 이어서 그리기와 내보내기');
  assert.equal(count(['제출 준비', '움직임 일괄 적용', '순서 바꾸기', '첫 칸 그리기']), 0, '격자를 밀어내는 버튼 줄이 없다');
  await press('세트 메뉴');
  assert.equal(proMarks(labelled('움직임 한 번에 적용')[0]), 1, '여러 칸 한 번에(PRO)는 누르기 전에 PRO 라고 보인다');
  await press('움직임 한 번에 적용');
  assert.equal(labelled('PRO 닫기').length, 1, '무료 사용자는 일괄 화면 대신 PRO 안내로 간다');
  await press('PRO 닫기');

  // ── 7. 열었다 닫기만 하면 아무것도 바뀌지 않는다 ──────────────────────────────────────────
  const before = JSON.stringify(loadStore().store.projects[0]);
  await act(async () => tiles().find(t => t.props.testID === 'slot-1').props.onPress());
  init = await ready();
  assert.equal(init.motion.preset, 'bounce', '저장된 움직임이 캔버스로 온다');
  assert.deepEqual(init.caption, placed, '옮기고 키운 문구가 다시 열어도 같은 자리·크기');
  await press('그리기 닫기');
  await saved(false);
  assert.equal(JSON.stringify(loadStore().store.projects[0]), before, '열었다 닫기만 하면 저장된 세트가 한 글자도 바뀌지 않는다');

  // ── 4. 재시작 뒤에도 굵기·선 종류 유지 ────────────────────────────────────────────────────
  await act(async () => tree.unmount()); commands.length = 0;
  await act(async () => { tree = create(React.createElement(App)); });
  await openSet('새 이모티콘 세트');
  await act(async () => tiles().find(t => t.props.testID === 'slot-3').props.onPress());
  init = await ready();
  assert.equal(init.penWidth, 24, '재시작 뒤에도 굵기 유지');
  assert.ok(afterInit().some(m => m.type === 'brushSettings' && m.preset === 'pencil2'), '재시작 뒤에도 선 종류 유지');
  assert.equal(lastCommand('brushSettings').stabilizer, 'strong', '재시작 뒤에도 선 보정 유지');
  // 짧은 화면(캔버스 영역 360×353): 굵기 조절은 캔버스 안에 들어가고, 움직이기 패널이 캔버스를 절반 넘게 덮지 않는다.
  const area = tree.root.findAll(n => n.type === 'View' && n.props.testID === '캔버스 영역')[0];
  await act(async () => area.props.onLayout({ nativeEvent: { layout: { width: 360, height: 353 } } }));
  assert.equal(ranges('브러시 굵기').length, 1, '짧은 화면에서도 굵기 조절이 있다');
  // 45.35: 굵기 조절대는 캔버스 영역 **밖**, 왼쪽 기둥에 세로로 선다. 그림 위에 겹치지 않는다.
  assert.equal(area.findAll(n => n.props.accessibilityLabel === '브러시 굵기' || n.props.accessibilityLabel === '지우개 굵기').length, 0, '조절대는 캔버스 영역 안에 없다');
  const band = tree.root.findAll(n => n.props.accessibilityLabel === '브러시 굵기' || n.props.accessibilityLabel === '지우개 굵기');
  assert.equal(band.length, 1, '조절대는 화면에 하나');
  // 짧은 화면에서도 끌 만큼은 길다(하한 108dp). 캔버스가 길다고 끝없이 늘어나지도 않는다.
  assert.ok(band[0].props.style.height >= 56 && band[0].props.style.height <= 208, '짧은 화면의 홈 길이: ' + band[0].props.style.height);
  assert.ok(24 + 20 + (19 + band[0].props.style.height) * 2 <= 353, '짧은 화면에서도 기둥이 캔버스 영역 안에 든다');
  assert.notEqual(band[0].props.style.position, 'absolute', '캔버스 위에 겹치지 않는다');
  await press('움직이기');
  const motionBox = tree.root.findAll(n => n.type === 'View' && Array.isArray(n.props.style) && n.props.style.some(s => s && typeof s.height === 'number' && s.flexShrink === 0))[0];
  const motionHeight = Object.assign({}, ...motionBox.props.style).height;
  const overlap = Math.max(0, motionHeight - BASE_H) / 353;
  assert.ok(overlap < .4, '짧은 화면에서 움직이기 패널이 캔버스를 40% 넘게 덮지 않는다: ' + Math.round(overlap * 100) + '%');
  await press('그리기');
  // 최근 색: 한 번 고른 색은 다음부터 맨 위에서 한 번에. 기본 색 견본은 '팔레트' 갈래에 있다(45.28차).
  await press('색');
  await press('팔레트');
  await press('색 #54A9E8');
  await press('그리기 닫기');
  await saved(false);

  // ── 6·8. 내보내기: 결과가 먼저, 약속과 같은 말 ─────────────────────────────────────────────
  await press('내보내기');
  collect();
  assert.equal(tree.root.findAll(n => n.props.testID === '결과 격자').length, 1, '내보내기 화면의 주인공은 결과 격자');
  await press('파일 묶음 만들기');
  await act(async () => {});
  assert.equal(shared.length, 1, '무료로 파일 묶음을 내보낸다 — 마지막 알림: ' + JSON.stringify(alerts.at(-1) ?? null) + ' / 화면: ' + texts().filter(t => /만들|못했/.test(t)).join(' | '));
  noPaywall('내보내기');
  collect();
  await press('뒤로'); await press('뒤로');
  await press('PRO 보기');
  const proText = texts();
  collect();
  assert.ok(proText.some(t => t.includes('파일 묶음으로 내보낼 수 있어요')), 'PRO 화면의 무료 약속은 내보내기 기능과 같은 말을 쓴다');
  assert.ok(!proText.some(t => /스포이드|진하기|내 팔레트|RGB|정밀한 색/.test(t)), '그리기 기본 기능을 PRO 가치로 팔지 않는다');
  await press('PRO 닫기');
  assert.deepEqual([...new Set(seen.filter(t => /제출 파일|작업 파일/.test(t)))], [], '"제출 파일"과 "작업 파일"이 서로 다른 약속을 하지 않는다');
  assert.deepEqual([...new Set(seen.filter(t => /revision|JSON|Error|undefined|WARNING|\bnull\b|NaN/.test(t)))], [], '개발자 문구·오류 원문이 화면에 없다');
  assert.ok(!seen.some(t => t.includes('부분 움직임은 PRO')), '저장 시점 결제벽을 한 번도 만나지 않았다');

  // ── 24~32컷 벤치마크: 같은 캐릭터 다음 칸 만들기 ───────────────────────────────────────────
  // FLOW A: 빈 다음 칸 → 이전 그림으로 시작 → 브러시(붓) → 굵기 → 최근 색 → 문구 입력·배치 → 완성·다음
  // FLOW B: 빈 다음 칸 → 이전 그림으로 시작 → 문구 고치기 → 직전 칸 움직임 → 완성·다음
  const bench = async run => { const t0 = taps, d0 = drags, a0 = alerts.length, m0 = seen.length; await run(); return { taps: taps - t0, drags: drags - d0, modals: alerts.length - a0 }; };
  await openSet('새 이모티콘 세트');
  await act(async () => tiles().find(t => t.props.testID === 'slot-4').props.onPress()); await ready();
  const flowA = await bench(async () => {
    await press('이전 칸 그림으로 시작'); await act(async () => {});
    scene = { ...scene, dirty: true, undo: true }; await message(scene);
    // 목록이 열리면 아래 즐겨찾기 줄이 접히므로(45.34 §6) 목록 쪽 이름으로 고른다.
    await press('브러시 전체'); await press('브러시 연필');   // 고르면 선택판이 스스로 닫힌다(45.25)
    await dragSize('브러시 굵기', 400, 390);
    await press('색'); await press('최근 색 #54A9E8');
    await press('문구');
    await act(async () => tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === '문구 내용')[0].props.onChangeText('좋아'));
    taps++; await act(async () => tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === '문구 내용')[0].props.onSubmitEditing());
    drags++; scene = { ...scene, caption: { ...lastCommand('caption').caption, dx: 20 }, captionPicked: true }; await message(scene); // 캔버스에서 글씨 끌기(엔진 검사는 gesture-test)
    await press('완성 후 다음'); await saved(true);
  });
  await ready();
  const flowB = await bench(async () => {
    await press('이전 칸 그림으로 시작'); await act(async () => {});
    scene = { ...scene, dirty: true, undo: true }; await message(scene);
    await press('문구');
    await act(async () => tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === '문구 내용')[0].props.onChangeText('고마워'));
    taps++; await act(async () => tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === '문구 내용')[0].props.onSubmitEditing());
    scene = { ...scene, caption: lastCommand('caption').caption, captionPicked: true }; await message(scene);
    await press('움직이기'); await press('직전 칸 움직임 다시 쓰기');
    scene = { ...scene, motion: lastCommand('motion').motion }; await message(scene);
    await press('완성 후 다음'); await saved(true);
  });
  console.log('  FLOW A(다음 칸·붓·굵기·최근 색·문구 배치): 누르기 ' + flowA.taps + ' · 끌기 ' + flowA.drags + ' · 확인창 ' + flowA.modals);
  console.log('  FLOW B(다음 칸·문구 고치기·직전 움직임): 누르기 ' + flowB.taps + ' · 끌기 ' + flowB.drags + ' · 확인창 ' + flowB.modals);
  assert.ok(flowA.taps <= 11 && flowA.drags <= 2 && flowA.modals === 0, 'FLOW A 가 늘어나지 않는다: ' + JSON.stringify(flowA));
  assert.ok(flowB.taps <= 7 && flowB.drags === 0 && flowB.modals === 0, 'FLOW B 가 늘어나지 않는다: ' + JSON.stringify(flowB));
  await ready();
  await press('그리기 닫기'); await saved(false);

  // ── 실행 배경: 검은 화면 원인(투명 스플래시 비트맵) 재발 방지 ─────────────────────────────
  const launch = require('../plugins/withLaunchBackground.js');
  const template = '<resources>\n  <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">\n    <item name="android:windowBackground">@color/activityBackground</item>\n  </style>\n  <style name="Theme.App.SplashScreen" parent="AppTheme">\n    <item name="android:windowBackground">@drawable/splashscreen_logo</item>\n  </style>\n</resources>';
  assert.ok(!/SplashScreen[\s\S]*splashscreen_logo/.test(launch.applyToStylesXml(template)), '실행 창 배경이 투명 비트맵이 아니다');
  assert.ok(/SplashScreen[\s\S]*windowBackground">@color\/activityBackground/.test(launch.applyToStylesXml(template)), '실행 창 배경은 앱의 밝은 색');
  const parsed = launch.applyLaunchBackground({ resources: { style: [{ $: { name: 'Theme.App.SplashScreen' }, item: [{ $: { name: 'android:windowBackground' }, _: '@drawable/splashscreen_logo' }] }] } });
  assert.deepEqual(parsed.resources.style[0].item, [{ $: { name: 'android:windowBackground' }, _: '@color/activityBackground' }], 'prebuild 모드도 같은 결과');
  assert.ok(require('../app.config.js')().plugins.includes('./plugins/withLaunchBackground'), '스플래시 에셋이 없는 동안 설정에 연결돼 있다');
  if (fs.existsSync('android/app/src/main/res/values/styles.xml')) assert.ok(!/Theme\.App\.SplashScreen[\s\S]*?splashscreen_logo[\s\S]*?<\/style>/.test(fs.readFileSync('android/app/src/main/res/values/styles.xml', 'utf8')), '생성된 android/ 에도 반영');
  assert.ok(/body\{margin:0;background:#F4F4F5/.test(fs.readFileSync('src/painter/canvas-html.ts', 'utf8')), '캔버스 WebView 바탕도 밝다');
  const root = tree.root.findAll(n => n.type === 'SafeAreaView')[0];
  // 45.34: 앱 바탕을 흰색에서 옅은 회색으로 내렸다 — 흰 패널이 그 위에 떠 보이게 하기 위해서다.
  // 값을 글자로 박지 않고 토큰과 견준다. 지켜야 할 것은 '뿌리 바탕은 토큰의 앱 바탕'이다.
  assert.equal(root.props.style.backgroundColor, T.bg, '앱 뿌리 화면 바탕은 공통 토큰의 앱 바탕이다');
  assert.notEqual(T.bg, T.paper, '앱 바탕과 패널이 같으면 층이 읽히지 않는다');

  // ── 홈 위계(40차): 브랜드 머리 → 창작 표면(새 이모티콘 만들기) → 최근 작업 ─────────────────────────
  await press('뒤로');
  const home = tree.root.findAll(n => n.type === 'Pressable' && ['새 이모티콘 세트', '새 이모티콘 만들기'].includes(n.props.accessibilityLabel)).map(n => n.props.accessibilityLabel);
  // 명세 H02: 이어하기가 먼저다. 시작 줄은 그 아래에 조용히 선다.
  assert.deepEqual(home, ['새 이모티콘 세트', '새 이모티콘 만들기'], '최근 작업이 시작 줄보다 먼저');
  assert.ok(texts().includes('임티제작소'), '홈 머리는 브랜드가 먼저');
  assert.equal(tree.root.findAll(n => n.props.testID === '홈 알림').length, 0, '알림이 꺼져 있으면 자리도 없다');
  const page = tree.root.findAll(n => n.type === 'ScrollView' && Array.isArray(n.props.contentContainerStyle))[0];
  assert.ok(page && Object.assign({}, ...page.props.contentContainerStyle.filter(Boolean)).flexGrow === 1, '홈은 화면 높이를 채워 아래 행동을 바닥에 둔다');

  // ── 45.1차: 가이드 힌트는 고른 그 칸의 것이고, 적용하지 않은 문구는 저장과 함께 확정된다 ─────────────
  await press('표현 가이드');
  await press('안녕 · 손 크게 흔들기');
  // 45.19 에셋 삽입 뒤: 감정을 고르면 그 감정의 표현 목록이 먼저 펼쳐진다(확정된 흐름).
  assert.equal(tree.root.findAll(n => n.props.testID === '표현 예시 목록').length, 1, '감정을 고르면 표현 목록이 펼쳐진다');
  await press('손 흔들며 고르기');
  await press('참고 보기');
  assert.equal(tree.root.findAllByType('WebView').length, 1, '표현을 고르면 그리기 화면이 열린다');
  await ready();
  // 45.25: 고른 표현은 캔버스 밖 참고 자리가 들고 간다. 예전의 캔버스 위 한 줄 토스트는 같은 말이 두 번 서지 않게 물러난다.
  const guideLine = () => tree.root.findAll(n => n.type === 'Text' && [n.props.children].flat(9).filter(x => typeof x === 'string').join('').includes('손 크게 흔들기'));
  const refSpotOf = () => tree.root.findAll(n => n.props.testID === '표현 예시 참고 자리');
  assert.equal(refSpotOf().length, 1, '고른 표현이 캔버스 밖 참고 자리로 따라온다');
  assert.ok(tree.root.findAll(n => n.type === 'Text' && [n.props.children].flat(9).filter(x => typeof x === 'string').join('').includes('안녕 · ')).length >= 1, '무엇을 고른 것인지 그 자리에 적혀 있다');
  assert.equal(guideLine().length, 0, '같은 말을 캔버스 위에 또 띄우지 않는다');
  await press('문구');
  await act(async () => tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === '문구 내용')[0].props.onChangeText('안 눌렀어'));
  await press('완성 후 다음');
  assert.equal(lastCommand('caption').caption.text, '안 눌렀어', '적용을 누르지 않아도 저장 전에 문구가 캔버스로 확정된다');
  await saved(true);
  assert.equal(refSpotOf().length, 0, '다음 칸으로 넘어가면 참고 자리가 따라오지 않는다');
  // 다음 칸은 아직 캔버스가 준비되기 전이라 닫기는 저장 없이 바로 끝난다.
  await press('그리기 닫기');
  await press('뒤로');

  // ── 8. 글자 기호를 아이콘 대신 쓰지 않는다(소스) ─────────────────────────────────────────
  for (const file of ['App.tsx', 'src/painter/painter.tsx', 'src/painter/motion-panel.tsx']) {
    const src = fs.readFileSync(file, 'utf8');
    const glyphs = [...src.matchAll(/>\s*[‹›⋯↶↷☰▶＋×]\s*</g), ...src.matchAll(/glyph="/g), ...src.matchAll(/'[☰▶＋] /g)].map(m => m[0]);
    assert.deepEqual(glyphs, [], file + ': 글자 기호를 아이콘 대신 쓰지 않는다');
  }
  await act(async () => tree.unmount());
  console.log('PASS: product ux — 도구 다시 누르기=설정·"펜" 이중 의미 없음, 브러시·색·움직이기 패널 자물쇠 0·PRO 표시 ≤1, 참고·문구·움직이기 입구 하나·저장 버튼 없음, 새 칸·재시작에서 선 종류·굵기·지우개·보정·도구 유지, 빈 칸 이전 그림 이어받기(확인창 없음), 가짜 재생 막대 없음·효과 견본이 실제로 움직임·설정은 고른 뒤, PRO(부분 움직임·여러 칸 한 번에)는 시작 전에 안내, FREE 흐름(브러시·색·문구·움직임·완성·보드·내보내기)에 결제 화면 없음, 열었다 닫기만 하면 세트 불변, 결과 우선 내보내기와 약속 문구 일치, 개발자 문구·오류 원문·글자 기호 없음. Native/WebView mocked.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
