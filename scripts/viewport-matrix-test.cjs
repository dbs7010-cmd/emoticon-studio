// 화면 높이·폭 매트릭스 검사(Round 39). 실제 App 을 그리고, 기기가 줄 레이아웃 크기(onLayout)를 넣은 뒤
// 렌더된 스타일 값으로 충돌·잘림·캔버스 가시 면적을 판정한다. 픽셀 렌더링은 아니다 — 그건 실기기가 맡는다.
//   높이 640 · 720 · 800 · 900(+) × 폭 360 · 390 · 412
//   Painter 기본 · 브러시 시트 · 색 · 문구(키보드) · 움직이기 · 참고 · 레이어 · 보드 · 내보내기
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
const viewport = { width: 390, height: 844 };
const keyboardListeners = {};
const commands = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n]));
Object.assign(rn, { Keyboard: { addListener: (name, fn) => { (keyboardListeners[name] = keyboardListeners[name] || []).push(fn); return { remove() { keyboardListeners[name] = keyboardListeners[name].filter(f => f !== fn); } }; }, dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ ...viewport }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} }, Linking: { openURL: async () => {} } });
const png = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(360, 16); png.writeUInt32BE(360, 20);
const pngData = 'data:image/png;base64,' + png.toString('base64');
const mocks = {
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-constants': { default: { expoConfig: { extra: {} } } }, 'react-native-webview': { WebView },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => {} }, 'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  './src/components/image-analyzer': { ImageAnalyzer: () => null },
  './src/components/extra-composer': { ExtraComposer: React.forwardRef(() => null), placeInFrame: () => ({ x: 0, y: 0, w: 1, h: 1 }) },
  './src/components/motion-baker': { MotionBaker: React.forwardRef(() => null) },
};
const images = { dataUrl: async () => pngData, pickImages: async () => [], savePainterWork: (...a) => loader(mocks)('src/services/images.ts').savePainterWork(...a), saveCutout: () => ({}), saveMotionLoop: () => ({ path: 'moving.gif', width: 360, height: 360 }), saveSubmitLoop: () => undefined };
const load = loader({ ...mocks, './src/services/images': images, '../services/images': images });
const { createProject } = load('src/project.ts');
const { saveStore } = load('src/services/storage.ts');
const App = load('App.tsx').default;
const { BASE_H } = load('src/painter/painter.tsx');

let tree;
const labelled = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const press = async label => { const m = labelled(label); assert.equal(m.length, 1, 'button ' + label + ' (' + m.length + ') at ' + JSON.stringify(viewport)); await act(async () => m[0].props.onPress()); };
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
const flat = style => Object.assign({}, ...[style].flat(9).filter(Boolean));
const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
const HEADER = 52, TABS = 48, STATUS = 24, NAV = 0; // 안드로이드 제스처 내비·상태바(인셋은 SafeArea 가 뺀다고 보고 보수적으로 상태바만 뺀다)

async function openPainter() {
  await act(async () => { tree = create(React.createElement(App)); });
  await press('매트릭스 세트 이어서 만들기');
  await message({ type: 'ready' });
  const init = sent().filter(m => m.type === 'init').at(-1);
  await message({ type: 'state', undo: true, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null, caption: { text: '고마워요', place: 'bottom', color: '#242424' }, layers: init.layers.map(l => ({ id: l.id, name: l.name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 })), references: [] });
  await message({ type: 'initialized' });
  // 기기가 주는 캔버스 영역 크기: 화면 - 상태바 - 머리 - 탭 - 기본 도구 줄.
  const area = { width: viewport.width, height: viewport.height - STATUS - NAV - HEADER - TABS - BASE_H };
  const container = tree.root.findAll(n => n.type === 'View' && typeof n.props.onLayout === 'function' && !Array.isArray(n.props.style) && n.props.style?.flex === 1)[0];
  await act(async () => container.props.onLayout({ nativeEvent: { layout: area } }));
  return area;
}
const dockHeight = () => {
  // 패널은 기본 도구 줄 위(bottom: BASE_H) 또는 화면 바닥(움직이기·키보드)에 붙는다. 렌더된 높이/최대 높이를 읽는다.
  const docks = tree.root.findAll(n => n.type === 'View' && flat(n.props.style).position === 'absolute' && flat(n.props.style).zIndex === 20);
  if (!docks.length) return { height: 0, bottom: 0 };
  const style = flat(docks[0].props.style);
  const inner = docks[0].findAll(n => n.type === 'View' && (typeof flat(n.props.style).maxHeight === 'number' || typeof flat(n.props.style).height === 'number'));
  const h = typeof style.height === 'number' ? style.height : Math.max(0, ...inner.map(n => flat(n.props.style).maxHeight ?? flat(n.props.style).height ?? 0));
  return { height: h, bottom: style.bottom ?? 0 };
};

