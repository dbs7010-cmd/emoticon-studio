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
  'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'bundled://art', uri: 'bundled://art' }) }) } }, 'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-constants': { default: { expoConfig: { extra: {} } } }, 'react-native-webview': { WebView },
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
const { BASE_H, RAIL_W } = load('src/painter/painter.tsx');

let tree;
const labelled = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
// 부품(RailBubble 처럼)에 testID 를 넘기면 부품 자체와 그 안의 View 가 둘 다 잡힌다. 실제 상자만 센다.
const byTestID = id => tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === id);
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
  // 기기가 주는 캔버스 영역 크기: 화면 - 상태바 - 머리 - 탭 - 기본 도구 줄, 그리고 가로에서는
  // 왼쪽 세로 조절대의 기둥(45.35 승인 시안)을 뺀다.
  const area = { width: viewport.width - RAIL_W, height: viewport.height - STATUS - NAV - HEADER - TABS - BASE_H };
  const container = tree.root.findAll(n => n.type === 'View' && n.props.testID === '캔버스 영역')[0];
  await act(async () => container.props.onLayout({ nativeEvent: { layout: area } }));
  return area;
}
const motionHeightOf = () => {
  const dock = tree.root.findAll(n => n.type === 'View' && flat(n.props.style).position === 'absolute' && flat(n.props.style).zIndex === 20)[0];
  return dock ? flat(dock.props.style).height : null;
};
const dockHeight = () => {
  // 패널은 기본 도구 줄 위(bottom: BASE_H) 또는 화면 바닥(움직이기·키보드)에 붙는다. 렌더된 높이/최대 높이를 읽는다.
  const docks = tree.root.findAll(n => n.type === 'View' && flat(n.props.style).position === 'absolute' && flat(n.props.style).zIndex === 20);
  if (!docks.length) return { height: 0, bottom: 0 };
  const style = flat(docks[0].props.style);
  const inner = docks[0].findAll(n => n.type === 'View' && (typeof flat(n.props.style).maxHeight === 'number' || typeof flat(n.props.style).height === 'number'));
  const h = typeof style.height === 'number' ? style.height : Math.max(0, ...inner.map(n => flat(n.props.style).maxHeight ?? flat(n.props.style).height ?? 0));
  return { height: h, bottom: style.bottom ?? 0 };
};


// ── 글자 배율(안드로이드 '글자 크기' 설정) ────────────────────────────────────────────────────
// RN 은 allowFontScaling 을 끄지 않는 한 fontSize 에 배율을 곱한다. 높이가 못 박힌 상자 안에서는
// 글자가 늘어나도 상자가 늘지 않아 잘린다. 여기서는 렌더된 스타일로 그 조건만 찾는다.
// **실기기 캡처가 아니다** — 실제 줄바꿈·글꼴 메트릭은 기기가 판정한다.
const textOf = n => [n.props.children].flat(9).filter(x => typeof x === 'string' || typeof x === 'number').join('');
function clipped(scale) {
  const out = [];
  for (const node of tree.root.findAll(n => n.type === 'Text')) {
    const st = flat(node.props.style);
    if (typeof st.fontSize !== 'number') continue;
    if (node.props.allowFontScaling === false) continue;
    const lines = node.props.numberOfLines ?? 1;
    const need = Math.ceil((st.lineHeight ?? st.fontSize * 1.3) * scale) * lines;
    // 이 글자를 감싸는 가장 가까운 '높이가 못 박힌' 상자를 찾는다. minHeight 는 늘어나므로 넘긴다.
    for (let p = node.parent; p; p = p.parent) {
      if (p.type !== 'View' && p.type !== 'Pressable') continue;
      const ps = flat(typeof p.props.style === 'function' ? p.props.style({ pressed: false }) : p.props.style);
      if (typeof ps.height !== 'number') { if (typeof ps.minHeight === 'number' || ps.flex) break; continue; }
      const pad = (ps.paddingVertical ?? ps.padding ?? 0) * 2;
      if (need > ps.height - pad + .01) out.push({ text: textOf(node).slice(0, 18), fontSize: st.fontSize, need, box: ps.height });
      break;
    }
  }
  return out;
}

