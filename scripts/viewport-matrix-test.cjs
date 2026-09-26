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
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n])); rn.Animated = require('./_rn-animated-mock.cjs');
Object.assign(rn, { Keyboard: { addListener: (name, fn) => { (keyboardListeners[name] = keyboardListeners[name] || []).push(fn); return { remove() { keyboardListeners[name] = keyboardListeners[name].filter(f => f !== fn); } }; }, dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ ...viewport }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} }, Linking: { openURL: async () => {} } });
const png = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(360, 16); png.writeUInt32BE(360, 20);
const pngData = 'data:image/png;base64,' + png.toString('base64');
const mocks = {
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }) },
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
const { BASE_H, BAR_H, RAIL_W, CANVAS_GAP } = load('src/painter/painter.tsx');

let tree;
const labelled = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
// 부품(RailBubble 처럼)에 testID 를 넘기면 부품 자체와 그 안의 View 가 둘 다 잡힌다. 실제 상자만 센다.
const byTestID = id => tree.root.findAll(n => typeof n.type === 'string' && n.props.testID === id);
const press = async label => { const m = labelled(label); assert.equal(m.length, 1, 'button ' + label + ' (' + m.length + ') at ' + JSON.stringify(viewport)); await act(async () => m[0].props.onPress()); };
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
const flat = style => Object.assign(
  {},
  ...[style]
    .flat(9)
    .filter(Boolean)
    .map(value => typeof value === 'function' ? value({ pressed: false }) : value),
);
const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
const HEADER = 52, TABS = 48, STATUS = 24, NAV = 0; // 안드로이드 제스처 내비·상태바(인셋은 SafeArea 가 뺀다고 보고 보수적으로 상태바만 뺀다)

