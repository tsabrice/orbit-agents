import { extractEventFacts } from '../src/core/extract-event-facts';
import { planRequestSchema, titleFromShortPrompt } from '../src/core/plan-request';
import { fromLocalEventTime, toLocalEventTime, eventDateLabel } from '../src/core/event-time';
import { parseProviderJson } from '../src/core/provider-json';
import { ChatService } from '../server/chat';
import { parseChatArguments, chatDraftForDiscord, type Conversation } from '../src/core/chat';
import { parsePlanArguments, validatedPlanWithRepair, InvalidPlanOutput, requestBackboard } from '../server/backboard';
import { describe,it,expect,vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixturePlan,initialFacts,fixturePrompts,fixtureIndex,suggestion } from '../src/core/fixtures';
import { normalize,reduce,TERMS,factsSchema,type Context,type Plan } from '../src/core/model';
import { Store } from '../server/store';
import { ExecutionService, composio, dispatch, executionBindings, assertExecutionBinding } from '../server/executors';
const ctx:Context={id:'test',requestId:'request',now:'2026-09-19T22:45:00-04:00',provider:'scripted',facts:{...initialFacts(),end:'2026-09-24T20:00:00-04:00',room:'Salle démo',rsvp:'https://example.org/rsvp',groupPage:'https://example.org/group'},calendarEnabled:true,discordEnabled:true,calendarTarget:'demo',discordTarget:'announcements'};
function plan(c=ctx){const n=normalize(fixturePlan(),c);if(!n.ok)throw new Error(n.errors.join());return n.value;}
const op=(p:Plan,type:'approve'|'reject'|'execute',i=0)=>({type,actionId:p.actions[i].id,expectedHash:p.actions[i].payloadHash,at:'now'});
describe('Relais core',()=>{
 it('normalizes all three fixtures deterministically, eight actions and correct formats',()=>{
  fixturePrompts.forEach((prompt,i)=>{expect(fixtureIndex(prompt)).toBe(i);const p=plan({...ctx,facts:{...ctx.facts,...initialFacts(i),end:i===0?'2026-09-24T20:00:00-04:00':'2026-09-21T18:00:00-04:00'}});expect(p.actions).toHaveLength(8);expect(normalize(p,{...ctx,facts:p.facts})).toEqual({ok:true,value:p});expect(p.actions[2].text.endsWith(TERMS)).toBe(true);expect(p.actions[4].text).toContain('Je veux');expect(JSON.stringify(p)).not.toContain('\u2014');});
 });
 it('rejects unknown types, channel targets and oversized whole plans',()=>{const w=fixturePlan();expect(normalize({...w,actions:[{type:'send_email',payload:{}}]},ctx).ok).toBe(false);expect(normalize({...w,actions:[{type:'post_discord',payload:{channel:'elsewhere',text:'Salut'}}]},ctx).ok).toBe(false);expect(normalize({...w,actions:[...w.actions,...w.actions]},ctx).ok).toBe(false);});
 it.each(['Salle 123','https://evil.org','@everyone','Un lien www.test.ca','[ROOM]','{{fact.untrusted}}','Un texte — interdit'])('blocks unreferenced facts: %s',text=>{const w=fixturePlan();w.actions[5]={type:'draft_instagram',payload:{text}};expect(normalize(w,ctx).ok).toBe(false);});
 it('flags missing values and blocks approval',()=>{const p=plan({...ctx,facts:initialFacts()});expect(p.actions[0].needsInput).toEqual(['end','room']);expect(()=>reduce(p,op(p,'approve'))).toThrow('manquants');});
 it('refuses execution without approval, rejected actions, and draft execution',()=>{const p=plan();expect(()=>reduce(p,{...op(p,'execute'),phase:'start'})).toThrow();const rejected=reduce(p,op(p,'reject'));expect(()=>reduce(rejected,{...op(rejected,'execute'),phase:'start'})).toThrow();const approved=reduce(p,op(p,'approve',2));expect(()=>reduce(approved,{...op(approved,'execute',2),phase:'start'})).toThrow();});
 it('edits invalidate affected actions only and reject stale snapshots',()=>{let p=plan();p=reduce(p,op(p,'approve',0));p=reduce(p,op(p,'approve',6));const replacement=plan({...ctx,facts:{...ctx.facts,room:'Autre salle'}});const edited=reduce(p,{type:'edit',replacement,expectedRevision:p.revision});expect(edited.actions[0].status).toBe('proposed');expect(edited.actions[6].status).toBe('approved');expect(()=>reduce(edited,op(p,'approve',0))).toThrow('périmée');});
 it('executes one approved snapshot once across concurrent duplicate calls',async()=>{const store=new Store(mkdtempSync(join(tmpdir(),'relais-')));const p=plan();store.save(reduce(p,op(p,'approve')));const transport=vi.fn(async()=>({id:'mock-receipt',provider:'mock',simulated:true}));const ex=new ExecutionService(store,transport);const a=p.actions[0];await Promise.all([ex.run(p.id,a.id,a.payloadHash,'r1'),ex.run(p.id,a.id,a.payloadHash,'r2')]);await ex.run(p.id,a.id,a.payloadHash,'r3');expect(transport).toHaveBeenCalledTimes(1);expect(store.get(p.id).actions[0].status).toBe('executed');});
 it('uncertain dispatch cannot be retried automatically',async()=>{const store=new Store(mkdtempSync(join(tmpdir(),'relais-')));const p=plan();store.save(reduce(p,op(p,'approve')));const transport=vi.fn(async()=>{throw new Error('timeout');});const ex=new ExecutionService(store,transport);const a=p.actions[0];await ex.run(p.id,a.id,a.payloadHash,'r');expect(store.get(p.id).actions[0].status).toBe('unknown');expect(()=>ex.run(p.id,a.id,a.payloadHash,'retry')).toThrow();expect(transport).toHaveBeenCalledTimes(1);});
 it('cites two existing synthetic events',()=>{const s=suggestion('When should the next one be?');expect(s.citations).toHaveLength(2);expect(s.citations.every(c=>c.synthetic)).toBe(true);});
});

