# Sistema Ricette Elettroniche TS - Guida Completa

## 📋 Panoramica

Questo sistema implementa l'integrazione completa con il **Sistema Tessera Sanitaria** per la gestione delle ricette elettroniche non a carico SSN. Il sistema è basato sui tracciati ufficiali del kit di sviluppo fornito dal Ministero della Salute.

## 🏗️ Architettura

### Backend (Python)
- **`ricette_ts_service.py`**: Servizio principale per la comunicazione con il Sistema TS
- **`test_ricette_ts_config.py`**: Configurazione per test usando i dati del kit di sviluppo
- **`test_ricette_ts_integration.py`**: Test di integrazione completi

### Frontend (React + TypeScript)
- **`RicetteTSPaziente.tsx`**: Componente per la visualizzazione delle ricette dal Sistema TS

## 🔧 Configurazione

### 1. Variabili d'Ambiente

Crea un file `.env` nella root del progetto con le seguenti variabili:

```env
# Configurazione Produzione
CF_MEDICO_PROD=ILTUOCF16CARATTERI
PASSWORD_PROD=LaTuaPassword
PINCODE_PROD=1234567890
PINCODE_CIFRATO_PROD=IlPincodeCifrato
REGIONE_PROD=020
ASL_PROD=101
SPECIALIZZAZIONE_PROD=F
ID_SESSIONE_PROD=IlTuoToken2FA

# Configurazione Test (opzionale)
CF_MEDICO_TEST=PROVAX00X00X000Y
PASSWORD_TEST=Salve123
PINCODE_TEST=1234567890
```

### 2. Certificati

Posiziona i certificati nella cartella `server_v2/certs/prod/`:
- `client_cert.pem`: Certificato client
- `client_key.pem`: Chiave privata client
- `SanitelCF-2024-2027.cer`: Certificato SanitelCF

## 🚀 Utilizzo

### Backend

#### Test di Integrazione
```bash
cd server_v2
python test_ricette_ts_integration.py
```

#### Test di Configurazione
```bash
python test_ricette_ts_config.py
```

#### Utilizzo del Servizio
```python
from services.ricette_ts_service import RicetteTsService

service = RicetteTsService()

# Visualizza tutte le ricette per un paziente
result = service.get_all_ricette(cf_assistito="PNIMRA70A01H501P")

# Visualizza ricetta specifica
result = service.visualizza_ricetta_specifica("123456789012", "PNIMRA70A01H501P")
```

### Frontend

Il componente `RicetteTSPaziente` fornisce:

1. **Ricerca ricette** per codice fiscale paziente
2. **Filtri avanzati** (data, NRE specifico)
3. **Visualizzazione dettagliata** con tutti i campi del tracciato ufficiale
4. **Gestione errori** con messaggi informativi
5. **Download PDF** delle ricette
6. **Debug XML** per troubleshooting

## 📊 Funzionalità Implementate

### ✅ Parsing XML Avanzato
- Basato sui tracciati ufficiali WSDL/XSD
- Estrazione completa di tutti i campi
- Gestione errori e comunicazioni
- Fallback con parsing regex

### ✅ Gestione Errori Robusta
- Codici errore standardizzati
- Messaggi informativi per l'utente
- Suggerimenti per la risoluzione
- Analisi automatica delle risposte

### ✅ Visualizzazione Completa
- Dati ricetta (NRE, PIN, farmaco, posologia)
- Dati medico (nome, cognome, CF, regione, ASL)
- Dati paziente (nome, CF, indirizzo)
- Dettagli prescrizione (AIC, quantità, note)
- Metadati transazione (protocollo, esito, timestamp)

### ✅ Test e Debug
- Test di connessione
- Test di parsing XML
- Test di integrazione completa
- Logging dettagliato
- Salvataggio XML per analisi

## 🔍 Debug e Troubleshooting

### 1. Verifica Configurazione
```bash
python test_ricette_ts_config.py
```

### 2. Test Connessione
```bash
python test_ricette_ts_integration.py
```

### 3. Log Files
- `logs/app.log`: Log generali dell'applicazione
- `logs/server_v2.log`: Log specifici del server v2

### 4. XML Debug
Il sistema salva automaticamente le risposte XML in file per l'analisi:
- `response_xml_nre_[NRE].xml`: Risposte per ricette specifiche
- Visualizzazione XML formattata nel frontend

## 📚 Riferimenti

### Kit di Sviluppo
- **Tracciati WSDL/XSD**: `server_v2/docs/Kit per lo sviluppo - Ricetta elettronica non a carico SSN - Prescrittore - ver. 20231121/`
- **Endpoint**: `endpoint.txt`
- **Utenze Test**: `utenze.txt`
- **Assistiti Test**: `assistitoTest.txt`

### Documentazione Tecnica
- **WSDL Visualizzazione**: `tracciatiWs/VisualizzaPrescritto/demVisualizzaRicettaBiancaPrescritto.wsdl`
- **XSD Richiesta**: `tracciatiWs/VisualizzaPrescritto/VisualizzaPrescrittoRicettaBiancaRichiesta.xsd`
- **XSD Risposta**: `tracciatiWs/VisualizzaPrescritto/VisualizzaPrescrittoRicettaBiancaRicevuta.xsd`

## ⚠️ Note Importanti

1. **Ambiente Produzione**: Il sistema è configurato per l'ambiente di produzione. Per test, modificare le variabili d'ambiente.

2. **Certificati**: Assicurarsi che i certificati siano validi e posizionati correttamente.

3. **Token 2FA**: Il token 2FA deve essere aggiornato mensilmente.

4. **Rate Limiting**: Rispettare i limiti di chiamate del Sistema TS.

5. **Logging**: I log contengono informazioni sensibili. Proteggere adeguatamente i file di log.

## 🆘 Supporto

Per problemi o domande:
1. Verificare i log per errori specifici
2. Eseguire i test di integrazione
3. Controllare la configurazione delle variabili d'ambiente
4. Verificare la validità dei certificati

## 📝 Changelog

### v2.0.0 (2024-01-15)
- ✅ Implementazione completa basata sui tracciati ufficiali
- ✅ Parsing XML avanzato con fallback
- ✅ Gestione errori robusta
- ✅ Visualizzazione frontend ottimizzata
- ✅ Test di integrazione completi
- ✅ Documentazione completa
