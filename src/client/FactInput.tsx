import { uiText } from './ui-text';
import { useId } from 'react';
import type { Facts } from '../core/model';
import { factErrors } from '../core/fact-validation';
import { DateTimePicker } from './DateTimePicker';
export function FactInput({field,label,facts,readOnly=false,onChange}:{field:keyof Facts;label:string;facts:Facts;readOnly?:boolean;onChange:(value:string)=>void}){
 const id=useId();const key=field==='dateLabel'?'start':field;
 const error=factErrors(facts)[key];const link=key==='rsvp'||key==='groupPage';
 return <span className="fact-input">
 {key==='start'||key==='end'?<DateTimePicker label={label} value={facts[key]} readOnly={readOnly} onChange={onChange}/>:<input aria-label={label} type={link?'url':'text'} aria-invalid={!!error} aria-describedby={id} value={facts[key]} readOnly={readOnly} placeholder={key==='groupPage'?'https://www.linkedin.com/company/…':key==='rsvp'?'https://www.meetup.com/…':''} onChange={e=>onChange(e.target.value)} onBlur={()=>{if(!readOnly&&facts[key]!==facts[key].trim())onChange(facts[key].trim());}}/>}
 <small id={id} className={error?'field-error':'muted'}>{uiText(error||'')||(key==='groupPage'?'Group page link for drafts that reference it. Leaving it blank does not block Calendar or Discord.':key==='rsvp'?'Registration link for this event.':'')}</small>
 </span>;
}