const rows = [];
(async () => {
  const p = createProject('매트릭스 세트', '콩이');
  p.slots = p.slots.map((s, i) => i < 3 ? { ...s, finalImage: { path: 'image-a.png', width: 360, height: 360 }, done: true } : s);
  const heights = [640, 720, 800, 900, 1000];
  const widths = [320, 360, 390, 412];
  for (const height of heights) for (const width of widths) {
    viewport.width = width; viewport.height = height;
    files.clear();
    saveStore({ version: 1, revision: 1, projects: [p], palette: ['#54A9E8', '#E94F4F'] });
    const area = await openPainter();
    const side = Math.min(area.width, area.height);
    const screen = height - STATUS - NAV;
    const row = { viewport: `${width}×${height}`, canvas: side, canvasShare: +(side * side / (width * screen)).toFixed(2) };
    const tag = `${width}×${height}`;
    // 기본 Painter: 캔버스 한 변은 280dp 이상, 다만 **가로가 그것을 허락할 때**다.
    // 45.35 승인 시안이 캔버스 왼쪽에 조절대 기둥을 세웠으므로, 정사각 캔버스의 한 변은
    // 아무리 커도 (화면 폭 - 기둥) 을 넘을 수 없다. 320dp 화면에서는 그 값이 256dp 다 —
    // 기하학적 상한이지 결함이 아니다. 손가락 자리(기둥 48dp·도구 48dp)는 어디서도 줄이지 않았다.
    const floor = Math.min(280, viewport.width - RAIL_W);
    assert.ok(side >= floor, tag + ': 캔버스 한 변 ' + floor + 'dp 이상, got ' + side);
    // 45.35 승인 시안: 굵기와 불투명도는 캔버스 **왼쪽 밖** 기둥에서 세로로 끈다.
    // 캔버스 위에 겹치지 않고, 손가락이 닿는 폭을 갖고, 화면에 하나뿐이다.
    const sizer = tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === '브러시 굵기')[0];
    assert.ok(sizer, tag + ': 굵기 조절대');
    const bandStyle = flat(sizer.props.style);
    assert.equal(bandStyle.flex, 1, tag + ': 조절대는 기둥의 남는 높이를 다 쓴다');
    assert.notEqual(bandStyle.position, 'absolute', tag + ': 캔버스 위에 겹치지 않는다');
    const rail = byTestID('조절대')[0];
    assert.ok(rail, tag + ': 왼쪽 기둥');
    const railStyle = flat(rail.props.style);
    // 기둥 폭에서 안쪽 여백을 뺀 것이 실제로 손가락이 닿는 폭이다.
    assert.ok(railStyle.width - (railStyle.paddingLeft ?? 0) >= 48, tag + ': 조절대는 손가락이 닿는 폭이다: ' + (railStyle.width - (railStyle.paddingLeft ?? 0)));
    assert.equal(rail.findAll(n => n.props.accessibilityRole === 'adjustable').length, 2, tag + ': 기둥에는 굵기와 불투명도 둘뿐이다');
    const canvasFrame = tree.root.findAll(n => n.type === 'View' && n.props.collapsable === false)[0];
    assert.equal(canvasFrame.findAll(n => n.props.accessibilityLabel === '브러시 굵기').length, 0, tag + ': 캔버스 틀 안에 조절대가 없다');
    assert.equal(byTestID('굵기 말풍선').length, 1, tag + ': 굵기는 손잡이 옆에서 숫자로도 말한다');
    assert.equal(byTestID('굵기 미리보기').length, 0, tag + ': 캔버스 한가운데 검은 상자는 없다');
    const canvasArea = byTestID('캔버스 영역')[0];
    assert.equal(canvasArea.findAll(n => n.props.accessibilityLabel === '브러시 굵기').length, 0, tag + ': 굵기 조절대는 캔버스 영역 밖에 있다');
    assert.equal(tree.root.findAll(n => n.props.accessibilityLabel === '브러시 굵기').length, 1, tag + ': 조절대는 화면에 하나');
    // 기본 도구 줄 두 줄(즐겨찾기 62 + 도구 52)과 줄 사이 여백이 BASE_H 안에 들어간다 — 아래가 잘리지 않는다.
    assert.ok(6 + 62 + 6 + 52 <= BASE_H, tag + ': 기본 도구 줄 두 줄이 잘리지 않는다');
    for (const l of ['그리기 도구 펜', '지우개', '채우기', '선택', '색', '브러시 전체', '되돌리기', '다시 실행', '완성 후 다음']) assert.equal(labelled(l).length, 1, tag + ': ' + l);
    assert.equal(byTestID('빠른 브러시')[0].findAll(n => n.type === 'Pressable' && n.props.testID).length, 3, tag + ': 빠른 브러시 카드 셋');
    // 각 패널이 가리는 캔버스 비율(패널 높이 - 캔버스 아래 남는 자리) / 캔버스 높이.
    const below = Math.max(0, (area.height - side) / 2);
    const covered = h => +(Math.max(0, h - below) / side).toFixed(2);
    // 브러시 창은 아래에서 올라오는 판이 아니라 화면을 덮는 독립 창이다(45.35). 창 높이로 잰다.
    await press('브러시 전체');
    const brushWindow = byTestID('브러시 창')[0];
    assert.ok(brushWindow, tag + ': 브러시 창');
    const winH = flat(brushWindow.props.style).height;
    row.brush = covered(winH);
    // 보통 세로 화면에서 줄 넷이 통째로 보인다: 머리(48) + 분류(48) + 줄 70×4 + 세부 설정 줄(48).
    assert.ok(winH >= 48 + 48 + 70 * 4, tag + ': 브러시 창에 네 줄이 들어간다: ' + winH);
    assert.ok(winH <= screen - 16, tag + ': 브러시 창이 화면을 넘지 않는다: ' + winH);
    let listed = 0;
    for (const g of ['선', '채색', '질감', '효과']) {
      await press('브러시 분류 ' + g);
      listed += byTestID('브러시 목록')[0].findAll(n => n.type === 'Pressable' && /^브러시 /.test(n.props.accessibilityLabel ?? '')).length;
    }
    assert.equal(listed, 30, tag + ': 네 갈래를 합치면 무료 10 + PRO 20');
    await press('세부 설정');
    row.brushDetail = covered(flat(byTestID('브러시 창')[0].props.style).height);
    assert.equal(row.brushDetail, row.brush, tag + ': 세부 설정으로 들어가도 창 크기가 그대로다');
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
    // 45.28: 완성은 머리줄 하나뿐이다 — 움직이기 탭의 큰 완성 줄은 없앴다(두 개가 아니다).
    assert.equal(labelled('완성 후 다음').length, 1, tag + ': 움직이기에서도 완성 버튼은 머리줄에 하나');
    // 겹침이 아니라 경계로 본다: 설정 목록은 줄어드는 스크롤이고(flex:1·minHeight:0),
    // 완성은 스크롤 밖 머리줄에 있다. 그래서 목록이 길어져도 완성을 밀어내지 못하고, 끝까지 스크롤로 닿는다.
    const motionScroll = tree.root.findAll(n => n.type === 'ScrollView' && flat(n.props.style).flex === 1);
    assert.equal(motionScroll.length, 1, tag + ': 움직이기 설정 목록은 줄어드는 스크롤 하나');
    assert.equal(flat(motionScroll[0].props.style).minHeight, 0, tag + ': 목록이 내용 높이로 버티지 않는다');
    assert.ok((flat(motionScroll[0].props.contentContainerStyle).paddingBottom ?? 0) >= 12, tag + ': 목록 끝에 여유가 있다');
    const finishRow = tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === '완성 후 다음')[0];
    for (let p = finishRow.parent; p; p = p.parent) assert.notEqual(p.type, 'ScrollView', tag + ': 완성은 스크롤 안에 있으면 안 된다');
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
    // 격자는 줄바꿈한다. 열 수를 못 박는 대신, 한 줄에 다섯 칸 이상이 폭 안에 들어가는지 본다.
    const exportCols = Math.floor((width - 32 + 6) / (row.exportCell + 6));
    assert.ok(exportCols >= 5, tag + ': 결과 격자 한 줄에 다섯 칸 이상(' + exportCols + ')');
    assert.ok(row.exportCell * exportCols + 6 * (exportCols - 1) <= width - 32 + .01, tag + ': 결과 격자가 폭 안');
    await act(async () => tree.unmount());
    // 색·참고·레이어 판은 캔버스를 절반 넘게 가리지 않는다 — 고치는 중인 그림을 보면서 조절해야 하기 때문이다.
    // 브러시 **창**은 여기서 뺀다(45.35 §6). 브러시를 고르는 일은 그림이 아니라 **획 견본**을 보는 일이라,
    // 승인 시안이 넓은 독립 창으로 정했다: 뒤는 가볍게 어두워지고, 줄 넷이 통째로 보일 만큼 큰 창이다.
    // 그 창의 크기 규칙은 위에서 따로 검사한다(네 줄 이상 · 화면 안).
    for (const key of ['color', 'reference', 'layers']) assert.ok(row[key] <= .5, tag + ': ' + key + ' 패널이 캔버스를 절반 넘게 가리지 않는다: ' + row[key]);
    // 색 패널은 안쪽이 스스로 스크롤하므로 더 낮게 세운다 — 엔진이 1배보다 작게 줄이지 못하고 캔버스도 움직일 수 없어,
    // 판을 낮추는 것이 그림을 더 보이게 하는 유일한 길이다(45.24).
    // 45.28: 승인 보드대로 SV 사각(132dp)이 들어오면서, 가장 짧은 화면에서는 판이 최소 높이(160dp)에 걸린다.
    // 그보다 낮추면 사각이 손톱만큼만 보여 쓸 수 없다 — 그래서 640dp급에서만 한도를 48% 로 둔다.
    const colorCap = height <= 660 ? .48 : .45;
    assert.ok(row.color <= colorCap, tag + ': 색 패널은 캔버스를 ' + Math.round(colorCap * 100) + '% 넘게 가리지 않는다: ' + row.color);
    rows.push(row);
  }
  // ── 머리줄: 넘치면 두 줄로 갈린다(글자나 손가락 자리를 줄이지 않는다) ─────────────────────────
  viewport.width = 320; viewport.height = 800;
  files.clear();
  saveStore({ version: 1, revision: 1, projects: [p], palette: ['#54A9E8'] });
  await openPainter();
  const headOf = () => tree.root.findAll(n => n.type === 'View' && typeof n.props.onLayout === 'function' && flat(n.props.style).borderBottomWidth === 1)[0];
  const aidNames = () => ['참고', '레이어', '문구'].map(l => labelled(l).length);
  assert.deepEqual(aidNames(), [1, 1, 1], '보조 셋이 모두 있다');
  const rowsIn = head => head.findAll(n => n.type === 'View' && flat(n.props.style).flexDirection === 'row' && n.parent === head).length;
  // 아직 아무것도 재지 않았으면 예전처럼 한 줄이다.
  assert.equal(rowsIn(headOf()), 1, '재기 전에는 한 줄');
  // 한 번 그릴 때마다 노드가 새로 생기므로 그때그때 다시 찾아 보낸다.
  const measure = async (headWidth, tabsWidth, aidsWidth) => {
    for (const [pick, width] of [[h => h, headWidth], [h => h.findAll(n => n.type === 'View' && typeof n.props.onLayout === 'function' && n !== h)[0], tabsWidth],
                                 [h => h.findAll(n => n.type === 'View' && typeof n.props.onLayout === 'function' && n !== h)[1], aidsWidth]]) {
      const node = pick(headOf());
      if (!node) continue;
      const fn = node.props.onLayout;
      await act(async () => { fn({ nativeEvent: { layout: { width, height: 48 } } }); });
    }
  };
  // 넉넉하면 한 줄 그대로.
  await measure(320, 120, 150);
  assert.equal(rowsIn(headOf()), 1, '들어가면 한 줄을 지킨다');
  assert.deepEqual(aidNames(), [1, 1, 1], '한 줄에서도 보조 셋이 그대로');
  // 넘치면 두 줄. 글자 크기나 손가락 자리는 그대로여야 한다.
  const tapBefore = ['참고', '레이어', '문구'].map(l => flat(labelled(l)[0].props.style).minHeight);
  await measure(320, 200, 180);
  assert.equal(rowsIn(headOf()), 2, '넘치면 두 줄로 갈린다');
  assert.deepEqual(aidNames(), [1, 1, 1], '두 줄이 되어도 보조 셋은 그대로 하나씩');
  assert.deepEqual(['참고', '레이어', '문구'].map(l => flat(labelled(l)[0].props.style).minHeight), tapBefore, '두 줄로 가도 손가락 자리를 줄이지 않는다');
  assert.deepEqual(tapBefore, [48, 48, 48], '보조 도구 손가락 자리 48dp');
  await act(async () => tree.unmount());
  console.log('  머리줄 — 들어가면 한 줄 · 넘치면 두 줄 · 손가락 자리 48dp 불변');

  // ── 글자 배율 1.0 / 1.3 / 1.5 ────────────────────────────────────────────────────────────
  const scaleRows = [];
  for (const width of [320, 360, 390, 412]) {
    viewport.width = width; viewport.height = 800;
    files.clear();
    saveStore({ version: 1, revision: 1, projects: [p], palette: ['#54A9E8'] });
    await act(async () => { tree = create(React.createElement(App)); });
    // 홈 → 그리기 → 보드 → 내보내기 순서로 한 번씩 훑는다. 여는 데 실패하면 press 가 바로 멈춘다.
    const screens = [
      ['홈', async () => {}],
      ['그리기', async () => { await press('매트릭스 세트 이어서 만들기'); }],
      ['보드', async () => { await press('그리기 닫기'); }],
      ['내보내기', async () => { await press('내보내기'); }],
    ];
    for (const [name, open] of screens) {
      await open();
      for (const scale of [1, 1.3, 1.5]) {
        const bad = clipped(scale);
        const seen = tree.root.findAll(n => n.type === 'Text' && typeof flat(n.props.style).fontSize === 'number').length;
        scaleRows.push({ viewport: width + '×800', screen: name, scale, texts: seen, clipped: bad.length, worst: bad[0] ?? null });
        assert.ok(seen >= 5, width + 'dp ' + name + ': 훑을 글자가 있어야 한다(' + seen + ')');
        assert.equal(bad.length, 0, width + 'dp ' + name + ' 배율 ' + scale + ': 높이가 못 박힌 상자에서 글자가 잘린다 ' + JSON.stringify(bad.slice(0, 3)));
      }
    }
    await act(async () => tree.unmount());
  }
  fs.mkdirSync('verification/round45_23', { recursive: true });
  fs.writeFileSync('verification/round45_23/font-scale.json', JSON.stringify(scaleRows, null, 2));
  for (const name of ['홈', '그리기', '보드', '내보내기'])
    console.log('  글자 배율 ' + name.padEnd(5) + ' — 훑은 글자 ' + scaleRows.filter(r => r.screen === name).reduce((a, r) => Math.max(a, r.texts), 0) + '곳 · 1.0/1.3/1.5 에서 잘림 0곳');
  console.log('  (렌더된 스타일 계산이다. 실기기 캡처가 아니다 — 실제 줄바꿈·글꼴 메트릭은 기기가 판정한다.)');

  const outDir = 'verification/round39';
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outDir + '/viewport-matrix.json', JSON.stringify(rows, null, 2));
  console.log('  viewport  canvas share brush detail color ref layers motion kbRoom boardTile exportCell');
  for (const r of rows) console.log('  ' + [r.viewport.padEnd(9), String(r.canvas).padStart(6), String(r.canvasShare).padStart(5), r.brush, r.brushDetail, r.color, r.reference, r.layers, r.motion, r.captionKeyboardRoom, r.boardTile, r.exportCell].join('  '));
  console.log('PASS: viewport matrix — 640/720/800/900/1000 × 320/360/390/412: 캔버스는 (화면 폭 − 왼쪽 조절대) 까지 정사각으로 꽉 차고, 굵기·불투명도는 캔버스 밖 왼쪽 기둥에 세로로 하나씩, 도구 줄 두 줄 안 잘림, 브러시 창은 줄 넷이 보이는 독립 창, 색·참고·레이어 패널 캔버스 절반 이하, 문구 패널이 키보드 위, 움직이기 패널 45% 미만 겹침·설정 목록만 줄고 완성 줄은 스크롤 밖, 보드 세 칸·아래 줄, 내보내기 결과 격자 한 줄 다섯 칸 이상, 글자 배율 1.0/1.3/1.5 에서 높이 고정 상자 잘림 0곳. 렌더 스타일 + 기기 레이아웃 크기 기준(픽셀 렌더링 아님).');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
