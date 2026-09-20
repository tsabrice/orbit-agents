import express from 'express';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { z } from 'zod';
import { factsSchema, normalize, reduce, wireAction, type Context, type Plan } from '../src/core/model';
import { fixtureIndex, fixturePlan, fixturePrompts, initialFacts, suggestion } from '../src/core/fixtures';
import { Store } from './store';
import { capabilities, ExecutionService, keyFor } from './executors';
import { backboardReady, generatePlan } from './backboard';
if(existsSync('.env'))loadEnvFile('.env');
const host=process.env.HOST||'127.0.0.1'; const token=process.env.ORGANIZER_TOKEN;
if((host!=='127.0.0.1'||process.env.NODE_ENV==='production')&&!token)throw new Error('ORGANIZER_TOKEN requis en production ou hors loopback.');
const app=express(); app.disable('x-powered-by'); app.set('trust proxy','loopback');app.use(express.json({limit:'80kb'}));
const store=new Store(); const executor=new ExecutionService(store);
app.use((req,res,next)=>{res.locals.requestId=randomUUID();res.setHeader('X-Request-Id',res.locals.requestId);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');next();});
app.get('/api/status',(_req,res)=>res.json({authRequired:!!token,liveReady:backboardReady(),sideEffects:process.env.SIDE_EFFECTS_ENABLED==='true',fixtures:fixturePrompts,capabilities:capabilities()}));
const limits=new Map<string,{count:number;at:number}>();
app.use('/api',(req,res,next)=>{
 res.setHeader('Cache-Control','no-store');
 const origin=req.headers.origin;if(origin){try{if(new URL(origin).host!==req.headers.host)return res.status(403).json({error:'Origine refusée.'});}catch{return res.status(403).json({error:'Origine invalide.'});}}
 if(token&&process.env.NODE_ENV==='production'&&!req.secure)return res.status(403).json({error:'HTTPS requis pour les opérations authentifiées.'});
 if(token){const actual=Buffer.from(req.headers.authorization||'');const expected=Buffer.from(`Bearer ${token}`);if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return res.status(401).json({error:'Jeton organisateur requis.'});}
 if(req.method==='POST'){
  if(!req.is('application/json'))return res.status(415).json({error:'JSON requis.'});
  const now=Date.now();for(const [k,v]of limits)if(now-v.at>60000)limits.delete(k);
  const kind=req.path==='/plan'||req.path==='/ask'?'generation':'operation';const key=kind+req.socket.remoteAddress;const entry=limits.get(key)||{at:now,count:0};
  if(++entry.count>(kind==='generation'?10:60))return res.status(429).json({error:'Limite atteinte. Réessayez dans une minute.'});limits.set(key,entry);
 }next();
});
function context(pick:{provider:Plan['provider'];facts:Plan['facts'];id?:string;requestId:string}):Context{const caps=capabilities();return {...pick,id:pick.id||randomUUID(),now:pick.provider==='scripted'?'2026-09-19T22:45:00-04:00':new Date().toISOString(),calendarEnabled:pick.provider==='scripted'||caps.calendar,discordEnabled:pick.provider==='scripted'||caps.discord,calendarTarget:pick.provider==='scripted'?'Calendar de démonstration':caps.calendarTarget,discordTarget:pick.provider==='scripted'?'#announcements (simulation)':caps.discordTarget};}
const latest=new Map<string,number>();
app.post('/api/plan',async(req,res)=>{
 const input=z.object({prompt:z.string().min(1).max(2000),provider:z.enum(['scripted','backboard']),clientId:z.string().uuid(),seq:z.number().int().positive(),facts:factsSchema.optional()}).strict().parse(req.body);
 if((latest.get(input.clientId)||0)>=input.seq)return res.status(409).json({error:'Requête périmée.'});latest.set(input.clientId,input.seq);
 try {
  const facts=input.provider==='scripted'?{...initialFacts(fixtureIndex(input.prompt)),...input.facts}:input.facts||factsSchema.parse({title:input.prompt});
  const generated=input.provider==='scripted'?{wire:fixturePlan(),evidence:undefined}:await generatePlan(input.prompt,facts,res.locals.requestId);
  if(latest.get(input.clientId)!==input.seq)return res.status(409).json({error:'Réponse périmée ignorée.'});
  const result=normalize(generated.wire,context({provider:input.provider,facts,requestId:res.locals.requestId}));if(!result.ok)return res.status(422).json({error:result.errors.join(' '),fallback:true});
  result.value.evidence=generated.evidence;
  store.log({requestId:res.locals.requestId,planId:result.value.id,event:'propose',detail:`${input.provider} · ${result.value.actions.length} actions`});res.json(store.save(reduce(null,{type:'propose',proposal:result.value})));
 }catch(e){res.status(422).json({error:(e as Error).message,fallback:true});}
});
app.get('/api/plans/:id',(req,res)=>res.json(store.get(req.params.id)));
const decision=z.object({type:z.enum(['approve','reject','execute','confirm_posted','confirm_not_posted']),actionId:z.string().max(100),expectedHash:z.string().max(30000)}).strict();
const edit=z.object({type:z.literal('edit'),expectedRevision:z.number().int(),facts:factsSchema.optional(),actionId:z.string().optional(),wire:wireAction.optional()}).strict();
app.post('/api/plans/:id/ops',async(req,res)=>{
 const op=z.union([decision,edit]).parse(req.body);const id=req.params.id;let plan=store.get(id);const requestId=res.locals.requestId;
 if(op.type==='edit'){
  let wire=plan.wire;if(op.wire){const idx=plan.actions.findIndex(a=>a.id===op.actionId);if(idx<0||op.wire.type!==plan.actions[idx].type)throw new Error('Type et identité immuables.');wire={...wire,actions:wire.actions.map((a,i)=>i===idx?op.wire!:a)};}
  const ctx=context({id:plan.id,provider:plan.provider,facts:op.facts||plan.facts,requestId:plan.requestId});
  const normalized=normalize(wire,ctx);if(!normalized.ok)return res.status(422).json({error:normalized.errors.join(' ')});
  // Preserve the original execution targets even if config changes while a plan is open.
  for(let i=0;i<plan.actions.length;i++)if(normalized.value.actions[i].destination!==plan.actions[i].destination||normalized.value.actions[i].capability!==plan.actions[i].capability)return res.status(409).json({error:'Configuration modifiée. Générez un nouveau plan.'});
  plan=reduce(plan,{type:'edit',replacement:{...normalized.value,createdAt:plan.createdAt,evidence:plan.evidence},expectedRevision:op.expectedRevision});
  store.log({requestId,planId:id,event:'edit',detail:'Faits ou brouillon révisés'});return res.json(store.save(plan));
 }
 const a=plan.actions.find(a=>a.id===op.actionId);if(!a||a.payloadHash!==op.expectedHash)return res.status(409).json({error:'Action périmée. Rechargez le plan.'});
 if(op.type==='confirm_posted'||op.type==='confirm_not_posted'){
  if(a.status!=='unknown')throw new Error('Cette action n’est pas incertaine.');
  store.log({requestId,planId:id,actionId:a.id,event:op.type,detail:'Déclaration manuelle de l’organisateur, pas un reçu fournisseur.'});
  if(op.type==='confirm_not_posted')return res.json(plan);
  const receipt={id:`manual-${randomUUID()}`,provider:'manual-confirmation',simulated:plan.provider==='scripted'};
  plan=reduce(plan,{type:'execute',actionId:a.id,expectedHash:a.payloadHash,at:new Date().toISOString(),phase:'success',receipt});store.remember(keyFor(a),receipt);return res.json(store.save(plan));
 }
 if((op.type==='approve'||op.type==='execute')&&a.capability==='real'&&plan.provider!=='scripted'&&process.env.SIDE_EFFECTS_ENABLED!=='true')throw new Error('Actions externes désactivées.');
 if(op.type==='approve'&&['executed','executing','approved'].includes(a.status)&&a.capability==='real')return res.json(await executor.run(id,a.id,op.expectedHash,requestId));
 if(op.type==='execute')return res.json(await executor.run(id,a.id,op.expectedHash,requestId));
 plan=reduce(plan,{type:op.type,actionId:a.id,expectedHash:op.expectedHash,at:new Date().toISOString()});store.log({requestId,planId:id,actionId:a.id,event:op.type,detail:a.type});store.save(plan);
 if(op.type==='approve'&&a.capability==='real')plan=await executor.run(id,a.id,op.expectedHash,requestId);res.json(plan);
});
app.get('/api/log',(_req,res)=>res.json(store.logs()));
app.post('/api/ask',(req,res)=>{const {question}=z.object({question:z.string().min(1).max(2000)}).strict().parse(req.body);res.json(suggestion(question));});
app.use('/api',(_req,res)=>res.status(404).json({error:'Route inconnue.'}));
if(process.env.NODE_ENV==='production'){app.use(express.static(resolve('dist')));app.get('/{*path}',(_req,res)=>res.sendFile(resolve('dist/index.html')));}
else {const {createServer}=await import('vite');app.use((await createServer({server:{middlewareMode:true,hmr:{port:Number(process.env.PORT||3002)+1}},appType:'spa'})).middlewares);}
app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{res.status(400).json({error:error instanceof z.ZodError?'Opération invalide.':error instanceof Error?error.message:'Erreur inconnue.',requestId:res.locals.requestId});});
const port=Number(process.env.PORT||3002);app.listen(port,host,(error?:Error)=>{if(error){console.error('Relais could not bind its local port. Choose an unused PORT.');process.exit(1);}console.log(`Relais: http://${host}:${port} · ${backboardReady()?'live configured':'scripted'} · ${token?'token protected':'local development only'}`);});
