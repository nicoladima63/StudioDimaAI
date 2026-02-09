# Piano di Riferimento (PDR): Social Media Manager - StudioDimaAI

## Obiettivo del Progetto

Sviluppare un **Social Media Management System completo** integrato in StudioDimaAI per:
- Gestire account social (Instagram, Facebook, LinkedIn, TikTok)
- Generare contenuti con AI (post, newsletter, email team)
- Catalogare contenuti per categoria
- Pianificare pubblicazioni con calendario
- Pubblicare automaticamente su piattaforme social

## Architettura del Sistema

### Pattern da Seguire (da Exploration)

**Backend**:
- DB Schema: `snake_case`, `id AUTOINCREMENT`, `created_at`, `updated_at`, `deleted_at` (soft delete)
- Service/Repository: Eredità da `BaseService`/`BaseRepository`
- API: Flask Blueprint con `@jwt_required()`, `format_response()`
- Response: `{success: bool, data: {}, message: str, error: str, state: "success|warning|error"}`

**Frontend**:
- Features: `features/[name]/pages|components|services|types.ts`
- Services: Default import `apiClient`, prefisso "api" nei metodi
- Store: Zustand con persist, CACHE_DURATION=5min, optimistic updates
- Components: CoreUI (CCard, CModal, CButton, etc.)

---

## 1. DATABASE SCHEMA

### Tabella: `social_accounts`
```sql
CREATE TABLE IF NOT EXISTS social_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL, -- 'instagram', 'facebook', 'linkedin', 'tiktok'
    account_name TEXT NOT NULL,
    account_username TEXT,
    account_id TEXT UNIQUE, -- Platform-specific ID
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    is_connected INTEGER DEFAULT 0,
    last_synced_at TIMESTAMP,
    metadata TEXT, -- JSON con followers, engagement, etc
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_connected ON social_accounts(is_connected);
CREATE INDEX IF NOT EXISTS idx_social_accounts_deleted ON social_accounts(deleted_at);
```

### Tabella: `content_categories`
```sql
CREATE TABLE IF NOT EXISTS content_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE, -- 'Promozione servizi', 'Educazione pazienti', 'Team interno'
    description TEXT,
    color TEXT, -- Hex color per UI (#3498db, #e74c3c, etc)
    icon TEXT, -- Nome icona CoreUI
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_content_categories_name ON content_categories(name);
CREATE INDEX IF NOT EXISTS idx_content_categories_deleted ON content_categories(deleted_at);
```

### Tabella: `posts`
```sql
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    title TEXT NOT NULL,
    content TEXT NOT NULL, -- Testo principale del post
    content_type TEXT DEFAULT 'post', -- 'post', 'newsletter', 'email_team', 'announcement', 'procedure'
    platforms TEXT, -- JSON array: ["instagram", "facebook", "linkedin"]
    media_urls TEXT, -- JSON array di URL immagini/video
    hashtags TEXT, -- JSON array di hashtags
    status TEXT DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'failed'
    scheduled_at TIMESTAMP,
    published_at TIMESTAMP,
    created_by INTEGER, -- FK to users table
    metadata TEXT, -- JSON con engagement metrics, ai_generated, etc
    template_id INTEGER, -- FK to templates table (nullable)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (category_id) REFERENCES content_categories(id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (template_id) REFERENCES content_templates(id)
);

CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(content_type);
CREATE INDEX IF NOT EXISTS idx_posts_deleted ON posts(deleted_at);
```

### Tabella: `post_publications`
```sql
CREATE TABLE IF NOT EXISTS post_publications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    social_account_id INTEGER NOT NULL,
    platform_post_id TEXT, -- ID del post sulla piattaforma
    status TEXT DEFAULT 'pending', -- 'pending', 'published', 'failed'
    published_at TIMESTAMP,
    error_message TEXT,
    engagement_metrics TEXT, -- JSON: {likes, comments, shares, views}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (social_account_id) REFERENCES social_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_post_publications_post ON post_publications(post_id);
CREATE INDEX IF NOT EXISTS idx_post_publications_account ON post_publications(social_account_id);
CREATE INDEX IF NOT EXISTS idx_post_publications_status ON post_publications(status);
CREATE INDEX IF NOT EXISTS idx_post_publications_deleted ON post_publications(deleted_at);
```

