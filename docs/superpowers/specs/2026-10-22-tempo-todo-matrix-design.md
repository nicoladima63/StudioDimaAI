# Matrice di Eisenhower collegata ai todo (TempoPage)

Data: 2026-10-22

## Obiettivo

`TempoPage.tsx` oggi e' una matrice di Eisenhower a se' stante: i task stanno solo nel
`localStorage` del browser. La pagina diventa una vista dei todo dell'utente loggato: ogni
todo aperto compare nel quadrante giusto, si sposta trascinandolo, si apre con un click e si
chiude con un pulsante "Eseguito".

## Decisioni prese

- **Un solo campo di classificazione: la priorita' del todo.** Un campo quadrante separato
  sarebbe ridondante e potrebbe contraddire la priorita' (un todo `urgent` nel Q4). La matrice
  e' una vista della priorita', e il drag la modifica.
- **Mappa priorita' <-> quadrante:** `urgent` = Q1, `high` = Q2, `medium` = Q3, `low` = Q4.
  Il Q3 va letto come "priorita' media"; per evitare l'equivoco con "urgente non importante"
  l'intestazione di ogni quadrante riporta il nome della priorita' (es. "Fare subito - priorita' urgente").
- **I task locali spariscono.** Nessuna migrazione: i dati nel `localStorage` restano nel
  browser ma la pagina non li legge piu'.
- **Drag nativo HTML5** (gia' presente nella pagina), senza touch. `@dnd-kit` non viene usato.
- **Solo frontend.** Nessuna modifica a backend o database.

## Comportamento

- All'apertura la pagina carica i todo aperti (`pending` e `read`) dell'utente loggato.
  L'utente viene dall'auth store, come in `TodosPage`.
- Un todo con priorita' mancante o sconosciuta viene trattato come `medium` (Q3).
- **Card:** oggetto, estratto del messaggio, scadenza con le diciture gia' presenti
  (SCADUTO, OGGI, Domani, "N giorni"), scadenza in rosso se superata.
- **Click sulla card:** naviga a `/todos?open=<id>`, che apre il modal del todo in `TodosPage`.
- **Pulsante "Eseguito":** chiama `todoService.complete(id, user.id)`. Se riesce la card
  sparisce e compare il toast verde "Todo completato". Il click sul pulsante non fa
  navigare la card.
- **Drag:** la card si trascina su un altro quadrante. Al rilascio si sposta subito e parte
  `todoService.update(id, { priority })`. Il rilascio sullo stesso quadrante non fa nulla.
  Mentre una card e' in salvataggio non e' trascinabile ne' completabile.
- **Ricerca:** testo libero su oggetto e messaggio, senza distinzione di maiuscole.
- **Statistiche:** numero di todo aperti e di scaduti (scadenza passata).
- **Caricamento:** skeleton al posto dello spinner. Dopo il caricamento l'elenco si aggiorna
  solo con le azioni dell'utente, non con polling.

## Dati e API (tutte gia' esistenti)

| Azione | Chiamata |
|---|---|
| Carica i todo aperti | `todoService.getPending(userId)` -> `GET /todos/pending?user_id=` |
| Cambia quadrante | `todoService.update(id, { priority })` -> `PATCH /todos/<id>` (`priority` e' tra i campi ammessi) |
| Esegui | `todoService.complete(id, userId)` -> `POST /todos/<id>/complete` |
| Apri il todo | rotta frontend `/todos?open=<id>` |

La priorita' non influenza i promemoria: la scadenza e `urgency_level` sono campi separati,
quindi il drag non altera le notifiche.

## File

- `client_v2/src/features/tempo/tempo.ts` (nuovo): titoli e sottotitoli dei quadranti e le
  funzioni `quadrantOfPriority` e `priorityOfQuadrant`. Funzioni pure, senza React.
- `client_v2/src/features/tempo/tempo.test.ts` (nuovo): test della mappa.
- `client_v2/src/features/tempo/pages/TempoPage.tsx` (riscritta): carica, mostra, sposta,
  completa. Resta il layout con `PageLayout`, i componenti CoreUI e i quattro quadranti.
- `client_v2/src/features/tempo/pages/TempoPage.test.tsx` (nuovo): test della pagina con
  `todoService` simulato, sul modello dei test in `features/materiali/pages/`.
- Nessun cambio al router: la rotta esiste gia' (`EisenhowerMatrixPage`).

## Gestione errori

- Caricamento fallito: messaggio nella pagina con pulsante "Riprova" e toast rosso.
- Spostamento fallito: la card torna nel quadrante di partenza e compare un toast rosso.
- Completamento fallito: la card resta dov'e' e compare un toast rosso.
- Toast come in `TodosPage` (`react-hot-toast`): verde per l'esito positivo, rosso per l'errore.

## Test

- `tempo.test.ts`: ogni priorita' va nel quadrante previsto e torna alla priorita' di partenza;
  priorita' mancante o sconosciuta -> Q3.
- `TempoPage.test.tsx`: i todo compaiono nel quadrante giusto; "Eseguito" chiama
  `complete` e toglie la card; il drop su un altro quadrante chiama `update` con la nuova
  priorita'; un `update` fallito riporta la card al suo posto; il click naviga a `/todos?open=<id>`.
- `npm run type-check` senza nuovi errori rispetto alla situazione attuale (195 preesistenti),
  `npm test` verde, e prova manuale nel browser.

## Fuori ambito

Ordine manuale dentro un quadrante, creazione di todo dalla matrice, vista admin con i todo
di tutti, aggiornamento automatico, touch, tag e colori, migrazione dei task locali.

## Nota di sicurezza preesistente (non toccata)

`PATCH /todos/<id>` non verifica che chi modifica sia il destinatario, e `complete` si fida
dell'`user_id` inviato dal client. Vale gia' oggi per `TodosPage`; questa funzionalita' non la
peggiora ne' la risolve.
