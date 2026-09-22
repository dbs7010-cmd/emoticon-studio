// 45.2차 UI 구조 잠금. 기능이 아니라 **순서와 노출 조건**이 되돌아가지 않게 막는다.
//   홈(세트 0·1·4·10 × 공지 꺼짐/켜짐) · 그리기(기본·브러시·색·레이어·문구·참고·선택·확대) ·
//   움직이기(빈 칸·효과·재사용·PRO) · 보드(빈·일부·완성) · 내보내기(일부·손볼 곳·자세히).
// 실제 앱을 그려(react-test-renderer) 순서를 읽는다. 픽셀·손맛 판정은 실기기가 맡는다.
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
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
  delete() { files.delete(this.uri); }
}
const keyboardListeners = {};
const commands = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => ms === 40000 ? { unref() {} } : realSetInterval(fn, ms);
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n]));
Object.assign(rn, { Keyboard: { addListener: (name, fn) => { (keyboardListeners[name] = keyboardListeners[name] || []).push(fn); return { remove() {} }; }, dismiss() {}, isVisible: () => false }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} }, Linking: { openURL: async () => {} } });
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
const load = loader(base);
const { saveStore } = load('src/services/storage.ts');
const { createProject } = load('src/project.ts');
const { T } = load('src/components/ui.tsx');
const App = load('App.tsx').default;
// 공지가 켜진 홈은 같은 화면을 다른 자료로 그린 것이다. 자료(asset-slots)만 갈아끼워 같은 App 을 다시 그린다.
const slotSource = load('src/design/asset-slots.ts');
const noticeOn = { ...slotSource, HOME_NOTICE: { ...slotSource.HOME_NOTICE, enabled: true, title: '첫 공지', body: '짧은 정보 한 줄' } };
const AppNotice = loader({ ...base, './src/design/asset-slots': noticeOn, '../design/asset-slots': noticeOn })('App.tsx').default;

let tree, scene;
const flat = style => Object.assign({}, ...[style].flat(9).filter(Boolean).map(s => typeof s === 'function' ? s({ pressed: false }) : s));
const all = () => tree.root.findAll(() => true);
const anyLabel = label => tree.root.findAll(n => n.props.accessibilityLabel === label);
 const labelled = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const press = async label => { const m = labelled(label); assert.equal(m.length, 1, 'button ' + label + ' (' + m.length + ')'); await act(async () => m[0].props.onPress()); };
const message = async m => { await act(async () => tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(m) } })); };
const lastCommand = type => sent().filter(m => m.type === type).at(-1);
 const sent = () => commands.map(s => JSON.parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(');true;'))));
const text = n => [n.props.children].flat(9).filter(x => typeof x === 'string' || typeof x === 'number').join('');
const texts = () => tree.root.findAll(n => n.type === 'Text').map(text);
const byTestID = id => tree.root.findAll(n => n.props.testID === id);
const render = async (Component = App) => { if (tree) await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(Component)); }); };
async function ready() {
  await message({ type: 'ready' });
  const init = sent().filter(m => m.type === 'init').at(-1);
  scene = { type: 'state', undo: false, redo: false, dirty: false, activeLayerId: 'draw-1', activeReferenceId: null, caption: null, motion: null, layers: init.layers.map(l => ({ id: l.id, name: l.name, visible: true, opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 })), references: [] };
  await message(scene); await message({ type: 'initialized' });
}
const setStore = (projects, revision) => saveStore({ version: 1, revision, projects, palette: ['#54A9E8'] });
const makeProjects = (count, from = 1) => Array.from({ length: count }, (_, i) => {
  const p = createProject('세트 ' + (from + i), '콩이');
  p.updatedAt = new Date(Date.UTC(2026, 8, from + i)).toISOString();
  return p;
});
const drawn = path => ({ path, width: 360, height: 360 });
// 홈에서 보이는 큰 덩어리를 그려진 차례대로 읽는다.
const homeSections = () => {
  const out = [];
  for (const n of all()) {
    const id = n.props?.testID, label = n.props?.accessibilityLabel;
    if (id === '홈 창작 표면') out.push('창작');
    else if (id === 'asset-slot-homeEmptyArtwork') out.push('빈 상태');
    else if (id === '홈 알림') out.push('공지');
    else if (n.type === 'Pressable' && label === '표현 가이드') out.push('가이드');
    else if (n.type === 'Text' && text(n) === '최근 작업') out.push('최근 작업');
    else if (n.type === 'Pressable' && /^세트 \d+$/.test(label ?? '')) out.push('카드');
  }
  return out.filter((s, i) => s !== '카드' || out[i - 1] !== '카드');
};

