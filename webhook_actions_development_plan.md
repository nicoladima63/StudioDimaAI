# Piano di Sviluppo: Azioni Dinamiche con Webhook

**Obiettivo:** Evolvere il sistema di automazione per permettere agli utenti di creare dinamicamente nuove azioni di tipo "Webhook", rendendo il sistema più flessibile e integrabile con servizi esterni.

---

## 1. Analisi dell'Architettura Attuale

L'analisi del file `server_v2/services/automation_service.py` ha rivelato quanto segue:

- **Database-Driven:** Il sistema utilizza un database con una tabella `actions` e una `automation_rules`, che è un'ottima base di partenza.
- **Registro Statico:** L'esecuzione delle azioni è gestita da un dizionario Python (`action_implementation_registry`) che mappa un nome di azione (es. `"send_sms_link"`) a una funzione Python specifica e pre-esistente nel codice.
- **Bottleneck:** Il sistema non può eseguire azioni che non sono esplicitamente definite in questo registro. Questo impedisce la creazione di azioni veramente dinamiche.

---

## 2. Architettura Proposta

Introdurremo un nuovo tipo di azione, il **"Webhook"**, che sarà gestito da una singola funzione generica nel backend.

1.  **Nuovo Tipo di Azione:** Aggiungeremo una colonna `type` alla tabella `actions` per distinguere le azioni di sistema (`system`) da quelle nuove (`webhook`).
2.  **Esecutore Generico:** Creeremo una sola funzione Python, `_impl_execute_webhook`, responsabile dell'esecuzione di *tutte* le azioni di tipo `webhook`.
3.  **Flusso di Esecuzione Modificato:** Il motore di automazione leggerà il tipo di azione dal database:
    - Se `system`, cercherà la funzione specifica nel registro come fa ora.
    - Se `webhook`, invocherà l'esecutore generico `_impl_execute_webhook`.

---

## 3. Piano di Sviluppo: Backend

Le modifiche si concentreranno sul `server_v2`.

### 3.1. Database (Migration)

Creare una nuova migrazione per modificare la tabella `actions`:

- **Aggiungere colonna `type`**: `TEXT NOT NULL DEFAULT 'system'`
- **Aggiungere colonna `target_url`**: `TEXT` (conterrà l'URL del webhook)
- **Aggiungere colonna `http_method`**: `TEXT NOT NULL DEFAULT 'POST'`
- **Aggiungere colonna `body_template`**: `TEXT` (conterrà il template JSON del corpo della richiesta)

### 3.2. Servizio (`automation_service.py`)

1.  **Creare l'Esecutore Generico `_impl_execute_webhook`**:
    - Questa nuova funzione riceverà il `context` (che includerà i dati del trigger e i parametri della regola).
    - Recupererà `target_url` e `body_template` dalla definizione dell'azione (passata nel contesto).
    - **Templating**: Utilizzerà un sistema di templating (es. `body_template.format(**context)`) per popolare il `body_template` con i dati dinamici del contesto (es. `{{patient_name}}`, `{{change_details}}`).
    - **Chiamata HTTP**: Utilizzerà la libreria `requests` per inviare la richiesta HTTP all'URL specificato.
    - **Logging e Risultato**: Registrerà l'esito della chiamata e restituirà un risultato standard.

2.  **Registrare il Nuovo Esecutore**:
    - Aggiungere una chiave al dizionario `action_implementation_registry`:
      ```python
      self.action_implementation_registry = {
          'send_sms_link': self._impl_send_sms_link,
          'webhook_executor': self._impl_execute_webhook, # NUOVO
      }
      ```

3.  **Modificare `_execute_single_rule`**:
    - Recuperare l'azione completa dal DB, incluso il nuovo campo `type`.
    - Aggiungere una logica condizionale:
      ```python
      action_type = action_details.get('type', 'system')
      
      if action_type == 'system':
          impl_func = self.action_implementation_registry.get(action_name)
      elif action_type == 'webhook':
          impl_func = self.action_implementation_registry.get('webhook_executor')
      else:
          # Gestire errore
      
      # ... procedere con l'esecuzione di impl_func
      ```

### 3.3. API (es. `api/v2_actions.py`)

- Modificare gli endpoint CRUD per le azioni:
    - `POST /api/v2/actions`: Permettere la creazione di azioni con `type: 'webhook'` e i campi `target_url`, `http_method`, `body_template`.
    - `PUT /api/v2/actions/{id}`: Permettere la modifica di queste nuove azioni.

---

## 4. Piano di Sviluppo: Frontend

Le modifiche si concentreranno sul `client_v2`.

### 4.1. Nuova Pagina: Gestione Azioni (`/settings/actions`)

- Creare una nuova pagina raggiungibile dal menu delle impostazioni.
- La pagina conterrà una tabella che elenca tutte le azioni (sia `system` che `webhook`).
- Prevedere pulsanti per "Crea Nuova Azione", "Modifica" ed "Elimina" (solo per azioni non di sistema).

### 4.2. Form di Creazione/Modifica Azione

- Creare un modal o una pagina dedicata con un form.
- **Campi Base**: `name`, `description`.
- **Selezione Tipo**: Un dropdown per selezionare il tipo di azione. Se viene scelto "Webhook":
    - **Campi Webhook**: Mostrare i campi aggiuntivi: `target_url`, `http_method` (dropdown con POST, GET, PUT), e una text area per il `body_template` (in formato JSON).

### 4.3. Aggiornare la Creazione delle Regole

- **File da modificare**: `client_v2/src/features/settings/components/monitor/CallbackCard.tsx`.
- Il dropdown "Azione" attualmente mostra una lista statica. Dovrà essere popolato tramite una chiamata all'API `GET /api/v2/actions`.
- La lista mostrerà sia le azioni di sistema che quelle create dall'utente, offrendo una scelta molto più ampia.
