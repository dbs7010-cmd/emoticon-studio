// Release localization: inspect real component trees and data, not a duplicate UI mockup.
const assert=require('node:assert/strict'),fs=require('node:fs'),React=require('react');
const {create,act}=require('react-test-renderer'),{loader}=require('./load-ts.cjs');
global.IS_REACT_ACT_ENVIRONMENT=true;
const records=[];
async function check(locale){
 const files=new Map();class Directory{constructor(...p){this.uri=p.map(x=>x.uri??x).join('/')}create(){}}
 class File{constructor(...p){this.uri=p.map(x=>x.uri??x).join('/')}get name(){return this.uri.split('/').pop()}get exists(){return files.has(this.uri)}write(x){files.set(this.uri,x)}textSync(){return files.get(this.uri)}delete(){files.delete(this.uri)}async bytes(){return this.bytesSync()}bytesSync(){return new Uint8Array(files.get(this.uri)??[])}}
 const rn=Object.fromEntries(['View','Text','TextInput','Pressable','ScrollView','KeyboardAvoidingView','Image','Modal'].map(n=>[n,n]));
 Object.assign(rn,{Animated:require('./_rn-animated-mock.cjs'),StyleSheet:{create:x=>x},Platform:{OS:'android'},useWindowDimensions:()=>({width:390,height:844}),Keyboard:{addListener:()=>({remove(){}}),dismiss(){},isVisible:()=>false},BackHandler:{addEventListener:()=>({remove(){}})},AppState:{addEventListener:()=>({remove(){}})},Alert:{alert(){}},Linking:{openURL:async()=>{}}});
 const load=loader({'expo-localization':{getLocales:()=>[{languageCode:locale==='zh-Hant'?'zh':locale,regionCode:locale==='zh-Hant'?'TW':null}]},'react-native':rn,'@expo/ui':{Host:'Host',Button:'Button',Slider:'Slider'},'@expo/vector-icons':{MaterialCommunityIcons:'Icon'},'react-native-safe-area-context':{SafeAreaProvider:'SafeAreaProvider',SafeAreaView:'SafeAreaView',useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})},'expo-image-picker':{},'expo-image-manipulator':{},'expo-asset':{Asset:{fromModule:()=>({downloadAsync:async()=>({localUri:'bundled://art'})})}},'expo-status-bar':{StatusBar:'StatusBar'},'expo-constants':{default:{expoConfig:{extra:{}}}},'react-native-webview':{WebView:React.forwardRef((_p,ref)=>{React.useImperativeHandle(ref,()=>({injectJavaScript(){}}));return React.createElement('WebView')})},'expo-sharing':{isAvailableAsync:async()=>true,shareAsync:async()=>{}},'expo-file-system':{Directory,File,Paths:{document:'document'}},'./src/components/image-analyzer':{ImageAnalyzer:()=>null},'./src/components/extra-composer':{ExtraComposer:React.forwardRef(()=>null),placeInFrame:()=>({x:0,y:0,w:1,h:1})},'./src/components/motion-baker':{MotionBaker:React.forwardRef(()=>null)}});
 const {t}=load('src/i18n/index.ts'),{ko}=load('src/i18n/ko.ts'),{createProject}=load('src/project.ts'),{saveStore}=load('src/services/storage.ts');
 const keyFor=text=>Object.keys(ko).find(k=>ko[k]===text),label=text=>{const k=keyFor(text);assert.ok(k,'key for '+text);return t(k)};
 const {userMessage}=load('src/components/ui.tsx');
 assert.equal(userMessage(new Error('저장하지 못했어요')),label('저장하지 못했어요'));
 assert.equal(userMessage(new Error('TypeError: undefined at file:///private')),label('잠시 후 다시 시도해 주세요.'));
 if(locale!=='ko')assert.ok(!/[가-힣]/.test(userMessage(new Error('아직 번역표에 없는 서버 오류'))),'unknown Korean errors use localized fallback');
 const data={lessons:load('src/constants/lessons.ts').LESSONS,guide:load('src/constants/guidebook.ts').GUIDEBOOK,expressions:load('src/design/asset-slots.ts').EXPRESSION_GUIDE,captions:load('src/types.ts').CAPTION_FACES};
 const residual=[];function scan(v,p){if(typeof v==='string'&&/[가-힣]/.test(v)&&!['category','id','group'].some(k=>p.endsWith('.'+k)))residual.push({path:p,text:v});else if(Array.isArray(v))v.forEach((x,i)=>scan(x,p+'['+i+']'));else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v))if(!k.startsWith('__'))scan(x,p+'.'+k)}
 if(locale!=='ko')scan(data,'data');
 const project=createProject('Locale sample','Corn');project.slots[0].finalImage={path:'sample.png',width:360,height:360};project.slots[0].done=true;
 saveStore({version:1,introDone:true,revision:1,projects:[project],palette:[]});
 const App=load('App.tsx').default;let tree;await act(async()=>{tree=create(React.createElement(App))});
 function audit(screen){const found=[];for(const n of tree.root.findAll(n=>typeof n.type==='string')){if(n.type==='Text')found.push([n.props.children].flat(9).filter(x=>typeof x==='string').join(''));for(const key of ['accessibilityLabel','accessibilityHint','placeholder'])if(typeof n.props[key]==='string')found.push(n.props[key]);}if(locale!=='ko')for(const text of [...new Set(found.filter(x=>/[가-힣]/.test(x)))])residual.push({path:screen,text});records.push({locale,screen,strings:found.length});}
 async function press(korean){const targets=tree.root.findAll(n=>n.type==='Pressable'&&n.props.accessibilityLabel===label(korean));assert.ok(targets.length,korean+' button exists in '+locale+'; available: '+tree.root.findAll(n=>n.type==='Pressable').map(n=>n.props.accessibilityLabel).join(', '));await act(async()=>targets[0].props.onPress());}
 audit('home');await press('PRO 보기');audit('pro');await press('PRO 닫기');await press('표현 가이드');audit('expressions');await press('홈으로');
 const setButton=tree.root.find(n=>n.type==='Pressable'&&n.props.accessibilityLabel==='Locale sample');await act(async()=>setButton.props.onPress());audit('board');await press('내보내기');audit('export');
 await act(async()=>tree.unmount());
 const {ChatSim}=load('src/components/chat-sim.tsx');await act(async()=>{tree=create(React.createElement(ChatSim,{visible:true,setName:'Locale sample',stickers:[{number:1,uri:'test.png'}],onClose(){}}))});audit('chat');await act(async()=>tree.unmount());
 const {MotionPanel,PRESETS}=load('src/painter/motion-panel.tsx');await act(async()=>{tree=create(React.createElement(MotionPanel,{motion:null,layers:[],clipped:false,pro:true,savedMotions:[],onChange(){},onRequestPro(){},onPickPivot(){},onFocusPart(){},onFit(){},onSaveMotion(){},onUseMotion(){},onForgetMotion(){},thumbs:{}}))});audit('motion');await act(async()=>tree.unmount());
 assert.equal(PRESETS.length,20);assert.ok(PRESETS.every(x=>['등장','동작','강조'].includes(x.group)),'stable effect groups unchanged');
 const {AnimPanel}=load('src/painter/anim-panel.tsx');await act(async()=>{tree=create(React.createElement(AnimPanel,{frames:null,index:0,pro:false,onStart(){},onRequestPro(){}}))});audit('animation');await act(async()=>tree.unmount());
 const {Painter}=load('src/painter/painter.tsx');const noop=()=>{},props={slot:project.slots[0],slotCount:32,setName:'Locale sample',canonName:'Corn',canonLocked:'',palette:[],userPalette:[],paperTexture:false,completeTitle:label('저장'),hasPrevious:false,pro:false,savedMotions:[],cutouts:[]};
 for(const k of ['onSaveUserColor','onRemoveUserColor','onBrushSettings','onRequestPro','onSaveMotion','onForgetMotion','onSave','onComplete','onSetReference','onColorUsed','onClose','onNavigate','onForgetCutout','onRemoveReference'])props[k]=noop;
 for(const k of ['onCopyPrevious','onImportDrawing','onKeepCutout','onUseCutout','onShare'])props[k]=async()=>null;props.onAddReferences=async()=>[];
 await act(async()=>{tree=create(React.createElement(Painter,props))});audit('painter');await act(async()=>tree.unmount());
 fs.writeFileSync('verification/i18n-20261030/render-'+locale+'.json',JSON.stringify({locale,residual,records:records.filter(x=>x.locale===locale)},null,2));
 assert.deepEqual(residual,[],locale+' runtime Korean residual');
}
(async()=>{for(const locale of ['ko','ja','zh-Hant'])await check(locale);console.log('PASS: ko/ja/zh-Hant real home, PRO, expression, chat, motion, animation and painter trees; lesson/guide/expression data; stable motion IDs. Native/WebView mocked.');})().catch(e=>{console.error(e);process.exitCode=1});
