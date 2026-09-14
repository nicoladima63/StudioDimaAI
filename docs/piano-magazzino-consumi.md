# Piano di implementazione — Magazzino e consumi per seduta

Documento di ripartenza per una chat futura. Aggiornato il 6 settembre 2026.

### Aggiornamento del 7 settembre 2026 — test acquisti

Avviata la preparazione dello storico acquisti separata dal magazzino: scaricati 367 XML dalle email Quaderno Elettronico. Creato estrattore XML preferenziale e fallback DBF, con codici multipli, quantità, unità commerciale, sconti originali, importi netti, IVA/Natura, omaggi e costi accessori. Il DBF è confermato come fonte trasformata e non come fonte primaria quando l'XML è disponibile. Il riconoscimento semantico del materiale resta proposto e revisionabile: non dichiarare 99% senza etichette umane indipendenti.

Integrata la classificazione manuale preesistente da `materiali`, `classificazioni_costi`, `conti`, `branche` e `sottoconti`: 1.809/2.065 righe XML ottengono una categoria da materiale o fornitore, inclusi confronti sicuri per varianti del nome fornitore. Le 256 residue sono esportate per revisione aggregata per fornitore; nessuna categoria è inferita in modo ambiguo.

Dopo l'inserimento di ulteriori classificazioni fornitore in produzione, l'esportazione XML assegna una categoria a **2.055/2.065 righe (99,52% di copertura)**. Il parser ora ricompone anche i fornitori persona fisica presenti negli XML (`Cognome` + `Nome`), oltre a normalizzare le varianti di ragione sociale. Le 10 righe residue restano senza categoria perché non hanno un'associazione esistente: cinque consulenze ortodontiche e cinque righe Henry Schein (quattro articoli/omaggio e un trasporto omaggio). La percentuale misura la copertura della classificazione, non una garanzia di correttezza del contenuto: le categorie esistenti sono riutilizzate senza deduzioni ambigue.

Aggiunta nella pagina Ordini una sezione **Ordine rapido**, utilizzabile prima del magazzino: mostra fino a 30 materiali commerciali più ricorrenti nello storico classificato, consente la ricerca nell'intero catalogo, incrementa la quantità a ogni clic e presenta un checkout di sola stampa raggruppato per fornitore. Non invia ordini, non modifica giacenze e conserva il carrello finché non viene svuotato. Il collegamento a ordini registrati e carichi di magazzino resta una fase successiva.

Ricevuto e verificato successivamente `govfepix.xml` della stessa Henry Schein: 13/13 righe coerenti per codici, descrizioni, quantità, prezzi, IVA e netti. Gli sconti percentuali XML sono rappresentati nei DBF come importi unitari equivalenti; tutte le unità XML sono PZ commerciali, non automaticamente pezzi di consumo. Le righe D contengono riferimenti ordine, non lotti. Aggiornato il report Henry Schein; il precedente limite «XML non verificato» è superato.

Verificata anche Henry Schein 4109602789 del 14/01/2026, PDF contro produzione: 13/13 imponibili ricostruiti e totale 450,59 € coincidente. **DB_VOSCONT in questo caso è uno sconto monetario unitario**, mentre il servizio lo tratta come percentuale. Confermati codici sulle righe C, articolo a prezzo zero e conversioni deducibili dalle descrizioni. Dettagli in [confronto-henry-schein-2026-09-07.md](confronto-henry-schein-2026-09-07.md). Nessuna correzione applicativa ancora eseguita; XML originale Henry Schein non verificato.

Confrontati successivamente tre XML forniti dall'utente con le fatture di produzione: importi coincidenti in tutti e tre i casi; codici articolo su righe `C`, continuazioni descrizione su `r`, informazioni aggiuntive su `D`. Il lettore attuale non ricompone queste informazioni. Dettagli in [confronto-xml-gestionale-2026-09-07.md](confronto-xml-gestionale-2026-09-07.md). Campione senza sconti e con un solo articolo materiale: verifica generale ancora aperta.