### Tabella: `content_templates`
```sql
CREATE TABLE IF NOT EXISTS content_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category_id INTEGER,
    template_type TEXT NOT NULL, -- 'email_team', 'newsletter', 'announcement', 'procedure'
    subject TEXT, -- Per email
    body TEXT NOT NULL, -- Corpo con variabili {{nome_paziente}}, {{data_appuntamento}}, etc
    variables TEXT, -- JSON array di variabili disponibili
    is_active INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (category_id) REFERENCES content_categories(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_content_templates_type ON content_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_content_templates_category ON content_templates(category_id);
CREATE INDEX IF NOT EXISTS idx_content_templates_deleted ON content_templates(deleted_at);
```

### Tabella: `ai_generation_history`
```sql
CREATE TABLE IF NOT EXISTS ai_generation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT NOT NULL,
    generated_content TEXT NOT NULL,
    content_type TEXT, -- 'post', 'newsletter', etc
    ai_model TEXT, -- 'gpt-4', 'claude-3-sonnet', etc
    tokens_used INTEGER,
    generation_time_ms INTEGER,
    user_id INTEGER,
    was_accepted INTEGER DEFAULT 0, -- 1 se l'utente ha usato il contenuto
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_history_user ON ai_generation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_history_type ON ai_generation_history(content_type);
CREATE INDEX IF NOT EXISTS idx_ai_history_created ON ai_generation_history(created_at);
```

---

## 2. BACKEND IMPLEMENTATION

### File da Creare

#### 2.1 API Blueprint
**File**: `server_v2/api/v2_social_media.py` (~650 righe)

**Endpoints**:
- `GET /api/social-media/accounts` - Lista account social
- `POST /api/social-media/accounts/<id>/connect` - Inizia OAuth flow
- `POST /api/social-media/accounts/<id>/disconnect` - Disconnetti account
- `GET /api/social-media/posts` - Lista posts (con pagination, filtri)
- `POST /api/social-media/posts` - Crea nuovo post
- `GET /api/social-media/posts/<id>` - Dettaglio post
- `PUT /api/social-media/posts/<id>` - Aggiorna post
- `DELETE /api/social-media/posts/<id>` - Soft delete post
- `POST /api/social-media/posts/<id>/schedule` - Schedula pubblicazione
- `POST /api/social-media/ai/generate` - Genera contenuto con AI
- `GET /api/social-media/calendar` - Eventi calendario (start_date, end_date)
- `GET /api/social-media/categories` - Lista categorie
- `GET /api/social-media/templates` - Lista templates

**Pattern**: Flask Blueprint, `@jwt_required()`, `format_response()`, gestione errori con try/except

#### 2.2 Service Layer

**File**: `server_v2/services/social_media_service.py` (~450 righe)
- Eredita da `BaseService`
- Metodi: `get_all_accounts()`, `get_posts_paginated()`, `create_post()`, `update_post()`, `schedule_post()`, `generate_content_with_ai()`
- Gestione JSON fields (platforms, media_urls, hashtags)
- Integration con `SocialMediaRepository`, `AIContentService`, `SchedulingManager`

**File**: `server_v2/services/social_accounts_service.py` (~200 righe)
- Gestione account social
- OAuth token validation
- Token refresh logic

**File**: `server_v2/services/ai_content_service.py` (~180 righe)
- Integrazione OpenAI GPT-4 (o Claude API)
- Prompt templates per tipo contenuto (post, newsletter, email)
- Tone (professional, casual, educational) e length (short, medium, long)
- Estrazione title e hashtags suggeriti

**File**: `server_v2/services/social_publishing_service.py` (~350 righe)
- Pubblicazione su Instagram (Graph API)
- Pubblicazione su Facebook (Graph API)
- Pubblicazione su LinkedIn (UGC Posts API)
- Gestione rate limits
- Error handling e retry logic

#### 2.3 Repository Layer

**File**: `server_v2/repositories/social_media_repository.py` (~400 righe)
- Eredita da `BaseRepository`
- Implementa `_ensure_tables_exist()` con tutti i CREATE TABLE
- Metodi CRUD per posts, accounts, categories
- Query custom: `get_scheduled_posts()`, `get_all_accounts()`

**File**: `server_v2/repositories/templates_repository.py` (~150 righe)
- CRUD per templates
- Variabili dinamiche parsing

#### 2.4 Utilities

**File**: `server_v2/utils/oauth_helpers.py` (~250 righe)
- Classe `OAuthManager`
- Config per Instagram/Facebook/LinkedIn OAuth2 flow
- Metodi: `get_authorization_url()`, `exchange_code_for_token()`, `refresh_token()`
- CSRF protection con state parameter

