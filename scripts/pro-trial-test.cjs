// 비공개 테스트 PRO 체험(2026-10-04): 구매 닫힘 빌드에서만 켜지는 빌드 값. 저장소에 아무것도 쓰지 않는다.
//  · app.config.js — 기본 꺼짐, 구매가 열린 구성에서 켜려 하면 멈춤, 잘못된 값 거부
//  · release-check — 구매 열린 구성 + 체험 = FAIL, AAB 와 빌드 설정 불일치 = FAIL
//  · 화면 — 체험 안내 문구, 구매·복원·검수 스위치 없음, 'PRO 체험' 표시, 스토어 호출 0
//  · 그리기 — 부분 움직임(PRO)을 저장 창 없이 저장하고, 저장소에 이용권·검수 해제가 생기지 않음
//  · 실제 구매자 — 체험과 무관하게 이용권 그대로('PRO', 이용권 표시)
//  · 체험 꺼짐(같은 데이터) — 무료/PRO 제한 복귀, 체험 중 만든 PRO 움직임은 지워지지 않음
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { create, act } = require('react-test-renderer');
const { loader } = require('./load-ts.cjs');
const rc = require('./release-check.cjs');
global.IS_REACT_ACT_ENVIRONMENT = true;
global.__DEV__ = false;

// ── 1. 빌드 설정 ─────────────────────────────────────────────────────────────────────────────
const configPath = require.resolve('../app.config.js');
const envNames = ['EMOTICON_PRO_TRIAL', 'EMOTICON_PURCHASES', 'EMOTICON_INTERNAL_REVIEW'];
const saved = envNames.map(n => process.env[n]);
const build = env => { envNames.forEach(n => delete process.env[n]); Object.assign(process.env, env); delete require.cache[configPath]; return require(configPath)(); };
try {
  assert.equal(build({}).extra.proTrial, false, '기본값은 꺼짐');
  assert.equal(build({ EMOTICON_PURCHASES: 'closed' }).extra.proTrial, false, '구매 닫힘만으로는 켜지지 않는다');
  assert.equal(build({ EMOTICON_PURCHASES: 'closed', EMOTICON_PRO_TRIAL: '1' }).extra.proTrial, true, '명시적으로만 켜진다');
  assert.throws(() => build({ EMOTICON_PRO_TRIAL: '1' }), /EMOTICON_PURCHASES=closed/, '구매가 열린 구성에서는 켤 수 없다');
  assert.throws(() => build({ EMOTICON_PURCHASES: 'closed', EMOTICON_PRO_TRIAL: 'yes' }), /must be 1, 0 or unset/);
} finally { envNames.forEach((n, i) => saved[i] === undefined ? delete process.env[n] : process.env[n] = saved[i]); delete require.cache[configPath]; }

// ── 2. 출시 검사 ─────────────────────────────────────────────────────────────────────────────
const st = rows => Object.fromEntries(rows.map(r => [r.id, r.status]));
assert.equal(st(rc.checkConfig({ extra: {} })).pro_trial, 'PASS');
assert.equal(st(rc.checkConfig({ extra: { proTrial: true } })).pro_trial, 'FAIL', '정상 출시 구성 + 체험 = 실패');
assert.equal(st(rc.checkConfig({ extra: { purchases: 'closed', proTrial: true } })).pro_trial, 'PASS');
assert.equal(st(rc.checkConfig({ extra: { purchases: 'closed', proTrial: 'on' } })).pro_trial, 'FAIL');
assert.equal(st(rc.checkArtifact({ appConfig: { extra: { proTrial: true } } })).bundle_pro_trial, 'FAIL', 'AAB 안의 설정도 본다');
assert.equal(st(rc.checkArtifact({ appConfig: { extra: { purchases: 'closed', proTrial: true } } }, { extra: { purchases: 'closed' } })).bundle_pro_trial_match, 'FAIL', '빌드 설정과 다르면 실패');

