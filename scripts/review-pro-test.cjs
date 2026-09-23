// 내부 검수용 PRO: 토글 상태와 기능 잠금이 실제로 같은지 끝에서 끝까지 확인한다.
// 지금까지는 reviewUnlocked() 함수만 따로 검사했다 — 화면에서 토글을 눌렀을 때 잠긴 기능이
// 정말 열리는지는 아무도 보지 않았다. 여기서는 실제 App 을 그려 토글을 누르고 기능에 들어가 본다.
// 출시 구성(internalReview=false)에서는 같은 값이 있어도 열리지 않는 것까지 함께 본다.
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { loader } = require('./load-ts.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;

const files = new Map();
class Directory { constructor(...p) { this.uri = p.map(x => x.uri ?? x).join('/'); } create() {} }
class File {
  constructor(...p) { this.uri = p.map(x => x.uri ?? x).join('/'); }
  get name() { return this.uri.split('/').pop(); }
  get exists() { return files.has(this.uri); }
  write(d, o) { files.set(this.uri, o?.encoding === 'base64' ? Buffer.from(d, 'base64') : d); }
  textSync() { return files.get(this.uri); }
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
  delete() { files.delete(this.uri); }
}
const commands = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n]));
Object.assign(rn, {
  Keyboard: { addListener: () => ({ remove() {} }), dismiss() {}, isVisible: () => false },
  StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }),
  BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) },
  Alert: { alert() {} }, Linking: { openURL: async () => {} },
});
const png = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(360, 16); png.writeUInt32BE(360, 20);
const pngData = 'data:image/png;base64,' + png.toString('base64');

// expo-constants 는 default 를 감싸지 않은 모양이라야 한다. { default: … } 로 주면 esModuleInterop 이
// 한 겹 더 싸서 Constants.expoConfig 가 undefined 가 되고, 검수 구성이 꺼진 것처럼 보인다(45.25 에서 확인).
const appFor = internalReview => {
  const mocks = {
    'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
    'expo-image-picker': {}, 'expo-image-manipulator': {},
    'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'f://a', uri: 'f://a' }) }) } },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    'expo-constants': { expoConfig: { extra: { internalReview }, version: '1.0.0' } },
    'react-native-webview': { WebView },
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => {} },
    'expo-file-system': { Directory, File, Paths: { document: 'document' } },
    './src/components/image-analyzer': { ImageAnalyzer: () => null },
    './src/components/extra-composer': { ExtraComposer: React.forwardRef(() => null), placeInFrame: () => ({ x: 0, y: 0, w: 1, h: 1 }) },
    './src/components/motion-baker': { MotionBaker: React.forwardRef(() => null) },
  };
  const real = loader(mocks)('src/services/images.ts');
  const images = {
    dataUrl: async () => pngData, pickImages: async () => [], importBundledImage: async () => ({ path: 'g.png', width: 132, height: 132 }),
    savePainterWork: (...a) => real.savePainterWork(...a), saveCutout: () => ({}),
    saveMotionLoop: () => ({ path: 'm.gif', width: 360, height: 360 }), saveSubmitLoop: () => undefined,
  };
  const load = loader({ ...mocks, './src/services/images': images, '../services/images': images });
  return { App: load('App.tsx').default, saveStore: load('src/services/storage.ts').saveStore, createProject: load('src/project.ts').createProject };
};

