# Anagrafica prime visite: dettaglio dal registro dei messaggi inviati

Data: 2026-10-23

## Obiettivo

La pagina Prime visite (`/automation/primevisite`, componente `AutomationMessages.tsx`) elenca i
messaggi con il link al modulo anagrafico inviati ai pazienti. Il paziente compila il modulo sul
sito (`studiodimartino-next`), che manda un'email a "segreteria" con oggetto
`Nuova anagrafica paziente - <Cognome> <Nome>`. Quell'email serve per copiare i dati nel gestionale
(Windent); il programma di posta trasforma numeri ed email in link e il copia e incolla diventa lento.

Su ogni riga della pagina compare un'icona "Dettaglio". Il clic cerca in Gmail l'email di quel paziente
e apre una finestra con i campi, ognuno con il proprio pulsante "Copia" che mette negli appunti il solo valore.

## Decisioni prese

- **Collegamento messaggio-email: il numero di telefono.** Il campo `Cellulare` dell'email deve
  coincidere con il `recipient` del registro (confronto sulle ultime 9 cifre, ignorando `+39`, spazi e simboli).
  Il nome non e' affidabile: il registro riporta "Morel >Niccolo'" e l'email "Morell Niccolo'".
- **Casi dubbi: scelta manuale.** Se nessuna email coincide per numero (numero di un genitore, dato
  incongruente), la finestra elenca le anagrafiche arrivate dopo l'invio del messaggio e l'utente sceglie.
- **Un pulsante "Copia" per campo.** Nessun "Copia tutto".
- **Nessuna regola email e nessuna modifica al sito.** L'app legge Gmail con le credenziali che ha gia'.
- **Solo lettura:** non viene salvato nulla nel database dell'app. I dati del paziente passano
  dal server alla finestra e non vengono memorizzati.

## Comportamento

1. Clic sull'icona "Dettaglio" di una riga: `GET /automation/messages/<id>/anagrafica`
   (rotta protetta dal login, nello stesso blueprint di `/automation/messages`).
2. Il server legge la riga del registro (`automation_message_log`): `created_at` (UTC, formato
   `YYYY-MM-DD HH:MM:SS`) e `recipient`. Id inesistente: 404.
3. Cerca in Gmail con `subject:"Nuova anagrafica paziente" after:<epoch di created_at> before:<epoch + 30 giorni>`.
   Il limite superiore serve perche' Gmail restituisce le email piu' recenti per prime: senza, dopo
   qualche settimana le 15 candidate sarebbero tutte posteriori e l'anagrafica di un paziente piu'
   vecchio non verrebbe trovata. Senza `-from:me` e senza `in:inbox`: il sito puo' spedire dalla
   stessa casella e l'email puo' essere archiviata. Al massimo le 15 piu' recenti.
4. Per ognuna legge il dettaglio (`email_service.get_email_detail`) e ricava i campi dalle righe
   `Etichetta: valore` di `body_text`. Una email senza `body_text` leggibile viene scartata.
5. Risposta: elenco di anagrafiche, ordinate con prima quelle con `phone_match = true`, poi per
   data decrescente.
6. La finestra:
   - **una sola anagrafica con numero coincidente:** mostra direttamente i campi;
   - **altrimenti, con almeno un'anagrafica:** mostra l'elenco (data e ora di arrivo, cognome e nome,
     cellulare) con "Apri" su ogni voce; dalla voce si vedono i campi, con "Indietro" per tornare all'elenco;
   - **nessuna anagrafica:** "Anagrafica non ancora ricevuta".
7. I campi sono i 13 dell'email, nell'ordine: Cognome, Nome, Data di nascita, Comune di nascita,
   Codice fiscale, Sesso, Indirizzo, CAP, Citta, Provincia, Cellulare, Email, Informativa privacy.
   Un campo non trovato nell'email mostra "-" e il suo "Copia" e' disabilitato.
