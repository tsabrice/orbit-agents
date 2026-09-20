import { uiText } from './ui-text';
import { useEffect, useRef, useState } from 'react';
import type { ChatSource, Conversation } from '../core/chat';
import { Icon } from './Icons';

const sourceLabels:Record<string,{title:string;note:string}>={
 'voice':{title:'Club voice and formats',note:'Writing guide used by Orbit'},
 'club-overview':{title:'Club overview',note:'July 2026 · some details need confirmation'},
 'presentation-design':{title:'Presentation preferences',note:'Design guidance from the club documents'},
 'intro-cloud-notes':{title:'Introduction to cloud',note:'Lesson content and presentation notes'},
 'context-status':{title:'Limits and details to confirm',note:'Reviewed September 20, 2026'}
};
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
    const data=await r.json();if(!r.ok)throw new Error(uiText(data.error)||'Chat is unavailable.');return data;
  }
  useEffect(()=>{
    let active=true;
    api('/api/chat/context').then(data=>{if(active)setSources(data.map((source:ChatSource)=>({...source,...sourceLabels[source.id]})));}).catch(()=>{});
    const id=sessionStorage.getItem('orbit-chat');
    if(id)api(`/api/chat/${id}`).then((data:Conversation)=>{if(active){if(data.provider==='backboard')setConversation(data);else sessionStorage.removeItem('orbit-chat');}}).catch(()=>{if(active)setError('Your saved conversation is unavailable. You can start a new one.');});
    return()=>{active=false;};
  },[token]);
  function reset(){setConversation(null);sessionStorage.removeItem('orbit-chat');setError('');setCopied(null);setMessage('');}
  async function send(){
    if(!message.trim()||busy||preparing!==null||!liveReady)return;
    setBusy(true);setError('');
    try {const result=await api('/api/chat',{message,provider:'backboard',expectedRevision:conversation?.revision||0,...(conversation?{conversationId:conversation.id}:{})});setConversation(result);sessionStorage.setItem('orbit-chat',result.id);setMessage('');setCopied(null);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="chat-panel" id="conversation" aria-label="Chat with your Community agent">
    <div className="chat-heading"><div className="composer-agent"><span className="agent-icon mini"><Icon name="people"/></span><div><h2>What do you need help with?</h2><small>A specific message, a question, or an idea to refine.</small></div></div><span className={`badge ${liveReady?'live':''}`}>{liveReady?'LIVE':'SETUP NEEDED'}</span></div>
    <div className="chat-controls"><span className="muted">Backboard {liveReady?'live':'not configured'}</span><button className="quiet" onClick={reset} disabled={busy||preparing!==null}>New conversation</button></div>
    <details className="chat-context"><summary>Club context · {sources.length} sources</summary><p>Selected club documents stored on the server. Older details may need confirmation. This context does not automatically sync with your files.</p><ul>{sources.map(source=><li key={source.id}><strong>{source.title}</strong><span>{source.note}</span></li>)}</ul></details>
    <div ref={transcript} className="chat-transcript" role="log" aria-label="Conversation messages" aria-live="polite" aria-busy={busy}>{conversation?.turns.map((turn,index)=><div className="chat-turn" key={index}><div className="chat-user"><span>You</span><p>{turn.message}</p></div><div className="chat-assistant"><span>Community</span><p>{turn.reply.text}</p>{turn.reply.draft&&<article className="chat-draft"><div className="section-heading"><h3>{turn.reply.draft.title}</h3><span className="badge subtle">DRAFT, NOT POSTED</span></div><p>{turn.reply.draft.text}</p><button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(turn.reply.draft!.text);setCopied(index);}catch{setError('Copy unavailable. Select the draft text manually.');}}}>{copied===index?'Copied ✓':'Copy draft'}</button><div className="chat-draft-actions"><button className="primary" disabled={busy||preparing!==null||!discordReady||turn.reply.draft.text.trim().length>2000} onClick={async()=>{if(preparing!==null)return;setPreparing(index);setError('');try{await onPrepareDiscord(conversation.id,conversation.revision,index);}catch(cause){setError((cause as Error).message);}finally{setPreparing(null);}}}>{preparing===index?'Preparing…':'Prepare for Discord approval'}</button><small className="muted">{discordReady?`Destination: #${discordTarget}. This creates a card for review and approval. Nothing is sent yet.`:'Connect Discord to prepare a post.'}{turn.reply.draft.text.trim().length>2000?' This draft exceeds Discord’s 2,000-character limit. Ask for a shorter version.':''}</small></div></article>}{turn.reply.sources.length>0&&<div className="chat-citations">Sources: {turn.reply.sources.map(id=>sources.find(s=>s.id===id)?.title||id).join(' · ')}</div>}</div></div>)}</div>
    {busy&&<p role="status" className="muted">Your agent is preparing a reply…</p>}
    {error&&<p role="alert" className="error">{error}</p>}
    <form className="chat-compose" onSubmit={e=>{e.preventDefault();void send();}}><label htmlFor="chat-message">Your message</label><textarea id="chat-message" value={message} onChange={e=>setMessage(e.target.value)} maxLength={4000} rows={3} placeholder="For example: make this message shorter and friendlier."/><div className="composer-bottom"><small className="muted">Review, copy, or prepare a draft for approval. Chat never publishes automatically.</small><button type="submit" className="primary" disabled={busy||preparing!==null||!liveReady||!message.trim()}>{busy?'One moment…':'Send to agent →'}</button></div></form>
  </section>;
}
