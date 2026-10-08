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
  write(data, options) { if (failWrite && this.uri.endsWith('.json')) { files.set(this.uri, '{'); throw new Error('disk full'); } files.set(this.uri, options?.encoding === 'base64' ? Buffer.from(data,'base64') : data); }
  textSync() { return files.get(this.uri); }
  async bytes() { return this.bytesSync(); }
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
  delete() { if (!files.delete(this.uri)) throw new Error('missing ' + this.uri); }
}
const viewport = { width: 390, height: 844 };
const commands = [];
const appState = [];
const timers = [];
const realSetInterval = global.setInterval;
global.setInterval = (fn, ms) => { if (ms === 40000) { timers.push(fn); return { unref(){} }; } return realSetInterval(fn, ms); };
// 저장이 길어질 때의 알림(1.5초)과 저장 시간초과(20초)는 손으로 돌린다 — 실제로 기다리지 않고 그 순간을 만든다(45.13차).
const held = [];
const realSetTimeout = global.setTimeout, realClearTimeout = global.clearTimeout;
global.setTimeout = (fn, ms) => { if (ms === 1500 || ms === 20000) { const handle = { ms }; held.push({ handle, fn, ms }); return handle; } return realSetTimeout(fn, ms); };
global.clearTimeout = handle => { const i = held.findIndex(h => h.handle === handle); if (i >= 0) { held.splice(i, 1); return; } return realClearTimeout(handle); };
const pending = ms => held.filter(h => h.ms === ms).length;
const fire = ms => { let i = -1; held.forEach((h, k) => { if (h.ms === ms) i = k; }); if (i < 0) return false; const [h] = held.splice(i, 1); h.fn(); return true; };
// 키보드는 실제 기기에서만 올라온다. 여기서는 그 알림을 손으로 쏘아 배치가 접혔다 돌아오는지 본다.
const keyboardListeners = {};
const shared = [];
const alerts = [];
let failWrite = false;
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
let pendingPicks = [];
let pickedDocument = null;
const images = { dataUrl: async () => 'data:image/png;base64,test', pickImages: async () => pendingPicks, savePainterWork: (...args) => persistPainter(...args), saveCutout: (...args) => persistCutout(...args), saveMotionLoop: () => ({ path: 'moving.gif', width: 360, height: 360 }) };
const bakes=[];
const composed=[];
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n])); rn.Animated = require('./_rn-animated-mock.cjs');
Object.assign(rn, { Keyboard: { addListener: (name, fn) => { (keyboardListeners[name] = keyboardListeners[name] || []).push(fn); return { remove() { keyboardListeners[name] = keyboardListeners[name].filter(f => f !== fn); } }; }, dismiss() {} }, StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: viewport.width, height: viewport.height }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: (_t, fn) => { appState.push(fn); return { remove() {} }; } }, Alert: { alert(title, message, buttons) { alerts.push({ title, message, buttons }); } }, Linking: { openURL: async () => {} } });
const load = loader({
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' }, '@expo/vector-icons': { MaterialCommunityIcons: 'Icon' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  'expo-image-picker': {}, 'expo-image-manipulator': {}, 'expo-asset': { Asset: { fromModule: () => ({ downloadAsync: async () => ({ localUri: 'bundled://art', uri: 'bundled://art' }) }) } },
  'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-constants': { default: { expoConfig: { extra: {} } } }, 'react-native-webview': { WebView },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async (uri, options) => { shared.push({ uri, options }); } },
  // 45.38 백업 되살리기: 문서 선택 창이 고른 파일(uri)을 돌려준다.
  'expo-document-picker': { getDocumentAsync: async () => pickedDocument ? { canceled: false, assets: [{ uri: pickedDocument, name: 'backup.zip' }] } : { canceled: true, assets: null } },
  'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  './src/services/images': images, '../services/images': images,
  './src/components/image-analyzer': { ImageAnalyzer: () => null },
  './src/components/extra-composer': { ExtraComposer: React.forwardRef((props, ref) => { if (ref) ref.current = { compose: async (source, frame, place) => { composed.push({ frame, place }); return 'data:image/png;base64,' + png.toString('base64'); } }; return null; }), placeInFrame: (image, frame, place) => { const fit = Math.min(frame.width / image.width, frame.height / image.height); const w = image.width * fit * place.scale, h = image.height * fit * place.scale; return { x: (frame.width - w) / 2 + place.dx * frame.width, y: (frame.height - h) / 2 + place.dy * frame.height, w, h }; } },
  './src/components/motion-baker': { MotionBaker: React.forwardRef((props, ref) => { if (ref) ref.current = { bake: async (work, motion) => { bakes.push({ work, motion }); return { count: 8, fps: 10, loop: .8, delayMs: 100, data: 'data:image/gif;base64,R0lGODlh', bytes: 2048, droppedColours: 0, clipped: false }; } }; return null; }) },
});
const { createProject, storeImagePaths } = load('src/project.ts');
const { loadStore, saveStore, localFile } = load('src/services/storage.ts');
const persistPainter = load('src/services/images.ts').savePainterWork;
const persistCutout = load('src/services/images.ts').saveCutout;
const App = load('App.tsx').default;
const metrics = { coverage: .2, centerX: .5, centerY: .5, width: .5, height: .5, color: [.2,.2,.2], transparent: true };
const image = { path: 'image-old.png', width: 360, height: 360, metrics };
const p = createProject('이전 프로젝트', '콩이');
p.canon = { image, personality: '성격 유지', speech: '말투 유지', locked: '둥근 눈', variable: '소품' };
p.slots = p.slots.map(s => ({ ...s, dialogue: '대사 ' + s.number, emotion: '감정 유지', situation: '상황 유지', expressionGuide: '표정 유지', poseGuide: '포즈 유지', compositionGuide: '구도 유지', effectGuide: '효과 유지', textPlacementGuide: '텍스트 유지', notes: '메모 유지', referenceImages: [image], status: 'PLANNED' }));
p.slots[0].finalImage = image; p.slots[0].status = 'REVIEW';
const other = createProject('다른 프로젝트', '두부');
const otherImage = path => ({ path, width: 360, height: 360 });
other.slots = other.slots.map(s => ({ ...s, referenceImages: [otherImage('image-other-ref.png')] }));
other.canon = { ...other.canon, image: otherImage('image-other-canon.png') };
other.slots[0].finalImage = otherImage('image-other-final.png');
const otherPaths = ['image-other-ref.png', 'image-other-canon.png', 'image-other-final.png'];
saveStore({ version: 1, introDone: true, revision: 8, projects: [p, other] });
const png = Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(360,16);png.writeUInt32BE(360,20);
files.set(localFile('image-old.png').uri,png); files.set(localFile('image-new.png').uri,png);
otherPaths.forEach(path => files.set(localFile(path).uri, png));