L'utente ha dato priorità alla verifica dell'estrazione materiali dalle fatture e autorizzato la lettura della produzione aggiornata. Modalità rilevata `prod`, lasciata invariata. Eseguito audit in sola lettura su SPESAFOR/VOCISPES: 18.546 righe collegate a 1.695 fatture. Lettura riuscita, ma filtri preliminari non affidabili: aspirasaliva esclusi per sottostringa `iva`, PENTA per `pen`, alcune utenze ammesse, righe a prezzo zero scartate. Nessun carico o modifica ai servizi applicativi. Risultati, limiti e riproduzione in [test-estrazione-materiali-2026-09-07.md](test-estrazione-materiali-2026-09-07.md). La verifica degli originali XML e della classificazione finale rimane aperta; la simulazione delle sedute resta da eseguire.

## Obiettivo

Realizzare un magazzino collegato agli acquisti del gestionale e alle prestazioni eseguite, per tracciare consumi, giacenze e necessità di riordino. Preparare i dati per statistiche e futuri costi per prestazione e seduta, anche con più operatori.

La priorità è la tracciabilità dei consumi, non soltanto evitare l'esaurimento delle scorte. Il calcolo del costo complessivo della seduta, del costo orario e del prezzo minimo è una fase successiva. La durata è disponibile nell'appuntamento.

## Stato attuale

- [x] Usato il query engine per esplorare materiali, fornitori e ordini.
- [x] Creato il modulo Ordini materiali, accessibile da Gestione e dalla pagina Materiali.
- [x] Disponibili piani di acquisto con materiale, fornitore, quantità, unità, frequenza e data prevista.
- [x] Disponibili segnalazione manuale “Terminato”, lista per fornitore, esportazione CSV, registrazione ordini, ricezione completa e annullamento.
- [x] Sostituito il select nativo dei materiali con ricerca testuale progressiva tramite react-select.
- [x] Ispezionati in sola lettura struttura e dati aggregati dei DBF locali.
- [ ] Implementare il magazzino: il modulo ordini attuale NON gestisce ancora giacenze, lotti, consumi automatici o carichi da fatture.
- [ ] Predisporre ed eseguire la simulazione osservata nel gestionale.

Verifiche effettuate nelle fasi precedenti: 6 test Python del servizio ordini superati; 5 test UI superati dopo la correzione della ricerca. La build era riuscita prima della correzione del select. Il controllo TypeScript generale presenta errori preesistenti; non considerarlo globalmente superato. Le modifiche sono nel workspace e non risultano ancora consolidate in un commit nella verifica di questa chat.

## Decisioni concordate con l'utente

1. **Carichi da fattura:** leggere le righe di acquisto e proporre una conferma visiva prima di incrementare le scorte. Prevedere un'impostazione attivabile successivamente per il carico automatico. La gestione delle righe non riconosciute o prive di conversione deve rimanere esplicita.
2. **Conversioni:** acquisto in confezioni e consumo in unità base, anche frazionarie. Esempio: una confezione contiene 100 aghi; una prestazione consuma un ago.
3. **Composizione delle prestazioni:** ogni prestazione può utilizzare molti materiali singoli e uno o più blocchi riutilizzabili.
4. **Blocchi per seduta:** lo stesso blocco associato a più prestazioni della stessa seduta viene consumato una sola volta. Esempio: bicchiere, aspirasaliva, tovaglietta e kit strumenti. I materiali assegnati direttamente alle prestazioni si consumano per ciascuna esecuzione.
5. **Evento di scarico:** prestazione segnata “Eseguita”, non semplice prenotazione o creazione della prestazione.
6. **Correzioni:** supportare il passaggio eseguita → da eseguire e l'esecuzione di un'altra prestazione, anche su un altro dente. Soluzione progettuale proposta: storni tracciati e ricalcolo della seduta, conservando i movimenti originali.
7. **Saldo negativo:** consentito, mantenendo traccia dei consumi e rendendo evidente l'insufficienza.
8. **Avvio:** la richiesta più recente supera l'idea iniziale di partire semplicemente da zero: carico iniziale obbligatorio per attivare il materiale, con materiale, fornitore, quantità, lotto e costo d'acquisto. Possibilità di associare la fattura. Definire il caso iniziale di quantità zero senza inventare disponibilità o costi.
9. **Consumo dei lotti:** prima il lotto di acquisto più vecchio (FIFO), coerentemente con l'abitudine di finire la confezione aperta prima della nuova. Non chiedere il lotto a ogni consumo.
10. **Riordino:** aggiornamento immediato della lista e avvisi nelle pagine Magazzino e Ordini. Non richiesti messaggi esterni o notifiche ritardate.
11. **Integrazione futura:** conservare riferimenti e costi storici per ricostruire il cambiamento del costo dei materiali delle singole prestazioni. Non implementare ora il prezzo minimo di vendita.

