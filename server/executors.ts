import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { canonical, reduce, type Action, type Plan } from '../src/core/model';
import { Store } from './store';
export const keyFor=(a:Action)=>createHash('sha256').update(a.id+'\n'+a.payloadHash).digest('hex');
export function capabilities(){return {
 calendar:!!(process.env.COMPOSIO_API_KEY&&process.env.COMPOSIO_CALENDAR_ACCOUNT&&process.env.COMPOSIO_CALENDAR_VERSION),
 discord:!!process.env.DISCORD_WEBHOOK_URL||!!(process.env.COMPOSIO_API_KEY&&process.env.COMPOSIO_DISCORD_ACCOUNT&&process.env.COMPOSIO_DISCORD_VERSION&&process.env.DISCORD_CHANNEL_ID),
 calendarTarget:process.env.GOOGLE_CALENDAR_ID||'primary',discordTarget:process.env.DISCORD_CHANNEL_LABEL||'announcements',
};}
// Hash configuration, including secret webhook URLs, without exposing it to the client.
export function executionBindings(){
 const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
 return {
  calendar:hash({account:process.env.COMPOSIO_CALENDAR_ACCOUNT,calendar:process.env.GOOGLE_CALENDAR_ID||'primary',version:process.env.COMPOSIO_CALENDAR_VERSION}),
  discord:hash(process.env.DISCORD_WEBHOOK_URL?{webhook:process.env.DISCORD_WEBHOOK_URL}:{account:process.env.COMPOSIO_DISCORD_ACCOUNT,channel:process.env.DISCORD_CHANNEL_ID,version:process.env.COMPOSIO_DISCORD_VERSION}),
 };
}
export function assertExecutionBinding(action:Action){
 const binding=action.type==='create_calendar_event'?executionBindings().calendar:action.type==='post_discord'?executionBindings().discord:undefined;
 if(!binding||!action.executionBinding||action.executionBinding!==binding)throw new Error('La connexion ou la destination a changé depuis cette proposition. Préparez une nouvelle proposition et relisez sa destination. Aucun envoi tenté.');
}
class ProviderExecutionError extends Error {}
export type ExecutionEvidence={logId:string;slug:string;account:string;args:Record<string,unknown>};
type CaptureEvidence=(evidence:ExecutionEvidence)=>void;
export function composioReceipt(type:Action['type'],data:any):NonNullable<Action['receipt']>{
 const event=data?.response_data??data;
 if(typeof event?.id!=='string'||!event.id)throw new Error('Reçu fournisseur absent.');
 const url=type==='create_calendar_event'?event.htmlLink:
  typeof event.channel_id==='string'?`https://discord.com/channels/@me/${encodeURIComponent(event.channel_id)}/${encodeURIComponent(event.id)}`:undefined;
 return {id:event.id,url:typeof url==='string'&&url.startsWith('https://')?url:undefined,provider:'composio',simulated:false};
}
export async function composio(slug:string,account:string,version:string,args:Record<string,unknown>,capture?:CaptureEvidence) {
 // Composio requires the account owner's user_id even with an explicit account ID.
 const accountResponse=await fetch(`https://backend.composio.dev/api/v3.1/connected_accounts/${encodeURIComponent(account)}`,{headers:{'x-api-key':process.env.COMPOSIO_API_KEY!},signal:AbortSignal.timeout(10000)});
 if(!accountResponse.ok)throw new ProviderExecutionError('Impossible de vérifier le compte Composio. Aucun nouvel envoi tenté.');
 const connection=await accountResponse.json();
 if(connection.status!=='ACTIVE'||typeof connection.user_id!=='string'||!connection.user_id)throw new ProviderExecutionError('Compte Composio inactif ou utilisateur absent. Aucun nouvel envoi tenté.');
 const response=await fetch(`https://backend.composio.dev/api/v3.1/tools/execute/${slug}`,{method:'POST',headers:{'x-api-key':process.env.COMPOSIO_API_KEY!,'Content-Type':'application/json'},body:JSON.stringify({connected_account_id:account,user_id:connection.user_id,version,arguments:args}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new ProviderExecutionError(`Composio a répondu HTTP ${response.status}. Vérifiez la connexion et la destination avant toute autre tentative.`);
 const result=await response.json();
 if(typeof result.log_id==='string')capture?.({logId:result.log_id,slug,account,args});
 if(result.successful!==true){
  const error=typeof result.error==='string'?result.error:'';
  if(/insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficientPermissions/i.test(error))throw new ProviderExecutionError('Permissions Google Calendar insuffisantes. Reconnectez le compte dans Composio avec les autorisations de lecture du calendrier et de création d’événements.');
  if(/Unknown Channel|10003/.test(error))throw new ProviderExecutionError('Discord ne trouve pas ce salon ou le bot ne peut pas y accéder. Vérifiez l’identifiant du salon et les permissions du bot.');
  if(/Missing Access|Missing Permissions|50001|50013/.test(error))throw new ProviderExecutionError('Le bot Discord n’a pas les permissions nécessaires dans ce salon.');
  throw new ProviderExecutionError('Composio n’a pas confirmé l’exécution. Vérifiez la destination.');
 }return result.data;
}
export async function dispatch(a:Action,plan:Plan,capture?:CaptureEvidence):Promise<NonNullable<Action['receipt']>> {
 if(plan.provider==='scripted')return {id:`simulated-${keyFor(a).slice(0,12)}`,provider:'mock',simulated:true};
 assertExecutionBinding(a);
 if(process.env.SIDE_EFFECTS_ENABLED!=='true')throw new Error('Les actions externes sont désactivées.');
 if(a.type==='create_calendar_event') {
  const p=a.payload;
  // This tool strips offsets. UTC wall-clock values plus UTC preserve the approved instants.
  const data=await composio('GOOGLECALENDAR_CREATE_EVENT',process.env.COMPOSIO_CALENDAR_ACCOUNT!,process.env.COMPOSIO_CALENDAR_VERSION!,{calendar_id:process.env.GOOGLE_CALENDAR_ID||'primary',summary:p.title,start_datetime:new Date(String(p.start)).toISOString().slice(0,19),end_datetime:new Date(String(p.end)).toISOString().slice(0,19),timezone:'UTC',description:p.description,location:p.location,send_updates:'none',create_meeting_room:false},capture);
  return composioReceipt(a.type,data);
 }
 if(a.type==='post_discord') {
  if(String(a.payload.text).length>2000)throw new Error('Discord : texte trop long.');
  if(process.env.DISCORD_WEBHOOK_URL){
   const url=new URL(process.env.DISCORD_WEBHOOK_URL);if(url.protocol!=='https:'||!['discord.com','discordapp.com'].includes(url.hostname)||!url.pathname.startsWith('/api/webhooks/'))throw new Error('Webhook non autorisé.');url.searchParams.set('wait','true');
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:a.payload.text,allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw new Error('Discord : résultat non confirmé.');const d=await r.json();if(!d.id)throw new Error('Discord : reçu absent.');
   return {id:d.id,provider:'discord-webhook',simulated:false};
  }
  const d=await composio('DISCORDBOT_CREATE_MESSAGE',process.env.COMPOSIO_DISCORD_ACCOUNT!,process.env.COMPOSIO_DISCORD_VERSION!,{channel_id:process.env.DISCORD_CHANNEL_ID,content:a.payload.text,allowed_mentions:{parse:[]}},capture);
  return composioReceipt(a.type,d);
 }
 throw new Error('Aucun exécuteur pour ce brouillon.');
}
export class ExecutionService {
 private pending=new Map<string,Promise<Plan>>();
 constructor(private store:Store,private transport=dispatch){}
 run(planId:string,actionId:string,expectedHash:string,requestId:string):Promise<Plan>{
  const p=this.store.get(planId);const a=p.actions.find(x=>x.id===actionId);if(!a||a.payloadHash!==expectedHash)throw new Error('Action absente ou périmée.');
  if(a.capability!=='real'||!a.approval||a.approval.payloadHash!==a.payloadHash||a.approval.destination!==a.destination)throw new Error('Action non approuvée.');
  const key=keyFor(a);if(this.pending.has(key))return this.pending.get(key)!;
  if(a.status==='executed'&&this.store.receipts[key])return Promise.resolve(p);
  if(a.status!=='approved')throw new Error('Action non disponible.');
  if(this.transport===dispatch&&p.provider!=='scripted')assertExecutionBinding(a);
  if([...this.store.plans.values()].some(p=>p.actions.some(x=>x.status==='executing')))throw new Error('Une exécution est déjà en cours.');
  this.store.log({requestId,planId,actionId,event:'execute',detail:p.provider==='scripted'?'Simulation demandée':'Tentative externe approuvée'});
  this.store.save(reduce(p,{type:'execute',actionId,expectedHash,at:new Date().toISOString(),phase:'start'}));
  const promise=this.perform(p,a,key,requestId).finally(()=>this.pending.delete(key));this.pending.set(key,promise);return promise;
 }
 async verify(planId:string,actionId:string,expectedHash:string,requestId:string):Promise<Plan>{
  const initial=this.store.get(planId);const action=initial.actions.find(a=>a.id===actionId);
  if(!action||action.payloadHash!==expectedHash||action.status!=='unknown'||!action.approval||action.approval.payloadHash!==expectedHash)throw new Error('Action absente, périmée ou non vérifiable.');
  const key=keyFor(action),file=`${this.store.dir}/execution-${key}.json`;
  if(!existsSync(file))throw new Error('Aucun identifiant de reçu enregistré pour cette tentative. Vérifiez directement la destination. Aucun nouvel envoi.');
  const evidence=JSON.parse(readFileSync(file,'utf8')) as ExecutionEvidence;
  const response=await fetch(`https://backend.composio.dev/api/v3.1/logs/tool_execution/${encodeURIComponent(evidence.logId)}`,{headers:{'x-api-key':process.env.COMPOSIO_API_KEY!},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Vérification Composio indisponible. Aucun nouvel envoi.');
  const log=await response.json();
  if(log.id!==evidence.logId||log.metadata?.connected_account_id!==evidence.account||log.metadata?.tool?.slug!==evidence.slug||canonical(log.data?.request?.payload)!==canonical(evidence.args))throw new Error('Le reçu ne correspond pas à cette tentative. Aucun nouvel envoi.');
  this.store.log({requestId,planId,actionId,event:'verify_execution',detail:`Composio : ${log.status==='success'?'succès confirmé':'résultat non confirmé'}`});
  if(log.status!=='success'||log.data?.response?.body?.successful!==true)throw new Error('Composio ne confirme pas de réussite pour cette tentative. Vérifiez la destination. Aucun nouvel envoi.');
  const receipt=composioReceipt(action.type,log.data.response.body.data);
  // Re-read after the network call: manual reconciliation may have happened meanwhile.
  const current=this.store.get(planId),latest=current.actions.find(a=>a.id===actionId);
  if(latest?.status==='executed')return current;
  if(latest?.status!=='unknown'||latest.payloadHash!==expectedHash)throw new Error('Action modifiée pendant la vérification.');
  const next=reduce(current,{type:'execute',actionId,expectedHash,at:new Date().toISOString(),phase:'success',receipt});
  this.store.remember(key,receipt);this.store.save(next);
  this.store.log({requestId,planId,actionId,event:'reconciled',detail:receipt.id});return next;
 }
 private async perform(p:Plan,a:Action,key:string,requestId:string){
  try {
   const receipt=await this.transport(a,p,evidence=>this.store.write(`execution-${key}`,evidence));this.store.remember(key,receipt);
   const next=reduce(this.store.get(p.id),{type:'execute',actionId:a.id,expectedHash:a.payloadHash,at:new Date().toISOString(),phase:'success',receipt});
   this.store.log({requestId,planId:p.id,actionId:a.id,event:receipt.simulated?'simulated':'executed',detail:receipt.id});return this.store.save(next);
  }catch(error) {
   const detail=error instanceof ProviderExecutionError?error.message:'Résultat non confirmé. Vérifiez la destination avant toute autre action.';
   const next=reduce(this.store.get(p.id),{type:'fail',actionId:a.id,expectedHash:a.payloadHash,at:new Date().toISOString(),unknown:true,error:detail});
   this.store.log({requestId,planId:p.id,actionId:a.id,event:'unknown',detail});return this.store.save(next);
  }
 }
}