let tree, scene;
const press = async label => { let matches=tree.root.findAll(n=>(n.type==='Pressable'&&n.props.accessibilityLabel===label)||(n.type==='Button'&&n.props.label===label));if(label==='닫기')matches=matches.slice(-1);assert.equal(matches.length,1,'button '+label);assert.ok(!matches[0].props.disabled,'enabled '+label);await act(async()=>matches[0].props.onPress()); };
// 45.5: 홈은 최근 세트 하나만 보여 준다 — 다른 세트는 전체 작업에서 연다.
const buttons = label => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === label);
const openSet = async name => { if (buttons(name).length === 0 && buttons('전체 작업 보기').length === 1) await press('전체 작업 보기'); await press(name); };
const tiles=()=>tree.root.findAll(n=>n.type==='Pressable'&&/^slot-\d+$/.test(n.props.testID));
const message=async m=>{await act(async()=>tree.root.findByType('WebView').props.onMessage({nativeEvent:{data:JSON.stringify(m)}}));};
const sent=()=>commands.map(s=>JSON.parse(s.slice(s.indexOf('(')+1,s.lastIndexOf(');true;'))));
const lastCommand=type=>sent().filter(m=>m.type===type).at(-1);
const lastSent=()=>sent().at(-1);
// Answer the last confirmation the way a person would tap it.
const answer=async text=>{const box=alerts.at(-1);assert.ok(box,'an alert was shown');const button=(box.buttons||[]).find(b=>b.text===text);assert.ok(button,'alert offers '+text+' — got '+JSON.stringify(box));await act(async()=>button.onPress&&button.onPress());};
const init=async()=>{
 await message({type:'ready'});const m=lastCommand('init');
 // 45.10: 새 칸은 그림 한 장으로 연다. 저장된 칸은 자기 장 목록 그대로라 1장 이상이면 된다.
 assert.ok(m.layers.length>=1,'칸을 열면 그림 장이 적어도 하나 온다: '+m.layers.length);
 scene={type:'state',undo:false,redo:false,dirty:false,activeLayerId:m.activeLayerId||'draw-1',activeReferenceId:null,caption:m.caption||null,layers:m.layers,references:m.references};
 await message(scene);await message({type:'initialized'});return m;
};
const publicLayer=l=>Object.fromEntries(['id','name','visible','opacity','x','y','scale','rotation'].map(k=>[k,l[k]]));
const saved=async(dirty=true,shape=metrics,token)=>{
 // 엔진이 하는 그대로: 저장 요청에 붙어 온 번호를 응답에 그대로 돌려준다(45.12차).
 await message({type:'save',token:token===undefined?(lastCommand('save')||{}).token:token,dirty,data:'data:image/png;base64,'+png.toString('base64'),metrics:shape,activeLayerId:scene.activeLayerId,caption:scene.caption||undefined,motion:scene.motion||null,layers:scene.layers.map(l=>({...publicLayer(l),data:'data:image/png;base64,'+png.toString('base64')})),references:scene.references.map(l=>({...publicLayer(l),path:l.path}))});
};
const blank={...metrics,coverage:0};
// 저장 버튼은 없다. 작업은 앱을 내릴 때·주기·닫기·완성에 스스로 저장된다. 검사에서는 앱 내리기로 저장을 부른다.
const autosave=async()=>{await act(async()=>{appState.forEach(fn=>fn('background'));});};
(async()=>{
 await act(async()=>{tree=create(React.createElement(App));});
 const shown=()=>tree.root.findAll(n=>n.type==='Text').map(n=>String(n.children?.join('')));
 const labelled=label=>tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel===label);
 const styleOf=node=>Object.assign({},...[node.props.style].flat(9).filter(Boolean));
 const fresh=()=>loadStore().store.projects.at(-1);

 // ── Home: one action, and it opens a canvas rather than a form ──────────────────────────────
 // 시안 A1: 빈 캔버스로 시작하는 길과 내 그림으로 시작하는 길, 두 가지다.
 assert.equal(labelled('새 세트 만들기').length,1,'home offers a way to start an empty set');
 assert.equal(labelled('내 그림으로 시작').length,1,'and a way to start from a picture');
 assert.ok(!shown().some(t=>t.includes('멈춰있는 이모티콘')&&t.includes('360')),'홈이 모든 세트를 정지형 32칸이라고 말하지 않는다');

 // 명세 H03: 이름을 한 번 확인하고 만든다. 확인 전에는 세트가 생기지 않는다.
 const setsBefore=loadStore().store.projects.length;
 await press('새 세트 만들기');
 assert.equal(loadStore().store.projects.length,setsBefore,'묻는 동안에는 빈 세트가 생기지 않는다');
 const nameBox=tree.root.findAll(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='세트 이름');
 assert.equal(nameBox.length,1,'이름 한 줄만 묻는다');
 assert.ok(/^새 이모티콘 세트/.test(nameBox[0].props.value),'기본 이름이 이미 적혀 있다');
 await press('취소');
 assert.equal(loadStore().store.projects.length,setsBefore,'되돌아가도 빈 세트가 남지 않는다');
 await press('새 세트 만들기');
 await press('만들기');
 assert.equal(loadStore().store.projects.length,setsBefore+1,'만들기를 눌렀을 때 하나만 생긴다');
 assert.equal(tree.root.findAllByType('WebView').length,1,'만들면 바로 빈 캔버스로 간다');
 assert.equal(fresh().projectName,'새 이모티콘 세트','and the set names itself');
 assert.equal(fresh().canon.image,undefined,'with no reference picture required');
 assert.equal(fresh().slots.filter(s=>s.finalImage).length,0,'and nothing drawn yet');
 await init();

 // ── The painter has two tabs over the same drawing ──────────────────────────────────────────
 assert.equal(labelled('그리기').length,1,'the painter opens on drawing');
 assert.equal(labelled('움직이기').length,1,'and movement is one tap away');
 assert.equal(labelled('그리기 힌트').length,0,'the hint card is gone from the making UI');
 assert.ok(!shown().some(t=>t.includes('다음 컷에도 활용')),'and so is the opening notice');
 // ── 기본 움직임은 결과가 먼저이고, 고급 설정은 따로 들어간다 ─────────────────────────────
 await press('움직이기');
 {
  const basic=tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel&&!n.props.disabled).map(n=>n.props.accessibilityLabel);
  for(const must of ['움직임 없음','통통','흔들기','두근거리기','부분만 움직이기','보관한 움직임','저장'])
   assert.ok(basic.includes(must),'기본 화면에 있어야 한다: '+must);
  for(const gone of ['움직임 취소','움직임 적용','미리보기 재생','미리보기 크게','이 움직임 보관하기','레이어 1 부분 움직임 추가'])
   assert.ok(!basic.includes(gone),'기본 화면에 없다: '+gone);
  assert.ok(!shown().some(t=>t.includes('두 모습')),'두 모습도 기본 화면에 없다');
  assert.ok(!shown().some(t=>t.includes('초 반복')),'가짜 재생 막대·반복 길이 줄이 없다');
  await press('두근거리기');
  assert.equal(lastCommand('motion').motion.preset,'pulse','고른 효과가 바로 캔버스로 간다');
  assert.ok(sent().some(m=>m.type==='play'),'그리고 미리보기가 돌고 있다');
  scene={...scene,motion:lastCommand('motion').motion,loop:.8,playing:true};await message(scene);
  await press('움직임 없음');
  assert.equal(lastCommand('motion').motion,null,'없음을 고르면 움직임이 빠진다');
  scene={...scene,motion:null,playing:false};await message(scene);
 }
 // ── 새로 만든 슬라이더(Range) ─────────────────────────────────────────────────────────────
 // 플랫폼 슬라이더는 색을 받지 않아 Android에서 보라로 칠해졌다. 직접 그리는 대신, 손가락이 닿은
 // 자리와 값이 정말 맞는지, 세로 스크롤과 싸우지 않는지, 값을 읽어 줄 수 있는지를 확인한다.
 await press('움직이기');
 {
  // 속도·세기는 효과를 고른 뒤에 나온다.
  assert.equal(tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === '속도').length, 0, '효과를 고르기 전에는 속도 막대가 없다');
  await press('통통');
  scene = { ...scene, motion: lastCommand('motion').motion }; await message(scene);
  const speed = tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === '속도')[0];
  assert.ok(speed, '속도 조절이 있다');
  assert.deepEqual(speed.props.accessibilityValue, { min: 0, max: 1, now: .5 }, '읽어 주는 값이 지금 값과 같다');
  await act(async () => speed.props.onLayout({ nativeEvent: { layout: { width: 200 } } }));
  // 왼쪽 끝, 4분의 1, 가운데, 오른쪽 끝: 닿은 자리가 값이 된다.
  // 누르고 떼는 실제 순서로 짚는다. 막대는 매번 새로 찾는다 — 값이 바뀌면 다시 그려지기 때문이다.
  // 막대는 화면 x=40 에 있다(pageX = 40 + locationX).
  const speedBar = () => tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === '속도')[0];
  const tapAt = async x => {
   await act(async () => speedBar().props.onResponderGrant({ nativeEvent: { pageX: 40 + x, locationX: x } }));
   await act(async () => speedBar().props.onResponderRelease({ nativeEvent: { pageX: 40 + x, locationX: x } }));
  };
  // 45.39 조절 줄: 손잡이(24dp)가 끝에서 잘리지 않게 홈 양 끝을 12dp 들였다 — 0 은 x=12, 1 은 x=188(폭 200).
  for (const [x, expected] of [[0, 0], [56, .25], [100, .5], [200, 1]]) {
   await tapAt(x);
   const got = lastCommand('motion').motion.speed;
   assert.equal(got, expected, `${x}px 에서 ${expected} 이 되어야 한다, got ${got}`);
  }
  // 폭 밖으로 끌어도 범위를 넘지 않는다. 끄는 동안 locationX 가 엉뚱해도(손가락이 막대 밖) 화면 좌표로 잰다.
  // 끄는 동안 같은 값(최대)을 여러 번 보내지 않는다 — 매 이벤트마다 보내 미리보기가 처음부터 다시 돌던 것이 45.37 의 '끊김'이다.
  await act(async () => speedBar().props.onResponderGrant({ nativeEvent: { pageX: 40 + 100, locationX: 100 } }));
  const beforeDrag = sent().filter(m => m.type === 'motion').length;
  for (const px of [300, 600, 900]) await act(async () => speedBar().props.onResponderMove({ nativeEvent: { pageX: 40 + px, locationX: 3 } }));
  await act(async () => speedBar().props.onResponderRelease({ nativeEvent: { pageX: 40 + 900, locationX: 3 } }));
  assert.equal(lastCommand('motion').motion.speed, 1, '오른쪽으로 더 끌어도 최대에서 멈춘다');
  assert.ok(sent().filter(m => m.type === 'motion').length - beforeDrag <= 1, '끄는 동안 같은 최대값을 여러 번 보내지 않는다');
  await act(async () => speedBar().props.onResponderGrant({ nativeEvent: { pageX: 40 + 100, locationX: 100 } }));
  await act(async () => speedBar().props.onResponderMove({ nativeEvent: { pageX: 40 - 40, locationX: 3 } }));
  await act(async () => speedBar().props.onResponderRelease({ nativeEvent: { pageX: 40 - 40, locationX: 3 } }));
  assert.equal(lastCommand('motion').motion.speed, 0, '왼쪽도 마찬가지다');
  // 화면 읽기 프로그램은 자리를 짚지 않고 한 칸씩 올리고 내린다. 그 요청이 실제로 값을 바꿔야 한다.
  await act(async () => speedBar().props.onResponderGrant({ nativeEvent: { pageX: 140, locationX: 100 } }));
  await act(async () => speedBar().props.onResponderRelease({ nativeEvent: { pageX: 140, locationX: 100 } }));
  assert.equal(lastCommand('motion').motion.speed, .5, '가운데에서 시작한다');
  assert.deepEqual(speed.props.accessibilityActions, [{ name: 'increment' }, { name: 'decrement' }], '올리기와 내리기를 내놓는다');
  await act(async () => speed.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
  assert.equal(lastCommand('motion').motion.speed, .55, '올리기가 한 칸 올린다');
  scene = { ...scene, motion: lastCommand('motion').motion }; await message(scene);
  const speedUp = tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === '속도')[0];
  assert.equal(speedUp.props.accessibilityValue.now, .55, '읽어 주는 값도 따라 올라간다');
  await act(async () => speedUp.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
  assert.equal(lastCommand('motion').motion.speed, .5, '내리기가 도로 내린다');
  scene = { ...scene, motion: lastCommand('motion').motion }; await message(scene);
  await act(async () => speed.props.onResponderRelease({ nativeEvent: {} }));

  // 세로 스크롤과의 다툼: 슬라이더는 자기 위에서 시작한 손가락만 잡는다.
  assert.equal(speed.props.onStartShouldSetResponder(), true, '자기 위에서 시작한 손가락은 잡는다');
  assert.equal(typeof speed.props.onMoveShouldSetResponder, 'function', '끌기도 받는다');
  // 45.39: 세기·속도는 스크롤되는 움직임 판이 아니라 캔버스 위 조절 줄에 있다 — 스크롤과 다툴 자리가 없다.
  const bar = tree.root.findAll(n => n.props.testID === '조절 줄')[0];
  assert.ok(bar && bar.findAll(n => n.props.accessibilityLabel === '속도' && n.props.accessibilityRole === 'adjustable').length === 1, '속도 조절은 캔버스 위 조절 줄에 있다');
  assert.equal(tree.root.findAll(n => n.type === 'ScrollView' && n.props.keyboardShouldPersistTaps === 'handled')[0].findAll(n => n.props.accessibilityLabel === '속도').length, 0, '움직임 판 안에는 속도 조절이 없다');
  const scroller = tree.root.findAll(n => n.type === 'ScrollView' && n.props.keyboardShouldPersistTaps === 'handled')[0];
  assert.ok(scroller, '패널은 세로로 스크롤되는 자리 안에 있다');
 }
 // 다음 검사가 "움직임 없음"에서 시작하도록 이 칸을 도로 비운다.
 await press('움직임 없음');
 scene={...scene,motion:null};await message(scene);
 await press('그리기');

 // ── 움직임은 고르는 즉시 칸에 들어가고, 칸과 함께 저장된다 ─────────────────────────────────
 // '적용/취소'가 따로 없다. 탭을 오가도 저장을 부르지 않고, 칸이 저장될 때(자동저장·닫기·완성) 함께 남는다.
 await press('움직이기');
 assert.equal(labelled('움직임 적용').length+labelled('움직임 취소').length,0,'적용·취소 단계가 없다');
 await press('통통');
 scene={...scene,motion:lastCommand('motion').motion,loop:.8,clipped:false,dirty:true};await message(scene);
 const beforeTab=sent().filter(m=>m.type==='save').length;
 await press('그리기');
 assert.equal(sent().filter(m=>m.type==='save').length,beforeTab,'탭을 오가는 것만으로 저장하지 않는다');
 assert.equal(lastCommand('motion').motion.preset,'bounce','그리기로 돌아와도 고른 움직임은 칸에 남아 있다');
 await autosave();
 assert.equal(sent().filter(m=>m.type==='save').length,beforeTab+1,'자동저장이 한 번 부른다');
 assert.equal(lastCommand('save').gif,true,'움직임이 있으면 움직이는 파일까지 만든다');
 await saved();
 assert.equal(fresh().slots[0].motion.preset,'bounce','고른 움직임이 파일에 남는다');
 // 다음 검사가 깨끗한 상태에서 시작하도록 이 칸의 움직임을 도로 비운다.
 await press('움직이기');
 await press('움직임 없음');
 scene={...scene,motion:null};await message(scene);
 await press('그리기');
 // ── 선택·변형은 무료다 ────────────────────────────────────────────────────────────────────
 // 기기 사진에서 선택 편집 중에 PRO 안내가 떠 있었다. 그건 그 칸에 이미 PRO 움직임이 있어서였고,
 // 선택 자체는 무료여야 한다. 그리고 선택 중에는 아래에 같은 버튼 줄이 두 번 보이면 안 된다.
 scene={...scene,selection:{box:{x:10,y:10,w:60,h:60},dx:0,dy:0,scale:1,rot:0,flip:1}};await message(scene);
 // 45.28 정정: 완성은 머리줄로 올라갔다(승인 보드 01). 선택 판의 취소·적용과 자리가 갈려 겹치지 않는다.
 assert.equal(labelled('저장').length,1,'완성은 머리줄에 하나만 있다');
 assert.equal(labelled('선택 취소').length,1,'선택 판은 제 취소를 가진다');
 assert.equal(labelled('선택 적용').length,1,'선택 판은 제 적용을 가진다');
 for(const tool of ['작게','크게','왼쪽 회전','오른쪽 회전','좌우 반전'])assert.equal(labelled(tool).length,1,'선택 변형 버튼: '+tool);
 assert.equal(labelled('이동').length,0,'눌러도 아무 일 없는 이동 버튼은 없다');
 assert.ok(!shown().some(t=>t.includes('끌어서 해요')),'나쁜 UI를 설명하던 문장이 없다');
 const beforeSelect=sent().filter(m=>m.type==='save').length;
 await press('선택 적용');
 assert.deepEqual(lastSent(),{type:'selectApply'},'적용은 캔버스에 그대로 간다');
 assert.equal(labelled('PRO 알아보기').length,0,'무료 선택 변형은 PRO를 묻지 않는다');
 assert.equal(sent().filter(m=>m.type==='save').length,beforeSelect,'그리고 저장을 부르지도 않는다');
 scene={...scene,selection:null};await message(scene);
 assert.equal(labelled('저장').length,1,'선택이 끝나면 완성 버튼이 돌아온다');

 // ── 고른 부분을 그림으로 보관 ─────────────────────────────────────────────────────────────
 // 시안 A3의 '내 그림으로 보관'. 떠내는 것이지 잘라내는 것이 아니므로 그림도, 저장된 작품도
 // 그대로여야 하고, 보관한 파일은 다른 칸에서 다시 꺼낼 수 있어야 한다.
 scene={...scene,selection:{box:{x:10,y:10,w:60,h:60},dx:0,dy:0,scale:1,rot:0,flip:1}};await message(scene);
 const cutBeforeKeeping=JSON.stringify(fresh().slots[0]);
 await press('내 그림으로 보관');
 const asked=lastCommand('selectionImage');
 assert.ok(asked,'캔버스에 고른 부분을 그림으로 달라고 요청한다');
 await message({type:'selectionImage',id:asked.id,data:'data:image/png;base64,'+png.toString('base64'),width:60,height:60});
 await act(async()=>{});
 const keptCut=loadStore().store.cutouts;
 assert.equal(keptCut.length,1,'보관한 그림이 앱에 남는다');
 assert.ok(keptCut[0].image.path,'그리고 파일로 저장된다: '+keptCut[0].image.path);
 assert.equal(keptCut[0].image.metrics,undefined,'제출용 그림이 아니므로 QA 수치를 붙이지 않는다');
 assert.equal(JSON.stringify(fresh().slots[0]),cutBeforeKeeping,'보관은 원래 그림을 바꾸지 않는다');
 assert.deepEqual(lastSent(),{type:'selectionImage',id:asked.id},'그리고 캔버스에 아무것도 지우라고 하지 않는다');
 // 보관한 파일은 저장소가 지키는 파일이어야 한다. 아니면 정리 과정에서 사라진다.
 assert.ok(storeImagePaths(loadStore().store).has(keptCut[0].image.path),'보관한 그림은 정리 대상에서 보호된다');
 // 다시 꺼내는 길: ⋯ 의 '그림 가져오기'가 보관함을 먼저 보여 준다.
 scene={...scene,selection:null};await message(scene);
 await press('더보기');
 await press('그림 가져오기');
 assert.equal(labelled(keptCut[0].name+' 넣기').length,1,'보관한 그림을 꺼낼 자리가 있다');
 await press(keptCut[0].name+' 넣기');
 await act(async()=>{});
 assert.equal(lastSent().type,'importDrawing','고르면 캔버스로 들어간다');
 assert.ok(lastSent().data.startsWith('data:image/png;base64,'),'그림 데이터로 들어간다');


 // ── 그림(레이어) 이름 ──────────────────────────────────────────────────────────────────────
 // Layers have carried a name since the first version; it was the screen that only showed numbers.
 // A renamed layer has to survive a save and a restart, and the movement that points at it has to
 // keep pointing at the same layer id, not at a name or a position.
 // ── 레이어 패널: 그림을 가리지 않는다 ─────────────────────────────────────────────────────
 // 사용자 평가: "레이어가 그림을 가려 무엇을 편집하는지 보기 어렵다". 패널은 캔버스 위에 떠서는 안
 // 되고, 도구가 있던 아래 자리를 대신 써야 한다. 그리고 고르면 접히면서 그 그림에 바로 그려져야 한다.
 await press('레이어');
 // 찾는 것은 '캔버스를 덮는 판'이다. 막대 손잡이 같은 작은 점은 판이 아니다(45.28: 굵기 막대가 아래 줄로 내려왔다).
 const floating=tree.root.findAll(n=>n.type==='View'&&!!n.props.style&&n.props.style.position==='absolute'&&(n.props.style.elevation??0)>0
   &&!(typeof n.props.style.width==='number'&&n.props.style.width<=48));
