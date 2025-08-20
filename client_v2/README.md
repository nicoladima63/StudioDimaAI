# Studio Dima V2 - React Client

Sistema di gestione modernizzato per Studio Dima con architettura completamente rinnovata.

## 🚀 Tecnologie

- **React 18** - UI Library con supporto Concurrent Features
- **TypeScript** - Type safety e developer experience migliorata
- **Vite** - Build tool veloce e moderno
- **CoreUI V5** - Framework UI professionale
- **Zustand** - State management leggero e performante
- **React Query** - Data fetching e caching
- **React Hook Form** - Gestione form performante
- **Zod** - Schema validation

## 📁 Struttura Progetto

```
src/
├── components/          # Componenti riutilizzabili
│   ├── layout/         # Layout e navigazione
│   ├── ui/             # Componenti UI base
│   └── forms/          # Componenti form
├── features/           # Feature modules
│   ├── auth/           # Autenticazione
│   ├── dashboard/      # Dashboard principale
│   └── [feature]/      # Future features
├── services/           # API clients e servizi
│   └── api/            # Configurazione API
├── store/              # Zustand stores
├── types/              # TypeScript definitions
├── utils/              # Utility functions
├── hooks/              # Custom React hooks
└── styles/             # Stili globali
```

## 🛠️ Sviluppo

### Setup iniziale

```bash
# Installa dipendenze
npm install

# Copia file environment
cp .env.example .env

# Avvia development server
npm run dev
```

### Scripts disponibili

```bash
# Development
npm run dev          # Avvia dev server (porta 3001)
npm run build        # Build per produzione
npm run preview      # Preview build produzione

# Code Quality
npm run lint         # ESLint check
npm run lint:fix     # ESLint fix automatico
npm run type-check   # TypeScript check

# Testing
npm run test         # Avvia test suite
npm run test:ui      # Test con interfaccia
npm run test:coverage # Coverage report
```

## 🔧 Configurazione

### Environment Variables

```env
VITE_APP_TITLE=Studio Dima V2
VITE_APP_VERSION=2.0.0
VITE_ENVIRONMENT=development
VITE_API_V2_URL=http://localhost:5001/api/v2
```

### API Server

Il client si connette al Server V2 su `http://localhost:5001/api/v2`.
Assicurati che il server sia avviato prima di lanciare il client.

## 📋 Convenzioni

### Import Pattern (CLAUDE.md)
```typescript
// Sempre import type per tipi TypeScript
import type { User } from '@/types'

// Default import per API client
import apiClient from '@/services/api/client'

// Prefisso "api" per chiamate ai service
const response = await userService.apiGetUsers()
```

### Service Pattern
```typescript
// Object literal pattern (non classi)
export const userService = {
  apiGetUsers: () => apiClient.get('/users'),
  apiCreateUser: (data) => apiClient.post('/users', data),
}
```

### Component Pattern
```typescript
// Functional components con TypeScript
const MyComponent: React.FC<Props> = ({ prop1, prop2 }) => {
  return <div>{/* JSX */}</div>
}

export default MyComponent
```

## 🎯 Features

### ✅ Implementate
- [x] Setup progetto completo
- [x] Architettura modulare
- [x] Autenticazione JWT
- [x] Layout responsive
- [x] Error handling
- [x] TypeScript strict mode
- [x] API client configurato

### 🔄 In sviluppo
- [ ] Dashboard analytics
- [ ] Migrazione features V1
- [ ] Testing suite completa

### 📅 Roadmap
- [ ] Fornitori management
- [ ] Materiali catalog
- [ ] Statistiche avanzate
- [ ] PWA support
- [ ] Dark theme

## 🔗 Integrazione V1

Questo progetto è progettato per:
- Coesistere con il client V1 esistente
- Importare componenti dal V1 quando necessario
- Migrare gradualmente le funzionalità

## 📖 Documentation

- [Architettura](docs/ARCHITECTURE.md)
- [API Integration](docs/API.md)
- [Component Guidelines](docs/COMPONENTS.md)
- [Testing Guide](docs/TESTING.md)

## 🤝 Contributing

1. Segui le convenzioni CLAUDE.md
2. Usa TypeScript strict mode
3. Aggiungi test per nuove feature
4. Mantieni compatibility con Server V2
5. Documenta breaking changes

## 📝 License

Proprietario - Studio Dima © 2025