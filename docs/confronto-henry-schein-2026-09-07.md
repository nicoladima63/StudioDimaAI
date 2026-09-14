# Verifica Henry Schein — fattura 4109602789 del 14/01/2026

Confronto del 7 settembre 2026 tra le due pagine di `\\SERVERDIMA\StudioDimaAi\fattura henry schein.pdf` e i DBF di produzione SPESAFOR/VOCISPES, ID fattura `ZZZW6C`. Sola lettura, nessuna modifica al servizio o ai dati.

## Risultato economico

Tutti i 13 imponibili di riga della stampa coincidono con `quantità × (prezzo unitario − sconto unitario)` sui DBF. Verifica numerica con Decimal e assert su ogni riga, conteggio righe e totali.

**In questa fattura DB_VOSCONT è uno sconto monetario unitario, non una percentuale.** Il servizio materiali usa invece `quantita * prezzo_unitario * (1 - sconto / 100)`: applicata alle stesse 13 righe, questa formula produce 406,663434 € invece di 371,90 €, una differenza di circa 34,76 €. È un confronto a parità di righe, non il totale effettivo della pipeline, che scarta ulteriori righe.

| Codice fornitore | Articolo abbreviato | Q.tà acquisto | Prezzo u. € | Sconto u. € | Imponibile € |
| --- | --- | ---: | ---: | ---: | ---: |
| 0943294 | Salviette 500 pz | 1 | 25,49 | 10,20 | 15,29 |
| 1121703 | Pellicola Insight 150 pz | 1 | 106,09 | 31,83 | 74,26 |
| 0919091 | Sutura Ethibond 12 pz | 1 | 124,49 | 37,35 | 87,14 |
| 0132898 | Pasta iodoformica 15 g | 1 | 59,39 | 17,82 | 41,57 |
| 0129560 | Aghi 100 pz | 2 | 15,29 | 7,645 | 15,29 |
| 1250094 | Reciproc gutta 60 pz | 1 | 24,89 | 7,47 | 17,42 |
| 1239841 | Punte carta 200 pz | 1 | 10,79 | 3,24 | 7,55 |
| 0849376 | Acclean 250 g | 1 | 26,99 | 8,10 | 18,89 |
| 0941677 | Aspirasaliva 100 pz | 5 | 4,09 | 1,228 | 14,31 |
| 0932021 | Bicchieri 30 × 100 pz | 1 | 106,99 | 32,10 | 74,89 |
| 0346815 | Cunei 100 pz | 1 | 0 | 0 | 0 |
| 000000000000080097 | Spese bancarie | 1 | 2,70 | 0 | 2,70 |
| 000000000000080097 | Vendita e imballaggio | 1 | 2,59 | 0 | 2,59 |

Per i cunei il PDF lascia vuote le colonne costo/sconto/imponibile e mostra imposta 0,00; il DBF contiene valori zero. Non è una prova della specifica causale fiscale di omaggio.

Quadratura:

- Base IVA 22%: 354,48 €, imposta arrotondata per aliquota 77,99 €.
- Base IVA 4%: 17,42 €, imposta 0,70 €.
- Totale imponibile 371,90 €, IVA 78,69 €, documento 450,59 €: coincidono con PDF e testata DBF.
- Materiali: 366,61 € imponibili; costi accessori: 5,29 €. Eventuale ripartizione dei costi accessori da definire separatamente.

## Struttura e quantità

Le 53 righe DBF sono 13 principali `R`, 13 codici `C`, 26 informazioni aggiuntive `D`, un riferimento DDT `B`. Tutti i codici sono leggibili come `COD_FORNITORE ...` e DB_VOSOCOD è vuoto. Conservare gli zeri iniziali. Lo stesso codice appare sulle due spese: il codice fornitore da solo non identifica univocamente una riga fattura.

