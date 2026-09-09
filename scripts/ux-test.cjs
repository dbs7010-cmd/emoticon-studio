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
  write(data, options) { files.set(this.uri, options?.encoding === 'base64' ? Buffer.from(data,'base64') : data); }
  textSync() { return files.get(this.uri); }
  bytesSync() { return new Uint8Array(files.get(this.uri)); }
}
const commands = [];
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
let pendingPicks = [];
const images = { dataUrl: async () => 'data:image/png;base64,test', pickImages: async () => pendingPicks, savePainterWork: (...args) => persistPainter(...args) };
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n]));
Object.assign(rn, { StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), BackHandler: { addEventListener: () => ({ remove() {} }) }, Alert: { alert() {} }, Linking: { openURL: async () => {} } });
const load = loader({
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView' },
  'expo-image-picker': {}, 'expo-image-manipulator': {},
  'expo-status-bar': { StatusBar: 'StatusBar' }, 'expo-sharing': {}, 'react-native-webview': { WebView },
  'expo-file-system': { Directory, File, Paths: { document: 'document' } },
  './src/services/images': images, '../services/images': images,
  './src/components/image-analyzer': { ImageAnalyzer: () => null },
});
const { createProject } = load('src/project.ts');
const { loadStore, saveStore, localFile } = load('src/services/storage.ts');
const persistPainter = load('src/services/images.ts').savePainterWork;
const App = load('App.tsx').default;
const metrics = { coverage: .2, centerX: .5, centerY: .5, width: .5, height: .5, color: [.2,.2,.2], transparent: true };
const image = { path: 'old.png', width: 360, height: 360, metrics };
const p = createProject('이전 프로젝트', '콩이');
p.canon = { image, personality: '성격 유지', speech: '말투 유지', locked: '둥근 눈', variable: '소품' };
p.slots = p.slots.map(s => ({ ...s, dialogue: '대사 ' + s.number, emotion: '감정 유지', situation: '상황 유지', expressionGuide: '표정 유지', poseGuide: '포즈 유지', compositionGuide: '구도 유지', effectGuide: '효과 유지', textPlacementGuide: '텍스트 유지', notes: '메모 유지', referenceImages: [image], status: 'PLANNED' }));
p.slots[0].finalImage = image; p.slots[0].status = 'REVIEW';
saveStore({ version: 1, revision: 8, projects: [p] });
const png = Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(360,16);png.writeUInt32BE(360,20);
files.set(localFile('old.png').uri,png); files.set(localFile('new.png').uri,png);

