import { uiText } from './ui-text';
import { useEffect, useRef, useState } from 'react';
import { fromLocalEventTime, toLocalEventTime } from '../core/event-time';

export function DateTimePicker({value,label,readOnly=false,onChange}:{value:string;label:string;readOnly?:boolean;onChange:(value:string)=>void}){
  const ref=useRef<HTMLInputElement>(null);
  const [local,setLocal]=useState(()=>toLocalEventTime(value));
  const [error,setError]=useState('');
  const last=useRef(value);
  useEffect(()=>{if(value!==last.current){setLocal(toLocalEventTime(value));setError('');last.current=value;}},[value]);
  return <span className="datetime-control"><span className="datetime-picker-row"><input ref={ref} aria-label={label} type="datetime-local" step="60" value={local} readOnly={readOnly} aria-invalid={!!error} onChange={e=>{
    const next=e.target.value;setLocal(next);setError('');
    try{const iso=fromLocalEventTime(next);last.current=iso;onChange(iso);}catch(cause){last.current='';onChange('');setError((cause as Error).message);}
  }}/>{!readOnly&&<button type="button" aria-label={`Choose ${label.toLowerCase()}`} onClick={()=>{try{ref.current?.showPicker();}catch{ref.current?.focus();}}}>Choose</button>}</span><small>Montréal time</small>{error&&<small role="alert">{uiText(error)}</small>}</span>;
}