## Evidenze dal gestionale

L'ispezione è stata effettuata sulla copia di sviluppo: `server_v2/instance/database_mode.txt` conteneva `dev`; DBF sotto `C:\pixel\windent`. Questi risultati descrivono la copia osservata, non garantiscono lo stato attuale della produzione.

| Elemento | Evidenza | Conseguenza |
| --- | --- | --- |
| Stato eseguito | Il monitor reagisce a `DB_GUARDIA == 3`; `GUARDIA_MAP` indica 1=Da Eseguire, 2=In Corso, 3=Eseguito | Verificare dal vivo le transizioni. Un commento nella mappa colonne riporta 1 e 3 invertiti e va corretto dopo conferma |
| Identità riga prestazione | `PREVENT.DB_XXCODE` valorizzato e univoco per tutte le 43.734 righe non cancellate analizzate | Candidato per identità della singola esecuzione, da distinguere dal codice del tipo di prestazione |
| Tipo prestazione | `DB_PRONCOD` e sigla `DB_PRLAVOR` | Non usare il tipo come identificativo univoco di un'esecuzione |
| Collegamento appuntamento | `PREVENT.DB_PRAPXXC` corrisponde ad `APPUNTA.DB_XXCODE` per 618 righe; paziente coerente tramite piano in tutti questi riscontri | Collegamento reale, ma non universale |
| Prestazioni eseguite collegate | 494 righe; 85 appuntamenti con più prestazioni eseguite, fino a 6 | Esiste un raggruppamento diretto utilizzabile per i blocchi |
| Copertura recente | 548 righe eseguite con data dal 2026, 52 collegate ad appuntamenti presenti | Serve una strategia alternativa al collegamento diretto |
| Date non sempre coerenti | Data coincidente per 438 delle 494 righe eseguite collegate | Non trattare ogni collegamento come prova sufficiente di stessa seduta senza controllo |
| Data della prestazione | `DB_PRDATA` è un campo DBF di tipo D, senza orario | Non è possibile ricavare da questo campo l'istante della spunta “Eseguita” |
| Appuntamento | `DB_APDATA`, `DB_APOREIN`, `DB_APOREOU`, `DB_APPACOD`, medico e studio | Disponibili data, intervallo, paziente e contesto |
| Paziente tramite piano | `PREVENT.DB_PRELCOD → ELENCO.DB_CODE → ELENCO.DB_ELPACOD` | Usare il collegamento validato; verificare gli eventuali casi legacy |
| Monitor attuale | Confronta `old_data` e `new_data`; la logica delle prestazioni è oggi collegata alle regole di automazione e al passaggio a 3 | Magazzino deve ricevere anche transizioni inverse e non dipendere dalla presenza di regole messaggi |

**Non è stata concordata una finestra di 30 minuti.** L'utente ha chiesto di dedurre il comportamento dai dati e da una prova osservata. Il timestamp del rilevamento del monitor non equivale necessariamente al momento clinico o al momento effettivo della modifica, soprattutto dopo interruzioni.

## Fase 1 — Osservare e definire le sedute

- [ ] Predisporre un osservatore in sola lettura su PREVENT, APPUNTA ed eventuali collegamenti necessari, usando la copia di sviluppo.
- [ ] Acquisire uno stato iniziale e registrare differenze, ID delle righe, stato precedente/nuovo, data, collegamento appuntamento e istante di rilevamento. Evitare nomi pazienti e contenuti clinici non necessari nei log.
- [ ] Avvisare l'utente quando la rilevazione è pronta: la simulazione NON è ancora stata eseguita.
- [ ] Far simulare su paziente di prova un appuntamento con due otturazioni e un'estrazione, segnate eseguite una dopo l'altra.
- [ ] Far rimettere una delle otturazioni da eseguire e segnare eseguita un'altra su un dente diverso; acquisire gli stati intermedi.
- [ ] Verificare come sono valorizzati collegamenti, date e identità; verificare anche esecuzioni registrate in momenti separati della stessa seduta.
- [ ] Definire la precedenza: collegamento esplicito coerente; appuntamento univoco del paziente nella giornata; informazioni del monitor per i casi rimanenti.
- [ ] Definire segnalazione e correzione manuale per sedute ambigue, doppio appuntamento nello stesso giorno, registrazione tardiva e monitor non attivo.
- [ ] Documentare e testare le regole scelte prima di attivare scarichi automatici.

