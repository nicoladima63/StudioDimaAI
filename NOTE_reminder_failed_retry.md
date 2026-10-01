# Reminder SMS duplicati "failed" (Risaliti Nicola, 2026-09-30)

## Sintomo
Nella tabella "Reminder per oggi" compaiono molte righe identiche, tipo 2 ore, canale SMS, stato `failed`, per lo stesso paziente e lo stesso appuntamento (11:50). I reminder WA degli altri pazienti compaiono una volta sola.

## Causa
I reminder falliti vengono ritentati a ogni giro dello scheduler e ogni tentativo inserisce una nuova riga `failed`.

File: `server_v2/services/appointment_reminder_service.py`

1. `_already_sent` (riga ~510) esclude di proposito le righe `failed` (`AND stato != 'failed'`, riga ~521). Un reminder fallito non conta come "già inviato".
2. `_log_communication` (riga ~536) aggiunge a `_sent_this_session` solo lo stato `sent`. Un `failed` non viene ricordato in memoria.
3. `server_v2/services/scheduler_service.py` (riga ~454) lancia `run_reminders('2h')` ogni 30 minuti (ore 7-19, minuti 0 e 30). Il follow-up gira anche ogni ora.
4. Ad ogni giro il paziente ripassa il controllo anti-duplicati, l'SMS viene rimandato, fallisce di nuovo e viene inserita un'altra riga `failed` (righe ~755-757 di `run_reminders`).

Le righe WA riuscite finiscono nel controllo anti-duplicati e non vengono ripetute.

## Problema di fondo (non verificato)
L'SMS a Risaliti fallisce sempre. Il ritento infinito e solo il moltiplicatore.

- L'errore (`result['error']`) finisce solo in `stats['errors']` e nel file di log, non nella tabella: la UI non lo mostra.
- Cause probabili: numero non valido, rifiuto del provider (Brevo), credenziali o crediti.
- Per questo paziente `check_whatsapp` restituisce `has_wa = False`: verificare che il fallback SMS non sia rotto solo per il suo numero.

## Da verificare
- Il file di log scritto da `_write_log` per il reminder di oggi, per leggere l'errore SMS.
- Nel DB corretto: `SELECT * FROM patient_communications WHERE patient_name LIKE 'Risaliti%' AND appointment_date='2026-09-30'`.
  - Orari delle righe uguali a :00/:30: la spiegazione regge.
  - Piu righe nello stesso minuto: c'e anche uno scheduler doppio o piu processi.

## Direzione del fix
- Limitare i tentativi (es. max 2-3 righe `failed` per chiave paziente/data/ora/tipo).
- Salvare l'errore nella riga di `patient_communications`.
- Dopo i tentativi falliti, segnalare allo staff (come per `skipped_fisso`) invece di ritentare all'infinito.
