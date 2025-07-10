✅ Checklist Step 1: Struttura cartelle backend
1. Crea la struttura base
[ ] server/app/
[ ] server/app/config/
[ ] server/app/api/
[ ] server/app/models/
[ ] server/app/services/
[ ] server/app/db/
[ ] server/app/utils/
[ ] server/app/schemas/
[ ] server/app/core/
[ ] server/app/migrations/ (se usi migrazioni DB)
[ ] server/tests/
[ ] server/instance/ (per config locali, se serve)
2. Aggiungi file vuoti per inizializzazione pacchetti
[ ] In ogni cartella sopra, aggiungi un file __init__.py (può essere vuoto).
3. File fondamentali da creare (anche vuoti per ora)
[ ] server/app/extensions.py
[ ] server/app/config/config.py
[ ] server/app/config/constants.py
[ ] server/app/db/db.py
[ ] server/app/schemas/__init__.py (può restare vuoto per ora)
4. (Opzionale) Entry point
[ ] server/app/main.py (o lascia run.py nella root di server/)

Ordine consigliato per il refactor
config/
constants.py
utils/
core/ ⬅️ (prossimo step consigliato!)
extensions.py
models/
services/
api/

OPZIONALI
Aggiunte consigliate
1. Cartelle per static e templates (se usi Flask con HTML):
[ ] server/app/static/ (per file statici: immagini, css, js)
[ ] server/app/templates/ (per template Jinja2, se usi pagine HTML)
2. File di configurazione per i test (se prevedi test automatici):
[ ] server/tests/conftest.py (utile con pytest per fixtures globali)
3. File README interno (opzionale ma utile):
[ ] server/README.md (per spiegare la struttura del backend)
4. (Opzionale) requirements-dev.txt
[ ] requirements-dev.txt (per dipendenze di sviluppo: pytest, black, isort, ecc.)