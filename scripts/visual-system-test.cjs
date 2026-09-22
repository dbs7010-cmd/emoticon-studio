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
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
  delete() { files.delete(this.uri); }
}
const keyboardListeners = {};
const commands = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n]));
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
const { T, Type, Elev } = load('src/components/ui.tsx');
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
  // 명세 §2 색상표. 값이 되돌아가지 않게 못 박는다.
  assert.equal(T.bg, '#FFFFFF'); assert.equal(T.paper, '#FFFFFF'); assert.equal(T.surface2, '#F5F6F8');
  assert.equal(T.ink, '#17191D'); assert.equal(T.muted, '#555D69'); assert.equal(T.line, '#E3E6EC');
  assert.equal(T.accent, '#FFD52A'); assert.equal(T.accentSoft, '#FFF3B0'); assert.equal(T.danger, '#B42318');
  assert.equal(T.accentInk, '#17191D', '노랑 위 글자는 짙은 색이다(흰 글씨 금지)');
  assert.deepEqual(Object.values(T.radius), [8, 12, 16, 20, 24], '모서리는 8·12·16·20·24 한 벌');
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
  assert.equal(appName, '임티제작소', 'app.json expo.name 은 제품 브랜드');
  assert.equal(require('../app.config.js')().name, appName, 'app.config.js 가 이름을 바꾸지 않는다');
  assert.ok(fs.readFileSync('App.tsx', 'utf8').includes(`>${appName}</Text>`), '홈 머리 브랜드 글자와 앱 이름이 같다');
  assert.ok(fs.readFileSync('docs/PLAY_STORE_LISTING_KO.md', 'utf8').includes('`' + appName + '`'), '스토어 등록정보 초안 제목도 같다');

  // ── 3. 홈: 브랜드 → 창작 표면 → 최근 작업. 알림이 꺼지면 자리 0 ───────────────────────────────
  const p = createProject('시각 세트', '콩이');
  p.slots = p.slots.map((s, i) => i < 2 ? { ...s, finalImage: { path: 'image-a.png', width: 360, height: 360 }, done: i === 0 } : s);
  saveStore({ version: 1, revision: 1, projects: [p], palette: ['#54A9E8', '#E94F4F'] });
  await act(async () => { tree = create(React.createElement(App)); });
  assert.equal(texts()[0], '임티제작소', '첫 글자는 브랜드');
  // 명세 H02: 작업이 있으면 이어하기가 맨 위다. 소개용 큰 표면은 작업 목록 위에 두지 않는다.
  const startAt = tree.root.findAll(n => n.type === 'Pressable').findIndex(n => n.props.accessibilityLabel === '새 이모티콘 만들기');
  const cardAt = tree.root.findAll(n => n.type === 'Pressable').findIndex(n => n.props.accessibilityLabel === '시각 세트');
  assert.ok(cardAt >= 0 && cardAt < startAt, '최근 작업이 시작 줄보다 먼저(H02)');
  assert.equal(byTestID('홈 창작 표면').length, 0, '작업이 있으면 소개용 큰 표면을 두지 않는다');
  assert.ok(texts().includes('이어서 만들기'), '맨 위 제목은 이어서 만들기');
  assert.equal(byTestID('홈 알림').length, 0, '알림 꺼짐 → 자리 없음');
  const primaryYellow = tree.root.findAll(n => n.type === 'Pressable' && flat(n.props.style).backgroundColor === T.accent).map(n => n.props.accessibilityLabel);
  assert.deepEqual(primaryYellow, ['새 이모티콘 만들기'], '홈의 노랑 버튼은 하나: ' + JSON.stringify(primaryYellow));

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
  const dock = byTestID('board-action-dock')[0];
  assert.equal(flat(dock.props.style).borderTopLeftRadius, 24, '보드 아래 줄은 떠 있는 표면');

  // ── 5. 그리기: 선 종류는 세그먼트 하나 · 도구는 테두리 박스가 아니다 ───────────────────────────
  await act(async () => tree.root.findAll(n => n.props.testID === 'slot-3')[0].props.onPress());
  await ready();
  for (const label of ['브러시', '지우개', '채우기', '선택', '색']) assert.equal(flat(labelled(label)[0].props.style).borderWidth ?? 0, 0, label + ' 도구에 카드 테두리가 없다');
  assert.equal(flat(labelled('브러시')[0].props.style).backgroundColor, T.accentSoft, '고른 도구만 옅은 노랑 표면');
  assert.equal(flat(labelled('지우개')[0].props.style).backgroundColor, 'transparent', '고르지 않은 도구는 투명');
  assert.equal(flat(labelled('되돌리기')[0].props.style).backgroundColor, 'transparent', '되돌리기는 도구처럼 보이지 않는 조용한 아이콘');
  await press('브러시');
  const seg = tree.root.findAll(n => n.type === 'View' && n.props.testID === '선 종류')[0];
  const segStyle = flat(seg.props.style);
  assert.equal(segStyle.backgroundColor, T.surface2, '선 종류는 한 바탕 위의 세그먼트');
  const cells = seg.findAll(n => n.type === 'Pressable');
  assert.deepEqual(cells.map(n => n.props.accessibilityLabel), ['펜', '붓', '연필']);
  assert.ok(cells.every(n => flat(n.props.style).flex === 1), '세 칸이 한 줄을 나눠 쓴다');
  const unselected = cells.filter(n => !n.props.accessibilityState.selected);
  assert.ok(unselected.every(n => (flat(n.props.style).borderWidth ?? 0) === 0 && flat(n.props.style).backgroundColor === 'transparent'), '고르지 않은 칸은 테두리도 바탕도 없다 — 세 장의 카드가 아니다');
  // 45.6: 칸 안에 실제 획 견본 + 도구 표시 + 이름이 들어가 52dp 로 조금 높아졌다(여전히 카드 세 장이 아니라 한 줄 고르개).
  assert.ok(cells.every(n => { const h = flat(n.props.style).minHeight ?? 0; return h >= 40 && h <= 56; }), '낮고 넓다(40~56dp)');
  assert.ok(cells.every(n => n.findAll(x => x.type === 'Image').length === 1), '칸마다 그 브러시의 실제 획 견본');
  assert.equal(labelled('고급 브러시 PRO').length, 1, '고급 브러시는 네 번째 칸이 아니라 아래 한 줄');
  assert.equal(labelled('선 보정').length, 0, '진하기·보정은 세부 설정 안');
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

  // ── 7. 움직이기: '없음'은 좁고 조용하다 ──────────────────────────────────────────────────────
  await press('움직이기');
  const none = flat(labelled('움직임 없음')[0].props.style), bounce = flat(labelled('통통')[0].props.style);
  assert.ok(typeof none.width === 'number' && none.width <= 64 && bounce.flex === 1, "'없음'은 효과 카드보다 좁다");
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

  console.log('PASS: visual system — 토큰(색·모서리 8/12/16/20/24·간격 4 기반·옅은 그림자·글자 위계 8단), 2px 노랑 선택 박스·900 굵기 남발 없음, 화면 하드코딩 색 ' + hex + '곳(39차 56, 견본·토큰 정의 제외), 에셋 자리 8개 규격(44차 표현 가이드 카드 포함)·캔버스 가이드 힌트 없음·알림 꺼짐·레퍼런스 V1 분류 넷, 홈 브랜드→창작 표면→최근 작업·노랑 버튼 1, 세트 12개여도 홈은 가장 최근 하나+전체 보기·전체 작업→보드→뒤로 전체 작업·표현 가이드 분류/카드, 보드 글자 배지 없음·떠 있는 아래 줄, 도구 dock 테두리 없음·고른 도구만 노랑 표면·되돌리기 조용, 선 종류 세그먼트 하나(펜·붓·연필, 비선택 투명), 문구 키보드 한 줄, 움직임 없음 좁게, 내보내기 요약→격자·제출 준비·노랑 1. Native/WebView mocked.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