async function openPainter() {
  await act(async () => { tree = create(React.createElement(App)); });
  await press('매트릭스 세트 이어서 만들기');
  await message({ type: 'ready' });
  const init = sent().filter(m => m.type === 'init').at(-1);
  await message({ type: 'state', undo: true, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null, caption: { text: '고마워요', place: 'bottom', color: '#242424' }, layers: init.layers.map(l => ({ id: l.id, name: l.name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 })), references: [] });
  await message({ type: 'initialized' });
  // 기기가 주는 작업면 크기: 화면 - 상태바 - 머리 - 탭 - 기본 도구 줄. 앱은 이것으로 캔버스가 더 커지는 배치를 고른다(45.39):
  // 위 조절 줄이면 캔버스 영역 = 폭 × (높이 - 조절 줄), 옆 조절대면 (폭 - 기둥) × 높이.
  const stage = { width: viewport.width, height: viewport.height - STATUS - NAV - HEADER - TABS - BASE_H };
  await act(async () => tree.root.findAll(n => n.type === 'View' && n.props.testID === '작업면')[0].props.onLayout({ nativeEvent: { layout: stage } }));
  const sideBar = Math.floor(Math.min(stage.width, stage.height - BAR_H) - CANVAS_GAP * 2), sideRail = Math.floor(Math.min(stage.width - RAIL_W, stage.height) - CANVAS_GAP * 2);
  const rail = sideRail > sideBar;
  const area = rail ? { width: stage.width - RAIL_W, height: stage.height, rail, sideBar, sideRail } : { width: stage.width, height: stage.height - BAR_H, rail, sideBar, sideRail };
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
  // 568 은 지시서의 가장 작은 화면(320×568)이다. 45.36 까지 이 높이가 빠져 있어, 그 화면의 브러시 창 줄 수를 아무도 재지 않았다.
const heights = [568, 640, 720, 800, 900, 1000];
  const rows45 = [];
  const widths = [320, 360, 390, 412];
  for (const height of heights) for (const width of widths) {
    viewport.width = width; viewport.height = height;
    files.clear();
    saveStore({ version: 1, revision: 1, projects: [p], palette: ['#54A9E8', '#E94F4F'] });
    const area = await openPainter();
    const side = Math.min(area.width, area.height) - CANVAS_GAP * 2;   // 캔버스 둘레 여백(45.37)
    const screen = height - STATUS - NAV;
    const row = { viewport: `${width}×${height}`, canvas: side, canvasShare: +(side * side / (width * screen)).toFixed(2) };
    const tag = `${width}×${height}`;
    // 45.39: 캔버스는 기기가 허락하는 만큼 **최대로** 선다 — 폭과 (영역 높이) 중 작은 쪽에서 둘레 여백만 뺀다.
    // 그리고 45.38(왼쪽 세로 조절대 72dp + 여백 10) 보다 **작아지는 화면은 하나도 없다**.
    const oldSide = Math.floor(Math.min(width - 72, height - STATUS - NAV - HEADER - TABS - BASE_H) - 20);
    assert.equal(side, Math.min(area.width, area.height) - CANVAS_GAP * 2, tag + ': 캔버스는 남는 자리를 꽉 채운다');
    assert.ok(side >= oldSide, tag + ': 45.38 보다 작아지지 않는다 ' + oldSide + ' → ' + side);
    row.before = oldSide;
    // 굵기·불투명도: 캔버스 **위** 조절 줄(대부분의 화면) 또는 세로가 아주 짧은 화면에서만 **옆** 조절대. 둘 중 하나만, 캔버스에 겹치지 않는다.
    row.layout = area.rail ? 'rail' : 'bar';
    assert.equal(side, Math.max(area.sideBar, area.sideRail), tag + ': 더 큰 캔버스를 주는 배치를 골랐다');
    const sizer = tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === '브러시 굵기')[0];
    assert.ok(sizer, tag + ': 굵기 조절');
    const holder = byTestID(area.rail ? '조절대' : '조절 줄')[0];
    assert.ok(holder, tag + ': ' + (area.rail ? '옆 조절대' : '조절 줄'));
    assert.equal(byTestID(area.rail ? '조절 줄' : '조절대').length, 0, tag + ': 다른 배치는 그리지 않는다');
    assert.equal(holder.findAll(n => n.props.accessibilityRole === 'adjustable').length, 2, tag + ': 굵기와 불투명도 둘뿐이다');
    if (!area.rail) {
      assert.equal(flat(holder.props.style).height, BAR_H, tag + ': 조절 줄 높이는 두 탭 모두 같다');
      assert.ok(BAR_H >= 44, tag + ': 조절 줄은 손가락이 닿는 높이다');
      assert.equal(flat(sizer.props.style).height, BAR_H, tag + ': 굵기 막대는 줄 높이 전체가 누르는 자리다');
    } else {
      assert.ok(flat(holder.props.style).width - (flat(holder.props.style).paddingLeft ?? 0) >= 48, tag + ': 옆 조절대는 손가락이 닿는 폭이다');
    }
    const canvasFrame = tree.root.findAll(n => n.type === 'View' && n.props.collapsable === false)[0];
    assert.equal(canvasFrame.findAll(n => n.props.accessibilityLabel === '브러시 굵기').length, 0, tag + ': 캔버스 틀 안에 조절이 없다');
    const canvasArea = byTestID('캔버스 영역')[0];
    assert.equal(canvasArea.findAll(n => n.props.accessibilityLabel === '브러시 굵기').length, 0, tag + ': 굵기 조절은 캔버스 영역 밖에 있다');
    assert.equal(flat(canvasArea.props.style).justifyContent, 'center', tag + ': 그리기 탭 캔버스는 세로 가운데');
    rows45.push(tag + ' ' + row.layout + ' ' + oldSide + '→' + side);
    assert.equal(tree.root.findAll(n => n.props.accessibilityLabel === '브러시 굵기').length, 1, tag + ': 굵기 조절은 화면에 하나');
    assert.equal(byTestID('굵기 미리보기').length, 0, tag + ': 캔버스 한가운데 검은 상자는 없다');
    // 캔버스 바깥 여백의 두 손가락 톡 = 되돌리기, 세 손가락 톡 = 다시 실행. 끌면 톡이 아니다.
    {
      const margin = () => byTestID('캔버스 여백')[0];
      assert.ok(margin(), tag + ': 캔버스 여백이 손가락을 받는다');
      const t = (n, x = 10) => ({ nativeEvent: { touches: Array.from({ length: n }, () => ({ pageX: x, pageY: 10 })), pageX: x, pageY: 10 } });
      const tap = async n => {
        await act(async () => margin().props.onTouchStart(t(1)));
        for (let k = 2; k <= n; k++) await act(async () => margin().props.onTouchStart(t(k)));
        await act(async () => margin().props.onTouchEnd(t(0)));
      };
      const undos = () => sent().filter(m => m.type === 'undo').length;
      const before = undos();
      await tap(2);
      assert.equal(undos(), before + 1, tag + ': 여백에서 두 손가락 톡 → 되돌리기');
      await act(async () => margin().props.onTouchStart(t(1)));
      await act(async () => margin().props.onTouchStart(t(2)));
      await act(async () => margin().props.onTouchMove(t(2, 60)));
      await act(async () => margin().props.onTouchEnd(t(0)));
      assert.equal(undos(), before + 1, tag + ': 두 손가락으로 끌면 되돌리지 않는다');
      await tap(1);
      assert.equal(undos(), before + 1, tag + ': 한 손가락 톡은 아무 일도 하지 않는다');
    }
    // 기본 도구 줄 두 줄(즐겨찾기 62 + 도구 52)과 줄 사이 여백이 BASE_H 안에 들어간다 — 아래가 잘리지 않는다.
    assert.ok(6 + 62 + 6 + 52 <= BASE_H, tag + ': 기본 도구 줄 두 줄이 잘리지 않는다');
    for (const l of ['그리기 도구 펜', '지우개', '채우기', '선택', '색', '브러시 전체', '되돌리기', '다시 실행', '저장']) assert.equal(labelled(l).length, 1, tag + ': ' + l);
    assert.equal(byTestID('빠른 브러시')[0].findAll(n => n.type === 'Pressable' && n.props.testID).length, 3, tag + ': 빠른 브러시 카드 셋');
    // 각 패널이 가리는 캔버스 비율(패널 높이 - 캔버스 아래 남는 자리) / 캔버스 높이.
    const below = Math.max(0, (area.height - side) / 2);   // 그리기 탭은 캔버스가 가운데라 남는 자리의 절반이 아래다(45.37)
    const covered = h => +(Math.max(0, h - below) / side).toFixed(2);
    // 브러시 창은 아래에서 올라오는 판이 아니라 화면을 덮는 독립 창이다(45.35). 창 높이로 잰다.
    await press('브러시 전체');
    const brushWindow = byTestID('브러시 창')[0];
    assert.ok(brushWindow, tag + ': 브러시 창');
    const winH = flat(brushWindow.props.style).height;
    row.brush = covered(winH);
    // 줄 넷이 통째로 보인다: 창 높이에서 머리(48)·분류(48)·세부 설정 입구(48)·편집 안내(24)·여백(8)을 빼고도
    // 브러시 줄 네 개가 남아야 한다. 45.36 까지는 세부 설정 입구를 빼지 않고 셌다(G9).
    const rowH = flat(brushWindow.findAll(n => n.type === 'Pressable' && /^브러시 줄 /.test(n.props.testID ?? ''))[0].props.style).minHeight;
    const listRoom = winH - 48 - 48 - 48 - 24 - 8;
    row.brushRows = +(listRoom / rowH).toFixed(1);
    assert.ok(listRoom >= rowH * 4, tag + ': 브러시 줄 넷이 통째로 보인다: ' + listRoom + ' ≥ ' + rowH * 4);
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
    await press('색');
    const colorDock = dockHeight();
    row.color = covered(Math.max(0, colorDock.height + colorDock.bottom - BASE_H));
    assert.equal(colorDock.bottom, 0, tag + ': 색 패널은 도구 줄 자리까지 쓴다');
    // 45.39: 캔버스가 커진 가장 작은 화면(320×568)에서 259dp — 색판 88 + 견본 줄 + 머리가 드는 256 을 하한으로 둔다.
    assert.ok(colorDock.height >= 256, tag + ': 색 선택과 스크롤에 필요한 높이: ' + colorDock.height);
    const colorScroll = byTestID('색 견본 스크롤')[0];
    assert.ok(colorScroll.findAll(n => n.props.accessibilityLabel === 'HEX 색 값').length, tag + ': 키보드 위에서도 색 값에 스크롤로 닿는다');
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
    assert.equal(labelled('저장').length, 1, tag + ': 움직이기에서도 완성 버튼은 머리줄에 하나');
    // 겹침이 아니라 경계로 본다: 설정 목록은 줄어드는 스크롤이고(flex:1·minHeight:0),
    // 완성은 스크롤 밖 머리줄에 있다. 그래서 목록이 길어져도 완성을 밀어내지 못하고, 끝까지 스크롤로 닿는다.
    const motionScroll = tree.root.findAll(n => n.type === 'ScrollView' && flat(n.props.style).flex === 1);
    assert.equal(motionScroll.length, 1, tag + ': 움직이기 설정 목록은 줄어드는 스크롤 하나');
    assert.equal(flat(motionScroll[0].props.style).minHeight, 0, tag + ': 목록이 내용 높이로 버티지 않는다');
    assert.ok((flat(motionScroll[0].props.contentContainerStyle).paddingBottom ?? 0) >= 12, tag + ': 목록 끝에 여유가 있다');
    const finishRow = tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === '저장')[0];
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
  // ── 머리줄(45.37): 윗줄 = 닫기 · 이름 · 저장 · 더보기. 모드 줄 = 그리기·움직이기 … 되돌리기·다시 실행 | 참고·레이어·문구 ─────
  // 380dp 이상은 한 줄, 넘칠 때(큰 글자)만 두 줄. 380dp 미만은 재기 전부터 두 줄 — '문구'가 화면 밖으로 밀린 채 보이지 않게.
  const headOf = () => tree.root.findAll(n => n.type === 'View' && typeof n.props.onLayout === 'function' && flat(n.props.style).borderBottomWidth === 1)[0];
  const aidNames = () => ['참고', '레이어', '문구', '되돌리기', '다시 실행'].map(l => labelled(l).length);
  const rowsIn = head => head.findAll(n => n.type === 'View' && flat(n.props.style).flexDirection === 'row' && n.parent === head).length;
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
  // 넓은 화면(412): 재기 전에도, 들어가면 한 줄. 넘치면 두 줄. 글자와 손가락 자리는 그대로.
  viewport.width = 412; viewport.height = 900;
  files.clear();
  saveStore({ version: 1, revision: 1, projects: [p], palette: ['#54A9E8'] });
  await openPainter();
  assert.deepEqual(aidNames(), [1, 1, 1, 1, 1], '보조 셋과 되돌리기·다시 실행이 모두 있다');
  assert.equal(labelled('저장').length, 1, '윗줄에는 저장 하나');
  assert.equal(rowsIn(headOf()), 1, '412: 재기 전에는 한 줄');
  assert.equal(headOf().findAll(n => n.props.accessibilityLabel === '되돌리기').length, 1, '412: 되돌리기는 모드 줄(참고 왼쪽)');
  await measure(400, 140, 230);
  assert.equal(rowsIn(headOf()), 1, '412: 들어가면 한 줄을 지킨다');
  const tapBefore = ['참고', '레이어', '문구'].map(l => flat(labelled(l)[0].props.style).minHeight);
  await measure(400, 200, 230);
  assert.equal(rowsIn(headOf()), 2, '412: 넘치면(큰 글자) 두 줄로 갈린다');
  assert.deepEqual(aidNames(), [1, 1, 1, 1, 1], '두 줄이 되어도 하나씩');
  assert.deepEqual(['참고', '레이어', '문구'].map(l => flat(labelled(l)[0].props.style).minHeight), tapBefore, '두 줄로 가도 손가락 자리를 줄이지 않는다');
  assert.deepEqual(tapBefore, [48, 48, 48], '보조 도구 손가락 높이 48dp');
  await act(async () => tree.unmount());
  // 좁은 화면(320): 모드 줄은 한 줄 그대로, 되돌리기·다시 실행은 윗줄(이름 옆)로 간다 — 줄을 하나 더 쓰지 않는다.
  viewport.width = 320; viewport.height = 800;
  files.clear();
  saveStore({ version: 1, revision: 1, projects: [p], palette: ['#54A9E8'] });
  await openPainter();
  assert.equal(rowsIn(headOf()), 1, '320: 모드 줄은 한 줄');
  assert.deepEqual(aidNames(), [1, 1, 1, 1, 1], '320: 모두 하나씩');
  assert.equal(headOf().findAll(n => n.props.accessibilityLabel === '되돌리기').length, 0, '320: 되돌리기는 모드 줄이 아니라 윗줄에');
  await act(async () => tree.unmount());
  console.log('  머리줄 — 모드 줄은 한 줄(큰 글자로 넘칠 때만 두 줄) · 되돌리기는 380dp 이상 참고 왼쪽, 미만은 윗줄 · 손가락 높이 48dp');

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
  console.log(rows45.join(' · '));
  console.log('PASS: viewport matrix — 568/640/720/800/900/1000 × 320/360/390/412: 캔버스는 기기가 허락하는 만큼 정사각으로 꽉 차고(45.38 보다 작아지는 화면 0), 굵기·불투명도는 캔버스 위 조절 줄(세로가 아주 짧은 화면만 옆 조절대)에 하나씩, 여백 두 손가락 톡 되돌리기, 도구 줄 두 줄 안 잘림, 브러시 창은 줄 넷이 보이는 독립 창, 색·참고·레이어 패널 캔버스 절반 이하, 문구 패널이 키보드 위, 움직이기 패널 45% 미만 겹침·설정 목록만 줄고 완성 줄은 스크롤 밖, 보드 세 칸·아래 줄, 내보내기 결과 격자 한 줄 다섯 칸 이상, 글자 배율 1.0/1.3/1.5 에서 높이 고정 상자 잘림 0곳. 렌더 스타일 + 기기 레이아웃 크기 기준(픽셀 렌더링 아님).');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
