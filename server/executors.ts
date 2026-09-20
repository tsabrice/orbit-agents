import { createHash } from 'node:crypto';
import { reduce, type Action, type Plan } from '../src/core/model';
import { Store } from './store';
export const keyFor=(a:Action)=>createHash('sha256').update(a.id+'\n'+a.payloadHash).digest('hex');
export function capabilities(){return {
 calendar:!!(process.env.COMPOSIO_API_KEY&&process.env.COMPOSIO_CALENDAR_ACCOUNT&&process.env.COMPOSIO_CALENDAR_VERSION),
 discord:!!process.env.DISCORD_WEBHOOK_URL||!!(process.env.COMPOSIO_API_KEY&&process.env.COMPOSIO_DISCORD_ACCOUNT&&process.env.COMPOSIO_DISCORD_VERSION&&process.env.DISCORD_CHANNEL_ID),
 calendarTarget:process.env.GOOGLE_CALENDAR_ID||'primary',discordTarget:process.env.DISCORD_CHANNEL_LABEL||'announcements',
};}
async function composio(slug:string,account:string,version:string,args:Record<string,unknown>) {
 const response=await fetch(`https://backend.composio.dev/api/v3.1/tools/execute/${slug}`,{method:'POST',headers:{'x-api-key':process.env.COMPOSIO_API_KEY!,'Content-Type':'application/json'},body:JSON.stringify({connected_account_id:account,version,arguments:args}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Composio : résultat non confirmé.');
 const result=await response.json(); if(result.successful!==true)throw new Error('Composio : résultat non confirmé.');return result.data;
}
export async function dispatch(a:Action,plan:Plan):Promise<NonNullable<Action['receipt']>> {
 if(plan.provider==='scripted')return {id:`simulated-${keyFor(a).slice(0,12)}`,provider:'mock',simulated:true};
 if(process.env.SIDE_EFFECTS_ENABLED!=='true')throw new Error('Les actions externes sont désactivées.');
 if(a.type==='create_calendar_event') {
  const p=a.payload;const minutes=(Date.parse(String(p.end))-Date.parse(String(p.start)))/60000;
  const data=await composio('GOOGLECALENDAR_CREATE_EVENT',process.env.COMPOSIO_CALENDAR_ACCOUNT!,process.env.COMPOSIO_CALENDAR_VERSION!,{calendar_id:process.env.GOOGLE_CALENDAR_ID||'primary',summary:p.title,start_datetime:p.start,timezone:'America/Montreal',event_duration_hour:Math.floor(minutes/60),event_duration_minutes:minutes%60,description:p.description,location:p.location,send_updates:false});
  if(typeof data.id!=='string')throw new Error('Calendar : reçu absent, vérifiez la destination.');
  return {id:data.id,url:typeof data.htmlLink==='string'?data.htmlLink:undefined,provider:'composio',simulated:false};
 }
 if(a.type==='post_discord') {
  if(String(a.payload.text).length>2000)throw new Error('Discord : texte trop long.');
  if(process.env.DISCORD_WEBHOOK_URL){
   const url=new URL(process.env.DISCORD_WEBHOOK_URL);if(url.protocol!=='https:'||!['discord.com','discordapp.com'].includes(url.hostname)||!url.pathname.startsWith('/api/webhooks/'))throw new Error('Webhook non autorisé.');url.searchParams.set('wait','true');
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:a.payload.text,allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw new Error('Discord : résultat non confirmé.');const d=await r.json();if(!d.id)throw new Error('Discord : reçu absent.');
   return {id:d.id,provider:'discord-webhook',simulated:false};
  }
  const d=await composio('DISCORDBOT_CREATE_MESSAGE',process.env.COMPOSIO_DISCORD_ACCOUNT!,process.env.COMPOSIO_DISCORD_VERSION!,{channel_id:process.env.DISCORD_CHANNEL_ID,content:a.payload.text,allowed_mentions:{parse:[]}});
  if(typeof d.id!=='string')throw new Error('Discord : reçu absent.');return {id:d.id,provider:'composio',simulated:false};
 }
 throw new Error('Aucun exécuteur pour ce brouillon.');
}
export class ExecutionService {
 private pending=new Map<string,Promise<Plan>>();
 constructor(private store:Store,private transport=dispatch){}
 run(planId:string,actionId:string,expectedHash:string,requestId:string):Promise<Plan>{
  const p=this.store.get(planId);const a=p.actions.find(x=>x.id===actionId);if(!a||a.payloadHash!==expectedHash)throw new Error('Action absente ou périmée.');
  if(a.capability!=='real'||!a.approval||a.approval.payloadHash!==a.payloadHash)throw new Error('Action non approuvée.');
  const key=keyFor(a);if(this.pending.has(key))return this.pending.get(key)!;
  if(a.status==='executed'&&this.store.receipts[key])return Promise.resolve(p);
  if(a.status!=='approved')throw new Error('Action non disponible.');
  if([...this.store.plans.values()].some(p=>p.actions.some(x=>x.status==='executing')))throw new Error('Une exécution est déjà en cours.');
  this.store.log({requestId,planId,actionId,event:'execute',detail:p.provider==='scripted'?'Simulation demandée':'Tentative externe approuvée'});
  this.store.save(reduce(p,{type:'execute',actionId,expectedHash,at:new Date().toISOString(),phase:'start'}));
  const promise=this.perform(p,a,key,requestId).finally(()=>this.pending.delete(key));this.pending.set(key,promise);return promise;
 }
 private async perform(p:Plan,a:Action,key:string,requestId:string){
  try {
   const receipt=await this.transport(a,p);this.store.remember(key,receipt);
   const next=reduce(this.store.get(p.id),{type:'execute',actionId:a.id,expectedHash:a.payloadHash,at:new Date().toISOString(),phase:'success',receipt});
   this.store.log({requestId,planId:p.id,actionId:a.id,event:receipt.simulated?'simulated':'executed',detail:receipt.id});return this.store.save(next);
  }catch {
   const next=reduce(this.store.get(p.id),{type:'fail',actionId:a.id,expectedHash:a.payloadHash,at:new Date().toISOString(),unknown:true,error:'Résultat non confirmé. Vérifiez la destination avant toute autre action.'});
   this.store.log({requestId,planId:p.id,actionId:a.id,event:'unknown',detail:'Aucune relance automatique.'});return this.store.save(next);
  }
 }
}
