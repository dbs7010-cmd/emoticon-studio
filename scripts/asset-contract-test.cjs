// 45.3차 에셋 자리 계약. "자리 이름이 있다"가 아니라 **화면이 그 자리의 그림을 실제로 그리는가**를 본다.
//   자리 8개 각각: source 를 넣으면 그 화면에 그 그림이 뜨고, 없으면 지금 자리표시가 그대로 남는다.
//   화면 파일이 mascot 파일을 직접 들고 있으면(옛 방식) 실패한다 — 그러면 그림만 갈아 끼울 수 없기 때문이다.
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
  'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-constants': { default: { expoConfig: { extra: {} } } }, 'react-native-webview': { WebView },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => {} }, 'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  './src/components/image-analyzer': { ImageAnalyzer: () => null },
  './src/components/extra-composer': { ExtraComposer: React.forwardRef(() => null), placeInFrame: () => ({ x: 0, y: 0, w: 1, h: 1 }) },
  './src/components/motion-baker': { MotionBaker: React.forwardRef(() => null) },
};
const real = loader(mocks)('src/services/images.ts');
const images = { dataUrl: async () => pngData, pickImages: async () => [], savePainterWork: (...a) => real.savePainterWork(...a), saveCutout: (...a) => real.saveCutout(...a), saveMotionLoop: () => ({ path: 'moving.gif', width: 360, height: 360 }), saveSubmitLoop: () => undefined };
const base = { ...mocks, './src/services/images': images, '../services/images': images };
const plain = loader(base);
const { saveStore } = plain('src/services/storage.ts');
const { createProject } = plain('src/project.ts');
const slotSource = plain('src/design/asset-slots.ts');

// 자리 8개. 각각 어느 화면에서 그려지는지가 계약의 핵심이다.
const SLOTS = ['homeHeroArtwork', 'homeEmptyArtwork', 'noticeArtwork', 'referencePoseThumbnail', 'expressionGuideArtwork', 'motionExampleArtwork', 'exportSuccessArtwork', 'proFeatureArtwork'];
const mark = name => 'slot://' + name;
// 같은 앱을 자료만 바꿔 두 번 그린다: ① 그림이 들어온 상태 ② 아직 자리표시인 상태.
const withSources = (on) => {
  const slots = Object.fromEntries(Object.entries(slotSource.ASSET_SLOTS).map(([name, spec]) => [name, {
    ...spec,
    source: on ? { uri: mark(name) } : null,
    ...(spec.sourceAfter !== undefined ? { sourceAfter: on ? { uri: mark(name) + '#after' } : null } : {}),
  }]));
  const design = { ...slotSource, ASSET_SLOTS: slots, HOME_NOTICE: { ...slotSource.HOME_NOTICE, enabled: true, title: '공지', body: '한 줄' } };
  return loader({ ...base, './src/design/asset-slots': design, '../design/asset-slots': design })('App.tsx').default;
};

let tree, scene, revision = 0;
const all = () => tree.root.findAll(() => true);
const labelled = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const press = async label => { const m = labelled(label); assert.equal(m.length, 1, 'button ' + label + ' (' + m.length + ')'); await act(async () => m[0].props.onPress()); };
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
const byTestID = id => tree.root.findAll(n => n.props.testID === id);
const uris = () => tree.root.findAll(n => n.type === 'Image').map(n => n.props.source?.uri).filter(Boolean);
const drawn = (path) => ({ path, width: 360, height: 360 });
async function ready() {
  await message({ type: 'ready' });
  const init = sent().filter(m => m.type === 'init').at(-1);
  scene = { type: 'state', undo: false, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null, caption: null, motion: null, layers: init.layers.map(l => ({ id: l.id, name: l.name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 })), references: [] };
  await message(scene); await message({ type: 'initialized' });
}
const render = async App => { if (tree) await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(App)); }); };