let tree, scene;
const press = async label => { let matches=tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel===label||n.type==='Button'&&n.props.label===label);if(label==='닫기')matches=matches.slice(-1);assert.equal(matches.length,1,'button '+label);assert.ok(!matches[0].props.disabled,'enabled '+label);await act(async()=>matches[0].props.onPress()); };
const longPress = async label => { const matches=tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel===label);assert.equal(matches.length,1,'long press '+label);assert.equal(typeof matches[0].props.onLongPress,'function');await act(async()=>matches[0].props.onLongPress()); };
const tiles=()=>tree.root.findAll(n=>n.type==='Pressable'&&/^slot-\d+$/.test(n.props.testID));
const message=async m=>{await act(async()=>tree.root.findByType('WebView').props.onMessage({nativeEvent:{data:JSON.stringify(m)}}));};
const lastCommand=type=>commands.map(s=>JSON.parse(s.slice(s.indexOf('(')+1,s.lastIndexOf(');true;')))).filter(m=>m.type===type).at(-1);
const init=async()=>{
 await message({type:'ready'});const m=lastCommand('init');assert.equal(m.layers.length,2);
 scene={type:'state',undo:false,redo:false,dirty:false,activeLayerId:m.activeLayerId||'draw-1',layers:m.layers,references:m.references};
 await message(scene);await message({type:'initialized'});return m;
};
const publicLayer=l=>Object.fromEntries(['id','name','visible','opacity','x','y','scale','rotation'].map(k=>[k,l[k]]));
const saved=async(dirty=true)=>{
 await message({type:'save',dirty,data:'data:image/png;base64,'+png.toString('base64'),metrics,activeLayerId:scene.activeLayerId,layers:scene.layers.map(l=>({...publicLayer(l),data:'data:image/png;base64,'+png.toString('base64')})),references:scene.references.map(l=>({...publicLayer(l),path:l.path}))});
};
(async()=>{
 await act(async()=>{tree=create(React.createElement(App));});await press('이전 프로젝트');
 assert.equal(tiles().length,32);assert.equal(tiles()[0].findAllByType('Image').length,1);
 for(let n=1;n<=32;n++){
  await act(async()=>tiles().find(t=>t.props.testID==='slot-'+n).props.onPress());
  assert.equal(tree.root.findAllByType('WebView').length,1,'direct painter '+n);await init();
  await press('홈');await saved(false);
 }
 assert.deepEqual(loadStore().store.projects[0],p,'opening untouched slots does not create results or change old metadata');
 await act(async()=>tiles()[0].props.onPress());await init();
 const dialogue=tree.root.findAll(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='대사')[0].props.value;assert.equal(dialogue,'대사 1');
 pendingPicks=[{...image,path:'r2.png'},{...image,path:'r3.png'}];pendingPicks.forEach(i=>files.set(localFile(i.path).uri,png));
 await press('레퍼런스 추가');
 const added=lastCommand('addReferences').references;assert.equal(added.length,2);
 scene.references.push(...added);await message(scene);
 assert.ok(loadStore().store.projects[0].slots.every(s=>s.referenceImages.length===3),'new references are shared across every slot');
 await press('레퍼런스 1 켜짐');assert.equal(lastCommand('soloReference').id,scene.references[0].id);
 await longPress('레퍼런스 1 켜짐');assert.equal(lastCommand('tool').tool,'move');
 await press('레이어');await press('선택 그림 2');scene.activeLayerId='draw-2';await message(scene);await press('패널 닫기');
 await press('마커');assert.equal(lastCommand('brush').brush,'marker');
 await press('지우개');await press('굵기 늘리기');assert.equal(lastCommand('width').tool,'eraser');assert.equal(lastCommand('width').width,22);
 await press('펜');await press('굵기 늘리기');assert.equal(lastCommand('width').tool,'pen');assert.equal(lastCommand('width').width,7);
 await press('저장');await saved();assert.equal(tree.root.findAllByType('WebView').length,1,'save stays in Painter');
 let after=loadStore().store.projects[0];assert.equal(after.slots[0].work.layers.length,2);assert.equal(after.slots[0].work.references.length,3);assert.equal(after.slots[0].dialogue,dialogue);
 for(const key of ['emotion','situation','expressionGuide','poseGuide','compositionGuide','effectGuide','textPlacementGuide','notes'])assert.equal(after.slots[0][key],p.slots[0][key]);
 assert.deepEqual(after.canon,p.canon);
 const finalPath=after.slots[0].finalImage.path;assert.ok(files.has(localFile(finalPath).uri));
 assert.ok(tiles()[0].findByType('Image').props.source.uri.endsWith(finalPath),'thumbnail reflects export');
 await press('저장 후 다음 슬롯');await saved();const next=await init();assert.equal(next.layers[0].data,undefined);assert.equal(next.references.length,3,'shared references stay under the next slot canvas');
 await press('이전 슬롯');await saved(false);const reopened=await init();assert.equal(reopened.activeLayerId,'draw-2');
 await press('홈');await saved(false);assert.equal(tree.root.findAllByType('WebView').length,0);
 const persisted=loadStore().store;
 await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});await press('이전 프로젝트');await act(async()=>tiles()[0].props.onPress());const restored=await init();
 assert.equal(restored.layers.length,2);assert.equal(restored.references.length,3);assert.deepEqual(loadStore().store,persisted,'restart reads same work and metadata');
 await act(async()=>tree.unmount());
 console.log('PASS: 32 direct Painter entries, project-wide references, Korean layer workflow, independent brush/eraser widths, layered persistence, export thumbnail, save-next continuous flow, restart, old data compatibility. Native modules/WebView mocked; engine touch gestures require device test.');
})().catch(e=>{console.error(e);process.exitCode=1;});
