# Infrastruttura Bot WhatsApp — Macchina Dedicata

## Perché serve una macchina dedicata

Il bot stack richiede servizi sempre accesi. Girare su un notebook (Acer-Nitro-5) non è adatto alla produzione perché:
- Il notebook va in sleep, si riavvia, si spegne
- Se Evolution API è offline, i messaggi WhatsApp non escono e le risposte non vengono processate
- Il DB PostgreSQL `studiobot` non è raggiungibile da serverdima

**Regola**: finché il bot stack gira su Acer-Nitro-5, il sistema non è affidabile in produzione.

---

## Architettura target

```
[Pazienti WA] ←→ [Evolution API] ←→ [n8n] ←→ [PostgreSQL studiobot]
                                                         ↕
                                              [StudioDimaAI backend]
                                              (serverdima, Flask)
                                                         ↕
                                              [SQLite studio_dima.db]
```

Tutto il bot stack (Evolution, n8n, PostgreSQL, Ollama) gira sulla **macchina dedicata locale**.
`serverdima` punta alla macchina dedicata invece che ad `Acer-Nitro-5`.

Cambio da fare in `.env` su serverdima (usare **IP LAN**, non hostname Windows):
```
BOT_DB_HOST=192.168.1.57
BOT_DB_HOST_FALLBACK=127.0.0.1
EVOLUTION_BASE_URL=https://wa.valorian.it
```
`postgres` in docker-compose dentalai deve esporre `5432:5432` e il firewall del PC bot deve consentire connessioni dalla LAN.

---

## Modello AI

I modelli piccoli (Qwen 3B, 7B) non sono adatti per triage e ragionamento clinico.

**Minimo consigliato: 14B parametri**

| Modello | VRAM/RAM necessaria (Q4) | Qualità |
|---|---|---|
| Qwen3 14B | ~9GB | Ottimo, thinking mode, buon italiano |
| Gemma 3 12B | ~8GB | Eccellente multilingua |
| Phi-4 14B | ~9GB | Reasoning solido |
| Qwen3 30B | ~20GB | Salto qualitativo importante |

Con CPU inference (no GPU): 5-8 token/sec su 14B — lento ma funzionale per WhatsApp.
Con GPU dedicata (RTX 3060 12GB): 40-60 token/sec — esperienza utente accettabile.

---

## Opzione A — Mini PC (plug and play)

**Beelink SER7 / Minisforum UM790 Pro**

| Spec | Valore |
|---|---|
| CPU | AMD Ryzen 7 7735HS / 7940HS |
| RAM | 32GB DDR5 (obbligatorio) |
| SSD | 512GB NVMe |
| GPU | Integrata (CPU inference) |
| Consumi | 15-35W |
| Prezzo | 400-500€ |

**Pro**: nessun assemblaggio, silenzioso, basso consumo, compatto.
**Contro**: CPU inference lenta, non espandibile con GPU dedicata.

Adatto se: le risposte del bot possono aspettare 3-5 secondi.

---

## Opzione B — Micro-ATX assemblato (consigliato)

| Componente | Modello consigliato | Prezzo indicativo |
|---|---|---|
| CPU | AMD Ryzen 5 7600 | ~180€ |
| Motherboard | B650M micro-ATX | ~120€ |
| RAM | 32GB DDR5 4800MHz | ~80€ |
| SSD | 512GB NVMe Gen4 | ~60€ |
| GPU | **RTX 3060 12GB** | ~300€ |
| Case | Fractal Pop Mini / Node 304 | ~70€ |
| PSU | 550W 80+ Bronze | ~60€ |
| **Totale** | | **~870€** |

**Pro**: modello 14B interamente in VRAM (12GB), 40-60 token/sec, espandibile.
**Contro**: assemblaggio richiesto, ingombro maggiore del mini PC.

Adatto se: vuoi risposte fluide e possibilità di aggiornare in futuro.

### Perché RTX 3060 12GB e non RTX 4060?

La RTX 4060 ha solo 8GB VRAM — non basta per caricare un 14B Q4 intero (serve ~9GB).
La RTX 3060 ha 12GB VRAM al costo simile — carica il 14B completamente, nessun offload su RAM.

---

## Confronto economico VPS vs locale

| | VPS 8GB RAM | Macchina locale |
|---|---|---|
| Costo mese | 20-30€ | 0€ (ammortizzata) |
| Costo 2 anni | 480-720€ | 0€ |
| Costo acquisto | 0€ | 500-870€ |
| Dati in casa | No | Si |
| Controllo totale | No | Si |
| GDPR dati clinici | Rischio | Zero rischio |
| Break-even | — | ~24-30 mesi |

Dopo il break-even la macchina locale costa solo l'elettricità (~3-5€/mese).

---

## Software da installare (Docker Compose)

Da installare sulla macchina dedicata:
- **Docker + Docker Compose**
- **Evolution API** (porta 8080) — connessione WhatsApp
- **n8n** (porta 5678) — workflow automation
- **PostgreSQL** (porta 5432) — DB studiobot
- **Ollama** (porta 11434) — inferenza LLM locale
- **Nginx** (opzionale) — reverse proxy con SSL

Il `docker-compose.yml` verrà preparato quando la macchina è pronta.

---

## Checklist acquisto

- [ ] Scegliere opzione A (mini PC) o B (micro-ATX)
- [ ] Verificare disponibilità componenti su Amazon.it / Alternate.it
- [ ] Acquistare macchina
- [ ] Installare Ubuntu Server 24.04 LTS
- [ ] Installare Docker + Docker Compose
- [ ] Eseguire `docker-compose.yml` bot stack
- [ ] Aggiornare `.env` su serverdima con nuovo IP
- [ ] Testare invio WA reminder in produzione
- [ ] Dismettere Acer-Nitro-5 come server bot
