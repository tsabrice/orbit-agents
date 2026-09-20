// Reuses the previous project's assistant/document setup workflow; run explicitly to authorize upload.
import { existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { history } from '../src/core/fixtures';
if(existsSync('.env'))loadEnvFile('.env');
const key=process.env.BACKBOARD_API_KEY;if(!key)throw new Error('Set BACKBOARD_API_KEY in .env first.');
const path='.data/backboard-setup.json';const stored=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};
const save=()=>{mkdirSync('.data',{recursive:true,mode:0o700});writeFileSync(path,JSON.stringify(stored,null,2),{mode:0o600});};
async function api(route:string,init:RequestInit={}){const r=await fetch(`https://app.backboard.io/api${route}`,{...init,headers:{'X-API-Key':key!,...init.headers},signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`Backboard setup HTTP ${r.status}. No credentials logged.`);return r.json();}
if(!stored.assistant){const a=await api('/assistants',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Relais · AWS SBG UQAM',system_prompt:readFileSync('docs/VOICE.md','utf8')})});stored.assistant=a.assistant_id;stored.documents=[];save();}
const docs=[{name:'voice.md',text:readFileSync('docs/VOICE.md','utf8')},{name:'synthetic-history.json',text:JSON.stringify({notice:'SYNTHETIC FIXTURES. Not actual club attendance.',events:history},null,2)}];
for(let i=0;i<docs.length;i++){if(!stored.documents[i]){const form=new FormData();form.append('file',new Blob([docs[i].text],{type:'text/plain'}),docs[i].name);const d=await api(`/assistants/${encodeURIComponent(stored.assistant)}/documents`,{method:'POST',body:form});stored.documents[i]=d.document_id;save();}const status=await api(`/documents/${encodeURIComponent(stored.documents[i])}/status`);console.log(`${docs[i].name}: ${status.status}`);}
console.log('Setup IDs saved in .data/backboard-setup.json. Configure the verified provider/model and cost bounds in .env before enabling live generation.');
