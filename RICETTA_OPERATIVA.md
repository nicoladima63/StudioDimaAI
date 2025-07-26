# 🏥 RICETTA ELETTRONICA - PROCEDURA OPERATIVA

## 🚀 **PASSI PER INIZIARE A INVIARE RICETTE**

### **1. 🧪 TEST FINALE (Ambiente TEST)**

Prima di passare in produzione, verifica che tutto funzioni:

```bash
cd "C:\Users\gengi\Desktop\StudioDimaAI"

# Avvia il server backend
python -m server.main  # o il comando che usi

# Apri browser su http://localhost:8000/ricetta-elettronica
# 1. Clicca "Test Connessione" → Deve essere ✅ verde
# 2. Compila ricetta test con CF: PNIMRA70A01H501P 
# 3. Invia ricetta → Deve restituire NRBE
```

### **2. 🔐 SETUP CERTIFICATI PRODUZIONE**

```bash
# Estrai certificati dal tuo P12
python extract_prod_certs.py
# Inserisci password del certificato quando richiesto
```

### **3. ⚙️ SWITCH IN PRODUZIONE**

```bash
# Cambia ambiente
python switch_ricetta_env.py
# Scegli opzione 2 (PROD)
# Scrivi 'CONFERMO' per confermare

# Riavvia il server per applicare le modifiche
```

### **4. 🎯 INVIO RICETTA REALE**

1. **Vai su pagina Ricetta Elettronica**
2. **Clicca "Test Connessione"** → Deve essere ✅ verde 
3. **Compila ricetta con dati REALI:**
   - **Paziente**: CF reale del paziente
   - **Diagnosi**: Diagnosi ICD-10 corretta
   - **Farmaco**: Codice AIC valido
   - **Posologia/Durata**: Corrette

4. **Clicca "Invia Ricetta"**
5. **Sistema restituisce NRBE** → Ricetta valida!

---

## ⚠️ **IMPORTANTE - SICUREZZA**

### **🔒 Ambiente TEST vs PRODUZIONE**

| Aspetto | TEST | PRODUZIONE |
|---------|------|------------|
| **Credenziali** | Kit ministeriale | Tue credenziali reali |
| **CF Medico** | `PROVAX00X00X000Y` | `DMRNCL63S21D612I` |
| **Ricette** | NON valide legalmente | ✅ VALIDE LEGALMENTE |
| **Endpoint** | `ricettabiancaservicetest.sanita.finanze.it` | `ricettabiancaservice.sanita.finanze.it` |

### **🛡️ Protezioni Implementate**

- ✅ **SSL Legacy**: Gestione certificati ministeriali vecchi
- ✅ **Crittografia**: PinCode e CF assistito cifrati con certificato SanitelCF
- ✅ **Token 2FA**: Generazione automatica formato `CF-YYYY-MM`
- ✅ **Basic Auth**: CF medico + password
- ✅ **Validazione**: Controlli campi obbligatori
- ✅ **Logging**: Tracciamento completo operazioni

---

## 🔄 **SWITCH RAPIDO AMBIENTE**

### **Per Test/Debug:**
```bash
python switch_ricetta_env.py
# Scegli 1 (TEST)
```

### **Per Ricette Reali:**
```bash
python switch_ricetta_env.py  
# Scegli 2 (PROD) + scrivi 'CONFERMO'
```

---

## 📞 **RISOLUZIONE PROBLEMI**

### **❌ Test Connessione Fallisce**
- Verifica che il server sia avviato
- Controlla certificati in `certs/prod/`
- Esegui `python extract_prod_certs.py`

### **❌ Errore SSL**
- Normale per certificati ministeriali vecchi
- Il sistema usa configurazione SSL legacy automaticamente

### **❌ Errore Autenticazione**
- Verifica credenziali in `.env.ricetta.prod`
- Controlla che PINCODE sia corretto

### **❌ HTTP 500 su invio**
- Verifica formato dati ricetta
- Controlla logs del server
- Usa ambiente TEST per debug

---

## 🎯 **STATO ATTUALE**

✅ **Sistema PRONTO e FUNZIONANTE**
- Ambiente TEST: Completamente testato
- Ambiente PROD: Configurato con tue credenziali  
- SSL: Gestione certificati legacy OK
- Frontend: Pagina ricetta completamente funzionale
- Backend: API robuste con gestione errori

**Puoi iniziare a inviare ricette reali!**

---

## 📝 **LOG RICETTE**

Tutte le ricette inviate vengono loggiate con:
- Timestamp invio
- CF assistito (cifrato nei log)
- Codice esito sistema TS
- NRBE generato
- Eventuali errori

Logs disponibili nella console del server e nei file di log dell'applicazione.