const rows = [];
(async () => {
  const p = createProject('매트릭스 세트', '콩이');
  p.slots = p.slots.map((s, i) => i < 3 ? { ...s, finalImage: { path: 'image-a.png', width: 360, height: 360 }, done: true } : s);
  const heights = [640, 720, 800, 900, 1000];
  const widths = [360, 390, 412];
  for (const height of heights) for (const width of widths) {
    viewport.width = width; viewport.height = height;
    files.clear();
    saveStore({ version: 1, revision: 1, projects: [p], palette: ['#54A9E8', '#E94F4F'] });
    const area = await openPainter();
    const side = Math.min(area.width, area.height);
    const screen = height - STATUS - NAV;
    const row = { viewport: `${width}×${height}`, canvas: side, canvasShare: +(side * side / (width * screen)).toFixed(2) };
    const tag = `${width}×${height}`;
    // 기본 Painter: 캔버스가 한 변 280dp 이상, 굵기 조절이 캔버스 안.
    assert.ok(side >= 280, tag + ': 캔버스 한 변 280dp 이상, got ' + side);
    const sizer = tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === '브러시 굵기')[0];
    assert.ok(sizer, tag + ': 굵기 조절');
    assert.ok(flat(sizer.props.style).height <= side, tag + ': 굵기 조절이 캔버스 높이 안');
    assert.ok(flat(sizer.props.style).width >= 40, tag + ': 굵기 조절 손가락 폭 40dp');
    // 기본 도구 줄: 두 줄(48dp) + 여백이 BASE_H 안에 들어간다 — 완성 버튼이 잘리지 않는다.
    assert.ok(6 + 48 + 6 + 48 <= BASE_H, tag + ': 기본 도구 줄 두 줄이 잘리지 않는다');
    for (const l of ['브러시', '지우개', '채우기', '선택', '색', '되돌리기', '다시 실행', '완성 후 다음']) assert.equal(labelled(l).length, 1, tag + ': ' + l);
    // 각 패널이 가리는 캔버스 비율(패널 높이 - 캔버스 아래 남는 자리) / 캔버스 높이.
    const below = Math.max(0, (area.height - side) / 2);
    const covered = h => +(Math.max(0, h - below) / side).toFixed(2);
    await press('브러시'); row.brush = covered(dockHeight().height);
    assert.equal(labelled('펜').length + labelled('붓').length + labelled('연필').length, 3, tag + ': 브러시 시트 선 종류');
    await press('세부 설정'); row.brushDetail = covered(dockHeight().height);
    await press('브러시 닫기');
    await press('색'); row.color = covered(dockHeight().height);
    assert.ok(tree.root.findAll(n => n.props.testID === '최근 색').length === 1, tag + ': 최근 색이 색 패널 맨 위');
    await press('팔레트 닫기');
    await press('참고'); row.reference = covered(80); await press('참고');
    await press('레이어'); row.layers = covered(dockHeight().height || 216); await press('레이어');
    // 문구 + 키보드(화면 높이의 40%): 입력칸과 적용 버튼이 키보드 위에 남는가.
    await press('문구');
    const keyboard = Math.round(height * .4);
    await act(async () => { for (const fn of keyboardListeners.keyboardDidShow || []) fn({ endCoordinates: { height: keyboard } }); });
    const captionPanel = dockHeight().height;
    const aboveKeyboard = screen - keyboard - HEADER - TABS;
    row.captionKeyboardRoom = aboveKeyboard;
    assert.ok(captionPanel <= aboveKeyboard, tag + ': 키보드가 올라와도 문구 패널(' + captionPanel + ')이 남은 자리(' + aboveKeyboard + ') 안');
    assert.equal(labelled('문구 적용').length, 1, tag + ': 적용 버튼이 남는다');
    await act(async () => { for (const fn of keyboardListeners.keyboardDidHide || []) fn({}); });
    await press('문구 닫기');
    // 움직이기: 캔버스를 위로 붙이고 패널은 아래 — 가리는 비율.
    await press('움직이기');
    const motion = dockHeight().height;
    row.motion = +(Math.max(0, motion - BASE_H - (area.height - side)) / side).toFixed(2);
    assert.ok(row.motion < .45, tag + ': 움직이기 패널이 캔버스를 45% 넘게 덮지 않는다: ' + row.motion);
    assert.equal(labelled('완성 후 다음').length, 1, tag + ': 움직이기에서도 완성 버튼');
    await press('그리기');
    // 보드·내보내기: 격자 세 칸이 폭 안, 내보내기 결과 격자 칸 크기.
    await press('그리기 닫기');
    await message({ type: 'save', dirty: false, data: pngData, metrics: { coverage: .2 }, activeLayerId: 'draw-1', layers: [], references: [] });
    const tile = tree.root.findAll(n => n.type === 'Pressable' && n.props.testID === 'slot-1')[0];
    assert.ok(tile && flat(tile.props.style).width * 3 + 16 <= width - 32 + .01, tag + ': 보드 격자 세 칸');
    row.boardTile = Math.round(flat(tile.props.style).width);
    const dockActions = tree.root.findAll(n => n.props.testID === 'board-action-dock')[0].findAll(n => n.type === 'Pressable').map(n => n.props.accessibilityLabel);
    assert.deepEqual(dockActions, ['이어서 그리기', '내보내기'], tag + ': 보드 아래 줄');
    await press('내보내기');
    const cells = tree.root.findAll(n => n.props.testID === '결과 격자')[0].findAll(n => n.type === 'Pressable');
    row.exportCell = flat(cells[0].props.style).width;
    assert.ok(row.exportCell >= 44, tag + ': 결과 격자 칸이 누를 수 있는 크기');
    assert.ok(row.exportCell * 6 + 6 * 5 <= width - 32 + .01, tag + ': 결과 격자가 폭 안');
    await act(async () => tree.unmount());
    // 브러시·색·참고·레이어 시트도 캔버스를 절반 넘게 가리지 않는다(결과를 보면서 조절).
    for (const key of ['brush', 'color', 'reference', 'layers']) assert.ok(row[key] <= .5, tag + ': ' + key + ' 패널이 캔버스를 절반 넘게 가리지 않는다: ' + row[key]);
    rows.push(row);
  }
  const outDir = 'verification/round39';
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outDir + '/viewport-matrix.json', JSON.stringify(rows, null, 2));
  console.log('  viewport  canvas share brush detail color ref layers motion kbRoom boardTile exportCell');
  for (const r of rows) console.log('  ' + [r.viewport.padEnd(9), String(r.canvas).padStart(6), String(r.canvasShare).padStart(5), r.brush, r.brushDetail, r.color, r.reference, r.layers, r.motion, r.captionKeyboardRoom, r.boardTile, r.exportCell].join('  '));
  console.log('PASS: viewport matrix — 640/720/800/900/1000 × 360/390/412: 캔버스 280dp 이상, 굵기 조절 캔버스 안·40dp, 도구 줄 두 줄 안 잘림, 브러시·색·참고·레이어 패널 캔버스 절반 이하, 문구 패널이 키보드 위, 움직이기 패널 45% 미만 겹침, 보드 세 칸·아래 줄, 내보내기 결과 격자. 렌더 스타일 + 기기 레이아웃 크기 기준(픽셀 렌더링 아님).');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
