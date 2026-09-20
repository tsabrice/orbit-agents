import { factsSchema, type Facts } from './model';
import { eventDateLabel, fromLocalEventTime } from './event-time';
import { titleFromShortPrompt } from './plan-request';

const months=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
// Extract explicit input only. Ambiguous dates/times stay empty for organizer review.
export function extractEventFacts(prompt:string):Facts {
 const facts=factsSchema.parse({});
 const lines=prompt.split(/\r?\n/).map(line=>line.trim().replace(/^[^\p{L}\p{N}]+/u,'')).filter(Boolean);
 const field=(names:string)=>{
  const values=lines.flatMap(line=>{const m=line.match(new RegExp(`^(?:${names})\\s*:\\s*(.+)$`,'iu'));return m?[m[1]]:[];});
  return new Set(values).size===1?values[0]:'';
 };
 facts.title=field('titre|title|événement|event')||titleFromShortPrompt(prompt);
 if(!facts.title&&lines[0]&&lines[0].length<=200&&!/:|https?:|\d/.test(lines[0])&&!/^(?:bonjour|salut|rédige|peux-tu|crée|détails|date|heure|lieu)/i.test(lines[0]))facts.title=lines[0];
 facts.room=field('lieu|salle|location|venue|room');
 facts.audience=field('public|audience|pour qui');
 if(!facts.audience){const i=lines.findIndex(l=>/^pour qui\s*\??\s*$/i.test(l));if(i>=0&&lines[i+1]&&!/:/.test(lines[i+1]))facts.audience=lines[i+1];}
 const urls=[...new Set(prompt.match(/https:\/\/[^\s<>]+/g)||[])].map(url=>url.replace(/[).,;]+$/,''));
 const eventLinks=urls.filter(url=>{try{return /(^|\.)meetup\.com$/.test(new URL(url).hostname)&&/\/events\/\d+/.test(new URL(url).pathname);}catch{return false;}});
 const rsvp=field('rsvp|inscription|inscriptions|registration|lien rsvp');
 facts.rsvp=(rsvp.match(/https:\/\/[^\s<>]+/)||[])[0]||(eventLinks.length===1?eventLinks[0]:'');
 const groups=urls.filter(url=>{try{return new URL(url).hostname.endsWith('linkedin.com')&&new URL(url).pathname.startsWith('/company/');}catch{return false;}});
 facts.groupPage=field('page du groupe|group page')||(groups.length===1?groups[0]:'');
 const dates=new Set<string>();
 for(const match of prompt.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g))dates.add(`${match[1]}-${match[2]}-${match[3]}`);
 for(const match of prompt.matchAll(new RegExp(`\\b(\\d{1,2})\\s+(${months.join('|')})\\s+(\\d{4})\\b`,'gi')))dates.add(`${match[3]}-${String(months.indexOf(match[2].toLowerCase())+1).padStart(2,'0')}-${match[1].padStart(2,'0')}`);
 const times=[...prompt.matchAll(/\b([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)?\s*(?:-|–|—|à|to)\s*([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)?\b/gi)];
 if(dates.size===1&&times.length===1){
  const date=[...dates][0], t=times[0];
  try{
   const start=fromLocalEventTime(`${date}T${t[1].padStart(2,'0')}:${t[2]||'00'}`);
   const end=fromLocalEventTime(`${date}T${t[3].padStart(2,'0')}:${t[4]||'00'}`);
   if(Date.parse(end)>Date.parse(start)){facts.start=start;facts.end=end;facts.dateLabel=eventDateLabel(start);}
  }catch{/* Invalid or ambiguous local time requires input. */}
 }
 for(const key of Object.keys(facts) as (keyof Facts)[])if(facts[key].length>1000)facts[key]='';
 return facts;
}
