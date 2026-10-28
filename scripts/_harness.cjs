// 대체 렌더 공용 장치. 실제 App 을 react-test-renderer 로 그리고, 명세가 말하는 화면들을 차례로 연다.
// **실기기 캡처가 아니다** — 네이티브·WebView 는 흉내이고, 픽셀·글꼴·손가락 판정은 기기가 한다.
// 쓰는 쪽: const { walk } = require('./_harness.cjs'); walk(390, (id, title, tree, flat) => { ... });
const fsNode = require('node:fs');
const pathNode = require('node:path');
// 칸 그림으로 쓸 실제 파일. 이미 저장소에 있는 표현 가이드 그림을 빌려 쓴다(새로 그리지 않는다).
const SLOT_ART = pathNode.resolve(__dirname, '..', 'assets', 'expression-guides', 'greeting-thanks-polite.png');
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
const keyboardListeners = {};
const alerts = [];
const commands = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const viewport = { width: 390, height: 844 };
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n])); rn.Animated = require('./_rn-animated-mock.cjs');
Object.assign(rn, {
  Keyboard: { addListener: (name, fn) => { (keyboardListeners[name] = keyboardListeners[name] || []).push(fn); return { remove() { keyboardListeners[name] = keyboardListeners[name].filter(f => f !== fn); } }; }, dismiss() {}, isVisible: () => false },
  StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ ...viewport }),
  BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) },
  Alert: { alert(...a) { alerts.push(a); } }, Linking: { openURL: async () => {} },
});
const png = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(360, 16); png.writeUInt32BE(360, 20);
const pngData = 'data:image/png;base64,' + png.toString('base64');
const mocks = {
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-image-picker': {}, 'expo-image-manipulator': {},
  'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'f://a', uri: 'f://a' }) }) } },
  'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-constants': { __esModule: true, default: { expoConfig: { extra: { internalReview: true }, version: '1.0.0' } } },
  'react-native-webview': { WebView },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => {} },
  'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  './src/components/image-analyzer': { ImageAnalyzer: () => null },
  './src/components/extra-composer': { ExtraComposer: React.forwardRef(() => null), placeInFrame: () => ({ x: 0, y: 0, w: 1, h: 1 }) },
  './src/components/motion-baker': { MotionBaker: React.forwardRef((props, ref) => {
    if (ref) ref.current = { bake: async () => ({ count: 8, fps: 10, loop: .8, delayMs: 100, data: 'data:image/gif;base64,R0lGODlh', bytes: 2048, droppedColours: 0, clipped: false }) };
    return null;
  }) },
};
const realImages = loader(mocks)('src/services/images.ts');
const images = {
  dataUrl: async () => pngData, pickImages: async () => [], importBundledImage: async () => ({ path: 'g.png', width: 132, height: 132 }),
  savePainterWork: (...a) => realImages.savePainterWork(...a), saveCutout: () => ({}),
  saveMotionLoop: () => ({ path: 'm.gif', width: 360, height: 360 }), saveSubmitLoop: () => undefined,
};
const load = loader({ ...mocks, './src/services/images': images, '../services/images': images });
const { saveStore } = load('src/services/storage.ts');
const { createProject } = load('src/project.ts');
const App = load('App.tsx').default;

