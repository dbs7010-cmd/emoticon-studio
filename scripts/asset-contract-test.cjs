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
  async bytes() { return this.bytesSync(); }
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
  delete() { files.delete(this.uri); }
}
const commands = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n])); rn.Animated = require('./_rn-animated-mock.cjs');
Object.assign(rn, { Keyboard: { addListener: () => ({ remove() {} }), dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} }, Linking: { openURL: async () => {} } });
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
const real = loader(mocks)('src/services/images.ts');
const images = { dataUrl: async () => pngData, pickImages: async () => [], savePainterWork: (...a) => real.savePainterWork(...a), saveCutout: (...a) => real.saveCutout(...a), saveMotionLoop: () => ({ path: 'moving.gif', width: 360, height: 360 }), saveSubmitLoop: () => undefined };
const base = { ...mocks, './src/services/images': images, '../services/images': images };
const plain = loader(base);
const { saveStore } = plain('src/services/storage.ts');
const { createProject } = plain('src/project.ts');
const slotSource = plain('src/design/asset-slots.ts');

// 자리 8개. 각각 어느 화면에서 그려지는지가 계약의 핵심이다.
const SLOTS = ['homeHeroArtwork', 'noticeArtwork', 'referencePoseThumbnail', 'expressionGuideArtwork', 'motionExampleArtwork', 'exportSuccessArtwork', 'proFeatureArtwork'];
const mark = name => 'slot://' + name;
// 같은 앱을 자료만 바꿔 두 번 그린다: ① 그림이 들어온 상태 ② 아직 자리표시인 상태.
const withSources = (on) => {
  const slots = Object.fromEntries(Object.entries(slotSource.ASSET_SLOTS).map(([name, spec]) => [name, {
    ...spec,
    source: on ? { uri: mark(name) } : null,
    ...(spec.sourceAfter !== undefined ? { sourceAfter: on ? { uri: mark(name) + '#after' } : null } : {}),
  }]));
  // on: 앞의 두 카드에 카드 전용 그림을 건다(나머지는 대표 예시 그림으로 내려간다).
  // off: 카드 그림도 예시 그림도 없는 상태 — 이때만 따뜻한 자리표시가 남는다.
  const cards = slotSource.EXPRESSION_GUIDE.cards.map((card, index) => on
    ? { ...card, ...(index < 2 ? { artwork: { uri: mark('expressionGuideArtwork') + '#' + card.id } } : {}) }
    : { ...card, artwork: undefined, examples: undefined });
  // 기본 레퍼런스는 제품 화면에서 감춰 뒀지만(미완성), 자리 계약은 ready 를 켠 자료로 계속 본다.
  const design = { ...slotSource, ASSET_SLOTS: slots, EXPRESSION_GUIDE: { ...slotSource.EXPRESSION_GUIDE, cards }, BUILTIN_REFERENCES: { ...slotSource.BUILTIN_REFERENCES, ready: true }, HOME_NOTICE: { ...slotSource.HOME_NOTICE, enabled: true, title: '공지', body: '한 줄' } };
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
  const note = () => uris().forEach(u => {
    const hit = SLOTS.find(name => u === mark(name) || u === mark(name) + '#after' || u.startsWith(mark(name) + '#'));
    if (hit) { seen.add(u); seen.add(mark(hit)); }
  });

  // ① 홈(세트 0) — 창작 표면 · 빈 상태 · 공지
  saveStore({ version: 1, introDone: true, revision: ++revision, projects: [], palette: [] });
  await render(App);
  note();
  const home = { hero: byTestID('asset-slot-homeHeroArtwork').length, notice: byTestID('asset-slot-noticeArtwork').length };

  // ② 표현 가이드 카드
  await press('표현 가이드');
  note();
  const guide = byTestID('asset-slot-expressionGuideArtwork').length;
  const guideImages = uris().filter(uri => uri.startsWith(mark('expressionGuideArtwork') + '#'));
  const guideLabels = labelled('안녕 · 손 크게 흔들기').length + labelled('고마워 · 두 손 모아 꾸벅').length;
  await press('홈으로');

  // ③ PRO 화면(전·후 두 장)
  await press('PRO 보기');
  note();
  const proLabels = tree.root.findAll(n => n.type === 'Text').map(n => [n.props.children].flat(9).filter(x => typeof x === 'string').join(''));
  assert.ok(proLabels.includes('전체 움직임') && proLabels.includes('부분 움직임'), 'PRO 비교 표면은 두 상태 모두에서 그대로 있다');
  // 비교 그림은 같은 캐릭터·같은 크기여야 차이가 '움직이는 방식'으로 읽힌다. 예전에는 다른 마스코트 두 장이었다.
  const proSlot = slotSource.ASSET_SLOTS.proFeatureArtwork;
  assert.equal(proSlot.source, proSlot.sourceAfter, 'PRO 비교는 같은 그림 두 장이다');
  const proImages = tree.root.findAll(n => n.type === 'Image' && [86].includes((Object.assign({}, ...[n.props.style].flat(9).filter(Boolean))).width));
  assert.equal(proImages.length, 2, '비교 그림은 두 장');
  assert.deepEqual(proImages.map(n => Object.assign({}, ...[n.props.style].flat(9).filter(Boolean)).height), [86, 86], '두 장이 같은 크기');
  await press('PRO 닫기');

  // ④ 그리기: 빈 칸의 움직임 견본 · 기본 레퍼런스 격자
  const project = createProject('계약 세트', '콩이');
  saveStore({ version: 1, introDone: true, revision: ++revision, projects: [project], palette: [] });
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
  saveStore({ version: 1, introDone: true, revision: ++revision, projects: [full], palette: [] });
  await render(App);
  await press('다 한 세트');
  await press('내보내기');
  note();
  const success = byTestID('asset-slot-exportSuccessArtwork').length;

  return { seen, home, guide, guideImages, guideLabels, poseCells, poseArt, sampleArt, success };
}

