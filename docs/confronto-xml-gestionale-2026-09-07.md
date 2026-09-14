# Confronto di tre XML con il gestionale — 7 settembre 2026

Verifica in sola lettura sui file forniti dall'utente in `C:/Users/NICOLA/Downloads/quadernoelettroniconotificafatturericevute` e su `\\serverdima\pixel\windent\DATI` (SPESAFOR, VOCISPES, FORNITOR). Documenti abbinati per numero, data e anagrafica del fornitore. Nessuna importazione o modifica dei dati.

## Importi: tutte e tre le fatture coincidono

| XML / fornitore | Numero e data | ID gestionale | Imponibile XML = DBF | IVA XML = DBF | Totale XML = DBF |
| --- | --- | --- | ---: | ---: | ---: |
| IT01071920282_u6ydm.xml / UMBRA SPA | 261074147, 31/07/2026 | ZZZVQC | 100,00 | 5,62 | 105,62 |
| IT01645480474_001DD.xml / DELTA TRE | 25, 31/07/2026 | ZZZVPP | 915,59 | 201,43 | 1.117,02 |
| IT12878470157_JQ4xp.xml / FASTWEB | M026753640, 01/08/2026 | ZZZVQB | 35,95 | 7,91 | 43,86 |

Per questi documenti `DB_SPCOSTO` coincide con l'imponibile, **`DB_SPCOIVA` con la sola IVA**, `DB_SPXMLTD` con il totale documento. Il commento del servizio che descrive `DB_SPCOIVA` come «costo con IVA» è dunque fuorviante rispetto al campione verificato.

Nessuno dei tre XML contiene ScontoMaggiorazione; DB_VOSCONT è zero. Questo campione non verifica la semantica degli sconti.

## UMBRA: un materiale e un addebito accessorio

XML: tre DettaglioLinee. Gestionale: sette righe VOCISPES.

| Elemento | XML | Gestionale |
| --- | --- | --- |
| Materiale | RHEIN 130 OT EQUATOR | Descrizione identica, riga tipo `R` |
| Quantità / prezzo / IVA | 1 / 91,00 / 4% | Identici |
| Codice articolo | CodiceTipo SKU, CodiceValore 966300 | Riga separata `SKU 966300`, tipo `C`; DB_VOSOCOD vuoto |
| Unità | NR | Nessun campo dedicato in VOCISPES; non presente nelle sette descrizioni |
| Spese | A3 ADDEB.SPESE TRASP.ORD.INF.MIN., 9,00, IVA 22%, TipoCessionePrestazione AC | Descrizione e valori conservati, DB_VOTIPCE=5 (le altre righe hanno 1); corrispondenza osservata, non mappatura universale validata |
| Quantità delle spese | Assente | 1 |
| Riga ausiliaria | Descrizione e due AltriDatiGestionali | Riga `R` più due righe `D` con RiferimentoTesto; etichette TipoDato non visibili nelle righe |
| DDT | Informazione del documento XML | Riga aggiuntiva tipo `B` |

Il codice articolo non è perso nel gestionale: è trasformato in testo su una riga separata. Il lettore materiali attuale scarta tale riga e cerca il codice in DB_VOSOCOD, quindi restituisce un codice vuoto. I filtri preliminari ammettono sia il materiale sia l'addebito di trasporto: l'abbreviazione `TRASP.` sfugge alle esclusioni.

## DELTA TRE: descrizione spezzata, non eliminata

XML: due DettaglioLinee. Gestionale: quattro righe VOCISPES.

- `Servizio / SUBLOC` diventa `Servizio SUBLOC` su riga tipo `C`; DB_VOSOCOD resta vuoto.
- La prima descrizione occupa una riga `R` e una continuazione **`r` minuscola**. La riga principale termina con `... VIA BUONARROTI 1`, la continuazione contiene `5 AGLIANA`. Il campo DB_VODESCR ha larghezza 75; il lettore materiali non ricompone la continuazione, che ha quantità e prezzo zero.
- Prezzi 878,21 e 37,38, IVA 22%: conservati.
- Quantità assente su entrambe le righe XML, valorizzata a 1 nel DBF.
- DataInizioPeriodo/DataFinePeriodo sono presenti nell'XML; non hanno campi dedicati in VOCISPES e non compaiono nelle quattro descrizioni.
- Sublocazione e arretrati ISTAT superano entrambi i filtri preliminari, pur non essendo materiali. Non è stata eseguita la successiva classificazione contabile su SQLite.

## FASTWEB: importi conservati, periodi non esposti nelle righe DBF

XML: due DettaglioLinee. Gestionale: due righe VOCISPES, entrambe `R`.

- Fastweb NeXXt Business: quantità 1, prezzo 35,95, IVA 22%, descrizione conservata.
- Seconda Linea: quantità 1, prezzo zero, IVA 22%, descrizione conservata. Il gestionale mantiene la riga gratuita; è il filtro materiali a scartarla.
- Periodo 01–31 agosto presente nell'XML, non esposto nelle righe VOCISPES lette.
- La prima riga supera i filtri preliminari del classificatore materiali: il nome commerciale non è sufficiente per riconoscere la telefonia.

## Conclusione operativa

In questo campione la procedura del gestionale conserva correttamente gli importi. Trasforma però la struttura XML in righe di tipo diverso: `R`, `r`, `C`, `D`, `B`. Il nostro estrattore le legge come righe indipendenti e scarta informazioni necessarie a ricostruire articolo e descrizione.

L'XML è quindi utile come sorgente strutturata e riferimento di controllo. Per riutilizzare i DBF occorre ricomporre righe principali, codici e continuazioni, validando l'associazione su più documenti. Non associare indiscriminatamente ogni riga C alla successiva senza verifiche: qui è soltanto il comportamento osservato.

Per il magazzino servono inoltre separazione dei costi accessori e riconoscimento della natura dell'acquisto. Questo campione comprende **un solo materiale**, senza conversioni di confezione, sconti o lotti: non prova ancora l'affidabilità generale per gli acquisti odontoiatrici.

Le informazioni non presenti in VOCISPES potrebbero essere conservate altrove dal gestionale, inclusi gli allegati XML. Non è stata verificata la loro assenza nell'intero sistema.