8. **Copia:** `navigator.clipboard.writeText(valore)`. L'app e' raggiungibile sia da
   `https://app.valorian.it` (tunnel Cloudflare, HTTPS: l'API funziona) sia da
   `http://serverdima:5001` (senza HTTPS: l'API puo' non essere disponibile). Quando manca si usa un
   `textarea` temporaneo con `document.execCommand('copy')`. Esito: toast verde "Copiato" o rosso
   "Copia non riuscita".

## Dati e API

Risposta (schema a tre stati del progetto):

```json
{
  "state": "success|warning|error",
  "data": {
    "submissions": [
      {
        "email_id": "…",
        "received_at": "Thu, 22 Oct 2026 20:51:00 +0200",
        "phone_match": true,
        "fields": [{"label": "Cognome", "value": "Morell"}]
      }
    ]
  },
  "message": "…"
}
```

- Gmail non collegato (`GmailCredentialsNotFoundError`): HTTP 200, `state: error`, `error: GMAIL_AUTH_REQUIRED`,
  messaggio "Autenticazione Gmail richiesta: ricollega Gmail dalla pagina Email".
- Errore Gmail (`GmailApiError`): HTTP 200, `state: error`, `error: GMAIL_API_ERROR` (codice costante, mai il testo
  dell'eccezione: conterrebbe l'indirizzo interno della richiesta), messaggio "Errore di comunicazione con Gmail,
  riprova tra poco". Si risponde 200 perche' il client HTTP dell'app, su qualunque altro codice, mostra da solo un
  toast con il campo `error` e rifiuta con un oggetto senza `response`.
- Errore imprevisto: HTTP 500, `error` e `message` "Errore recupero anagrafica", senza dettagli interni.
- Messaggio inesistente: HTTP 404, `error: not_found`.
- Nessuna anagrafica: `state: success` con `submissions: []`.

## File

- `server_v2/services/anagrafica_email_service.py` (nuovo): funzioni pure `parse_anagrafica_text`,
  `phone_matches`, e `find_submissions(row, email_service)`.
- `server_v2/api/v2_automation_logs.py`: nuova rotta, sul blueprint che gia' richiede il login.
- `server_v2/tests/test_anagrafica_email_service.py` (nuovo): parser, confronto numeri, ordine, rotta
  con `email_service` simulato. La cartella `tests/` e' esclusa da git (`.gitignore` riga 65).
- `client_v2/src/features/automation/services/automationMessagesService.ts`: metodo `apiGetAnagrafica(id)`.
- `client_v2/src/features/automation/components/AnagraficaModal.tsx` (nuovo): finestra CoreUI con
  elenco, campi e pulsanti Copia.
- `client_v2/src/features/automation/components/AnagraficaModal.test.tsx` (nuovo).
- `client_v2/src/features/automation/pages/AutomationMessages.tsx`: colonna con l'icona "Dettaglio".

## Gestione errori

- Gmail lento o in errore: la finestra mostra il messaggio d'errore con "Riprova"; la pagina non si rompe.
- Email con piu' righe `Cellulare` o formato diverso dal previsto: i campi non riconosciuti si
  mostrano come "-", non c'e' un'eccezione.
- Il registro contiene anche messaggi inviati prima dell'attivazione del modulo o a numeri che non
  l'hanno mai compilato: per quelle righe la finestra mostra "Anagrafica non ancora ricevuta".

## Test

- Parser: email d'esempio (quella di Morell) -> i 13 campi; valori con `:` nel testo; riga mancante.
- `phone_matches`: `3473777842` contro `+39 347 377 7842`; numeri diversi; stringhe vuote.
- Ordine: prima le coincidenze per numero, poi per data decrescente.
- Rotta: senza token 401; id inesistente 404; Gmail non collegato -> `state: error`; caso felice.
- Finestra: una coincidenza apre i campi; nessuna coincidenza mostra l'elenco; "Copia" scrive il valore
  giusto e usa il metodo di riserva se `navigator.clipboard` manca; campo vuoto con "Copia" disabilitato.
- `npm run type-check` senza nuovi errori; `npx vitest run` verde; prova manuale con l'email di un
  paziente vero.

## Fuori ambito

"Copia tutto"; salvataggio dell'anagrafica nell'app o scrittura nel gestionale; segnare un'anagrafica
come "gia' inserita"; notifica all'arrivo dell'email; modifica del formato dell'email del sito; ricerca per nome.

## Da verificare alla prima prova

- Che la casella Gmail collegata all'app sia quella che riceve le email del modulo.
- Che il numero del registro coincida per intero con il `Cellulare` compilato dal paziente.
