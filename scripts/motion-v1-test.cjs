// MOTION V1 — 앱 흐름 검사. 그림 선택 → 움직임 선택(즉시 칸에 들어감) → 속도/세기 → 칸 닫기(자동저장) → 재시작 복원까지를
// 실제 App·저장소 코드로 돈다. 38차부터 '적용/취소'는 없고, 무료 사용자는 PRO 입구에서 PRO 안내로 간다(만든 뒤 저장할 때 막지 않는다).
// 캔버스 엔진은 흉내다(엔진 쪽 반복·잘림·GIF 는 motion-test.cjs 가 실제 브라우저에서 맡는다).
// 엔진을 흉내 낼 때 규칙: 저장 응답의 motion 은 **엔진이 가진 값**(init 으로 받았거나 motion 명령으로 바뀐 값)이다.
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
  async bytes() { return this.bytesSync(); }
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
  delete() { files.delete(this.uri); }
}
const commands = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const alerts = [];
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
let gifCount = 0;
const images = { dataUrl: async () => 'data:image/png;base64,test', pickImages: async () => [], savePainterWork: (...a) => real.savePainterWork(...a), saveCutout: () => ({}), saveMotionLoop: () => ({ path: 'moving-' + (++gifCount) + '.gif', width: 360, height: 360 }), saveSubmitLoop: () => undefined };
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n])); rn.Animated = require('./_rn-animated-mock.cjs');
Object.assign(rn, { Keyboard: { addListener: () => ({ remove() {} }), dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert(title, message, buttons) { alerts.push({ title, message, buttons }); } }, Linking: { openURL: async () => {} } });
const mocks = {
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'bundled://art', uri: 'bundled://art' }) }) } },
  'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-constants': { default: { expoConfig: { extra: {} } } }, 'react-native-webview': { WebView },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => {} },
  'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  './src/components/image-analyzer': { ImageAnalyzer: () => null },
  './src/components/extra-composer': { ExtraComposer: React.forwardRef(() => null), placeInFrame: () => ({ x: 0, y: 0, w: 1, h: 1 }) },
  './src/components/motion-baker': { MotionBaker: React.forwardRef(() => null) },
};
const load = loader({ ...mocks, './src/services/images': images, '../services/images': images });
const real = loader(mocks)('src/services/images.ts');
const { createProject, isAnimated, doneCount } = load('src/project.ts');
const { loadStore, saveStore } = load('src/services/storage.ts');
const App = load('App.tsx').default;