// ── 3. 앱 ────────────────────────────────────────────────────────────────────────────────────
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
Object.assign(rn, { Keyboard: { addListener: () => ({ remove() {} }), dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android', Version: 36 }, useWindowDimensions: () => ({ width: 390, height: 844 }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} }, Linking: { openURL: async () => {} }, Vibration: { vibrate() {} } });
const png = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(360, 16); png.writeUInt32BE(360, 20);
const pngData = 'data:image/png;base64,' + png.toString('base64');
const config = { extra: { purchases: 'closed', internalReview: false, proTrial: true, privacyPolicyUrl: 'https://privacy.example/p', supportEmail: 'support@example.com' }, version: '1.0.0' };
const mocks = {
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'f://a', uri: 'f://a' }) }) } },
  'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-constants': { __esModule: true, default: { expoConfig: config } }, 'react-native-webview': { WebView },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => {} }, 'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  './src/components/image-analyzer': { ImageAnalyzer: () => null },
  './src/components/extra-composer': { ExtraComposer: React.forwardRef(() => null), placeInFrame: () => ({ x: 0, y: 0, w: 1, h: 1 }) },
  './src/components/motion-baker': { MotionBaker: React.forwardRef((props, ref) => { if (ref) ref.current = { bake: async () => ({ count: 8, fps: 10, loop: .8, delayMs: 100, data: 'data:image/gif;base64,R0lGODlh', bytes: 2048, droppedColours: 0, clipped: false }) }; return null; }) },
};
const realImages = loader(mocks)('src/services/images.ts');
const images = { dataUrl: async () => pngData, pickImages: async () => [], importBundledImage: async () => ({ path: 'g.png', width: 132, height: 132 }), savePainterWork: (...a) => realImages.savePainterWork(...a), saveCutout: () => ({}), saveMotionLoop: () => ({ path: 'image-m.gif', width: 360, height: 360 }), saveSubmitLoop: () => undefined };
const load = loader({ ...mocks, './src/services/images': images, '../services/images': images });
const App = load('App.tsx').default;
const { saveStore, loadStore } = load('src/services/storage.ts');
const { createProject } = load('src/project.ts');
const adapter = load('src/services/purchase-adapter.ts');
let storeCalls = 0;
adapter.useStoreModuleForTests({ initConnection: async () => { storeCalls++; return true; }, fetchProducts: async () => { storeCalls++; return []; }, getAvailablePurchases: async () => { storeCalls++; return []; }, requestPurchase: async () => { storeCalls++; } });

let tree;
const labelled = label => tree.root.findAll(n => (n.type === 'Pressable' || n.type === 'View') && n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
const press = async label => { const m = labelled(label); assert.ok(m.length >= 1, '버튼 없음: ' + label); await act(async () => m[0].props.onPress()); };
const tap = async id => { const m = tree.root.findAll(n => n.props.testID === id && typeof n.props.onPress === 'function'); assert.ok(m.length, 'testID 없음: ' + id); await act(async () => m[0].props.onPress()); };
const texts = () => tree.root.findAllByType('Text').map(n => [n.props.children].flat(9).filter(x => typeof x === 'string' || typeof x === 'number').join(''));
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
const settle = async (n = 8) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };
let rev = 0;
async function render(store) {
  if (tree) await act(async () => tree.unmount());
  // 저장소는 더 낮은 revision 을 받지 않는다(동시 저장 보호) — 시험마다 새 revision 으로 넣는다.
  saveStore({ ...store, revision: Date.now() + (++rev) });
  await act(async () => { tree = create(React.createElement(App)); });
  await settle();
}
// 칸을 열고 엔진이 준비된 척한다(움직임 장면을 실어서).
async function openSlot(number, motion) {
  await tap('slot-' + number);
  await message({ type: 'ready' });
  const init = sent().filter(m => m.type === 'init').at(-1);
  const layers = init.layers.map(l => ({ id: l.id, name: l.name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }));
  await message({ type: 'state', undo: true, redo: false, dirty: true, activeLayerId: layers.at(-1).id, activeReferenceId: null, caption: null, motion, layers, references: [] });
  await message({ type: 'initialized' });
  return layers;
}
// 엔진은 저장 응답에 지금 장면의 움직임을 함께 돌려준다(App 은 payload.motion 을 저장한다).
async function answerSave(motion) {
  const token = sent().filter(m => m.type === 'save').at(-1)?.token;
  assert.ok(token, '저장 요청이 엔진으로 갔다');
  await message({ type: 'save', token, dirty: true, data: pngData, metrics: { coverage: .2, transparent: true }, activeLayerId: 'draw-2', motion,
    layers: [{ id: 'draw-1', name: '몸', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, data: pngData }, { id: 'draw-2', name: '손', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, data: pngData }], references: [] });
  await settle(12);
}
const PRO_TRIAL = '비공개 테스트에서는 PRO 기능을 무료로 체험할 수 있어요. 정식 출시 시 일부 기능은 별도 구매가 필요합니다.';
const PART = { version: 1, speed: .5, strength: .5, parts: [{ id: 'p1', layerId: 'draw-2', effect: 'rotate', pivotX: .7, pivotY: .6, amount: 30, angle: 0, speed: .6, delay: 0 }] };

