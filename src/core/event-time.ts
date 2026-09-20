export const eventTimezone='America/Montreal';
const partsFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:eventTimezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function toLocalEventTime(value:string):string {
  if(!value)return '';
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';
  const parts=Object.fromEntries(partsFormatter.formatToParts(date).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function fromLocalEventTime(value:string):string {
  if(!value)return '';
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Choisis une date et une heure complètes.');
  const nominal=Date.parse(value+':00Z');
  if(!Number.isFinite(nominal))throw new Error('Date invalide.');
  const matches:number[]=[];
  for(let offset=-14*60;offset<=14*60;offset+=15){
    const candidate=nominal+offset*60000;
    if(toLocalEventTime(new Date(candidate).toISOString())===value)matches.push(candidate);
  }
  if(matches.length===0)throw new Error('Cette heure n’existe pas à Montréal lors du changement d’heure. Choisis une autre heure.');
  if(matches.length>1)throw new Error('Cette heure se produit deux fois lors du changement d’heure. Choisis une heure avant ou après cette période.');
  return new Date(matches[0]).toISOString().replace('.000Z','Z');
}
export function eventDateLabel(value:string,locale='fr-CA'):string {
  if(!value)return '';
  return new Intl.DateTimeFormat(locale,{timeZone:eventTimezone,weekday:'long',day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
}
