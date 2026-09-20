import { factsSchema, type WirePlan } from './model';
export const fixturePrompts=[
 'Workshop: deploy a static site on AWS with Terraform, next Thursday 6 PM, room to confirm, beginners welcome.',
 'Introduction au cloud AWS, lundi à 16 h, débutant·es bienvenu·es.',
 'Session de préparation à la certification AWS, lundi à 16 h, ouverte aux étudiant·es.',
];
export function fixtureIndex(prompt:string){const i=fixturePrompts.findIndex(x=>x.trim().toLowerCase()===prompt.trim().toLowerCase());if(i<0)throw new Error('Choisissez un des trois exemples pour le mode scripted.');return i;}
export function initialFacts(i=0){return factsSchema.parse({title:['Déployer un site statique avec AWS et Terraform','Découvrir le cloud et AWS','Préparer sa certification AWS'][i],dateLabel:i===0?'Jeudi 24 septembre 2026, 18 h':'Lundi 21 septembre 2026, 16 h',start:i===0?'2026-09-24T18:00:00-04:00':'2026-09-21T16:00:00-04:00',audience:'étudiant·es débutant·es',technicalName:'AWS'});}
export function fixturePlan():WirePlan{return {actions:[
 {type:'create_calendar_event',payload:{title:'{{fact.title}}',start:'{{fact.start}}',end:'{{fact.end}}',location:'{{fact.room}}',description:'Apprendre en construisant, ensemble. Aucune expérience requise.'}},
 {type:'post_discord',payload:{channel:'announcements',text:'Envie de construire quelque chose de concret ? 🌱\n\n{{fact.title}}\n📅 {{fact.dateLabel}}\n📍 {{fact.room}}\nAucune expérience requise.\n\nInscris-toi sur Meetup : {{fact.rsvp}}'}},
 {type:'draft_meetup',payload:{title:'{{fact.title}}',sections:{hook:'Une occasion de comprendre en pratiquant, avec une communauté étudiante.',whyUseful:'Pose tes questions et avance à ton rythme. Aucune expérience requise.',programme:['Découvrir les concepts ensemble','Passer à la pratique','Partager ses questions'],audience:'Pour les {{fact.audience}}. Tu peux venir même si tu découvres le cloud.',bring:'Ton ordinateur portable.',details:'{{fact.dateLabel}}\nLieu : {{fact.room}}',registrationCTA:'Réserve ta place : {{fact.rsvp}}'}}},
 {type:'draft_linkedin_club',payload:{text:'Apprendre devient plus simple quand on construit ensemble.\n\nOn prépare un atelier : {{fact.title}}. Une rencontre pour les {{fact.audience}}, avec de la pratique et de la place pour les questions.\n\n{{fact.dateLabel}} · {{fact.room}}\nAucune expérience requise.\n\nInscris-toi : {{fact.rsvp}}'}},
 {type:'draft_linkedin_personal',payload:{text:'Je veux créer un espace où on peut apprendre le cloud sans avoir peur de poser une question.\n\nAvec le AWS Student Builder Group at UQAM, je prépare cet atelier : {{fact.title}}. Ce qui compte pour moi, c’est de construire et d’apprendre ensemble.\n\n{{fact.dateLabel}} · {{fact.room}}\nLe groupe : {{fact.groupPage}}\n\nViens apprendre avec nous : {{fact.rsvp}}'}},
 {type:'draft_instagram',payload:{text:'Un atelier pour apprendre en construisant 🌱\n{{fact.title}}\n{{fact.dateLabel}} · {{fact.room}}\nAucune expérience requise.\n\nInscris-toi : {{fact.rsvp}}\n#UQAM #Cloud'}},
 {type:'draft_dm',payload:{recipientRole:'Technical Lead',text:'Salut ! J’espère que tu vas bien !\n\nOn prépare « {{fact.title}} ». Est-ce que ça te tenterait de nous aider à préparer la partie pratique ? L’idée serait de relire le parcours et de repérer les étapes moins claires. On peut ajuster la charge selon tes disponibilités.'}},
 {type:'draft_dm',payload:{recipientRole:'Event Coordinator',text:'Salut ! J’espère que tu vas bien !\n\nOn prépare « {{fact.title}} ». Est-ce que ça te tenterait de nous aider avec la logistique sur place ? Il s’agirait de vérifier le matériel et l’accueil. On peut se répartir les tâches selon tes disponibilités.'}},
],followupPreview:'Rappel deux jours avant · Merci et invitation au récap après l’événement. Aperçu seulement, rien de programmé.'};}
export const history=[
 {version:1,id:'fixture-01',title:'Découverte du cloud',date:'2026-02-02',day:'lundi',format:'atelier',attendance:16},
 {version:1,id:'fixture-02',title:'Premiers pas avec Terraform',date:'2026-02-19',day:'jeudi',format:'atelier',attendance:6},
 {version:1,id:'fixture-03',title:'Un site dans le cloud',date:'2026-03-02',day:'lundi',format:'atelier',attendance:18},
 {version:1,id:'fixture-04',title:'Discussion certification',date:'2026-03-19',day:'jeudi',format:'discussion',attendance:8},
 {version:1,id:'fixture-05',title:'Découverte du backend',date:'2026-04-06',day:'lundi',format:'atelier',attendance:14},
 {version:1,id:'fixture-06',title:'Rencontre communauté',date:'2026-04-23',day:'jeudi',format:'rencontre',attendance:10},
].map(x=>({...x,timezone:'America/Montreal',source:'fixture',sourceDate:'2026-09-19',synthetic:true}));
export function suggestion(question:string){
 if(!/quand|when|lundi|jeudi|prochain|next|jour|day|horaire/i.test(question))return {text:'Dans cette démo, je peux comparer les jours des événements fictifs. Demande : « Quand organiser le prochain atelier ? »',citations:[],synthetic:true};
 return {text:'Dans les données fictives, « Découverte du cloud » a réuni 16 personnes un lundi, contre 6 pour « Premiers pas avec Terraform » un jeudi. Le lundi pourrait être une piste à vérifier avec l’équipe. Ce petit échantillon ne prouve pas que le jour explique la participation.',citations:[history[0],history[1]],synthetic:true};
}
