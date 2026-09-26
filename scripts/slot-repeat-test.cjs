// 8~24칸 반복 제작 시뮬레이션(Round 39). 실제 App 을 띄워 한 세트를 칸마다 끝까지 만든다.
//   칸 1: 연필 · 굵기 · 색 · 문구 · 통통 → 저장
//   칸 2~N: 이전 칸 그림으로 시작 → 문구 새로 쓰기 → (짝수 칸) 직전 칸 움직임 다시 쓰기 → 저장
// 확인: 선 종류·굵기·도구가 칸을 넘어도 유지, 최근 색 유지, 이전 그림 이어받기 매번 제안, 직전 움직임 행 매번 보임,
//      칸마다 누르기 수가 늘어나지 않음(8칸째와 N칸째 동일), 확인창 0, 저장된 칸 수·문구·움직임, 앞 칸 다시 열면 그대로.
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
const commands = [], alerts = [];
let taps = 0, drags = 0;
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n])); rn.Animated = require('./_rn-animated-mock.cjs');
Object.assign(rn, { Keyboard: { addListener: () => ({ remove() {} }), dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert(title, message, buttons) { alerts.push({ title, message, buttons }); } }, Linking: { openURL: async () => {} } });
const mocks = {
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'bundled://art', uri: 'bundled://art' }) }) } }, 'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-constants': { default: { expoConfig: { extra: {} } } }, 'react-native-webview': { WebView },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => {} }, 'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  './src/components/image-analyzer': { ImageAnalyzer: () => null },
  './src/components/extra-composer': { ExtraComposer: React.forwardRef(() => null), placeInFrame: () => ({ x: 0, y: 0, w: 1, h: 1 }) },
  './src/components/motion-baker': { MotionBaker: React.forwardRef(() => null) },
};
const png = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(360, 16); png.writeUInt32BE(360, 20);
const pngData = 'data:image/png;base64,' + png.toString('base64');
const real = loader(mocks)('src/services/images.ts');
const saveMotionLoop = () => { files.set('document/emoticon-studio/moving.gif', Buffer.from('GIF89a\x68\x01\x68\x01', 'latin1')); return { path: 'moving.gif', width: 360, height: 360 }; };
const images = { dataUrl: async () => pngData, pickImages: async () => [], savePainterWork: (...a) => real.savePainterWork(...a), saveCutout: (...a) => real.saveCutout(...a), saveMotionLoop, saveSubmitLoop: () => undefined };
const load = loader({ ...mocks, './src/services/images': images, '../services/images': images });
const { loadStore, saveStore } = load('src/services/storage.ts');
const { createProject } = load('src/project.ts');
const App = load('App.tsx').default;

const metrics = { coverage: .2, centerX: .5, centerY: .5, width: .5, height: .5, color: [.2, .2, .2], transparent: true };
let tree, scene;
const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
const lastCommand = type => sent().filter(m => m.type === type).at(-1);
const labelled = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const press = async label => { const m = labelled(label); assert.equal(m.length, 1, 'button ' + label + ' (' + m.length + ')'); assert.ok(!m[0].props.disabled, 'enabled ' + label); taps++; await act(async () => m[0].props.onPress()); };
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
const publicLayer = l => Object.fromEntries(['id', 'name', 'visible', 'opacity', 'x', 'y', 'scale', 'rotation'].map(k => [k, l[k]]));
const hasWebView = () => tree.root.findAll(n => n.type === 'WebView').length === 1;
const tiles = () => tree.root.findAll(n => n.type === 'Pressable' && /^slot-\d+$/.test(n.props.testID));
const captionInput = () => tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === '문구 내용')[0];
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
const writeCaption = async text => {
  await press('문구');
  await act(async () => captionInput().props.onChangeText(text));
  taps++; await act(async () => captionInput().props.onSubmitEditing());
  scene = { ...scene, caption: lastCommand('caption').caption, captionPicked: true }; await message(scene);
  await press('문구 선택 끝');
  scene = { ...scene, captionPicked: false }; await message(scene);
};

