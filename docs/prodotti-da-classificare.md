# Revisione delle voci dalle fatture email

Disponibile da Materiali e dal menu Gestione, percorso `/materiali/da-classificare`.

## Uso

1. Premere **Aggiorna dalle fatture email**. Non occorre scegliere file o distinguere prima le fatture per categoria.
2. La vista **Da controllare** mostra materiali e altre voci, raggruppando gli acquisti ripetuti. Le proposte incomplete vengono prima.
3. Controllare categoria, origine del suggerimento e destinazione (**Materiale**, **Altra voce**, **Da decidere**).
4. Usare **Correggi** sulla riga, oppure selezionare più righe, impostare destinazione e/o categoria e premere **Salva correzioni**. Cambiare soltanto la destinazione conserva le categorie individuali.
5. Premere **Conferma tutto**, che mostra il numero di materiali e altre voci e riguarda le proposte complete visibili con i filtri attuali. È disponibile anche la conferma delle sole selezionate.

La conferma inserisce soltanto i materiali nuovi. Le altre voci confermate rimangono consultabili tra le elaborate e non vengono inserite in materiali. Nessuna modifica alla contabilità delle fatture, nessun movimento di magazzino o ordine viene generato. Incomplete e ambigue rimangono da risolvere. Le altre voci possono essere riaperte con Correggi; i materiali già presenti si modificano nella pagina Materiali.

## Fonti e suggerimenti

La cartella predefinita è `logs/fatture_xml_email` nella radice del progetto, risolta indipendentemente dalla directory di avvio del server. È configurabile con `FATTURE_XML_EMAIL_DIR`. La scansione comprende le sottocartelle e gli XML con estensione maiuscola; i collegamenti esterni alla cartella sono ignorati. I file riusciti sono registrati con hash, quelli non validi sono segnalati e ritentati al prossimo aggiornamento. Limite di 5 MB per XML.

Il fornitore viene abbinato per partita IVA al DBF dell'ambiente configurato. Le categorie derivano dallo stesso prodotto, dalla descrizione nello storico, da prodotti simili dello stesso fornitore senza classificazioni concorrenti vicine, oppure dal fornitore. Una somiglianza è sempre un suggerimento da verificare. La natura della riga e il conto proposto determinano la destinazione suggerita, modificabile dall'utente.

Le correzioni sono persistenti. Le conferme conservano l'identità del prodotto per evitare nuovi duplicati; le altre voci già confermate non tornano da controllare per ogni nuova fattura dello stesso oggetto.

## Persistenza e limiti

SQLite: `materiali_xml_righe` conserva i dati estratti, `materiali_xml_prodotti` gli abbinamenti e le vecchie esclusioni, `materiali_xml_file` le impronte dei file acquisiti, `materiali_xml_revisioni` le correzioni e le decisioni confermate. Le tabelle vengono create senza alterare quelle esistenti.

Le conferme sono transazionali e ricontrollano le proposte mostrate: se una voce cambia dopo la lettura, rimane da rivedere. Non vengono sovrascritte le classificazioni dei materiali esistenti. Massimo 5000 voci per conferma; usare i filtri per restringere gruppi più grandi.

Gli XML con più corpi FatturaPA rimangono non supportati e sono segnalati. Una fattura ricaricata con dati diversi su righe già presenti non sostituisce la precedente. Gli XML originali rimangono nella cartella; il database conserva i campi estratti. Il pulsante legge file già scaricati: non avvia lo scaricamento delle email.

## Verifica del 8 settembre 2026

Prova sui 367 XML della cartella, con copia del database locale in memoria e lettura dell'anagrafica configurata in produzione: 2315 nuove righe, nessun errore XML, 744 voci raggruppate, 121 riconosciute nei materiali, 300 proposte complete. Tempo osservato circa 3,2 secondi. Le cifre descrivono completezza e riconoscimento, non una validazione manuale dell'accuratezza delle categorie. Nessuna conferma o scrittura al database reale durante la prova.

Test: `server_v2/venv/Scripts/python.exe -m pytest tests/test_materiali_inbox_service.py tests/test_acquisti_storico_extractor.py tests/test_ordini_service.py -q`.

Da client_v2: `npx vitest run src/features/materiali/pages/ProdottiDaClassificarePage.test.tsx src/features/materiali/pages/OrdiniPage.test.tsx` e `npm run build`.