// 두 상태에서 같은 자리를 훑는다. seen: 어느 자리의 그림이 화면에 실제로 떴는가.
async function walk(App, { sourcesOn }) {
  const seen = new Set();
  const note = () => uris().forEach(u => { const hit = SLOTS.find(name => u === mark(name) || u === mark(name) + '#after'); if (hit) seen.add(u); });

  // ① 홈(세트 0) — 창작 표면 · 빈 상태 · 공지
  saveStore({ version: 1, revision: ++revision, projects: [], palette: [] });
  await render(App);
  note();
  const home = { hero: byTestID('asset-slot-homeHeroArtwork').length, empty: byTestID('asset-slot-homeEmptyArtwork').length, notice: byTestID('asset-slot-noticeArtwork').length };

  // ② 표현 가이드 카드
  await press('표현 가이드');
  note();
  const guide = byTestID('asset-slot-expressionGuideArtwork').length;
  await press('홈으로');

  // ③ PRO 화면(전·후 두 장)
  await press('PRO 보기');
  note();
  const proLabels = tree.root.findAll(n => n.type === 'Text').map(n => [n.props.children].flat(9).filter(x => typeof x === 'string').join(''));
  assert.ok(proLabels.includes('전체 움직임') && proLabels.includes('눈·팔·몸만'), 'PRO 비교 표면은 두 상태 모두에서 그대로 있다');
  await press('PRO 닫기');

  // ④ 그리기: 빈 칸의 움직임 견본 · 기본 레퍼런스 격자
  const project = createProject('계약 세트', '콩이');
  saveStore({ version: 1, revision: ++revision, projects: [project], palette: [] });
  await render(App);
  await press('계약 세트');
  await act(async () => byTestID('slot-1')[0].props.onPress());
  await ready();
  await press('참고');
  await press('기본 레퍼런스');
  note();
  const poseCells = byTestID('기본 레퍼런스 자리').length;
  const poseArt = byTestID('기본 레퍼런스 자리')[0].findAll(n => n.type === 'Image').length;
  await press('내 사진');
  await press('참고');
  await press('움직이기');
  note();
  const sampleArt = labelled('통통')[0].findAll(n => n.type === 'Image').length;
  await press('그리기');
  await press('그리기 닫기');

  // ⑤ 내보내기: 다 채운 세트의 완성 그림
  const full = createProject('다 한 세트', '콩이');
  full.slots = full.slots.map(s => ({ ...s, finalImage: drawn('done-' + s.number + '.png'), done: true }));
  saveStore({ version: 1, revision: ++revision, projects: [full], palette: [] });
  await render(App);
  await press('다 한 세트');
  await press('내보내기');
  note();
  const success = byTestID('asset-slot-exportSuccessArtwork').length;

  return { seen, home, guide, poseCells, poseArt, sampleArt, success };
}