const png = Buffer.alloc(33); Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png); png.writeUInt32BE(360, 16); png.writeUInt32BE(360, 20);
const pngData = 'data:image/png;base64,' + png.toString('base64');
const metrics = { coverage: .2, centerX: .5, centerY: .5, width: .5, height: .5, color: [.2, .2, .2], transparent: true };
let tree, scene;
const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
const lastCommand = type => sent().filter(m => m.type === type).at(-1);
const labelled = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const press = async label => { const m = labelled(label); assert.equal(m.length, 1, 'button ' + label + ' (' + m.length + ')'); assert.ok(!m[0].props.disabled, 'enabled ' + label); await act(async () => m[0].props.onPress()); };
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
const nudge = async (label, action, times = 1) => {
  for (let i = 0; i < times; i++) {
    const [r] = tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === label);
    assert.ok(r, 'range ' + label);
    await act(async () => r.props.onAccessibilityAction({ nativeEvent: { actionName: action } }));
    await echoMotion();
  }
};
// 엔진 흉내: 마지막 motion 명령을 받아 state 로 돌려준다.
const echoMotion = async () => { const c = lastCommand('motion'); if (c) { scene = { ...scene, motion: c.motion }; await message(scene); } };
const publicLayer = l => Object.fromEntries(['id', 'name', 'visible', 'opacity', 'x', 'y', 'scale', 'rotation'].map(k => [k, l[k]]));
// 엔진 흉내: save 명령에 저장 응답을 돌려준다. motion 은 엔진이 지금 가진 값이다.
const answerSave = async (dirty = true) => {
  const cmd = lastCommand('save');
  assert.ok(cmd, 'save 명령이 나갔다');
  // 45.12: 엔진은 요청 번호를 그대로 돌려준다 — 화면은 번호가 맞는 응답만 받는다.
  await message({ type: 'save', token: cmd.token, dirty, data: pngData, metrics, activeLayerId: scene.activeLayerId, caption: scene.caption || undefined, motion: scene.motion ?? null,
    gif: cmd.gif && scene.motion ? { count: 9, fps: 12, loop: .8, delayMs: 83, data: 'data:image/gif;base64,R0lGODlh', bytes: 2048, droppedColours: 0, clipped: false } : undefined,
    layers: scene.layers.map(l => ({ ...publicLayer(l), data: pngData })), references: [] });
};
const fresh = () => loadStore().store.projects[0];
const slotOf = n => fresh().slots.find(s => s.number === n);
async function restart() { if (tree) await act(async () => tree.unmount()); commands.length = 0; await act(async () => { tree = create(React.createElement(App)); }); }
async function openSlot(n) {
  await press('움직임 세트');
  const tile = tree.root.findAll(x => x.type === 'Pressable' && x.props.testID === 'slot-' + n);
  await act(async () => tile[0].props.onPress());
  await message({ type: 'ready' });
  const init = lastCommand('init');
  scene = { type: 'state', undo: false, redo: false, dirty: false, activeLayerId: init.activeLayerId || 'draw-1', activeReferenceId: null, caption: init.caption || null, motion: init.motion ?? null,
    layers: init.layers.map(l => ({ ...publicLayer(l) })), references: [] };
  await message(scene); await message({ type: 'initialized' });
  return init;
}
const closePainter = async () => { await press('그리기 닫기'); await answerSave(false); };

