# Analisi Problemi Todo System

## 1. Notifiche Real-time Non Funzionanti
**Problema:** Le notifiche non arrivano e non sono "pressanti".
**Causa:** Errore nel backend durante l'invio della notifica WebSocket.
**Dettaglio:**
Nel file `services/todo_escalation_job.py`, il metodo `_send_reminder_notification` chiama `websocket_service.broadcast_notification` passando il parametro `data`.
Tuttavia, `services/websocket_service.py` definisce `broadcast_notification` aspettandosi `notification_data`, non `data`.
Questo causa un `TypeError` che blocca l'invio della notifica real-time (e potenzialmente interrompe il loop di notifiche per quel todo, anche se il log suggerisce che l'escalation avviene).

**Errore da Terminale:**
```
TypeError: WebSocketService.broadcast_notification() got an unexpected keyword argument 'data'
```

**Soluzione Proposta:**
Modificare la chiamata in `services/todo_escalation_job.py` per usare il nome parametro corretto o passare gli argomenti posizionalmente.

---

## 2. Task Scaduti "Blu" (Attenzione) invece di "Rossi" (Critici)
**Problema:** Un task scaduto da 5 giorni appare con bordo blu e badge "ATTENZIONE", invece che rosso e "CRITICO".
**Analisi:**
*   **Backend:** I log mostrano che il job di escalation *ha funzionato* logico: `Escalated todo 46 from normal to critical (4 days overdue)`.
    *   Il sistema ha calcolato correttamente che 4+ giorni = `critical`.
    *   Ha tentato di aggiornare il DB con `urgency_level='critical'`.
*   **Frontend (`TodoWidget.tsx`):**
    *   Il widget determina il colore e il badge usando `getEffectiveUrgency`.
    *   Se `todo.urgency_level` è 'critical', restituisce 'critical' -> Colore 'danger' (Rosso).
    *   Se il task appare Blu, significa che `getEffectiveUrgency` sta restituendo 'attention' (o 'normal').
    *   Poiché il testo "Scaduto il ... (5 gg fa)" appare, il frontend sa che è scaduto. Ma il "Badge" dice "ATTENZIONE".
    *   Questo accade solo se `todo.urgency_level` ricevuto dal frontend è `null`, `'normal'`, o `'attention'`. Se fosse `'critical'`, vincerebbe su tutto.

**Ipotesi Principale:**
Nonostante il log "Escalated", il valore aggiornato non sta arrivando al frontend. Possibili motivi:
1.  **Persistenza Fallita (Meno probabile):** L'update nel DB non è stato committato correttamente, o è stato sovrascritto da un'altra operazione.
2.  **Mapping API:** L'API `GET /todos/pending` potrebbe non restituire correttamente il campo `urgency_level` aggiornato (magari cache, o query errata).
3.  **Fallback Frontend:** Se l'utente ha fatto "Snooze" in passato, l'urgenza potrebbe essere stata impostata a `lowered`. Tuttavia, il job di escalation dovrebbe sovrascriverla la notte successiva.

**Soluzione Proposta:**
1.  Correggere prima l'errore bloccante delle notifiche (punto 1).
2.  Verificare se, dopo la correzione e un nuovo run del job, lo stato si allinea.
3.  Se persiste, aggiungere log nel frontend per vedere cosa contiene esattamente `todo.urgency_level`.

---

## 3. Mancanza di "Pressione"
Il sistema doveva essere "sempre più pressante". Attualmente:
*   Le email/notifiche non partono (causa punto 1).
*   L'urgenza visiva non scala a Rosso (causa punto 2).

Risolvendo i due punti sopra, il sistema recupererà la funzionalità desiderata.
