// Transport and bounded tool staging adapted from ../HeroForge-AI/server/backboard.ts.
import { readFileSync, existsSync } from 'node:fs';
import { z } from 'zod';
import { wirePlan, type Facts } from '../src/core/model';
export function backboardConfig(){let stored:any={};if(existsSync('.data/backboard-setup.json'))stored=JSON.parse(readFileSync('.data/backboard-setup.json','utf8'));return {key:process.env.BACKBOARD_API_KEY,assistant:process.env.BACKBOARD_ASSISTANT_ID||stored.assistant,documents:(process.env.BACKBOARD_DOCUMENT_IDS?.split(',')||stored.documents||[]) as string[],model:process.env.BACKBOARD_MODEL,provider:process.env.BACKBOARD_MODEL_PROVIDER};}
export function backboardReady(){const c=backboardConfig();return process.env.LIVE_AI_ENABLED==='true'&&!!(c.key&&c.assistant&&c.model&&c.provider&&c.documents.length>=2);}
export async function generatePlan(prompt:string,facts:Facts,requestId:string){
 if(!backboardReady())throw new Error('Backboard non configuré. Le plan actuel est conservé.');
 const cap=Number(process.env.SESSION_COST_LIMIT);const bound=Number(process.env.BACKBOARD_MAX_COST_PER_PLAN);
 if(!(cap>0&&bound>0&&bound<=cap))throw new Error('Configurez un plafond et un coût maximal vérifié avant les appels payants.');
 if(spent+bound>cap)throw new Error('Plafond de coût atteint.');spent+=bound;
 const c=backboardConfig();const signal=AbortSignal.timeout(20000);
 const api=async(path:string,body?:unknown)=>{const r=await fetch(`https://app.backboard.io/api${path}`,{method:body?'POST':'GET',headers:{'X-API-Key':c.key!,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal});if(!r.ok)throw new Error('Backboard indisponible.');const d=await r.json();if(d.status==='FAILED')throw new Error('Backboard a refusé la requête.');return d;};
 for(const id of c.documents){const d=await api(`/documents/${encodeURIComponent(id)}/status`);if(d.status!=='indexed')throw new Error('Documents non indexés.');}
 const tool={type:'function',function:{name:'propose_plan',description:'Propose one complete plan for organizer review. Nothing executes.',parameters:z.toJSONSchema(wirePlan)}};
 const d=await api('/threads/messages',{assistant_id:c.assistant,content:JSON.stringify({prompt,facts,requestId,referenceTime:new Date().toISOString(),timezone:'America/Montreal'}),system_prompt:readFileSync('docs/VOICE.md','utf8')+' Retrieve the voice and synthetic history documents. Call propose_plan exactly once with the complete plan. In prose, no literal digits, URLs, @mentions, or bracket placeholders: use {{fact.title}}, {{fact.dateLabel}}, {{fact.start}}, {{fact.end}}, {{fact.room}}, {{fact.rsvp}}, {{fact.groupPage}}, {{fact.audience}}, {{fact.technicalName}}. Do not infer missing fact values. Calendar start/end/location must use the matching references. The only Discord channel is announcements. Return eight actions including two role-based DMs. FollowupPreview is prose without digits. Stop after the tool call.',llm_provider:c.provider,model_name:c.model,memory:'off',web_search:'off',stream:false,tools:[tool]});
 if(d.tool_calls?.length!==1||d.tool_calls[0].function?.name!=='propose_plan')throw new Error('Un seul plan complet est requis.');
 const call=d.tool_calls[0];const args=typeof call.function.arguments==='string'?JSON.parse(call.function.arguments):call.function.arguments;
 const parsed=wirePlan.parse(args);
 // Do not submit a continuation that could add unbudgeted LLM calls. The single staged tool result is the product output.
 return {wire:parsed,evidence:{toolCallId:String(call.id),retrievedFiles:Math.max(0,Number(d.retrieved_files_count||d.retrieved_files?.length||0))}};
}
let spent=0;
