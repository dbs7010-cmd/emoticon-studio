// Real Android emulator captures; never substitutes phone/iOS captures.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const lang=process.env.LESSON_LANG||'ko',size=process.env.TABLET_SIZE||'7-inch';
const r=require('../lessons/rec.cjs'),u=require('../lessons/ui.cjs');
const dir=path.resolve('verification/play-tablet-20261031',lang,size);fs.mkdirSync(dir,{recursive:true});
const titles={ko:'콘의 하루',ja:'コーンの一日','zh-Hant':'小玉米的一天'};
const [cmd,name]=process.argv.slice(2);
const shot=n=>{fs.writeFileSync(path.join(dir,n+'.png'),r.adb(['exec-out','screencap','-p']));console.log(path.join(dir,n+'.png'));};
if(cmd==='start'){
 r.adb(['shell','am','force-stop','com.emoticonstudio.app']);
 r.adb(['shell','cmd','locale','set-app-locales','com.emoticonstudio.app','--locales',{ko:'ko-KR',ja:'ja-JP','zh-Hant':'zh-TW'}[lang]]);
 for(const n of ['a','b'])r.adb(['push',path.resolve('verification/release-handoff-20261030/tablet-seed',lang+'.json'),'/data/user/0/com.emoticonstudio.app/files/emoticon-studio/store-'+n+'.json']);
 const owner=r.adb(['shell','stat','-c','%u:%g','/data/user/0/com.emoticonstudio.app/files/emoticon-studio']).toString().trim();
 if(!/^\d+:\d+$/.test(owner))throw Error('Invalid emulator store owner');
 r.adb(['shell','chown','-R',owner,'/data/user/0/com.emoticonstudio.app/files/emoticon-studio']);
 r.adb(['shell','am','start','-n','com.emoticonstudio.app/.MainActivity']);r.sleep(12000);
}else if(cmd==='list')console.log(u.nodes().filter(n=>n.desc||n.text));
else if(cmd==='tap'){u.tap(name,2000);}
else if(cmd==='project'){const n=u.nodes().find(n=>n.desc===titles[lang]);if(!n)throw Error('Project not visible');r.tap(n.x,n.y,2500);}
else if(cmd==='shot')shot(name);
else if(cmd==='flow'){
 const dismiss=()=>{}; // clean prepared sample store has no notices
 dismiss();shot('01-home');
 u.tap('강좌',2000);dismiss();shot('04-lessons');u.tap('홈',1500);
 const p=u.nodes().find(n=>n.desc===titles[lang]);if(!p)throw Error('Project not visible');r.tap(p.x,p.y,2500);
 dismiss();shot('02-board');u.tap('슬롯 1 완성',4000);dismiss();shot('03-draw');
 u.tap('그리기 닫기',1800);dismiss();u.tap('내보내기',2000);dismiss();shot('05-export');
}
else throw Error('start | list | tap LABEL | project | shot NAME');
