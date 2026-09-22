// 대체 렌더: 화면마다 '테두리 있는 상자'가 몇 겹으로 쌓이는지 센다. 명세 §2 '박스 축소' 확인용.
// **실기기 캡처가 아니다.** 실제 App 트리를 그려 스타일만 읽는다.
const React = require('react');
const { create, act } = require('react-test-renderer');
const { loader } = require('C:/Dev/emoticon-studio/scripts/load-ts.cjs');
process.chdir('C:/Dev/emoticon-studio');
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
Object.assign(rn, { Keyboard: { addListener: () => ({ remove() {} }), dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} }, Linking: { openURL: async () => {} } });
const png = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(360, 16); png.writeUInt32BE(360, 20);
const pngData = 'data:image/png;base64,' + png.toString('base64');
const mocks = {
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'f://a', uri: 'f://a' }) }) } },
  'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-constants': { default: { expoConfig: { extra: {}, version: '1.0.0' } } }, 'react-native-webview': { WebView },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => {} }, 'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  './src/components/image-analyzer': { ImageAnalyzer: () => null },
  './src/components/extra-composer': { ExtraComposer: React.forwardRef(() => null), placeInFrame: () => ({ x: 0, y: 0, w: 1, h: 1 }) },
  './src/components/motion-baker': { MotionBaker: React.forwardRef(() => null) },
};
const realImg = loader(mocks)('src/services/images.ts');
const images = { dataUrl: async () => pngData, pickImages: async () => [], importBundledImage: async () => ({ path: 'g.png', width: 132, height: 132 }), savePainterWork: (...a) => realImg.savePainterWork(...a), saveCutout: () => ({}), saveMotionLoop: () => ({ path: 'm.gif', width: 360, height: 360 }), saveSubmitLoop: () => undefined };
const load = loader({ ...mocks, './src/services/images': images, '../services/images': images });
const { saveStore } = load('src/services/storage.ts');
const { createProject } = load('src/project.ts');
const App = load('App.tsx').default;
let tree;
const flat = st => Object.assign({}, ...[st].flat(9).filter(Boolean).map(s => typeof s === 'function' ? s({ pressed: false }) : s));
const labelled = l => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === l);
const press = async l => { const m = labelled(l); if (m.length !== 1) throw new Error('button ' + l + ' ' + m.length); await act(async () => m[0].props.onPress()); };
const boxed = n => { const s = flat(n.props.style); return (s.borderWidth > 0 && s.borderColor) || (s.backgroundColor && s.borderRadius >= 10); };
const depth = () => {
  let worst = 0, total = 0;
  for (const n of tree.root.findAll(n => (n.type === 'View' || n.type === 'Pressable'))) {
    if (!boxed(n)) continue;
    total++;
    let d = 1;
    for (let p = n.parent; p; p = p.parent) if ((p.type === 'View' || p.type === 'Pressable') && boxed(p)) d++;
    worst = Math.max(worst, d);
  }
  return { total, worst };
};
(async () => {
  const p = createProject('상자 세트', '콩');
  p.slots = p.slots.map((s, i) => i < 32 ? { ...s, finalImage: { path: 'a.png', width: 360, height: 360 }, done: true } : s);
  saveStore({ version: 1, revision: 1, projects: [p], palette: [] });
  await act(async () => { tree = create(React.createElement(App)); });
  console.log('홈      ', JSON.stringify(depth()));
  await press('상자 세트 이어서 만들기'); await press('그리기 닫기');
  console.log('보드    ', JSON.stringify(depth()));
  await press('내보내기');
  console.log('내보내기', JSON.stringify(depth()));
  await press('뒤로'); await press('뒤로');
  await press('설정');
  console.log('설정    ', JSON.stringify(depth()));
  console.log('    (설정의 3겹은 켜고 끄는 단추의 동그란 손잡이다 — 상자가 아니다)');
  await act(async () => tree.unmount());
})().catch(e => { console.error(e.message); process.exit(1); });
