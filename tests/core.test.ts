import { describe,it,expect,vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixturePlan,initialFacts,fixturePrompts,fixtureIndex,suggestion } from '../src/core/fixtures';
import { normalize,reduce,TERMS,type Context,type Plan } from '../src/core/model';
import { Store } from '../server/store';
import { ExecutionService } from '../server/executors';
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