// 홍보용 대체 렌더(scripts/promo)는 세트 이름을 바꿔 찍는다. 기본값은 검사와 같은 '검토 세트'.
const SET_NAME = process.env.PROMO_SET_NAME || '검토 세트';
let tree;
const flat = style => Object.assign({}, ...[style].flat(9).filter(Boolean).map(s => typeof s === 'function' ? s({ pressed: false }) : s));
const labelled = label => tree.root.findAll(n => (n.type === 'Pressable' || n.type === 'View') && n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');
const press = async label => {
  const m = labelled(label);
  if (m.length < 1) throw new Error('누를 것이 없다: ' + label);
  await act(async () => m[0].props.onPress());
};
const tap = async testID => {
  const m = tree.root.findAll(n => n.props.testID === testID && typeof n.props.onPress === 'function');
  if (!m.length) throw new Error('testID 없음: ' + testID);
  await act(async () => m[0].props.onPress());
};
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
let scene;
async function ready(extra = {}) {
  await message({ type: 'ready' });
  const init = sent().filter(m => m.type === 'init').at(-1);
  scene = {
    type: 'state', undo: true, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null,
    caption: { text: '고마워요', place: 'bottom', color: '#242424' }, motion: null,
    layers: init.layers.map(l => ({ id: l.id, name: l.name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 })),
    references: [], ...extra,
  };
  await message(scene); await message({ type: 'initialized' });
  // 기기가 주는 캔버스 영역 크기. 없으면 캔버스가 0 으로 그려진다.
  // 45.39: 작업면 크기를 먼저 알려 앱이 배치(위 조절 줄 · 옆 조절대)를 고르게 하고, 고른 배치대로 캔버스 영역을 준다.
  const { RAIL_W, BAR_H, CANVAS_GAP, BASE_H } = load('src/painter/painter.tsx');
  // 머리줄은 기본 글자 크기면 320dp 에서도 한 줄이다(45.36-R1 G3). 둘째 줄은 잰 폭이 넘칠 때만 생기고,
  // 이 렌더는 글자 배율 1.0 이라 생기지 않는다. 45.36 은 한 줄로 바꾸고도 여기서 44dp 를 계속 빼,
  // 320 렌더의 캔버스 영역만 기기보다 낮게 그려졌다.
  // 45.37: 모드 줄은 어느 폭에서도 한 줄이다(좁은 화면은 되돌리기가 윗줄로 간다).
  const stacked = 0;
  const stage = { width: viewport.width, height: viewport.height - 24 - 52 - stacked - 48 - BASE_H };
  const stageBox = tree.root.findAll(n => n.type === 'View' && n.props.testID === '작업면')[0];
  if (stageBox) await act(async () => stageBox.props.onLayout({ nativeEvent: { layout: stage } }));
  const rail = Math.min(stage.width - RAIL_W, stage.height) > Math.min(stage.width, stage.height - BAR_H);
  const area = rail ? { width: stage.width - RAIL_W, height: stage.height } : { width: stage.width, height: stage.height - BAR_H };
  void CANVAS_GAP;
  const box = tree.root.findAll(n => n.type === 'View' && n.props.testID === '캔버스 영역')[0];
  if (box) await act(async () => box.props.onLayout({ nativeEvent: { layout: area } }));
}
// 비동기 작업(굽기·묶기·공유)이 끝날 때까지 몇 번 더 돌려 준다.
const settle = async (times = 8) => { for (let i = 0; i < times; i++) await act(async () => { await new Promise(r => setTimeout(r, 0)); }); };
const closePainter = async () => {
  await press('그리기 닫기');
  // 캔버스가 돌려주는 답에는 방금 요청한 token 이 실려 있어야 한다. 없으면 화면이 열린 채 남는다.
  const token = sent().filter(m => m.type === 'save').at(-1)?.token;
  await message({ type: 'save', token, dirty: false, data: pngData, metrics: { coverage: .2 }, activeLayerId: 'draw-1', layers: [], references: [] });
  await act(async () => {});
};
const fresh = async () => { await act(async () => { tree = create(React.createElement(App)); }); };
const unmount = async () => { if (tree) await act(async () => tree.unmount()); tree = null; };

// 명세가 이름 붙인 화면들. 각 항목은 [id, 사람이 읽는 이름, 여는 법].
// 여는 법은 홈에서 다시 시작(fresh)하거나 앞 화면에서 이어 간다.
// 조절 막대를 잡고 끄는 중으로 만든다(45.39: 위 조절 줄의 가로 막대). 값 글자와 눌린 손잡이가 보이는 상태다.
async function holdRail(label, ratio) {
  const node = () => tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === label)[0];
  const W = 120, KNOB = 24;
  await act(async () => node().props.onLayout({ nativeEvent: { layout: { width: W, height: 44 } } }));
  await act(async () => node().props.onResponderGrant({ nativeEvent: { locationX: 0, pageX: 0 } }));
  await act(async () => node().props.onResponderMove({ nativeEvent: { locationX: 3, pageX: KNOB / 2 + ratio * (W - KNOB) } }));
}
const SCREENS = [
  // 45.42 보완: 무료 상태 홈(검수용 PRO 꺼짐). 결제 없이 PRO 가 아닌 상태 — 'PRO 보기' 배지를 본다.
  ['home-empty-free', '홈 · 작업 없음 · 무료', async () => { seed(0, false); await fresh(); }],
  ['home-work-free', '홈 · 작업 있음 · 무료', async () => { seed(2, false); await fresh(); }],
  ['home-empty', '홈 · 작업 없음 · PRO(검수용)', async () => { seed(0); await fresh(); }],
  ['home-work', '홈 · 작업 있음 · PRO(검수용)', async () => { seed(2); await fresh(); }],
  ['new-set', '새 세트 만들기', async () => { await press('새 세트 만들기'); }],
  ['guide-emotions', '표현 가이드 · 감정 목록', async () => { await press('취소'); await press('표현 가이드'); }],
  ['guide-examples', '표현 가이드 · 표현 고르기', async () => { await press('고마워 · 두 손 모아 꾸벅'); await press('정중하게 고르기'); }],
  ['set-detail', '세트 상세(보드)', async () => { await press('표현 가이드로'); await press('홈으로'); await press(SET_NAME); await press('이어서 그리기'); await ready(); await closePainter(); }],
  ['draw-base', '그리기 · 기본', async () => { await tap('slot-1'); await ready(); }],
  ['draw-size', '그리기 · 굵기 조절 중', async () => { await holdRail('브러시 굵기', .62); }],
  ['draw-ink', '그리기 · 불투명도 조절 중', async () => {
    await act(async () => tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === '브러시 굵기')[0].props.onResponderRelease());
    await holdRail('브러시 불투명도', .55);
  }],
  ['draw-brush', '그리기 · 브러시 전체 목록', async () => {
    await act(async () => tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === '브러시 불투명도')[0].props.onResponderRelease());
    await press('브러시 전체');
  }],
  ['draw-fav-edit', '그리기 · 즐겨찾기 편집', async () => { await press('즐겨찾기 편집'); }],
  ['draw-fav-slot', '그리기 · 즐겨찾기 넣을 칸 고르기', async () => { await press('즐겨찾기에 넣기 붓펜'); }],
  ['draw-color', '그리기 · 색', async () => { await press('즐겨찾기 고정 취소'); await press('즐겨찾기 편집 끝내기'); await press('브러시 닫기'); await press('색'); }],
  ['draw-reference', '그리기 · 참고', async () => { await press('팔레트 닫기'); await press('참고'); }],
  ['draw-layers', '그리기 · 레이어', async () => { await press('참고 닫기'); await press('레이어'); }],
  ['draw-caption', '그리기 · 문구 + 키보드', async () => {
    await press('레이어 닫기'); await press('문구');
    await act(async () => (keyboardListeners.keyboardDidShow || []).forEach(fn => fn({ endCoordinates: { height: 320 } })));
  }],
  ['draw-selection', '그리기 · 선택과 변형', async () => {
    await act(async () => (keyboardListeners.keyboardDidHide || []).forEach(fn => fn({})));
    await press('문구 닫기');
    await press('선택');
    await message({ ...scene, selection: { x: 40, y: 40, w: 180, h: 180 } });
  }],
  ['motion-base', '움직이기', async () => { await message({ ...scene, selection: null }); await press('움직이기'); }],
  ['motion-parts', '움직이기 · 부분 움직임', async () => { await press('부분만 움직이기'); }],
  ['export-before', '내보내기 · 만들기 전', async () => { await press('그리기'); await closePainter(); await press('내보내기'); }],
  ['export-result', '내보내기 · 결과', async () => { await press('파일 묶음 만들기'); await settle(); }],
  // 설정을 먼저 연다. 여기서 검수용 PRO 를 꺼야 PRO 화면이 '사기 전' 모습으로 그려진다.
  ['settings', '설정', async () => { await press('뒤로'); await press('뒤로'); await press('내 정보'); }],
  ['pro', 'PRO', async () => { await press('검수용 PRO 켜기'); await press('PRO 이용'); }],
  // 브러시 네 상태(45.25차 6번). 참고 자리를 세우려면 표현 가이드에서 들어가야 한다.
  ['draw-brush-2', '그리기 · 브러시 선택', async () => {
    await press('PRO 닫기'); await press('홈');   // 2026-10-08: 설정은 '내 정보' 탭 — 홈 탭으로 돌아와 가이드를 연다
    await press('표현 가이드'); await press('고마워 · 두 손 모아 꾸벅'); await press('정중하게 고르기'); await press('참고 보기');
    await ready();
    await press('브러시 전체');
  }],
  ['draw-brush-detail', '그리기 · 브러시 세부 설정', async () => { await press('세부 설정'); }],
  ['draw-ref-and-brush', '그리기 · 참고와 브러시 함께', async () => {
    // 45.35: 세부 설정은 접히는 줄이 아니라 같은 창의 다른 화면이다. 목록으로 돌아와서 견준다.
    await press('브러시 목록으로');
  }],
  // 45.43 S5: 32칸을 다 채운 보드 — 완성 카드 B. 렌더용 데이터만 바꾼다(검토 세트의 모든 칸을 완성으로).
  ['board-complete', '보드 · 전부 완성', async () => {
    await unmount(); seed(2, false, true); await fresh(); await press(SET_NAME);
  }],
];

