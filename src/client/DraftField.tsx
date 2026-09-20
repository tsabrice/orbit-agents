import { FactInput } from './FactInput';
import type { Facts } from '../core/model';

const labels:Record<keyof Facts,string>={title:'Event title',dateLabel:'Display date',start:'Start date and time',end:'End date and time',room:'Location',rsvp:'Registration URL',groupPage:'Group page URL',audience:'Audience',technicalName:'Technical term',message:'Message'};
export function DraftField({label,value,facts,locked,onText,onFact}:{label:string;value:string;facts:Facts;locked:Set<string>;onText:(value:string)=>void;onFact:(key:keyof Facts,value:string)=>void}){
  const parts=value.split(/(\{\{fact\.[A-Za-z][A-Za-z0-9]*\}\})/g);
  const firstText=parts.findIndex(part=>part.trim()&&!/^\{\{fact\./.test(part));
  return <fieldset className="draft-field"><legend>{label}</legend>{parts.map((part,index)=>{
    const match=part.match(/^\{\{fact\.([A-Za-z][A-Za-z0-9]*)\}\}$/);
    if(match){const key=match[1] as keyof Facts;return <label className="draft-fact" key={index}><span>{labels[key]}{!facts[key]?.trim()&&<small>Missing</small>}</span><FactInput field={key} label={key==='dateLabel'?labels.start:labels[key]} facts={facts} readOnly={locked.has(key)||key==='dateLabel'&&locked.has('start')||key==='start'&&locked.has('dateLabel')} onChange={value=>onFact(key==='dateLabel'?'start':key,value)}/>
{locked.has(key)&&<small>Used by an executed action. It cannot be changed here.</small>}</label>;}
    if(!part.trim())return null;
    if(!/[\p{L}\p{N}]/u.test(part))return <span key={index} aria-hidden="true" className="draft-marker">{part.trim()}</span>;
    return <textarea key={index} aria-label={index===firstText?label:`${label}, suite ${index}`} value={part} rows={Math.min(6,Math.max(2,part.split('\n').length))} onChange={e=>{const next=[...parts];next[index]=e.target.value;onText(next.join(''));}}/>;
  })}</fieldset>;
}