Accettazione: le prestazioni della prova sono associate alla seduta corretta e la correzione di dente non crea una seconda seduta o un doppio consumo del blocco.

## Fase 2 — Modello dati e migrazioni

I nomi sotto sono concettuali: adattarli alle convenzioni del repository dopo aver verificato schema, database manager e migrazioni esistenti.

- [ ] Separare l'identità del materiale di magazzino dai codici dei diversi fornitori e dalle righe ripetute delle fatture; verificare l'anagrafica materiali esistente prima di riutilizzarne gli ID.
- [ ] Modellare unità base, conversioni per articolo/confezione, soglia di riordino e stato di attivazione del materiale.
- [ ] Modellare carichi e lotti di acquisto con quantità iniziale/residua, fornitore, data, riferimento univoco alla riga fattura, conversione e costo per unità base.
- [ ] Distinguere lotto di acquisto interno da codice lotto del produttore e scadenza, quando disponibili.
- [ ] Modellare registro immutabile dei movimenti con causale, quantità, istante, origine, operatore, collegamenti a seduta/prestazione e movimento stornato.
- [ ] Modellare le allocazioni di uno scarico a uno o più lotti, con quantità e costo storico.
- [ ] Modellare blocchi e componenti, associazioni prestazione-materiale e prestazione-blocco, versioni o copie della configurazione applicata ai consumi.
- [ ] Modellare sedute, associazioni alle righe del gestionale, evidenze di riconoscimento e stato di revisione.
- [ ] Prevedere chiavi di idempotenza, vincoli e transazioni per importazioni, transizioni, allocazioni e storni.
- [ ] Gestire quantità e importi con precisione decimale esplicita, evitando errori cumulativi di arrotondamento.
- [ ] Stabilire la data di avvio: il primo avvio del monitor NON deve scaricare tutte le prestazioni storiche già eseguite.
- [ ] Creare migrazioni additive e verificare che non alterino classificazioni e ordini esistenti.

Accettazione: schema aggiornabile su database di prova, riferimenti tracciabili e nessun doppio movimento con la stessa origine.

## Fase 3 — Carico iniziale e magazzino manuale

- [ ] Creare pagina Magazzino con ricerca, giacenza, unità, soglia, lotti, consumi e registro movimenti.
- [ ] Creare procedura obbligatoria di inizializzazione del materiale con fornitore, quantità, lotto e costo; consentire selezione della fattura/riga già disponibile.
- [ ] Mostrare chiaramente quantità acquistata, fattore di conversione, quantità in unità base e costo convertito prima della conferma.
- [ ] Impedire l'attivazione silenziosa di materiali non inizializzati; mantenere visibili gli eventi che li richiedono, senza perdere consumi.
- [ ] Consentire rettifiche inventariali e movimenti manuali motivati, inclusi materiale usato/scartato.
- [ ] Consentire saldo negativo dopo l'inizializzazione, distinguendo giacenza negativa e quantità effettivamente attribuibili a lotti.
- [ ] Non attribuire costo zero ai consumi senza disponibilità: definirne la valorizzazione o lo stato provvisorio, da rendere esplicito per le integrazioni future.

Accettazione: carico di 2 confezioni da 100 unità produce 200 unità; rettifiche e consumi lasciano una traccia ricostruibile.

## Fase 4 — Acquisti dal gestionale

