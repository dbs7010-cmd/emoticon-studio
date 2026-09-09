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
  delete() { if (!files.delete(this.uri)) throw new Error('missing ' + this.uri); }
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
saveStore({ version: 1, revision: 8, projects: [p, other] });
const png = Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(360,16);png.writeUInt32BE(360,20);
files.set(localFile('image-old.png').uri,png); files.set(localFile('image-new.png').uri,png);
otherPaths.forEach(path => files.set(localFile(path).uri, png));

let tree, scene;
const press = async label => { let matches=tree.root.findAll(n=>(n.type==='Pressable'&&n.props.accessibilityLabel===label)||(n.type==='Button'&&n.props.label===label));if(label==='닫기')matches=matches.slice(-1);assert.equal(matches.length,1,'button '+label);assert.ok(!matches[0].props.disabled,'enabled '+label);await act(async()=>matches[0].props.onPress()); };
const tiles=()=>tree.root.findAll(n=>n.type==='Pressable'&&/^slot-\d+$/.test(n.props.testID));
const message=async m=>{await act(async()=>tree.root.findByType('WebView').props.onMessage({nativeEvent:{data:JSON.stringify(m)}}));};
const sent=()=>commands.map(s=>JSON.parse(s.slice(s.indexOf('(')+1,s.lastIndexOf(');true;'))));
const lastCommand=type=>sent().filter(m=>m.type===type).at(-1);
const lastSent=()=>sent().at(-1);
const init=async()=>{
 await message({type:'ready'});const m=lastCommand('init');assert.equal(m.layers.length,2);
 scene={type:'state',undo:false,redo:false,dirty:false,activeLayerId:m.activeLayerId||'draw-1',activeReferenceId:null,layers:m.layers,references:m.references};
 await message(scene);await message({type:'initialized'});return m;
};
const publicLayer=l=>Object.fromEntries(['id','name','visible','opacity','x','y','scale','rotation'].map(k=>[k,l[k]]));
const saved=async(dirty=true)=>{
 await message({type:'save',dirty,data:'data:image/png;base64,'+png.toString('base64'),metrics,activeLayerId:scene.activeLayerId,layers:scene.layers.map(l=>({...publicLayer(l),data:'data:image/png;base64,'+png.toString('base64')})),references:scene.references.map(l=>({...publicLayer(l),path:l.path}))});
};
(async()=>{
 await act(async()=>{tree=create(React.createElement(App));});
 assert.equal(tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='새 이모티콘 세트').length,1,'home uses compact new-set action');
 await press('이전 프로젝트');
 assert.equal(tiles().length,32);assert.equal(tiles()[0].findAllByType('Image').length,1);
 for(let n=1;n<=32;n++){
  await act(async()=>tiles().find(t=>t.props.testID==='slot-'+n).props.onPress());
  assert.equal(tree.root.findAllByType('WebView').length,1,'direct painter '+n);await init();
  await press('홈');await saved(false);
 }
 assert.deepEqual(loadStore().store.projects[0],p,'opening untouched slots does not create results or change old metadata');
 await act(async()=>tiles()[0].props.onPress());await init();
 assert.equal(tree.root.findAll(n=>n.type==='Text'&&n.props.accessibilityLabel==='현재 칸').length,1,'painter header shows slot progress only');
 assert.equal(tree.root.findAll(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='현재 칸 대사').length,0,'dialogue editing stays out of painter');
 const dialogue=p.slots[0].dialogue;
 pendingPicks=[{...image,path:'image-r2.png'},{...image,path:'image-r3.png'}];pendingPicks.forEach(i=>files.set(localFile(i.path).uri,png));
 await press('참고 추가');
 const added=lastCommand('addReferences').references;assert.equal(added.length,2);
 scene.references.push(...added);await message(scene);
 assert.ok(loadStore().store.projects[0].slots.every(s=>s.referenceImages.length===3),'new references are shared across every slot');
 assert.ok(tree.root.findAll(n=>n.type==='Text'&&String(n.children?.join(''))==='따라 그릴 참고').length>0,'reference strip is labelled in plain Korean');
 const thumb=tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='참고 1 선택');
 assert.equal(thumb.length,1,'reference thumbnail selects');assert.equal(thumb[0].props.onLongPress,undefined,'quick controls never require a long press');
 await press('참고 1 선택');
 assert.deepEqual(lastSent(),{type:'setActiveReference',id:scene.references[0].id},'tapping a thumbnail only selects, it never toggles visibility');
 await press('참고 1 숨기기');
 assert.deepEqual(lastSent(),{type:'toggleReference',id:scene.references[0].id},'the eye is the only visibility control');
 scene.activeReferenceId=scene.references[0].id;await message(scene);
 const fade=tree.root.findAll(n=>n.props.testID==='참고 진하기');assert.equal(fade.length,1,'selected reference exposes a quick fade control');
 await act(async()=>fade[0].findByType('Slider').props.onValueChange(.6));
 assert.equal(lastCommand('transform').id,scene.references[0].id);assert.equal(lastCommand('transform').opacity,.6,'fade drives reference opacity');
 assert.equal(tree.root.findAll(n=>n.type==='Text'&&String(n.children?.join('')).includes('참고 조정 중')).length>0,true,'active reference exposes transform mode');
 await press('그림 겹치기');
 const shown=()=>tree.root.findAll(n=>n.type==='Text').map(n=>String(n.children?.join('')));
 assert.ok(shown().some(t=>t==='내 그림'),'rail groups drawings under 내 그림');
 assert.ok(shown().filter(t=>t==='따라 그릴 참고').length>=2,'rail groups references under 따라 그릴 참고');
 assert.ok(!shown().some(t=>/레이어|layer|reference|canon/i.test(t)),'painter shows no layer jargon');
 assert.equal(tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='그림 1 숨기기').length,1,'each drawing carries its own eye toggle');
 await press('그림 2 선택');assert.equal(lastCommand('select').id,'draw-2');scene.activeLayerId='draw-2';await message(scene);
 const drawFade=tree.root.findAll(n=>n.props.testID==='그림 2 진하기');assert.equal(drawFade.length,1,'only the selected drawing expands its fade');
 assert.equal(tree.root.findAll(n=>n.props.testID==='그림 1 진하기').length,0,'unselected items stay collapsed');
 await press('그림 겹치기');
 await press('마커');assert.equal(lastCommand('brush').brush,'marker');
 const labelled=label=>tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel===label).length;
 await press('지우개');
 assert.equal(labelled('지우개 크기 늘리기'),1,'eraser renames the shared width control');assert.equal(labelled('펜 굵기 늘리기'),0);
 assert.equal(labelled('연필'),0,'brush choices are not siblings of the eraser');
 await press('지우개 크기 늘리기');assert.equal(lastCommand('width').tool,'eraser');assert.equal(lastCommand('width').width,22);
 await press('펜');
 assert.equal(labelled('펜 굵기 늘리기'),1,'pen renames the same control back');assert.equal(labelled('지우개 크기 늘리기'),0);
 assert.equal(labelled('연필'),1,'brush choices belong to the pen');
 await press('펜 굵기 늘리기');assert.equal(lastCommand('width').tool,'pen');assert.equal(lastCommand('width').width,7);
 await press('저장');await saved();assert.equal(tree.root.findAllByType('WebView').length,1,'save stays in Painter');
 let after=loadStore().store.projects[0];assert.equal(after.slots[0].work.layers.length,2);assert.equal(after.slots[0].work.references.length,3);assert.equal(after.slots[0].dialogue,dialogue);
 for(const key of ['emotion','situation','expressionGuide','poseGuide','compositionGuide','effectGuide','textPlacementGuide','notes'])assert.equal(after.slots[0][key],p.slots[0][key]);
 assert.deepEqual(after.canon,p.canon);
 const finalPath=after.slots[0].finalImage.path;assert.ok(files.has(localFile(finalPath).uri));
 assert.ok(tiles()[0].findByType('Image').props.source.uri.endsWith(finalPath),'thumbnail reflects export');
 await press('저장 후 다음 칸');await saved();const next=await init();assert.equal(next.layers[0].data,undefined);assert.equal(next.references.length,3,'shared references stay under the next slot canvas');
 await press('이전 칸');await saved(false);const reopened=await init();assert.equal(reopened.activeLayerId,'draw-2');
 await press('홈');await saved(false);assert.equal(tree.root.findAllByType('WebView').length,0);
 const persisted=loadStore().store;
 await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});await press('이전 프로젝트');await act(async()=>tiles()[0].props.onPress());const restored=await init();
 assert.equal(restored.layers.length,2);assert.equal(restored.references.length,3);assert.deepEqual(loadStore().store,persisted,'restart reads same work and metadata');
 await act(async()=>tree.unmount());

 // Set deletion: reachable from the card menu, never immediate, and scoped to one project.
 await act(async()=>{tree=create(React.createElement(App));});
 assert.equal(tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='다른 프로젝트 관리').length,1,'each set card carries a quiet management entry');
 assert.equal(tree.root.findAll(n=>n.type==='Button'&&n.props.label==='세트 삭제').length,0,'delete is never exposed on the card itself');
 await press('다른 프로젝트 관리');
 await press('세트 삭제');
 assert.ok(loadStore().store.projects.some(x=>x.id===other.id),'choosing delete only opens the confirmation');
 const confirm=tree.root.findAll(n=>n.type==='Text').map(n=>String(n.children?.join('')));
 assert.ok(confirm.some(t=>t==='다른 프로젝트'),'confirmation names the set');
 assert.ok(confirm.some(t=>t.includes('1 / 32')),'confirmation shows progress');
 assert.ok(confirm.some(t=>t.includes('되돌릴 수 없')),'confirmation warns the delete is permanent');
 await press('이 세트 삭제');
 const left=loadStore().store;
 assert.equal(left.projects.length,1,'the deleted set is gone from storage');
 assert.equal(left.projects[0].id,p.id,'the other set survives');
 assert.deepEqual(left.projects[0],persisted.projects[0],'the surviving set keeps every slot and image');
 for(const path of otherPaths)assert.equal(files.has(localFile(path).uri),false,'deleted set leaves no orphan image: '+path);
 for(const path of ['image-old.png','image-r2.png','image-r3.png'])assert.equal(files.has(localFile(path).uri),true,'other set keeps its images: '+path);
 for(const name of ['store-a.json','store-b.json'])assert.equal(files.has(localFile(name).uri),true,'store snapshots are never deleted: '+name);
 assert.equal(tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='다른 프로젝트').length,0,'home drops the card immediately');
 await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});
 assert.equal(tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='다른 프로젝트').length,0,'a restart does not bring the deleted set back');
 await act(async()=>tree.unmount());

 console.log('PASS: workshop home, 32 direct Painter entries, painter-only slot progress, project-wide references, plain-Korean 내 그림/따라 그릴 참고 groups with per-item eyes, reference select separated from visibility, quick fade without long press, pen/eraser segment with one context-renamed width control, layered persistence, export thumbnail, save-next flow, restart, old data compatibility, guarded set deletion scoped to one project. Native modules/WebView mocked; touch gestures require device test.');
})().catch(e=>{console.error(e);process.exitCode=1;});
