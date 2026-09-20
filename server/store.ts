import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Action, Plan } from '../src/core/model';
export type Audit = {version:1;id:string;at:string;requestId:string;planId?:string;actionId?:string;event:string;detail:string};
export class Store {
  plans=new Map<string,Plan>(); receipts:Record<string,NonNullable<Action['receipt']>>={};
  constructor(readonly dir=resolve(process.env.DATA_DIR||'.data')) {
    mkdirSync(dir,{recursive:true,mode:0o700});
    if(existsSync(`${dir}/plans.json`))for(const p of JSON.parse(readFileSync(`${dir}/plans.json`,'utf8')) as Plan[]){for(const a of p.actions)if(a.status==='executing'||a.status==='approved'&&a.capability==='real'){a.status='unknown';a.error='Redémarrage : résultat à vérifier, aucune relance automatique.';}this.plans.set(p.id,p);}
    if(existsSync(`${dir}/receipts.json`))this.receipts=JSON.parse(readFileSync(`${dir}/receipts.json`,'utf8'));
  }
  write(name:string,value:unknown){writeFileSync(`${this.dir}/${name}.tmp`,JSON.stringify(value),{mode:0o600});renameSync(`${this.dir}/${name}.tmp`,`${this.dir}/${name}.json`);}
  save(p:Plan){const values=[...this.plans.values()].filter(x=>x.id!==p.id);values.push(p);this.write('plans',values);this.plans.set(p.id,p);return p;}
  get(id:string){const p=this.plans.get(id);if(!p)throw new Error('Plan introuvable.');return p;}
  remember(key:string,receipt:NonNullable<Action['receipt']>){this.write('receipts',{...this.receipts,[key]:receipt});this.receipts[key]=receipt;}
  log(record:Omit<Audit,'version'|'id'|'at'>){appendFileSync(`${this.dir}/audit.jsonl`,JSON.stringify({version:1,id:crypto.randomUUID(),at:new Date().toISOString(),...record})+'\n',{mode:0o600});}
  logs(){if(!existsSync(`${this.dir}/audit.jsonl`))return [];return readFileSync(`${this.dir}/audit.jsonl`,'utf8').trim().split('\n').filter(Boolean).slice(-200).map(x=>JSON.parse(x) as Audit).reverse();}
}
