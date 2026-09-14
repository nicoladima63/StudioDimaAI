# Ricerca materiali condivisa — da integrare dopo la prova

Funzione: `client_v2/src/features/materiali/services/ricerca-materiali.ts`.
È disponibile nel menu **Prova ricerca materiali**, all’indirizzo `/materiali/prova-ricerca`. Scrivi `arom` nel campo Cerca materiali e prova i filtri; **Azzera ricerca e filtri** ripristina tutte le righe. Le pagine operative non sono ancora state migrate. Il componente riutilizzabile è `components/RicercaMateriali.tsx`; la pagina di prova carica i dati reali. Riceve tutte le righe e restituisce quelle corrispondenti, senza raggruppare, ordinare, modificare dati o applicare esclusioni implicite.

## Esempi

```ts
ricercaMateriali(materiali, { testo: 'arom' });
ricercaMateriali(materiali, { testo: 'umbra', campi: ['fornitorenome'] });
ricercaMateriali(materiali, { testo: 'rosa alginato', campi: ['nome'] });
ricercaMateriali(materiali, { testo: 'arom', tipiCosto: [1, 3] });
ricercaMateriali(materiali, { fornitoriId: ['ID_GESTIONALE'], contiId: [10], brancheId: [20], sottocontiId: [30] });
ricercaMateriali(materiali, { testo: 'arom', confermato: true, iniziale: 'A' });
ricercaMateriali(materiali, { testo: 'krugg' }, { fornitori: fornitoriMap });
```

Campi predefiniti: nome, codice articolo e nome fornitore. Tutte le parole devono essere presenti nei campi selezionati, anche in ordine diverso. Il confronto ignora maiuscole, accenti e spazi ripetuti; non applica sinonimi o equivalenze commerciali.

Filtri differenti si combinano in AND. Più valori nello stesso filtro si combinano in OR. Liste vuote disattivano il filtro; `campi: []` non cerca in nessun campo e quindi non trova un testo non vuoto. La lettera `#` seleziona nomi con iniziale non alfabetica.

`tipiCosto` usa i valori 1, 2, 3 della classificazione. I materiali base non espongono questo campo: prima dell'integrazione occorre arricchire le righe oppure fornire `tipoCosto: riga => ...` nel terzo parametro. Una classificazione mancante non soddisfa un filtro costo attivo. Conto, branca e sottoconto sono filtri distinti dal tipo di costo.

La mappa fornitori collega il nome ufficiale tramite ID; il nome storico resta ricercabile. La funzione non cambia le etichette visualizzate.

## Prova automatica

Dalla radice del progetto:

```sh
npm --prefix client_v2 test -- --run src/features/materiali/services/ricerca-materiali.test.ts
```

Il caso `arom` include AROMA FINE PLUS NORMAL ROSA 1 KG, AROMA FINE NORMAL BUSTA 1KG e GC Alginato aroma fine Plus presa normale colore ROSA. I dati dei test sono esempi, non una verifica del database corrente.

Per ottenere risultati congruenti, le pagine dovranno passare lo stesso insieme completo di righe e gli stessi filtri. Schede, righe e ultimi tre acquisti saranno elaborazioni successive alla ricerca.


## Storico completo nella schermata di prova

La pagina usa ora `GET /materiali/storico-acquisti`: legge SPESAFOR, VOCISPES e FORNITOR dall’ambiente configurato, gli XML nella cartella fatture email e quelli già acquisiti. Non modifica DBF, catalogo materiali o classificazioni.

Gli XML sostituiscono tutte le righe del documento DBF abbinato per fornitore (partita IVA verso ID gestionale), data, numero e tipo documento. Se il tipo DBF manca, è ammesso solo un abbinamento altrimenti esatto e univoco. File duplicati non duplicano gli acquisti. Ambiguità, file non leggibili e versioni XML discordanti sono segnalati nella copertura.

La ricerca conserva anche le voci da classificare, i servizi e gli addebiti commerciali. Le righe puramente informative sono escluse dall’estrattore. La classificazione esatta prodotto/fornitore viene recuperata dal catalogo confermato; le altre affinità sono proposte esplicite e non entrano automaticamente nelle categorie. La revisione delle classificazioni XML e un catalogo di equivalenze commerciali restano passaggi successivi.

Seleziona **Visualizzazione** per consultare storico, quantità/costi annuali per prodotto o costi annuali per categoria. I riepiloghi rispettano tutti i filtri attivi. Quantità per descrizione, codice, fornitore e unità differenti restano separate. Le unità assenti nel DBF sono indicate come non disponibili: non sono pezzi né consumi. Prezzi netti e imponibili delle righe includono gli sconti; note di credito TD04/TD08 sono negative. I kit non vengono scomposti.

Verifica in sola lettura del 10 settembre 2026: ritrovate 51 righe Italtrading, tra cui 7 contenenti “aspira” e 6 “bicchier”. Le tovagliette compaiono come “salviette monouso Towel Up” e in uno Starter Pack. Nessuna equivalenza tra questi nomi viene applicata automaticamente.

La pagina Ordini resta invariata durante la validazione della fonte. Lo storico conserva fornitore, codice e documento necessari al successivo riordino; questa schermata non registra ordini.


## Conferma delle proposte

Nello storico, **Conferma classificazione** salva la proposta per lo stesso ID fornitore, descrizione e codice (maiuscole e spazi normalizzati). Copre gli acquisti attuali e futuri con questa identità; altri fornitori o codici rimangono separati. La tabella locale `acquisti_classificazioni_confermate` conserva scelta, utente e data. DBF e vecchio catalogo non vengono modificati. La conferma prevale sulle proposte nelle letture successive. Il server rilegge la proposta e rifiuta una conferma obsoleta; ricerca e filtri restano attivi durante il salvataggio.


La vista iniziale include soltanto i fornitori classificati nel conto MATERIALI, tramite ID del fornitore. Tutte le loro righe restano ricercabili, anche quelle non classificate. La scelta «Tutti i fornitori» riapre lo storico completo. «Azzera ricerca e filtri» conserva l’ambito scelto.
