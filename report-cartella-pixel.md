Cosa NON ho trovato
Niente file SDK, api.txt, tracciato_record.pdf, swagger, postman, endpoint HTTP di Pixel. Nei manuali in WINDENT/MANUALI/ (sono tutti PDF utente: 01 Introduzione, 02 Manuale d'Uso, ENTI, PLANNING, SMS, ESPORTA AGENDA, FATTURAPA, ecc.) si parla solo di funzionalità interne. L'unica CREDENTIALS.JSON presente è di Google (serve a AGE_SYNC.EXE per spingere l'agenda su Google Calendar — non è l'API di Pixel).
Cosa invece c'è — ed è molto utile
I dati sono in Visual FoxPro DBF, un formato aperto e perfettamente leggibile. L'ho appena verificato: ho aperto WINDENT/DATI/ELENCO.DBF e si legge senza problemi (37 campi, prefissi DB_EL...). Le tabelle principali sono tutte lì in chiaro:
PAZIENTI.DBF (anagrafiche), ELENCO.DBF e FATTURE.DBF (fatturato), ACCONTI.DBF, PLANNING.DBF (agenda), DIARIO.DBF, ONORARIO.DBF, PREVENT.DBF, IMPIANTI.DBF, MATERIA.DBF, STERILIZ.DBF, PRESCRIZ.DBF, ecc.
La prova che Pixel stessa accede così sta nel file WINDENT/PIXELIB/AGENDASYNC/AGE_SYNC.EXE.CONFIG, che contiene letteralmente:
Driver={Microsoft Visual FoxPro Driver};
sourcedb=c:\Windent\DATI;sourcetype=DBF;
Il loro stesso modulo di sincronizzazione con Google Calendar legge i DBF via ODBC — la stessa identica strada è disponibile a te.
Le tue opzioni concrete (in ordine di praticità)

ODBC con il driver Visual FoxPro (gratuito Microsoft) → ti colleghi da Excel, Power BI, Python (pyodbc), .NET, ecc. e fai SELECT come su un database SQL. È il modo "ufficioso ma supportato di fatto" perché lo usano loro.
Lettura diretta DBF con librerie come dbfread (Python), dbf (Python), jdbf (Java), dbf-parser (Node). Niente driver da installare.
Export integrati già pronti in WINDENT/PIXELIB/EXE/: expoxls.exe (Excel), FATTURAPA.EXE (XML FatturaPA), tracciaall.exe (tracciabilità DM/UDI), BACKINGR.EXE (backup). Generano file in formati standard.
Servizi cloud Pixel menzionati nei binari: QEweb.it, quadernoelettronico.it, AnamnesiMedica.it, MediciImmuni.it — sono i loro portali web, non endpoint API pubblici, ma se hai un contratto con loro chiedi se espongono qualcosa lì.

Un avvertimento importante
Se vuoi solo leggere, l'accesso ODBC/DBF è sicuro. Se invece vuoi scrivere nei DBF mentre WINDENT è aperto, rischi di corrompere indici (.CDX) e file memo (.FPT). Per scrivere, conviene quasi sempre passare da Pixel o lavorare a software chiuso con backup recente.