describe('Backboard plan transport',()=>{
 it('repairs a missing fact-reference brace without weakening grounding',()=>{
  const wire=fixturePlan();
  const meetup=wire.actions.find(a=>a.type==='draft_meetup')!;
  if(meetup.type!=='draft_meetup')throw new Error('Missing Meetup draft');
  meetup.payload.sections.registrationCTA='Inscris-toi ici : {{fact.rsvp}';
  const repaired=parsePlanArguments({planJson:JSON.stringify(wire)});
  expect(normalize(repaired,ctx).ok).toBe(true);
  expect(parsePlanArguments({planJson:JSON.stringify(repaired)})).toEqual(repaired);
  for(const text of ['Inscris-toi ici : {{fact.unknown}', 'Inscris-toi ici : https://invented.example.org', 'Rendez-vous à 23 h', '{{{fact.rsvp}}']){
   meetup.payload.sections.registrationCTA=text;
   expect(normalize(parsePlanArguments({planJson:JSON.stringify(wire)}),ctx).ok).toBe(false);
  }
 });
 it('decodes a JSON envelope and requires the full allowlisted plan schema',()=>{const wire=fixturePlan();expect(parsePlanArguments(JSON.stringify({planJson:JSON.stringify(wire)}))).toEqual(wire);for(const planJson of ['post a message',JSON.stringify({actions:['post a message'],followupPreview:'Later'}),JSON.stringify({...wire,actions:[{type:'send_email',payload:{text:'Hello'}}]})])expect(()=>parsePlanArguments({planJson})).toThrow();expect(()=>parsePlanArguments({planJson:JSON.stringify(wire),execute:true})).toThrow();});
});

describe('Contextual chat boundary',()=>{
 it('rejects unknown citations and execution fields in model replies',()=>{
  expect(()=>parseChatArguments({replyJson:JSON.stringify({text:'Bonjour',sources:['invented']})})).toThrow();
  expect(()=>parseChatArguments({replyJson:JSON.stringify({text:'Bonjour',sources:[],execute:true})})).toThrow();
 });
 it('preserves follow-up history and rejects stale or failed changes without creating plans',async()=>{
  const store=new Store(mkdtempSync(join(tmpdir(),'orbit-chat-')));
  const reply=vi.fn(async()=>({text:'Voici le brouillon.',draft:{title:'Message',text:'Salut !'},sources:['voice' as const]}));
  const chat=new ChatService(store,reply);
  const first=await chat.send({message:'Rédige un message',provider:'backboard',expectedRevision:0},'r1');
  await expect(chat.send({conversationId:first.id,message:'Plus court',provider:'backboard',expectedRevision:0},'r2')).rejects.toThrow('modifiée');
  const second=await chat.send({conversationId:first.id,message:'Plus court',provider:'backboard',expectedRevision:1},'r3');
  expect(reply.mock.calls[1]).toBeDefined();expect(second.turns).toHaveLength(2);
  expect(new ChatService(store).get(first.id)).toEqual(second);
  const failed=new ChatService(store,async()=>{throw new Error('timeout');});
  await expect(failed.send({conversationId:first.id,message:'Publie',provider:'backboard',expectedRevision:2},'r4')).rejects.toThrow('timeout');
  expect(chat.get(first.id).revision).toBe(2);expect(store.plans.size).toBe(0);expect(Object.keys(store.receipts)).toHaveLength(0);
  expect(()=>chat.get('../secrets')).toThrow();
 });
});