(async () => {
  const project = createProject('반복 세트', '콩이');
  const total = project.slots.length;
  assert.ok(total >= 24, '세트는 24칸 이상: ' + total);
  saveStore({ version: 1, revision: 1, projects: [project], palette: ['#54A9E8', '#E94F4F'] });
  await act(async () => { tree = create(React.createElement(App)); });
  await press('반복 세트 이어서 만들기');
  if (!hasWebView()) await act(async () => tiles().find(t => t.props.testID === 'slot-1').props.onPress());
  await ready();

  // 칸 1: 한 번만 고르는 설정.
  scene = { ...scene, dirty: true, undo: true }; await message(scene);
  // 45.35: 목록이 선·채색·질감·효과 갈래로 나뉘었다(승인 시안). 연필은 질감에 있다.
  await press('브러시 전체'); await press('브러시 분류 질감'); await press('브러시 연필');   // 전체 목록에서 고르면 판이 스스로 닫힌다(45.25)
  // 굵기는 색과 같은 줄의 가로 막대다(45.28). 폭을 알려 준 뒤 3/4 자리를 눌러 끈다.
  const sizer = () => tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === '브러시 굵기')[0];
  drags++;
  await act(async () => sizer().props.onLayout({ nativeEvent: { layout: { width: 240, height: 44 } } }));
  await act(async () => sizer().props.onResponderGrant({ nativeEvent: { locationX: 120 } }));
  await act(async () => sizer().props.onResponderMove({ nativeEvent: { locationX: 180 } }));
  await act(async () => sizer().props.onResponderRelease({ nativeEvent: { locationX: 180 } }));
  const width1 = lastCommand('brush')?.width ?? lastCommand('tool')?.width;
  await press('색'); await press('팔레트'); await press('색 #E94F4F'); if (labelled('팔레트 닫기').length) await press('팔레트 닫기');
  await writeCaption('칸 1');
  await press('움직이기'); await press('통통');
  scene = { ...scene, motion: lastCommand('motion').motion }; await message(scene);
  await press('그리기');
  await press('저장'); await saved(true); await press('다음 칸으로 가기');

  const perSlot = [];
  const SLOTS = 24;
  for (let n = 2; n <= SLOTS; n++) {
    const init = await ready();
    const t0 = taps, a0 = alerts.length;
    assert.equal(labelled('이전 칸 그림으로 시작').length, 1, n + '칸: 이전 칸 그림 이어받기 제안');
    await press('이전 칸 그림으로 시작'); await act(async () => {});
    scene = { ...scene, dirty: true, undo: true }; await message(scene);
    // 도구·선 종류·굵기·색이 그대로 — 다시 고르지 않는다.
    const brushNow = sent().filter(m => m.type === 'brush' || m.type === 'tool' || m.type === 'brushSettings').at(-1) || init;
    assert.ok(JSON.stringify(init).includes('pencil2') || JSON.stringify(brushNow).includes('pencil2'), n + '칸: 연필 유지');
    if (width1 != null) assert.ok(JSON.stringify(init).includes('"width":' + width1) || JSON.stringify(brushNow).includes('"width":' + width1), n + '칸: 굵기 유지 ' + width1);
    assert.equal(labelled('브러시 전체').length, 1, n + '칸: 브러시 도구');
    await writeCaption('칸 ' + n);
    await press('움직이기');
    assert.equal(labelled('직전 칸 움직임 다시 쓰기').length, 1, n + '칸: 직전 칸 움직임 행');
    if (n % 2 === 0) { await press('직전 칸 움직임 다시 쓰기'); scene = { ...scene, motion: lastCommand('motion').motion }; await message(scene); }
    else { await press('통통'); scene = { ...scene, motion: lastCommand('motion').motion }; await message(scene); }
    await press('그리기');
    // 최근 색: 칸 1에서 고른 색이 맨 앞.
    await press('색');
    const recent = tree.root.findAll(n2 => n2.type === 'Pressable' && String(n2.props.accessibilityLabel || '').startsWith('최근 색 ')).map(n2 => n2.props.accessibilityLabel);
    assert.equal(recent[0], '최근 색 #E94F4F', n + '칸: 최근 색 맨 앞 유지 ' + recent.join(','));
    if (labelled('팔레트 닫기').length) await press('팔레트 닫기');
    await press('저장'); await saved(true); await press('다음 칸으로 가기');
    perSlot.push({ n, taps: taps - t0, modals: alerts.length - a0 });
  }
  const at8 = perSlot.find(s => s.n === 8), last = perSlot.at(-1);
  assert.ok(perSlot.every(s => s.modals === 0), '확인창 0: ' + JSON.stringify(perSlot.filter(s => s.modals)));
  assert.ok(Math.abs(last.taps - at8.taps) <= 1, '칸이 늘어도 누르기 수가 늘지 않는다: 8칸 ' + at8.taps + ' · ' + last.n + '칸 ' + last.taps);

  // 저장된 세트: 24칸 모두 그림·문구·움직임.
  const stored = loadStore().store.projects[0];
  for (let n = 1; n <= SLOTS; n++) {
    const slot = stored.slots.find(s => s.number === n);
    assert.ok(slot.finalImage || slot.image || slot.layers, n + '칸 그림 저장');
    assert.ok(slot.done, n + '칸 완성 표시');
    // 문구는 칸의 작업 파일(PainterWork.caption)에 남는다.
    assert.ok([...files.values()].some(v => typeof v === 'string' && v.includes('"text":"칸 ' + n + '"')), n + '칸 문구 저장');
    assert.ok(slot.motion, n + '칸 움직임 저장');
  }
  assert.equal(stored.brush?.preset, 'pencil2', '세트에 선 종류 기억');

  // 앞 칸(3칸) 다시 열기: 문구·움직임 그대로, 이어받기 제안은 뜨지 않는다(빈 칸이 아님).
  if (hasWebView()) { await ready(); await press('그리기 닫기'); await saved(false); }
  await act(async () => tiles().find(t => t.props.testID === 'slot-3').props.onPress());
  if (!hasWebView()) { const again = labelled('이어서 그리기')[0] || labelled('3번 칸 그리기')[0]; if (again) await act(async () => again.props.onPress()); }
  const reopened = await ready();
  assert.equal(reopened.caption?.text, '칸 3', '3칸 다시 열면 문구 그대로');
  assert.ok(reopened.motion, '3칸 다시 열면 움직임 그대로');
  assert.equal(labelled('이전 칸 그림으로 시작').length, 0, '그린 칸에는 이어받기 제안 없음');
  await press('그리기 닫기'); await saved(false);
  console.log('  칸별 누르기: ' + perSlot.map(s => s.n + ':' + s.taps).join(' '));
  console.log('PASS: slot repeat — 1~' + SLOTS + '칸 연속 제작: 연필·굵기·도구 유지, 최근 색 맨 앞 유지, 빈 칸마다 이전 그림 제안, 직전 움직임 행 매번, 칸당 누르기 ' + at8.taps + '→' + last.taps + '(늘지 않음), 확인창 0, 24칸 그림·문구·움직임 저장, 앞 칸 다시 열면 그대로. Native/WebView mocked.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
