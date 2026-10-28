// 45.17차 표현 가이드 흐름. "표현 가이드는 창작자의 내비게이션이다" 를 화면 동작으로 확인한다.
//   감정 선택 → 표현 격자에서 하나 고르기 → ① 참고 보기(떠 있는 작은 창) / ② 밑그림 넣기(참고 레이어).
//   그림이 아직 없는 예시는 '준비 중'이고 두 버튼이 아예 없다 — 없는 파일을 require 하지 않는다.
//   밑그림은 기존 참고 레이어 길을 그대로 쓴다: 그림 레이어와 따로 쌓이고, 최종 PNG·움직이는 파일·썸네일에 들어가지 않는다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PNG } = require('pngjs');
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
  async bytes() { return this.bytesSync(); }
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
  delete() { files.delete(this.uri); }
}
const commands = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n])); rn.Animated = require('./_rn-animated-mock.cjs');
const alerts = [];
let failImport = false;   // 넣기가 실패했을 때 부분 성공이 남지 않는지 보려고 켠다
Object.assign(rn, {
  Keyboard: { addListener: () => ({ remove() {} }), dismiss() {}, isVisible: () => false },
  StyleSheet: { create: x => x }, Platform: { OS: 'android' },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
  BackHandler: { addEventListener: () => ({ remove() {} }) },
  AppState: { addEventListener: () => ({ remove() {} }) },
  Alert: { alert: (...a) => alerts.push(a) }, Linking: { openURL: async () => {} },
});
const png = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(360, 16); png.writeUInt32BE(360, 20);
const pngData = 'data:image/png;base64,' + png.toString('base64');
const mocks = {
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'bundled://art', uri: 'bundled://art' }) }) } },
  'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-constants': { default: { expoConfig: { extra: {} } } }, 'react-native-webview': { WebView },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => {} }, 'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  './src/components/image-analyzer': { ImageAnalyzer: () => null },
  './src/components/extra-composer': { ExtraComposer: React.forwardRef(() => null), placeInFrame: () => ({ x: 0, y: 0, w: 1, h: 1 }) },
  './src/components/motion-baker': { MotionBaker: React.forwardRef(() => null) },
};
const real = loader(mocks)('src/services/images.ts');
// 번들 그림을 들여오는 일만 가로챈다(네이티브 변환은 이 환경에 없다). 어떤 그림이 넘어왔는지는 그대로 기록한다.
const imported = [];
const images = {
  dataUrl: async () => pngData, pickImages: async () => [],
  importBundledImage: async module => { if (failImport) throw new Error('그림을 찾지 못했어요 (1단계)'); imported.push(module); return { path: 'guide-' + (imported.length) + '.png', width: 1024, height: 1024 }; },
  savePainterWork: (...a) => real.savePainterWork(...a), saveCutout: (...a) => real.saveCutout(...a),
  saveMotionLoop: () => ({ path: 'moving.gif', width: 360, height: 360 }), saveSubmitLoop: () => undefined,
};
const base = { ...mocks, './src/services/images': images, '../services/images': images };
const plain = loader(base);
const { saveStore } = plain('src/services/storage.ts');
const { createProject } = plain('src/project.ts');
const design = plain('src/design/asset-slots.ts');

// 테스트 그림은 두 표현에만 건다(정중하게 · 친근하게). 나머지 셋은 그림 없는 상태 그대로 둔다.
// 제품 파일에는 그림을 넣지 않는다 — 여기서 자료만 바꿔 끼운다.
const art = id => ({ uri: 'test-art://' + id });
const withArt = on => {
  const cards = design.EXPRESSION_GUIDE.cards.map(card => card.examples ? {
    ...card,
    // 실제 납품분을 먼저 비운다 — 이 스위트는 '그림이 있다/없다'는 구조를 보는 것이지 납품 여부를 보는 게 아니다.
    // 표시용(display)도 함께 비운다 — 납품분 그림이 이 스위트의 '그림 없음' 상태를 덮지 않게.
    examples: card.examples.map(({ artwork: _delivered, display: _shown, ...x }) => on && (x.id.endsWith('-polite') || x.id.endsWith('-friendly')) ? { ...x, artwork: art(x.id) } : x),
  } : card);
  const patched = { ...design, EXPRESSION_GUIDE: { ...design.EXPRESSION_GUIDE, cards } };
  return loader({ ...base, './src/design/asset-slots': patched, '../design/asset-slots': patched })('App.tsx').default;
};

let tree;
const labelled = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const press = async label => { const m = labelled(label); assert.equal(m.length, 1, 'button ' + label + ' (' + m.length + ')'); await act(async () => m[0].props.onPress()); };
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
const byTestID = id => tree.root.findAll(n => n.props.testID === id);
const texts = node => (node ?? tree.root).findAllByType('Text').map(n => [n.props.children].flat(9).filter(x => typeof x === 'string').join(''));
const render = async App => { if (tree) await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(App)); }); };
async function ready() {
  await message({ type: 'ready' });
  const init = sent().filter(m => m.type === 'init').at(-1);
  const scene = { type: 'state', undo: false, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null, caption: null, motion: null, layers: init.layers.map(l => ({ id: l.id, name: l.name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 })), references: [] };
  await message(scene); await message({ type: 'initialized' });
  return scene;
}
// 엔진이 돌려주는 상태를 흉내 낸다: 더한 참고가 목록에 들어오고, 켠 것 하나만 보인다.
async function echoReferences(scene) {
  const added = sent().filter(m => m.type === 'addReferences').at(-1);
  if (!added) return scene;
  const refs = added.references.map(r => ({ id: r.id, name: r.name, visible: false, opacity: r.opacity, x: r.x, y: r.y, scale: r.scale, rotation: r.rotation, path: r.path }));
  const toggled = sent().filter(m => m.type === 'toggleReference').at(-1);
  if (toggled) refs.forEach(r => { if (r.id === toggled.id) r.visible = true; });
  let layers = scene.layers;
  for (const m of sent().filter(m => m.type === 'addLayer')) {
    if (layers.some(l => l.id === m.id) || layers.length >= 4) continue;
    layers = [...layers, { id: m.id, name: m.name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }];
  }
  const active = layers.at(-1)?.id ?? scene.activeLayerId;
  const next = { ...scene, layers, activeLayerId: active, references: refs, activeReferenceId: toggled ? toggled.id : null };
  await message(next);
  return next;
}

