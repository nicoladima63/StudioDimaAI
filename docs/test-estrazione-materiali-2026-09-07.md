# Test estrazione materiali — 7 settembre 2026

## Esito

La lettura delle righe di acquisto dai DBF funziona sul campione completo osservato; il riconoscimento preliminare dei materiali presenta falsi positivi e falsi negativi concreti. Non è ancora una base affidabile per carichi automatici.

Fonte: `\\serverdima\pixel\windent\DATI`, produzione, lettura autorizzata dall'utente. Nessuna scrittura ai DBF, importazione o modifica della modalità. Sono stati eseguiti i metodi reali `_is_material_useful` e `is_dental_material`, isolati tramite AST per evitare inizializzazioni dei servizi. Non è stata eseguita la successiva classificazione contabile su SQLite, né il confronto con gli XML originali: i risultati descrivono i filtri preliminari, non l'elenco finale mostrato dalla UI.

## Risultati misurati

| Controllo | Risultato |
| --- | ---: |
| Fatture in SPESAFOR | 1.695 |
| ID fattura duplicati | 0 |
| Righe attive VOCISPES | 18.546 |
| Righe collegate a una fattura | 18.546 |
| Righe ammesse dal primo filtro | 8.746 |
| Righe ammesse da entrambi i filtri | 7.035 |
| Scartate dal classificatore dopo il primo filtro | 1.711 |
| Ammesse con prezzo negativo | 735 |
| Quantità positiva e prezzo zero, scartate dal primo filtro | 296 |
| Ammesse senza codice articolo | 6.285 |

I conteggi si sovrappongono e non sono una misura di accuratezza: non tutte le righe delle fatture devono essere materiali. Dimensione e data di modifica dei due file sono rimaste invariate durante la lettura; questo controllo non equivale a uno snapshot transazionale.

## Esempi verificabili

| Data / ID fattura | Riga sorgente | Quantità / prezzo sorgente | Esito |
| --- | --- | --- | --- |
| 24/07/2026 — ZZZVQJ | Guanti lattice Top Quality 100 pz s/p tag.S | 20 / 4,50 | Ammessa correttamente dai filtri. La quantità è quella acquistata: 2.000 pezzi solo confermando confezione da 100 |
| 16/07/2026 — ZZZVRB | ASPIRASALIVA AZZURRO MONOART 12,5cm 100pz | 1 / 2,95 | Esclusa: `iva` è una sottostringa di `aspirasaliva` |
| 25/05/2026 — ZZZVUF | Monoart Euronda aspirasaliva monouso EM15 Trasparente (100pz) - Blu | 5 / 2,70 | Stessa esclusione errata |
| 21/06/2019 — ZZZZZD | IMPREGUM PENTA 2 x 360 ML 3M | 1 / 245,90 | Esclusa: `pen` è una sottostringa di `penta` |
| 14/07/2026 — ZZZVRE | RB/WB VB XC corona,rnd4.5,GH2.5,AH7,TAN | 1 / 0 | Scartata per prezzo zero; verificare sull'originale se omaggio/materiale da caricare |
| 24/08/2026 — ZZZVPJ | QUOTA FISSA Quota Fissa Acquedotto | 1 / 12,13 | Ammessa dai due filtri pur essendo una voce di utenza |

## Conseguenze e verifiche successive

- Correggere il riconoscimento per sottostringhe, con regressioni sugli aspirasaliva e PENTA.
- Verificare la selezione per fornitore/classificazione contabile prima di interpretare le righe ammesse come materiali finali.
- Conservare e distinguere omaggi, resi, storni e costi accessori: prezzo zero o negativo non basta per decidere un movimento di magazzino.
- Confrontare fatture originali e DBF per quantità, codici, sconti e unità. Il servizio tratta `DB_VOSCONT` come percentuale: questa semantica non è stata validata dal presente test.
- Non assumere che `DB_VOSOCOD` sia sempre un codice commerciale del fornitore. Mancano inoltre campi espliciti per conversione confezione, lotto e scadenza nello schema VOCISPES osservato.
- Validare un campione di fatture complete prima di dichiarare precisione o completezza dell'estrazione.

## Riproduzione

```powershell
server_v2/venv/Scripts/python.exe server_v2/scripts/audit_estrazione_materiali.py --source '\\serverdima\pixel\windent\DATI' --output logs/audit_estrazione_materiali_prod.json
```

Il JSON locale contiene gli esempi raggruppati e i riferimenti alle fatture. La posizione attiva di una riga è soltanto un riferimento diagnostico, non un ID stabile per importazioni.