**File**: `server_v2/utils/scheduling_utils.py` (~120 righe)
- Classe `SchedulingManager` con APScheduler
- Background scheduler per pubblicazioni automatiche
- Metodi: `schedule_post_publication()`, `cancel_scheduled_post()`
- Job persistence in DB

#### 2.5 Registrazione Blueprint

**Modifica File**: `server_v2/app_v2.py`
```python
from api.v2_social_media import social_media_v2_bp

blueprints = [
    # ... altri blueprints esistenti
    social_media_v2_bp,
]

for blueprint in blueprints:
    app.register_blueprint(blueprint, url_prefix=app.config['API_PREFIX'])
```

---

## 3. FRONTEND IMPLEMENTATION

### File da Creare

#### 3.1 Main Page

**File**: `client_v2/src/features/social-media-manager/pages/SocialMediaManagerPage.tsx` (~300 righe)

**Struttura**:
- Tab navigation (Dashboard, Posts, Calendario, AI Generator)
- Dashboard tab: Account cards + Quick stats
- Posts tab: PostList component
- Calendario tab: CalendarView component
- AI Generator tab: AIContentGenerator component
- Floating button "Nuovo Post" → apre PostComposer modal

#### 3.2 Components

**File**: `client_v2/src/features/social-media-manager/components/AccountCard.tsx` (~150 righe)
- Card minimale per ogni social (Instagram, Facebook, LinkedIn, TikTok)
- Icona social + nome account
- Badge verde "Connesso" / grigio "Disconnesso"
- Bottone "Connetti" / "Disconnetti"
- Metadata: followers, last_synced_at

**File**: `client_v2/src/features/social-media-manager/components/PostComposer.tsx` (~400 righe)
- CModal per create/edit post
- Form fields: title, content (textarea), category_id (select), content_type (select)
- Multi-select platforms (checkbox: Instagram, Facebook, LinkedIn)
- Media upload (URLs input)
- Hashtags input (tag editor)
- Schedule date/time picker
- Bottone "Genera con AI" → apre AIContentGenerator inline
- Save as draft / Schedule / Publish

**File**: `client_v2/src/features/social-media-manager/components/PostList.tsx` (~350 righe)
- DataTable con columns: title, category, content_type, platforms, status, scheduled_at
- Filtri: status (dropdown), category (dropdown), content_type (dropdown), search (input)
- Paginazione completa (sopra e sotto tabella)
- Actions: Edit (pencil), Delete (trash), View (eye)
- Badge colorati per status: draft (grigio), scheduled (giallo), published (verde), failed (rosso)

**File**: `client_v2/src/features/social-media-manager/components/PostDetailModal.tsx` (~250 righe)
- CModal read-only per visualizzare dettaglio post
- Mostra content, platforms, media, hashtags
- Tab per engagement metrics (se pubblicato)
- Bottone "Modifica" → apre PostComposer

**File**: `client_v2/src/features/social-media-manager/components/CalendarView.tsx` (~300 righe)
- Integrazione `react-big-calendar`
- Eventi: posts schedulati (visualizza title, piattaforme, categoria)
- Click su evento → apre PostDetailModal
- Drag & drop per rescheduling
- Colori eventi per categoria

**File**: `client_v2/src/features/social-media-manager/components/AIContentGenerator.tsx` (~280 righe)
- Form per generazione AI
- Input: prompt (textarea), content_type (select), tone (select), length (select)
- Bottone "Genera"
- Loading state con spinner
- Output: generated content (editable), title suggestion, hashtags suggestion
- Bottoni: "Usa contenuto" (copia in PostComposer), "Rigenera"

**File**: `client_v2/src/features/social-media-manager/components/CategorySelector.tsx` (~100 righe)
- CFormSelect per categorie
- Carica da store
- Badge colorato con nome categoria

**File**: `client_v2/src/features/social-media-manager/components/TemplateSelector.tsx` (~120 righe)
- CFormSelect per templates
- Filtra per template_type
- Load template body in editor

#### 3.3 Services

**File**: `client_v2/src/features/social-media-manager/services/socialMediaManager.service.ts` (~150 righe)