describe('Live plan validation repair',()=>{
 const evidence={toolCallId:'test-call',retrievedFiles:0};
 const invalid=()=>{const wire=fixturePlan();wire.actions[5]={type:'draft_instagram',payload:{text:'Jeudi 18 h, [ROOM]'}};return wire;};
 it('passes the failing field to one repair request and only returns a valid plan',async()=>{
  const request=vi.fn().mockResolvedValueOnce({wire:invalid(),evidence}).mockResolvedValueOnce({wire:fixturePlan(),evidence});
  const result=await validatedPlanWithRepair(ctx.facts,'test',request);
  expect(request).toHaveBeenCalledTimes(2);expect(request.mock.calls[1][0].errors[0]).toContain('actions[5].payload.text');expect(result.evidence.attempts).toBe(2);expect(normalize(result.wire,ctx).ok).toBe(true);
 });
 it('stops after one failed repair and does not return the invalid candidate',async()=>{
  const request=vi.fn().mockResolvedValue({wire:invalid(),evidence});
  await expect(validatedPlanWithRepair(ctx.facts,'test',request)).rejects.toThrow('après correction');expect(request).toHaveBeenCalledTimes(2);
 });
 it('does not retry valid results, network failures or exhausted budgets',async()=>{
  const valid=vi.fn().mockResolvedValue({wire:fixturePlan(),evidence});await validatedPlanWithRepair(ctx.facts,'test',valid);expect(valid).toHaveBeenCalledTimes(1);
  const failed=vi.fn().mockRejectedValue(new Error('timeout'));await expect(validatedPlanWithRepair(ctx.facts,'test',failed)).rejects.toThrow('timeout');expect(failed).toHaveBeenCalledTimes(1);
  const exhausted=vi.fn().mockResolvedValueOnce({wire:invalid(),evidence}).mockRejectedValue(new Error('Plafond de coût atteint.'));await expect(validatedPlanWithRepair(ctx.facts,'test',exhausted)).rejects.toThrow('Plafond');expect(exhausted).toHaveBeenCalledTimes(2);
 });
});

it('repairs literal JSON line breaks without accepting free text or malformed structure',()=>{
 expect(parseProviderJson('{"text":"Bonjour\nensemble"}')).toEqual({text:'Bonjour\nensemble'});
 expect(parseProviderJson(JSON.stringify({text:'A \"quote\" and \\ slash'}))).toEqual({text:'A \"quote\" and \\ slash'});
 expect(()=>parseProviderJson('post this now')).toThrow();expect(()=>parseProviderJson('{"text":"Hi"')).toThrow();
});

it('repairs a missing tool call once without treating network errors as format errors',async()=>{
 const request=vi.fn().mockRejectedValueOnce(new InvalidPlanOutput('Missing tool')).mockResolvedValueOnce({wire:fixturePlan(),evidence:{toolCallId:'fixed',retrievedFiles:0}});
 const result=await validatedPlanWithRepair(ctx.facts,'test',request);expect(result.evidence.attempts).toBe(2);expect(request.mock.calls[1][0].errors).toEqual(['Missing tool']);
});

it('stages organizer-authored Discord text as a manual fact without granting approval',()=>{
 const n=normalize({actions:[{type:'post_discord',payload:{channel:'announcements',text:'{{fact.message}}'}}],followupPreview:'Aucun suivi.'},{...ctx,provider:'manual',facts:factsSchema.parse({message:'Test à 18 h : https://example.org'})});
 expect(n.ok).toBe(true);if(!n.ok)return;expect(n.value.actions[0].text).toBe('Test à 18 h : https://example.org');expect(n.value.actions[0].approval).toBeUndefined();expect(n.value.actions[0].status).toBe('proposed');expect(()=>reduce(n.value,{...op(n.value,'execute'),phase:'start'})).toThrow();
});

it('reports a provider timeout clearly without a hidden retry',async()=>{
 const fetchMock=vi.fn().mockRejectedValue(new DOMException('Timed out','TimeoutError'));vi.stubGlobal('fetch',fetchMock);
 try{await expect(requestBackboard('test-key','/threads/messages',{})).rejects.toThrow('Message Discord');expect(fetchMock).toHaveBeenCalledTimes(1);}finally{vi.unstubAllGlobals();}
});