(async () => {
  const project = () => {
    const p = createProject('체험 세트', '몽이');
    files.set('document/emoticon-studio/image-a.png', png);
    p.slots[0].finalImage = { path: 'image-a.png', width: 360, height: 360 };
    p.slots[0].work = { version: 1, activeLayerId: 'draw-2', references: [], layers: [
      { id: 'draw-1', name: '몸', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, image: { path: 'image-a.png', width: 360, height: 360 } },
      { id: 'draw-2', name: '손', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, image: { path: 'image-a.png', width: 360, height: 360 } }] };
    return p;
  };

  // 3-0. 첫 실행 사용 안내(2026-10-05): 새 사용자에게 한 번, 건너뛰기/다 보기 모두 기록, 기존 사용자에게는 안 뜸, 설정에서 다시 보기
  await render({ version: 1, revision: 1, projects: [], palette: [] });
  assert.ok(texts().includes('사용 안내 1/3'), '새 사용자는 첫 실행에 안내를 본다');
  assert.ok(texts().includes('그리기'));
  await press('다음');
  assert.ok(texts().includes('사용 안내 2/3') && texts().some(t => t.includes('무료 움직임 6종')), '무료 범위를 실제 개수로 말한다');
  await press('건너뛰기');
  assert.ok(!texts().some(t => t.startsWith('사용 안내 ')), '건너뛰면 닫힌다');
  assert.equal(loadStore().store.introDone, true, '건너뛰기도 완료로 남는다');
  await render(loadStore().store);
  assert.ok(!texts().some(t => t.startsWith('사용 안내 ')), '다시 열어도 반복하지 않는다');
  await press('설정'); await press('사용 안내 다시 보기');
  assert.ok(texts().includes('사용 안내 1/3'), '설정에서 다시 볼 수 있다');
  await press('다음'); await press('다음');
  assert.ok(texts().includes(PRO_TRIAL), '체험 빌드에서는 마지막 장에 체험 안내');
  await press('시작하기');
  assert.ok(!texts().some(t => t.startsWith('사용 안내 ')));
  await render({ version: 1, revision: 1, projects: [project()], palette: [] });
  assert.ok(!texts().some(t => t.startsWith('사용 안내 ')), '이미 세트가 있는 사용자(기존·복원)에게는 띄우지 않는다');

  // 3-1. 체험 켜짐: 화면
  await render({ version: 1, revision: 1, projects: [project()], palette: [] });
  assert.ok(texts().includes('PRO 체험'), "홈 배지는 'PRO 체험'(산 것처럼 보이지 않게)");
  assert.ok(texts().includes('PRO 무료 체험 중 · 비공개 테스트'), '홈 공지 자리에 체험 안내 한 줄(팝업 아님)');
  assert.equal(tree.root.findAllByType('Modal').length, 0, '처음 열 때 팝업이 없다');
  await press('PRO 무료 체험 중 · 비공개 테스트');
  assert.ok(texts().includes('비공개 테스트에서는 PRO 기능을 무료로 체험할 수 있어요. 정식 출시 시 일부 기능은 별도 구매가 필요합니다.'), '안내 줄을 누르면 PRO 화면');
  await press('PRO 체험 계속하기');
  await press('PRO 보기');
  assert.ok(texts().includes('비공개 테스트에서는 PRO 기능을 무료로 체험할 수 있어요. 정식 출시 시 일부 기능은 별도 구매가 필요합니다.'));
  assert.ok(!texts().includes('이번 테스트 버전에서는 PRO 구매가 아직 열리지 않았어요. 무료 기능을 모두 쓸 수 있어요.'));
  for (const l of ['PRO 한 번 구매하기', '구매 복원', '결제 없이 검수용 PRO 켜기']) assert.equal(labelled(l).length, 0, l + ' 없음');
  assert.equal(labelled('PRO 체험 계속하기').length, 1);
  await press('PRO 체험 계속하기');
  await press('설정');
  assert.ok(texts().includes('PRO 체험 · 비공개 테스트'));
  assert.equal(labelled('검수용 PRO 켜기').length, 0, '검수용 스위치는 그려지지 않는다');
  await press('닫기');
  assert.equal(storeCalls, 0, '스토어 호출 0');

  // 3-2. 체험 켜짐: 부분 움직임(PRO)을 저장 창 없이 저장
  await press('체험 세트');
  await openSlot(1, PART);
  await press('저장');
  assert.ok(!texts().includes('PRO 효과는 저장되지 않아요'), '체험 중에는 PRO 저장 창이 뜨지 않는다');
  await answerSave(PART);
  let disk = loadStore().store;
  assert.deepEqual(disk.projects[0].slots[0].motion?.parts?.map(p => p.effect), ['rotate'], '부분 움직임이 저장됐다');
  assert.equal(disk.entitlement, undefined, '이용권(구매 기록)이 생기지 않았다');
  assert.equal(disk.reviewUnlock, undefined, '검수용 해제가 생기지 않았다');
  assert.ok(!JSON.stringify(disk).includes('proTrial'), '체험은 저장소에 쓰이지 않는다');

  // 3-3. 같은 데이터로 체험 꺼짐(정식 빌드로 업데이트한 경우)
  config.extra.proTrial = false;
  await render(disk);
  assert.ok(texts().includes('PRO 보기'), '무료 배지로 돌아온다');
  assert.ok(!texts().includes('PRO 무료 체험 중 · 비공개 테스트'), '체험이 꺼지면 안내 줄도 없다');
  await press('PRO 보기');
  assert.ok(texts().includes('이번 테스트 버전에서는 PRO 구매가 아직 열리지 않았어요. 무료 기능을 모두 쓸 수 있어요.'));
  await press('무료로 계속하기');
  await press('체험 세트');
  // 이미 저장된 PRO 움직임을 그대로 두고 저장 → 창 없이 저장되고 움직임이 남는다(원본 보존).
  await openSlot(1, disk.projects[0].slots[0].motion);
  await press('저장');
  assert.ok(!texts().includes('PRO 효과는 저장되지 않아요'), '바꾸지 않은 PRO 움직임은 새 PRO 가 아니다');
  await answerSave(disk.projects[0].slots[0].motion);
  disk = loadStore().store;
  assert.deepEqual(disk.projects[0].slots[0].motion?.parts?.map(p => p.effect), ['rotate'], '체험 중 만든 PRO 움직임이 지워지지 않았다');
  // 새로 PRO 를 바꾸면 막힌다(제한 복귀). 창을 닫으면 아무것도 바뀌지 않는다.
  await act(async () => tree.unmount()); tree = null;
  await render(disk);
  await press('체험 세트');
  await openSlot(1, { ...PART, parts: [{ ...PART.parts[0], amount: 45 }] });
  await press('저장');
  assert.ok(texts().includes('PRO 효과는 저장되지 않아요'), '체험이 꺼지면 새 PRO 변경은 다시 막힌다');
  assert.deepEqual(loadStore().store.projects[0].slots[0].motion?.parts?.[0]?.amount, 30, '창만 뜨고 저장된 원본은 그대로');

  // 3-4. 실제 구매자: 체험 설정과 무관하게 이용권 유지, 체험이 이용권을 바꾸지 않음
  const bought = { plan: 'lifetime', source: 'store', verified: true, checkedAt: '2026-10-01T00:00:00.000Z' };
  for (const trial of [true, false]) {
    config.extra.proTrial = trial;
    await render({ version: 1, revision: 1, projects: [], palette: [], entitlement: bought });
    assert.ok(texts().includes('PRO') && !texts().includes('PRO 체험'), `구매자는 'PRO'(체험 ${trial})`);
    assert.deepEqual(loadStore().store.entitlement, bought, '이용권은 그대로');
  }
  await act(async () => tree.unmount());
  console.log('PASS: closed-test PRO trial — off by default, closed builds only, release-check guard, no purchase records, saves PRO work, trial off restores limits without touching saved PRO work, real purchase kept');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