// pro=false 는 렌더용 상태만 바꾼다(저장소의 검수용 PRO 표시를 끔). 결제·권한 코드는 건드리지 않는다.
function seed(count, pro = true, complete = false) {
  files.clear();
  const p = createProject(SET_NAME, '콩이');
  p.slots = p.slots.map((s, i) => complete ? { ...s, finalImage: { path: 'a.png', width: 360, height: 360 }, done: true } : i < 18
    ? { ...s, finalImage: { path: 'a.png', width: 360, height: 360 }, done: i < 14, dialogue: i === 0 ? '고마워요' : '' }
    : s);
  p.lastSlot = 15;
  const second = createProject('두 번째 세트', '콩이');
  // 최근 순서를 못 박는다. 같은 밀리초에 만들면 차례가 뒤집혀 '이어서 만들기' 카드가 바뀐다.
  p.updatedAt = '2026-09-23T00:00:00.000Z';
  second.updatedAt = '2026-09-01T00:00:00.000Z';
  // 검수용 PRO 를 켜 둔다 — 결제 없이 PRO 화면(부분 움직임)까지 그려 보기 위해서다. 구매가 아니다.
  // 칸이 가리키는 그림 파일을 실제로 둔다 — 없으면 내보내기가 '파일을 찾을 수 없어요'에서 멈춘다.
  files.set('document/emoticon-studio/a.png', fsNode.readFileSync(SLOT_ART));
  saveStore({ version: 1, introDone: true, revision: 1, projects: count === 0 ? [] : count === 1 ? [p] : [p, second], palette: ['#54A9E8', '#E94F4F'], reviewUnlock: pro });
}

