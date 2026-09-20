import { factErrors } from './fact-validation';
import { z } from 'zod';
export const TERMS = "En t'inscrivant, tu certifies avoir lu et accepté les conditions d'utilisation des événements AWS (https://aws.amazon.com/events/terms/).";
const prose = z.string().min(1).max(6000);
const textPayload = z.object({ text: prose }).strict();
export const wireAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create_calendar_event'), payload: z.object({title:prose,start:prose,end:prose,location:prose,description:prose}).strict() }).strict(),
  z.object({ type: z.literal('post_discord'), payload: z.object({channel:z.literal('announcements'),text:prose}).strict() }).strict(),
  z.object({ type: z.literal('draft_meetup'), payload: z.object({title:prose,sections:z.object({hook:prose,whyUseful:prose,programme:z.array(prose).min(1).max(6),audience:prose,bring:prose.optional(),details:prose,registrationCTA:prose}).strict()}).strict() }).strict(),
  ...(['draft_linkedin_club','draft_linkedin_personal','draft_instagram'] as const).map(type => z.object({type:z.literal(type),payload:textPayload}).strict()),
  z.object({type:z.literal('draft_dm'),payload:z.object({recipientRole:z.enum(['Director of Events','Director of Marketing','Technical Lead','Event Coordinator']),text:prose}).strict()}).strict(),
]);
export const wirePlan = z.object({ actions:z.array(wireAction).min(1).max(10), followupPreview:prose }).strict();
export type WirePlan = z.infer<typeof wirePlan>;
export type WireAction = z.infer<typeof wireAction>;
export const factKeys = ['title','dateLabel','start','end','room','rsvp','groupPage','audience','technicalName','message'] as const;
export const factsSchema = z.object(Object.fromEntries(factKeys.map(k=>[k,z.string().max(k==='message'?2000:1000).default('')])) as Record<typeof factKeys[number],z.ZodDefault<z.ZodString>>).strict();
export type Facts = z.infer<typeof factsSchema>;
export type Status = 'proposed'|'approved'|'rejected'|'executing'|'executed'|'failed'|'unknown';
export type Action = {version:1;id:string;wire:WireAction;type:WireAction['type'];payload:Record<string,unknown>;text:string;needsInput:string[];destination:string;capability:'real'|'draft';status:Status;payloadHash:string;executionBinding?:string;approval?:{at:string;payloadHash:string;destination:string};receipt?:{id:string;url?:string;provider:string;simulated:boolean};error?:string};
export type Plan = {version:1;id:string;revision:number;requestId:string;provider:'scripted'|'backboard'|'manual';createdAt:string;timezone:string;facts:Facts;actions:Action[];followupPreview:string;wire:WirePlan;evidence?:{toolCallId:string;retrievedFiles:number}};
export type Context = {id:string;requestId:string;now:string;provider:Plan['provider'];facts:Facts;calendarEnabled:boolean;discordEnabled:boolean;calendarTarget:string;discordTarget:string;executionBindings?:{calendar:string;discord:string}};
export const labels:Record<WireAction['type'],string> = {create_calendar_event:'Événement Calendar',post_discord:'Annonce Discord',draft_meetup:'Description Meetup',draft_linkedin_club:'LinkedIn du club',draft_linkedin_personal:'LinkedIn personnel',draft_instagram:'Instagram',draft_dm:'Message à l’équipe'};
export function canonical(value:unknown):string {
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(value && typeof value==='object') return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value) ?? 'null';
}
// Exact canonical snapshots avoid hash collisions in the approval gate. The executor hashes this for its compact durable key.
export function fingerprint(a:Pick<Action,'payload'|'destination'|'capability'|'executionBinding'>) { return canonical({payload:a.payload,destination:a.destination,capability:a.capability,...(a.executionBinding?{executionBinding:a.executionBinding}:{})}); }
const reference=/\{\{fact\.([A-Za-z][A-Za-z0-9]*)\}\}/g;
function render(value:unknown,facts:Facts,missing:Set<string>,key='',path='draft'):unknown {
  if(Array.isArray(value))return value.map((v,i)=>render(v,facts,missing,key,`${path}[${i}]`));
  if(value && typeof value==='object') return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,render(v,facts,missing,k,`${path}.${k}`)]));
  if(typeof value!=='string')return value;
  if(key==='channel'||key==='recipientRole')return value;
  const rest=value.replace(reference,'');
  if(/[\d@\[\]{}\u2014]|(?:https?:|www\.|\b[a-z0-9-]+\.(?:com|org|net|io|ca|dev)\b)/i.test(rest))throw new Error(`${path} : chiffre, lien, mention ou placeholder hors référence {{fact.key}}.`);
  return value.replace(reference,(_,name:string)=>{
    if(!factKeys.includes(name as typeof factKeys[number]))throw new Error('Référence de fait inconnue.');
    const fact=facts[name as keyof Facts];
    if(!fact.trim()){missing.add(name);return `[${name.toUpperCase()}]`;}
    if(fact.includes('\u2014'))throw new Error('Les tirets cadratins sont interdits.');
    return fact;
  });
}
function display(type:Action['type'],p:Record<string,unknown>):string {
  if(type==='create_calendar_event')return `${p.title}\n${p.start} → ${p.end}\n${p.location}\n\n${p.description}`;
  if(type==='draft_meetup') {const sections=p.sections as Record<string,unknown>; return `${p.title}\n\n${sections.hook}\n\n${sections.whyUseful}\n\n🎯 Au programme\n${(sections.programme as string[]).map(x=>'• '+x).join('\n')}\n\n👥 Pour qui ?\n${sections.audience}${sections.bring?'\n\n💡 Quoi apporter ?\n'+sections.bring:''}\n\n📅 Détails\n${sections.details}\n\n${sections.registrationCTA}\n\n${TERMS}`;}
  return String(p.text);
}
function validateFacts(f:Facts) {
  const errors=factErrors(f);
  if(Object.keys(errors).length)throw new Error(Object.values(errors).join(' '));
}
export function normalize(input:unknown,ctx:Context):{ok:true;value:Plan}|{ok:false;errors:string[]} {
  try {
    const isNormalized=!!input&&typeof input==='object'&&'version' in input;
    const wire=wirePlan.parse(isNormalized?(input as Plan).wire:input); const facts=factsSchema.parse(ctx.facts); validateFacts(facts);
    const actions=wire.actions.map((w,i):Action=>{
      const missing=new Set<string>(); const payload=render(w.payload,facts,missing,'',`actions[${i}].payload`) as Record<string,unknown>;
      const isCalendar=w.type==='create_calendar_event', isDiscord=w.type==='post_discord';
      const capability=(isCalendar&&ctx.calendarEnabled)||(isDiscord&&ctx.discordEnabled)?'real':'draft';
      if(isCalendar) {
        for(const field of ['start','end','location'] as const)if(!String(w.payload[field]).match(/^\{\{fact\.(start|end|room)\}\}$/))throw new Error('Calendar nécessite des références de faits pour les horaires et le lieu.');
        if(w.payload.start!=='{{fact.start}}'||w.payload.end!=='{{fact.end}}'||w.payload.location!=='{{fact.room}}')throw new Error('Références Calendar invalides.');
      }
      const destination=isCalendar?ctx.calendarTarget:isDiscord?ctx.discordTarget:'Copie manuelle uniquement';
      const a:Action={version:1,id:`${ctx.id}-${i+1}`,type:w.type,wire:w,payload,text:display(w.type,payload),needsInput:[...missing],destination,capability,status:'proposed',payloadHash:'',...(capability==='real'&&ctx.executionBindings?{executionBinding:isCalendar?ctx.executionBindings.calendar:ctx.executionBindings.discord}:{})};
      a.payloadHash=fingerprint(a); return a;
    });
    const preview=render(wire.followupPreview,facts,new Set(),'','followupPreview') as string;
    const value:Plan={version:1,id:ctx.id,revision:1,requestId:ctx.requestId,provider:ctx.provider,createdAt:ctx.now,timezone:'America/Montreal',facts,actions,followupPreview:preview,wire};
    if(isNormalized&&canonical(input)!==canonical(value))throw new Error('Snapshot normalisé invalide.');
    return {ok:true,value};
  }catch(e){return {ok:false,errors:[e instanceof z.ZodError?'Le plan ne respecte pas le schéma autorisé.':(e as Error).message]};}
}
export type Op = {type:'propose';proposal:Plan} | {type:'approve'|'reject'|'execute'|'fail';actionId:string;expectedHash:string;at:string;phase?:'start'|'success';receipt?:Action['receipt'];error?:string;unknown?:boolean} | {type:'edit';replacement:Plan;expectedRevision:number};
export function reduce(plan:Plan|null,op:Op):Plan {
  if(op.type==='propose')return op.proposal;
  if(!plan)throw new Error('Plan requis.');
  if(op.type==='edit') {
    if(op.expectedRevision!==plan.revision)throw new Error('Plan périmé. Rechargez avant de modifier.');
    const actions=op.replacement.actions.map(a=>{const old=plan.actions.find(x=>x.id===a.id);if(!old)throw new Error('Action inconnue.');if(a.payloadHash===old.payloadHash)return old;if(['executing','executed','unknown'].includes(old.status))throw new Error('Une action exécutée ou incertaine est immuable.');return a;});
    return {...op.replacement,actions,revision:plan.revision+1};
  }
  const current=plan.actions.find(a=>a.id===op.actionId); if(!current)throw new Error('Action introuvable.');
  if(current.payloadHash!==op.expectedHash)throw new Error('Approbation périmée. Relisez cette action.');
  let next={...current};
  if(op.type==='approve') {
    if(current.status!=='proposed'&&current.status!=='failed')throw new Error('Action non disponible pour approbation.');
    if(current.needsInput.length)throw new Error('Complétez les faits manquants avant approbation.');
    next={...next,status:'approved',approval:{at:op.at,payloadHash:current.payloadHash,destination:current.destination},error:undefined};
  } else if(op.type==='reject') {
    if(!['proposed','approved','failed'].includes(current.status))throw new Error('Cette action ne peut plus être rejetée.');
    next={...next,status:'rejected',approval:undefined};
  } else if(op.type==='execute') {
    if(current.capability!=='real'||!current.approval||current.approval.payloadHash!==current.payloadHash||current.approval.destination!==current.destination)throw new Error('Exécution non approuvée.');
    if(op.phase==='start'){if(current.status!=='approved')throw new Error('Action non approuvée.');next.status='executing';}
    else {if(current.status!=='executing'&&current.status!=='unknown')throw new Error('Résultat inattendu.');if(!op.receipt)throw new Error('Reçu requis.');next={...next,status:'executed',receipt:op.receipt,error:undefined};}
  } else {if(current.status!=='executing'&&current.status!=='approved')throw new Error('Échec inattendu.');next={...next,status:op.unknown?'unknown':'failed',error:op.error};}
  return {...plan,revision:plan.revision+1,actions:plan.actions.map(a=>a.id===next.id?next:a)};
}
