// 45.17차 표현 가이드 흐름. "표현 가이드는 창작자의 내비게이션이다" 를 화면 동작으로 확인한다.
//   감정 선택 → 여러 표현 보기 → 예시 선택 → ① 참고하며 그리기(떠 있는 작은 창) / ② 밑그림으로 넣기(참고 레이어).
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
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
  delete() { files.delete(this.uri); }
}
const commands = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n]));
const alerts = [];
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
  importBundledImage: async module => { imported.push(module); return { path: 'guide-' + (imported.length) + '.png', width: 1024, height: 1024 }; },
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
    examples: card.examples.map(({ artwork: _delivered, ...x }) => on && (x.id.endsWith('-polite') || x.id.endsWith('-friendly')) ? { ...x, artwork: art(x.id) } : x),
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
  const next = { ...scene, references: refs, activeReferenceId: toggled ? toggled.id : null };
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
  saveStore({ version: 1, revision: 1, projects: [], palette: [] });
  await render(withArt(false));
  await press('표현 가이드');
  assert.equal(labelled('고마워 · 두 손 모아 꾸벅').length, 1, '감정 카드는 예전처럼 하나의 누를 곳이다');
  await press('고마워 · 두 손 모아 꾸벅');
  const blank = byTestID('표현 예시 목록');
  assert.equal(blank.length, 1, '감정을 고르면 그 감정의 여러 표현이 펼쳐진다');
  const blankTexts = texts(blank[0]);
  for (const x of card.examples) { assert.ok(blankTexts.includes(x.label), x.label + ' 이름'); assert.ok(blankTexts.includes(x.hint), x.label + ' 힌트'); }
  assert.equal(blankTexts.filter(t => t === '그림 준비 중이에요').length, 5, '그림이 없는 표현 다섯은 모두 준비 중이다');
  assert.equal(labelled('정중하게 참고하며 그리기').length + labelled('정중하게 밑그림으로 넣기').length, 0, '그림이 없으면 두 버튼이 아예 없다(눌러서 빈 창이 뜨지 않는다)');
  await press('표현 가이드로');
  assert.equal(byTestID('표현 예시 목록').length, 0, '뒤로 누르면 감정 목록으로 돌아온다');
  assert.equal(byTestID('표현 가이드 카드').length, 1, '돌아온 자리는 기존 카드 격자 그대로다');

  // ── 3. 테스트 그림 두 장: 고른 표현의 그림·힌트가 그 표현에만 간다 ─────────────────────────
  const project = createProject('가이드 세트', '콩이');
  saveStore({ version: 1, revision: 2, projects: [project], palette: [] });
  const App = withArt(true);
  await render(App);
  await press('표현 가이드');
  await press('고마워 · 두 손 모아 꾸벅');
  const list = byTestID('표현 예시 목록')[0];
  const shown = list.findAllByType('Image').map(n => n.props.source && n.props.source.uri).filter(Boolean);
  assert.deepEqual(shown, ['test-art://greeting-thanks-polite', 'test-art://greeting-thanks-friendly'], '그림은 자기 표현 칸에만, 차례대로 뜬다');
  assert.equal(texts(list).filter(t => t === '그림 준비 중이에요').length, 3, '그림이 없는 나머지 셋은 준비 중 그대로다');
  assert.equal(labelled('정중하게 참고하며 그리기').length, 1, '그림이 있으면 ① 참고하며 그리기');
  assert.equal(labelled('정중하게 밑그림으로 넣기').length, 1, '그림이 있으면 ② 밑그림으로 넣기');
  assert.equal(labelled('감격해서 참고하며 그리기').length, 0, '그림 없는 표현에는 버튼이 생기지 않는다');

  // ── 4. ① 참고하며 그리기: 떠 있는 작은 창 ─────────────────────────────────────────────
  commands.length = 0;
  await press('정중하게 참고하며 그리기');
  await ready();
  const win = () => byTestID('표현 예시 참고 창')[0];
  assert.ok(win(), '고른 표현이 캔버스 위 작은 창으로 뜬다');
  assert.equal(win().findAllByType('Image')[0].props.source.uri, 'test-art://greeting-thanks-polite', '창에 뜨는 그림은 고른 표현의 것이다');
  assert.ok(texts(win()).includes('고마워 · 정중하게'), '창 제목은 감정 · 표현이다');
  assert.ok(texts(win()).includes('두 손 모으고 깊게 꾸벅'), '고른 표현의 힌트가 그대로 전달된다');
  assert.notEqual(win().props.pointerEvents, 'none', '창은 손가락을 받는다 — 덮은 자리에서 캔버스가 대신 받지 않는다');

  // 옮기기: 손잡이에서만 끌린다. 끄는 동안 캔버스로 나가는 명령이 없다.
  const handle = () => byTestID('표현 예시 손잡이')[0];
  assert.equal(handle().props.onStartShouldSetResponder(), true, '손잡이가 손가락을 잡는다(캔버스로 흘러가지 않는다)');
  const spotOf = () => ({ x: win().props.style.left, y: win().props.style.top });
  const width = win().props.style.width;
  const before = spotOf(), quiet = commands.length;
  await act(async () => { handle().props.onResponderGrant({ nativeEvent: { pageX: 100, pageY: 100 } }); });
  await act(async () => { handle().props.onResponderMove({ nativeEvent: { pageX: 130, pageY: 60 } }); });
  const moved = spotOf();
  assert.deepEqual([moved.x - before.x, moved.y - before.y], [30, -40], '손잡이를 끌면 창이 손가락만큼 움직인다');
  assert.equal(commands.length, quiet, '창을 옮기는 동안 캔버스로 나간 명령이 없다(선이 그어지지 않는다)');
  // 화면 밖으로 내보내지 않는다.
  await act(async () => { handle().props.onResponderMove({ nativeEvent: { pageX: 9000, pageY: 9000 } }); });
  const far = spotOf();
  assert.ok(far.x >= 8 && far.x + width <= 390, '오른쪽으로 아무리 끌어도 창이 화면 밖으로 나가지 않는다: ' + far.x);
  assert.ok(far.y >= 8 && far.y <= 844, '세로도 화면 안에 남는다: ' + far.y);
  await act(async () => { handle().props.onResponderMove({ nativeEvent: { pageX: -9000, pageY: -9000 } }); });
  assert.deepEqual([spotOf().x, spotOf().y], [8, 8], '왼쪽·위로 끌어도 가장자리에서 멈춘다');

  // 접기 → 다시 펼치기 → 닫기 → 참고 줄에서 다시 열기
  await press('표현 예시 접기');
  assert.equal(win().findAllByType('Image').length, 0, '접으면 그림이 물러나고 손잡이 줄만 남는다');
  assert.ok(texts(win()).includes('고마워 · 정중하게'), '접혀 있어도 무엇을 고른 것인지 읽힌다');
  await press('표현 예시 펼치기');
  assert.equal(win().findAllByType('Image').length, 1, '다시 열면 그림이 돌아온다');
  await press('표현 예시 닫기');
  assert.equal(byTestID('표현 예시 참고 창').length, 0, '닫으면 창이 사라진다');
  await press('참고');
  await press('표현 예시 참고 창 열기');
  assert.equal(byTestID('표현 예시 참고 창').length, 1, '닫은 뒤에도 참고 줄에서 다시 열 수 있다(길이 끊기지 않는다)');

  // ── 5. ② 밑그림으로 넣기: 기존 참고 레이어 길을 그대로 쓴다 ───────────────────────────────
  commands.length = 0; imported.length = 0;
  await render(App);
  await press('표현 가이드');
  await press('고마워 · 두 손 모아 꾸벅');
  await press('친근하게 밑그림으로 넣기');
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
  assert.equal(sent().filter(m => ['addLayer', 'removeLayer', 'importDrawing'].includes(m.type)).length, 0, '밑그림은 그림 레이어를 만들거나 지우거나 덮어쓰지 않는다');
  scene = await echoReferences(scene);
  assert.equal(scene.layers.length, 1, '그림 레이어는 그대로 한 장이다 — 실제 그림은 따로 그린다');
  assert.equal(scene.activeLayerId, 'draw-1', '손이 가는 곳은 여전히 그림 레이어다');
  // 위치·크기·진하기·숨김·삭제는 기존 참고 조절이 맡는다.
  assert.ok(byTestID('참고 진하기').length >= 1, '진하기 조절이 붙어 있다');
  assert.equal(labelled('참고 숨기기').length, 1, '숨기기가 붙어 있다');
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
  const saveBody = saveLine.slice(saveLine.indexOf('const out=bitmap()'), saveLine.indexOf('layers:layers.map'));
  assert.ok(/layers\.forEach\(l=>composite\(g,l\)\)/.test(saveBody), '저장 그림은 그림 레이어만 합친다');
  assert.ok(!/references\.forEach/.test(saveBody), '저장 그림에 참고(밑그림)를 합치지 않는다');
  const loop = engine.slice(engine.indexOf('function buildLoop'), engine.indexOf('const gif=encodeGif'));
  assert.ok(/layers\.forEach\(l=>composite\(g,l,/.test(loop) && !/references\.forEach/.test(loop), '움직이는 파일도 그림 레이어만 담는다');
  // 작품 썸네일은 저장된 완성 그림을 쓴다. 저장 그림에 밑그림이 없으므로 썸네일에도 없다.
  const appSrc = fs.readFileSync('App.tsx', 'utf8');
  assert.ok(appSrc.indexOf('(cover.motionImage ?? cover.finalImage)!.path') >= 0, '작품 썸네일은 저장된 완성 그림을 쓴다(참고를 따로 얹지 않는다)');
  // 참고 창은 화면 위의 안내다 — 저장 경로 어디에도 끼어들지 않는다.
  const painterSrc = fs.readFileSync('src/painter/painter.tsx', 'utf8');
  assert.ok(!/GuideWindow[\s\S]{0,400}toDataURL/.test(painterSrc), '참고 창은 그림으로 구워지지 않는다');

  await act(async () => tree.unmount());
  console.log('PASS: guide flow — 고마워 다섯 표현의 ID·이름·힌트, 그림 없는 표현의 준비 중과 잠긴 버튼, 고른 표현의 그림·힌트 전달, 참고 창 옮기기(화면 밖 이탈 없음)·접기·다시 열기·닫기와 캔버스 입력 분리, 밑그림의 기존 참고 레이어 재사용(30%·중앙·별도 그림 레이어·조절·삭제), 저장 그림·움직임·썸네일 제외를 확인했다. Native/WebView mocked.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
