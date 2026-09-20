import { parseProviderJson } from './provider-json';
import { z } from 'zod';

export const sourceIds = ['voice', 'club-overview', 'presentation-design', 'intro-cloud-notes', 'context-status'] as const;
const text = z.string().trim().min(1).max(10000).refine(value=>!value.includes('\u2014'), 'Les tirets cadratins sont interdits.');
export const chatReplySchema = z.object({
  text,
  draft: z.object({ title: text, text }).strict().optional(),
  sources: z.array(z.enum(sourceIds)).max(sourceIds.length),
}).strict();
export type ChatReply = z.infer<typeof chatReplySchema>;
export const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  expectedRevision: z.number().int().nonnegative().default(0),
  message: z.string().trim().min(1).max(4000),
  provider: z.literal('backboard'),
}).strict();
export type ChatTurn = { message: string; reply: ChatReply; at: string };
export type Conversation = { version: 1; id: string; revision: number; provider: 'scripted'|'backboard'; turns: ChatTurn[] };
export type ChatSource = { id: typeof sourceIds[number]; title: string; note: string };

export function parseChatArguments(value: unknown): ChatReply {
  const envelope = z.object({replyJson:z.string().min(1).max(40000)}).strict().parse(typeof value==='string'?parseProviderJson(value):value);
  return chatReplySchema.parse(parseProviderJson(envelope.replyJson));
}

export function chatDraftForDiscord(conversation:Conversation,expectedRevision:number,turnIndex:number):string {
 if(conversation.provider!=='backboard'||conversation.revision!==expectedRevision)throw new Error('Conversation modifiée. Rechargez-la avant de préparer le message.');
 const draft=conversation.turns[turnIndex]?.reply.draft;
 if(!draft)throw new Error('Cette réponse ne contient pas de brouillon.');
 const text=draft.text.trim();
 if(!text||text.length>2000)throw new Error('Le message Discord doit contenir entre un et deux mille caractères. Demandez une version plus courte.');
 if(/\{\{|\[[^\]\n]+\]/.test(text))throw new Error('Complétez les placeholders dans la conversation avant de préparer le message.');
 return text;
}