(async () => {
  // ── 1. 계약 자료: 자리마다 비율·표시 크기·권장 제작 해상도·안전 영역·바탕이 모두 적혀 있다 ─────
  assert.deepEqual(Object.keys(slotSource.ASSET_SLOTS).sort(), [...SLOTS].sort(), '에셋 자리 7개(빈 상태 카드는 명세 H01 에서 없앴다)');
  for (const name of SLOTS) {
    const spec = slotSource.ASSET_SLOTS[name];
    assert.ok(spec.aspectRatio > 0, name + ': 비율');
    for (const key of ['display', 'sourceSize', 'safeArea']) assert.ok(typeof spec[key] === 'string' && spec[key].length > 4, name + ': ' + key);
    assert.ok(['transparent', 'opaque'].includes(spec.background), name + ': 바탕');
    assert.ok('source' in spec, name + ': source 자리');
  }
  assert.equal(slotSource.ASSET_SLOTS.exportSuccessArtwork.display, '84×84', '문서 크기와 화면 크기(size=84)가 같다');
  assert.ok('sourceAfter' in slotSource.ASSET_SLOTS.proFeatureArtwork, 'PRO 비교는 전·후 두 장을 자리에서 받는다');
  assert.equal(new Set(slotSource.EXPRESSION_GUIDE.cards.map(card => card.id)).size, 20, '표현 가이드 20개는 중복 없는 안정 ID를 가진다');
  assert.deepEqual(slotSource.EXPRESSION_GUIDE.cards.map(({ category, name, hint }) => [category, name, hint]), [
    ['기쁨·인사', '안녕', '손 크게 흔들기'], ['기쁨·인사', '고마워', '두 손 모아 꾸벅'], ['기쁨·인사', '좋아', '엄지 척'], ['기쁨·인사', '신나', '두 팔 번쩍'],
    ['슬픔·미안', '미안해', '고개 푹 숙이기'], ['슬픔·미안', '슬퍼', '무릎 안고 앉기'], ['슬픔·미안', '흑흑', '눈물 훔치기'], ['슬픔·미안', '괜찮아?', '살짝 다가가기'],
    ['화남·억울', '억울해', '팔짱 + 몸 돌리기'], ['화남·억울', '화났어', '주먹 불끈'], ['화남·억울', '흥', '고개 홱 돌리기'], ['화남·억울', '짜증나', '머리 감싸기'],
    ['놀람·당황', '헉', '두 손으로 입 가리기'], ['놀람·당황', '뭐?', '몸 뒤로 젖히기'], ['놀람·당황', '당황', '땀 한 방울'], ['놀람·당황', '설마', '눈 동그랗게'],
    ['일상', '잘 자', '이불 덮고 눕기'], ['일상', '배고파', '배 잡고 쓰러지기'], ['일상', '출발', '가방 메고 뛰기'], ['일상', '기다려', '손바닥 내밀기'],
  ], '표현 가이드의 기존 분류·이름·힌트·순서');

  // ── 2. 그림을 넣으면 그 화면에 그 그림이 뜬다(자리 8개 전부) ───────────────────────────────
  const on = await walk(withSources(true), { sourcesOn: true });
  const missing = SLOTS.filter(name => !on.seen.has(mark(name)));
  assert.deepEqual(missing, [], '자리의 source 를 넣으면 그 화면이 그 그림을 그린다');
  assert.equal(new Set(on.guideImages).size, 2, '서로 다른 두 표현 카드가 서로 다른 이미지를 그린다');
  assert.equal(on.guide, 0, '카드 전용 그림이 없어도 대표 예시 그림이 있으면 자리표시가 남지 않는다');
  assert.equal(on.guideLabels, 2, '이미지 연결 뒤에도 기존 카드 이름·힌트와 누르기 동작 입구가 유지된다');
  assert.ok(on.seen.has(mark('proFeatureArtwork') + '#after'), 'PRO 비교의 두 번째 장(sourceAfter)도 그려진다');
  assert.equal(on.poseArt, 1, '기본 레퍼런스 칸은 자리의 그림을 그린다');
  assert.equal(on.sampleArt, 1, '움직임 견본도 자리의 그림을 쓴다');

  // ── 3. 그림이 아직 없으면 45.2 자리표시가 그대로다(레이아웃·칸 수 불변) ────────────────────
  const off = await walk(withSources(false), { sourcesOn: false });
  assert.equal(off.seen.size, 0, '자리표시 상태에서는 에셋 그림이 없다');
  assert.deepEqual(off.home, { hero: 1, notice: 1 }, '홈: 창작 표면·공지 자리표시가 그대로 그려진다');
  assert.ok(off.guide >= 4, '표현 가이드 카드마다 자리표시가 남는다');
  assert.equal(off.success, 1, '내보내기 완성 자리표시가 남는다');
  assert.deepEqual(on.home, { hero: 0, notice: 0 }, '그림이 들어오면 같은 자리를 그림이 대신한다(칸은 그대로)');
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
  // 브러시 획 견본은 **엔진이 그은 것**이고 서로 달라야 한다(45.26).
  // 45.25 에는 견본 둘이 같아 보였는데, 원인은 엔진이 아니라 견본을 만들던 쪽이 명령 줄서기를
  // 기다리지 않아 앞 브러시로 그은 것이었다. 여기서 '서로 다름'을 못 박아 같은 실수를 다시 못 하게 한다.
  //
  // 45.35: 견본을 **넓은 띠**로 다시 만들었다(scripts/make-brush-samples.cjs). 예전 견본은 거의 정사각이라
  // 줄 안에서 높이에 맞춰 줄이면 작은 도장이 됐다 — 시안이 말하는 '넓은 실제 획 견본'이 아니었다.
  // 그래서 검사도 '잘라낸 테두리 크기'가 아니라 **띠 안의 실제 잉크**를 잰다.
  {
    const { read } = require('./_png.cjs');
    const src = fs.readFileSync('src/painter/painter.tsx', 'utf8');
    const block = src.slice(src.indexOf('const CATALOG:'), src.indexOf('const GROUPS:'));
    const files = [...block.matchAll(/title: '([^']+)'[^\n]*stroke: require\('[^']*\/([^'\/]+\.png)'\)/g)].map(m => ({ title: m[1], file: m[2] }));
    assert.equal(files.length, 30, '서른 종 모두 견본 파일을 갖는다: ' + files.length);
    const seenBytes = new Map(), ink = new Map();
    for (const { title, file } of files) {
      const path = 'assets/art/' + file;
      const raw = fs.readFileSync(path), img = read(path);
      // 줄은 가로로 넓다. 견본도 넓어야 높이에 맞춰 줄였을 때 획으로 보인다(도장이 아니라).
      assert.ok(img.w / img.h >= 3, title + ' 견본이 넓은 띠다(가로/세로 ≥ 3): ' + img.w + '×' + img.h);
      let touched = 0, solid = 0;
      for (let i = 0; i < img.w * img.h; i++) { const a = img.d[i * 4 + 3]; if (a > 8) touched++; if (a > 120) solid++; }
      const n = img.w * img.h, cover = touched / n, dense = solid / n;
      // 비어 있지도, 띠를 통째로 **짙게** 덮지도 않는다 — 둘 다 '획'으로 읽히지 않는다.
      // 옅게 번지는 브러시(에어브러시·워시)는 넓게 닿는 것이 그 성질이라 '닿음'이 아니라 '짙음'으로 잰다.
      assert.ok(cover > .03, title + ' 견본에 획이 있다(닿은 넓이 ' + (cover * 100).toFixed(1) + '%)');
      assert.ok(dense < .70, title + ' 견본이 띠를 통째로 덮지 않는다(짙은 넓이 ' + (dense * 100).toFixed(1) + '%)');
      ink.set(title, dense);
      const key = raw.toString('base64');
      assert.ok(!seenBytes.has(key), title + ' 견본이 ' + seenBytes.get(key) + ' 와 같은 파일이다');
      seenBytes.set(key, title);
    }
    // 굵게 긋는 브러시는 실제로 잉크를 더 덮는다 — 이름만 다른 견본이 아니다.
    assert.ok(ink.get('붓펜') > ink.get('기본 펜'), '붓펜 견본이 기본 펜보다 굵다: ' + ink.get('기본 펜').toFixed(3) + ' → ' + ink.get('붓펜').toFixed(3));
    assert.ok(ink.get('불투명 채색붓') > ink.get('기본 펜'), '채색 붓 견본이 선 브러시보다 넓게 덮는다');
  }
  // 브러시 서른 가지(45.31 · v2 구성표). 이름·무료/PRO·분류·엔진 효과·견본이 한 벌로 묶여 있어야 한다 —
  // 이름만 서른 개인 상태로는 통과하지 않는다.
  {
    const src = fs.readFileSync('src/painter/painter.tsx', 'utf8');
    const block = src.slice(src.indexOf('const CATALOG:'), src.indexOf('const GROUPS:'));
    const rows = [...block.matchAll(/\{ key: '([^']+)', title: '([^']+)', pro: (true|false), group: '([^']+)', (?:base: '([^']+)'|preset: '([^']+)')/g)]
      .map(m => ({ key: m[1], title: m[2], pro: m[3] === 'true', group: m[4], base: m[5], preset: m[6] }));
    assert.equal(rows.length, 30, '브러시는 서른 가지다: ' + rows.length);
    const free = rows.filter(r => !r.pro), paid = rows.filter(r => r.pro);
    assert.equal(free.length, 10, '무료 열 가지: ' + free.length);
    assert.equal(paid.length, 20, 'PRO 스무 가지: ' + paid.length);
    // 분류는 넷뿐이고, 어느 분류도 비어 있지 않다.
    const groups = [...new Set(rows.map(r => r.group))];
    assert.deepEqual(groups.sort(), ['선', '채색', '질감', '효과'].sort(), '분류는 선·채색·질감·효과 넷: ' + JSON.stringify(groups));
    // 이름마다 실제로 다른 엔진 효과가 붙어 있다(같은 효과를 두 이름으로 늘어놓지 않는다).
    const effects = rows.map(r => r.preset ?? ('base:' + r.base));
    assert.equal(new Set(effects).size, 30, '서른 이름이 저마다 다른 엔진 효과를 쓴다');
    // 프리셋 이름은 엔진 PRESETS 에 실제로 있다 — 없으면 이름만 있고 효과가 없는 브러시가 된다.
    const engine = fs.readFileSync('src/painter/canvas-html.ts', 'utf8');
    const table = engine.slice(engine.indexOf('const PRESETS={'), engine.indexOf('const STAB='));
    for (const r of rows) if (r.preset) assert.ok(new RegExp('\\b' + r.preset + ':\\{').test(table), r.title + '(' + r.preset + ') 의 효과가 엔진에 있다');
    // 서른 가지 모두 제 획 견본을 갖고, 어느 둘도 같은 파일이 아니다.
    const seen = new Map();
    for (const r of rows) {
      const f = 'assets/art/stroke-' + r.key + '.png';
      assert.ok(fs.existsSync(f), f + ' 획 견본이 있다');
      const h = require('node:crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex');
      assert.ok(!seen.has(h), f + ' 가 ' + seen.get(h) + ' 와 같은 그림이다'); seen.set(h, f);
    }
    // 목록에서 내린 예전 브러시는 엔진에 그대로 남아 있어야 한다 — 저장된 작품이 쓰던 값이다.
    for (const old of ['grain', 'calligraphy', 'chisel', 'soft', 'marker', 'brushpen'])
      assert.ok(new RegExp('\\b' + old + ':\\{').test(table), '예전 브러시 ' + old + ' 는 엔진에 남는다(저장본 호환)');
    // 예전 이름은 저장본을 읽을 때도 살아 있어야 한다.
    const types = fs.readFileSync('src/types.ts', 'utf8');
    for (const old of ['grain', 'calligraphy', 'chisel', 'soft', 'marker', 'brushpen'])
      assert.ok(types.includes("'" + old + "'"), '예전 브러시 ' + old + ' 는 저장 형식에 남는다');
  }
  const slotsSrc = fs.readFileSync('src/design/asset-slots.ts', 'utf8');
  assert.ok(/mascot-paper\.png/.test(slotsSrc), '지금 쓰는 자리표시 그림은 asset-slots 한 곳에만 있다');
  const motionSrc = fs.readFileSync('src/painter/motion-panel.tsx', 'utf8');
  assert.ok(/ASSET_SLOTS\.motionExampleArtwork\.source/.test(motionSrc), '움직임 견본은 자리에서 받는다');
  const painterSrc = fs.readFileSync('src/painter/painter.tsx', 'utf8');
  assert.ok(/ASSET_SLOTS\.referencePoseThumbnail\.source/.test(painterSrc), '기본 레퍼런스 칸은 자리에서 받는다');
  const appSrc = fs.readFileSync('App.tsx', 'utf8');
  assert.ok(/ASSET_SLOTS\.proFeatureArtwork\.source/.test(appSrc) && /ASSET_SLOTS\.proFeatureArtwork\.sourceAfter/.test(appSrc), 'PRO 비교는 자리에서 받는다');

  await act(async () => tree.unmount());
  console.log('PASS: asset contract — 브러시 30종(이름·무료/PRO·분류·엔진 효과·견본)·예전 6종 호환, 자리 8개 규격, 표현 가이드 20개 안정 ID·기존 순서/문구, 카드별 서로 다른 이미지와 이미지 없는 카드의 준비 중 자리표시, 나머지 자리의 source/placeholder 연결을 확인했다. 화면 파일의 mascot 직접 참조 0. Native/WebView mocked.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