(async () => {
  // ── 1. 홈: 세트 수와 공지 상태가 순서를 바꾸지 않는다 ────────────────────────────────────────
  let revision = 1;
  for (const [count, cards] of [[0, 0], [1, 1], [4, 1], [10, 1]]) {
    for (const on of [false, true]) {
      const where = `세트 ${count} · 공지 ${on ? '켜짐' : '꺼짐'}`;
      setStore(makeProjects(count), revision++);
      await render(on ? AppNotice : App);
      const want = ['창작', ...(count ? [] : ['빈 상태']), ...(on ? ['공지'] : []), '가이드', ...(count ? ['최근 작업', '카드'] : [])];
      assert.deepEqual(homeSections(), want, '홈 순서(' + where + ')');
      assert.equal(byTestID('홈 알림').length, on ? 1 : 0, '공지가 꺼지면 자리도 없다(' + where + ')');
      assert.equal(tree.root.findAll(n => n.type === 'Pressable' && /^세트 \d+$/.test(n.props.accessibilityLabel ?? '')).length, cards, '홈에는 가장 최근 세트 하나만(' + where + ')');
      assert.equal(labelled('전체 작업 보기').length, count > 1 ? 1 : 0, '세트가 둘 이상이면 전체 작업으로 가는 길(' + where + ')');
      if (on) {
        const notice = byTestID('홈 알림')[0];
        assert.equal(notice.findAll(n => n.props.testID === 'asset-slot-noticeArtwork').length, 1, '공지에도 그림 자리는 남는다');
        assert.ok(notice.findAll(n => n.type === 'Pressable').length <= 1, '공지의 행동은 많아야 하나');
        assert.ok(flat(notice.props.style).paddingVertical <= 12, '공지는 낮은 한 줄 배너');
      }
      const yellow = tree.root.findAll(n => n.type === 'Pressable' && flat(n.props.style).backgroundColor === T.accent).map(n => n.props.accessibilityLabel);
      assert.deepEqual(yellow, ['새 이모티콘 만들기'], '홈의 노랑 버튼은 하나(' + where + ')');
      if (count) {
        const shortcut = tree.root.findAll(n => n.type === 'Pressable' && /^세트 \d+ 이어서 만들기$/.test(n.props.accessibilityLabel ?? ''))[0];
        const pill = shortcut.findAll(n => n.type === 'View')[0];
        assert.ok(!flat(pill.props.style).backgroundColor, '카드 안 지름길은 표면을 갖지 않는다 — 카드 자체보다 약하게(' + where + ')');
      }
    }
  }

  // ── 2. 그리기: 캔버스 위에는 한 번에 하나 · 패널도 한 번에 하나 ────────────────────────────────
  const p = createProject('구조 세트', '콩이');
  p.slots = p.slots.map((s, i) => i === 0 ? { ...s, finalImage: drawn('a.png'), done: true } : s);
  setStore([p], revision++);
  await render();
  await press('구조 세트');
  await act(async () => byTestID('slot-2')[0].props.onPress());
  await ready();
  const topSlot = () => all().filter(n => ['View', 'Pressable'].includes(n.type) && flat(n.props.style).position === 'absolute' && flat(n.props.style).top === 8 && flat(n.props.style).left === 12);
  const dockTools = () => ['브러시', '지우개', '채우기', '선택', '문구', '색'].filter(name => labelled(name).length === 1);
  const openPanels = () => ['브러시 닫기', '팔레트 닫기', '문구 닫기', '더보기 닫기'].filter(name => labelled(name).length === 1);
  const railOpen = () => ['참고', '레이어'].filter(name => labelled(name)[0].props.accessibilityState.selected);
  assert.deepEqual(dockTools(), ['브러시', '지우개', '채우기', '선택', '문구', '색'], '도구 줄: 그리는 것 넷 + 문구 + 색');
  assert.equal(anyLabel('브러시 굵기').length, 1, '굵기는 도구 줄이 아니라 행동 줄에 그대로 있다(7번째 도구가 아니다)');
  assert.ok(topSlot().length <= 1, '기본 상태: 캔버스 알림은 많아야 하나');
  assert.equal(openPanels().length + railOpen().length, 0, '기본 상태에서 열린 패널 없음');
  for (const [open, close] of [['브러시', '브러시 닫기'], ['색', '팔레트 닫기'], ['문구', '문구 닫기'], ['더보기', '더보기 닫기']]) {
    await press(open);
    assert.deepEqual(openPanels(), [close], open + ': 한 번에 한 패널만 화면을 쓴다');
    assert.deepEqual(railOpen(), [], open + ': 패널을 열면 참고·레이어 줄은 닫힌다');
    assert.ok(topSlot().length <= 1, open + ': 패널을 열어도 알림은 하나 이하');
    await press(close);
  }
  for (const rail of ['참고', '레이어']) {
    await press(rail);
    assert.deepEqual(railOpen(), [rail], rail + ': 줄도 한 번에 하나');
    assert.deepEqual(openPanels(), [], rail + ': 줄과 패널이 같이 열리지 않는다');
    await press(rail);
  }
  await press('참고');
  assert.equal(labelled('캐릭터 기준 보기').length + labelled('이 칸을 캐릭터 기준으로').length, 0, '참고 줄은 볼 그림만 다룬다');
  await press('참고');
  await press('선택');
  assert.equal(anyLabel('브러시 굵기').length + anyLabel('지우개 굵기').length, 0, '선택 도구에는 굵기가 없다 — 지금 쓰는 것만 보인다');
  await press('브러시');
  await message({ type: 'zoom', zoom: 2 });
  assert.equal(labelled('원래 크기로 보기').length, 1, '확대 중에만 배율 표시');
  assert.ok(texts().includes('200%'), '배율은 숫자로 말한다');
  assert.equal(flat(labelled('원래 크기로 보기')[0].props.style).right, 12, '배율은 알림 자리가 아니라 오른쪽 위에 따로 선다');
  await message({ type: 'zoom', zoom: 1 });
  // 끝난 경고가 하나뿐인 알림 자리를 계속 차지하지 않는다(45.2 검증에서 발견).
  const hide = async on => { scene = { ...scene, layers: scene.layers.map(l => l.id === scene.activeLayerId ? { ...l, visible: !on } : l) }; await message(scene); };
  await hide(true);
  await message({ type: 'blocked', reason: 'hidden', id: scene.activeLayerId, name: '그림' });
  assert.equal(labelled('숨긴 레이어 다시 보이기').length, 1, '숨긴 레이어에 그으면 이유를 말한다');
  scene = { ...scene, layers: scene.layers.map(l => ({ ...l, visible: true })) };
  await message(scene);
  assert.equal(labelled('숨긴 레이어 다시 보이기').length, 0, '레이어가 다시 보이면 경고는 끝난다');
  await hide(true);
  await message({ type: 'blocked', reason: 'hidden', id: scene.activeLayerId, name: '그림' });
  scene = { ...scene, picking: true };
  await message(scene);
  assert.equal(labelled('스포이드 취소').length, 1, '다른 일을 시작하면 그 안내가 자리를 받는다');
  scene = { ...scene, picking: false };
  await message(scene);
  await hide(false);


  // ── 3. 움직이기: 미리보기 → 효과 → 재사용 → 설정 → PRO 한 줄 ───────────────────────────────
  await press('움직이기');
  assert.equal(anyLabel('속도').length, 0, '효과를 고르기 전에는 설정을 내밀지 않는다');
  assert.ok(!texts().includes('더 세밀하게 움직이기'), '한 줄짜리 목록에 섹션 제목을 붙이지 않는다');
  const motionOrder = () => tree.root.findAll(n => n.type === 'Pressable' && ['통통', '보관한 움직임', '부분만 움직이기'].includes(n.props.accessibilityLabel)).map(n => n.props.accessibilityLabel);
  assert.deepEqual(motionOrder(), ['통통', '보관한 움직임', '부분만 움직이기'], '효과 → 다시 쓰기 → PRO 한 줄');
  await press('통통');
  // 엔진이 돌려주는 상태로 바꿔야 '고른 뒤'가 된다.
  await act(async () => {}); scene = { ...scene, motion: lastCommand('motion').motion }; await message(scene);
  assert.equal(anyLabel('속도').length, 1, '고른 뒤에 속도·세기가 나온다');
  assert.deepEqual(motionOrder(), ['통통', '보관한 움직임', '부분만 움직이기'], '설정이 생겨도 순서는 그대로');
  await press('그리기');
  await press('그리기 닫기');

  // ── 4. 보드: 범례는 두 상태가 같이 있을 때만 ─────────────────────────────────────────────────
  const legend = () => texts().includes('고치는 중');
  assert.equal(legend(), false, '완성만 있으면 범례가 설명할 것이 없다');
  const half = createProject('반쯤 세트', '콩이');
  half.slots = half.slots.map((s, i) => i === 0 ? { ...s, finalImage: drawn('a.png'), done: true }
    : i === 1 ? { ...s, finalImage: drawn('b.png'), done: false } : s);
  setStore([half], revision++);
  await render();
  await press('반쯤 세트');
  assert.equal(legend(), true, '완성과 작업 중이 같이 있으면 점을 설명한다');

  // ── 5. 내보내기: 결과 → 손볼 곳 → 만들기 → 제출 준비(접힘) → 부가 이미지 → 자세히 ────────────
  await press('내보내기');
  const exportOrder = () => {
    const out = [];
    for (const n of all()) {
      const id = n.props?.testID, label = n.props?.accessibilityLabel;
      if (id === '내보내기 요약') out.push('요약');
      else if (id === '결과 격자') out.push('격자');
      else if (n.type === 'Text' && /^손볼 곳/.test(text(n))) out.push('손볼 곳');
      else if (n.type === 'Pressable' && label === '파일 묶음 만들기') out.push('만들기');
      else if (n.type === 'Pressable' && ['제출 준비 보기', '제출 준비 접기'].includes(label)) out.push('제출 준비');
      else if (n.type === 'Pressable' && label === '부가 이미지 만들기') out.push('부가 이미지');
      else if (n.type === 'Pressable' && ['자세히 보기', '자세히 접기'].includes(label)) out.push('자세히');
    }
    return out;
  };
  assert.deepEqual(exportOrder(), ['요약', '격자', '손볼 곳', '만들기', '제출 준비', '부가 이미지', '자세히'], '내보내기 차례');
  assert.equal(labelled('제안 기준으로 보기').length, 0, '제출 준비는 접혀 있다');
  assert.ok(texts().some(t => /가지 더 필요해요$/.test(t)), '접혀 있어도 덜 됐다는 사실은 보인다');
  assert.ok(!texts().some(t => t.includes('WebPAnimator')), 'WebP 설명은 기본 화면에 없다');
  assert.equal(byTestID('asset-slot-exportSuccessArtwork').length, 0, '덜 된 세트는 다 된 것처럼 보이지 않는다');
  await press('제출 준비 보기');
  assert.equal(labelled('제안 기준으로 보기').length, 1, '펼치면 기준과 목록이 나온다');
  await press('제출 준비 접기');
  await press('자세히 보기');
  const yellowExport = tree.root.findAll(n => n.type === 'Pressable' && flat(n.props.style).backgroundColor === T.accent).map(n => n.props.accessibilityLabel);
  assert.deepEqual(yellowExport, ['파일 묶음 만들기'], '내보내기의 노랑 버튼도 하나');

  // 다 채운 세트: 같은 차례, 요약만 완성한 표정으로 바뀐다.
  const full = createProject('다 한 세트', '콩이');
  full.slots = full.slots.map(s => ({ ...s, finalImage: drawn('done-' + s.number + '.png'), done: true }));
  setStore([full], revision++);
  await render();
  await press('다 한 세트');
  await press('내보내기');
  assert.deepEqual(exportOrder().filter(x => x !== '손볼 곳'), ['요약', '격자', '만들기', '제출 준비', '부가 이미지', '자세히'], '다 채워도 차례는 같다');
  assert.equal(byTestID('asset-slot-exportSuccessArtwork').length, 1, '다 채우면 요약이 완성 그림 자리를 쓴다');
  assert.equal(labelled('제안 기준으로 보기').length, 0, '다 채워도 제출 준비는 접혀 있다');

  await act(async () => tree.unmount());
  console.log('PASS: ui structure — 홈(세트 0·1·4·10 × 공지 꺼짐/켜짐) 순서 고정·공지 꺼지면 자리 0·최근 하나+전체 보기·지름길 약하게, 그리기 캔버스 알림 한 번에 하나·패널 한 번에 하나·굵기는 행동 줄·선택 도구엔 없음·배율은 따로, 움직이기 효과→재사용→PRO 한 줄, 보드 범례는 두 상태일 때만, 내보내기 요약→격자→손볼 곳→만들기→제출 준비(접힘)→부가 이미지→자세히. Native/WebView mocked.');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
