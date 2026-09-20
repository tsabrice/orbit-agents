import { z } from 'zod';
import { factsSchema } from './model';

export const PLAN_PROMPT_LIMIT=12000;
export const planRequestSchema=z.object({
 prompt:z.string().trim().min(1,'Décrivez votre demande.').max(PLAN_PROMPT_LIMIT,'La description est limitée à 12 000 caractères.'),
 provider:z.literal('backboard'),clientId:z.string().uuid(),seq:z.number().int().positive(),facts:factsSchema.optional(),
}).strict();
// A full announcement is context, not an event title. Leave its title for review.
export function titleFromShortPrompt(prompt:string):string {
 const text=prompt.trim();return text.length<=300&&!/[\r\n]/.test(text)?text:'';
}