describe('Montreal event date picker',()=>{
 it('converts summer and winter selections independently of browser timezone',()=>{
  expect(fromLocalEventTime('2026-09-24T18:00')).toBe('2026-09-24T22:00:00Z');
  expect(fromLocalEventTime('2026-01-24T18:00')).toBe('2026-01-24T23:00:00Z');
  expect(toLocalEventTime('2026-09-24T18:00:00-04:00')).toBe('2026-09-24T18:00');
  expect(eventDateLabel('2026-09-24T22:00:00Z')).toContain('18');expect(fromLocalEventTime('')).toBe('');
 });
 it('rejects nonexistent dates and ambiguous or skipped DST times',()=>{
  for(const value of ['2026-02-30T18:00','2026-03-08T02:30','2026-11-01T01:30'])expect(()=>fromLocalEventTime(value)).toThrow();
 });
});

it('includes the connected account owner in Composio execution and preserves mention controls',async()=>{
 const fetchMock=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({status:'ACTIVE',user_id:'owner-test'}))).mockResolvedValueOnce(new Response(JSON.stringify({successful:true,data:{id:'receipt'}})));
 vi.stubGlobal('fetch',fetchMock);
 try{await composio('DISCORDBOT_CREATE_MESSAGE','ca_test','test-version',{channel_id:'channel-test',content:'Bonjour',allowed_mentions:{parse:[]}});const body=JSON.parse(fetchMock.mock.calls[1][1].body);expect(body.user_id).toBe('owner-test');expect(body.connected_account_id).toBe('ca_test');expect(body.arguments.allowed_mentions.parse).toEqual([]);}finally{vi.unstubAllGlobals();}
});

it.each([false,true])('reads Calendar receipts (wrapped=%s) and preserves approved times',async(wrapped)=>{
 const fetchMock=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({status:'ACTIVE',user_id:'owner-test'})}).mockResolvedValueOnce({ok:true,json:async()=>({successful:true,data:wrapped?{response_data:{id:'event-test',htmlLink:'https://www.google.com/calendar/event?eid=test'}}:{id:'event-test',htmlLink:'https://www.google.com/calendar/event?eid=test'}})});
 vi.stubGlobal('fetch',fetchMock);vi.stubEnv('SIDE_EFFECTS_ENABLED','true');
 try{
  const p=plan();p.provider='backboard';p.actions[0].executionBinding=executionBindings().calendar;
  const receipt=await dispatch(p.actions[0],p);
  expect(receipt).toMatchObject({id:'event-test',provider:'composio',simulated:false,url:'https://www.google.com/calendar/event?eid=test'});
  const args=JSON.parse(fetchMock.mock.calls[1][1].body).arguments;
  expect(args).toMatchObject({start_datetime:'2026-09-24T22:00:00',end_datetime:'2026-09-25T00:00:00',timezone:'UTC',send_updates:'none',create_meeting_room:false});
 }finally{vi.unstubAllGlobals();vi.unstubAllEnvs();}
});

it('accepts long event descriptions without using them as titles and explains oversized requests',()=>{
 const prompt='Introduction au cloud\n'+ 'Contexte de la rencontre. '.repeat(150);
 const request={prompt,provider:'backboard',clientId:crypto.randomUUID(),seq:1};
 expect(planRequestSchema.safeParse(request).success).toBe(true);
 expect(titleFromShortPrompt(prompt)).toBe('');
 expect(titleFromShortPrompt('Introduction au cloud & AWS')).toBe('Introduction au cloud & AWS');
 const tooLong=planRequestSchema.safeParse({...request,prompt:'a'.repeat(12001)});
 expect(tooLong.success).toBe(false);
 if(!tooLong.success)expect(tooLong.error.issues[0].message).toContain('12 000');
});

it('prefills explicit French event details from a pasted announcement',()=>{
 const facts=extractEventFacts('Introduction au cloud & AWS\n📅 Détails\n• Date : lundi 21 septembre 2026\n• Heure : 16h00 - 18h00\n• Lieu : UQAM - Pavillon Président-Kennedy (PK-1140), 201 av. du Président-Kennedy\n👥 Pour qui ?\n• Débutant·es, sans aucune expérience du cloud\nInscription : https://www.meetup.com/club/events/123/');
 expect(facts).toMatchObject({title:'Introduction au cloud & AWS',start:'2026-09-21T20:00:00Z',end:'2026-09-21T22:00:00Z',rsvp:'https://www.meetup.com/club/events/123/',audience:'Débutant·es, sans aucune expérience du cloud',groupPage:''});
 expect(facts.room).toContain('PK-1140');
 expect(facts.dateLabel).toContain('16 h');
 expect(extractEventFacts('Date : 21 septembre 2026 ou 22 septembre 2026\nHeure : 16h00 - 18h00').start).toBe('');
 expect(extractEventFacts('Un atelier bientôt').room).toBe('');
});

