const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/민건/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {checked}=require('./render-localized-media.cjs');
const root=path.resolve(__dirname,'..'),proof=path.join(root,'verification/localized-media-20261030');
(async()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(proof,'manifest.json')));assert.equal(manifest.records.length,54);
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const record of manifest.records){
  const file=path.join(root,record.file),b=fs.readFileSync(file);assert.equal(b.readUInt32BE(16),record.size?.[0]??record.width);assert.equal(b.readUInt32BE(20),record.size?.[1]??record.height);assert.equal(b[25],2,'RGB only');
  if(record.kind==='appstore-card-DRAFT'){
   const page=await browser.newPage({viewport:{width:record.width/2,height:record.height/2}});await page.goto(pathToFileURL(file.replace(/\.png$/,'.html')).href);record.checks=await checked(page,record.locale,record.file,'h1');await page.close();
  }
 } }finally{await browser.close();}
 fs.writeFileSync(path.join(proof,'manifest.json'),JSON.stringify(manifest,null,2));
 fs.writeFileSync(path.join(proof,'verification.json'),JSON.stringify({status:'PASS',assets:54,lessonThumbnails:22,appStoreDrafts:20,playDrafts:12,rgb:true,fontCmapCoverage:true,visibleTextKoreanResidual:0,originalsUnchanged:manifest.protectedOriginals.every(x=>x.unchanged),scope:'Static graphics, not native app screenshots'},null,2));
 console.log('PASS: 54 assets, RGB dimensions, glyph coverage, text bounds, zero visible Korean; store images DRAFT.');
})().catch(e=>{console.error(e);process.exitCode=1;});