assert.equal(floating.length,0,'패널이 캔버스 위에 떠 있지 않다: '+floating.length+'개가 떠 있음');
 // 45.28: 아래 줄은 브러시 빠른 선택 카드 셋 + '전체' 입구다. 판이 열려도 그 줄은 그대로 남는다.
 assert.equal(labelled('브러시 전체').length,1,'전체 입구는 판이 열려도 하나만 남는다');
 assert.equal(tree.root.findAll(n=>n.props.testID==='빠른 브러시').length,1,'빠른 선택 줄도 그대로 있다');
 assert.equal(labelled('색').length,1,'지금 색도 계속 보인다');
 assert.equal(labelled('레이어 1 선택').length,1,'기본 이름 "그림 1"은 칸 이름과 헷갈리지 않게 레이어로 부른다');
 assert.equal(lastCommand('layerThumbs').size,72,'패널을 열 때 캔버스에 작은 그림을 달라고 한다');
 // 45.10: 새 칸은 한 장으로 시작한다 — 둘째 장은 눌러서 만든다.
 assert.equal(labelled('레이어 2 선택').length,0,'새 칸에는 빈 둘째 장이 없다');
 await press('레이어 추가');
 assert.deepEqual(lastSent(),{type:'addLayer',id:'draw-2',name:'그림 2'},'레이어 추가가 둘째 장을 만든다');
 scene={...scene,layers:[...scene.layers,{id:'draw-2',name:'그림 2',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0}]};await message(scene);
 await press('레이어 2 선택');
 assert.deepEqual(lastSent(),{type:'select',id:'draw-2'},'고르면 그 그림이 그리는 대상이 된다');
 // 45.35 §7: '레이어 선택만으로 창이 갑자기 닫히지 않음'. 예전에는 고르는 순간 닫혀서
 // **무엇을 골랐는지 확인할 수 없었고**, 순서를 바꾸거나 보임을 끄려면 매번 다시 열어야 했다.
 // 그림이 가려지지 않는 것은 패널이 캔버스 위에 뜨지 않는 것으로 이미 지켜진다(바로 위 검사).
 assert.equal(labelled('레이어 1 선택').length,1,'고른 뒤에도 판이 열려 있어 이어서 만질 수 있다');
 assert.equal(labelled('브러시 전체').length,1,'아래 도구 줄은 그대로 있다');
 scene={...scene,activeLayerId:'draw-2'};await message(scene);
 await press('레이어 1 선택');
 scene={...scene,activeLayerId:'draw-1'};await message(scene);

 // 45.11: 가운데 장을 지운 뒤 다시 추가할 때, 아직 남아 있는 장의 번호를 다시 쓰지 않는다.
 // (옛 방식은 '장 수 + 1' 이라 draw-1·draw-3 에서 draw-3 을 또 지어, 새 획이 옛 그림 위에 얹혔다.)
 const gapped=[{id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0},{id:'draw-3',name:'그림 3',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0}];
 scene={...scene,layers:gapped,activeLayerId:'draw-1'};await message(scene);
 // 판은 앞에서 고른 뒤에도 열려 있다(45.35) — 여기서 또 누르면 도리어 닫힌다.
 await press('레이어 추가');
 assert.deepEqual(lastSent(),{type:'addLayer',id:'draw-2',name:'그림 2'},'비어 있는 번호를 쓴다 — 남아 있는 레이어와 겹치지 않는다');
 await press('레이어');
 scene={...scene,layers:[{id:'draw-1',name:'그림 1',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0},{id:'draw-2',name:'그림 2',visible:true,opacity:1,x:0,y:0,scale:1,rotation:0}],activeLayerId:'draw-1'};await message(scene);

 // 숨긴 그림에 그으면 조용히 무시되던 것을, 이제는 화면이 말하고 되돌릴 수 있다.
 // 엔진은 실제로 숨겨진 레이어에서만 이 소식을 보낸다 — 화면 상태도 그렇게 둔다(45.2 검증).
 scene={...scene,layers:scene.layers.map(l=>l.id==='draw-1'?{...l,visible:false}:l)};await message(scene);
 await message({type:'blocked',reason:'hidden',id:'draw-1',name:'그림 1'});
 assert.ok(shown().some(t=>t.includes('레이어 1')&&t.includes('숨겨져 있어요')),'왜 그려지지 않는지 말한다');
 await press('숨긴 레이어 다시 보이기');
 assert.deepEqual(lastSent(),{type:'transform',id:'draw-1',visible:true},'한 번에 다시 보이게 한다');
 scene={...scene,layers:scene.layers.map(l=>l.id==='draw-1'?{...l,visible:true}:l)};await message(scene);
 assert.equal(labelled('숨긴 레이어 다시 보이기').length,0,'다시 보이면 경고도 끝난다 — 알림 자리를 계속 물고 있지 않는다');

 await press('레이어');
 assert.equal(labelled('레이어 1 선택').length,1,'the drawing rail calls a layer by its own name');
 await press('레이어 1 관리');
 await press('이름 바꾸기');
 await act(async()=>tree.root.findAll(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='레이어 이름')[0].props.onChangeText('손'));
 await press('이름 바꾸기');
 const renamed=lastCommand('renameLayer');
 assert.equal(renamed.name,'손','the new name reaches the canvas');
 assert.equal(renamed.id,scene.activeLayerId,'and it names the layer that was selected, by id');
 scene={...scene,layers:scene.layers.map(l=>l.id===renamed.id?{...l,name:'손'}:l),dirty:true};await message(scene);
 assert.equal(labelled('손 선택').length,1,'the rail shows the new name');
 await press('레이어');
 await autosave();
 await saved();
 const storedLayer=fresh().slots[0].work.layers.find(l=>l.id===renamed.id);
 assert.equal(storedLayer.name,'손','the name is on disk');
 assert.deepEqual(fresh().slots[0].work.layers.map(l=>l.id),scene.layers.map(l=>l.id),'no layer id changed on the way');

 const storeBeforeMotion=JSON.stringify(loadStore().store);
 await press('움직이기');
 assert.ok(sent().some(m=>m.type==='play'),'opening the movement tab starts the preview');
 for(const effect of ['통통','흔들기','두근거리기'])assert.equal(labelled(effect).length,1,'free effect offered: '+effect);
 await press('통통');
 assert.equal(lastCommand('motion').motion.preset,'bounce','choosing an effect reaches the canvas');
 assert.equal(JSON.stringify(loadStore().store),storeBeforeMotion,'and nothing is written until the cut is saved');
 scene={...scene,motion:lastCommand('motion').motion,loop:.8,clipped:false};await message(scene);
 // PRO 는 들어가기 전에 PRO 라고 보인다. 무료 사용자가 누르면 PRO 안내가 열리고, 만들다가 막히는 일이 없다.
 const partsRow=labelled('부분만 움직이기')[0];
 assert.equal(partsRow.findAll(n=>n.type==='Text'&&String(n.children?.join(''))==='PRO').length,1,'the PRO row says PRO before it is used');
 const motionBeforePro=JSON.stringify(lastCommand('motion'));
 await press('부분만 움직이기');
 assert.equal(labelled('PRO 닫기').length,1,'a free user is taken to PRO instead of building something that is blocked later');
 assert.equal(JSON.stringify(lastCommand('motion')),motionBeforePro,'and the cut is untouched');
 await press('PRO 닫기');
 assert.equal(labelled('레이어 1 부분 움직임 추가').length,0,'the parts editor did not open');
 // Keeping a movement to use again. This is a shelf, not a change to the cut.
 const cutBeforeKeep=JSON.stringify(fresh().slots[0]);
 await press('보관한 움직임');
 await press('이 움직임 보관하기');
 const kept=loadStore().store.savedMotions;
 assert.equal(kept.length,1,'the movement is kept at the store level');
 assert.deepEqual(kept[0].motion,scene.motion,'exactly the settings that were on screen');
 assert.ok(kept[0].name.includes('통통'),'and it is named after what it does: '+kept[0].name);
 assert.equal(JSON.stringify(fresh().slots[0]),cutBeforeKeep,'keeping a movement does not touch the cut');
 await press('이 움직임 보관하기');
 assert.equal(loadStore().store.savedMotions.length,1,'the same movement is not kept twice');
 await press('움직임 처음으로');
 await press('움직임 없음');
 scene={...scene,motion:null};await message(scene);
 await press('보관한 움직임');
 await press(kept[0].name+' 꺼내 쓰기');
 assert.deepEqual(lastCommand('motion').motion,kept[0].motion,'taking it back down restores every setting');
 scene={...scene,motion:kept[0].motion};await message(scene);
 await press(kept[0].name+' 보관 지우기');
 assert.equal(loadStore().store.savedMotions.length,0,'and a kept movement can be thrown away');
 assert.deepEqual(lastCommand('motion').motion,kept[0].motion,'throwing the shelf copy away leaves the cut being edited alone');
 await press('움직임 처음으로');
 await press('움직임 없음');
 scene={...scene,motion:null};await message(scene);
 assert.ok(!shown().some(t=>t.includes('PRO 효과는 저장되지 않아요')),'the free flow never meets a save-time paywall');
 await press('그리기');
 assert.deepEqual(lastSent(),{type:'stop'},'leaving the tab stops the preview');
 // ── 색 고르기: 기본 줄은 간결하고, 열면 넓은 범위에 닿는다 ─────────────────────────────
 // 동그라미를 줄줄이 세우지 않는다. 기본 화면에는 지금 색 하나와 여는 자리뿐이다.
 assert.equal(labelled('색 #54A9E8').length,0,'기본 도구 줄에 색 견본이 늘어서 있지 않다');
 assert.equal(labelled('색').length,1,'대신 팔레트를 여는 자리가 하나 있다');
 await press('색');
 // 45.28(승인 보드 01): 패널은 SV 사각 + 색상 막대로 열린다. 견본 격자는 '팔레트' 갈래에 그대로다.
 assert.equal(tree.root.findAll(n=>n.props&&n.props.accessibilityLabel==='색 사각판').length,1,'열면 SV 사각이 먼저다');
 await press('팔레트');
 assert.ok(labelled('색 #54A9E8').length>=1,'팔레트 갈래에 견본이 나온다');
 // 견본 한 번이면 색이 정해지고 **패널이 닫혀 바로 그리기로 돌아간다.** 예전에는 색을 고른 뒤
 // 펜을 다시 눌러야 했다. 그 불편이 이번 승인의 핵심이다.
 await press('색 #54A9E8');
 assert.equal(lastCommand('color').color,'#54A9E8','고른 색이 캔버스로 간다');
 assert.deepEqual(loadStore().store.palette,['#54A9E8'],'그리고 기억된다');
 assert.equal(labelled('색 #54A9E8').length,0,'견본을 고르면 패널이 닫힌다');
 assert.equal(labelled('색').length,1,'그리기 줄로 돌아왔다');
 // 상세 조절은 여러 번 만져 봐야 하므로 패널을 유지한다.
 await press('색');
 await press('직접 선택');   // 앞에서 견본을 보려고 팔레트로 건너갔으니 되돌아온다
 assert.equal(tree.root.findAll(n=>n.props&&n.props.accessibilityLabel==='HEX 색 값').length,1,'HEX 로 정확한 값을 넣을 수 있다');
 // 45.28: 계열은 색상 막대에서, 선명함·밝기는 SV 사각에서.
 assert.equal(tree.root.findAll(n=>n.props&&n.props.accessibilityLabel==='색 사각판').length,1,'선명함·밝기는 SV 사각 하나로 고른다');
 assert.equal(tree.root.findAll(n=>n.props&&n.props.accessibilityLabel==='색 계열 막대').length,1,'계열은 색상 막대 하나로 고른다');
 assert.equal(tree.root.findAll(n=>n.props&&n.props.accessibilityLabel==='HEX 색 값').length,1,'상세 조절 중에는 패널이 유지된다');
 await press('팔레트');
 assert.ok(labelled('색 #54A9E8').every(n=>n.props.accessibilityState.selected),'다시 열어도 고른 색이 선택으로 표시된다');
 await press('팔레트 닫기');
 assert.equal(labelled('색 #54A9E8').length,0,'닫으면 다시 간결한 줄로 돌아온다');

 // ── An empty canvas is never a finished cut ────────────────────────────────────────────────
 // 45.38: 저장 버튼은 이 칸에 머문다. 빈 캔버스는 저장하되 완성으로 치지 않고, 캔버스 위 안내가 그 이유를 말한다.
 await press('저장');
 await saved(true,blank);
 assert.equal(fresh().slots.filter(s=>s.done).length,0,'declaring an empty canvas finished does not count it');
 assert.ok(tree.root.findAll(n=>n.props.testID==='저장 안내').length===1&&shown().some(t=>t.includes('빈 칸은 완성으로 치지 않아요')),'and it says why');
 assert.ok(fresh().slots[0].finalImage,'while the work itself is still kept');
 assert.equal(tree.root.findAllByType('WebView').length,1,'and it stays on the same cut');

 // ── Drawing, declaring it done, and landing on the next unfinished cut ──────────────────────
 scene.dirty=true;await message(scene);
 await press('저장');
 await saved();
 assert.equal(fresh().slots[0].done,true,'a drawn cut can be declared finished');
 assert.equal(tree.root.findAllByType('WebView').length,1,'saving keeps the user on the same cut (45.38)');
 await press('다음 칸으로 가기');
 assert.equal(fresh().slots[0].qa.status,'PASS','and it is checked against the file that was just written');
 assert.equal(fresh().lastSlot,1,'and the set remembers where the work was');
 const second=await init();
 assert.equal(second.layers[0].data,undefined,'the next cut starts on an empty canvas, never on a copy');
 assert.equal(second.color,'#54A9E8','and the canvas opens holding the colour the set was last drawn with');
 assert.equal(second.penWidth,6,'with the pen width the tool bar is showing');
 assert.equal(second.eraserWidth,24,'and the eraser size it is showing');

 // ── A new empty cut offers to start from the previous drawing, once ─────────────────────────
 assert.equal(fresh().canon.image,undefined,'nothing was adopted as the set reference on its own');
 assert.equal(labelled('이전 칸 그림으로 시작').length,1,'the empty next cut offers the previous drawing');
 assert.equal(tree.root.findAll(n=>n.type==='Image'&&n.props.accessibilityLabel==='이전 칸 그림').length,1,'shown as a picture');
 await press('더보기');
 assert.equal(labelled('이전 그림 복사').length,0,'while it is offered on the canvas, the menu does not repeat it');
 await press('더보기 닫기');
 await press('이전 칸 그림 안 쓰기');
 assert.equal(labelled('이전 칸 그림으로 시작').length,0,'dismissing it takes it away');
 assert.equal(sent().filter(m=>m.type==='copyWork').length,0,'and copies nothing');
 assert.equal(fresh().canon.image,undefined,'and adopts nothing');
 // ── Copying the previous cut: explicit, and its own document ────────────────────────────────
 const firstPath=fresh().slots[0].finalImage.path;
 await press('더보기');
 assert.equal(labelled('이전 그림 복사').length,1,'now there is something to copy');
 await press('이전 그림 복사');
 const copy=lastCommand('copyWork');
 assert.equal(copy.layers.length,fresh().slots[0].work.layers.length,'the copy keeps the shape of the document it came from');
 assert.ok(copy.layers.some(l=>l.data&&l.data.startsWith('data:image/png')),'and carries pixels, not a pointer');
 assert.equal(fresh().slots[1].done,undefined,'copying does not carry the finished mark over');
 assert.equal(fresh().slots[1].qa,undefined,'nor the check result');
 scene={...scene,dirty:true,layers:copy.layers.map(publicLayer)};await message(scene);
 assert.equal(scene.layers.length,2,'both drawing layers come across');
 await autosave();await saved();
 const copied=fresh().slots[1];
 assert.notEqual(copied.finalImage.path,firstPath,'the copy is saved as its own file');
 assert.equal(copied.done,false,'and stays 작업 중 until the user says otherwise');
 assert.equal(fresh().slots[0].finalImage.path,firstPath,'the cut it came from is untouched');
 assert.ok(files.has(localFile(firstPath).uri),'and its file is still on disk');
 assert.deepEqual(fresh().slots[0].work.layers.map(l=>l.image.path),fresh().slots[0].work.layers.map(l=>l.image.path));
 assert.ok(fresh().slots[1].work.layers.every(l=>!fresh().slots[0].work.layers.some(o=>o.image.path===l.image.path)),'the copy shares no pixel file with the original');

 // ── Words go into the exported picture, and nowhere else ────────────────────────────────────
 await press('문구');
 await act(async()=>tree.root.findAll(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='문구 내용')[0].props.onChangeText('고마워요'));
 assert.equal(labelled('문구 아래').length+labelled('문구 위').length+labelled('문구 위치 조절').length,0,'글씨 자리를 버튼으로 옮기는 간접 배치가 없다');
 await press('문구 적용');
 const caption=lastCommand('caption').caption;
 assert.equal(caption.text,'고마워요','Korean text reaches the canvas as written');
 assert.equal(caption.place,'bottom','새 문구는 아래에서 시작하고 자리는 캔버스에서 옮긴다');
 assert.deepEqual(lastCommand('captionPick'),{type:'captionPick',on:true},'입력을 마치면 글씨가 골라진 상태로 남아 바로 옮길 수 있다');
 scene={...scene,dirty:true,caption,captionPicked:true};await message(scene);
 assert.equal(labelled('문구 내용 고치기').length,1,'고른 동안에는 내용 고치기');
 assert.equal(labelled('문구 크게').length+labelled('문구 왼쪽 회전').length,0,'크기·회전 버튼 대신 캔버스 손잡이와 두 손가락');
 await message({type:'captionEdit'});
 assert.equal(tree.root.findAll(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='문구 내용').length,1,'고른 글씨를 한 번 더 누르면 내용 고치기가 열린다');
 await press('문구 닫기');
 await press('문구 선택 끝');
 assert.deepEqual(lastCommand('captionPick'),{type:'captionPick',on:false});
 scene={...scene,captionPicked:false};await message(scene);
 await autosave();await saved();
 assert.deepEqual(fresh().slots[1].work.caption,caption,'the words are saved with the drawing');

 // ── The keyboard covers the bottom half, and the layout has to fold and come back ──────────
 // 페인터는 Modal 안에 있어 adjustResize 를 받지 못한다. 그래서 키보드 높이를 직접 받아 바닥을 들어올린다.
 // 실기기 측에서는 키보드가 올라온 상태(S5·S6)까지 캡처로 확인했고, 닫은 뒤 복원은 여기서 본다.
 // 화면에 KeyboardAvoidingView 는 둘이다(홈 하나, 페인터 하나). 문구 적용을 품은 쪽이 페인터다.
 const kav = () => tree.root.findAll(n=>n.type==='KeyboardAvoidingView').filter(n=>n.findAll(c=>c.type==='Pressable'&&c.props.accessibilityLabel==='문구 적용').length===1).at(-1);
 const keyboardTo = async height => { await act(async () => { for (const fn of keyboardListeners[height > 0 ? 'keyboardDidShow' : 'keyboardDidHide'] || []) fn({ endCoordinates: { height } }); }); };
 // 45.28: 아래 도구 줄은 네 칸 균등(펜·지우개·채우기·선택)이다.
 const toolRow = () => ['그리기 도구 펜','지우개','채우기','선택'].filter(name => labelled(name).length > 0);
 await press('문구');
 assert.deepEqual(toolRow(),['그리기 도구 펜','지우개','채우기','선택'],'키보드 전에는 하단 도구바가 그대로 있다');
 assert.equal(kav().props.behavior,'height','Android absolute dock는 높이 조정으로 키보드를 피한다');
 await keyboardTo(320);
 assert.equal(labelled('키보드 닫기').length,1,'패널 취소와 별도의 키보드 닫기');
 assert.equal(tree.root.findAll(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='문구 내용').length,1,'입력칸은 그대로 있고');
 assert.equal(labelled('문구 적용').length,1,'적용도 함께 남아 누를 수 있다');
 assert.deepEqual(toolRow(),[],'대신 하단 도구바는 글자를 치는 동안 비켜준다');
 await keyboardTo(0);
 assert.equal(kav().props.behavior,'height','키보드 복원은 동일한 높이 조정 호스트에서 처리한다');
 assert.deepEqual(toolRow(),['그리기 도구 펜','지우개','채우기','선택'],'그리고 하단 도구바가 제자리로 돌아온다');
 assert.equal(labelled('문구 적용').length,1,'문구 패널은 그대로 열려 있다 — 키보드를 닫은 것이 취소는 아니다');
 await press('문구 닫기');

 // ── Make this cut the set reference: a snapshot, not a live link ────────────────────────────
 // 45.2: the set-wide reference lives in the set menu (더보기); the 참고 rail is only for pictures to look at.
 await press('더보기');
 await press('이 칸을 캐릭터 기준으로');
 await saved();
 const chosen=fresh().slots[1].finalImage.path;
 assert.equal(fresh().canon.image.path,chosen,'the chosen picture becomes the set reference');
 scene.dirty=true;await message(scene);
 await autosave();await saved();
 assert.equal(fresh().canon.image.path,chosen,'redrawing that cut leaves the reference alone');
 assert.notEqual(fresh().slots[1].finalImage.path,chosen,'because the cut moved on to a new file');
 assert.ok(files.has(localFile(chosen).uri),'and the snapshot file is kept');
 await press('참고');
 assert.equal(labelled('캐릭터 기준 보기').length,0,'the 참고 rail does not repeat the set reference entry');
 await press('참고');
 await press('더보기');
 assert.equal(labelled('캐릭터 기준 보기').length,1,'the character reference has one entry, in the set menu');
 await press('캐릭터 기준 보기');
 assert.equal(tree.root.findAll(n=>n.type==='Image'&&n.props.accessibilityLabel==='캐릭터 기준 그림').length,1,'and shows as a picture');
 await press('캐릭터 기준 닫기');

 // ── Re-editing a finished cut puts it back to 작업 중 ───────────────────────────────────────
 await press('더보기');
 await press('이전 칸');await saved(false);await init();
 assert.equal(fresh().slots[0].done,true);
 // A cut that already has a drawing is never overwritten without being asked.
 const beforeAsk=sent().filter(m=>m.type==='copyWork').length;
 await press('더보기');await press('이전 그림 복사');
 assert.equal(sent().filter(m=>m.type==='copyWork').length,beforeAsk,'copying asks first when there is something to lose');
 assert.ok(alerts.at(-1).message.includes('되살릴 수'),'and says the copy can be undone');
 await answer('취소');
 assert.equal(sent().filter(m=>m.type==='copyWork').length,beforeAsk,'declining copies nothing');
 await press('더보기');await press('이전 그림 복사');
 await answer('복사');
 assert.equal(sent().filter(m=>m.type==='copyWork').length,beforeAsk+1,'accepting copies');
 scene.dirty=true;await message(scene);
 await autosave();await saved();
 assert.equal(fresh().slots[0].done,false,'editing a finished cut drops the finished mark');
 assert.equal(fresh().slots[0].status,'PASS','and the verdict is the one for the new file');
 await press('그리기 닫기');await saved(false);

 // ── The board: one size, three states, problems marked apart ────────────────────────────────
 assert.equal(tiles().length,32,'every cut is on one board at one size');
 const fitsThreeAcross=(cellWidth,label)=>{
  const pad=16,gap=8; // styles.page padding and the grid gap
  assert.ok(cellWidth*3+gap*2<=390-pad*2+.01,label+' must fit three across a 390pt screen, got '+cellWidth);
  assert.ok(cellWidth*4+gap*3>390-pad*2,label+' should not be so small that four would fit');
 };
 fitsThreeAcross(styleOf(tiles()[0]).width,'slot tile');
 const tile=n=>tiles().find(t=>t.props.testID==='slot-'+n);
 assert.equal(tile(1).props.accessibilityLabel,'슬롯 1 작업 중','a cut with a drawing but no declaration is 작업 중');
 assert.equal(tile(2).props.accessibilityLabel,'슬롯 2 작업 중');
 assert.equal(tile(3).props.accessibilityLabel,'슬롯 3 미착수','an untouched cut is 미착수');
 assert.equal(tile(3).findAllByType('Image').length,0,'and shows no artwork');
 assert.ok(shown().some(t=>t==='0개 완성 · 2개 작업 중'),'the board counts declarations and work in progress, not saves');
 await act(async()=>tile(1).props.onPress());await init();
 scene.dirty=true;await message(scene);
 await press('저장');await saved();await init();
 assert.equal(tile(1).props.accessibilityLabel,'슬롯 1 완성');
 assert.ok(shown().some(t=>t.startsWith('1개 완성')),'and the count follows: '+shown().filter(t=>t.includes('개 완성')).join(' | '));
 await press('그리기 닫기');await saved(false);

 // ── Unsaved work survives leaving the app, and a double tap saves once ──────────────────────
 await act(async()=>tile(2).props.onPress());await init();
 scene.dirty=true;await message(scene);
 const beforeAutosave=sent().filter(m=>m.type==='save').length;
 await act(async()=>{appState.forEach(fn=>fn('background'));});
 assert.equal(sent().filter(m=>m.type==='save').length,beforeAutosave+1,'leaving the foreground saves unsaved work');

 // ── 주기 자동저장은 고르는 중인 작업을 확정하지 않는다 ─────────────────────────────────────
 // 기기 기록에서 찾은 실제 결함이다: 선택을 들어올린 채 40초가 지나면 자동저장이 그 선택을
 // 확정해 버려, 그 뒤의 끌기가 새 영역을 잡았다. 사용자는 하던 변형을 잃는다.
 //   lift(+745ms) → apply 이유=save(+10332ms) → 다음 끌기가 새 마키
 // 앱을 내릴 때의 저장은 그대로 둔다 — 그때는 앱이 사라질 수 있어 확정하는 편이 안전하다.
 {
   await saved(true);
   scene.dirty=true; scene.selection={box:{x:10,y:10,w:80,h:40},dx:0,dy:0,scale:1,rot:0,flip:1};
   await message(scene);
   const before=sent().filter(m=>m.type==='save').length;
   await act(async()=>{timers.forEach(fn=>fn());});
   assert.equal(sent().filter(m=>m.type==='save').length,before,'고르는 중에는 주기 자동저장이 저장을 부르지 않는다');
   // 앱을 내리면 그때는 저장한다.
   scene.dirty=true; await message(scene);
   await act(async()=>{appState.forEach(fn=>fn('background'));});
   assert.equal(sent().filter(m=>m.type==='save').length,before+1,'앱을 내릴 때는 고르는 중이어도 저장한다');
   // 고르기를 끝내면 주기 자동저장이 다시 동작한다.
   await saved(true);
   scene.selection=null; scene.dirty=true; await message(scene);
   const after=sent().filter(m=>m.type==='save').length;
   await act(async()=>{timers.forEach(fn=>fn());});
   assert.equal(sent().filter(m=>m.type==='save').length,after+1,'고르기를 끝내면 주기 자동저장이 돌아온다');
 }
 await saved();
 // ── 45.12: 늦게 온 옛 저장 응답이 지금 저장으로 둔갑하지 않는다 ────────────────────────────
 // 저장이 늦어 포기한 뒤(화면은 '저장이 늦어지고 있어요' 를 띄운다) 그 응답이 뒤늦게 도착하면,
 // 그때 그린 그림 대신 옛 그림이 파일로 들어갈 수 있었다. 요청마다 번호를 붙여 막는다.
 {
  await autosave();
  const token = lastCommand('save').token;
  assert.ok(typeof token === 'number', '저장 요청에는 번호가 붙는다: ' + JSON.stringify(token));
  const beforeStale = JSON.stringify(loadStore().store.projects);
  const answered = () => sent().filter(m => m.type === 'saved').length;
  const beforeAnswered = answered();
  await saved(true, metrics, token - 1);            // 번호가 다른(옛) 응답
  assert.equal(JSON.stringify(loadStore().store.projects), beforeStale, '옛 응답으로는 파일을 쓰지 않는다');
  assert.equal(answered(), beforeAnswered, '옛 응답에 저장 완료라고 답하지도 않는다');
  await saved(true, metrics, token);                // 지금 요청의 응답
  const done = sent().filter(m => m.type === 'saved').at(-1);
  assert.ok(done && done.token === token, '지금 응답에는 같은 번호로 답한다');
  assert.notEqual(JSON.stringify(loadStore().store.projects), beforeStale, '지금 응답은 실제로 저장된다');
  const next = (await (async () => { await autosave(); return lastCommand('save').token; })());
  assert.ok(next > token, '다음 저장은 새 번호를 쓴다: ' + next + ' > ' + token);
  await saved(false, metrics, next);
 }


 // ── 45.13: 저장은 한 번의 호출 안에서 파일 쓰기까지 끝난다 ────────────────────────────────
 // 중간에 기다림(await)이 생기면 A 의 쓰기가 끝나기 전에 B 가 끼어들 수 있다. 그 구조가 아님을 동작으로 못 박는다.
 {
  await autosave();
  const token = lastCommand('save').token;
  const before = loadStore().store.revision;
  const answered = () => sent().filter(m => m.type === 'saved').length;
  const beforeAnswered = answered();
  let wroteInSameCall = false, answeredInSameCall = false;
  const payload = { type: 'save', token, dirty: true, data: 'data:image/png;base64,' + png.toString('base64'), metrics,
    activeLayerId: scene.activeLayerId, caption: scene.caption || undefined, motion: scene.motion || null,
    layers: scene.layers.map(l => ({ ...publicLayer(l), data: 'data:image/png;base64,' + png.toString('base64') })), references: [] };
  await act(async () => {
   tree.root.findByType('WebView').props.onMessage({ nativeEvent: { data: JSON.stringify(payload) } });
   // 여기까지 오는 사이에 기다림이 없었으므로, 파일도 응답도 이미 끝나 있어야 한다.
   wroteInSameCall = loadStore().store.revision !== before;
   answeredInSameCall = answered() === beforeAnswered + 1;
  });
  assert.ok(wroteInSameCall, '저장 응답을 받은 그 호출 안에서 파일이 쓰인다(중간에 기다림이 없다)');
  assert.ok(answeredInSameCall, '같은 호출 안에서 캔버스에 저장 완료를 알린다');
 }

 // ── 45.13: 저장이 길어질 때만 캔버스가 이유를 말한다 · 시간초과 뒤에는 다시 그릴 수 있다 ──────
 {
  const notice = () => shown().some(t => t.includes('저장 중이에요'));
  await autosave();
  assert.equal(notice(), false, '보통 저장에서는 캔버스에 아무 말도 하지 않는다');
  assert.equal(pending(1500) > 0, true, '길어질 때를 대비한 알림이 예약돼 있다');
  await act(async () => { fire(1500); });
  assert.ok(notice(), '저장이 길어지면 지금 그릴 수 없는 이유를 캔버스에 적는다');
  assert.equal(labelled('저장 중이라 잠시 그릴 수 없어요').length + tree.root.findAll(n => n.props.accessibilityLabel === '저장 중이라 잠시 그릴 수 없어요').length > 0, true, '읽어 주는 이름도 붙는다');
  // 응답이 끝내 오지 않으면 시간초과가 잠금을 풀고, 무슨 일이 있었는지 알려 준다.
  const beforeAlerts = alerts.length;
  await act(async () => { fire(20000); });
  assert.ok(alerts.length > beforeAlerts, '시간초과를 알린다');
  const late = alerts.at(-1);
  assert.ok(String(late.message || '').includes('닫기'), '무엇을 누르면 다시 저장되는지 알려 준다: ' + JSON.stringify(late));
  assert.equal(notice(), false, '잠금이 풀리면 캔버스 알림도 걷힌다');
  assert.equal(lastSent().type, 'saveFailed', '캔버스에도 이번 저장을 접었다고 알린다');
  assert.equal(lastSent().token, lastCommand('save').token, '접는 것도 그 요청 번호로만 한다');
  // 잠금이 풀렸으니 다시 저장할 수 있다(자동저장·닫기·완성 어느 쪽이든 같은 길이다).
  const beforeRetry = sent().filter(m => m.type === 'save').length;
  await autosave();
  assert.equal(sent().filter(m => m.type === 'save').length, beforeRetry + 1, '시간초과 뒤에는 다시 저장을 부를 수 있다');
  const retryToken = lastCommand('save').token;
  await saved(true, metrics, retryToken);
  assert.equal(sent().filter(m => m.type === 'saved').at(-1).token, retryToken, '다시 부른 저장은 정상으로 끝난다');
 }
 // 45.38: 저장 버튼은 하나(사용자 요청). 그래도 작업은 스스로 저장된다 — 저장 버튼은 '이 칸 완성' 선언이다.
 assert.equal(labelled('저장').length,1,'one save button, and work still saves itself');
 const beforeDouble=sent().filter(m=>m.type==='save').length;
 const closeButton=labelled('그리기 닫기')[0];
 await act(async()=>{closeButton.props.onPress();closeButton.props.onPress();});
 assert.equal(sent().filter(m=>m.type==='save').length,beforeDouble+1,'two quick taps ask the canvas to save once');
 await saved(false);

 // ── The last open cut hands the user back to the board, not to another canvas ───────────────
 const setId=fresh().id;
 const allButOne=x=>({...x,slots:x.slots.map(s=>s.number===9
   ?{...s,done:false,finalImage:undefined,work:undefined}
   :{...s,done:true,finalImage:s.finalImage??{path:'image-old.png',width:360,height:360,metrics}})});
 saveStore({...loadStore().store,revision:loadStore().store.revision+1,projects:loadStore().store.projects.map(x=>x.id===setId?allButOne(x):x)});
 await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});
 await openSet('새 이모티콘 세트');
 await act(async()=>tiles().find(t=>t.props.testID==='slot-9').props.onPress());await init();
 scene.dirty=true;await message(scene);
 await press('저장');await saved();
 assert.equal(tree.root.findAllByType('WebView').length,1,'saving the last open cut still stays on it');
 await press('전체 보기로 가기');
 assert.equal(tree.root.findAllByType('WebView').length,0,'finishing the last open cut closes the painter');
 assert.equal(tiles().length,32,'and lands on the board, where the whole set is visible at once');
 // 45.43 S5: 다 채운 보드는 완성 카드 B(시안 '완료 B')가 머리를 맡는다 — 칸 수는 이 세트의 실제 칸 수.
 assert.ok(shown().some(t=>t==='32칸 완성!'),'with every cut counted and none left in progress');
 assert.equal(tree.root.findAll(n=>n.type==='View'&&n.props.testID==='완성 카드').length,1,'the complete card is on the board');

 // ── 내보내기: the result comes first, then what to fix, then one action ─────────────────────
 assert.equal(labelled('내보내기').length,1,'a finished set offers 내보내기 on the board (one yellow action, in the complete card)');
 assert.equal(labelled('제출 준비').length,0,'the old 제출 준비 button is gone');
 await press('내보내기');
 assert.ok(shown().some(t=>t.includes('멈춰있는 이모티콘')),'the official profile is named');
 assert.equal(tree.root.findAll(n=>n.props.testID==='결과 격자').length,1,'the made set is on screen first');
 assert.ok(!shown().some(t=>t.includes('제출 파일')),'the app never calls its bundle a submission file');
 assert.ok(!shown().some(t=>t.includes('작업 파일')),'nor contradicts a promise with a working-file disclaimer');
 assert.ok(!shown().some(t=>/승인 확률|점수/.test(t)),'no approval odds anywhere');
 assert.ok(!shown().some(t=>t.includes('아직 완성되지 않았어요')),'a finished set reports no missing cuts');
 // 45.38: 내보내기 결과에서 칸을 열어 고치고 저장하면, 다음 칸이 아니라 이 검수 화면으로 돌아온다.
 // 한 칸을 미완성으로 되돌려 둔다 — 예전 코드는 미완성 칸이 남아 있으면 그 칸으로 넘어갔다.
 {
  const sid=fresh().id;
  saveStore({...loadStore().store,revision:loadStore().store.revision+1,projects:loadStore().store.projects.map(x=>x.id===sid?{...x,slots:x.slots.map(s=>s.number===20?{...s,done:false}:s)}:x)});
  await press('03번 칸 열기');await init();
  scene.dirty=true;await message(scene);
  assert.equal(labelled('저장')[0].props.accessibilityHint,'저장한 뒤 내보내기 검수로 돌아가요','the save button says where it will go');
  await press('저장');await saved();
  assert.equal(tree.root.findAllByType('WebView').length,0,'saving a cut opened from the review closes the painter');
  assert.equal(tree.root.findAll(n=>n.props.testID==='결과 격자').length,1,'and returns to the review, not to the next unfinished cut');
 }
 const named=label=>tree.root.findAll(n=>n.props.accessibilityLabel===label);
 assert.equal(labelled('자세히 보기').length,1,'규격과 직접 확인은 처음에 접혀 있다');
 assert.ok(!shown().some(t=>t.includes('공식 가이드 확인일')),'접힌 동안 원문이 화면을 채우지 않는다');
 assert.equal(named('밝은 배경 미리보기').length,0,'and the check previews wait there too');
 await press('자세히 보기');
 assert.ok(shown().some(t=>t.includes('150KB')),'with the ceiling the guide actually gives');
 assert.ok(shown().some(t=>t.includes('공식 가이드 확인일')),'펼치면 확인일과 원문이 있다');
 assert.ok(shown().some(t=>t.includes('직접 확인')),'human review is named as human review');
 assert.equal(named('밝은 배경 미리보기').length,1,'the light-ground preview is there');
 assert.equal(named('어두운 배경 미리보기').length,1,'and the dark one beside it');
 assert.ok(!shown().some(t=>t.includes('사람이 판단할 일')),'without lecturing about who judges');
 await press('자세히 접기');
 assert.equal(tree.root.findAll(n=>n.props.accessibilityLabel==='파일 묶음 만들기'&&n.props.accessibilityRole==='button').length,1,'지금 할 일은 버튼 하나다');
 await press('파일 묶음 만들기');
 await act(async()=>{});
 assert.equal(shared.length,1,'the set is handed to the share sheet');
 assert.ok(shared[0].uri.endsWith('.zip'));
 assert.equal(shared[0].options.mimeType,'application/zip');
 assert.ok(shown().some(t=>t.includes('공유 창에서 저장할 곳')),'the notice reports the file was made, not that it arrived');
 assert.equal(labelled('알림 닫기').length,1);
 await press('다시 공유');
 await act(async()=>{});
 assert.equal(shared.length,2,'a cancelled share can always be sent again');
 // 45.1차: 내보내기 결과는 그 세트의 것이다 — 다른 세트로 가면 배너도 '다시 공유'도 따라가지 않는다.
 await press('뒤로');await press('뒤로');
 await openSet('이전 프로젝트');await press('내보내기');
 assert.equal(labelled('다시 공유').length,0,'다른 세트의 내보내기 결과가 따라오지 않는다');
 assert.ok(!shown().some(t=>t.includes('칸을 묶었어요')),'다른 세트의 묶음 안내도 남지 않는다');
 assert.equal(shared.length,2,'세트를 오가는 동안 아무 것도 공유되지 않는다');
 await press('뒤로');await press('뒤로');await openSet('새 이모티콘 세트');
 // 45.1차: 보드의 일시 상태(전체 재생·순서 바꾸기)는 보드를 떠나면 끝난다.
 await press('전체 재생');
 assert.equal(labelled('전체 재생 멈추기').length,1,'보드에서 전체 재생이 켜진다');
 await act(async()=>tiles()[0].props.onPress());await init();
 await press('그리기 닫기');await saved(false);
 assert.equal(labelled('전체 재생').length,1,'칸을 열고 닫으면 전체 재생은 멈춰 있다');
 await press('세트 메뉴');await press('칸 순서 바꾸기');
 assert.equal(labelled('순서 바꾸기 끝').length,1,'순서 바꾸기 모드가 켜진다');
 await press('내보내기');await press('뒤로');
 assert.equal(labelled('순서 바꾸기 끝').length,0,'보드를 떠났다 오면 순서 바꾸기는 꺼져 있다');
 // 42차 실기기: '저장된 그림 다시 검사'가 빈 칸마다 "그림 파일 없음" FAIL 을 저장해 내보내기에 가짜 손볼 곳 29줄이 생겼다.
 {
  const base=fresh();
  const polluted={status:'FAIL',checkedAt:'2026-09-15T00:00:00.000Z',checks:[{label:'그림 파일',status:'FAIL',detail:'저장된 그림 파일을 찾을 수 없어요.'}],consistency:[],notes:[]};
  const partial={...base,id:base.id+'-empty-check',projectName:'빈 칸 검사 세트',slots:base.slots.map(s=>s.number===1?s:{...s,finalImage:undefined,motionImage:undefined,submitImage:undefined,work:undefined,done:undefined,qa:polluted})};
  saveStore({...loadStore().store,revision:loadStore().store.revision+1,projects:[...loadStore().store.projects,partial]});
  await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});
  await openSet('빈 칸 검사 세트');await press('내보내기');
  const checkRows=()=>tree.root.findAll(n=>n.type==='Pressable'&&/^\d+번 검사 고치기$/.test(n.props.accessibilityLabel??''));
  assert.equal(checkRows().length,0,'빈 칸에 남은 옛 검사 결과는 손볼 곳이 아니다');
  await press('자세히 보기');await press('저장된 그림 다시 검사');await act(async()=>{});await act(async()=>{});
  const after=loadStore().store.projects.find(p=>p.id===partial.id);
  assert.ok(after.slots.filter(s=>!s.finalImage).every(s=>s.qa===undefined),'다시 검사하면 빈 칸에는 검사 결과가 남지 않는다');
  assert.equal(checkRows().length,0,'다시 검사 뒤에도 가짜 손볼 곳이 없다');
  saveStore({...loadStore().store,revision:loadStore().store.revision+1,projects:loadStore().store.projects.filter(p=>p.id!==partial.id)});
  await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});
  await openSet('새 이모티콘 세트');await press('내보내기');
 }
 // Identical files are pointed out, never edited away.
 const twin=fresh().slots[0].finalImage;
 saveStore({...loadStore().store,revision:loadStore().store.revision+1,projects:loadStore().store.projects.map(x=>x.id===fresh().id?{...x,slots:x.slots.map(s=>s.number===3?{...s,finalImage:twin,done:true}:s)}:x)});
 await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});
 await openSet('새 이모티콘 세트');await press('내보내기');
 const twinRow=tree.root.findAll(n=>n.type==='Pressable'&&/같은 그림/.test(n.props.accessibilityLabel??''));
 assert.equal(twinRow.length,1,'two identical exports are reported once');
 assert.ok(shown().some(t=>t.includes('직접 판단해 주세요')),'and the call is left to the user');
 // A problem row opens the cut, and finishing there returns to the export run.
 await act(async()=>twinRow[0].props.onPress());
 assert.equal(tree.root.findAllByType('WebView').length,1,'the problem opens the painter on that cut');
 await init();await press('그리기 닫기');await saved(false);
 assert.ok(shown().some(t=>t.includes('멈춰있는 이모티콘')),'and closing it comes back to 내보내기 준비');
 await press('뒤로');

 // ── Old sets keep working, unchanged ────────────────────────────────────────────────────────
 await press('뒤로');
 const before=loadStore().store.projects.find(x=>x.id===p.id);
 await openSet('이전 프로젝트');
 assert.equal(tiles()[0].props.accessibilityLabel,'슬롯 1 완성','a store written before 완성 existed still reads as finished');
 assert.ok(shown().some(t=>t.startsWith('1개 완성')));
 await press('세트 메뉴');await press('캐릭터 기준 · 세트 이름');
 assert.equal(tree.root.findAll(n=>n.type==='Image'&&n.props.accessibilityLabel==='캐릭터 기준 그림').length,1,'its reference picture is still there');
 assert.ok(shown().some(t=>t==='성격 · 성격 유지'),'and the notes it once asked for are kept, read-only');
 for(const gone of ['성격','말투','감정','상황','포즈/행동','구도','꼭 유지할 특징'])assert.equal(tree.root.findAll(n=>n.type==='TextInput'&&n.props.accessibilityLabel===gone).length,0,gone+' is no longer asked for');
 assert.equal(tree.root.findAll(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='세트 이름').length,1,'renaming the set is still possible');
 await press('뒤로');
 for(let n=1;n<=32;n++){
  await act(async()=>tiles().find(t=>t.props.testID==='slot-'+n).props.onPress());
  assert.equal(tree.root.findAllByType('WebView').length,1,'direct painter '+n);await init();
  await press('그리기 닫기');await saved(false);
 }
 assert.deepEqual(loadStore().store.projects.find(x=>x.id===p.id),before,'opening untouched cuts changes nothing that was saved');
 const legacy=loadStore().store.projects.find(x=>x.id===p.id);
 assert.equal(legacy.slots[0].dialogue,'대사 1','old planning text is preserved, not repurposed');
 assert.equal(legacy.slots[0].emotion,'감정 유지');
 assert.equal(legacy.slots[0].referenceImages.length,1,'old reference images are preserved');

 // 45.43: 저장된 참고 설정이 없는 칸의 참고는 **숨긴 채** 연다(새 빈 칸에 참고 그림이 저절로 깔리던 문제). 참고 데이터는 그대로 남아
 // 참고 줄에서 다시 켤 수 있다. 기획에서 칸에 지정한 참고(referenceKey)만 켜고 연다.
 await act(async()=>tiles()[1].props.onPress());
 await message({type:'ready'});
 assert.equal(lastCommand('init').references.length,1,'the reference is still there');
 assert.equal(lastCommand('init').references.filter(r=>r.visible).length,0,'but a cut without saved reference settings opens without it showing');
 scene={type:'state',undo:false,redo:false,dirty:false,activeLayerId:'draw-1',activeReferenceId:null,caption:null,layers:lastCommand('init').layers,references:lastCommand('init').references};
 await message(scene);await message({type:'initialized'});
 // References(45.1차): 타일을 고르면 그 참고가 캔버스에 바로 보인다. 숨기기는 눈이 맡고, 삭제는 세트 전체에서 뺀다.
 const refId=lastCommand('init').references[0].id;
 await press('참고');
 await press('참고 1 선택');
 assert.deepEqual(lastSent(),{type:'toggleReference',id:refId},'타일을 고르면 그 참고가 캔버스에 보인다');
 scene={...scene,activeReferenceId:refId,references:scene.references.map(r=>({...r,visible:r.id===refId}))};await message(scene);
 await press('참고 1 선택');
 assert.deepEqual(lastSent(),{type:'setActiveReference',id:null},'고른 타일을 다시 누르면 선택만 풀린다(앱이 마음대로 숨기지 않는다)');
 scene={...scene,activeReferenceId:refId};await message(scene);
 await press('참고 숨기기');
 assert.deepEqual(lastSent(),{type:'toggleReference',id:refId},'the eye is the one visibility control');
 const fade=tree.root.findAll(n=>n.type==='View'&&n.props.testID==='참고 진하기');
 assert.equal(fade.length,1,'a selected reference can be faded without leaving the canvas');
 await act(async()=>fade[0].props.onLayout({nativeEvent:{layout:{width:90}}}));
 await act(async()=>fade[0].props.onResponderGrant({nativeEvent:{locationX:50}}));
 assert.equal(lastCommand('transform').opacity,.6,'and the fade drives its opacity');
 assert.equal(labelled('참고 삭제').length,0,'destructive actions stay tucked away');
 await press('참고 관리');
 await press('참고 삭제');
 // 45.37: 참고는 칸마다 따로다. 지우면 **이 칸에서만** 없어지고 다른 칸의 참고는 그대로다(한 칸의 참고가 세트 전체에 깔리던 사용자 신고).
 assert.ok(alerts.at(-1).message.includes('이 칸'),'removing a reference says it affects this cut only');
 const holdersBefore=loadStore().store.projects.find(x=>x.id===p.id).slots.filter(s=>s.referenceImages.some(i=>i.path===image.path)).length;
 await answer('삭제');
 const holdersAfter=loadStore().store.projects.find(x=>x.id===p.id).slots.filter(s=>s.referenceImages.some(i=>i.path===image.path)).length;
 assert.equal(holdersAfter,holdersBefore-1,'it leaves only this cut — the other cuts keep their own reference');
 // 새로 가져온 참고 사진도 이 칸 하나에만 들어간다.
 pendingPicks=[{path:'image-cut-only.png',width:360,height:360}];
 if(!labelled('참고 사진 추가').length)await press('참고');
 await act(async()=>labelled('참고 사진 추가')[0].props.onPress());await act(async()=>{});
 assert.equal(loadStore().store.projects.find(x=>x.id===p.id).slots.filter(s=>s.referenceImages.some(i=>i.path==='image-cut-only.png')).length,1,'a newly added reference lands in this cut only, not the whole set');
 pendingPicks=[];
 assert.equal(labelled('기획 보기').length,0,'the legacy planning card is no longer a separate entry on the canvas (its data is kept, see above)');
 await press('그리기 닫기');await saved(false);

 await press('세트 메뉴');await press('캐릭터 기준 · 세트 이름');
 // The set reference can be swapped for an outside picture, or taken down entirely, and neither
 // is allowed to delete a file one of the cuts is still using.
 const keptByACut=loadStore().store.projects.find(x=>x.id===p.id).slots[0].finalImage.path;
 pendingPicks=[{path:'image-new.png',width:360,height:360}];
 await press('다른 그림으로 바꾸기');
 await act(async()=>{});
 assert.equal(loadStore().store.projects.find(x=>x.id===p.id).canon.image.path,'image-new.png','an outside picture replaces the set reference');
 assert.equal(files.has(localFile(keptByACut).uri),true,'and the old one stays because a cut still points at it');
 await press('캐릭터 기준 내리기');
 assert.equal(loadStore().store.projects.find(x=>x.id===p.id).canon.image,undefined,'the set reference can be taken down');
 assert.equal(files.has(localFile('image-new.png').uri),false,'and a picture nothing points at any more is cleaned up');
 assert.equal(files.has(localFile(keptByACut).uri),true,'while the drawing itself is never touched');
 assert.equal(labelled('캐릭터 기준 내리기').length,0,'with nothing to take down, the action is gone');
 await press('뒤로');
 assert.equal(labelled('세트 참고').length,0,'and the board stops showing a reference that is not there');
 await press('뒤로');

 // ── Deleting a set: guarded, and scoped to that set alone ───────────────────────────────────
 // 45.5: 홈은 최근 세트 하나 — 나머지 세트 카드와 그 관리 입구는 전체 작업 화면에 있다.
 if (buttons('다른 프로젝트 관리').length===0) await press('전체 작업 보기');
 assert.equal(labelled('다른 프로젝트 관리').length,1,'each set card carries a quiet management entry');
 assert.equal(tree.root.findAll(n=>n.type==='Button'&&n.props.label==='세트 삭제').length,0,'delete is never exposed on the card itself');
 const survivor=loadStore().store.projects.find(x=>x.id===p.id);
 await press('다른 프로젝트 관리');
 await press('세트 삭제');
 assert.ok(loadStore().store.projects.some(x=>x.id===other.id),'choosing delete only opens the confirmation');
 // 45.38: 삭제는 휴지통으로 옮기는 것이다. 30일 안에는 그림까지 그대로 되살릴 수 있고, 영구 삭제는 휴지통에서 따로 한다.
 assert.ok(shown().some(t=>t.includes('휴지통으로 옮겨요')),'confirmation says the set goes to the trash, not away for good');
 await press('휴지통으로 옮기기');
 let left=loadStore().store;
 assert.ok(left.projects.find(x=>x.id===other.id)?.deletedAt,'the set is kept in storage, marked as in the trash');
 assert.deepEqual(left.projects.find(x=>x.id===p.id),survivor,'the surviving set keeps every slot and image');
 for(const path of otherPaths)assert.equal(files.has(localFile(path).uri),true,'a set in the trash keeps its images: '+path);
 await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});
 assert.equal(labelled('다른 프로젝트').length,0,'a restart does not bring the trashed set back into the lists');
 // 되살리기
 await press('내 정보');
 await press('휴지통 1개');
 assert.equal(tree.root.findAll(n=>n.props.testID==='휴지통 다른 프로젝트').length,1,'the trash lists the set');
 await press('되살리기');
 assert.equal(loadStore().store.projects.find(x=>x.id===other.id).deletedAt,undefined,'restoring clears the trash mark');
 await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});
 if (buttons('다른 프로젝트 관리').length===0 && labelled('전체 작업 보기').length) await press('전체 작업 보기');
 assert.equal(labelled('다른 프로젝트 관리').length,1,'a restored set is back in the list');
 // 다시 휴지통 → 영구 삭제
 await press('다른 프로젝트 관리');
 await press('세트 삭제');
 await press('휴지통으로 옮기기');
 await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});
 await press('내 정보');
 await press('휴지통 1개');
 await press('영구 삭제');
 assert.ok(shown().some(t=>t.includes('되돌릴 수 없')),'permanent delete warns it cannot be undone');
 assert.ok(loadStore().store.projects.some(x=>x.id===other.id),'choosing permanent delete only opens the confirmation');
 const purgeButtons=tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='영구 삭제');
 await act(async()=>purgeButtons.at(-1).props.onPress());
 left=loadStore().store;
 assert.ok(!left.projects.some(x=>x.id===other.id),'the permanently deleted set is gone from storage');
 assert.deepEqual(left.projects.find(x=>x.id===p.id),survivor,'the surviving set keeps every slot and image');
 for(const path of otherPaths)assert.equal(files.has(localFile(path).uri),false,'permanent delete leaves no orphan image: '+path);
 assert.equal(files.has(localFile('image-old.png').uri),true,'another set keeps its images');
 for(const name of ['store-a.json','store-b.json'])assert.equal(files.has(localFile(name).uri),true,'store snapshots are never deleted: '+name);
 await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});
 // 30일이 지난 휴지통 세트는 앱이 열릴 때 영구 삭제된다. 다른 세트와 같이 쓰는 그림 파일은 남는다.
 {
  const st=loadStore().store;const base=st.projects.find(x=>x.id===p.id);
  const old={...base,id:'expired-set',projectName:'오래된 휴지통',deletedAt:new Date(Date.now()-31*86400000).toISOString()};
  const fresh2={...base,id:'recent-trash',projectName:'최근 휴지통',deletedAt:new Date(Date.now()-2*86400000).toISOString()};
  saveStore({...st,revision:st.revision+1,projects:[...st.projects,old,fresh2]});
  await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});await act(async()=>{});
  const after=loadStore().store.projects;
  assert.ok(!after.some(x=>x.id==='expired-set'),'a set 31 days in the trash is purged on launch');
  assert.ok(after.some(x=>x.id==='recent-trash'),'a set 2 days in the trash stays restorable');
  assert.deepEqual(after.find(x=>x.id===p.id),survivor,'purging never touches the live set that shares its images');
  saveStore({...loadStore().store,revision:loadStore().store.revision+1,projects:loadStore().store.projects.filter(x=>x.id!=='recent-trash')});
  await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});
 }
 assert.equal(labelled('다른 프로젝트').length,0,'a restart does not bring the deleted set back');

 // ── 45.38 세트 백업 → 되살리기: 세트 관리에서 파일 하나로 만들고, 설정에서 그 파일로 되살린다 ─────────────
 {
  const managers = () => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === '이전 프로젝트 관리');
  if (!managers().length && labelled('전체 작업 보기').length) await press('전체 작업 보기');
  await act(async () => managers()[0].props.onPress());
  const sharedBefore = shared.length;
  await press('백업 파일 만들기');
  await act(async () => {});
  assert.equal(shared.length, sharedBefore + 1, 'the backup file goes to the share sheet: ' + JSON.stringify(alerts.at(-1)));
  const backupUri = shared.at(-1).uri;
  assert.ok(/set-backup-.+\.zip$/.test(backupUri), 'a backup zip was written: ' + backupUri);
  assert.ok(shown().some(t => t.includes('백업 파일을 만들었어요')), 'and the user is told how many pictures it holds');
  const before = loadStore().store.projects.filter(x => !x.deletedAt).length;
  const original = loadStore().store.projects.find(x => x.projectName === '이전 프로젝트');
  pickedDocument = backupUri;
  await press('내 정보');
  await press('백업에서 되살리기');
  await act(async () => {});
  const after = loadStore().store.projects;
  assert.equal(after.filter(x => !x.deletedAt).length, before + 1, 'restoring adds a set');
  const copy = after.find(x => x.projectName === '이전 프로젝트 (복원)');
  assert.ok(copy && copy.id !== original.id, 'the same set already exists, so it comes back as a copy with a new id');
  const drawn = original.slots.filter(sl => sl.finalImage).length;
  assert.equal(copy.slots.filter(sl => sl.finalImage).length, drawn, 'every drawn cut comes back');
  for (const sl of copy.slots.filter(x => x.finalImage)) assert.ok(files.has(localFile(sl.finalImage.path).uri), 'restored pictures exist on disk: ' + sl.finalImage.path);
  assert.deepEqual(loadStore().store.projects.find(x => x.id === original.id), original, 'the original set is untouched');
  // 뒤 검사에 영향이 없게 되살린 사본을 걷어 낸다(그 그림은 다음 저장에서 정리된다).
  pickedDocument = null;
  saveStore({ ...loadStore().store, revision: loadStore().store.revision + 1, projects: loadStore().store.projects.filter(x => x.id !== copy.id) });
  await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(App)); });
 }
 // ── 45.38 세트 관리: 이름 바꾸기 · 복제, 전체 작업: 찾기 · 분류 · 정렬 ─────────────────────────────
 {
  const managers = name => tree.root.findAll(n => n.type === 'Pressable' && n.props.accessibilityLabel === name + ' 관리');
  const openAll = async () => { if (!labelled('세트 이름으로 찾기').length && labelled('전체 작업 보기').length) await press('전체 작업 보기'); };
  await openAll();
  await act(async () => managers('이전 프로젝트')[0].props.onPress());
  const original = loadStore().store.projects.find(x => x.projectName === '이전 프로젝트');
  // 복제: 새 id · '사본' 이름 · 그림은 함께 가리킨다(파일을 늘리지 않는다)
  await press('세트 복제');
  let st = loadStore().store;
  const dup = st.projects.find(x => x.projectName === '이전 프로젝트 사본');
  assert.ok(dup && dup.id !== original.id, 'duplicating makes a new set with its own id');
  assert.deepEqual(dup.slots, original.slots, 'the copy has every cut, pointing at the same pictures');
  // 이름 바꾸기: 사본의 이름을 바꾼다
  await act(async () => { tree.unmount(); }); await act(async () => { tree = create(React.createElement(App)); });
  await openAll();
  await act(async () => managers('이전 프로젝트 사본')[0].props.onPress());
  const nameField = () => tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === '세트 이름')[0];
  assert.equal(nameField().props.value, '이전 프로젝트 사본', 'the name field starts with the current name');
  await act(async () => nameField().props.onChangeText('두 번째 세트'));
  await press('이름 바꾸기');
  assert.equal(loadStore().store.projects.find(x => x.id === dup.id).projectName, '두 번째 세트', 'renaming changes only the name');
  // 찾기 · 분류 · 정렬
  await openAll();
  const listed = () => tree.root.findAll(n => n.props.testID === '전체 작업 목록')[0].findAll(n => n.type === 'Pressable' && / 관리$/.test(n.props.accessibilityLabel ?? '')).map(n => n.props.accessibilityLabel.replace(/ 관리$/, ''));
  const search = () => tree.root.findAll(n => n.type === 'TextInput' && n.props.accessibilityLabel === '세트 이름으로 찾기')[0];
  await act(async () => search().props.onChangeText('두 번째'));
  assert.deepEqual(listed(), ['두 번째 세트'], 'search narrows the list by name');
  await act(async () => search().props.onChangeText('없는 이름'));
  assert.equal(listed().length, 0, 'no match shows an empty list');
  assert.ok(shown().some(t => t.includes('조건에 맞는 세트가 없어요')), 'and says so');
  await act(async () => search().props.onChangeText(''));
  await press('이름순');
  const byName = listed();
  assert.deepEqual(byName, [...byName].sort((a, b) => a.localeCompare(b, 'ko')), 'name order sorts by name');
  await press('최근 수정순');
  // 뒤 검사에 영향이 없게 사본을 걷어 낸다
  saveStore({ ...loadStore().store, revision: loadStore().store.revision + 1, projects: loadStore().store.projects.filter(x => x.id !== dup.id) });
  await act(async () => tree.unmount()); await act(async () => { tree = create(React.createElement(App)); });
 }
 // ── Save failure: nothing moves on, and nothing is lost ─────────────────────────────────────
 await openSet('이전 프로젝트');
 await act(async()=>tiles()[4].props.onPress());await init();
 scene.dirty=true;await message(scene);
 failWrite=true;
 await press('저장');
 await saved();
 failWrite=false;
 assert.equal(tree.root.findAllByType('WebView').length,1,'a failed save never moves to the next cut');
 assert.ok(shown().some(t=>t.includes('변경 내용을 아직 저장하지 못했어요')),'the failure is shown with a retry');
 assert.ok(!shown().some(t=>t.includes('disk full')||t.includes('Error')),'without the raw error');
 assert.equal(loadStore().store.projects.find(x=>x.id===p.id).slots[4].done,undefined,'and nothing is marked finished on disk');
 assert.equal(tiles().find(t=>t.props.testID==='slot-5').props.accessibilityLabel,'슬롯 5 작업 중','the drawing is held, but the board does not claim a finished cut');
 assert.ok(shown().some(t=>t.includes('완성으로 표시하지 않았어요')),'and it says so');
 // Closing on a failed save must not close: the user has to keep seeing the work that is not on disk.
 scene.dirty=true;await message(scene);
 failWrite=true;
 await press('그리기 닫기');
 await saved();
 failWrite=false;
 assert.equal(tree.root.findAllByType('WebView').length,1,'a failed save never closes the painter either');
 await press('다시 저장');
 assert.equal(loadStore().store.projects.find(x=>x.id===p.id).slots[4].done,false,'retrying writes exactly the state that was held in memory');
 assert.ok(loadStore().store.projects.find(x=>x.id===p.id).slots[4].finalImage,'and the drawing that was held in memory reaches the disk');
 assert.equal(tree.root.findAll(n=>n.type==='Button'&&n.props.label==='다시 저장').length,0,'the retry banner goes away once the write lands');
 await press('그리기 닫기');await saved(false);
 await act(async()=>tree.unmount());

 // ── 여러 칸 한 번에(PRO): 무료는 들어가기 전에 안내, PRO 는 확인하기 전에는 아무것도 바뀌지 않는다 ──────
 {
  const board=loadStore().store, live=board.projects.at(-1);
  const source=live.slots.find(s=>s.finalImage);
  const preset={version:1,preset:'bounce',speed:.5,strength:.5,captionMoves:false};
  saveStore({...board,revision:board.revision+1,projects:board.projects.map(x=>x.id===live.id?{...x,slots:x.slots.map(s=>s.number===source.number?{...s,motion:preset}:s)}:x)});
  await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});await act(async()=>{});
  await openSet(live.projectName);
  assert.equal(labelled('움직임 일괄 적용').length,0,'the board no longer pins a batch row');
  const beforeBatch=JSON.stringify(loadStore().store);
  await press('세트 메뉴');
  const batchRow=labelled('움직임 한 번에 적용')[0];
  assert.ok(batchRow,'with a moving cut, the set menu offers it');
  assert.equal(batchRow.findAll(n=>n.type==='Text'&&String(n.children?.join(''))==='PRO').length,1,'marked PRO before it is used');
  await press('움직임 한 번에 적용');
  assert.equal(labelled('PRO 닫기').length,1,'a free user goes to PRO instead of a screen that blocks at the end');
  assert.equal(labelled('전체 선택').length,0,'the batch screen did not open');
  await press('PRO 닫기');
  assert.equal(JSON.stringify(loadStore().store),beforeBatch,'nothing changed');
  const withPro=loadStore().store;
  saveStore({...withPro,revision:withPro.revision+1,entitlement:{plan:'yearly',source:'store',verified:true,expiresAt:'2099-01-01T00:00:00.000Z'}});
  await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});await act(async()=>{});
  await openSet(live.projectName);
  const proBefore=JSON.stringify(loadStore().store);
  const startedWith=bakes.length;
  await press('세트 메뉴');
  await press('움직임 한 번에 적용');
  const pick=tree.root.findAll(n=>n.type==='Pressable'&&/^[0-9]+번 고르기$/.test(n.props.accessibilityLabel??''))[0];
  assert.ok(pick,'적용할 칸을 고를 수 있다');
  await act(async()=>pick.props.onPress());
  assert.equal(labelled('미리 만들어 보기').length,1,'만들어 보기 버튼이 나온다');
  assert.equal(JSON.stringify(loadStore().store),proBefore,'여기까지 저장된 것은 그대로다');
  await press('미리 만들어 보기');
  await act(async()=>{});
  assert.equal(bakes.length,startedWith+1,'숨은 캔버스에 딱 한 번 만들어 달라고 한다');
  assert.deepEqual(bakes.at(-1).motion,preset,'고른 설정 그대로 만들어 본다');
  assert.equal(JSON.stringify(loadStore().store),proBefore,'미리 만들어 본 뒤에도 저장된 작품은 그대로다');
  assert.equal(named('적용 전 미리보기').length,1,'만들어진 움직임이 화면에 보인다');
  assert.ok(shown().some(t=>t.includes('적용 전')),'아직 적용 전이라고 말한다');
  // ── 여기부터 45.29: **실제로 적용**까지 간다. 지금까지는 미리보기에서 멈춰 있었다. ─────────
  // 그림이 없는 칸을 일부러 섞는다 — 되는 칸만 되고, 안 되는 칸은 이유를 말해야 한다.
  {
   const before=loadStore().store, set=before.projects.find(p=>p.id===live.id);
   const empty=set.slots.find(x=>!x.work);
   assert.ok(empty,'그림이 없는 칸도 있다');
   await press('전체 선택');
   const bakedBefore=bakes.length;
   const applyRow=tree.root.findAll(n=>n.type==='Pressable'&&/^\d+칸에 적용$/.test(n.props.accessibilityLabel??''))[0];
   assert.ok(applyRow,'적용 버튼이 있다');
   await act(async()=>applyRow.props.onPress());
   await act(async()=>{});
   await act(async()=>{});
   const after=loadStore().store.projects.find(p=>p.id===live.id);
   // 화면이 '적용됨'이라고 적은 칸은 실제로 움직임과 파일을 갖는다.
   const applied=shown().filter(t=>/^\d+ · 적용됨$/.test(t)).map(t=>Number(t.split(' ')[0]));
   assert.ok(applied.length>=2,'여러 칸에 적용됐다: '+JSON.stringify(applied));
   assert.equal(bakes.length-bakedBefore,applied.length,'적용한 칸마다 한 번씩 실제로 만들었다');
   for(const n of applied){
    const slot=after.slots.find(x=>x.number===n);
    assert.deepEqual(slot.motion,preset,n+'번: 같은 움직임이 들어갔다');
    assert.ok(slot.motionImage&&slot.motionImage.path,n+'번: 움직이는 그림 파일이 생겼다');
   }
   const stillEmpty=after.slots.find(x=>x.number===empty.number);
   assert.equal(stillEmpty.motion,undefined,'그림이 없는 칸은 건드리지 않는다');
   assert.equal(stillEmpty.motionImage,undefined,'그림이 없는 칸에는 파일도 만들지 않는다');
   assert.ok(shown().some(t=>/칸에 같은 움직임을 적용했어요|칸에 적용했고/.test(t)),'몇 칸이 됐는지 말한다');
   // ── 앱을 완전히 끄고 다시 켠다. 적용한 결과가 그대로 살아 있어야 한다(자동저장이 아니라 **종료 후**다).
   await act(async()=>tree.unmount());
   await act(async()=>{tree=create(React.createElement(App));});
   await act(async()=>{});
   const restarted=loadStore().store.projects.find(p=>p.id===live.id);
   for(const n of applied){
    const slot=restarted.slots.find(x=>x.number===n);
    assert.deepEqual(slot.motion,preset,n+'번: 앱을 껐다 켜도 움직임이 그대로다');
    assert.ok(slot.motionImage&&slot.motionImage.path,n+'번: 앱을 껐다 켜도 파일이 그대로다');
   }
   assert.equal(labelled('새 세트 만들기').length,1,'껐다 켜면 홈으로 돌아온다');
   await openSet(live.projectName);
  }
  await press('뒤로');
  const off=loadStore().store;
  saveStore({...off,revision:off.revision+1,entitlement:undefined});
  await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});await act(async()=>{});
 }
 // ── 네 가지 내용 상태에서 화면이 무너지지 않는가 ──────────────────────────────────────────
 // 잘 그린 샘플 하나로 디자인을 통과시키지 않는다. 아무것도 없을 때, 낙서 하나일 때, 제각각일 때,
 // 다 찼을 때 — 같은 규칙이 지켜져야 한다: 썸네일 크기 고정, 추가 타일 하나, 안내 한 줄.
 {
  const base=loadStore().store, live=base.projects.at(-1);
  const shot=live.slots.find(x=>x.finalImage).finalImage;
  const fill=n=>({...live,slots:live.slots.map((x,i)=>i<n?{...x,finalImage:shot,done:true}:{...x,finalImage:undefined,motionImage:undefined,work:undefined,done:undefined})});
  const states=[['빈 상태',0],['낙서 하나',1],['제각각',7],['다 찬 세트',32]];
  for(const [label,count] of states){
   saveStore({...base,revision:loadStore().store.revision+1,projects:base.projects.map(x=>x.id===live.id?fill(count):x)});
   await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});await act(async()=>{});
   // 작업실: 썸네일은 몇 장이든 같은 크기다.
   const cardThumbs=tree.root.findAll(n=>n.type==='View'&&!!n.props.style&&n.props.style.width===52&&n.props.style.height===52);
   assert.ok(cardThumbs.every(n=>n.props.style.width===52),label+': 작업실 썸네일이 장수에 따라 커지지 않는다');
   // 45.42: 빈 칸 자리 표시는 「임티 라인」 brush 아이콘(SVG)이다.
   if(count===0)assert.ok(tree.root.findAll(n=>n.type==='Svg'&&n.props.testID==='icon-brush').length>=1,'빈 세트도 카드 모양을 지킨다');
   assert.equal(labelled('새 세트 만들기').length,1,label+': 새 세트는 언제나 한 자리에 있다');
   // 세트 화면: 추가 타일은 하나, 남은 칸은 한 줄로 말한다.
   await openSet(live.projectName);
   const addTiles=shown().filter(t=>t==='그림 추가').length;
   assert.ok(addTiles<=1,label+': 빈 칸마다 추가 버튼을 반복하지 않는다 ('+addTiles+'개)');
   assert.ok(!shown().some(t=>/칸이 아직 비어 있어요/.test(t)),label+': 격자가 이미 보여 주는 것을 문장으로 반복하지 않는다');
   assert.equal(tiles().length,32,label+': 칸 수는 언제나 32개다');
   // 45.43 S5: 다 찬 세트는 완성 카드 B 가 'N칸 완성!'으로 말한다(N = 이 세트의 칸 수).
   assert.ok(shown().some(t=>count===32?t==='32칸 완성!':t.startsWith(count+'개 완성')),label+': 완성 개수를 정확히 말한다');
   await press('뒤로');
  }
  // 검사에 쓴 상태를 되돌린다.
  saveStore({...base,revision:loadStore().store.revision+1});
  await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});await act(async()=>{});
 }

 // ── 부가 이미지: 기존 컷에서 만들고, 원본은 그대로 ────────────────────────────────────────
 // 아이콘(78×78)과 공유(600×166)는 이모티콘과 비율이 달라서 자동으로 늘리면 찌그러진다.
 // 그래서 사용자가 프레임 안에서 위치와 크기만 정하고, 원본 컷은 손대지 않는다.
 {
  const live = loadStore().store.projects.at(-1);
  await openSet(live.projectName);
  await press('내보내기');
  await press('부가 이미지 만들기');
  assert.ok(shown().some(t => t.includes('78×78')), '아이콘 규격을 말한다');
  const target = loadStore().store.projects.at(-1).slots.find(s => s.finalImage);
  const beforeCut = JSON.stringify(target);
  await press(target.number + '번으로 만들기');
  assert.equal(named('부가 이미지 미리보기').length, 1, '고른 그림이 프레임 안에 미리 보인다');
  // 크기·위치를 바꾼다.
  const sizeRow = tree.root.findAll(n => n.type === 'View' && n.props.accessibilityRole === 'adjustable' && n.props.accessibilityLabel === '크기')[0];
  assert.ok(sizeRow, '크기 조절이 있다');
  await act(async () => sizeRow.props.onLayout({ nativeEvent: { layout: { width: 100 } } }));
  await act(async () => sizeRow.props.onResponderGrant({ nativeEvent: { locationX: 100 } }));
  const started = composed.length;
  await press('이 모양으로 만들기');
  await act(async () => {});
  assert.equal(composed.length, started + 1, '숨은 캔버스에 한 번 그려 달라고 한다');
  assert.deepEqual(composed.at(-1).frame, { width: 78, height: 78 }, '아이콘 프레임 크기로 그린다');
  assert.equal(composed.at(-1).place.scale, 2, '화면에서 정한 크기가 그대로 전달된다');
  const saved = loadStore().store.projects.at(-1);
  assert.ok(saved.extras.icon, '아이콘이 세트에 붙는다');
  assert.equal(JSON.stringify(saved.slots.find(s => s.number === target.number)), beforeCut, '원본 칸은 한 글자도 바뀌지 않는다');

  // 공유 이미지는 다른 프레임이다.
  await press('공유 이미지');
  await press(target.number + '번으로 만들기');
  await press('이 모양으로 만들기');
  await act(async () => {});
  assert.deepEqual(composed.at(-1).frame, { width: 600, height: 166 }, '공유 이미지 프레임 크기로 그린다');
  assert.ok(loadStore().store.projects.at(-1).extras.share, '공유 이미지도 붙는다');

  // 대표 이미지는 만드는 게 아니라 고르는 것이다.
  await press('대표 이미지');
  await press(target.number + '번으로 만들기');
  const beforeCover = composed.length;
  await press('이 그림을 대표로');
  await act(async () => {});
  assert.equal(composed.length, beforeCover, '대표 이미지는 새 파일을 만들지 않는다');
  assert.equal(loadStore().store.projects.at(-1).extras.coverSlot, target.number, '고른 칸 번호만 기억한다');
  await press('뒤로');
  await press('뒤로');
 }

 // ── Touch targets, in dp, across the phone widths this app will meet ────────────────────────
 // React Native style units are density-independent pixels, so these numbers are the dp a device
 // would lay out. hitSlop counts: it is touch area even when it is not paint.
 const slop=h=>typeof h==='number'?{top:h,bottom:h,left:h,right:h}:(h??{});
 const hitArea=node=>{
  const st=styleOf(node), s=slop(node.props.hitSlop);
  const h=st.height??st.minHeight, w=st.width??st.minWidth;
  return {
   height:h===undefined?Infinity:h+(s.top??0)+(s.bottom??0),
   width:w===undefined?Infinity:w+(s.left??0)+(s.right??0),
  };
 };
 const smallest=node=>{const a=hitArea(node);return Math.min(a.height,a.width);};
 // The controls the canon calls 주요: reached constantly, so 48dp is the floor, not a target.
 const primary=['브러시','채우기','지우개','색','그리기','움직이기','내보내기','이어서 그리기','첫 칸 그리기','저장','그리기 닫기','뒤로','더보기','참고','레이어','문구'];
 const small=[];
 for(const width of [320,360,390,412]){
  viewport.width=width;
  await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});
  await press('새 세트 만들기');await press('만들기');await init();
  // The three brush options share one row; width and smoothing belong to that panel.
  assert.equal(labelled('선 보정').length,0,'기본 화면에는 독립 선 보정 줄이 없다');
  assert.equal(tree.root.findAll(n=>n.type==='View'&&n.props.testID==='선 종류').length,0,'선 종류 카드는 기본 화면에서 접혀 있다 at '+width+'dp');
  assert.ok(!shown().some(t=>t==='PRO'),'작업 화면 기본 상태에 PRO 표시가 없다 at '+width+'dp');
  // 45.39: 굵기와 불투명도는 캔버스 **위** 조절 줄 하나에 가로로 선다(왼쪽 세로 기둥은 캔버스를 작게 만들어 걷었다).
  //   조절하는 자리는 하나뿐이고, 지금 값은 이름 아래 한 곳에 적힌다.
  const sizer=()=>tree.root.findAll(n=>n.props.accessibilityRole==='adjustable'&&/굵기$/.test(n.props.accessibilityLabel??''))[0];
  assert.ok(sizer(),'굵기 조절대가 있다 at '+width+'dp');
  assert.equal(tree.root.findAll(n=>n.props.testID==='조절 줄').length,1,'조절 줄은 하나다 at '+width+'dp');
  assert.equal(tree.root.findAll(n=>n.props.testID==='조절대').length,0,'왼쪽 세로 기둥은 없다 at '+width+'dp');
  assert.equal(tree.root.findAll(n=>n.props.accessibilityRole==='adjustable'&&/굵기$/.test(n.props.accessibilityLabel??'')).length,1,'굵기를 바꾸는 자리는 하나뿐이다 at '+width+'dp');
  assert.equal(tree.root.findAll(n=>n.type==='View'&&n.props.testID==='굵기 점').length,1,'굵기 값 옆에 지금 굵기 점이 하나 at '+width+'dp');
  assert.ok(shown().includes('100%'),'불투명도 값이 조절 줄에 보인다 at '+width+'dp');
  assert.equal(tree.root.findAll(n=>n.props.testID==='굵기 미리보기').length,0,'캔버스 한가운데 검은 미리보기 상자는 없다 at '+width+'dp');
  assert.equal(tree.root.findAll(n=>n.props.testID==='굵기 띠').length,0,'캔버스 가장자리 굵기 띠도 없다 at '+width+'dp');
  // 손잡이는 레이아웃을 재기 전에도 비율 자리에 있다 — 처음 한 번 비어 보이지 않는다.
  assert.ok(styleOf(sizer().findAll(n=>n.type==='View'&&styleOf(n).borderRadius===12)[0]).left.endsWith('%'),'굵기 손잡이가 처음부터 비율 자리에 있다 at '+width+'dp');
  // 빠른 선택 줄: 카드 셋 + 전체 입구.
  const quick=tree.root.findAll(n=>n.props.testID==='빠른 브러시')[0];
  assert.ok(quick,'빠른 브러시 줄이 있다 at '+width+'dp');
  assert.deepEqual(quick.findAll(n=>n.type==='Pressable').map(n=>n.props.accessibilityLabel),['기본 펜','연필','마커','브러시 전체'],'처음에는 기본 펜·연필·마커 at '+width+'dp');
  // 전체 목록에서 고르면 빠른 줄의 한 자리가 바뀌고 목록은 닫힌다.
  await press('브러시 전체');
  assert.ok(tree.root.findAll(n=>n.props.testID==='브러시 목록').length===1,'전체 목록이 열린다');
  assert.equal(labelled('브러시 자연 잉크').length,1,'무료 10종이 목록에 있다');
  await press('브러시 자연 잉크');
  assert.equal(tree.root.findAll(n=>n.props.testID==='브러시 목록').length,0,'고르면 목록이 닫힌다 at '+width+'dp');
  assert.deepEqual(tree.root.findAll(n=>n.props.testID==='빠른 브러시')[0].findAll(n=>n.type==='Pressable'&&n.props.testID).map(n=>n.props.accessibilityLabel),['기본 펜','연필','마커'],'즐겨찾기는 고정이다 — 다른 브러시를 골라도 바뀌지 않는다');
  await press('연필');   // 45.31: 연필은 이제 제 프리셋(pencil2)이다 — 기본 브러시 셋이 아니다
  assert.equal(lastCommand('brushSettings').preset,'pencil2');
  assert.ok(labelled('그리기 도구 펜')[0].props.accessibilityState.selected,'그리기 도구(펜)가 그대로 골라져 있다');
  const targets=tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel&&!n.props.disabled);
  assert.ok(targets.length>10,'there is something to audit at '+width+'dp');
  for(const node of targets){
   const size=smallest(node), label=node.props.accessibilityLabel;
   assert.ok(size>=40,label+' is at least a 40dp target at '+width+'dp wide, got '+size);
   if(primary.includes(label))assert.ok(size>=48,label+' is a main control and must take a 48dp touch at '+width+'dp wide, got '+size);
   if(size<48&&size!==Infinity)small.push(label+' '+size+'dp');
  }
  // The painter header keeps its narrow arrows, so the slot number must still have room.
  const bar=tree.root.findAll(n=>n.type==='Pressable'&&['그리기 닫기','더보기'].includes(n.props.accessibilityLabel??''));
  const columns=bar.reduce((total,n)=>total+(styleOf(n).width??0),0);
  assert.ok(width-4-columns>=76,'the slot number keeps at least 76dp between the header buttons at '+width+'dp, got '+(width-4-columns));
  // The tool segment shares a row with the colour button: each tool needs room for its word.
  const dock=Math.min(width,412)-16-6*4;
  assert.ok(dock/5>=56,'each of the five tools keeps at least 56dp of width at '+width+'dp, got '+Math.round(dock/5));
  // The movement tab is the busiest panel in the app and it grows: presets, sliders, parts, and now
  // a shelf of kept movements. It is audited at the same widths, and the panel that covers the
  // drawing has to leave the drawing visible — a panel you cannot see past is not a preview.
  await press('움직이기');
  await press('통통');
  scene={...scene,motion:lastCommand('motion').motion,loop:.8,clipped:false};await message(scene);
  const panelTargets=tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel&&!n.props.disabled);
  for(const node of panelTargets){
   const size=smallest(node), label=node.props.accessibilityLabel;
   assert.ok(size>=40,'움직임 패널: '+label+' is at least a 40dp target at '+width+'dp, got '+size);
   if(size<48&&size!==Infinity)small.push('움직임 '+label+' '+size+'dp');
  }
  assert.ok(panelTargets.some(n=>n.props.accessibilityLabel==='보관한 움직임'),'the way into the shelf is audited at '+width+'dp');
  assert.ok(panelTargets.some(n=>n.props.accessibilityLabel==='부분만 움직이기'),'and so is the way into the PRO panel');
 // 상한(maxHeight)만으로는 부족하다. 패널 안이 ScrollView 라 고유 높이가 0이어서, 캔버스의
 // flex:1 이 남은 자리를 모두 가져가면 패널이 통째로 화면 밖으로 밀린다. Galaxy S23 실기기에서
 // 실제로 그렇게 되어 움직임을 고를 수 없었다. 그래서 높이를 못 박고 줄어들지 않게 한다.
 const panelBox=tree.root.findAll(n=>n.type==='View'&&typeof styleOf(n).height==='number'&&styleOf(n).flexShrink===0).map(n=>styleOf(n));
 assert.equal(panelBox.length,1,'움직임 패널의 높이가 하나로 못 박혀 있다: '+JSON.stringify(panelBox));
 assert.equal(panelBox[0].flexShrink,0,'그리고 줄어들지 않는다 — 줄어들면 화면 밖으로 밀린다');
 assert.ok(panelBox[0].height<=Math.round(844*.55),'큰 화면에서도 패널이 화면의 절반 남짓을 넘지 않는다: '+panelBox[0].height);
  await press('그리기');
  await press('그리기 닫기');await saved(false);
  // 보드: 격자가 먼저이고, 아래 고정 줄에는 지금 할 일만 있다. 아무것도 완성하지 않았으면 내보내기는 아직 없다.
  assert.equal(labelled('첫 칸 그리기').length,1,'an untouched set offers the first cut at '+width+'dp');
  assert.equal(labelled('내보내기').length,0,'and no export before anything is finished at '+width+'dp');
  assert.equal(labelled('움직임 일괄 적용').length+labelled('순서 바꾸기').length+labelled('제출 준비').length,0,'no rows pushing the grid down at '+width+'dp');
  assert.ok(smallest(labelled('첫 칸 그리기')[0])>=48,'the dock action is a 48dp target at '+width+'dp');
  const cell=styleOf(tiles()[0]).width;
  assert.ok(cell*3+8*2<=width-32+.01,'the board still fits three across at '+width+'dp');
  assert.ok(cell>=60,'and a cut thumbnail stays a comfortable target at '+width+'dp: '+cell);
  await press('첫 칸 그리기');await init();
  // The overflow menu used to run past the canvas on a short screen.
  const byTestID=id=>tree.root.findAll(n=>n.props.testID===id);
  await press('더보기');
  const menu=byTestID('더보기 메뉴')[0];
  assert.ok(menu,'the overflow menu is open');
  assert.ok(styleOf(menu).maxHeight,'it is bounded rather than running past the canvas on a short screen');
  assert.equal(menu.findAllByType('ScrollView').length,1,'and it scrolls, so the last row stays reachable');
  await press('더보기');

  // Panels and sheets open over the canvas, so sweep them too. These are recorded rather than
  // held to 48dp: closing a sheet or folding a hint away is not a control you reach for all day.
  if(false && width===320){
   const seen=new Map();
   const collect=()=>{for(const n of tree.root.findAll(x=>x.type==='Pressable'&&x.props.accessibilityLabel&&!x.props.disabled)){
    const size=smallest(n);if(size!==Infinity)seen.set(n.props.accessibilityLabel,Math.min(seen.get(n.props.accessibilityLabel)??Infinity,size));}};
   collect();
   await press('더보기');collect();await press('더보기');
   await press('색');collect();await press('직접 선택');collect();await press('팔레트');collect();await press('팔레트 닫기');
   await press('펜 굵기');collect();
   await act(async()=>tree.root.findAll(n=>n.type==='Pressable'&&String(n.props.accessibilityLabel||'').includes('굵기')&&String(n.props.accessibilityLabel||'').includes('닫기')).at(-1)?.props.onPress());
   await press('레이어');collect();await press('레이어');
   for(const [label,size] of seen)assert.ok(size>=28,label+' is never a sliver: '+size+'dp at 320dp wide');
   const under=[...seen].filter(([,size])=>size<48).map(([label,size])=>label+' '+size+'dp');
   console.log('  패널·시트까지 320dp 전수 조사 · 같은 이름이 여러 곳에 있으면 최솟값 · 48dp 미만: '+(under.length?under.join(', '):'없음'));
  }
  await press('그리기 닫기');await saved(false);
 }
 viewport.width=390;
 // Secondary controls only: folding a hint away, closing a sheet. Printed so the list stays a
 // decision rather than an accident.
 console.log('  48dp 미만(보조): '+(small.length?[...new Set(small)].join(', '):'없음'));

 // ── An unreadable store: say what is wrong, touch nothing, and come back when it is fixed ──
 // This is the screen a device reported. What matters is that the files survive it.
 await act(async()=>tree.unmount());
 const keptGood=files.get(localFile('store-a.json').uri)??files.get(localFile('store-b.json').uri);
 files.set(localFile('store-a.json').uri,'{ "version": 1, "revi');
 files.set(localFile('store-b.json').uri,JSON.stringify({version:1,revision:9,projects:[{id:'x'}]}));
 const onDisk=()=>[...files.entries()].map(([k,v])=>k+'='+String(v)).sort().join('|');
 const untouched=onDisk();
 await act(async()=>{tree=create(React.createElement(App));});
 const text=shown();
 assert.ok(text.some(t=>t.includes('저장 파일을 열지 못했어요')),'the screen says the store could not be opened');
 assert.ok(text.some(t=>t.includes('앱을 지우거나')),'and tells the user not to delete anything');
 assert.ok(!text.some(t=>/JSON|revision|store-a|Error/.test(t)),'no diagnostics or raw errors on a user screen');
 assert.equal(tree.root.findAll(n=>n.props.testID==='문의용 파일').length,0,'the support path is folded; the action (다시 불러오기) comes first');
 await press('문의용 파일 보내기');
 assert.equal(tree.root.findAll(n=>n.props.testID==='문의용 파일').length,1,'opening it offers the saved copies');
 assert.ok(!shown().some(t=>/JSON|revision|store-a|처음 /.test(t)),'still without technical text');
 assert.equal(onDisk(),untouched,'and opening that screen wrote nothing and deleted nothing');
 const sentBefore=shared.length;
 await press('저장 사본 1 보내기');
 await act(async()=>{});
 assert.equal(shared.length,sentBefore+1,'the damaged file can be handed over as it is');
 assert.ok(shared.at(-1).uri.endsWith('store-a.json'),'and it is that very file: '+shared.at(-1).uri);
 assert.equal(shared.at(-1).options.mimeType,'application/json');
 assert.equal(onDisk(),untouched,'handing it over changes nothing on disk');
 assert.equal(labelled('알림 닫기').length+tiles().length,0,'no set is invented out of an unreadable store');
 // Retrying while it is still broken is safe, and still writes nothing.
 await press('다시 불러오기');
 assert.equal(onDisk(),untouched,'retrying leaves the files exactly as they were');
 assert.ok(shown().some(t=>t.includes('저장 파일을 열지 못했어요')),'and reports the same thing again');
 // Put a readable snapshot back the way a repair would, and the app opens with the data intact.
 files.set(localFile('store-a.json').uri,keptGood);
 await press('다시 불러오기');
 assert.equal(tree.root.findAll(n=>n.props.testID==='문의용 파일').length,0,'the support path goes away once it can read again');
 assert.ok(loadStore().store.projects.length>0,'and the sets are back');
 assert.ok(shown().some(t=>t.includes('손상')),'with a word about the copy that is still damaged');
 assert.equal(files.get(localFile('store-b.json').uri)!==undefined,true,'the damaged copy is still on disk, not cleaned up');