it('stages only a selected, current, complete chat draft for Discord',()=>{
 const conversation:Conversation={version:1,id:crypto.randomUUID(),revision:2,provider:'backboard',turns:[{message:'Draft',at:'now',reply:{text:'Voici',draft:{title:'Message',text:'Bonjour à toute l’équipe !'},sources:[]}}]};
 expect(chatDraftForDiscord(conversation,2,0)).toBe('Bonjour à toute l’équipe !');
 expect(()=>chatDraftForDiscord(conversation,1,0)).toThrow('modifiée');
 expect(()=>chatDraftForDiscord(conversation,2,1)).toThrow('brouillon');
 for(const text of ['a'.repeat(2001),'Rendez-vous à [ROOM]','Bonjour {{fact.title}}']){
  conversation.turns[0].reply.draft!.text=text;
  expect(()=>chatDraftForDiscord(conversation,2,0)).toThrow();
 }
});

it.each(['success','mismatch','failed','missing'])('verifies uncertain execution without dispatching again: %s',async(outcome)=>{
 const store=new Store(mkdtempSync(join(tmpdir(),'orbit-verify-')));
 let p=plan();p.provider='backboard';p=reduce(p,op(p,'approve'));store.save(p);
 const args={summary:'Approved title'};
 const transport=vi.fn(async(_action:unknown,_plan:unknown,capture?: (e:any)=>void)=>{
  if(outcome!=='missing')capture?.({logId:'log_test',slug:'GOOGLECALENDAR_CREATE_EVENT',account:'ca_test',args});
  throw new Error('Receipt unavailable');
 });
 const service=new ExecutionService(store,transport);
 const uncertain=await service.run(p.id,p.actions[0].id,p.actions[0].payloadHash,'execute-request');
 expect(uncertain.actions[0].status).toBe('unknown');
 const fetchMock=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:'log_test',status:outcome==='failed'?'failed':'success',metadata:{connected_account_id:outcome==='mismatch'?'ca_other':'ca_test',tool:{slug:'GOOGLECALENDAR_CREATE_EVENT'}},data:{request:{payload:args},response:{body:{successful:true,data:{response_data:{id:'confirmed-event',htmlLink:'https://www.google.com/calendar/event?eid=test'}}}}}})});
 vi.stubGlobal('fetch',fetchMock);
 try{
  if(outcome==='success'){
   const checked=await service.verify(p.id,p.actions[0].id,p.actions[0].payloadHash,'verify-request');
   expect(checked.actions[0].status).toBe('executed');expect(checked.actions[0].receipt?.id).toBe('confirmed-event');
  }else{
   await expect(service.verify(p.id,p.actions[0].id,p.actions[0].payloadHash,'verify-request')).rejects.toThrow();
   expect(store.get(p.id).actions[0].status).toBe('unknown');
  }
  expect(transport).toHaveBeenCalledTimes(1);
  if(outcome==='missing')expect(fetchMock).not.toHaveBeenCalled();
  else expect(fetchMock.mock.calls[0][0]).toContain('/logs/tool_execution/log_test');
 }finally{vi.unstubAllGlobals();}
});

it('pins the actual execution configuration, not just the displayed target label',()=>{
 vi.stubEnv('COMPOSIO_CALENDAR_ACCOUNT','ca_original');vi.stubEnv('GOOGLE_CALENDAR_ID','primary');
 try{
  const p=plan({...ctx,executionBindings:executionBindings()});
  const a=p.actions[0];expect(()=>assertExecutionBinding(a)).not.toThrow();
  vi.stubEnv('COMPOSIO_CALENDAR_ACCOUNT','ca_other');
  expect(()=>assertExecutionBinding(a)).toThrow('changé');
  const changed=plan({...ctx,executionBindings:executionBindings()});
  expect(changed.actions[0].destination).toBe(a.destination);
  expect(changed.actions[0].payloadHash).not.toBe(a.payloadHash);
  expect(()=>assertExecutionBinding({...a,executionBinding:undefined})).toThrow('changé');
 }finally{vi.unstubAllEnvs();}
});
it('rejects approval records bound to another destination',()=>{
 let p=plan();p=reduce(p,op(p,'approve'));p.actions[0].approval!.destination='another-calendar';
 expect(()=>reduce(p,{...op(p,'execute'),phase:'start'})).toThrow('non approuvée');
});