(async () => {
  // ── 1. 계약 자료: 자리마다 비율·표시 크기·권장 제작 해상도·안전 영역·바탕이 모두 적혀 있다 ─────
  assert.deepEqual(Object.keys(slotSource.ASSET_SLOTS).sort(), [...SLOTS].sort(), '에셋 자리 8개');
  for (const name of SLOTS) {
    const spec = slotSource.ASSET_SLOTS[name];
    assert.ok(spec.aspectRatio > 0, name + ': 비율');
    for (const key of ['display', 'sourceSize', 'safeArea']) assert.ok(typeof spec[key] === 'string' && spec[key].length > 4, name + ': ' + key);
    assert.ok(['transparent', 'opaque'].includes(spec.background), name + ': 바탕');
    assert.ok('source' in spec, name + ': source 자리');
  }
  assert.equal(slotSource.ASSET_SLOTS.exportSuccessArtwork.display, '84×84', '문서 크기와 화면 크기(size=84)가 같다');
  assert.ok('sourceAfter' in slotSource.ASSET_SLOTS.proFeatureArtwork, 'PRO 비교는 전·후 두 장을 자리에서 받는다');

  // ── 2. 그림을 넣으면 그 화면에 그 그림이 뜬다(자리 8개 전부) ───────────────────────────────
  const on = await walk(withSources(true), { sourcesOn: true });
  const missing = SLOTS.filter(name => !on.seen.has(mark(name)));
  assert.deepEqual(missing, [], '자리의 source 를 넣으면 그 화면이 그 그림을 그린다');
  assert.ok(on.seen.has(mark('proFeatureArtwork') + '#after'), 'PRO 비교의 두 번째 장(sourceAfter)도 그려진다');
  assert.equal(on.poseArt, 1, '기본 레퍼런스 칸은 자리의 그림을 그린다');
  assert.equal(on.sampleArt, 1, '움직임 견본도 자리의 그림을 쓴다');

  // ── 3. 그림이 아직 없으면 45.2 자리표시가 그대로다(레이아웃·칸 수 불변) ────────────────────
  const off = await walk(withSources(false), { sourcesOn: false });
  assert.equal(off.seen.size, 0, '자리표시 상태에서는 에셋 그림이 없다');
  assert.deepEqual(off.home, { hero: 1, empty: 1, notice: 1 }, '홈: 창작 표면·빈 상태·공지 모두 도형 자리표시가 그대로 그려진다');
  assert.ok(off.guide >= 4, '표현 가이드 카드마다 자리표시가 남는다');
  assert.equal(off.success, 1, '내보내기 완성 자리표시가 남는다');
  assert.deepEqual(on.home, { hero: 0, empty: 0, notice: 0 }, '그림이 들어오면 같은 자리를 그림이 대신한다(칸은 그대로)');
  assert.equal(on.success, 0, '내보내기 완성 자리도 그림으로 바뀐다');
  assert.equal(off.poseCells, on.poseCells, '기본 레퍼런스 칸 수가 그림 때문에 늘거나 줄지 않는다');
  assert.equal(off.poseArt, 0, '그림이 없으면 관절 인형 자리표시가 남는다');
  assert.equal(off.sampleArt, 1, '움직임 견본 칸은 그림이 없어도 빈 칸으로 깨지지 않는다');

  // ── 4. 화면 파일이 그림 파일을 직접 들고 있지 않다 — 그래야 파일만 갈아 끼울 수 있다 ──────────
  const screens = ['App.tsx', 'src/painter/painter.tsx', 'src/painter/motion-panel.tsx', 'src/components/ui.tsx'];
  for (const file of screens) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!/mascot-(paper|ink)\.png/.test(src), file + ': mascot 그림을 직접 참조하지 않는다(자리에서 받는다)');
    assert.ok(!/\bMASCOT\b/.test(src), file + ': MASCOT 직접 참조가 없다');
  }
  const slotsSrc = fs.readFileSync('src/design/asset-slots.ts', 'utf8');
  assert.ok(/mascot-paper\.png/.test(slotsSrc) && /mascot-ink\.png/.test(slotsSrc), '지금 쓰는 자리표시 그림은 asset-slots 한 곳에만 있다');
  const motionSrc = fs.readFileSync('src/painter/motion-panel.tsx', 'utf8');
  assert.ok(/ASSET_SLOTS\.motionExampleArtwork\.source/.test(motionSrc), '움직임 견본은 자리에서 받는다');
  const painterSrc = fs.readFileSync('src/painter/painter.tsx', 'utf8');
  assert.ok(/ASSET_SLOTS\.referencePoseThumbnail\.source/.test(painterSrc), '기본 레퍼런스 칸은 자리에서 받는다');
  const appSrc = fs.readFileSync('App.tsx', 'utf8');
  assert.ok(/ASSET_SLOTS\.proFeatureArtwork\.source/.test(appSrc) && /ASSET_SLOTS\.proFeatureArtwork\.sourceAfter/.test(appSrc), 'PRO 비교는 자리에서 받는다');

  await act(async () => tree.unmount());
  console.log('PASS: asset contract — 자리 8개(비율·표시 크기·권장 제작 해상도·안전 영역·바탕), source 를 넣으면 홈 히어로·빈 상태·공지·표현 가이드·기본 레퍼런스·움직임 견본·내보내기 완성·PRO 전후 두 장이 실제로 그려지고, 없으면 45.2 자리표시가 칸 수·자리 그대로 남는다. 화면 파일의 mascot 직접 참조 0. Native/WebView mocked.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
