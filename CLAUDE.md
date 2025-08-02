# Regole di Sviluppo per Claude

## TypeScript e Import
- Usare sempre `import type` per i tipi TypeScript
- Usare `import apiClient from '@/api/client'` (default import) per le chiamate API
- Non usare `{ apiClient }` ma il default import

## API e Backend
- Uniformarsi alle strutture di risposta delle altre API esistenti nel progetto
- Gestire sempre i valori NaN convertendoli in null per il JSON
- Seguire i pattern esistenti per i service (object literal pattern, non classi)
- usare @jwt_required() nelle route a meno che non siano delle route di test

## Frontend e GUI
- Usare sempre CoreUI per tutti i componenti dell'interfaccia
- Non usare Bootstrap o altri framework CSS
- Le tabelle devono sempre avere:
  - Paginazione completa (sopra e sotto la tabella)
  - Selettore numero elementi per pagina (10, 20, 50, 100)
  - Campo ricerca/filtro
  - Ordinamento per colonne principali
- Seguire i pattern di layout delle pagine esistenti

## Debug e Console
- Non lasciare console.log debug nel codice finale
- Usare console.log solo temporaneamente per troubleshooting
- Rimuovere sempre i log prima del commit

## Convenzioni Generali
- Seguire sempre i pattern esistenti nel progetto
- Non inventare nuovi pattern se esiste già una convenzione
- Controllare come sono implementate le funzionalità simili prima di iniziare

## Comandi Utili
- Test: `npm test` (se configurato)
- Lint: `npm run lint` (se configurato)
- Build: `npm run build`