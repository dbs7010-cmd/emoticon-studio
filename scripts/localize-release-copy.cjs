// One-time, reviewable copy migration. Engine strings, stable group IDs and probe IDs stay intact.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const catalogPath='src/i18n/release-copy.json';
const rows=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
for(const row of rows){assert.equal(row.length,4);assert.ok(row.every(x=>typeof x==='string'));for(const x of row.slice(2)){assert.ok(!/[가-힣]/.test(x));assert.deepEqual(x.match(/\{\w+\}/g)?.sort()??[],row[1].match(/\{\w+\}/g)?.sort()??[]);}}
const {loader}=require('./load-ts.cjs');const ko=loader()('src/i18n/ko.ts').ko;
const mapping=new Map(Object.entries(ko).map(([key,value])=>[value,key]));for(const [key,source]of rows)if(!mapping.has(source))mapping.set(source,key);
for(const [file,column]of [['ko',1],['ja',2],['zh-Hant',3]]){
 const f='src/i18n/'+file+'.ts';let s=fs.readFileSync(f,'utf8');const marker=file==='ko'?'} as const;':'};';
 const additions=rows.filter(([k])=>!s.includes(JSON.stringify(k)+':')&&!s.includes("'"+k+"':")).map(r=>'  '+JSON.stringify(r[0])+': '+JSON.stringify(r[column])+',').join('\n');
 if(additions){const i=s.lastIndexOf(marker);assert.ok(i>=0);s=s.slice(0,i)+additions+'\n'+s.slice(i);fs.writeFileSync(f,s);}
}
const files=['App.tsx',...fs.readdirSync('src/components').filter(x=>/\.tsx$/.test(x)).map(x=>'src/components/'+x),'src/painter/painter.tsx','src/painter/motion-panel.tsx','src/painter/anim-panel.tsx','src/painter/motion-recipes.ts','src/project.ts','src/constants/lessons.ts','src/constants/guidebook.ts','src/constants/kakao-spec.ts','src/design/asset-slots.ts','src/types.ts','src/services/pro.ts','src/services/purchase-config.ts'];
const report=[];
const jsxText=raw=>{const lines=raw.split(/\r\n|\n|\r/);let last=0;lines.forEach((s,i)=>{if(/[^ \t]/.test(s))last=i;});return lines.map((s,i)=>{s=s.replace(/\t/g,' ');if(i)s=s.replace(/^ +/,'');if(i!==lines.length-1)s=s.replace(/ +$/,'');return s+(s&&i!==last?' ':'');}).join('');};
for(const file of files){
 let s=fs.readFileSync(file,'utf8');const sf=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true),edits=[];
 const protectedNode=n=>{
  for(let p=n;p;p=p.parent){
   if(ts.isTypeNode(p))return true;
   if(ts.isVariableDeclaration(p)&&p.name.getText(sf)==='GROUPS')return true;
   if(ts.isJsxAttribute(p)&&p.name.getText(sf)==='testID')return true;
   if(ts.isPropertyAssignment(p)&&['id','group','basis'].includes(p.name.getText(sf)))return true;
   if(ts.isCallExpression(p)&&p.expression.getText(sf)==='useState'&&p.typeArguments?.some(a=>a.getText(sf)==='Group'))return true;
  }
  if(n.parent&&ts.isPropertyAssignment(n.parent)&&n.parent.name===n)return true;
  if(n.text?.startsWith('button:')||n.text?.startsWith('<!doctype'))return true;
  // Layer names are part of saved engine data. Translate their display with layerLabel, not the data.
  if(file.endsWith('painter.tsx')&&(n.text==='그림 1'||n.getText(sf)==='`그림 ${n}`'))return true;
  return false;
 };
 function expr(n){
  if(protectedNode(n))return null;
  if(ts.isTemplateExpression(n)){
   let source=n.head.text;n.templateSpans.forEach((sp,i)=>source+='{v'+i+'}'+sp.literal.text);
   const key=mapping.get(source);if(!key)return null;
   const vars=n.templateSpans.map((sp,i)=>'v'+i+': ('+subtree(sp.expression)+')').join(', ');
   return `t(${JSON.stringify(key)}, { ${vars} })`;
  }
  if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isJsxText(n)){
   const text=ts.isJsxText(n)?n.getText(sf):n.text,trim=text.trim();if(!/[가-힣]/.test(trim))return null;
   const key=mapping.get(trim);if(!key)return null;
   let call=`t(${JSON.stringify(key)})`;
   const original=ts.isJsxText(n)?jsxText(text):text;
   const l=original.slice(0,original.indexOf(trim)),r=original.slice(original.indexOf(trim)+trim.length);if(l)call=JSON.stringify(l)+' + '+call;if(r)call+=' + '+JSON.stringify(r);
   return ts.isJsxText(n)||ts.isJsxAttribute(n.parent)?'{'+call+'}':call;
  }return null;
 }
 function subtree(node){const local=[];function walk(n){const replacement=expr(n);if(replacement!==null){local.push({start:n.getStart(sf)-node.getStart(sf),end:n.end-node.getStart(sf),replacement});return;}ts.forEachChild(n,walk);}walk(node);let text=node.getText(sf);for(const e of local.sort((a,b)=>b.start-a.start))text=text.slice(0,e.start)+e.replacement+text.slice(e.end);return text;}
 function walk(n){const replacement=expr(n);if(replacement!==null){edits.push({start:n.getStart(sf),end:n.end,replacement});return;}ts.forEachChild(n,walk);}walk(sf);
 for(const e of edits.sort((a,b)=>b.start-a.start))s=s.slice(0,e.start)+e.replacement+s.slice(e.end);
 if(edits.length&&!/import\s*\{[^}]*\bt\b[^}]*\}\s*from ['"][^'"]*i18n\/index['"]/.test(s)){
  let relative=path.relative(path.dirname(file),'src/i18n/index').replaceAll('\\','/');if(!relative.startsWith('.'))relative='./'+relative;s=`import { t } from '${relative}';\n`+s;
 }
 if(edits.length)fs.writeFileSync(file,s);report.push({file,occurrences:edits.length});
}
fs.writeFileSync('verification/i18n-20261030/migration.json',JSON.stringify(report,null,2));console.log(report.filter(x=>x.occurrences));
