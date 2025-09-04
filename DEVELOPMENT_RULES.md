# 🎯 Regole di Sviluppo StudioDimaAI

## 📋 **Regole Generali**
- **SEMPRE** controllare se esistono già funzioni/configurazioni prima di crearne di nuove
- **SEMPRE** usare i sistemi esistenti (es. `constants_v2.py` per colori, `dbf_utils.py` per DBF)
- **SEMPRE** mantenere compatibilità con V1 quando possibile
- **SEMPRE** testare le modifiche prima di considerarle complete

## 🎨 **Regole Calendar**
- I colori degli appuntamenti sono basati sul **TIPO** (V, I, C, H, P, etc.), NON sullo studio
- Usare sempre `app.get('GOOGLE_COLOR_ID', '8')` per i colori Google Calendar
- I colori sono definiti in `server_v2/core/constants_v2.py`

## 🦷 **Regole Materiali**
- I materiali vengono migrati da `VOCISPES.DBF` alla tabella `materiali` nel database SQLite
- Usare sempre `MaterialiMigrationService` per la migrazione con filtri intelligenti
- I materiali dentali sono identificati tramite parole chiave (resina, strisce, perni, cunei, etc.)
- La tabella materiali ha struttura completa con classificazione, inventario e metadati
- Usare `DBFOptimizedReader` per leggere file DBF grandi con performance ottimali

## 🔧 **Regole Backend**
- Usare sempre `get_optimized_reader()` per accesso DBF
- Mantenere logica V1 quando possibile
- Aggiungere logging dettagliato per debug

## 🎨 **Regole Frontend**
- Usare sempre React Core UI framework
- Centralizzare chiamate API in `apiClient.ts`
- Usare Zustand per state management
- Organizzare per feature: `client/src/features/<feature>/`

## 📁 **Regole Struttura**
- Backend: `server_v2/`
- Frontend: `client_v2/`
- Configurazioni: `server_v2/core/`
- Servizi: `server_v2/services/`
- API: `server_v2/api/`

## 🚫 **Cosa NON Fare**
- Non creare funzioni duplicate
- Non ignorare sistemi esistenti
- Non fare modifiche senza controllare l'esistente
- Non usare fetch/axios dirette nel frontend (solo apiClient.ts)

---
*Ultimo aggiornamento: $(date)*
