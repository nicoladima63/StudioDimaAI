# Configurazione Auto-Start Server StudioDimaAI

Questo documento spiega come configurare il server per avviarsi **automaticamente** al riavvio del PC.

## Metodo 1: Task Scheduler (Consigliato)

### Paso 1: Abilitare PowerShell per script non firmati

Apri PowerShell come **Amministratore** e esegui:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Rispondi `Y` quando chiede conferma.

### Paso 2: Creare una Scheduled Task

1. Apri **Task Scheduler** (Cerca "Task Scheduler" nel menu Start)
2. Nel pannello sinistro, clicca **"Create Basic Task..."**
3. Compila i dettagli:
   - **Name:** `StudioDimaAI Server Auto-Start`
   - **Description:** `Avvia automaticamente il server Flask al boot`
   - **Clicca "Next"**

4. **Trigger:**
   - Seleziona **"At startup"**
   - Clicca **"Next"**

5. **Action:**
   - Seleziona **"Start a program"**
   - **Program/script:** `powershell.exe`
   - **Add arguments:** `-NoProfile -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File C:\Users\NICOLA\Desktop\StudioDimaAI\start_server.ps1`
   - Clicca **"Next"**

6. **Summary:**
   - Rivedi i dettagli
   - ✅ Spunta **"Open the Properties dialog for this task when I click Finish"**
   - Clicca **"Finish"**

7. **Proprietà avanzate:**
   - Vai al tab **"General"**
   - ✅ Spunta **"Run whether user is logged in or not"**
   - ✅ Spunta **"Run with highest privileges"**
   - Vai al tab **"Conditions"**
   - ⬜ Deseleziona **"Start the task only if the computer is on AC power"** (importante per i riavvii dopo blackout)
   - Clicca **"OK"**

### Paso 3: Test

Riavvia il PC e verifica che:
- Il server si avvia automaticamente
- I log vengono scritti in `log-server-autostart.txt`

---

## Metodo 2: Batch Script (Alternativo)

Se preferisci usare il file `.bat`:

1. Clicca con tasto destro su `start_server.bat`
2. **"Create shortcut"**
3. Copia il collegamento in: `C:\Users\NICOLA\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

⚠️ **Svantaggio:** La finestra del server rimane visibile durante il boot.

---

## Monitoring

### Log file
- **Percorso:** `C:\Users\NICOLA\Desktop\StudioDimaAI\log-server-autostart.txt`
- **Monitoraggio:** 
  ```powershell
  Get-Content -Path "C:\Users\NICOLA\Desktop\StudioDimaAI\log-server-autostart.txt" -Tail 20 -Wait
  ```

### Verificare Task Scheduler
```powershell
Get-ScheduledTask -TaskName "StudioDimaAI Server Auto-Start"
```

### Disabilitare temporaneamente
```powershell
Disable-ScheduledTask -TaskName "StudioDimaAI Server Auto-Start"
```

### Abilitare di nuovo
```powershell
Enable-ScheduledTask -TaskName "StudioDimaAI Server Auto-Start"
```

---

## Troubleshooting

### Il server non si avvia
1. Controlla `log-server-autostart.txt` per errori
2. Verifica che Python sia installato: `python --version`
3. Controlla i permessi di `start_server.ps1`

### La finestra PowerShell appare
- Se usi `-WindowStyle Hidden` dovrebbe essere invisibile
- Assicurati di usare `"Run whether user is logged in or not"`

### Il server si ferma dopo poco
- Guarda `log-server-prod` nella root del progetto
- Potrebbe essere un errore di connessione o configurazione

---

## Disinstallare Auto-Start

```powershell
Unregister-ScheduledTask -TaskName "StudioDimaAI Server Auto-Start" -Confirm:$false
```

---

**Nota:** Se il PC riavvia frequentemente (blackout/UPS), il server ripartirà automaticamente ogni volta.
