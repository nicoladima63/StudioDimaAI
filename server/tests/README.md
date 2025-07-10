# Test Suite

Questa cartella contiene tutti i test del progetto StudioDimaAI.

## File di Test

### `test_recalls.py`
Test per il modulo richiami/recalls:
- Test delle funzioni di utilità (normalizzazione telefono, costruzione messaggi)
- Test del service RecallService
- Test delle statistiche e filtri

**Esecuzione:**
```bash
cd server
python tests/test_recalls.py
```

### `test_ricetta_bianca.py`
Test per il modulo ricetta bianca:
- Test validazione codice fiscale
- Test validazione prescrizioni
- Test crittografia

**Esecuzione:**
```bash
cd server
pytest tests/test_ricetta_bianca.py
```

### `test_rentri.py`
Test per le API RENTRI:
- Test servizio anagrafiche
- Test autenticazione e token
- Framework per testare tutti i servizi RENTRI

**Esecuzione:**
```bash
cd server
python tests/test_rentri.py --service anagrafiche
python tests/test_rentri.py --service all
```

### `test_auth_rentri.py`
Test per l'autenticazione RENTRI:
- Generazione JWT token
- Richiesta Bearer token
- Test connessione API

**Esecuzione:**
```bash
cd server
python tests/test_auth_rentri.py
```

## Note

- Tutti i test usano import assoluti per compatibilità con la nuova struttura
- I test sono organizzati per modulo/feature
- Alcuni test richiedono configurazioni specifiche (certificati, token, etc.)
- I test nelle API (`api_richiami.py`, `api_pazienti.py`) sono endpoint di test, non file separati 