```typescript
import apiClient from '@/services/api/client';

const socialMediaManagerService = {
  // AI Generation
  apiGenerateContent: async (request) => {
    const response = await apiClient.post('/social-media/ai/generate', request);
    return response.data;
  },

  // Calendar
  apiGetCalendarEvents: async (startDate, endDate) => {
    const response = await apiClient.get(`/social-media/calendar?start_date=${startDate}&end_date=${endDate}`);
    return response.data;
  },

  // Schedule
  apiSchedulePost: async (postId, scheduledAt) => {
    const response = await apiClient.post(`/social-media/posts/${postId}/schedule`, { scheduled_at: scheduledAt });
    return response.data;
  },

  // Templates
  apiGetTemplates: async (type) => {
    const response = await apiClient.get(`/social-media/templates?type=${type}`);
    return response.data;
  }
};

export default socialMediaManagerService;
```

#### 3.4 Zustand Store

**File**: `client_v2/src/store/socialMedia.store.ts` (~400 righe)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '@/services/api/client';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_RETRIES = 3;

interface SocialMediaState {
  // Data
  accounts: SocialAccount[];
  posts: Post[];
  categories: Category[];

  // Loading
  isLoading: boolean;
  error: string | null;

  // Cache
  lastUpdated: number;

  // Actions
  loadAccounts: () => Promise<void>;
  loadPosts: (options) => Promise<void>;
  loadCategories: () => Promise<void>;
  createPost: (data) => Promise<Post>;
  updatePost: (id, data) => Promise<Post>;
  deletePost: (id) => Promise<void>;
  connectAccount: (accountId) => Promise<void>;
  disconnectAccount: (accountId) => Promise<void>;
  invalidateCache: () => void;
}

export const useSocialMediaStore = create<SocialMediaState>()(
  persist(
    (set, get) => ({
      // Implementation con retry logic, optimistic updates, cache
    }),
    {
      name: 'social-media-store',
      partialize: (state) => ({
        accounts: state.accounts,
        posts: state.posts,
        categories: state.categories,
        lastUpdated: state.lastUpdated
      })
    }
  )
);
```

#### 3.5 Types

**File**: `client_v2/src/features/social-media-manager/types/index.ts` (~100 righe)

```typescript
export interface SocialAccount {
  id: number;
  platform: 'instagram' | 'facebook' | 'linkedin' | 'tiktok';
  account_name: string;
  account_username?: string;
  is_connected: boolean;
  connection_status: 'connected' | 'disconnected';
  last_synced_at?: string;
}

export interface Post {
  id: number;
  title: string;
  content: string;
  content_type: 'post' | 'newsletter' | 'email_team' | 'announcement';
  platforms: string[];
  media_urls: string[];
  hashtags: string[];
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduled_at?: string;
  published_at?: string;
  category_id?: number;
}

export interface Category {
  id: number;
  name: string;
  color?: string;
  icon?: string;
}
```

#### 3.6 Hooks

**File**: `client_v2/src/features/social-media-manager/hooks/useSocialMediaManager.ts` (~120 righe)
- Custom hook per logica comune
- Auto-load su mount
- Toast notifications per success/error

#### 3.7 Routing

**Modifica File**: `client_v2/src/router/index.tsx`
```tsx
import SocialMediaManagerPage from '@/features/social-media-manager/pages/SocialMediaManagerPage';

