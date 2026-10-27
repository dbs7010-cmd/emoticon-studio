// 버전 때문에 바뀐 것과 원래 매번 다른 것을 가른다.
// 변화 ≤ 자연 변동폭 → '원래 매번 다름'. 변화 > 변동폭 + 여유 → '이번 수정으로 바뀜'.
const fs=require('node:fs'),path=require('node:path');
const {LIST}=require('./_brush30.cjs');
const chg=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const noise=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const N=Object.fromEntries(noise.map(r=>[r.id,r]));
const C=Object.fromEntries(chg.map(r=>[r.id,r]));
const rows=[];
for(const [id,name,tier] of LIST){
 const c=C[id],n=N[id];
 if(!c||c.missing||!n){rows.push([id,name,'자료 없음','','','']);continue;}
 const ch=c.change.changed*100, nz=n.changed*100;
 let verdict;
 if(ch<0.1) verdict='그대로';
 else if(ch<=nz*1.3+0.5) verdict='원래 매번 다름';
 else verdict='이번 수정으로 바뀜';
 rows.push([id,name,verdict,ch.toFixed(2)+'%',nz.toFixed(2)+'%',(c.change.mean).toFixed(2)]);
}
const w=[5,14,20,9,9,7];
const line=r=>r.map((v,i)=>{let s=String(v);let len=0;for(const ch of s)len+=/[ᄀ-퟿＀-￯]/.test(ch)?2:1;return s+' '.repeat(Math.max(1,w[i]-len));}).join('');
console.log(line(['ID','브러시','판정','변화','변동폭','평균차']));
rows.forEach(r=>console.log(line(r)));
const g=k=>rows.filter(r=>r[2]===k);
console.log('');
console.log('그대로 '+g('그대로').length+' · 원래 매번 다름 '+g('원래 매번 다름').length+' · 이번 수정으로 바뀜 '+g('이번 수정으로 바뀜').length);
console.log('이번 수정으로 바뀐 것: '+g('이번 수정으로 바뀜').map(r=>r[1]).join(' · '));
