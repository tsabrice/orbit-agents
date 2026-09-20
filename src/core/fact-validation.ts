import type { Facts } from './model';
export function factErrors(facts:Facts):Partial<Record<keyof Facts,string>> {
 const errors:Partial<Record<keyof Facts,string>>={};
 for(const key of ['rsvp','groupPage'] as const){
  const text=facts[key].trim();if(!text)continue;
  try{const url=new URL(text);if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw 0;}
  catch{errors[key]=key==='groupPage'?'Collez l’URL complète de la page du groupe, par exemple https://www.linkedin.com/company/nom-du-groupe/. Vous pouvez laisser ce champ vide.':'Collez un lien d’inscription complet commençant par https://. Vous pouvez laisser ce champ vide.';}
 }
 for(const key of ['start','end'] as const){
  if(facts[key]&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(facts[key])||!Number.isFinite(Date.parse(facts[key]))))errors[key]='Choisissez une date et une heure valides.';
 }
 if(!errors.start&&!errors.end&&facts.start&&facts.end&&Date.parse(facts.end)<=Date.parse(facts.start))errors.end='La fin doit être après le début. Vérifiez aussi la date choisie.';
 for(const [key,value] of Object.entries(facts)){
  if(value.includes('\u2014'))errors[key as keyof Facts]='Remplacez le tiret cadratin par un tiret simple.';
  if(value.length>(key==='message'?2000:1000))errors[key as keyof Facts]='Ce champ est trop long.';
 }
 return errors;
}