// ── 홍보 캡처 대체 렌더(PROMO_SCENES=1 일 때만, 검사에는 영향 없음) ─────────────────────────────
// 세트 '몽이의 하루' — scripts/promo/backup-set.cjs 가 만드는 백업과 같은 상태(12칸 완성 · 1칸 몸/손 + 부분 회전 · 2칸 통통).
// 캔버스 자리는 화면마다 다른 그림: 엔진이 그린 순간(verification/promo/motion/*.png) 또는 그 칸의 그림.
const PROMO_DIR = pathNode.resolve(__dirname, '..', 'assets', 'promo', 'characters');
const PROMO_ORDER = ['hello', 'excited', 'thanks', 'sorry', 'good', 'congrats', 'sleepy', 'teary', 'surprised', 'cheer', 'pouty', 'goodnight'];
const PROMO_LABEL = ['안녕', '신나', '고마워', '미안해', '좋아', '축하해', '졸려', '울먹', '놀람', '응원', '삐짐', '잘 자'];
const promoArt = Object.fromEntries(PROMO_ORDER.map(k => [`mongi-${k}.png`, pathNode.join(PROMO_DIR, `mongi-${k}.png`)]));
const PROMO_MOTION = {
  hello: { version: 1, speed: .5, strength: .5, captionMoves: false, parts: [{ id: 'p1', layerId: 'draw-2', effect: 'rotate', pivotX: 250 / 360, pivotY: 222 / 360, amount: 30, angle: 0, speed: .6, delay: 0 }] },
  excited: { version: 1, preset: 'bounce', speed: .5, strength: .7, captionMoves: false },
  pouty: { version: 1, preset: 'shake', speed: .5, strength: .7, captionMoves: false },
};
const canvasArt = {};
function seedPromo() {
  files.clear();
  const p = createProject(SET_NAME, '몽이');
  const L = (id, name, path) => ({ id, name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0, image: { path, width: 360, height: 360 } });
  p.slots = p.slots.map((s, i) => {
    if (i >= 12) return s;
    const k = PROMO_ORDER[i], path = `mongi-${k}.png`;
    files.set('document/emoticon-studio/' + path, fsNode.readFileSync(promoArt[path]));
    const layers = k === 'hello' ? [L('draw-1', '몸', path), L('draw-2', '손', path)] : [L('draw-1', '그림 1', path)];
    return { ...s, dialogue: PROMO_LABEL[i], finalImage: { path, width: 360, height: 360 }, done: true, status: 'REVIEW', work: { version: 1, activeLayerId: layers.at(-1).id, layers, references: [] },
      ...(PROMO_MOTION[k] ? { motion: PROMO_MOTION[k], motionImage: { path, width: 360, height: 360 } } : {}) };
  });
  p.lastSlot = 12; p.updatedAt = '2026-10-03T00:00:00.000Z';
  saveStore({ version: 1, introDone: true, revision: 1, projects: [p], palette: ['#2A2320', '#F5E642', '#E9897E'], reviewUnlock: true });
}
const layersOf = names => names.map((name, i) => ({ id: 'draw-' + (i + 1), name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }));
const PROMO_MOTION_DIR = pathNode.resolve(__dirname, '..', 'verification', 'promo', 'motion');
const PROMO_SCREENS = [
  // ① 통통이 적용된 '신나'(2칸) 움직이기 화면 — 세기·속도 조절 줄이 보이는 상태. 캔버스: 엔진 순간(공중).
  ['promo-1-motion', '① 움직이기 · 통통 적용', async () => {
    canvasArt['promo-1-motion'] = pathNode.join(PROMO_MOTION_DIR, 'bounce-excited-t1.png');
    seedPromo(); await fresh(); await press(SET_NAME); await tap('slot-2');
    await ready({ caption: null, motion: PROMO_MOTION.excited }); await press('움직이기'); await press('움직임 묶음 동작');
  }],
  // ② '응원'(10칸) 그리기 화면.
  ['promo-2-draw', '② 그리기 · 응원', async () => {
    canvasArt['promo-2-draw'] = promoArt['mongi-cheer.png'];
    await unmount(); seedPromo(); await fresh(); await press(SET_NAME); await tap('slot-10');
    await ready({ caption: null });
  }],
  // ③ '안녕'(1칸) 부분만 움직이기 — 손 레이어 회전. 캔버스: 엔진 순간(손이 돌아간 때).
  ['promo-3-parts', '③ 부분만 움직이기 · 손', async () => {
    canvasArt['promo-3-parts'] = pathNode.join(PROMO_MOTION_DIR, 'part-wave-hello-t1.png');
    await unmount(); seedPromo(); await fresh(); await press(SET_NAME); await tap('slot-1');
    await ready({ caption: null, activeLayerId: 'draw-2', layers: layersOf(['몸', '손']), motion: PROMO_MOTION.hello });
    await press('움직이기'); await press('부분만 움직이기');
  }],
  // ④ 보드 — 12칸 완성 · 나머지 빈칸(완성으로 표시하지 않음).
  ['promo-4-board', '④ 보드 · 몽이의 하루', async () => { await unmount(); seedPromo(); await fresh(); await press(SET_NAME); }],
];

// 화면을 차례로 열고, 열릴 때마다 cb(id, title, tree, flat) 를 부른다.
// 45.35: 높이도 받는다. 예전에는 폭만 바꿔서, 320×568 로 찍어도 화면은 **844 높이로 배치된 뒤**
// 568 에서 잘렸다 — 짧은 화면의 문제를 보는 것이 아니라 없는 문제를 만들어 보고 있었다.
async function walk(width, cb, height) {
  viewport.width = width;
  if (height) viewport.height = height;
  for (const [id, title, open] of (process.env.PROMO_SCENES ? PROMO_SCREENS : SCREENS)) {
    await open();
    await cb(id, title, tree, flat);
  }
  await unmount();
}

module.exports = { deviceArt: { 'a.png': SLOT_ART, ...promoArt }, canvasArt, alerts, closePainter, debugFiles: () => [...files.keys()].map(k => [k, String(files.get(k))]), walk, SCREENS, flat, viewport, press, tap, fresh, unmount, ready, seed, get tree() { return tree; } };