(async () => {
  const project = createProject('움직임 세트', '콩이');
  const range = label => tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === label);
  const motionCommands = () => sent().filter(m => m.type === 'motion').length;
  // 이전 버전 저장본 모양: 움직임·브러시·내 팔레트 필드가 전혀 없다.
  saveStore({ version: 1, introDone: true, revision: 1, projects: [project] });
  assert.equal(fresh().slots.length, 32);
  const untouched = JSON.stringify(fresh().slots.filter(s => ![1, 2, 3, 4].includes(s.number)));

  // ── 빈 칸: 움직임 없이 열리고, 칸을 닫으며 저장해도 움직임이 생기지 않는다 ─────────────────────
  await restart();
  let init = await openSlot(4);
  assert.equal(init.motion ?? null, null, '빈 칸은 움직임 없이 열린다');
  // 44.2차: 아무것도 그리지 않은 칸에서는 효과 견본이 기본 그림(motionExampleArtwork 자리)으로 움직이고, 그림이 생기면 사용자의 그림이 먼저다.
  await press('움직이기');
  const sampleSources = () => tree.root.findAll(n => n.type === 'Image' && n.props.accessibilityIgnoresInvertColors).map(n => n.props.source);
  assert.ok(sampleSources().length >= 3, '효과 견본 세 개');
  assert.ok(sampleSources().every(src => !src || !src.uri), '빈 칸: 견본이 비어 있지 않고 기본 그림으로 움직인다');
  await message({ type: 'layerThumbs', thumbs: [{ id: scene.activeLayerId, data: pngData }] });
  scene = { ...scene, undo: true }; await message(scene);
  assert.ok(sampleSources().every(src => src && src.uri === pngData), '그림이 있으면 사용자의 그림이 견본이 된다');
  scene = { ...scene, undo: false }; await message(scene);
  await press('그리기');
  scene = { ...scene, caption: { text: '안녕', place: 'bottom', color: '#242424' } };
  await press('그리기 닫기');
  assert.equal(lastCommand('save').gif, false, '움직임이 없으면 움직이는 파일을 만들지 않는다');
  await answerSave(true);
  assert.equal(slotOf(4).motion, undefined, '그림 저장은 움직임을 만들지 않는다');
  assert.equal(slotOf(4).motionImage, undefined);

  // ── 무료 기본 움직임 3종: 고르면 즉시 칸에 → 속도 → 세기 → 칸 닫기 → 재시작 복원 → 그대로 닫아도 유지 ──────
  const cases = [['bounce', '통통', 1], ['shake', '흔들기', 2], ['pulse', '두근거리기', 3]];
  for (const [preset, label, n] of cases) {
    await restart();
    init = await openSlot(n);
    assert.equal(init.motion ?? null, null, label + ': 처음엔 움직임 없음');
    scene = { ...scene, caption: { text: label + ' 문구', place: 'top', color: '#242424' } };
    await press('움직이기');
    assert.deepEqual(lastCommand('play'), { type: 'play' }, label + ': 탭을 열면 미리보기가 돈다');
    assert.equal(range('속도').length, 0, label + ': 효과를 고르기 전에는 설정표가 먼저 나오지 않는다');
    await press(label);
    const picked = lastCommand('motion').motion;
    assert.deepEqual(picked, { version: 1, speed: .5, strength: .5, captionMoves: false, preset }, label + ': 기본값으로 바로 캔버스에 간다(즉시 미리보기)');
    await echoMotion();
    await nudge('속도', 'increment', 2);
    assert.equal(lastCommand('motion').motion.speed, .6, label + ': 속도 변경');
    await nudge('세기', 'decrement', 3);
    assert.equal(lastCommand('motion').motion.strength, .35, label + ': 세기 변경');
    assert.equal(labelled('움직임 적용').length + labelled('움직임 취소').length, 0, label + ': 적용·취소 단계 없이 고르는 즉시 들어간다');
    assert.equal(labelled('PRO 닫기').length, 0, label + ': 무료 효과는 PRO 를 묻지 않는다');
    await press('그리기 닫기');
    assert.equal(lastCommand('save').gif, true, label + ': 칸을 닫으면 움직이는 파일까지 저장한다');
    assert.equal(labelled('PRO 효과 빼고 저장').length, 0, label + ': 무료 저장은 막히지 않는다');
    await answerSave(true);
    const expected = { version: 1, speed: .6, strength: .35, captionMoves: false, preset };
    assert.deepEqual(slotOf(n).motion, expected, label + ': 저장된다');
    assert.ok(slotOf(n).motionImage?.path, label + ': 움직이는 파일이 붙는다');
    // 42차 실기기: 움직이는 GIF 를 PNG 검사에 넣어 움직이는 칸마다 빨간 FAIL 이 났다. 검사는 PNG 칸 그림에 한다.
    assert.notEqual(slotOf(n).status, 'FAIL', label + ': 움직임을 넣었다고 자동 검사에서 떨어지지 않는다 ' + JSON.stringify(slotOf(n).qa?.checks));
    assert.ok(!slotOf(n).qa.checks.some(c => c.label === '파일 형식' && c.status === 'FAIL'), label + ': PNG 칸 그림을 검사한다');
    assert.equal(slotOf(n).work.caption.text, label + ' 문구', label + ': 움직임 저장이 그림·문구를 건드리지 않는다');
    assert.ok(isAnimated(slotOf(n)), label + ': 움직이는 칸으로 센다');

    await restart();
    init = await openSlot(n);
    assert.deepEqual(init.motion, expected, label + ': 재시작 뒤 캔버스가 저장된 움직임을 받는다');
    await press('움직이기');
    assert.ok(labelled(label)[0].props.accessibilityState.selected, label + ': 움직임 화면이 저장된 효과를 선택으로 보여 준다');
    await press('그리기 닫기'); await answerSave(false);
    assert.deepEqual(slotOf(n).motion, expected, label + ': 재시작 뒤 그냥 닫아도 움직임이 지워지지 않는다');
    assert.ok(slotOf(n).motionImage?.path, label + ': 움직이는 파일도 남는다');
  }

  // ── 움직임 없음: 움직임만 빠지고 그림·문구는 그대로 ──────────────────────────────────────
  await restart();
  await openSlot(3);
  const drawingBefore = JSON.stringify({ layers: slotOf(3).work.layers.map(l => l.id), caption: slotOf(3).work.caption });
  await press('움직이기'); await press('움직임 없음');
  assert.equal(lastCommand('motion').motion, null);
  await echoMotion();
  // 39차 실기기: 엔진은 '움직임 없음'에서 재생을 멈춘다. 같은 탭에서 효과를 다시 고르면 재생 명령이 뒤따라야 캔버스가 다시 움직인다.
  await press('통통');
  const tail = sent().slice(-2).map(m => m.type);
  assert.deepEqual(tail, ['motion', 'play'], '움직임 없음 → 통통: 캔버스 미리보기를 다시 켠다');
  await echoMotion();
  await press('움직임 없음');
  assert.equal(lastCommand('motion').motion, null);
  assert.notEqual(sent().at(-1).type, 'play', '움직임 없음은 재생을 켜지 않는다');
  await echoMotion();
  await press('그리기 닫기');
  assert.equal(lastCommand('save').gif, false, '움직임이 없으면 움직이는 파일을 만들지 않는다');
  await answerSave(true);
  assert.equal(slotOf(3).motion, undefined, '움직임이 빠진다');
  assert.equal(slotOf(3).motionImage, undefined, '움직이는 파일도 빠진다');
  assert.ok(slotOf(3).finalImage, '정지 그림은 남는다');
  assert.equal(JSON.stringify({ layers: slotOf(3).work.layers.map(l => l.id), caption: slotOf(3).work.caption }), drawingBefore, '레이어·문구 그대로');

  // ── PRO 사용자: 부분 움직임 두 개·차례로·시작 간격·순서 바꾸기 → 저장 ──────────────────────────
  const s1 = loadStore().store;
  saveStore({ ...s1, revision: s1.revision + 1, entitlement: { plan: 'yearly', source: 'store', verified: true, expiresAt: '2099-01-01T00:00:00.000Z' }, projects: s1.projects.map(p => ({ ...p, brush: { preset: 'marker', opacity: .5, stabilizer: 'strong' } })) });
  await restart();
  await openSlot(2);
  await press('움직이기');
  assert.equal(tree.root.findAll(n => n.type === 'Text' && String(n.children?.join('')) === 'PRO').length, 0, 'PRO 사용자에게는 PRO 표시가 붙지 않는다');
  // 45.10: 새 칸은 그림 한 장으로 열린다 — 부분 움직임을 두 장에 걸려면 앱에서처럼 장을 하나 더 만든다.
  if (!scene.layers.some(l => l.id === 'draw-2')) {
    scene = { ...scene, layers: [...scene.layers, { id: 'draw-2', name: '그림 2', visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 }] };
    await message(scene);
  }
  await press('부분만 움직이기');
  await press('레이어 1 부분 움직임 추가');
  await echoMotion();
  await press('레이어 2 부분 움직임 추가');
  await echoMotion();
  await press('차례로');
  await echoMotion();
  await nudge('시작 간격', 'increment', 2);
  const proMotion = lastCommand('motion').motion;
  assert.equal(proMotion.parts.length, 2, 'PRO: 레이어 두 개에 부분 움직임');
  assert.equal(proMotion.play, 'sequence', 'PRO: 차례로');
  assert.ok(proMotion.parts[1].delay > proMotion.parts[0].delay, 'PRO: 시작 간격이 뒤 부분에 걸린다');
  assert.equal(proMotion.preset, 'shake', 'PRO: 전체 움직임과 조합된다');
  // 세부 조절(중심점·방향)은 펼쳐야 보인다 — 한 화면에 전부 늘어놓지 않는다.
  assert.equal(labelled('중심점 옮기기').length, 0, '중심점은 처음부터 보이지 않는다');
  await press('레이어 1 움직이기');
  await press('레이어 1 세부 조절');
  assert.equal(labelled('중심점 옮기기').length, 1, '세부 조절을 펼치면 중심점이 나온다');
  // 끌어서 순서 바꾸기. 순서는 '차례로' 재생할 때 누가 먼저 움직이는지를 정한다.
  const handles = tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && /순서 바꾸기$/.test(n.props.accessibilityLabel ?? ''));
  assert.equal(handles.length, 2, '부분마다 끌기 손잡이가 있다');
  const cards = tree.root.findAll(n => n.type === 'View' && typeof n.props.onLayout === 'function' && !!n.props.style && n.props.style.borderRadius === 16);
  await act(async () => cards[0].props.onLayout({ nativeEvent: { layout: { height: 96 } } }));
  await act(async () => handles[0].props.onResponderGrant({ nativeEvent: {} }));
  await act(async () => handles[0].props.onResponderMove({ nativeEvent: { locationY: 24 + 96 } }));
  await act(async () => handles[0].props.onResponderRelease({ nativeEvent: {} }));
  const dragged = lastCommand('motion').motion.parts;
  assert.equal(dragged[0].id, proMotion.parts[1].id, '끌어 내린 것이 아래로 간다');
  await echoMotion();
  await press('앞으로');
  assert.equal(lastCommand('motion').motion.parts[0].id, proMotion.parts[0].id, '앞으로 버튼이 순서를 되돌린다');
  await echoMotion();
  await press('움직임 처음으로');
  // V2 다중 동작(2026-10-07, PRO): 단계로 잇기 — 단계 둘, 효과·반복 바꾸기, 한 바퀴 3초 안
  await press('단계로 잇기');
  await press('단계 더하기');
  await echoMotion();
  await press('단계 더하기');
  await echoMotion();
  await press('2단계 두근거리기');
  await echoMotion();
  await press('1단계 반복 2번');
  await echoMotion();
  const stepped = lastCommand('motion').motion;
  assert.equal(stepped.steps.length, 2, 'PRO: 단계 두 개');
  assert.equal(stepped.steps[1].preset, 'pulse', 'PRO: 2단계 효과를 바꿨다');
  assert.equal(stepped.steps[0].repeat, 2, 'PRO: 1단계 반복 2번');
  assert.ok(stepped.steps.reduce((t, s) => t + s.duration * s.repeat, 0) <= 3 + 1e-9, 'PRO: 한 바퀴 3초 안');
  assert.equal(stepped.parts.length, 2, 'PRO: 단계를 더해도 부분 움직임은 그대로');
  await press('움직임 처음으로');
  await press('흔들기');
  assert.equal(lastCommand('motion').motion.steps, undefined, '효과 하나를 고르면 단계 대신 그 효과로 바뀐다');
  await echoMotion();
  await press('단계로 잇기');
  await press('단계 더하기');
  await echoMotion();
  await press('움직임 처음으로');
  await press('그리기 닫기');
  assert.equal(labelled('PRO 효과 빼고 저장').length, 0, 'PRO 이용 중에는 저장이 막히지 않는다');
  await answerSave(true);
  assert.equal(slotOf(2).motion.parts.length, 2, 'PRO 움직임이 저장된다');

  // ── PRO 가 끝난 사용자: 저장된 PRO 움직임은 계속, 새 PRO 작업은 들어가기 전에 안내 ─────────────────
  const s2 = loadStore().store;
  saveStore({ ...s2, revision: s2.revision + 1, entitlement: undefined, savedMotions: [{ id: 'm-pro', name: '부분 2', motion: slotOf(2).motion }] });
  await restart();
  init = await openSlot(2);
  assert.deepEqual(init.motion, slotOf(2).motion, '무료가 된 뒤에도 저장된 PRO 움직임이 캔버스로 온다');
  await press('움직이기');
  const partsRow = labelled('부분만 움직이기')[0];
  assert.ok(partsRow.findAll(n => n.type === 'Text' && String(n.children?.join('')) === 'PRO').length === 1, '누르기 전에 PRO 라고 보인다');
  let before = motionCommands();
  await press('부분만 움직이기');
  assert.equal(labelled('PRO 닫기').length, 1, '무료: 부분 움직임 입구는 PRO 안내로 간다');
  assert.equal(motionCommands(), before, '무료: 안내를 여는 것만으로 움직임이 바뀌지 않는다');
  await press('PRO 닫기');
  before = motionCommands();
  await press('단계로 잇기');
  assert.equal(labelled('PRO 닫기').length, 1, '무료: 단계로 잇기 입구도 PRO 안내로 간다');
  assert.equal(motionCommands(), before, '무료: 안내를 여는 것만으로 움직임이 바뀌지 않는다(단계)');
  await press('PRO 닫기');
  await press('보관한 움직임');
  before = motionCommands();
  await press('부분 2 꺼내 쓰기');
  assert.equal(labelled('PRO 닫기').length, 1, '무료: PRO 내용이 든 보관 움직임도 꺼내기 전에 안내한다');
  assert.equal(motionCommands(), before, '무료: 칸에 넣지 않는다');
  await press('PRO 닫기');
  await press('움직임 처음으로');
  // 무료 효과를 바꿔도 이미 저장된 PRO 움직임은 다시 묻지 않는다.
  await press('통통');
  await echoMotion();
  await press('그리기 닫기');
  assert.equal(labelled('PRO 효과 빼고 저장').length, 0, '무료 효과만 바꾼 저장은 막히지 않는다');
  await answerSave(true);
  assert.equal(slotOf(2).motion.parts.length, 2, '저장된 PRO 부분 움직임은 지워지지 않는다');
  assert.equal(slotOf(2).motion.preset, 'bounce', '바꾼 무료 효과가 저장된다');

  // ── 32칸·다른 칸·브러시 설정 불변 ────────────────────────────────────────────────────────
  const end = fresh();
  assert.equal(end.slots.length, 32, '32칸 유지');
  assert.equal(JSON.stringify(end.slots.filter(s => ![1, 2, 3, 4].includes(s.number))), untouched, '만지지 않은 28칸은 바이트까지 같다');
  assert.equal(doneCount(end), 0, '움직임 저장이 완성 수를 바꾸지 않는다');
  assert.deepEqual(end.brush, { preset: 'marker', opacity: .5, stabilizer: 'strong' }, '움직임 저장이 브러시 설정을 건드리지 않는다');
  assert.ok(end.slots.filter(isAnimated).map(s => s.number).join() === '1,2', '움직이는 칸은 1·2번뿐(3번은 없앴다)');

  // 45.22: 완료 줄이 조절 막대를 덮지 않는다. 겹쳐 띄우지 않고 스크롤의 형제로 두므로 구조적으로 가릴 수 없다.
  await restart();
  await openSlot(1);
  await press('움직이기');
  const complete = labelled('저장')[0];
  assert.ok(complete, '움직이기 화면에도 완료 줄이 있다');
  const scrolls = tree.root.findAllByType('ScrollView');
  assert.ok(scrolls.length >= 1, '설정부는 스크롤된다');
  for (const sv of scrolls) assert.equal(sv.findAll(n => n === complete).length, 0, '완료 줄은 스크롤 안에 있지 않다(따로 선다)');
  for (const sv of scrolls) {
    const pad = Object.assign({}, ...[sv.props.contentContainerStyle].flat(9).filter(Boolean));
    if (pad.paddingBottom !== undefined) assert.ok(pad.paddingBottom >= 16, '마지막 조절 막대가 아래 줄에 바짝 붙지 않는다: ' + pad.paddingBottom);
  }
  await press('그리기');
  await act(async () => tree.unmount());
  console.log('PASS: motion v1 — 통통·흔들기·두근거리기 각각 고르는 즉시 미리보기(설정은 고른 뒤)·속도·세기·칸 닫기로 저장·재시작 복원·그대로 닫아도 유지, 움직임 없음(그림·문구 유지), 빈 칸·이전 버전 저장본, PRO 부분 2개·차례로·시작 간격·세부 조절은 펼쳐야 보임·끌기/버튼 순서 바꾸기·저장, PRO 종료 뒤: 저장된 PRO 움직임 유지, 부분 움직임 입구·PRO 보관 움직임은 누르는 순간 안내(칸 불변), 무료 효과 변경 저장은 막히지 않음, 32칸·다른 칸·완성 수·브러시 설정 불변. Native/WebView mocked.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
