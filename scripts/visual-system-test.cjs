// 40차 COMMERCIAL VISUAL UI 규칙 고정. 기능이 아니라 **보이는 체계**가 되돌아가지 않게 막는다.
//   토큰 · 버튼 가족 · 선 종류 세그먼트 · 선택 표시(2px 노랑 테두리 금지) · 홈 위계 · 에셋 자리 · 표현 가이드 꺼짐 ·
//   문구 입력 중 한 줄 · 움직임 없음의 무게 · 보드 글자 배지 없음 · 내보내기 요약.
// 실제 앱을 그려(react-test-renderer) 스타일과 구조를 읽는다. 픽셀 판정은 실기기 캡처가 맡는다.
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
const keyboardListeners = {};
const commands = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n])); rn.Animated = require('./_rn-animated-mock.cjs');
Object.assign(rn, { Keyboard: { addListener: (name, fn) => { (keyboardListeners[name] = keyboardListeners[name] || []).push(fn); return { remove() { keyboardListeners[name] = keyboardListeners[name].filter(f => f !== fn); } }; }, dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} }, Linking: { openURL: async () => {} } });
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
const load = loader({ ...mocks, './src/services/images': images, '../services/images': images });
const { loadStore, saveStore } = load('src/services/storage.ts');
const { createProject } = load('src/project.ts');
const { T, S, Motion, Type, Elev, Pop, Font } = load('src/components/ui.tsx');
const slots = load('src/design/asset-slots.ts');
const App = load('App.tsx').default;

let tree, scene;
const flat = style => Object.assign({}, ...[style].flat(9).filter(Boolean).map(s => typeof s === 'function' ? s({ pressed: false }) : s));
const labelled = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const press = async label => { const m = labelled(label); assert.equal(m.length, 1, 'button ' + label + ' (' + m.length + ')'); await act(async () => m[0].props.onPress()); };
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
const texts = () => tree.root.findAll(n => n.type === 'Text').map(n => [n.props.children].flat(9).filter(x => typeof x === 'string' || typeof x === 'number').join(''));
const byTestID = id => tree.root.findAll(n => n.props.testID === id);
async function ready() {
  await message({ type: 'ready' });
  const init = sent().filter(m => m.type === 'init').at(-1);
  scene = { type: 'state', undo: false, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null, caption: null, motion: null, layers: init.layers.map(l => ({ id: l.id, name: l.name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 })), references: [] };
  await message(scene); await message({ type: 'initialized' });
}

