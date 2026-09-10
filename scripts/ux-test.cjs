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
const appState = [];
const shared = [];
const WebView = React.forwardRef((props, ref) => { React.useImperativeHandle(ref, () => ({ injectJavaScript: s => commands.push(s) })); return React.createElement('WebView', props); });
let pendingPicks = [];
const images = { dataUrl: async () => 'data:image/png;base64,test', pickImages: async () => pendingPicks, savePainterWork: (...args) => persistPainter(...args) };
const rn = Object.fromEntries(['View', 'Text', 'TextInput', 'Pressable', 'ScrollView', 'KeyboardAvoidingView', 'Image', 'Modal'].map(n => [n, n]));
Object.assign(rn, { StyleSheet: { create: x => x }, Platform: { OS: 'android' }, useWindowDimensions: () => ({ width: 390, height: 844 }), BackHandler: { addEventListener: () => ({ remove() {} }) }, AppState: { addEventListener: (_t, fn) => { appState.push(fn); return { remove() {} }; } }, Alert: { alert() {} }, Linking: { openURL: async () => {} } });
const load = loader({
  'react-native': rn, '@expo/ui': { Host: 'Host', Button: 'Button', Slider: 'Slider' },
  'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider', SafeAreaView: 'SafeAreaView' },
  'expo-image-picker': {}, 'expo-image-manipulator': {},
  'expo-status-bar': { StatusBar: 'StatusBar' }, 'react-native-webview': { WebView },
  'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async (uri, options) => { shared.push({ uri, options }); } },
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
 const flat=node=>Object.assign({},...[node.props.style].flat(9).filter(Boolean));
 const fitsFourAcross=(cellWidth,label)=>{
  const pad=16,gap=8; // styles.page padding and the grid gap
  assert.ok(cellWidth*4+gap*3<=390-pad*2+.01,label+' must fit four across a 390pt screen, got '+cellWidth);
  assert.ok(cellWidth*5+gap*4>390-pad*2,label+' should not be so small that five would fit');
 };
 fitsFourAcross(flat(tiles()[0]).width,'slot tile');
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
 const shown=()=>tree.root.findAll(n=>n.type==='Text').map(n=>String(n.children?.join('')));
 const labelled=label=>tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel===label);
 const box=label=>Object.assign({},...[labelled(label)[0].props.style].flat(9).filter(Boolean));
 assert.ok(shown().some(t=>t.includes('따라 그릴')),'reference strip is labelled in plain Korean');
 const thumb=labelled('참고 1 선택');
 assert.equal(thumb.length,1,'reference thumbnail selects');assert.equal(thumb[0].props.onLongPress,undefined,'quick controls never require a long press');
 await press('참고 1 선택');
 assert.deepEqual(lastSent(),{type:'setActiveReference',id:scene.references[0].id},'tapping a thumbnail only selects, it never toggles visibility');
 scene.activeReferenceId=scene.references[0].id;await message(scene);
 await press('참고 숨기기');
 assert.deepEqual(lastSent(),{type:'toggleReference',id:scene.references[0].id},'the eye is the only visibility control');
 const fade=tree.root.findAll(n=>n.props.testID==='참고 진하기');assert.equal(fade.length,1,'selected reference exposes a quick fade control');
 await act(async()=>fade[0].findByType('Slider').props.onValueChange(.6));
 assert.equal(lastCommand('transform').id,scene.references[0].id);assert.equal(lastCommand('transform').opacity,.6,'fade drives reference opacity');
 assert.equal(labelled('위치 초기화').length,0,'secondary reference actions stay tucked away');
 await press('참고 관리');
 assert.equal(labelled('위치 초기화').length,1,'the overflow reveals them on demand');
 await press('참고 관리');
 await press('그림 겹치기');
 assert.ok(shown().some(t=>t==='내 그림'),'the rail is titled 내 그림');
 assert.equal(labelled('참고 1 보이기').length+labelled('참고 1 숨기기').length,0,'references are not managed twice');
 assert.ok(!shown().some(t=>/레이어|layer|reference|canon/i.test(t)),'painter shows no layer jargon');
 assert.equal(labelled('그림 1 숨기기').length,1,'each drawing carries its own eye toggle');
 for(const label of ['그림 1 선택','그림 1 숨기기'])assert.ok((box(label).minHeight??box(label).height)>=44,'finger sized target: '+label);
 await press('그림 추가');assert.equal(lastCommand('addLayer').id,'draw-3','a third drawing can be added');
 await press('그림 2 선택');assert.equal(lastCommand('select').id,'draw-2');scene.activeLayerId='draw-2';await message(scene);
 assert.equal(tree.root.findAll(n=>n.props.testID==='그림 2 진하기').length,0,'drawings have no fade control to set wrong before export');
 await press('그림 겹치기');
 for(const label of ['펜','채우기','지우개'])assert.ok((box(label).minHeight??box(label).height)>=42,'finger sized tool: '+label);
 assert.equal(labelled('연필').length,0,'brush choices never sit beside the eraser');
 await press('색 선택');
 assert.equal(labelled('연필').length,0,'the colour sheet carries colours only');
 assert.equal(labelled('색 #54A9E8').length,1,'and any palette colour is one tap away');
 await press('색 #54A9E8');
 assert.equal(lastCommand('color').color,'#54A9E8');
 assert.deepEqual(loadStore().store.palette,['#54A9E8'],'recent colours are remembered');
 await press('색 닫기');
 // Brush type is the pen's own option: tap the already active pen to reach it.
 const toolSwitches=()=>sent().filter(m=>m.type==='tool').length;
 const beforeOpen=toolSwitches();
 await press('펜');
 assert.equal(labelled('연필').length,1,'tapping the active pen opens its brush options');
 assert.equal(toolSwitches(),beforeOpen,'and it does not re-send a tool switch to do so');
 await press('마커');assert.equal(lastCommand('brush').brush,'marker');assert.equal(lastCommand('tool').tool,'pen','choosing a brush returns to the pen');
 assert.equal(labelled('연필').length,0,'and the options close again');
 for(const gone of ['펜 굵기 늘리기','펜 굵기 줄이기','지우개 크기 늘리기','지우개 크기 줄이기'])assert.equal(labelled(gone).length,0,'size is a slider, not a stepper: '+gone);
 assert.ok(!load('src/painter/canvas-html.ts').canvasHtml.includes('체크 무늬'),'no permanent caption is painted over the canvas');
 const sizeSlider=name=>tree.root.findAll(n=>n.props.testID===name);
 assert.equal(sizeSlider('펜 굵기').length,1,'pen size is a draggable slider');
 await act(async()=>sizeSlider('펜 굵기')[0].findByType('Slider').props.onValueChange(19));
 assert.equal(lastCommand('width').tool,'pen');assert.equal(lastCommand('width').width,19);
 await press('지우개');
 assert.equal(sizeSlider('펜 굵기').length,0);assert.equal(sizeSlider('지우개 크기').length,1,'the same control is renamed for the eraser');
 await act(async()=>sizeSlider('지우개 크기')[0].findByType('Slider').props.onValueChange(31));
 assert.equal(lastCommand('width').tool,'eraser');assert.equal(lastCommand('width').width,31);
 await press('채우기');assert.equal(lastCommand('tool').tool,'fill','fill is a first-class tool');
 assert.equal(sizeSlider('지우개 크기').length+sizeSlider('펜 굵기').length,0,'fill needs no size, so the row disappears');
 await press('펜');
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
 // Autosave: work reaches disk when the app leaves the foreground, without a save button.
 await act(async()=>tiles()[0].props.onPress());await init();
 scene.dirty=true;await message(scene);
 const beforeAutosave=sent().filter(m=>m.type==='save').length;
 await act(async()=>{appState.forEach(fn=>fn('background'));});
 assert.equal(sent().filter(m=>m.type==='save').length,beforeAutosave+1,'leaving the foreground saves unsaved work');
 await saved();
 assert.equal(loadStore().store.projects[0].lastSlot,1,'a save records where the user was working');
 await press('홈');await saved(false);

 // Set planning: dialogue, no-dialogue, guides and reference choice, all before Painter.
 await press('세트 기획');
 assert.equal(tree.root.findAll(n=>n.type==='Text'&&String(n.children?.join(''))==='세트 기획').length,1,'the screen is named once, in the app bar only');
 const planningRow=label=>Object.assign({},...[tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel===label)[0].props.style].flat(9).filter(Boolean));
 const rowHeight=planningRow('02번 칸 기획').minHeight;
 assert.ok(rowHeight>=48&&rowHeight<=64,'a collapsed planning row is a list row, not a card: '+rowHeight);
 assert.equal(tree.root.findAll(n=>n.type==='TextInput').length,0,'rows stay collapsed until opened');
 await press('02번 칸 기획');
 assert.ok(tree.root.findAll(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='대사').length===1,'opening a row reveals its fields in place');
 await act(async()=>tree.root.findAll(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='감정')[0].props.onChangeText('반가움'));
 assert.equal(loadStore().store.projects[0].slots[1].emotion,'반가움','planning persists as you type');
 await press('02번 무대사');
 assert.equal(loadStore().store.projects[0].slots[1].noDialogue,true,'a slot can be planned with no dialogue');
 assert.equal(tree.root.findAll(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='대사').length,0,'no-dialogue hides the dialogue field');
 assert.equal(loadStore().store.projects[0].slots[1].dialogue,p.slots[1].dialogue,'the original dialogue text is kept, not destroyed');
 await press('02번 참고 2');
 const chosen=loadStore().store.projects[0].slots[1].referenceKey;
 assert.equal(chosen,loadStore().store.projects[0].slots[1].referenceImages[1].path,'a reference can be assigned per slot');
 await act(async()=>tree.root.findAll(n=>n.type==='TextInput'&&n.props.accessibilityLabel==='감정')[0].props.onChangeText('감정 유지'));
 assert.ok(tree.root.findAll(n=>n.type==='Text').some(n=>String(n.children?.join('')).includes('치우쳐')),'a lopsided emotion mix is flagged locally');

 // Planning feeds Painter: the assigned reference is the one already switched on.
 await press('이 칸 그리기');
 assert.equal(tree.root.findAllByType('WebView').length,1,'planning leads straight into Painter');
 await message({type:'ready'});
 const planned=lastCommand('init');
 assert.equal(planned.references.find(r=>r.path===chosen).visible,true,'the planned reference is on');
 assert.equal(planned.references.filter(r=>r.visible).length,1,'only the planned one is on');
 scene={type:'state',undo:false,redo:false,dirty:false,activeLayerId:'draw-1',activeReferenceId:null,layers:planned.layers,references:planned.references};
 await message(scene);await message({type:'initialized'});
 await press('홈');await saved(false);

 // Final preview and export.
 await press('전체 보기');
 const previewCells=tree.root.findAll(n=>n.type==='Pressable'&&/^preview-\d+$/.test(n.props.testID));
 assert.equal(previewCells.length,32,'the whole set is visible at once');
 fitsFourAcross(Object.assign({},...[previewCells[0].props.style].flat(9).filter(Boolean)).width,'preview cell');
 assert.equal(tree.root.findAll(n=>n.type==='Text'&&String(n.children?.join(''))==='전체 보기').length,1,'the screen is named once, in the app bar only');
 assert.ok(tree.root.findAll(n=>n.type==='Text').some(n=>String(n.children?.join('')).includes('칸이 아직 비어 있어요')),'QA reports the missing slots');
 assert.ok(tree.root.findAll(n=>n.type==='Text').some(n=>String(n.children?.join('')).includes('승인을 보장하지 않')),'QA never promises platform approval');
 await press('제출용 PNG 세트 내보내기');
 await act(async()=>{});
 assert.equal(shared.length,1,'the set is handed to the share sheet');
 assert.ok(shared[0].uri.endsWith('.zip'),'export produces a single bundle');
 assert.equal(shared[0].options.mimeType,'application/zip');
 await press('뒤로');

 await act(async()=>tree.unmount());

 // Set deletion: reachable from the card menu, never immediate, and scoped to one project.
 await act(async()=>{tree=create(React.createElement(App));});
 assert.equal(tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='다른 프로젝트 관리').length,1,'each set card carries a quiet management entry');
 assert.equal(tree.root.findAll(n=>n.type==='Button'&&n.props.label==='세트 삭제').length,0,'delete is never exposed on the card itself');
 const survivor=loadStore().store.projects.find(x=>x.id===p.id);
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
 assert.deepEqual(left.projects[0],survivor,'the surviving set keeps every slot and image');
 for(const path of otherPaths)assert.equal(files.has(localFile(path).uri),false,'deleted set leaves no orphan image: '+path);
 for(const path of ['image-old.png','image-r2.png','image-r3.png'])assert.equal(files.has(localFile(path).uri),true,'other set keeps its images: '+path);
 for(const name of ['store-a.json','store-b.json'])assert.equal(files.has(localFile(name).uri),true,'store snapshots are never deleted: '+name);
 assert.equal(tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='다른 프로젝트').length,0,'home drops the card immediately');
 await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(App));});
 assert.equal(tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='다른 프로젝트').length,0,'a restart does not bring the deleted set back');
 await act(async()=>tree.unmount());

 console.log('PASS: workshop home, 32 direct Painter entries, finger-sized touch targets, drawings-only rail with no jargon, reference select separated from visibility, quick fade without long press, pen/fill/eraser segment with one draggable size slider, colour memory, set planning with no-dialogue and per-slot reference, planning feeds Painter, autosave on backgrounding, final preview, offline QA, single-bundle export, layered persistence, save-next flow, restart, old data compatibility, guarded set deletion scoped to one project. Native modules/WebView mocked; touch gestures require device test.');
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