// Inside Routes:
<Route path='social-media' element={<SocialMediaManagerPage />} />
```

---

## 4. PRIORITÀ IMPLEMENTAZIONE

### MVP (Phase 1) - Sprint 1-2 (2-3 settimane)

**Obiettivo**: Sistema base funzionante per creare/gestire posts in draft

**Backend MVP**:
1. Database schema completo (tutte le 6 tabelle)
2. Repository: `social_media_repository.py` (CRUD base)
3. Service: `social_media_service.py` (CRUD posts, accounts stub)
4. API: `v2_social_media.py` (endpoints CRUD posts, GET accounts)

**Frontend MVP**:
1. Store: `socialMedia.store.ts` (posts, categories)
2. Page: `SocialMediaManagerPage.tsx` (tab Dashboard + Posts)
3. Components: `AccountCard.tsx` (solo mock/static), `PostComposer.tsx`, `PostList.tsx`
4. Routing integrato

**Features MVP**:
- ✅ Creare post (draft)
- ✅ Editare post
- ✅ Eliminare post
- ✅ Catalogare per categoria
- ✅ Visualizzare lista posts con filtri
- ✅ Dashboard con account cards (solo visualizzazione, no connessione)

**Escluso da MVP**:
- ❌ OAuth2 integration
- ❌ Pubblicazione automatica
- ❌ Calendario
- ❌ AI Generation
- ❌ Templates

---

### Phase 2 - Sprint 3-4 (2-3 settimane)

**Obiettivo**: Integrazione social media e scheduling

**Backend Phase 2**:
1. Utils: `oauth_helpers.py` (OAuth2 flow)
2. Utils: `scheduling_utils.py` (APScheduler)
3. Service: `social_publishing_service.py` (Instagram + Facebook)
4. API: Endpoints connect/disconnect, schedule, publish

**Frontend Phase 2**:
1. Component: `CalendarView.tsx` (react-big-calendar)
2. Integration OAuth flow (popup, callback handling)
3. Scheduling UI (date/time picker)

**Features Phase 2**:
- ✅ Connetti Instagram/Facebook (OAuth)
- ✅ Schedula pubblicazione
- ✅ Pubblicazione automatica (cron job)
- ✅ Calendario visualizzazione posts schedulati
- ✅ Drag & drop rescheduling

---

### Phase 3 - Sprint 5+ (Future Enhancements)

**Obiettivo**: Features avanzate

**Backend Phase 3**:
1. Service: `ai_content_service.py` (OpenAI/Claude)
2. Repository: `templates_repository.py`
3. LinkedIn/TikTok publishing support
4. Engagement metrics collection

**Frontend Phase 3**:
1. Component: `AIContentGenerator.tsx`
2. Component: `TemplateSelector.tsx`
3. Analytics dashboard
4. Media gallery management

**Features Phase 3**:
- ✅ AI content generation
- ✅ Templates system
- ✅ Newsletter/Email team
- ✅ LinkedIn/TikTok integration
- ✅ Engagement analytics

---

## 5. FILE DA CREARE - LISTA COMPLETA

### Backend (11 files)

1. `server_v2/api/v2_social_media.py` (~650 righe)
2. `server_v2/services/social_media_service.py` (~450 righe)
3. `server_v2/services/social_accounts_service.py` (~200 righe)
4. `server_v2/services/ai_content_service.py` (~180 righe) [Phase 3]
5. `server_v2/services/social_publishing_service.py` (~350 righe) [Phase 2]
6. `server_v2/repositories/social_media_repository.py` (~400 righe)
7. `server_v2/repositories/templates_repository.py` (~150 righe) [Phase 3]
8. `server_v2/utils/oauth_helpers.py` (~250 righe) [Phase 2]
9. `server_v2/utils/scheduling_utils.py` (~120 righe) [Phase 2]

**Modifiche**:
10. `server_v2/app_v2.py` (aggiungere blueprint registration ~5 righe)

### Frontend (13 files)

11. `client_v2/src/features/social-media-manager/pages/SocialMediaManagerPage.tsx` (~300 righe)
12. `client_v2/src/features/social-media-manager/components/AccountCard.tsx` (~150 righe)
13. `client_v2/src/features/social-media-manager/components/PostComposer.tsx` (~400 righe)
14. `client_v2/src/features/social-media-manager/components/PostList.tsx` (~350 righe)
15. `client_v2/src/features/social-media-manager/components/PostDetailModal.tsx` (~250 righe)
16. `client_v2/src/features/social-media-manager/components/CalendarView.tsx` (~300 righe) [Phase 2]
17. `client_v2/src/features/social-media-manager/components/AIContentGenerator.tsx` (~280 righe) [Phase 3]
18. `client_v2/src/features/social-media-manager/components/CategorySelector.tsx` (~100 righe)
19. `client_v2/src/features/social-media-manager/components/TemplateSelector.tsx` (~120 righe) [Phase 3]
20. `client_v2/src/features/social-media-manager/services/socialMediaManager.service.ts` (~150 righe)
21. `client_v2/src/store/socialMedia.store.ts` (~400 righe)
22. `client_v2/src/features/social-media-manager/types/index.ts` (~100 righe)
23. `client_v2/src/features/social-media-manager/hooks/useSocialMediaManager.ts` (~120 righe)

**Modifiche**:
24. `client_v2/src/router/index.tsx` (aggiungere route ~10 righe)

### Totale

- **24 nuovi files** + **2 modifiche**
- **~5670 righe di codice** totali
- **MVP (Phase 1)**: ~2000 righe (11 files)
- **Phase 2**: +~1800 righe (5 files)
- **Phase 3**: +~1870 righe (8 files)

---

## 6. TRADE-OFFS ARCHITETTURALI

### Database: SQLite vs PostgreSQL
- **SCELTA**: SQLite (pattern esistente)
- **PRO**: Zero setup, coerenza con progetto
- **CONTRO**: Limitazioni concurrency
- **MITIGAZIONE**: Connection pooling, transazioni ottimizzate

### OAuth Storage: DB vs Redis
- **SCELTA**: DB (tabella social_accounts)
- **PRO**: Semplice, no dependencies
- **CONTRO**: Token refresh lento
- **MITIGAZIONE**: Cache in-memory

### Scheduling: APScheduler vs Celery
- **SCELTA**: APScheduler
- **PRO**: Lightweight, no broker
- **CONTRO**: Non distribuito, restart perde jobs
- **MITIGAZIONE**: Persist jobs in DB, reload on startup

### AI Provider: OpenAI vs Claude
- **SCELTA**: OpenAI GPT-4 (MVP)
- **PRO**: API consolidata
- **CONTRO**: Costo token
- **MITIGAZIONE**: Interfaccia astratta, switch facile

### Calendar: react-big-calendar vs FullCalendar
- **SCELTA**: react-big-calendar
- **PRO**: Free, MIT license
- **CONTRO**: Meno features
- **MITIGAZIONE**: Sufficiente per MVP

---

## 7. CONSIDERAZIONI IMPLEMENTATIVE

### Rate Limits Social Platforms
- Instagram: 200 chiamate/ora
- Facebook: 200 chiamate/ora
- LinkedIn: Varia per endpoint

**Gestione**: Retry con exponential backoff, cache engagement metrics

### Token Refresh Automatico
Middleware per refresh automatico token scaduti prima di chiamate API

### Webhook per Engagement
Endpoint `/social-media/webhooks/<platform>` per ricevere eventi (likes, comments, shares)

### Media Upload Strategy
**MVP**: Store URLs esterni (Google Drive, Cloudinary)
**Future**: Storage locale + CDN

### Testing
- **Unit**: Repository/Service methods
- **Integration**: API endpoints con mock DB
- **E2E**: Cypress per frontend flows

---

## 8. TIMELINE STIMATA

### MVP (Phase 1): 2-3 settimane
- Week 1: Database + Backend CRUD + Frontend structure
- Week 2: Post composer + List + Dashboard
- Week 3: Testing + Bug fixing

### Phase 2: 2-3 settimane
- Week 4: OAuth2 implementation
- Week 5: Publishing service + Scheduling
- Week 6: Calendar view

### Phase 3: 2+ settimane
- Templates system
- AI generation
- Analytics

**Totale**: 6-8 settimane per sistema completo

---

## 9. CRITICAL FILES (Ordine Implementazione)

1. **`server_v2/repositories/social_media_repository.py`** - Foundation DB
2. **`server_v2/api/v2_social_media.py`** - API interface
3. **`server_v2/services/social_media_service.py`** - Business logic
4. **`client_v2/src/store/socialMedia.store.ts`** - State management
5. **`client_v2/src/features/social-media-manager/pages/SocialMediaManagerPage.tsx`** - UI entry point

---

## 10. VERIFICA END-TO-END

### Test MVP (Phase 1)
1. ✅ Creare categoria "Promozione servizi"
2. ✅ Creare nuovo post con title, content, categoria
3. ✅ Visualizzare post in PostList
4. ✅ Filtrare posts per categoria
5. ✅ Editare post esistente
6. ✅ Eliminare post
7. ✅ Verificare soft delete (deleted_at NOT NULL)

### Test Phase 2
1. ✅ Connettere account Instagram (OAuth flow)
2. ✅ Verificare badge "Connesso" su AccountCard
3. ✅ Schedulare post per data futura
4. ✅ Visualizzare post in CalendarView
5. ✅ Attendere pubblicazione automatica (cron job)
6. ✅ Verificare post pubblicato su Instagram

### Test Phase 3
1. ✅ Generare contenuto con AI (prompt → content)
2. ✅ Usare template per email team
3. ✅ Visualizzare engagement metrics
4. ✅ Pubblicare su LinkedIn

---

## CONCLUSIONI

Il piano è **completo e dettagliato**, seguendo rigorosamente i pattern esistenti in StudioDimaAI. L'architettura è scalabile e modulare, permettendo implementazione incrementale per fasi (MVP → Phase 2 → Phase 3).

**Prossimo step**: Approvazione PDR e inizio implementazione MVP.