// ── 노랑은 칠하는 색이지 글자색이 아니다 ───────────────────────────────────────────────────
// 흰 바탕 위의 #FFE234 글자는 대비가 1.3:1 이다. 읽히지 않는다. 그래서 규칙을 코드로 고정한다:
//   노랑은 backgroundColor / borderColor 에만 나온다. color 에는 절대 나오지 않는다.
// 이 검사는 화면을 그려 보는 대신 소스를 읽는다 — 어느 화면에서든, 앞으로 추가될 화면에서도 막힌다.
{
  const yellowish = /#FFE234|#F2D100|#FFF8CC|#FFD02F|#F2C322|#FFF2B6|accent\b|accentLine\b|\byellow\b/;
  const bad = [];
  for (const file of ['App.tsx', 'src/components/ui.tsx', 'src/painter/painter.tsx', 'src/painter/motion-panel.tsx']) {
    const lines = require('fs').readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // color: … 또는 color={…} 안에 노랑 계열이 있으면 안 된다. accentInk 는 '노랑 위의 차콜'이라 괜찮다.
      for (const m of line.matchAll(/\bcolor(?:: |=\{)([^,}\n]*)/g)) {
        const value = m[1].replace(/accentInk/g, '');
        if (yellowish.test(value)) bad.push(`${file}:${i + 1} ${line.trim().slice(0, 90)}`);
      }
    });
  }
  assert.deepEqual(bad, [], '노랑이 글자·아이콘 색으로 쓰인 자리가 없다:\n' + bad.join('\n'));

  // 노랑 위 글자는 한 가지 차콜로 고정한다. 자리마다 다른 갈색을 쓰면 역할이 흐려진다.
  // 45.34: 값이 #17191D → #202329, 노랑이 #FFD52A → #FFDA32 로 바뀌었다. 값을 글자로 박아 두면
  // 공통 기준을 손볼 때마다 여기가 막는다 — 지켜야 할 것은 '하나로 고정돼 있다'이지 특정 16진수가 아니다.
  const { T } = load('src/components/ui.tsx');
  assert.equal(T.accentInk, T.ink, '노랑 위 글자색이 짙은 ink 하나로 고정돼 있다');
  assert.equal(T.accent, T.yellow, '강조 노랑은 한 값이다');
  assert.notEqual(T.accent, T.accentSoft, '행동 노랑과 선택 배경은 다른 값이다');

  // PRO 는 행동 노랑과 다른 자리에 있어야 한다 — 누르는 곳처럼 보이면 안 된다.
  const app = require('fs').readFileSync('App.tsx', 'utf8');
  assert.ok(!/backgroundColor: C\.yellow \}\}><Text[^>]*>PRO</.test(app), 'PRO 표시가 행동 노랑을 쓰지 않는다');
  console.log('  노랑 글자 0곳 · 노랑 위 글자 #17191D 고정 · PRO 역할 분리');
}

 console.log('PASS: one-tap start into an empty canvas, two tabs over one drawing, free effects that reach the canvas, PRO parts announced before use (free users go to PRO first, never blocked at save), a movement kept on a shelf and taken back down without touching the cut, a piece kept as its own picture and brought back, movement order changed by dragging, a batch preview that builds one cut for real without writing anything, a batch apply that reaches every drawn cut and names the reason for the ones it skips, and survives a cold restart, empty canvas never counts as finished, 완성 declaration separate from autosave, autosave on backgrounding, one save per double tap, copy-previous as an independent document, captions saved with the drawing, temporary and adopted set references, re-edit returns a cut to 작업 중, board states, the last open cut returning to the board, export flow that only claims what it measured, share retry, legacy stores preserved and readable, guarded set deletion, save failure that never claims a completion, an unreadable store that names the cause and writes nothing. Native modules/WebView mocked; drawing and file delivery still require a device.');
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