- [ ] Riutilizzare e verificare la lettura delle fatture e delle quantità già presente nei servizi materiali.
- [ ] Identificare stabilmente documento e riga; proporre l'associazione tra articolo del fornitore e materiale di magazzino.
- [ ] Gestire riconoscimenti dubbi e conversioni mancanti tramite revisione visiva.
- [ ] Creare anteprima dei carichi con materiale, fornitore, quantità, conversione, lotto e costo.
- [ ] Rendere il carico effettivo solo alla conferma, nella modalità iniziale.
- [ ] Aggiungere impostazione esplicita per il carico automatico futuro delle righe valide; non abilitarla di default.
- [ ] Gestire reimportazioni, modifiche della fattura, annullamenti, resi/note di credito e righe omaggio senza duplicare o scartare silenziosamente quantità.
- [ ] Definire il trattamento di sconti, IVA e costi accessori per il costo unitario; conservare comunque i valori sorgente.
- [ ] Coordinare fattura, carico iniziale e ricezione ordine: la stessa merce deve essere caricata una sola volta. La conferma ricezione del modulo ordini non deve introdurre un secondo carico.

Accettazione: importare due volte la stessa fattura non cambia ulteriormente la giacenza; una riga non riconosciuta resta visibile da risolvere.

## Fase 5 — Blocchi e consumi standard

- [ ] Creare editor dei blocchi con materiali e quantità in unità base.
- [ ] Creare editor della composizione di ogni tipo di prestazione: materiali diretti e blocchi.
- [ ] Rendere esplicita la differenza tra consumo per prestazione e consumo una volta per seduta.
- [ ] Definire il caso in cui blocchi diversi contengano lo stesso materiale: la deduplicazione concordata riguarda lo stesso blocco, non automaticamente qualsiasi materiale condiviso.
- [ ] Chiarire la natura del kit strumenti: usa e getta oppure riutilizzabile. Non scaricare strumenti riutilizzabili come monouso senza questa distinzione.
- [ ] Conservare la composizione applicata allo storico; modificare una ricetta o un blocco non deve riscrivere consumi passati.
- [ ] Mostrare un'anteprima dei consumi attesi per una seduta con più prestazioni.

Accettazione: due otturazioni e un'estrazione che condividono il blocco monouso consumano quel blocco una sola volta, oltre ai materiali diretti di ciascuna prestazione.

## Fase 6 — Scarichi automatici, FIFO e correzioni

- [ ] Integrare il magazzino nel rilevamento delle transizioni del gestionale, indipendentemente dalle regole di invio messaggi.
- [ ] Registrare ogni esecuzione tramite ID della riga sorgente e risolverne la seduta secondo la fase 1.
- [ ] Calcolare il consumo della seduta dalle prestazioni attualmente eseguite e dai blocchi richiesti, applicando solo le differenze rispetto ai consumi già contabilizzati.
- [ ] Allocare gli scarichi ai lotti dal più vecchio al più recente; gestire uno scarico distribuito su più lotti.
- [ ] Su eseguita → da eseguire, registrare storni e ripristinare le allocazioni originali, conservando la storia.
- [ ] Mantenere il consumo del blocco finché almeno una prestazione eseguita della seduta lo richiede.
- [ ] Gestire correzione del dente, cambio tipo prestazione, cambio seduta e riga eliminata con regole esplicite e senza doppio scarico.
- [ ] Prevedere unione/separazione manuale delle sedute con ricalcolo tracciato.
- [ ] Gestire riavvio, eventi ripetuti, disconnessioni e sincronizzazioni della copia DBF senza trattare l'istante di lettura come prova certa dell'orario di esecuzione.
- [ ] Mostrare errori o eventi non elaborabili con possibilità di ripresa; evitare perdite silenziose.

Accettazione: la simulazione della fase 1 produce il saldo corretto, un solo blocco comune e storni leggibili. Ripetere il polling o riavviare non cambia il saldo.

## Fase 7 — Soglie e integrazione ordini

- [ ] Configurare soglia in unità base e quantità proposta di acquisto, distinta dalla giacenza.
- [ ] Aggiornare immediatamente avvisi e lista quando la giacenza raggiunge/scende sotto soglia.
- [ ] Evitare righe duplicate e distinguere richieste manuali da quelle generate dalla soglia.
- [ ] Gestire materiali già ordinati/in arrivo senza ordinarli di nuovo automaticamente.
- [ ] Ricalcolare gli avvisi dopo carichi e storni; non eliminare richieste manuali per effetto di un ricalcolo automatico.
- [ ] Mostrare il fabbisogno e lo stato nelle pagine Magazzino e Ordini, senza invio esterno.

