// 45.43 — 새로 그리기의 참고 그림 잔류(사용자 실기기 신고). 그리기에 들어가는 길마다 무엇이 따라 들어가는지 본다.
// · 가이드를 직접 고른 칸만 그 가이드(참고 창/밑그림)를 쓴다.
// · 가이드를 쓴 직후 '완성 · 다음'의 새 빈 칸, 새 세트, 다른 칸은 참고 없이 연다.
// · 사용자가 저장한 참고 설정은 다시 열어도, 앱을 다시 켜도 그대로다. 저장된 설정이 없는 옛 참고는 숨긴 채 연다(데이터는 지우지 않는다).
// · '내 그림으로 시작'의 그림은 그 새 세트의 1번 칸에만 들어간다.
// WebView·네이티브는 검사 대역이다 — 캔버스에 실제로 그려지는지는 기기에서 본다.
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
  async bytes() { return this.bytesSync(); }
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
  delete() { files.delete(this.uri); }
}
const commands = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n])); rn.Animated = require('./_rn-animated-mock.cjs');
Object.assign(rn, {
  Keyboard: { addListener: () => ({ remove() {} }), dismiss() {}, isVisible: () => false },
  StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }),
  BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) },
  Alert: { alert() {} }, Linking: { openURL: async () => {} }, LayoutAnimation: { configureNext() {}, Presets: {} }, UIManager: {},
});
const png = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(360, 16); png.writeUInt32BE(360, 20);
const pngData = 'data:image/png;base64,' + png.toString('base64');
let picked = [];
const images = {
  dataUrl: async () => pngData, pickImages: async () => picked, importBundledImage: async () => ({ path: 'guide.png', width: 132, height: 132 }),
  savePainterWork: () => ({}), saveCutout: () => ({}), saveMotionLoop: () => ({ path: 'm.gif', width: 360, height: 360 }), saveSubmitLoop: () => undefined,
};
const load = loader({
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'f://a', uri: 'f://a' }) }) } },
  'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-constants': { __esModule: true, default: { expoConfig: { extra: {}, version: '1.0.0' } } },
  'react-native-webview': { WebView }, 'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => {} },
  'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  './src/components/image-analyzer': { ImageAnalyzer: () => null },
  './src/components/extra-composer': { ExtraComposer: React.forwardRef(() => null), placeInFrame: () => ({ x: 0, y: 0, w: 1, h: 1 }) },
  './src/components/motion-baker': { MotionBaker: React.forwardRef(() => null) },
  './src/services/images': images, '../services/images': images,
});
const { saveStore, loadStore } = load('src/services/storage.ts');
const { createProject } = load('src/project.ts');
const App = load('App.tsx').default;

let tree;
const fresh = async () => { if (tree) await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(App)); }); };
const labelled = l => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === l);
const press = async l => { const m = labelled(l); if (!m.length) throw new Error('누를 것이 없다: ' + l); await act(async () => m[0].props.onPress()); };
const painter = () => tree.root.findAll(n => typeof n.type === 'function' && n.props && 'guideExampleMode' in n.props && n.props.slot)[0]?.props;
const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };
// 캔버스를 연다: ready → init 을 받고, 엔진이 돌려주는 상태를 흉내 낸 뒤 initialized.
async function open() {
  commands.length = 0;
  await message({ type: 'ready' }); await settle();
  const init = sent().filter(m => m.type === 'init').at(-1);
  await message({ type: 'state', undo: false, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null, caption: null, motion: null,
    layers: init.layers.map(l => ({ id: l.id, name: l.name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 })),
    references: init.references.map(r => ({ id: r.id, name: r.name, visible: r.visible, opacity: r.opacity, x: 0, y: 0, scale: 1, rotation: 0 })) });
  await message({ type: 'initialized' }); await settle();
  return init;
}
const refsAdded = () => sent().filter(m => m.type === 'addReferences' || m.type === 'importDrawing');
const guideOf = () => { const p = painter(); return { hint: p.guideHint, example: p.guideExample, mode: p.guideExampleMode, importing: p.initialImport }; };
const clean = where => { const g = guideOf(); assert.ok(!g.hint && !g.example && !g.mode && !g.importing, where + ': 가이드·가져온 그림이 따라오지 않는다 ' + JSON.stringify({ ...g, example: !!g.example })); };

