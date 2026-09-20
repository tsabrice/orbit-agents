import { useEffect, useRef, useState } from 'react';
import type { ChatSource, Conversation } from '../core/chat';
import { Icon } from './Icons';

export function Chat({token,liveReady,discordReady,discordTarget,onPrepareDiscord}:{token:string;liveReady:boolean;discordReady:boolean;discordTarget:string;onPrepareDiscord:(conversationId:string,expectedRevision:number,turnIndex:number)=>Promise<void>}) {
  const [conversation,setConversation]=useState<Conversation|null>(null);
  const [sources,setSources]=useState<ChatSource[]>([]);
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [copied,setCopied]=useState<number|null>(null);
  const [preparing,setPreparing]=useState<number|null>(null);
  const transcript=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight;},[conversation?.revision]);
  async function api(path:string,body?:unknown){
    const r=await fetch(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await r.json();if(!r.ok)throw new Error(data.error||'Conversation indisponible.');return data;
  }
  useEffect(()=>{
    let active=true;
    api('/api/chat/context').then(data=>{if(active)setSources(data);}).catch(()=>{});
    const id=sessionStorage.getItem('orbit-chat');
    if(id)api(`/api/chat/${id}`).then((data:Conversation)=>{if(active){if(data.provider==='backboard')setConversation(data);else sessionStorage.removeItem('orbit-chat');}}).catch(()=>{if(active)setError('La conversation enregistrée est indisponible. Tu peux en démarrer une nouvelle.');});
    return()=>{active=false;};
  },[token]);
  function reset(){setConversation(null);sessionStorage.removeItem('orbit-chat');setError('');setCopied(null);setMessage('');}
  async function send(){
    if(!message.trim()||busy||preparing!==null||!liveReady)return;
    setBusy(true);setError('');
    try {const result=await api('/api/chat',{message,provider:'backboard',expectedRevision:conversation?.revision||0,...(conversation?{conversationId:conversation.id}:{})});setConversation(result);sessionStorage.setItem('orbit-chat',result.id);setMessage('');setCopied(null);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="chat-panel" id="conversation" aria-label="Conversation avec Communauté">
    <div className="chat-heading"><div className="composer-agent"><span className="agent-icon mini"><Icon name="people"/></span><div><h2>Parlons de ce dont tu as besoin.</h2><small>Un message précis, une question, une idée à affiner.</small></div></div><span className={`badge ${liveReady?'live':''}`}>{liveReady?'LIVE':'À CONFIGURER'}</span></div>
    <div className="chat-controls"><span className="muted">Backboard {liveReady?'live':'non configuré'}</span><button className="quiet" onClick={reset} disabled={busy||preparing!==null}>Nouvelle conversation</button></div>
    <details className="chat-context"><summary>Contexte du club · {sources.length} sources</summary><p>Documents sélectionnés du club, conservés côté serveur. Certaines informations datées restent à confirmer. Ce contexte ne se synchronise pas automatiquement avec ton dossier.</p><ul>{sources.map(source=><li key={source.id}><strong>{source.title}</strong><span>{source.note}</span></li>)}</ul></details>
    <div ref={transcript} className="chat-transcript" role="log" aria-label="Messages de la conversation" aria-live="polite" aria-busy={busy}>{conversation?.turns.map((turn,index)=><div className="chat-turn" key={index}><div className="chat-user"><span>Vous</span><p>{turn.message}</p></div><div className="chat-assistant"><span>Communauté</span><p>{turn.reply.text}</p>{turn.reply.draft&&<article className="chat-draft"><div className="section-heading"><h3>{turn.reply.draft.title}</h3><span className="badge subtle">BROUILLON, NON PUBLIÉ</span></div><p>{turn.reply.draft.text}</p><button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(turn.reply.draft!.text);setCopied(index);}catch{setError('Copie indisponible. Sélectionne le texte du brouillon.');}}}>{copied===index?'Copié ✓':'Copier le brouillon'}</button><div className="chat-draft-actions"><button className="primary" disabled={busy||preparing!==null||!discordReady||turn.reply.draft.text.trim().length>2000} onClick={async()=>{if(preparing!==null)return;setPreparing(index);setError('');try{await onPrepareDiscord(conversation.id,conversation.revision,index);}catch(cause){setError((cause as Error).message);}finally{setPreparing(null);}}}>{preparing===index?'Préparation…':'Préparer pour approbation Discord'}</button><small className="muted">{discordReady?`Destination : #${discordTarget}. Une carte sera créée pour relecture et approbation. Aucun envoi à cette étape.`:'Configurez Discord pour préparer une publication.'}{turn.reply.draft.text.trim().length>2000?' Ce brouillon dépasse la limite Discord de 2 000 caractères. Demandez une version plus courte.':''}</small></div></article>}{turn.reply.sources.length>0&&<div className="chat-citations">Sources citées : {turn.reply.sources.map(id=>sources.find(s=>s.id===id)?.title||id).join(' · ')}</div>}</div></div>)}</div>
    {busy&&<p role="status" className="muted">Communauté prépare sa réponse…</p>}
    {error&&<p role="alert" className="error">{error}</p>}
    <form className="chat-compose" onSubmit={e=>{e.preventDefault();void send();}}><label htmlFor="chat-message">Ton message</label><textarea id="chat-message" value={message} onChange={e=>setMessage(e.target.value)} maxLength={4000} rows={3} placeholder="Par exemple : rends ce message plus court et plus chaleureux."/><div className="composer-bottom"><small className="muted">Brouillons à relire et à copier. Rien n’est publié depuis cette conversation.</small><button type="submit" className="primary" disabled={busy||preparing!==null||!liveReady||!message.trim()}>{busy?'Un instant…':'Envoyer à l’agent →'}</button></div></form>
  </section>;
}
