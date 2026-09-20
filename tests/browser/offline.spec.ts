import { test,expect } from '@playwright/test';
test('offline event plan, edit, approve, reject, history and audit on desktop and phone',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('/');await expect(page.getByText('SCRIPTED',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Proposer un plan'}).click();await expect(page.getByRole('heading',{name:'8 propositions. À toi de jouer.'})).toBeVisible();
 const calendar=page.getByTestId('card-create_calendar_event-0');const discord=page.getByTestId('card-post_discord-1');
 await expect(calendar.getByRole('button',{name:'Approuver',exact:true})).toBeDisabled();
 await page.getByLabel('Fin (ISO avec fuseau)',{exact:true}).fill('2026-09-24T20:00:00-04:00');await page.getByLabel('Salle',{exact:true}).fill('Salle de démonstration');await page.getByLabel('Lien RSVP',{exact:true}).fill('https://example.org/demo-rsvp');
 await page.getByRole('button',{name:'Confirmer les faits'}).click();await expect(calendar.getByRole('button',{name:'Approuver',exact:true})).toBeEnabled();
 await calendar.getByRole('button',{name:'Approuver',exact:true}).click();await expect(calendar.getByText(/Simulation seulement/)).toBeVisible();
 await discord.getByRole('button',{name:'Approuver',exact:true}).click();await expect(discord.getByText(/Simulation seulement/)).toBeVisible();
 const instagram=page.getByTestId('card-draft_instagram-5');await instagram.getByRole('button',{name:'Modifier',exact:true}).click();await page.getByRole('dialog').getByLabel('Texte',{exact:true}).fill('Apprendre ensemble 🌱\n{{fact.title}}\nInscris-toi : {{fact.rsvp}}');await page.getByRole('button',{name:'Enregistrer pour revue'}).click();await expect(instagram.getByText(/Apprendre ensemble/)).toBeVisible();await expect(calendar.getByText(/Simulation seulement/)).toBeVisible();await instagram.getByRole('button',{name:'Rejeter',exact:true}).click();await expect(instagram.getByText('Rejeté',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Consulter l’historique'}).click();await expect(page.getByText('fixture-01',{exact:true})).toBeVisible();await expect(page.getByText('fixture-02',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Journal'}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog').getByText('reject',{exact:true}).first()).toBeVisible();await page.getByRole('button',{name:'Fermer',exact:true}).click();
 await page.screenshot({path:'.data/screenshots/desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.data/screenshots/mobile.png',fullPage:true});
 await page.route('**/api/plan',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Provider timeout. Current plan preserved.'})}));await page.getByRole('button',{name:'Proposer un plan'}).click();await expect(page.getByRole('alert')).toContainText('Provider timeout');await expect(calendar.getByText(/Simulation seulement/)).toBeVisible();await expect(page.getByRole('button',{name:'Utiliser la démo scripted'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);expect(errors).toEqual([]);
});