(async () => {
  const results = [];
  const set = createProject('검토 세트', '콩이');
  saveStore({ version: 1, revision: 1, projects: [set], palette: [] });
  await fresh();

  // ① 가이드를 직접 고른 시작: 그 칸(1번)에 밑그림이 깔린다.
  await press('표현 가이드'); await press('안녕 · 손 크게 흔들기'); await press('손 흔들며 고르기'); await press('밑그림 넣기');
  assert.equal(painter().slot.number, 1);
  assert.equal(guideOf().mode, 'underlay', '고른 가이드가 그 칸에 전달된다');
  await open();
  assert.ok(sent().some(m => m.type === 'addReferences' && m.references[0].name.startsWith('밑그림')), '가이드를 고른 칸에는 밑그림이 깔린다');
  results.push('가이드 직접 선택 → 그 칸에 밑그림');

  // ② 가이드를 쓴 직후 '완성 · 다음' → 새 빈 칸(2번)
  await act(async () => painter().onComplete());
  assert.equal(painter().slot.number, 2, '다음 빈 칸이 열린다');
  clean('완성 · 다음');
  let init = await open();
  assert.equal(init.references.length, 0, '새 빈 칸에는 참고가 없다');
  assert.equal(refsAdded().length, 0, '새 빈 칸에 밑그림이 저절로 깔리지 않는다');
  results.push('가이드 직후 완성·다음 → 빈 캔버스');

  // ③ 가이드를 쓴 직후 새 세트
  await act(async () => painter().onClose()); await settle();
  await press('뒤로'); await settle();
  await press('새 세트 만들기'); await press('만들기'); await settle();
  assert.equal(painter().slot.number, 1);
  clean('새 세트');
  init = await open();
  assert.equal(init.references.length, 0, '새 세트 1번 칸에는 참고가 없다'); assert.equal(refsAdded().length, 0);
  results.push('가이드 직후 새 세트 → 빈 캔버스');

  // ④ 가이드를 고른 뒤 그 그리기를 닫고 보드에서 다른 칸을 열면 가이드가 따라가지 않는다.
  await act(async () => painter().onClose()); await press('뒤로'); await settle();
  await press('표현 가이드'); await press('안녕 · 손 크게 흔들기'); await press('손 흔들며 고르기'); await press('참고 보기');
  assert.equal(guideOf().mode, 'watch');
  const guidedSet = loadStore().store.projects.find(p => p.id === painter().slot && true) ?? null; void guidedSet;
  await act(async () => painter().onClose()); await settle();
  const board = tree.root.findAll(n => n.props.testID === 'slot-5' && typeof n.props.onPress === 'function')[0];
  await act(async () => board.props.onPress());
  clean('보드에서 다른 칸');
  results.push('가이드 고른 뒤 닫고 보드의 다른 칸 → 가이드 없음');
  await act(async () => painter().onClose());

  // ⑤ 저장된 참고 설정 · 옛 참고(설정 없음) · 앱 다시 켜기
  {
    const store = loadStore().store;
    const target = store.projects.find(p => p.projectName === '검토 세트');
    const ref = { path: 'saved-ref.png', width: 360, height: 360 };
    files.set('document/emoticon-studio/saved-ref.png', png);
    const withSaved = { ...target.slots[5], referenceImages: [ref], finalImage: { path: 'saved-ref.png', width: 360, height: 360 }, work: { version: 1, activeLayerId: 'draw-1', layers: [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, image: { path: 'saved-ref.png', width: 360, height: 360 } }], references: [{ id: 'ref-saved-ref.png', name: '참고 1', visible: true, opacity: .45, x: 0, y: 0, scale: 1, rotation: 0, image: ref }] } };
    const legacy = { ...target.slots[6], referenceImages: [ref] };   // 45.37 이전처럼 칸마다 들어간 참고(저장된 설정 없음)
    const planned = { ...target.slots[7], referenceImages: [ref], referenceKey: ref.path };   // 기획에서 이 칸에 지정한 참고
    saveStore({ ...store, revision: store.revision + 1, projects: store.projects.map(p => p.id !== target.id ? p : { ...p, updatedAt: '2099-01-01T00:00:00.000Z', slots: p.slots.map(s => s.number === 6 ? withSaved : s.number === 7 ? legacy : s.number === 8 ? planned : s) }) });
    for (const restart of [false, true]) {
      await fresh();
      await press('검토 세트'); await settle();
      const openCell = async n => { await act(async () => tree.root.findAll(x => x.props.testID === 'slot-' + n && typeof x.props.onPress === 'function')[0].props.onPress()); clean(n + '번 칸'); const i = await open(); await act(async () => painter().onClose()); await settle(); return i; };
      const saved = await openCell(6);
      assert.deepEqual(saved.references.map(r => [r.visible, r.opacity]), [[true, .45]], '저장한 참고 설정은 그대로 연다' + (restart ? '(다시 켠 뒤)' : ''));
      const old = await openCell(7);
      assert.equal(old.references.length, 1, '옛 참고 데이터는 지우지 않는다'); assert.equal(old.references[0].visible, false, '저장된 설정이 없는 참고는 숨긴 채 연다');
      const plan = await openCell(8);
      assert.equal(plan.references[0].visible, true, '기획에서 지정한 참고는 켜고 연다');
      assert.equal(loadStore().store.projects.find(p => p.id === target.id).slots[6].referenceImages.length, 1, '연 것만으로 참고 데이터가 바뀌지 않는다');
    }
    results.push('저장된 참고 설정 재열기·앱 재시작 → 그대로, 옛 참고 → 숨김(데이터 보존)');
  }

  // ⑥ 내 그림으로 시작: 그 새 세트 1번 칸에만 들어가고, 옆 칸으로 가면 따라가지 않는다.
  await fresh();
  picked = [{ path: 'picked.png', width: 360, height: 360 }];
  await press('내 그림으로 시작'); await settle();
  assert.equal(painter().slot.number, 1); assert.ok(painter().initialImport, '고른 그림은 새 세트 1번 칸에 들어간다');
  await act(async () => painter().onNavigate(2)); await settle();
  clean('내 그림으로 시작 뒤 옆 칸');
  results.push('내 그림으로 시작 → 그 칸만, 옆 칸은 빈 캔버스');

  console.log('PASS: entry reset — ' + results.join(' · ') + '. WebView·네이티브는 검사 대역(캔버스 실제 표시는 기기에서).');
})().catch(e => { console.error(e); process.exit(1); });
