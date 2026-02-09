# Meta App Review - Checklist e Istruzioni

## App Facebook Creata
- **Nome**: StudioDimaSocialManager
- **App ID**: 1659532781700892
- **Status**: Development Mode
- **Business Portfolio**: Studio Dentistico Di Martino Nicola

---

## STEP 1: Completare Business Verification

1. Vai su [Meta Business Manager](https://business.facebook.com/)
2. Vai su **Impostazioni** → **Sicurezza** → **Verifica aziendale**
3. Carica documenti richiesti:
   - Documento di identità
   - Documenti aziendali (Visura camerale, P.IVA, ecc.)
4. Attendi approvazione (1-3 giorni lavorativi)

**Status**: ⏳ In attesa

---

## STEP 2: Richiedere Permessi Facebook

Nella dashboard dell'app Facebook:

1. Vai su **App Review** → **Permissions and Features**
2. Richiedi questi permessi:
   - ✅ `pages_manage_posts` - Pubblicare contenuti su Facebook Pages
   - ✅ `pages_read_engagement` - Leggere analytics e engagement

3. Per ogni permesso, compila:
   - **Use case**: Social Media Management Tool per pubblicazione automatica
   - **Description**: Sistema per gestire e pubblicare contenuti automaticamente su Facebook Page dello studio dentistico
   - **Screen recording**: Video che mostra il flusso OAuth → Creazione post → Pubblicazione
   - **Detailed description**:
     ```
     L'applicazione StudioDimaSocialManager è uno strumento interno per gestire
     la presenza social dello Studio Dentistico Di Martino Nicola.

     Funzionalità:
     - Connessione OAuth2 con Facebook Login
     - Gestione contenuti (creazione, modifica, catalogazione)
     - Pubblicazione automatica su Facebook Page
     - Monitoraggio engagement e analytics

     Il permesso è necessario per permettere allo staff dello studio di pubblicare
     contenuti informativi per i pazienti in modo efficiente.
     ```

---

## STEP 3: Richiedere Permessi Instagram

**IMPORTANTE**: Instagram è già collegato alla Facebook Page nella Meta Business Suite!

Nella stessa sezione **App Review**, aggiungi anche:

1. Richiedi permessi Instagram:
   - 📸 `instagram_basic` - Informazioni account Instagram
   - 📸 `instagram_content_publish` - Pubblicare su Instagram Business

2. Descrizione use case:
   ```
   Oltre a Facebook, lo studio gestisce anche un account Instagram Business
   (@studio_dentistico_...) collegato alla Facebook Page.

   Il permesso è necessario per pubblicare contenuti simultaneamente su
   Facebook e Instagram, mantenendo una presenza social coerente.
   ```

---

## STEP 4: Fornire Materiali per Review

Meta richiede:

1. **Video Demo** (5-10 minuti):
   - Login all'app StudioDimaAI
   - Navigazione a Social Media Manager
   - Click su "Connetti" Facebook
   - OAuth flow completo
   - Creazione nuovo post
   - Pubblicazione (mostrare che attualmente fallisce con 403)
   - Spiegazione vocale del flusso

2. **Test User** (se richiesto):
   - Email: test@studiodimartino.eu (o creare)
   - Password: [password test]
   - Ruolo: Admin

3. **App URL** (se richiesto in produzione):
   - https://app.studiodimartino.eu

---

## STEP 5: Attendere Approvazione

**Tempi di risposta**:
- Business Verification: 1-3 giorni
- App Review: 3-7 giorni

**Meta ti contatterà via email** per:
- Approvazione
- Richiesta informazioni aggiuntive
- Eventuali modifiche necessarie

---

## STEP 6: Dopo Approvazione

### 6.1 Aggiornare Scopes nel .env

Modifica `server_v2/.env`:

```bash
# OLD (solo OAuth login):
META_SCOPES=public_profile,email

# NEW (con permessi pubblicazione):
META_SCOPES=public_profile,email,pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish
```

### 6.2 Riavviare Server

```bash
cd server_v2
python -m run_v2
```

### 6.3 Riconnettere Account Facebook

1. Vai su Social Media Manager
2. Click "Disconnetti" su Facebook
3. Click "Connetti" di nuovo
4. Autorizza i nuovi permessi nel popup OAuth

**IMPORTANTE**: Il nuovo token avrà i permessi aggiornati!

### 6.4 Testare Pubblicazione

1. Crea un post di test
2. Seleziona Facebook (e Instagram se vuoi)
3. Click "Pubblica"
4. Verifica che appaia su Facebook Page e Instagram

---

## TROUBLESHOOTING

### Se la pubblicazione fallisce ancora dopo approvazione:

1. **Verifica permessi nel token**:
   - Vai su [Facebook Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
   - Incolla il token salvato nel DB
   - Verifica che mostri i permessi approvati

2. **Controlla Business Manager**:
   - Lo user che si connette deve essere admin della Page
   - La Page deve essere collegata all'Instagram Business

3. **Riconnetti da zero**:
   - Disconnetti account
   - Riavvia server
   - Riconnetti con OAuth flow

---

## NOTE TECNICHE

### Pubblicazione Simultanea Facebook + Instagram

Quando i permessi saranno approvati, il sistema potrà:

1. **Facebook Post**:
   - Endpoint: `POST /{page_id}/feed`
   - Supporta: Text, Images, Links

2. **Instagram Post**:
   - Endpoint: `POST /{ig_user_id}/media` (create container)
   - Endpoint: `POST /{ig_user_id}/media_publish` (publish)
   - Supporta: Images, Videos, Captions, Hashtags

### Instagram Business Account ID

Per ottenere l'Instagram Business Account ID collegato:

```bash
GET https://graph.facebook.com/v18.0/{page_id}?fields=instagram_business_account&access_token={token}
```

Salva questo ID nel campo `account_id` per l'account Instagram.

---

## LINK UTILI

- [Meta Business Manager](https://business.facebook.com/)
- [Facebook Developers](https://developers.facebook.com/apps/1659532781700892)
- [App Review Status](https://developers.facebook.com/apps/1659532781700892/app-review/review-status/)
- [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
- [Graph API Explorer](https://developers.facebook.com/tools/explorer/)

---

## BACKUP CREDENZIALI

**Conserva queste credenziali in modo sicuro:**

```
App ID: 1659532781700892
App Secret: [già salvato in .env]
Page ID: 372172199587722
Instagram Account: @studio_dentistico_...
OAuth Redirect URI: http://localhost:5001/api/v2/social-media/callback/meta
```

---

**Data creazione app**: 2026-02-09
**Ultima modifica**: 2026-02-09
