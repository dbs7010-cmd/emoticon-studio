// C1/C2/C3/C7: render the actual app with native APIs mocked.
const assert = require('node:assert/strict');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { loader } = require('./load-ts.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
const files = new Map();
let reads = 0, waitBytes = null;
class Directory { constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); } create() {} }
class File {
  constructor(...parts) { this.uri = parts.map(p => p.uri ?? p).join('/'); }
  get name() { return this.uri.split('/').pop(); }
  get exists() { return files.has(this.uri); }
  write(data, options) { files.set(this.uri, options?.encoding === 'base64' ? Buffer.from(data, 'base64') : data); }
  textSync() { return files.get(this.uri); }
  async bytes() { reads++; if (waitBytes) await waitBytes; return this.bytesSync(); }
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
  delete() { files.delete(this.uri); }
}
const keyboardListeners = {};
const commands = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n])); rn.Animated = require('./_rn-animated-mock.cjs');
const backHandlers = [];
Object.assign(rn, { Keyboard: { addListener: (name, fn) => { (keyboardListeners[name] = keyboardListeners[name] || []).push(fn); return { remove() {} }; }, dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), BackHandler: { addEventListener: (_n, fn) => { backHandlers.push(fn); return { remove() { const i = backHandlers.indexOf(fn); if (i >= 0) backHandlers.splice(i, 1); } }; } }, AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} }, Linking: { openURL: async () => {} } });
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
const config = { extra: { purchases: 'closed', internalReview: false }, version: '1.0.0' };
mocks['expo-constants'] = { __esModule: true, default: { expoConfig: config } };
rn.Platform.Version = 36;
const urls = []; let linkFails = false;
rn.Linking.openURL = async url => { urls.push(url); if (linkFails) throw Error('No handler'); };
const load = loader(mocks);
const App = load('App.tsx').default;
const { saveStore, localFile } = load('src/services/storage.ts');
const { createProject, setIssues } = load('src/project.ts');
const { CATALOG } = load('src/painter/painter.tsx');
const { PRESETS } = load('src/painter/motion-panel.tsx');
const { isProPreset } = load('src/motion-math.ts');
const adapter = load('src/services/purchase-adapter.ts');
let storeCalls = 0;
adapter.useStoreModuleForTests({ initConnection: async () => { storeCalls++; return true; }, fetchProducts: async () => { storeCalls++; return [{ id: 'pro_lifetime', displayPrice: '스토어 가격' }]; }, getAvailablePurchases: async () => { storeCalls++; return []; }, requestPurchase: async () => { storeCalls++; } });
let tree;
const labelled = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const press = async label => { assert.equal(labelled(label).length, 1, label); await act(async () => labelled(label)[0].props.onPress()); };
const texts = () => tree.root.findAllByType('Text').map(n => [n.props.children].flat(9).filter(x => typeof x === 'string' || typeof x === 'number').join(''));
async function render(projects = []) {
  if (tree) await act(async () => tree.unmount());
  saveStore({ version: 1, revision: Date.now(), projects, palette: [] });
  await act(async () => { tree = create(React.createElement(App)); });
}
(async () => {
  global.__DEV__ = false;
  await render();
  await press('PRO 보기');
  assert.ok(texts().includes('이번 테스트 버전에서는 PRO 구매가 아직 열리지 않았어요. 무료 기능을 모두 쓸 수 있어요.'));
  assert.equal(labelled('PRO 한 번 구매하기').length, 0);
  assert.equal(labelled('구매 복원').length, 0);
  assert.equal(labelled('결제 없이 검수용 PRO 켜기').length, 0);
  assert.ok(!texts().some(t => /가격을 불러오지/.test(t)));
  assert.equal(storeCalls, 0, 'startup and sheet make zero store calls');
  const brushHint = texts().find(t => t === CATALOG.filter(b => b.pro).map(b => b.title).join(' · '));
  assert.ok(brushHint);
  assert.deepEqual(brushHint.split(' · '), CATALOG.filter(b => b.pro).map(b => b.title));
  assert.equal(CATALOG.filter(b => !b.pro && brushHint.split(' · ').includes(b.title)).length, 0);
  assert.ok(texts().includes(`PRO 브러시 ${CATALOG.filter(b => b.pro).length}종`));
  assert.ok(texts().includes(`PRO 움직임 ${PRESETS.filter(p => isProPreset(p.id)).length}종`));
  assert.ok(texts().includes(PRESETS.filter(p => isProPreset(p.id)).map(p => p.label).join(' · ')));
  // 45.43 S6: 전/후 아래 칩은 실제 PRO 움직임 이름뿐이다(앞 다섯 + 나머지 수). 무료 움직임이 섞이지 않는다.
  {
    const pros = PRESETS.filter(p => isProPreset(p.id));
    const chips = tree.root.findAll(n => n.type === 'View' && n.props.testID === 'PRO 움직임 칩')[0].findAll(n => n.type === 'Text').map(n => [n.props.children].flat(9).join(''));
    assert.deepEqual(chips, [...pros.slice(0, 5).map(p => p.label), ...(pros.length > 5 ? ['+' + (pros.length - 5)] : [])]);
    assert.ok(!chips.some(c => PRESETS.some(p => !isProPreset(p.id) && p.label === c)), 'PRO 칩에 무료 움직임이 없다');
  }
  assert.ok(texts().some(t => t.includes('무료 브러시 10종 · 무료 움직임 6종')));
  await press('PRO 닫기');
  await press('설정');
  for (const label of ['개인정보처리방침', '문의하기']) assert.equal(labelled(label)[0].props.disabled, true);
  assert.equal(texts().filter(t => t === '준비 중').length, 2);
  config.extra.privacyPolicyUrl = 'https://privacy.example/policy'; config.extra.supportEmail = 'support@example.com';
  await render(); await press('설정');
  await press('개인정보처리방침'); assert.equal(urls.at(-1), config.extra.privacyPolicyUrl);
  await press('문의하기');
  const mail = new URL(urls.at(-1));
  assert.equal(mail.protocol, 'mailto:'); assert.equal(mail.pathname, config.extra.supportEmail);
  assert.equal(mail.searchParams.get('subject'), '[emoti 이모티] 문의');
  assert.equal(mail.searchParams.get('body'), '앱 버전: 1.0.0\nOS: android 36');
  linkFails = true; await press('문의하기');
  assert.equal(tree.root.findAll(n => n.type === 'Text' && n.props.accessibilityLabel === '복사할 문의 이메일')[0].props.selectable, true);
  linkFails = false;

  const p = createProject('개인 작품 이름', '캐릭터');
  for (let i = 0; i < 2; i++) {
    const path = `c3-${i}.png`; localFile(path).write(png);
    Object.assign(p.slots[i], { finalImage: { path, width: i ? 360 : 200, height: 360, metrics: { transparent: i !== 0, coverage: 0.3 } }, done: true, work: { version: 1, activeLayerId: 'a', layers: [{ id: 'a', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }], references: [], caption: { text: '같은 문구', place: 'bottom', color: '#242424' } } });
  }
  p.slots[0].qa = { status: 'FAIL', checks: [], notes: [], consistency: [], checkedAt: new Date().toISOString() };
  let finishRead; waitBytes = new Promise(resolve => { finishRead = resolve; });
  await render([p]);
  // 45.43(승인 시안 WB2-Home · 사용자 결정): 홈의 '제안까지'는 세 줄뿐이고 손볼 곳은 내보내기 화면이 맡는다.
  assert.ok(!texts().some(t => /^손볼 곳/.test(t)), '홈에는 손볼 곳 줄이 없다');
  await act(async () => { finishRead(); await waitBytes; }); waitBytes = null;
  const expected = setIssues(p, [[1, 2]]);
  assert.equal(expected.length, 5);
  assert.ok(!texts().some(t => /^손볼 곳/.test(t)), '비교가 끝나도 홈에는 손볼 곳 줄이 없다');
  const count = reads;
  await press('개인 작품 이름'); await press('내보내기');
  assert.ok(texts().includes(`손볼 곳 ${expected.length}개`));
  assert.deepEqual(expected.map(c => c.label), tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel?.endsWith(' 고치기')).map(n => n.props.accessibilityLabel.replace(/ 고치기$/, '')));
  assert.equal(reads, count, 'opening export reuses path fingerprints');
  assert.ok(!texts().includes('남은 칸'));

  delete config.extra.purchases;
  await render(); await press('PRO 보기');
  assert.ok(storeCalls > 0, 'normal release still queries store');
  assert.equal(labelled('PRO 한 번 구매하기').length, 1);
  assert.equal(labelled('구매 복원').length, 1);
  assert.ok(!texts().some(t => t.includes('이번 테스트 버전에서는')));
  await act(async () => tree.unmount());
  console.log('PASS: C1/C2/C3/C7 app rendering — catalogs, contact links/fallback, async issue parity/cache, closed vs release purchase UI');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