Accettazione: soglia attraversata → una richiesta coerente; nuovo carico o storno → stato aggiornato; ordine in arrivo e richieste manuali preservati.

## Fase 8 — Verifica integrata e rilascio graduale

- [ ] Testare conversioni, quantità frazionarie, FIFO su più lotti, storno sul lotto corretto e saldo negativo.
- [ ] Testare inizializzazione obbligatoria, fatture duplicate/rettificate e assenza di doppio carico alla ricezione ordine.
- [ ] Testare blocchi condivisi, più prestazioni uguali, più operatori, due sedute nello stesso giorno e collegamenti mancanti o incoerenti.
- [ ] Testare eventi duplicati, concorrenti, ripresi dopo interruzione e inversioni di stato.
- [ ] Testare permessi e registrazione dell'operatore per rettifiche e conferme.
- [ ] Verificare UI e flusso completo su dati di prova con l'utente.
- [ ] Avviare in modalità osservazione/anteprima e confrontare consumi attesi e registrati prima dell'attivazione degli scarichi effettivi.
- [ ] Documentare inizializzazione, gestione anomalie, rettifiche e passaggio al carico automatico.
- [ ] Eseguire build e test pertinenti; distinguere errori introdotti da quelli preesistenti.

## Preparazione ai costi futuri — senza implementare ora il modulo economico

- [ ] Esporre servizi/API riutilizzabili per movimenti, consumi per seduta/prestazione, allocazioni e costi dei lotti.
- [ ] Conservare quantità, unità, conversione e costo storico per ogni allocazione, insieme a fattura, riga e fornitore.
- [ ] Distinguere costi certi, mancanti o provvisori: saldo negativo non significa consumo gratuito.
- [ ] Conservare l'identità della seduta e il riferimento all'appuntamento, per aggiungere durata e costo orario successivamente.
- [ ] Lasciare separati i consumi dei blocchi comuni della seduta: la loro ripartizione economica tra prestazioni sarà una scelta futura, senza duplicarli.
- [ ] Non ricalcolare retroattivamente lo storico usando l'ultimo listino o la nuova composizione dei blocchi.

## File di partenza

| Area | File |
| --- | --- |
| Pagina ordini | `client_v2/src/features/materiali/pages/OrdiniPage.tsx` |
| Client API ordini | `client_v2/src/features/materiali/services/ordini.service.ts` |
| Servizio ordini | `server_v2/services/ordini_service.py` |
| API materiali e ordini | `server_v2/api/v2_materiali.py` |
| Materiali e acquisti | `server_v2/services/materiali_service.py`, `server_v2/services/materiali_migration_service.py`, `server_v2/repositories/materiali_repository.py` |
| Monitor | `server_v2/services/monitoring_service.py`, `server_v2/services/snapshot_manager.py` |
| Mapping gestionale | `server_v2/core/constants_v2.py` |
| Risoluzione DBF | `server_v2/core/config_manager.py`, `server_v2/utils/dbf_utils.py` |
| Relazione paziente/piano | `server_v2/services/dbf_data_service.py` |
| Dati economici esistenti | `server_v2/services/economics/data_normalizer.py`, `server_v2/services/economics/prestazioni_engine.py` |
| Test ordini | `tests/test_ordini_service.py`, `client_v2/src/features/materiali/pages/OrdiniPage.test.tsx` |

## Istruzione per riprendere in una nuova chat

> Leggi `docs/piano-magazzino-consumi.md` e verifica lo stato attuale dei file. Riprendi dalla prima fase incompleta. Il modulo ordini esiste, il magazzino automatico non è ancora implementato. Il primo passo è predisporre in sviluppo l'osservazione delle modifiche DBF e poi avvisarmi quando posso simulare la seduta e la correzione di dente. Non assumere una finestra temporale di 30 minuti, non attivare scarichi sullo storico e non cambiare modalità database. Conserva le decisioni concordate e aggiorna le checklist con risultati e questioni ancora aperte.