(async () => {
  // ── 1. 토큰: 명세 값 · 한 벌 ─────────────────────────────────────────────────────────────
  // 45.42 WHITE BASE(사용자 확정 2026-09-28): WHITE · INK · NEUTRAL · MAKER YELLOW. 값이 되돌아가지 않게 못 박는다.
  // 바탕과 패널이 모두 흰색이다 — 층은 옅은 중립 선 + 부드러운 그림자, 가라앉은 면(surface2)으로 읽힌다.
  assert.equal(T.bg, '#FFFFFF'); assert.equal(T.paper, '#FFFFFF'); assert.equal(T.surface2, '#F6F5F2');
  assert.notEqual(T.cardLine, T.paper, '흰 카드는 바탕과 다른 선으로 층이 읽힌다');
  assert.notEqual(T.bg, T.surface2, '눌린 면은 앱 바탕과도 달라야 한다');
  assert.equal(T.ink, '#1F1D1A'); assert.equal(T.muted, '#6B655E'); assert.equal(T.faint, '#948D84'); assert.equal(T.line, '#ECE9E3');
  assert.equal(T.accent, '#FFCC2E'); assert.equal(T.accentSoft, '#FFF4CC'); assert.equal(T.danger, '#B42318');
  // 크림·갈색 잔재가 공통 토큰에 남지 않는다(초록은 성공 순간 전용 토큰에만).
  for (const k of ['bg', 'paper', 'surface2', 'warm', 'line', 'lineStrong', 'cardLine', 'paperLine', 'warmLine', 'fill', 'fillPressed']) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(T[k].substr(i, 2), 16));
    assert.ok(r - b <= 16 && Math.abs(r - g) <= 8, k + ' 는 중립색이다(크림·갈색 아님): ' + T[k]);
  }
  assert.notEqual(T.accent.toUpperCase(), '#FEE500', '카카오 노랑을 쓰지 않는다');
  // 스티커 문법: 2px 짙은 테두리 + 딱 떨어지는 그림자(노란 버튼·고른 것에만). PRO 는 보라 없이 잉크(배지 모양으로 구분).
  assert.equal(T.stroke, 2); assert.equal(T.edge, T.ink, '스티커 테두리는 본문 색');
  assert.equal(Pop.border.borderWidth, 2); assert.ok(/^3px 3px 0px /.test(Pop.shadow.boxShadow), '주요 표면 그림자는 흐림 없이 3px');
  assert.equal(T.pro, T.ink, 'PRO 는 보라가 아니라 잉크'); assert.equal(T.proSoft, T.surface2);
  for (const k of Object.keys(T)) if (typeof T[k] === 'string') assert.notEqual(T[k].toUpperCase(), '#5B47E0', 'PRO 보라가 남지 않는다: ' + k);
  // 상태 토큰 한 벌(45.42): 선택 = 노란 면 + 잉크 가장자리, 비활성 = 옅은 색(투명도 아님).
  assert.deepEqual(S.selected, { backgroundColor: T.accent, borderColor: T.edge }); assert.equal(S.selectedSoft.backgroundColor, T.accentSoft);
  assert.equal(S.pressed.backgroundColor, T.fill); assert.equal(S.disabledInk, T.faint); assert.equal(S.success.color, T.success);
  assert.ok(Object.values(Motion).every(ms => ms >= 100 && ms <= 300), '반응 시간은 0.1~0.3초');
  // 아이콘 부품(icons.tsx)은 순환 참조를 피하려 색을 따로 들고 있다 — 토큰과 같은 값이어야 한다.
  { const I = load('src/design/icons.tsx'); assert.equal(I.ICON_INK, T.ink, '아이콘 잉크 = T.ink'); assert.equal(I.ICON_FAINT, T.faint, '아이콘 비활성 = T.faint'); }
  // 제목 글꼴 Jua: 빌드 설정에 들어 있고, 파일과 OFL 사용권 문서가 함께 있다.
  assert.equal(Font.display, 'Jua'); assert.equal(Type.screenTitle.fontFamily, 'Jua'); assert.equal(Type.screenTitle.fontWeight, '400', '한 굵기 글꼴에 가짜 굵기를 걸지 않는다');
  {
    const plugin = require('../app.config.js')().plugins.find(x => Array.isArray(x) && x[0] === 'expo-font');
    assert.ok(plugin && plugin[1].android.fonts[0].fontFamily === 'Jua', 'expo-font 설정 플러그인이 Jua 를 넣는다');
    assert.ok(fs.existsSync('assets/fonts/Jua-Regular.ttf') && fs.readFileSync('assets/fonts/Jua-OFL.txt', 'utf8').includes('SIL Open Font License'), '글꼴 파일과 사용권');
  }
  assert.equal(T.accentInk, T.ink, '노랑 위 글자는 짙은 색이다(흰 글씨 금지)');
  // 글자 색은 실제 대비로 확인한다. 토큰을 바꿀 때 눈으로만 고르면 보조 글자가 조용히 옅어진다.
  {
    const lum = h => { const v = [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16) / 255)
      .map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const ratio = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    assert.ok(ratio(T.ink, T.paper) >= 7, '본문은 패널 위에서 7:1 이상');
    assert.ok(ratio(T.muted, T.paper) >= 4.5, '보조 글자도 패널 위에서 4.5:1 이상');
    assert.ok(ratio(T.muted, T.bg) >= 4.5, '보조 글자는 앱 바탕 위에서도 4.5:1 이상');
    assert.ok(ratio(T.accentInk, T.accent) >= 4.5, '노랑 위 글자도 4.5:1 이상');
    // 45.42: 가라앉은 면·누름 면 위 보조 글자, 비활성 글자·아이콘(3:1, 45.39 의 faint 3.27 보다 낮추지 않는다).
    for (const face of ['surface2', 'fill']) assert.ok(ratio(T.muted, T[face]) >= 4.5, '보조 글자는 ' + face + ' 위에서도 4.5:1 이상');
    assert.ok(ratio(T.faint, T.paper) >= 3.27, '비활성 글자·아이콘은 흰 면 위 3:1 이상(45.39 보다 옅어지지 않는다): ' + ratio(T.faint, T.paper).toFixed(2));
    assert.ok(ratio(T.ink, T.accentSoft) >= 7, '옅은 노랑(목록형 선택) 위 본문 7:1 이상');
  }
  assert.deepEqual([T.radius.xs, T.radius.sm, T.radius.md, T.radius.lg, T.radius.xl], [8, 12, 16, 20, 24], '모서리는 8·12·16·20·24 한 벌');
  // 명세 §2 는 쓰임새로 부른다: 카드16 · 버튼12 · 칩10.
  // 45.39: 스티커 표면은 조금 더 둥글다 — 카드20 · 버튼14 · 칩10.
  assert.deepEqual([T.radius.card, T.radius.button, T.radius.chip], [20, 14, 10], '카드20·버튼14·칩10');
  // 45.39 글자 위계. 제목26 · 화면명22 · 섹션19(Jua) · 본문16 · 버튼15 · 보조13 · 도구12.
  assert.deepEqual([Type.screenTitle.fontSize, Type.screenName.fontSize, Type.sectionTitle.fontSize, Type.body.fontSize, Type.button.fontSize, Type.bodySecondary.fontSize, Type.caption.fontSize],
    [26, 22, 19, 16, 15, 13, 12], '글자 크기 한 벌');
  assert.deepEqual(Object.values(T.gap), [4, 8, 12, 16, 20, 24, 32], '간격은 4 기반 한 벌');
  for (const key of ['screenTitle', 'sectionTitle', 'cardTitle', 'body', 'bodySecondary', 'button', 'caption', 'micro']) assert.ok(Type[key]?.fontSize, 'Type.' + key);
  assert.ok(Elev[1].shadowOpacity <= .08 && Elev[2].shadowOpacity <= .12, '그림자는 옅다(짙은 drop shadow 금지)');
  // 소스: 2px 노랑 선택 테두리(`borderWidth: on ? 2` + accent) 가 돌아오지 않는다. 버튼 900 굵기 남발도 막는다.
  const sources = ['App.tsx', 'src/painter/painter.tsx', 'src/painter/motion-panel.tsx', 'src/components/ui.tsx'].map(f => [f, fs.readFileSync(f, 'utf8')]);
  for (const [file, src] of sources) {
    assert.ok(!/borderWidth: (on|active|picked|selected|dragging) \? 2 : 1, borderColor: (on|active|picked|selected|dragging) \? C\.accent/.test(src), file + ': 선택을 2px 노랑 박스로 표시하지 않는다');
    assert.ok((src.match(/fontWeight: '900'/g) ?? []).length <= 2, file + ": '900' 굵기는 거의 쓰지 않는다 (" + (src.match(/fontWeight: '900'/g) ?? []).length + ')');
  }
  // 화면 파일(App·painter·motion)에 흩어진 색만 센다. 토큰 정의(ui.tsx)와 사용자가 고르는 팔레트 견본 자료(swatches)는 색 체계가 아니라 데이터라 뺀다.
  const screenHex = sources.filter(([f]) => f !== 'src/components/ui.tsx')
    .map(([, src]) => src.replace(/const swatches = \[[\s\S]*?\];/, ''))
    .reduce((n, src) => n + (src.match(/'#[0-9A-Fa-f]{6,8}'/g) ?? []).length, 0);
  const hex = screenHex;
  assert.ok(hex <= 40, '화면 파일에 흩어진 하드코딩 색이 줄었다(39차 App 30 + painter 22 + motion 4 = 56, 견본 제외): ' + hex);

  // ── 2. 에셋 자리: 비율·표시 크기·안전 영역·바탕 규격이 모두 있다 ─────────────────────────────
  // 44차 LOCK: 표현 가이드 카드 그림 자리가 생겼다. 쓰지 않는 자리는 두지 않는다.
  const names = ['homeHeroArtwork', 'noticeArtwork', 'referencePoseThumbnail', 'expressionGuideArtwork', 'motionExampleArtwork', 'exportSuccessArtwork', 'proFeatureArtwork'];
  assert.deepEqual(Object.keys(slots.ASSET_SLOTS).sort(), [...names].sort(), '에셋 자리 7개(빈 상태 카드는 명세 H01 에서 없앴다)');
  for (const name of names) { const s = slots.ASSET_SLOTS[name]; assert.ok(s.aspectRatio > 0 && s.display && s.safeArea && ['transparent', 'opaque'].includes(s.background), name + ' 규격'); }
  assert.equal(slots.ASSET_SLOTS.referencePoseThumbnail.aspectRatio, 3 / 4, '관절 인형 전신은 세로형 3:4');
  assert.equal(slots.ASSET_SLOTS.expressionGuideArtwork.aspectRatio, 1, '표현 가이드 카드 그림은 1:1');
  // Guide = 무엇을 그릴까(홈에서 고르는 목록), Reference = 어떻게 그릴까(그리기 화면 참고). 캔버스 위 가이드 힌트는 두지 않는다.
  assert.equal(slots.EXPRESSION_GUIDE.canvasHint, undefined, '캔버스 위 표현 가이드 힌트 자리는 없다');
  assert.ok(slots.EXPRESSION_GUIDE.categories.length >= 3 && slots.EXPRESSION_GUIDE.categories.every(c => slots.EXPRESSION_GUIDE.cards.filter(x => x.category === c).length >= 4), '가이드: 분류마다 표현 카드 4개 이상');
  assert.ok(slots.EXPRESSION_GUIDE.cards.every(c => c.name.length <= 6 && c.hint.length <= 14), '가이드 카드는 짧은 이름 + 짧은 몸짓 힌트(긴 설명 없음)');
  assert.deepEqual([...slots.BUILTIN_REFERENCES.categories], ['포즈', '표정', '손동작', '소품·효과'], '기본 레퍼런스 분류는 V1 네 가지(소품·효과 합침)');
  assert.equal(slots.HOME_NOTICE.enabled, false, '알림은 꺼져 있다');
  // 41차: 앱 표시 이름(런처·스토어 제목의 원본)과 홈 브랜드는 하나다.
  const appName = JSON.parse(fs.readFileSync('app.json', 'utf8')).expo.name;
  assert.equal(appName, 'imoti 이모티', 'app.json expo.name 은 제품명(브랜드 병기)');
  assert.equal(require('../app.config.js')().name, appName, 'app.config.js 가 이름을 바꾸지 않는다');
  // 홈 로고는 소문자 imoti 주표기 + 작은 '이모티' 보조표기. 화면 읽기 이름은 제품명과 같다.
  assert.ok(fs.readFileSync('App.tsx', 'utf8').includes(`accessibilityLabel="${appName}"`), '홈 로고를 읽는 이름과 앱 이름이 같다');
  assert.ok(fs.readFileSync('docs/PLAY_STORE_LISTING_KO.md', 'utf8').includes('`' + appName + '`'), '스토어 등록정보 초안 제목도 같다');

  // ── 3. 홈: 브랜드 → 창작 표면 → 최근 작업. 알림이 꺼지면 자리 0 ───────────────────────────────
  const p = createProject('시각 세트', '콩이');
  p.slots = p.slots.map((s, i) => i < 2 ? { ...s, finalImage: { path: 'image-a.png', width: 360, height: 360 }, done: i === 0 } : s);
  saveStore({ version: 1, revision: 1, projects: [p], palette: ['#54A9E8', '#E94F4F'] });
  await act(async () => { tree = create(React.createElement(App)); });
  assert.deepEqual(texts().slice(0, 2), ['imoti', '이모티'], '첫 글자는 브랜드(imoti 주표기 + 이모티 보조표기)');
  {
    const brand = tree.root.findAll(n => n.type === 'View' && n.props.testID === '홈 브랜드')[0];
    assert.equal(brand.props.accessibilityLabel, appName, '로고는 제품명 한 번으로 읽힌다');
    const [main, sub] = brand.findAll(n => n.type === 'Text').map(n => flat(n.props.style));
    assert.ok(main.fontSize > sub.fontSize * 1.5, 'imoti 가 주표기, 이모티는 작은 보조표기');
  }
  // 명세 H02: 작업이 있으면 이어하기가 맨 위다. 소개용 큰 표면은 작업 목록 위에 두지 않는다.
  const startAt = tree.root.findAll(n => n.type === 'Pressable').findIndex(n => n.props.accessibilityLabel === '새 세트 만들기');
  const cardAt = tree.root.findAll(n => n.type === 'Pressable').findIndex(n => n.props.accessibilityLabel === '시각 세트');
  assert.ok(cardAt >= 0 && cardAt < startAt, '최근 작업이 시작 줄보다 먼저(H02)');
  assert.equal(byTestID('홈 창작 표면').length, 0, '작업이 있으면 소개용 큰 표면을 두지 않는다');
  assert.ok(texts().includes('이어서 만들기'), '맨 위 제목은 이어서 만들기');
  assert.equal(byTestID('홈 알림').length, 0, '알림 꺼짐 → 자리 없음');
  const primaryYellow = tree.root.findAll(n => n.type === 'Pressable' && flat(n.props.style).backgroundColor === T.accent).map(n => n.props.accessibilityLabel);
  // 45.39 홈(시안 H4, 사용자 확정): 노랑은 카드 안 '이어 그리기' 하나. 새로 만들기는 카드와 같은 흰 칸이다.
  assert.deepEqual(primaryYellow, ['시각 세트 이어서 만들기'], '홈의 노랑 버튼은 하나: ' + JSON.stringify(primaryYellow));
  assert.equal(byTestID('제안까지 남은 일').length, 1, '제안까지 남은 일 카드가 있다');
  assert.ok(texts().includes('31칸 더 그리기'), '남은 칸을 제안 기준(멈춘 32칸)으로 센다(시안 문구)');
  assert.ok(texts().includes('대표 아이콘'), '대표 아이콘 줄');
  // 45.42 홈(시안 WB2-Home · 카드 B, 사용자 확정): 숫자 + 막대 + 다음 칸. 32칸 격자는 홈 카드에 두지 않는다.
  {
    const ids = n => n.findAll(x => x.type === 'Svg').map(x => x.props.testID);
    const card = labelled('시각 세트')[0];
    assert.equal(card.findAll(n => n.type === 'View' && n.props.testID === '홈 진행')[0].props.accessibilityLabel, '32칸 중 1칸 완성', '카드 B: 제안 기준 칸 수와 완성 수');
    assert.ok(card.findAll(n => n.type === 'Text').some(n => /^다음은 \d+번 칸$/.test([n.props.children].flat(9).join(''))), '카드 B: 다음 칸 표시');
    assert.ok(!card.findAll(n => typeof n.props.testID === 'string' && /^slot-/.test(n.props.testID)).length, '홈 카드에는 32칸 격자가 없다');
    assert.ok(ids(labelled('시각 세트 이어서 만들기')[0]).includes('icon-brush'), '이어 그리기 = 붓 아이콘 + 글자');
    // 좁은 화면에서 한 줄 말줄임이 날짜를 지우지 않는다: 날짜는 줄어들지 않는 따로 된 글자, 종류 글자만 줄어든다.
    const date = card.findAll(n => n.type === 'Text' && n.props.testID === '홈 카드 날짜')[0];
    assert.ok(date && flat(date.props.style).flexShrink === 0 && /^· (오늘|어제|\d+월 \d+일)$/.test([date.props.children].flat(9).join('')), '홈 카드 날짜는 줄어들지 않는다');
    const fresh = flat(labelled('새 세트 만들기')[0].props.style);
    assert.equal(fresh.borderColor, T.edge); assert.equal(fresh.backgroundColor, T.paper, '새로 만들기 = 흰 바탕 잉크 테두리(노랑 아님)');
    assert.ok((fresh.height ?? fresh.minHeight) >= T.tap, '새로 만들기 누르는 자리');
    const rows = byTestID('제안까지 남은 일')[0];
    assert.ok(['icon-brush', 'icon-reference'].every(i => ids(rows).includes(i)), '제안까지 줄마다 아이콘');
    // 45.43 시안 WB2-Home 그대로: 제안까지는 칸 · (움직이는 세트면) 움직이는 칸 · 대표 아이콘. 손볼 곳은 내보내기 화면이 맡는다.
    assert.ok(rows.findAll(n => n.type === 'Text').every(n => !/손볼 곳/.test([n.props.children].flat(9).join(''))), '홈 제안까지에 손볼 곳 줄이 없다');
    assert.equal(byTestID('홈 가이드 미리보기').length, 0, '시안에 없는 표현 가이드 네 칸은 홈에 없다');
    assert.ok(!texts().some(t => /^\+\d+$/.test(t)), '시안에 없는 +N 덮개가 없다');
    assert.ok(ids(rows).every(i => i !== 'icon-pro'), '제안 목록에 PRO 표시 없음');
    const own = labelled('내 그림으로 시작')[0];
    assert.equal(flat(own.props.style).backgroundColor, T.surface2, '내 그림으로 시작 = 가라앉은 한 줄'); assert.ok(ids(own).includes('icon-reference'));
    const badge = labelled('PRO 보기')[0];
    assert.ok(ids(badge).includes('icon-pro') && texts().includes('PRO 보기'), 'PRO 배지 = 반짝 아이콘 + 글자');
    assert.ok(badge.findAll(n => n.type === 'View' && flat(n.props.style).borderColor === T.edge && flat(n.props.style).backgroundColor === T.paper).length === 1, '무료일 때 PRO 배지는 흰 바탕 잉크 테두리');
    assert.ok(ids(labelled('설정')[0]).includes('icon-settings'), '설정 = 선 아이콘');
    // 아이콘 크기는 세 가지뿐이고, 누르는 자리(48)와 따로다.
    const sizes = tree.root.findAll(n => n.type === 'Svg').map(n => n.props.width);
    assert.ok(sizes.length && sizes.every(s => [14, 18, 22].includes(s)), '홈 아이콘 크기 14/18/22: ' + [...new Set(sizes)]);
  }

  // ── 44차: 세트가 늘어도 홈은 최근 넷 + 전체 보기. 여러 세트는 전체 작업, 세트 안 칸은 보드. 표현 가이드는 홈의 조용한 한 줄 ─────
  assert.equal(labelled('표현 가이드').length, 1, '홈에 표현 가이드 입구 한 줄');
  assert.equal(labelled('전체 작업 보기').length, 0, '세트가 넷 이하면 전체 보기가 없다');
  {
    const many = Array.from({ length: 12 }, (_, i) => { const q = createProject('많은 세트 ' + (i + 1), '콩이'); q.updatedAt = new Date(Date.UTC(2026, 8, 1 + i)).toISOString(); return q; });
    saveStore({ version: 1, revision: 50, projects: many, palette: [] });
    await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(App)); });
    const setButtons = () => tree.root.findAll(n => n.type === 'Pressable' && /^많은 세트 \d+$/.test(n.props.accessibilityLabel ?? '')).map(n => n.props.accessibilityLabel);
    // 45.5: 홈은 시작 화면이다 — 가장 최근 세트 하나만, 나머지는 전체 작업에서.
    assert.deepEqual(setButtons(), ['많은 세트 12'], '세트가 12개여도 홈에는 가장 최근 하나만');
    await press('전체 작업 보기');
    assert.equal(setButtons().length, 12, '전체 작업에서 모든 세트를 찾는다');
    assert.equal(byTestID('홈 창작 표면').length, 0, '전체 작업은 홈과 다른 화면');
    await press('많은 세트 3');
    assert.equal(byTestID('slot-grid').length, 1, '전체 작업에서 고른 세트는 그 세트의 칸 보드로 열린다');
    await press('뒤로');
    assert.equal(byTestID('전체 작업 목록').length, 1, '보드에서 뒤로 가면 전체 작업으로 돌아온다');
    await press('홈으로');
    await press('표현 가이드');
    assert.equal(byTestID('표현 가이드 카드').length, 1, '표현 가이드: 카드 격자');
    // 45.22: 감정 카드는 그 감정의 대표 예시 그림을 쓴다 — 스무 장이 같은 자리표시로 보이던 것을 없앴다.
    const guideCards = byTestID('표현 가이드 카드')[0];
    assert.equal(byTestID('asset-slot-expressionGuideArtwork').length, 0, '대표 그림이 있으니 자리표시가 남지 않는다');
    assert.equal(guideCards.findAllByType('Image').length, 4, '카드마다 대표 그림(분류당 4)');
    assert.equal(new Set(guideCards.findAllByType('Image').map(n => n.props.source)).size, 4, '네 카드가 서로 다른 대표 그림을 쓴다');
    await press('표현 가이드 화남·억울');
    assert.equal(tree.root.findAll(n => n.props.accessibilityLabel === '억울해 · 팔짱 + 몸 돌리기').length, 1, '분류를 바꾸면 그 분류의 표현 카드');
    assert.equal(tree.root.findAll(n => n.type === 'Pressable' && flat(n.props.style).backgroundColor === T.accent).length, 0, '가이드 화면에 노랑 버튼 없음');
    // 44.2차: 가이드 카드는 열람으로 끝나지 않는다 — 고르면 최근 세트의 다음 칸 그리기로 가고, 표현은 한 줄 힌트로만 따라온다.
    const hintLine = () => tree.root.findAll(n => n.type === 'Text' && [n.props.children].flat(9).filter(x => typeof x === 'string').join('').includes('팔짱 + 몸 돌리기'));
    await press('억울해 · 팔짱 + 몸 돌리기');
    // 45.19 에셋 삽입 뒤: 감정을 고르면 그 감정의 표현 목록이 먼저 펼쳐지고, 표현을 골라야 그리기로 간다.
    assert.equal(byTestID('표현 예시 목록').length, 1, '감정을 고르면 표현 목록이 펼쳐진다');
    await press('속상해서 고르기');
    await press('참고 보기');
    assert.equal(tree.root.findAllByType('WebView').length, 1, '표현을 고르면 그리기 화면이 열린다');
    assert.equal(hintLine().length, 1, '고른 표현이 캔버스 위 한 줄 힌트로 따라온다');
    assert.equal(labelled('표현 힌트 닫기').length, 1, '힌트는 바로 닫을 수 있다');
    await press('표현 힌트 닫기');
    assert.equal(hintLine().length, 0, '닫으면 사라진다 — 상시 UI 가 아니다');
    assert.equal(loadStore().store.projects.length, 12, '가이드는 저장 구조를 바꾸지 않는다');
    saveStore({ version: 1, revision: 60, projects: [p], palette: ['#54A9E8', '#E94F4F'] });
    await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(App)); });
  }

  // ── 4. 보드: 글자 배지 없이 상태 점 ─────────────────────────────────────────────────────────
  await press('시각 세트');
  const tileTexts = tree.root.findAll(n => n.props.testID === 'slot-grid')[0].findAll(n => n.type === 'Text').map(n => [n.props.children].flat(9).filter(x => typeof x === 'string').join(''));
  assert.ok(!tileTexts.some(t => t === '완성' || t === '작업 중'), '칸마다 완성/작업 중 글자 배지를 붙이지 않는다');
  assert.equal(labelled('슬롯 1 완성').length, 1, '상태는 접근성 이름으로는 그대로 말한다');
  // 45.43 S5(시안 '진행' 네 상태 · 카드 A 막대): 완성 = 노란 체크 · 그리는 중 = 테두리 점 · 지금 = 옅은 노랑 면 + 잉크 테두리 · 빈 칸 = 점선 +.
  {
    const face = n => tree.root.findAll(x => x.type === 'View' && x.props.testID === 'slot-face-' + n)[0];
    const has = (n, id) => face(n).findAll(x => x.props.testID === id).length === 1;
    assert.ok(has(1, '완성 표시') && !has(1, '그리는 중 표시'), '완성 칸 = 노란 체크');
    assert.equal(flat(face(1).findAll(x => x.props.testID === '완성 표시')[0].props.style).backgroundColor, T.accent, '완성 체크는 노랑(초록은 저장 성공에만)');
    assert.ok(has(2, '그리는 중 표시') && !has(2, '완성 표시'), '그리는 중 칸 = 테두리 점');
    const selected = tree.root.findAll(x => x.type === 'Pressable' && /^slot-\d+$/.test(x.props.testID ?? '') && x.props.accessibilityState?.selected);
    assert.equal(selected.length, 1, '지금 칸은 하나(접근성 selected)');
    const now = flat(face(selected[0].props.testID.slice(5)).props.style);
    assert.equal(now.backgroundColor, T.accentSoft); assert.equal(now.borderColor, T.edge, '지금 칸 = 옅은 노랑 면 + 잉크 테두리');
    assert.equal(flat(face(20).props.style).borderStyle, 'dashed', '빈 칸 = 점선');
    const bar = byTestID('보드 진행').find(x => x.type === 'View');
    assert.equal(bar.children.length, loadStore().store.projects[0].slots.length, '진행 막대는 이 세트의 실제 칸 수만큼 나뉜다(32 를 박지 않는다)');
    assert.ok(/칸 중 1칸 완성/.test(bar.props.accessibilityLabel), '막대는 읽을 수 있는 이름을 가진다');
  }
  const dock = byTestID('board-action-dock')[0];
  assert.equal(flat(dock.props.style).borderTopLeftRadius, 24, '보드 아래 줄은 떠 있는 표면');

  // ── 5. 그리기: 브러시 카드 셋 · 색·굵기 한 줄 · 도구 네 칸 (45.28차 승인 보드) ─────────────
  await act(async () => tree.root.findAll(n => n.props.testID === 'slot-3')[0].props.onPress());
  await ready();
  // 쉬고 있는 도구에는 보이는 테두리가 없다(테두리 1px 은 자리만 잡아 두고 색이 투명이라 보이지 않는다).
  const seen = st => (st.borderWidth ?? 0) === 0 || st.borderColor === 'transparent' ? 0 : st.borderWidth;
  const TOOLS = ['그리기 도구 펜', '지우개', '채우기', '선택'];
  // 45.39 디자인 D: 고른 도구는 노랑 채움 + 2px 짙은 테두리(스티커). 쉬는 도구는 테두리도 바탕도 없다.
  for (const label of TOOLS.slice(1)) assert.equal(seen(flat(labelled(label)[0].props.style)), 0, label + ' 쉬는 도구에 카드 테두리가 없다');
  assert.equal(seen(flat(labelled(TOOLS[0])[0].props.style)), 2, '고른 도구는 2px 테두리');
  assert.equal(flat(labelled(TOOLS[0])[0].props.style).backgroundColor, T.accent, '고른 도구만 노랑 표면');
  assert.equal(flat(labelled('지우개')[0].props.style).backgroundColor, 'transparent', '고르지 않은 도구는 투명');
  // 노랑은 '지금 그리는 도구' 하나만 쓴다. 색은 도구가 아니라 패널 입구라 테두리로 말한다.
  // 45.35 승인 시안: 색은 도구 줄 오른쪽 끝의 동그라미 하나다. 상태는 그 고리가 말한다.
  const colorBtn = () => flat(labelled('색')[0].props.style);
  const colorRing = () => flat(byTestID('지금 색 고리')[0].props.style);
  assert.notEqual(colorBtn().backgroundColor, T.accent, '색은 도구가 아니라 패널 입구 — 노랑을 쓰지 않는다');
  assert.notEqual(colorRing().backgroundColor, T.accent, '색 고리에도 노랑을 쓰지 않는다');
  const colorRest = seen(colorRing());
  await press('색');
  assert.notEqual(colorRing().backgroundColor, T.accent, '색 패널을 열어도 노랑이 되지 않는다');
  assert.ok(seen(colorRing()) > colorRest, '열린 패널은 더 굵은 고리로 말한다');
  assert.equal(flat(labelled(TOOLS[0])[0].props.style).backgroundColor, T.accent, '색을 열어도 활성 도구(펜)는 그대로 노랑');
  const yellowTools = TOOLS.filter(l => flat(labelled(l)[0].props.style).backgroundColor === T.accent);
  assert.deepEqual(yellowTools, [TOOLS[0]], '도구 줄의 노랑은 한 곳뿐: ' + JSON.stringify(yellowTools));
  await press('지우개');
  assert.deepEqual(TOOLS.filter(l => flat(labelled(l)[0].props.style).backgroundColor === T.accent), ['지우개'], '지우개로 바꾸면 노랑도 하나만 따라 옮긴다');
  await press(TOOLS[0]);
  const undoBg = flat(labelled('되돌리기')[0].props.style).backgroundColor;
  assert.ok(!undoBg || undoBg === 'transparent', '되돌리기는 도구처럼 보이지 않는 조용한 아이콘(바탕이 없다): ' + undoBg);
  // 빠른 브러시 카드 셋은 늘 캔버스 아래에 서 있고, 골라진 하나만 노랗다.
  const quick = byTestID('빠른 브러시')[0].findAll(n => n.type === 'Pressable' && n.props.testID);
  assert.equal(quick.length, 3, '빠른 브러시 카드는 세 장: ' + quick.length);
  assert.ok(quick.every(n => flat(n.props.style).flex === 1), '세 장이 한 줄을 나눠 쓴다');
  assert.ok(quick.every(n => { const h = flat(n.props.style).minHeight ?? 0; return h >= 56 && h <= 72; }), '획 견본이 보일 만큼 높다(56~72dp)');
  assert.ok(quick.every(n => n.findAll(x => x.type === 'Image').length === 1), '카드마다 그 브러시의 실제 획 견본');
  // 45.39: 고른 브러시는 흰 스티커 카드(2px 테두리 + 그림자). 도구의 노랑과 역할이 다르다. 스티커 카드는 한 장뿐.
  assert.equal(quick.filter(n => seen(flat(n.props.style)) === 2).length, 1, '빠른 줄의 고른 카드는 한 장뿐');
  assert.ok(quick.every(n => flat(n.props.style).backgroundColor !== T.accent), '브러시 카드는 도구처럼 노랑으로 칠하지 않는다');
  // 45.35 승인 시안: 브러시 창은 선·채색·질감·효과 갈래의 세로 목록이다. 줄마다 카드를 두르지 않고
  // 얇은 구분선으로만 가르며, 이름 칸과 넓은 실제 획 견본이 따로 선다. 쓸 수 있는 것은 흐리게 죽이지 않는다.
  await press('브러시 전체');
  const listRows = [];
  for (const g of ['선', '채색', '질감', '효과']) {
    await press('브러시 분류 ' + g);
    // 화면이 다시 그려지면 예전 마디는 읽을 수 없다. 그 자리에서 필요한 값만 떠 둔다.
    for (const n of byTestID('브러시 목록')[0].findAll(x => x.type === 'Pressable' && /^브러시 /.test(x.props.accessibilityLabel ?? '')))
      listRows.push({ label: n.props.accessibilityLabel, st: flat(n.props.style), images: n.findAll(x => x.type === 'Image').length });
    for (const t of ['기본 펜', '자연 잉크', '연필', '마커']) for (const node of labelled('브러시 ' + t))
      assert.equal(flat(node.props.style).opacity ?? 1, 1, '쓸 수 있는 브러시 ' + t + ' 줄을 흐리게 하지 않는다');
  }
  assert.equal(listRows.length, 30, '네 갈래를 합치면 무료 10 + PRO 20 = 30줄: ' + listRows.length);
  for (const { label, st, images } of listRows) {
    assert.equal(seen({ borderWidth: st.borderWidth, borderColor: st.borderColor }), 0, '줄마다 카드 외곽선을 두르지 않는다: ' + label);
    assert.equal(st.borderBottomWidth, 1, '얇은 구분선 하나로 가른다: ' + label);
    assert.ok((st.minHeight ?? 0) >= 64 && (st.minHeight ?? 0) <= 76, '줄 높이 64~76dp: ' + st.minHeight);
    assert.equal(images, 1, '줄마다 그 브러시의 실제 획 견본: ' + label);
  }
  // 고른 줄만 옅은 노랑이고, 노랑인 줄은 많아야 하나다.
  const litRows = listRows.filter(r => r.st.backgroundColor === T.accentSoft);
  assert.ok(litRows.length <= 1, '목록의 노랑은 고른 줄 하나뿐: ' + litRows.length);
  assert.equal(labelled('선 보정').length, 0, '진하기·보정은 세부 설정 화면 안');
  await press('세부 설정');
  assert.equal(labelled('선 보정').length, 1, '세부 설정으로 들어가면 선 보정이 나온다');
  await press('브러시 닫기');

  // ── 6. 문구: 키보드가 올라오면 입력 한 줄(머리·지우기·큰 적용 버튼 접힘) ──────────────────────
  scene = { ...scene, caption: { text: '고마워', place: 'bottom', color: '#242424' } }; await message(scene);
  await press('문구');
  assert.equal(labelled('문구 닫기').length, 1, '평소에는 머리와 닫기가 있다');
  await act(async () => { for (const fn of keyboardListeners.keyboardDidShow || []) fn({ endCoordinates: { height: 320 } }); });
  assert.equal(labelled('문구 닫기').length, 0, '키보드가 올라오면 머리를 접는다');
  assert.equal(labelled('문구 지우기').length, 0, '지우기도 접는다');
  assert.equal(labelled('문구 적용').length, 1, '적용은 입력 줄 안에 하나');
  assert.equal(labelled('키보드 닫기').length, 1);
  const input = tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === '문구 내용')[0];
  assert.ok(input, '입력칸은 같은 자리에 남는다(포커스 유지)');
  await act(async () => { for (const fn of keyboardListeners.keyboardDidHide || []) fn({}); });
  await press('문구 닫기');

  // ── 7. 움직이기: 네 칸 격자, 모든 효과에 손이 닿고, '없음'은 조용하다 ─────────────────────────
  // 45.2 의 '없음은 좁게'는 한 줄에 일곱을 세우던 때의 규칙이다. 그 줄은 320dp 에서 흔들기·부르르를 화면 밖으로 밀었고
  // 기기에서는 칸을 36dp 로 줄였다(45.36-R1 G18). 이제 칸 크기는 같고, '없음'은 움직이는 견본 없이 옅은 아이콘만 둔다.
  await press('움직이기');
  // 45.39: 스무 가지를 등장·동작·강조 세 묶음으로. 묶음마다 네 칸씩, 마지막 줄은 빈 칸으로 폭을 맞춘다. '없음'은 격자 위 칩 줄로 옮겼다.
  const grid = tree.root.findAll(n => n.props.testID === '움직임 격자')[0];
  const gridRows = grid.findAll(n => n.type === 'View' && n.props.testID !== 'PRO 표시' && flat(n.props.style).flexDirection === 'row' && flat(n.props.style).alignItems !== 'baseline');   // 45.43: PRO 배지(가로 줄)는 칸 줄이 아니다
  assert.deepEqual(gridRows.map(r => r.children.length), [4, 4, 4, 4, 4, 4, 4], '묶음마다 네 칸씩(등장 2줄 · 동작 3줄 · 강조 2줄)');
  assert.equal(labelled('움직임 없음').length, 1, "'없음'은 격자 위에 하나");
  for (const label of ['뿅', '쓱', '빼꼼', '쿵', '사라지기', '둥실', '통통', '까딱', '폴짝', '끄덕', '꾸벅', '들썩', '살랑', '빙글', '두근거리기', '흔들기', '부르르', '덜덜', '쾅', '쭈욱']) {
    const cell = labelled(label);
    assert.equal(cell.length, 1, label + ' 칸이 격자에 있다');
    assert.equal(flat(cell[0].props.style).flex, 1, label + ' 칸은 줄을 넷으로 나눈 폭(320dp 에서도 48dp 이상)');
  }
  assert.equal(labelled('움직임 없음')[0].findAll(n => n.type === 'Image').length, 0, "'없음'에는 움직이는 견본이 없다 — 효과와 같은 무게로 서지 않는다");
  assert.equal(labelled('통통')[0].findAll(n => n.type === 'Image').length, 1, '효과 카드에 실제로 움직이는 견본');
  // 45.2: 다시 쓰는 것(보관한 움직임)은 효과 바로 다음, PRO 한 줄은 맨 아래. 한 줄짜리 섹션 제목은 없다.
  assert.ok(!texts().includes('더 세밀하게 움직이기'), '한 줄뿐인 목록에 섹션 제목을 붙이지 않는다');
  const motionOrder = tree.root.findAll(n => n.type === 'Pressable' && ['보관한 움직임', '부분만 움직이기'].includes(n.props.accessibilityLabel)).map(n => n.props.accessibilityLabel);
  assert.deepEqual(motionOrder, ['보관한 움직임', '부분만 움직이기'], '재사용이 먼저, PRO 한 줄이 나중');
  await press('그리기');
  await press('그리기 닫기');
  await message({ type: 'save', token: (sent().filter(m => m.type === 'save').at(-1) || {}).token, dirty: false, data: pngData, metrics: { coverage: .2 }, activeLayerId: 'draw-1', layers: [], references: [] });

  // ── 8. 내보내기: 요약 표면이 먼저, 손볼 곳은 한 표면 ─────────────────────────────────────────
  await press('내보내기');
  const order = tree.root.findAll(n => ['내보내기 요약', '결과 격자'].includes(n.props.testID)).map(n => n.props.testID);
  assert.deepEqual(order, ['내보내기 요약', '결과 격자'], '완성 상태 → 결과 격자');
  assert.ok(texts().includes('제출 준비'), '제출 준비 섹션');
  const bundle = labelled('파일 묶음 만들기')[0];
  assert.ok(bundle, '파일 묶음 CTA');
  const yellowOnExport = tree.root.findAll(n => n.type === 'Pressable' && flat(n.props.style).backgroundColor === T.accent).map(n => n.props.accessibilityLabel);
  assert.deepEqual(yellowOnExport, ['파일 묶음 만들기'], '내보내기의 노랑 버튼은 하나');
  await act(async () => tree.unmount());

  console.log('PASS: visual system — 토큰(색·모서리 8/12/16/20/24·간격 4 기반·옅은 그림자·글자 위계 8단), 2px 노랑 선택 박스·900 굵기 남발 없음, 화면 하드코딩 색 ' + hex + '곳(39차 56, 견본·토큰 정의 제외), 에셋 자리 8개 규격(44차 표현 가이드 카드 포함)·캔버스 가이드 힌트 없음·알림 꺼짐·레퍼런스 V1 분류 넷, 홈 브랜드→창작 표면→최근 작업·노랑 버튼 1, 세트 12개여도 홈은 가장 최근 하나+전체 보기·전체 작업→보드→뒤로 전체 작업·표현 가이드 분류/카드, 보드 글자 배지 없음·떠 있는 아래 줄, 도구 네 칸 테두리 없음·고른 도구만 노랑 표면·되돌리기 조용, 빠른 브러시 카드 셋(획 견본·노랑 하나)·전체 목록 무료4+PRO8, 문구 키보드 한 줄, 움직임 네 칸 격자(전 효과 닿음·없음은 견본 없이 조용), 내보내기 요약→격자·제출 준비·노랑 1. Native/WebView mocked.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