(async () => {
  const card = design.EXPRESSION_GUIDE.cards.find(c => c.id === 'greeting-thanks');

  // ── 1. 자료: '고마워' 아래 다섯 표현. 기존 20개의 이름·힌트·차례는 건드리지 않는다 ────────────
  assert.deepEqual(card.examples.map(x => [x.id, x.label, x.hint]), [
    ['greeting-thanks-polite', '정중하게', '두 손 모으고 깊게 꾸벅'],
    ['greeting-thanks-moved', '감격해서', '눈물 맺힌 눈으로 선물 꼭 안기'],
    ['greeting-thanks-friendly', '친근하게', '엄지 척하며 씩 웃기'],
    ['greeting-thanks-grand', '과장해서', '바닥까지 큰절하기'],
    ['greeting-thanks-shy', '수줍게', '시선 피하며 작은 하트 내밀기'],
  ], "'고마워' 다섯 표현의 ID·이름·힌트");
  assert.equal(card.name + '/' + card.hint, '고마워/두 손 모아 꾸벅', '감정 카드의 이름·힌트는 그대로다');
  assert.equal(new Set(card.examples.map(x => x.id)).size, 5, '표현 ID 는 겹치지 않는다');
  for (const x of card.examples) assert.ok(x.id.startsWith(card.id + '-'), x.id + ': 표현 ID 는 카드 ID 에서 파생한다');
  // 45.17 에서는 고마워 하나뿐이었다. 45.19 에셋 삽입으로 20개 감정 모두 표현을 갖는다(아래 1-B 절이 수량을 본다).
  assert.equal(design.EXPRESSION_GUIDE.cards.filter(c => c.examples && c.examples.length).length, 20, '20개 감정 모두 표현 목록을 갖는다');
  assert.equal(design.EXPRESSION_GUIDE.cards.length, 20, '감정 카드 수는 그대로 20개');
  // 카드 자체의 그림(20장 썸네일)은 아직 없다 — ready 는 그 목록을 가리키므로 켜지 않는다.
  assert.equal(design.EXPRESSION_GUIDE.ready, false, '카드 그림이 오기 전에는 ready 를 켜지 않는다');
  assert.equal(design.EXPRESSION_GUIDE.cards.filter(c => c.artwork).length, 0, '카드 자체 그림은 아직 0장');
  // 45.18차 납품 확인: 파일이 실제로 있는 예시만 artwork 를 갖는다(없는 파일을 require 하지 않는다).
  for (const x of card.examples) {
    const file = 'assets/expression-guides/' + x.id + '.png';
    const exists = fs.existsSync(file);
    assert.equal(!!x.artwork, exists, x.id + ': 파일 존재와 artwork 연결이 어긋난다(파일 ' + exists + ')');
    if (!exists) continue;
    const png = PNG.sync.read(fs.readFileSync(file));
    assert.equal(png.width, png.height, x.id + ': 1:1 이어야 한다 (' + png.width + 'x' + png.height + ')');
    assert.equal(png.colorType, 6, x.id + ': 알파 채널이 있는 RGBA 여야 한다');
    let clear = 0, solid = 0, edge = 0;
    for (let i = 0; i < png.data.length; i += 4) { const a = png.data[i + 3]; if (!a) clear++; else if (a > 200) solid++; }
    // 가장자리 한 줄에 그림이 닿아 있으면 선·손발·소품이 잘렸다는 뜻이다.
    for (let x2 = 0; x2 < png.width; x2++) for (const y of [0, png.height - 1]) if (png.data[(y * png.width + x2) * 4 + 3] > 32) edge++;
    for (let y2 = 0; y2 < png.height; y2++) for (const x2 of [0, png.width - 1]) if (png.data[(y2 * png.width + x2) * 4 + 3] > 32) edge++;
    assert.ok(clear > png.width * png.height * .5, x.id + ': 바탕이 투명해야 한다(투명 픽셀 ' + clear + ')');
    assert.ok(solid > 300, x.id + ': 읽을 수 있는 진한 선이 있어야 한다(진한 픽셀 ' + solid + ')');
    assert.equal(edge, 0, x.id + ': 그림이 가장자리에 닿았다 — 잘렸거나 여백이 없다');
  }
  const slotsSrc = fs.readFileSync('src/design/asset-slots.ts', 'utf8');
  assert.ok(/assets\/expression-guides\/<[^>]+>\.png/.test(slotsSrc), '파일 이름 규칙이 자료 파일에 적혀 있다(45.16차 카드 그림과 같은 자리)');
  // 다섯 장은 한 벌이다: 같은 틀·같은 배율이어야 나란히 놓았을 때 크기가 튀지 않는다.
  const delivered = card.examples.map(x => 'assets/expression-guides/' + x.id + '.png').filter(f => fs.existsSync(f));
  if (delivered.length) {
    const sides = new Set(delivered.map(f => { const g = PNG.sync.read(fs.readFileSync(f)); return g.width + 'x' + g.height; }));
    assert.equal(sides.size, 1, '납품된 예시는 모두 같은 틀이어야 한다: ' + [...sides].join(', '));
  }

  // ── 1-B. 45.19 에셋 삽입: 신규 76장 등록 검사 ────────────────────────────────────────
  //   기존 5장(고마워)은 그대로 두고, 나머지 감정 카드에 76장을 더했다. 여기서 보는 것:
  //   총 개수 · id 중복 · 그림 파일 중복 · 파일 없음 · 대소문자 · 카드 id 파생 규칙 · 기존 5장 불변.
  const EXPECTED_EXISTING_ASSETS = 5;
  const EXPECTED_NEW_ASSETS = 76;
  const GUIDE_DIR = 'assets/expression-guides';
  const allCards = design.EXPRESSION_GUIDE.cards;
  const allExamples = allCards.flatMap(c => (c.examples ?? []).map(x => ({ ...x, card: c })));
  const withArtwork = allExamples.filter(x => x.artwork);

  // 코드에 적힌 require 경로를 직접 읽는다(번들러 없이도 확인할 수 있게).
  const slotsSource = fs.readFileSync('src/design/asset-slots.ts', 'utf8');
  const requirePaths = [...slotsSource.matchAll(/artwork: require\('\.\.\/\.\.\/(assets\/expression-guides\/[^']+)'\)/g)].map(m => m[1]);
  const idsInSource = [...slotsSource.matchAll(/\{ id: '([^']+)', label: '[^']*', hint: '[^']*', artwork: require\('\.\.\/\.\.\/assets\/expression-guides\/([^']+)\.png'\) \}/g)];

  assert.equal(withArtwork.length, EXPECTED_EXISTING_ASSETS + EXPECTED_NEW_ASSETS,
    '그림이 붙은 표현은 기존 5 + 신규 76 = 81 이어야 한다: ' + withArtwork.length);
  assert.equal(requirePaths.length, EXPECTED_EXISTING_ASSETS + EXPECTED_NEW_ASSETS,
    'require 경로 수도 81 이어야 한다: ' + requirePaths.length);

  // id 중복 없음(전체 카드 통틀어)
  const allIds = allExamples.map(x => x.id);
  assert.equal(new Set(allIds).size, allIds.length,
    '예시 id 가 겹친다: ' + allIds.filter((v, i) => allIds.indexOf(v) !== i).join(', '));
  // 그림 파일 중복 없음 — 같은 그림을 두 표현이 쓰지 않는다
  assert.equal(new Set(requirePaths).size, requirePaths.length,
    '같은 그림 파일을 두 번 쓴다: ' + requirePaths.filter((v, i) => requirePaths.indexOf(v) !== i).join(', '));
  // 파일 없음 없음 + 대소문자까지 정확히 일치
  const onDisk = fs.readdirSync(GUIDE_DIR);
  for (const rel of requirePaths) {
    assert.ok(fs.existsSync(rel), 'require 대상 파일이 없다: ' + rel);
    const base = rel.slice(GUIDE_DIR.length + 1);
    assert.ok(onDisk.includes(base), '파일명 대소문자가 다르다: ' + base);
  }
  // id 는 카드 id 에서 파생한다 → 어느 감정의 표현인지 이름만 보고 안다
  for (const x of allExamples) assert.ok(x.id.startsWith(x.card.id + '-'), x.id + ': 카드 id 파생 규칙 위반(' + x.card.id + ')');
  // id 와 파일 이름이 같다 → 이름만으로 그림을 찾을 수 있다
  for (const [, id, file] of idsInSource) assert.equal(id, file, 'id 와 파일 이름이 다르다: ' + id + ' vs ' + file);
  // 20개 카드·5개 분류·이름·힌트·차례는 그대로다(위 1 절의 목록 검사가 이미 본다)
  assert.equal(allCards.length, 20, '감정 카드는 20개 그대로');
  assert.equal(design.EXPRESSION_GUIDE.categories.length, 5, '분류는 5개 그대로');
  // 기존 5장 회귀: id·label·hint·파일이 그대로여야 한다
  const thanks = allCards.find(c => c.id === 'greeting-thanks');
  assert.deepEqual(thanks.examples.map(x => x.id), [
    'greeting-thanks-polite', 'greeting-thanks-moved', 'greeting-thanks-friendly', 'greeting-thanks-grand', 'greeting-thanks-shy',
  ], '기존 고마워 5장의 id·차례가 바뀌었다');
  assert.equal(thanks.examples.filter(x => x.artwork).length, 5, '기존 고마워 5장의 그림 연결이 끊겼다');

  // 납품 파일 자체 검사(1:1 · RGBA · 투명 · 진한 선 · 가장자리 잉크 0)
  for (const rel of requirePaths) {
    const png = PNG.sync.read(fs.readFileSync(rel));
    assert.equal(png.colorType, 6, rel + ': RGBA 가 아니다');
    let clear = 0, solid = 0, edge = 0;
    for (let i = 0; i < png.data.length; i += 4) { const a = png.data[i + 3]; if (!a) clear++; else if (a > 200) solid++; }
    for (let x2 = 0; x2 < png.width; x2++) for (const y of [0, png.height - 1]) if (png.data[(y * png.width + x2) * 4 + 3] > 32) edge++;
    for (let y2 = 0; y2 < png.height; y2++) for (const x2 of [0, png.width - 1]) if (png.data[(y2 * png.width + x2) * 4 + 3] > 32) edge++;
    assert.ok(clear > png.width * png.height * .3, rel + ': 투명 바탕이 아니다');
    assert.ok(solid > 150, rel + ': 읽을 수 있는 진한 선이 없다');
    assert.equal(edge, 0, rel + ': 그림이 가장자리에 닿았다(잘림 또는 이웃 칸 오염)');
  }
  console.log('  에셋 등록: 기존 ' + EXPECTED_EXISTING_ASSETS + ' + 신규 ' + EXPECTED_NEW_ASSETS + ' = ' + withArtwork.length + ' · id/파일 중복 0 · 파일 없음 0 · 가장자리 잉크 0');

  // ── 2. 그림이 없을 때: 준비 중으로 두고 두 버튼을 내주지 않는다 ────────────────────────────
  saveStore({ version: 1, introDone: true, revision: 1, projects: [], palette: [] });
  await render(withArt(false));
  await press('표현 가이드');
  assert.equal(labelled('고마워 · 두 손 모아 꾸벅').length, 1, '감정 카드는 예전처럼 하나의 누를 곳이다');
  await press('고마워 · 두 손 모아 꾸벅');
  const blank = byTestID('표현 예시 목록');
  assert.equal(blank.length, 1, '감정을 고르면 그 감정의 여러 표현이 펼쳐진다');
  const blankTexts = texts(blank[0]);
  // 격자에는 짧은 이름만 둔다. 설명(hint)은 고른 뒤 아래 상태줄에서 한 줄로 읽힌다(아래 3절이 본다).
  for (const x of card.examples) assert.ok(blankTexts.includes(x.label), x.label + ' 이름');
  assert.equal(blankTexts.filter(t => t === '그림 준비 중이에요').length, 5, '그림이 없는 표현 다섯은 모두 준비 중이다');
  assert.equal(labelled('정중하게 고르기')[0].props.accessibilityState.disabled, true, '그림이 없는 표현은 고를 수 없다');
  assert.equal(labelled('참고 보기')[0].props.accessibilityState.disabled, true, '아무것도 못 골랐으니 참고 보기가 잠겨 있다');
  assert.equal(labelled('밑그림 넣기')[0].props.accessibilityState.disabled, true, '밑그림 넣기도 잠겨 있다');
  assert.ok(texts(byTestID('표현 고른 뒤')[0]).includes('표현을 골라 주세요'), '무엇을 해야 하는지 알려 준다');
  await press('표현 가이드로');
  assert.equal(byTestID('표현 예시 목록').length, 0, '뒤로 누르면 감정 목록으로 돌아온다');
  assert.equal(byTestID('표현 가이드 카드').length, 1, '돌아온 자리는 기존 카드 격자 그대로다');

  // ── 3. 테스트 그림 두 장: 고른 표현의 그림·힌트가 그 표현에만 간다 ─────────────────────────
  const project = createProject('가이드 세트', '콩이');
  saveStore({ version: 1, introDone: true, revision: 2, projects: [project], palette: [] });
  const App = withArt(true);
  await render(App);
  await press('표현 가이드');
  await press('고마워 · 두 손 모아 꾸벅');
  const list = byTestID('표현 예시 목록')[0];
  const shown = list.findAllByType('Image').map(n => n.props.source && n.props.source.uri).filter(Boolean);
  assert.deepEqual(shown, ['test-art://greeting-thanks-polite', 'test-art://greeting-thanks-friendly'], '그림은 자기 표현 칸에만, 차례대로 뜬다');
  assert.equal(texts(list).filter(t => t === '그림 준비 중이에요').length, 3, '그림이 없는 나머지 셋은 준비 중 그대로다');
  assert.equal(labelled('정중하게 고르기')[0].props.accessibilityState.disabled, false, '그림이 있으면 고를 수 있다');
  assert.equal(labelled('감격해서 고르기')[0].props.accessibilityState.disabled, true, '그림 없는 표현은 잠겨 있다');
  await press('정중하게 고르기');
  assert.equal(labelled('정중하게 고르기')[0].props.accessibilityState.selected, true, '고른 표현에 선택 표시');
  assert.ok(texts(byTestID('표현 고른 뒤')[0]).includes('두 손 모으고 깊게 꾸벅'), '고른 표현의 설명이 아래에 뜬다');
  assert.equal(labelled('참고 보기')[0].props.accessibilityState.disabled, false, '고른 뒤에 참고 보기가 열린다');
  assert.equal(labelled('밑그림 넣기')[0].props.accessibilityState.disabled, false, '고른 뒤에 밑그림 넣기가 열린다');
  assert.equal(tree.root.findAllByType('WebView').length, 0, '고르기만으로는 그리기에 들어가지 않는다');

  // ── 4. ① 참고 보기: 캔버스 밖 전용 자리 (45.25 정정) ─────────────────────────────────
  // 예전에는 캔버스 위에 떠 있는 창이었다. 실기기에서 그리는 자리를 덮어, 참고를 보려면 그림을 가려야 했다.
  // 이제 캔버스 **밖**에 제 자리로 선다. 옮기고 크기를 맞추는 일은 사라졌다 — 자리가 정해져 있기 때문이다.
  commands.length = 0;
  await press('참고 보기');
  await ready();
  const spot = () => byTestID('표현 예시 참고 자리')[0];
  assert.ok(spot(), '고른 표현이 캔버스 밖 제 자리에 선다');
  assert.equal(byTestID('표현 예시 참고 창').length, 0, '캔버스 위에 떠 있던 창은 더 이상 없다');
  assert.equal(spot().findAllByType('Image')[0].props.source.uri, 'test-art://greeting-thanks-polite', '자리에 뜨는 그림은 고른 표현의 것이다');
  assert.ok(texts(spot()).includes('고마워 · 정중하게'), '제목은 감정 · 표현이다');
  assert.ok(texts(spot()).includes('두 손 모으고 깊게 꾸벅'), '고른 표현의 힌트가 그대로 전달된다');
  // 캔버스 밖이라는 것을 자리로 확인한다: 참고 자리와 캔버스 틀이 같은 줄에 겹쳐 있지 않다.
  const canvasFrame = tree.root.findAll(n => n.type === 'View' && n.props.collapsable === false)[0];
  assert.ok(canvasFrame, '캔버스 틀을 찾았다');
  assert.equal(spot().findAllByType('WebView').length, 0, '참고 자리 안에 캔버스가 들어 있지 않다');
  assert.equal(canvasFrame.findAll(n => n.props.testID === '표현 예시 참고 자리').length, 0, '캔버스 틀 안에도 참고 자리가 들어 있지 않다');
  // 자리가 정해져 있으니 옮기거나 크기를 맞출 일이 없다 — 창을 짚은 손이 선을 그을 걱정도 함께 사라졌다.
  assert.equal(byTestID('표현 예시 손잡이').length, 0, '옮기는 손잡이가 없다');
  assert.equal(byTestID('표현 예시 크기 손잡이').length, 0, '크기 손잡이도 없다');
  // 참고 자리가 서면 아래 캔버스 영역이 그만큼 줄어야 한다. 기기가 주는 크기를 넣어 확인한다.
  // 덮어 뜨는 판(브러시·색)과 달리 이것은 **일부러** 캔버스를 줄인다 — 그래야 참고가 그림을 가리지 않는다.
  {
    // 45.35: 왼쪽 조절대의 홈도 flex:1 + onLayout 이라, 캔버스 영역은 이름으로 집는다.
    const area = () => tree.root.findAll(n => n.type === 'View' && n.props.testID === '캔버스 영역')[0];
    const square = () => tree.root.findAll(n => n.type === 'View' && n.props.collapsable === false)[0];
    await act(async () => area().props.onLayout({ nativeEvent: { layout: { width: 390, height: 300 } } }));
    const withRef = { ...square().props.style };
    assert.equal(withRef.width, withRef.height, '줄어든 자리에서도 캔버스는 정사각이다');
    assert.equal(withRef.width, 300 - 16, '남은 높이에 맞춰진다(min(폭, 높이) − 둘레 여백 8×2, 45.39)');
    await press('표현 예시 닫기');
    await act(async () => area().props.onLayout({ nativeEvent: { layout: { width: 390, height: 420 } } }));
    const without = { ...square().props.style };
    assert.equal(without.width, without.height, '닫은 뒤에도 정사각이다');
    assert.ok(without.width > withRef.width, '참고를 닫으면 캔버스가 다시 커진다: ' + withRef.width + ' → ' + without.width);
  }

  // 접기 → 다시 펼치기 → 닫기 → 참고 줄에서 다시 열기
  // 참고 줄이 이미 열려 있을 수도 있다 — 타일이 보일 때까지만 연다.
  if (!labelled('표현 예시 참고 자리 열기').length) await press('참고');
  await press('표현 예시 참고 자리 열기');
  await press('표현 예시 접기');
  assert.equal(spot().findAllByType('Image').length, 0, '접으면 그림이 물러나고 머리줄만 남는다');
  assert.ok(texts(spot()).includes('고마워 · 정중하게'), '접혀 있어도 무엇을 고른 것인지 읽힌다');
  await press('표현 예시 펼치기');
  assert.equal(spot().findAllByType('Image').length, 1, '다시 열면 그림이 돌아온다');
  await press('표현 예시 닫기');
  assert.equal(byTestID('표현 예시 참고 자리').length, 0, '닫으면 자리가 사라진다');
  if (!labelled('표현 예시 참고 자리 열기').length) await press('참고');
  await press('표현 예시 참고 자리 열기');
  assert.equal(byTestID('표현 예시 참고 자리').length, 1, '닫은 뒤에도 참고 줄에서 다시 열 수 있다(길이 끊기지 않는다)');

  // ── 5. ② 밑그림 넣기: 기존 참고 레이어 길을 그대로 쓴다 ──────────────────────────────────
  commands.length = 0; imported.length = 0;
  await render(App);
  await press('표현 가이드');
  await press('고마워 · 두 손 모아 꾸벅');
  await press('친근하게 고르기');
  await press('밑그림 넣기');
  let scene = await ready();
  const added = sent().filter(m => m.type === 'addReferences');
  assert.equal(added.length, 1, '밑그림은 한 번만 깔린다');
  assert.deepEqual(imported, [art('greeting-thanks-friendly')], '들여온 그림은 고른 표현의 것이다');
  const put = added[0].references[0];
  assert.equal(put.opacity, .3, '기본 진하기 30%');
  assert.equal(put.visible, false, '켜는 일은 기존 참고 명령(toggleReference)에 맡긴다');
  assert.deepEqual([put.x, put.y, put.scale, put.rotation], [0, 0, 1, 0], '가운데·원래 크기에서 시작한다(비율 유지 축소는 엔진의 기존 맞춤이 한다)');
  assert.ok(put.name.indexOf('밑그림 · ') === 0, '레이어 이름으로 밑그림임이 드러난다: ' + put.name);
  assert.equal(put.id, 'ref-' + put.path, '참고 ID 규칙(ref-<파일>)을 그대로 따른다 — 저장·복원이 같은 길로 돈다');
  assert.equal(sent().filter(m => m.type === 'toggleReference').at(-1).id, put.id, '깔자마자 이 밑그림이 보인다');
  // 45.25 정정: 밑그림을 깔면 그 위에 **빈 장을 하나** 만든다. 예전에는 아무것도 만들지 않아,
  // 따라 그리면 손이 닿는 곳이 이미 그린 장이라 그 장을 덮어썼다. 지우거나 덮어쓰는 명령은 여전히 없다.
  const madeLayers = sent().filter(m => m.type === 'addLayer');
  assert.equal(madeLayers.length, 1, '밑그림 한 번에 빈 장도 한 장만 생긴다');
  assert.equal(sent().filter(m => ['removeLayer', 'importDrawing'].includes(m.type)).length, 0, '기존 그림 장을 지우거나 덮어쓰지 않는다');
  assert.ok(sent().findIndex(m => m.type === 'addLayer') > sent().findIndex(m => m.type === 'addReferences'), '빈 장은 밑그림이 깔린 뒤에 생긴다(실패하면 생기지 않는다)');
  scene = await echoReferences(scene);
  assert.equal(scene.layers.length, 2, '밑그림 위에 빈 장이 한 장 생긴다');
  assert.equal(scene.activeLayerId, 'draw-2', '손이 가는 곳은 그 새 빈 장이다 — 바로 따라 그릴 수 있다');
  assert.equal(scene.layers[0].id, 'draw-1', '먼저 있던 장은 그대로 아래에 남는다');
  // 위치·크기·진하기·숨김·삭제는 기존 참고 조절이 맡는다.
  assert.ok(byTestID('참고 진하기').length >= 1, '진하기 조절이 붙어 있다');
  assert.equal(labelled('참고 숨기기').length, 1, '숨기기가 붙어 있다');

  // 같은 예시를 또 눌러도 밑그림이 두 장 쌓이지 않는다(45.21). 숨겨 뒀다면 다시 보여 주기만 한다.
  await press('표현 예시 참고 자리 열기');
  const beforeAgain = sent().filter(m => m.type === 'addReferences').length;
  const importedBefore = imported.length;
  await press('이 예시를 밑그림으로 넣기');
  const layersBefore = sent().filter(m => m.type === 'addLayer').length;
  assert.equal(sent().filter(m => m.type === 'addReferences').length, beforeAgain, '이미 깔린 밑그림을 또 들이지 않는다');
  assert.equal(imported.length, importedBefore, '그림을 다시 들여오지도 않는다');
  assert.equal(scene.references.length, 1, '참고는 한 장 그대로다');
  assert.equal(sent().filter(m => m.type === 'addLayer').length, layersBefore, '같은 밑그림을 다시 보일 때는 빈 장도 만들지 않는다');

  // ── 5-b. 부분 성공이 없는가 (45.26) ────────────────────────────────────────────────
  // ① 그림 장이 네 장이면 빈 장을 더 만들 수 없다. 그때 참고만 들어가고 **말없이** 끝나면
  //    사용자는 왜 따라 그릴 수 없는지 모른다. 밑그림은 들어가되 이유를 말해야 한다.
  {
    commands.length = 0; imported.length = 0; alerts.length = 0;
    await render(App);
    await press('표현 가이드');
    await press('고마워 · 두 손 모아 꾸벅');
    await press('정중하게 고르기');   // 이 스위트에서 그림이 걸린 것은 -polite/-friendly 둘뿐
    await press('밑그림 넣기');
    // 기기가 '이미 네 장'이라고 답한다.
    await message({ type: 'ready' });
    const init = sent().filter(m => m.type === 'init').at(-1);
    void init;
    await message({ type: 'state', undo: false, redo: false, dirty: false, activeLayerId: 'draw-4', activeReferenceId: null, caption: null, motion: null,
      layers: [1, 2, 3, 4].map(n => ({ id: 'draw-' + n, name: '그림 ' + n, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 })), references: [] });
    await message({ type: 'initialized' });
    await act(async () => {});
    // 45.26 정정: '밑그림만 들어가고 빈 장은 없음'은 성공이 아니다. 아무것도 하기 전에 말하고 돌아간다.
    assert.equal(sent().filter(m => m.type === 'addReferences').length, 0, '장이 다 찼으면 밑그림도 넣지 않는다');
    assert.equal(sent().filter(m => m.type === 'addLayer').length, 0, '빈 장도 만들지 않는다');
    assert.equal(sent().filter(m => ['removeLayer', 'importDrawing', 'removeReference'].includes(m.type)).length, 0, '기존 그림·참고를 건드리지 않는다');
    assert.equal(imported.length, 0, '그림 파일을 들여오지도 않는다 — 넣기 전에 멈춘다');
    assert.equal(alerts.length, 1, '왜 넣지 않았는지 한 번 말한다');
    assert.ok(alerts[0][1].includes('넣지 않았어요'), '넣지 않았다고 분명히 말한다: ' + alerts[0][1]);
    assert.ok(alerts[0][1].includes('지금 그림은 그대로'), '기존 그림이 안전하다고 알린다: ' + alerts[0][1]);
  }
  // ② 넣기 자체가 실패하면 참고도 빈 장도 남지 않는다.
  {
    commands.length = 0; imported.length = 0; alerts.length = 0;
    failImport = true;
    await render(App);
    await press('표현 가이드');
    await press('고마워 · 두 손 모아 꾸벅');
    await press('친근하게 고르기');
    await press('밑그림 넣기');
    await ready();
    await act(async () => {});
    assert.equal(sent().filter(m => m.type === 'addReferences').length, 0, '들여오기부터 실패하면 참고가 들어가지 않는다');
    assert.equal(sent().filter(m => m.type === 'addLayer').length, 0, '실패하면 빈 장도 남지 않는다');
    assert.equal(alerts.length, 1, '실패는 한 번 알린다');
    failImport = false;
  }

  await render(App);
  await press('표현 가이드');
  await press('고마워 · 두 손 모아 꾸벅');
  await press('친근하게 고르기');
  await press('밑그림 넣기');
  await ready();
  await echoReferences({ type: 'state', undo: false, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null, caption: null, motion: null,
    layers: [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }], references: [] });
  if (!labelled('참고 관리').length) await press('참고');
  await press('참고 관리');
  assert.ok(labelled('참고 삭제').length >= 1, '삭제가 붙어 있다');

  // 저장·복원은 기존 참고 정책이 맡는다: 밑그림도 세트의 참고 사진 자리에 들어가 있어야 저장 파일이 되살린다.
  await act(async () => { tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === '그리기 닫기')[0].props.onPress(); });
  const asked = sent().filter(m => m.type === 'save').at(-1);
  await message({
    type: 'save', token: asked.token, dirty: false, data: pngData, metrics: { coverage: .2, centerX: .5, centerY: .5, width: .4, height: .4, color: [0, 0, 0], transparent: true },
    activeLayerId: 'draw-1', caption: null, motion: null,
    layers: [{ id: 'draw-1', name: '그림 1', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, data: pngData }],
    references: scene.references.map(r => ({ id: r.id, name: r.name, visible: r.visible, opacity: r.opacity, x: r.x, y: r.y, scale: r.scale, rotation: r.rotation, path: r.path })),
  });
  assert.deepEqual(alerts.filter(a => String(a[0]).indexOf('저장') >= 0), [], '밑그림이 깔린 칸도 평소처럼 저장된다(참고 이미지를 찾지 못했다는 실패 없음)');
  commands.length = 0;
  // 그리기를 닫으면 보드로 돌아온다. 같은 칸을 다시 열어 저장 파일에서 복원되는지 본다.
  await act(async () => { byTestID('slot-1')[0].props.onPress(); });
  await message({ type: 'ready' });
  const back = sent().filter(m => m.type === 'init').at(-1);
  assert.equal(back.references.length, 1, '다시 열면 밑그림이 그대로 돌아온다');
  assert.equal(back.references[0].id, put.id, '되살아난 밑그림의 ID 가 같다');
  assert.equal(back.references[0].opacity, .3, '진하기도 저장된 값 그대로다');
  assert.equal(back.layers.length, 1, '그림 레이어 수는 밑그림 때문에 늘지 않는다');

  // ── 6. 밑그림은 작품이 아니다: 저장되는 그림·움직이는 파일·썸네일에 들어가지 않는다 ──────────
  const engine = fs.readFileSync('src/painter/canvas-html.ts', 'utf8');
  const saveLine = engine.split('\n').find(l => l.indexOf("m.type==='save'") >= 0);
  assert.ok(saveLine, '엔진의 저장 줄');
  // The RES engine exports at document size using docCanvas(), not its high-resolution bitmap().
  // 저장은 여러 줄이다(2026-10-28 toBlob): 저장 블록 시작부터 장 PNG 준비(layerJobs) 전까지가 완성본 합성 구간.
  const saveAt = engine.indexOf("if(m.type==='save')");
  const outputStart = engine.indexOf('const out=docCanvas()', saveAt);
  const outputEnd = engine.indexOf('layerJobs', outputStart);
  assert.ok(saveAt >= 0 && outputStart > saveAt && outputEnd > outputStart, '저장 합성 구간을 정확히 찾는다');
  const saveBody = engine.slice(outputStart, outputEnd);
  // 애니메이션(2026-10-15)이면 저장 그림은 첫 장(first)의 그림 레이어다.
  assert.ok(/(layers|first)\.forEach\(l=>composite\(g,l\)\)/.test(saveBody), '저장 그림은 그림 레이어만 합친다');
  assert.ok(!/references\.forEach/.test(saveBody), '저장 그림에 참고(밑그림)를 합치지 않는다');
  const loop = engine.slice(engine.indexOf('function buildLoop'), engine.indexOf('const gif=encodeGif'));
  assert.ok(/layers(At\(t\))?\.forEach\(l=>composite\(g,l,/.test(loop) &&!/references\.forEach/.test(loop), '움직이는 파일도 그림 레이어만 담는다');
  // 작품 썸네일은 저장된 완성 그림을 쓴다. 저장 그림에 밑그림이 없으므로 썸네일에도 없다.
  const appSrc = fs.readFileSync('App.tsx', 'utf8');
  assert.ok(appSrc.indexOf('(cover.motionImage ?? cover.finalImage)!.path') >= 0, '작품 썸네일은 저장된 완성 그림을 쓴다(참고를 따로 얹지 않는다)');
  // 참고 창은 화면 위의 안내다 — 저장 경로 어디에도 끼어들지 않는다.
  const painterSrc = fs.readFileSync('src/painter/painter.tsx', 'utf8');
  assert.ok(!/GuideWindow[\s\S]{0,400}toDataURL/.test(painterSrc), '참고 창은 그림으로 구워지지 않는다');

  // ── 7. 실제 등록분으로 진입 확인(45.20) ───────────────────────────────────────────────
  //   테스트용 자료가 아니라 **지금 제품에 등록된 그대로** 연다. ready=false 여도 막히지 않아야 한다.
  //   홈 → 감정 → 표현 목록 → 참고 창 / 밑그림 까지 실제로 간다.
  assert.equal(design.EXPRESSION_GUIDE.ready, false, '이 검사는 ready=false 상태에서 돈다');
  const RealApp = loader(base)('App.tsx').default;
  for (const [cardName, cardHint, exLabel] of [['안녕', '손 크게 흔들기', '손 흔들며'], ['잘 자', '이불 덮고 눕기', '이불 덮고']]) {
    const project = createProject('진입 세트 ' + cardName, '콩이');
    saveStore({ version: 1, introDone: true, revision: 100 + cardName.length, projects: [project], palette: [] });
    commands.length = 0;
    await render(RealApp);
    await press('표현 가이드');
    // 분류 칩을 눌러 그 감정이 있는 분류로 이동한다(임의 재분류 없이 등록된 분류 그대로).
    const card = design.EXPRESSION_GUIDE.cards.find(c => c.name === cardName);
    await press('표현 가이드 ' + card.category);
    assert.equal(labelled(cardName + ' · ' + cardHint).length, 1, cardName + ': 카드가 보인다');
    await press(cardName + ' · ' + cardHint);
    const list = byTestID('표현 예시 목록');
    assert.equal(list.length, 1, cardName + ': 표현 목록이 열린다(ready=false 여도 막히지 않는다)');
    assert.equal(list[0].findAllByType('Image').length, card.examples.length, cardName + ': 등록된 표현 수만큼 그림이 뜬다');
    assert.equal(labelled(cardName + ' · ' + cardHint).length, 0, cardName + ': 표현 목록에서는 감정 카드가 사라진다');
    assert.equal(texts(list[0]).filter(t => t === '그림 준비 중이에요').length, 0, cardName + ': 준비 중으로 막힌 표현이 없다');
    // ① 참고하며 그리기
    await press(exLabel + ' 고르기');
    await press('참고 보기');
    await ready();
    assert.equal(byTestID('표현 예시 참고 자리').length, 1, cardName + ': 참고가 캔버스 밖 제 자리에 선다');
    assert.ok(texts(byTestID('표현 예시 참고 자리')[0]).includes(cardName + ' · ' + exLabel), cardName + ': 제목이 고른 표현이다');
    await press('그리기 닫기');
    // ② 밑그림으로 넣기
    commands.length = 0; imported.length = 0;
    await render(RealApp);
    await press('표현 가이드');
    await press('표현 가이드 ' + card.category);
    await press(cardName + ' · ' + cardHint);
    await press(exLabel + ' 고르기');
    await press('밑그림 넣기');
    await ready();
    const put = sent().filter(m => m.type === 'addReferences');
    assert.equal(put.length, 1, cardName + ': 밑그림이 깔린다');
    assert.equal(put[0].references[0].opacity, .3, cardName + ': 기본 진하기 30%');
    assert.equal(imported.length, 1, cardName + ': 고른 표현의 그림이 들어온다');
    await press('그리기 닫기');
  }
  console.log('  진입 확인: ready=false 상태에서 홈 → 감정 → 표현 목록 → 참고 창 · 밑그림 모두 열림(안녕 · 잘 자)');

  // ── 8. Android 릴리스에서 번들 그림 들여오기(45.21) ──────────────────────────────────
  //   실기기에서 '밑그림을 넣지 못했어요' 가 났다. 원인은 릴리스 빌드에서만 생기는 조건이다:
  //   번들 그림이 drawable 리소스로 들어가면 expo-asset 이 <Image> 호환을 위해
  //   **파일 경로가 아니라 스킴 없는 리소스 이름**을 localUri 에 넣고 downloaded=true 로 표시한다.
  //   그러면 downloadAsync 가 그냥 돌아오고 실제 파일이 없어, 그 값을 파일로 아는 쪽이 실패한다.
  //   45.20 까지의 mock 은 언제나 file URI 를 돌려줘서 이 조건을 통과시켰다. 여기서 실제 동작을 흉내 낸다.
  {
    const made = [];
    const manipulated = [];
    // 릴리스의 expo-asset 을 그대로 흉내 낸다: 리소스 이름 + downloaded=true.
    // 표시를 지우고 downloadAsync 를 다시 부를 때만 진짜 파일이 생긴다.
    const releaseAsset = (name) => ({
      uri: name, localUri: name, downloaded: true, hash: 'h', type: 'png',
      async downloadAsync() {
        if (this.downloaded) return this;             // 표시가 남아 있으면 아무 일도 하지 않는다
        this.localUri = 'file:///cache/' + name + '.png';
        this.downloaded = true;
        return this;
      },
    });
    let asset = releaseAsset('assets_expressionguides_greetinghellowave');
    const releaseMocks = {
      ...mocks,
      'expo-asset': { Asset: { fromModule: () => asset } },
      'expo-image-manipulator': {
        SaveFormat: { PNG: 'png' },
        ImageManipulator: {
          manipulate(uri) {
            manipulated.push(uri);
            // 네이티브는 이 문자열을 Uri 로 파싱해 이미지 로더에 넘긴다.
            // 스킴이 없으면 파일 경로로 읽혀 실패한다 — 실기기에서 난 그 오류다.
            if (!String(uri).includes(':')) throw new Error('Could not load image from url: ' + uri);
            return {
              renderAsync: async () => ({
                saveAsync: async () => ({ uri: 'file:///cache/out.png', width: 132, height: 132 }),
                release() {},
              }),
              release() {},
            };
          },
        },
      },
      'expo-file-system': {
        Directory, Paths: { document: 'document' },
        File: class { constructor(...parts) { this.uri = parts.map(x => x.uri ?? x).join('/'); }
          get name() { return this.uri.split('/').pop(); }
          copy(dest) { made.push([this.uri, dest.name]); } },
      },
    };
    const releaseImages = loader(releaseMocks)('src/services/images.ts');

    const out = await releaseImages.importBundledImage(1);
    assert.equal(manipulated.length, 1, '그림은 한 번만 연다');
    assert.ok(manipulated[0].includes(':'), '릴리스에서도 스킴 있는 파일 경로를 넘겨야 한다(리소스 이름을 그대로 넘기면 기기에서 실패한다): ' + manipulated[0]);
    assert.equal(manipulated[0], 'file:///cache/assets_expressionguides_greetinghellowave.png', '리소스 이름이 아니라 내려받은 파일을 쓴다');
    assert.equal(made.length, 1, '앱 저장소로 한 번 복사한다');
    assert.deepEqual([out.width, out.height], [132, 132], '크기를 그대로 가져온다');
    assert.ok(out.path && !out.path.includes('/'), '앱 저장소 파일 이름을 돌려준다');

    // 내려받기까지 실패하면 조용히 넘어가지 않고 어느 칸에서 막혔는지 짧은 한글로 알린다.
    asset = { uri: 'assets_broken', localUri: 'assets_broken', downloaded: true, async downloadAsync() { return this; } };
    let failed = null;
    try { await loader(releaseMocks)('src/services/images.ts').importBundledImage(1); }
    catch (e) { failed = String(e.message); }
    assert.ok(failed, '파일을 못 만들면 실패로 알린다');
    assert.ok(/1단계/.test(failed), '몇 단계에서 막혔는지 알린다: ' + failed);
    assert.ok(/[가-힣]/.test(failed) && !/file:|http|Error|undefined/.test(failed), '사용자에게 내부 경로·오류 원문을 보여 주지 않는다: ' + failed);
  }
  console.log('  릴리스 조건: 리소스 이름을 파일로 오해하지 않고 내려받아 쓴다 · 실패 시 단계만 한글로 알린다');

  // ── 45.38 넣을 곳: 표현을 어느 세트의 몇 번 칸에 넣는지 행동 위에서 말하고, 바꿀 수 있다 ─────────────
  {
    const older = { ...createProject('예전 세트', '콩이'), updatedAt: '2026-01-01T00:00:00.000Z' };
    const newer = { ...createProject('최근 세트', '콩이'), updatedAt: '2026-09-01T00:00:00.000Z' };
    saveStore({ version: 1, introDone: true, revision: 9000, projects: [older, newer], palette: [] });   // 앞 단계 저장본보다 새 번호
    await render(withArt(true));
    await press('표현 가이드');
    await press('고마워 · 두 손 모아 꾸벅');
    await press('정중하게 고르기');
    const dest = () => texts(byTestID('표현 넣을 곳')[0]).join('');
    assert.ok(dest().includes('최근 세트 · 01번 칸'), '기본은 가장 최근 세트의 다음 빈 칸이고, 그렇게 적혀 있다: ' + dest());
    await press('넣을 곳 바꾸기');
    await press('넣을 곳 예전 세트');
    assert.ok(dest().includes('예전 세트 · 01번 칸'), '고른 세트로 바뀐다: ' + dest());
    await press('밑그림 넣기');
    await ready();
    assert.ok(tree.root.findAll(n => n.type === 'Text').some(n => [n.props.children].flat(9).join('') === '예전 세트'), '고른 세트의 칸이 열린다');
  }
  console.log('  넣을 곳 — 기본은 가장 최근 세트, 다른 세트로 바꾸면 그 세트의 다음 빈 칸이 열린다');

  await act(async () => tree.unmount());
  console.log('PASS: guide flow — 고마워 다섯 표현의 ID·이름·힌트, 그림 없는 표현의 준비 중과 잠긴 버튼, 고른 표현의 그림·힌트 전달, 참고 창 옮기기(화면 밖 이탈 없음)·접기·다시 열기·닫기와 캔버스 입력 분리, 밑그림의 기존 참고 레이어 재사용(30%·중앙·별도 그림 레이어·조절·삭제), 저장 그림·움직임·썸네일 제외를 확인했다. Native/WebView mocked.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