let tree;
const labelled = label => tree.root.findAll(n => (n.type === 'Pressable' || n.type === 'View') && n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
const press = async label => { const m = labelled(label); assert.ok(m.length >= 1, '누를 것이 없다: ' + label); await act(async () => m[0].props.onPress()); };
const texts = () => tree.root.findAll(n => n.type === 'Text').map(n => [n.props.children].flat(9).filter(x => typeof x === 'string').join(''));
const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
async function openPainter() {
  await press('검수 세트 이어서 만들기');
  await message({ type: 'ready' });
  const init = sent().filter(m => m.type === 'init').at(-1);
  await message({ type: 'state', undo: false, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null, caption: null, motion: null,
    layers: init.layers.map(l => ({ id: l.id, name: l.name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 })), references: [] });
  await message({ type: 'initialized' });
}

(async () => {
  for (const internalReview of [true, false]) {
    const { App, saveStore, createProject } = appFor(internalReview);
    files.clear(); commands.length = 0;
    const p = createProject('검수 세트', '콩이');
    p.slots = p.slots.map((s, i) => i < 3 ? { ...s, finalImage: { path: 'a.png', width: 360, height: 360 }, done: true } : s);
    saveStore({ version: 1, revision: 1, projects: [p], palette: [] });
    await act(async () => { tree = create(React.createElement(App)); });
    const where = internalReview ? '내부 검수 구성' : '출시 구성';

    // ── 1. 토글이 있는 곳과 없는 곳 ─────────────────────────────────────────────────────
    await press('설정');
    const toggle = labelled('검수용 PRO 켜기');
    if (!internalReview) {
      assert.equal(toggle.length, 0, where + ': 검수용 토글은 아예 그려지지 않는다');
      await press('닫기');
      await act(async () => tree.unmount());
      continue;
    }
    assert.equal(toggle.length, 1, where + ': 설정에 검수용 토글이 하나 있다');
    assert.equal(toggle[0].props.accessibilityState.checked, false, '처음에는 꺼져 있다');

    // ── 2. 끄면 잠겨 있다 ───────────────────────────────────────────────────────────────
    await press('닫기');
    assert.ok(texts().includes('PRO 보기'), '꺼짐: 홈 배지는 PRO 보기');
    await openPainter();
    await press('움직이기');
    await press('부분만 움직이기');
    assert.equal(labelled('PRO 알아보기').length + labelled('PRO 닫기').length, 1, '꺼짐: 부분 움직임은 결제 안내로 막힌다');
    assert.equal(texts().includes('두 모습 번갈아'), false, '꺼짐: 부분 움직임 화면에 들어가지 않는다');
    await press(labelled('PRO 닫기').length ? 'PRO 닫기' : 'PRO 알아보기');
    if (labelled('PRO 닫기').length) await press('PRO 닫기');
    await press('그리기');
    await press('브러시');
    assert.equal(labelled('고급 브러시 PRO').length, 1, '꺼짐: 고급 브러시도 잠겨 있다');
    await press('브러시 닫기');

    // ── 2-b. 막힌 그 자리에서 바로 켤 수 있다 ───────────────────────────────────────────
    // 검수 기기에서는 결제를 열 수 없는 일이 흔하다. 설정 깊은 곳까지 찾아가지 않아도 되게 한다.
    await press('움직이기');
    await press('부분만 움직이기');
    assert.equal(labelled('결제 없이 검수용 PRO 켜기').length, 1, '꺼짐: 잠금 안내에 검수용으로 켜는 길이 있다');
    await press('결제 없이 검수용 PRO 켜기');
    assert.equal(labelled('PRO 닫기').length, 0, '켜면 안내가 닫힌다');
    await press('부분만 움직이기');
    assert.ok(texts().includes('두 모습 번갈아'), '그 자리에서 바로 기능에 들어간다');
    await press('움직임 처음으로');
    // 다시 꺼 두고 설정 쪽 길도 확인한다.
    await press('그리기');
    await press('그리기 닫기');
    await message({ type: 'save', token: sent().filter(m => m.type === 'save').at(-1)?.token, dirty: false, data: pngData, metrics: { coverage: .2 }, activeLayerId: 'draw-1', layers: [], references: [] });
    await act(async () => {});
    await press('뒤로');
    await press('설정');
    await press('검수용 PRO 켜기');
    await press('닫기');
    await openPainter();
    await press('움직이기');
    await press('그리기');

    // ── 3. 켜면 같은 자리에서 실제로 열린다 ──────────────────────────────────────────────
    await press('브러시');
    await press('브러시 닫기');
    await press('그리기 닫기');
    await message({ type: 'save', token: sent().filter(m => m.type === 'save').at(-1)?.token, dirty: false, data: pngData, metrics: { coverage: .2 }, activeLayerId: 'draw-1', layers: [], references: [] });
    await act(async () => {});
    await press('뒤로');
    await press('설정');
    await press('검수용 PRO 켜기');
    assert.equal(labelled('검수용 PRO 켜기')[0].props.accessibilityState.checked, true, '켜짐 상태가 남는다');
    await press('닫기');
    assert.ok(texts().includes('PRO'), '켜짐: 홈 배지가 PRO 로 바뀐다');
    assert.equal(texts().includes('PRO 보기'), false, '켜짐: 더 이상 권유 문구가 아니다');

    await openPainter();
    await press('움직이기');
    await press('부분만 움직이기');
    assert.equal(labelled('PRO 알아보기').length + labelled('PRO 닫기').length, 0, '켜짐: 결제 안내가 끼어들지 않는다');
    assert.ok(texts().includes('두 모습 번갈아'), '켜짐: 부분 움직임 화면에 실제로 들어간다');
    await press('움직임 처음으로');
    await press('그리기');
    await press('브러시');
    assert.equal(labelled('고급 브러시 PRO').length, 0, '켜짐: 고급 브러시 잠금이 풀린다');
    assert.ok(labelled('브러시 매끈한 잉크').length >= 1, '켜짐: 고급 브러시를 실제로 고를 수 있다');
    await press('브러시 닫기');

    // ── 4. 다시 끄면 다시 잠긴다 ────────────────────────────────────────────────────────
    await press('그리기 닫기');
    await message({ type: 'save', token: sent().filter(m => m.type === 'save').at(-1)?.token, dirty: false, data: pngData, metrics: { coverage: .2 }, activeLayerId: 'draw-1', layers: [], references: [] });
    await act(async () => {});
    await press('뒤로');
    await press('설정');
    await press('검수용 PRO 켜기');
    await press('닫기');
    assert.ok(texts().includes('PRO 보기'), '다시 끄면 잠금이 돌아온다');
    await act(async () => tree.unmount());
  }
  console.log('PASS: review pro — 내부 검수 구성에서 설정의 검수용 PRO 토글을 누르면 홈 배지·부분 움직임·고급 브러시가 실제로 함께 열리고 끄면 함께 잠긴다. 출시 구성에는 토글이 그려지지 않는다. Native/WebView mocked.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
