# Social Media Manager - Checklist post-verifica Meta

## Pre-requisiti (da fare subito dopo approvazione Meta)

- [ ] Verificare su https://developers.facebook.com/apps/1659532781700892/app-review/review-status/ che i permessi siano approvati:
  - [ ] `pages_manage_posts`
  - [ ] `pages_read_engagement`
  - [ ] `instagram_basic`
  - [ ] `instagram_content_publish`
- [ ] Verificare che la Business Verification sia completata
- [ ] Verificare che l'app sia passata da Development Mode a Live

## Setup server

- [ ] Installare il pacchetto anthropic: `cd server_v2 && venv/Scripts/pip install anthropic`
- [ ] Aggiungere nel `server_v2/.env`:
  ```
  ANTHROPIC_API_KEY=sk-ant-...
  ```
- [ ] Aggiornare gli scopes Meta nel `server_v2/.env`:
  ```
  META_SCOPES=public_profile,email,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish
  ```
- [ ] Riavviare il server

## Verifica blueprint social media

- [ ] Controllare che `social_media_v2_bp` sia registrato in `routes.py` (branch contenuti)
- [ ] Testare endpoint health: `GET /api/v2/social-media/health`
- [ ] Testare endpoint pillars: `GET /api/v2/social-media/ai/pillars`

## Riconnessione account Meta

- [ ] Andare su Social Media Manager nel frontend
- [ ] Disconnettere l'account Facebook esistente
- [ ] Riconnettere con OAuth (il nuovo token avra' i permessi aggiornati)
- [ ] Selezionare la Facebook Page corretta (Page ID: 372172199587722)
- [ ] Verificare connessione con endpoint verify: `GET /api/v2/social-media/accounts/{id}/verify`
- [ ] Controllare che gli scopes nel token includano quelli nuovi (usare Access Token Debugger)

## Test generazione AI

- [ ] Aprire PostComposer, cliccare "Genera con AI"
- [ ] Testare generazione con pilastro "Educativo" + piattaforma Instagram
- [ ] Verificare che titolo, contenuto e hashtag vengano popolati nel form
- [ ] Verificare che la generazione venga salvata in `ai_generation_history`

## Test pubblicazione

- [ ] Creare un post di test con contenuto semplice
- [ ] Selezionare Facebook come piattaforma
- [ ] Pubblicare e verificare che appaia sulla Facebook Page
- [ ] Se Instagram e' collegato, testare pubblicazione anche su Instagram
- [ ] Verificare che lo stato del post passi a "published"
- [ ] Controllare i log del server per eventuali errori API Meta

## Se qualcosa non funziona

- Token Debugger: https://developers.facebook.com/tools/debug/accesstoken/
- Graph API Explorer: https://developers.facebook.com/tools/explorer/
- App Dashboard: https://developers.facebook.com/apps/1659532781700892
- Controllare che l'utente sia admin della Page
- Controllare che la Page sia collegata all'Instagram Business

## Merge branch

- [ ] Quando tutto funziona, merge branch `contenuti` su `main`
