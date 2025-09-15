# Configurazione Variabili d'Ambiente - Ricette Elettroniche

## File .env nella Root del Progetto

Il servizio carica automaticamente le variabili d'ambiente dal file `.env` nella root del progetto:
```
C:\Users\gengi\Desktop\StudioDimaAI\.env
```

## Variabili Obbligatorie

```bash
# === CREDENZIALI MEDICO OBBLIGATORIE ===
CF_MEDICO_PROD=DMRNCL63S21D612I
PASSWORD_PROD=password_reale_medico
PINCODE_PROD=pincode_reale_medico

# === CONFIGURAZIONE TERRITORIALE ===
REGIONE_PROD=090
ASL_PROD=109
SPECIALIZZAZIONE_PROD=F

# === ID-SESSIONE PER AUTENTICAZIONE (OBBLIGATORIO) ===
ID_SESSIONE_PROD=id_sessione_valido_dal_sistema_ts
```

## Variabili Opzionali

```bash
# === ENDPOINT SISTEMA TS (hanno default) ===
ENDPOINT_VISUALIZZA_PROD=https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demVisualizzaPrescrittoRicettaBianca
ENDPOINT_INVIO_PROD=https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demInvioPrescrittoRicettaBianca
ENDPOINT_ANNULLA_PROD=https://ricettabiancaservice.sanita.finanze.it/RicettaBiancaDemPrescrittoServicesWeb/services/demAnnullaPrescrittoRicettaBianca
ENDPOINT_INTERROGAZIONI_PROD=https://demservice.sanita.finanze.it/DemRicettaInterrogazioniServicesWeb/services/demInterrogaNreUtilizzati

# === CERTIFICATI SSL (path relativi alla root) ===
CERTS_DIR_PROD=certs/prod
CLIENT_CERT_PATH=certs/prod/client_cert.pem
CLIENT_KEY_PATH=certs/prod/client_key.pem
SANITEL_CERT_PATH=certs/prod/SanitelCF-2024-2027.cer

# === PINCODE E CF CIFRATI (opzionali - vengono cifrati dinamicamente) ===
PINCODE_CIFRATO_PROD=pincode_cifrato_dal_sistema
CF_ASSISTITO_DEFAULT_CIFRATO=cf_assistito_default_cifrato

# === ENDPOINT CIFRATURA (hanno default) ===
CIFRA_CF_ENDPOINT=http://localhost:5001/api/v2/ricetta/cifra-cf
CIFRA_PINCODE_ENDPOINT=http://localhost:5001/api/v2/ricetta/cifra-pincode
```

## Note Importanti

1. **Tutti i path sono relativi alla root del progetto**
2. **Le variabili con `_PROD` sono obbligatorie, incluso `ID_SESSIONE_PROD`**
3. **I certificati devono essere presenti nei path specificati**
4. **Se `PINCODE_CIFRATO_PROD` non è fornito, viene cifrato dinamicamente usando `PINCODE_PROD`**
5. **Se `CF_ASSISTITO_DEFAULT_CIFRATO` non è fornito, deve essere fornito un CF assistito specifico**

## Caricamento Automatico

Il servizio carica automaticamente il file `.env` usando `python-dotenv`. Se non è installato, usa solo le variabili d'ambiente di sistema.

## Validazione

Il servizio valida automaticamente che tutte le variabili obbligatorie siano presenti all'avvio.
