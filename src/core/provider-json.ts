// Some provider envelopes contain literal line breaks inside JSON string values.
// Escape only those control characters. Never guess keys, values, or intent.
export function parseProviderJson(input:string):unknown {
  let quoted=false, escaped=false, output='';
  for(const character of input){
    if(quoted&&!escaped&&character.charCodeAt(0)<32){
      output+=JSON.stringify(character).slice(1,-1);
      continue;
    }
    output+=character;
    if(escaped){escaped=false;continue;}
    if(quoted&&character==='\\'){escaped=true;continue;}
    if(character==='"')quoted=!quoted;
  }
  return JSON.parse(output);
}