Le descrizioni consentono proposte di conversione: aghi 2 × 100 = 200 pezzi; aspirasaliva 5 × 100 = 500; bicchieri 1 × 30 × 100 = 3.000; cunei 1 × 100 = 100 a prezzo zero. Queste sono conversioni dedotte dalle confezioni descritte, da confermare prima del carico. Per pasta e polvere l'unità base può essere il grammo. Misure come 31 × 41 mm della pellicola sono dimensioni, non moltiplicatori della quantità.

L'estrattore attuale perde i codici sulle righe C, scarta gli aspirasaliva per la sottostringa `iva` e scarta i cunei per prezzo zero. Le righe D ripetute non vanno interpretate come lotti senza ulteriori evidenze.

## Limiti e passo successivo

Il PDF dichiara di essere una stampa interpretativa della fattura elettronica e riproduce la struttura del gestionale. La prima verifica riguardava PDF/DBF; il successivo confronto XML è documentato sotto.

Prima dell'uso per il magazzino: ricomporre codici e righe, correggere i filtri, gestire articoli gratuiti, e verificare la semantica dello sconto anche su fatture di altri fornitori. Non generalizzare automaticamente la formula osservata a documenti con resi o altre modalità di sconto.

## Successiva verifica di govfepix.xml e GOVFEPIX.XSL

L'utente ha fornito `\\SERVERDIMA\StudioDimaAi\govfepix.xml`: contiene effettivamente la fattura Henry Schein 4109602789 del 14/01/2026, totale 450,59 €. `GOVFEPIX.XSL` è il foglio di presentazione: nella sezione sconti visualizza separatamente Percentuale e Importo con xsl:value-of. Non è il codice di importazione nei DBF.

Confronto numerico con Decimal e assert: **13/13 righe coincidenti per descrizione, codice fornitore, quantità, prezzo unitario prima dello sconto, aliquota IVA e totale netto ricostruito dal DBF**. I codici XML corrispondono alle righe C, nell'ordine osservato; non sono stati trattati come chiavi univoche delle righe.

La trasformazione dello sconto è ora verificata:

| Articolo | Percentuale nell'XML | Sconto monetario unitario nel DBF/PDF | Totale netto XML |
| --- | ---: | ---: | ---: |
| Salviette | 40,02% | 10,20 € | 15,29 € |
| Aghi, quantità 2 | 50% | 7,645 € | 15,29 € |
| Aspirasaliva, quantità 5 | 30,02% | 1,228 € | 14,31 € |

Su tutte le righe `DB_VOSCONT = PrezzoUnitario XML − PrezzoTotale XML / Quantita`. È l'equivalenza osservata nei dati, non una prova dell'algoritmo interno del gestionale. Anche l'applicazione della percentuale XML e l'arrotondamento del totale di riga ai centesimi riproducono tutti i PrezzoTotale. Non arrotondare lo sconto unitario a due decimali prima della moltiplicazione: aghi e aspirasaliva richiedono qui tre decimali.

Tutte le unità XML sono `PZ`, anche pasta da 15 g, confezioni da 100 e bicchieri 30 × 100. **PZ identifica qui l'unità commerciale fatturata e non basta per determinare l'unità di consumo.** La conversione resta legata alla descrizione e alla conferma del confezionamento.

L'articolo cunei è presente anche nell'XML con quantità 1 e prezzo/totale zero. I riferimenti ripetuti delle righe D sono identificati nell'XML come `ODA CLI` e `ORDINE`, quindi non vanno usati come lotti del materiale.

La sede del fornitore nell'XML è a Rozzano, mentre la stampa riporta Buccinasco: differenza anagrafica osservata, distinta dalla coerenza delle righe economiche. La provenienza del dato stampato non è stata verificata.

Conclusione: il campione completo XML → DBF → PDF conferma i valori economici e documenta le trasformazioni di struttura. L'errore di interpretazione dello sconto è nel nostro servizio materiali, che riutilizza come percentuale un valore DBF monetario.
