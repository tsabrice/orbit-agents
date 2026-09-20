// Adapted from the existing Playwright recording script. Local, explicitly scripted only.
import { chromium,expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
await mkdir('.data/demo',{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1000},recordVideo:{dir:'.data/demo/raw',size:{width:1440,height:1000}}});
const page=await context.newPage();const base=process.env.DEMO_URL||'http://127.0.0.1:3002';
try{
 await page.goto(base);await expect(page.getByText('SCRIPTED',{exact:true})).toBeVisible();
 const status=await(await page.request.get(`${base}/api/status`)).json();
 if(status.authRequired){const token=process.env.ORGANIZER_TOKEN;if(!token)throw new Error('Authenticated recording requires ORGANIZER_TOKEN in the process environment.');await page.evaluate(token=>sessionStorage.setItem('relais-token',token),token);await page.reload();}
 await page.waitForTimeout(8000);await page.getByRole('button',{name:'Proposer un plan'}).click();
 await expect(page.getByRole('heading',{name:'8 propositions. À toi de jouer.'})).toBeVisible();await page.waitForTimeout(12000);
 await page.getByLabel('Fin (ISO avec fuseau)',{exact:true}).fill('2026-09-24T20:00:00-04:00');await page.getByLabel('Salle',{exact:true}).fill('Salle fictive de démonstration');await page.getByLabel('Lien RSVP',{exact:true}).fill('https://example.org/demo');await page.getByLabel('Page du groupe',{exact:true}).fill('https://example.org/club');await page.getByRole('button',{name:'Confirmer les faits'}).click();await page.waitForTimeout(10000);
 for(const id of ['card-create_calendar_event-0','card-post_discord-1']){const card=page.getByTestId(id);await card.scrollIntoViewIfNeeded();await page.waitForTimeout(5000);await card.getByRole('button',{name:'Approuver',exact:true}).click();await expect(card.getByText(/Simulation seulement/)).toBeVisible();await page.waitForTimeout(6000);}
 await page.getByTestId('card-draft_linkedin_personal-4').scrollIntoViewIfNeeded();await page.waitForTimeout(10000);
 const insta=page.getByTestId('card-draft_instagram-5');await insta.scrollIntoViewIfNeeded();await insta.getByRole('button',{name:'Rejeter',exact:true}).click();await page.waitForTimeout(6000);
 await page.getByRole('button',{name:'Consulter l’historique'}).click();await page.getByText('fixture-01',{exact:true}).scrollIntoViewIfNeeded();await page.waitForTimeout(10000);
 await page.getByRole('button',{name:'Journal'}).click();await page.waitForTimeout(8000);
 const video=page.video()!;await context.close();await video.saveAs('.data/demo/relais-scripted.webm');console.log('Saved .data/demo/relais-scripted.webm. SCRIPTED plans and SIMULATED actions only.');
}finally{await browser.close();}
