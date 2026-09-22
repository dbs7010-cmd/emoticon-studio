// 대체 렌더: 실제 App 트리를 그려 화면 구성을 읽는다. **실기기 캡처가 아니다.**
// 폭·높이·글자배율을 바꿔 가며 잘림·겹침을 본다.
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
let SIZE = { width: 390, height: 844 };
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n]));
Object.assign(rn, { Keyboard: { addListener: () => ({ remove() {} }), dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => SIZE, BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} }, Linking: { openURL: async () => {} } });
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
const txt = n => [n.props.children].flat(9).filter(x => typeof x === 'string' || typeof x === 'number').join('');
const order = () => {
  const out = [];
  for (const n of tree.root.findAll(() => true)) {
    const id = n.props?.testID, label = n.props?.accessibilityLabel;
    if (id === '홈 창작 표면') out.push('창작 표면');
    else if (n.type === 'Text' && txt(n) === '이어서 만들기') out.push('이어서 만들기');
    else if (n.type === 'Pressable' && /^보기 세트 \d+$/.test(label ?? '')) out.push('세트 카드');
    else if (n.type === 'Pressable' && label === '새 이모티콘 만들기') out.push('시작 줄');
    else if (n.type === 'Pressable' && label === '표현 가이드') out.push('표현 가이드');
    else if (n.type === 'Pressable' && /표현 보기$/.test(label ?? '')) out.push('가이드 미리보기');
    else if (n.type === 'Pressable' && label === '전체 작업 보기') out.push('전체 보기');
  }
  return out.filter((v, i) => v !== '가이드 미리보기' || out[i - 1] !== '가이드 미리보기');
};

(async () => {
  console.log('── H01 작업 없음 ──');
  saveStore({ version: 1, revision: 1, projects: [], palette: [] });
  await act(async () => { tree = create(React.createElement(App)); });
  console.log('  순서:', order().join(' → '));
  console.log('  빈 상태 점선 카드:', tree.root.findAll(n => n.props.testID === 'asset-slot-homeEmptyArtwork').length, '개(0이어야 한다)');

  console.log('── H02 작업 있음 ──');
  await act(async () => tree.unmount());
  const ps = [createProject('보기 세트 1', '콩'), createProject('보기 세트 2', '콩')];
  ps[0].slots = ps[0].slots.map((s, i) => i < 2 ? { ...s, finalImage: { path: 'a.png', width: 360, height: 360 }, done: i === 0 } : s);
  saveStore({ version: 1, revision: 2, projects: ps, palette: [] });
  await act(async () => { tree = create(React.createElement(App)); });
  console.log('  순서:', order().join(' → '));
  console.log('  창작 표면:', tree.root.findAll(n => n.props.testID === '홈 창작 표면').length, '개(0이어야 한다)');
  await act(async () => tree.unmount());
})().catch(e => { console.error(e.message); process.exit(1); });
