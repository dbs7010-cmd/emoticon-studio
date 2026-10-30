// One multipart POST per short-lived Notion descriptor. Credentials are supplied
// through an ignored local JSON file, never embedded here or printed in logs.
const fs=require('node:fs'),path=require('node:path');
async function main(){const config=process.argv[2],tasks=JSON.parse(fs.readFileSync(config,'utf8')),results=[];for(const t of tasks){const form=new FormData();form.append('file',new Blob([fs.readFileSync(t.file)]),t.filename);const response=await fetch(t.upload_url,{method:'POST',headers:t.upload_headers,body:form});const body=await response.json();if(!response.ok)throw Error('Upload failed '+response.status+' '+t.filename);results.push({filename:t.filename,file:t.file,result:body});console.log('Uploaded '+t.filename);}fs.writeFileSync(path.join(path.dirname(config),'notion-upload-results.json'),JSON.stringify(results,null,2));fs.unlinkSync(config);}
main().catch(e=>{console.error(e.message);process.exit(1)});
