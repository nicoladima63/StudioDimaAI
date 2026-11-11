@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

rem Copia i dati persistenti della produzione per i test locali.
rem Non copia credenziali OAuth/token e non mantiene le modalita' prod in locale.
rem Va lanciato con il server locale SPENTO: il database SQLite e' in modalita' WAL.

set "PROD_INSTANCE=\\SERVERDIMA\StudioDimaAI\instance"
set "LOCAL_INSTANCE=%~dp0server_v2\instance"
set "BACKUP_ROOT=%~dp0_local_instance_backups"
set "LOCAL_PYTHON=%~dp0server_v2\venv\Scripts\python.exe"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TIMESTAMP=%%I"
set "BACKUP_DIR=%BACKUP_ROOT%\before_prod_sync_%TIMESTAMP%"

echo.
echo ================================================
echo  SINCRONIZZAZIONE DATI PROD -^> LOCALE
echo ================================================
echo Origine:      %PROD_INSTANCE%
echo Destinazione: %LOCAL_INSTANCE%
echo Backup:       %BACKUP_DIR%
echo.

rem --- Controllo server locale: processo run_v2 attivo oppure database bloccato ---
powershell -NoProfile -Command "if (Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'python*' -and $_.CommandLine -match 'run_v2' }) { exit 1 } else { exit 0 }"
set "SERVER_PROC=%ERRORLEVEL%"
powershell -NoProfile -Command "$f='%LOCAL_INSTANCE%\studio_dima.db'; if (Test-Path -LiteralPath $f) { try { $s=[IO.File]::Open($f,'Open','ReadWrite','None'); $s.Close(); exit 0 } catch { exit 1 } }"
set "DB_LOCKED=%ERRORLEVEL%"
if not "%SERVER_PROC%"=="0" goto :server_running
if not "%DB_LOCKED%"=="0" goto :server_running
goto :server_stopped

:server_running
echo ATTENZIONE: il server locale risulta avviato ^(o il database e' in uso^).
echo Chiudi il server e rilancia questo script. Nessun file e' stato modificato.
echo.
pause
exit /b 1

:server_stopped
if not exist "%PROD_INSTANCE%\" (
    echo.
    echo ERRORE: cartella instance di produzione non raggiungibile.
    echo Verifica la connessione a SERVERDIMA e riprova.
    pause
    exit /b 1
)

if not exist "%LOCAL_INSTANCE%\" mkdir "%LOCAL_INSTANCE%"
if not exist "%BACKUP_ROOT%\" mkdir "%BACKUP_ROOT%"

echo [1/5] Backup dei dati locali...
robocopy "%LOCAL_INSTANCE%" "%BACKUP_DIR%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:2 /NP /NFL /NDL >nul
set "BACKUP_EXIT=%ERRORLEVEL%"
if %BACKUP_EXIT% geq 8 (
    echo ERRORE: backup locale fallito ^(codice %BACKUP_EXIT%^).
    pause
    exit /b 1
)

echo [2/5] Pulizia file WAL locali...
rem Un -wal locale vecchio accanto al nuovo .db di produzione lo corromperebbe.
del /q "%LOCAL_INSTANCE%\*.db-wal" "%LOCAL_INSTANCE%\*.db-shm" >nul 2>&1

echo [3/5] Copia dati da produzione...
rem /E evita cancellazioni locali; /XF esclude identita', stati macchina/sicurezza e i -shm (si ricreano).
robocopy "%PROD_INSTANCE%" "%LOCAL_INSTANCE%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:2 /Z /NP ^
    /XF "credentials.json" "gmail_credential.json" "token.json" "gmail_token.json" "oauth_state.json" "gmail_oauth_state.json" ^
        "database_mode.txt" "sms_mode.txt" "ricetta_mode.txt" "calendar_mode.txt" ^
        "restart.flag" "last_restart_reason.txt" "disable_automations" "*.db-shm" >nul
set "SYNC_EXIT=%ERRORLEVEL%"
if %SYNC_EXIT% geq 8 (
    echo ERRORE: copia da produzione fallita ^(codice %SYNC_EXIT%^).
    echo Il backup locale e' disponibile in: %BACKUP_DIR%
    pause
    exit /b 1
)

echo [4/5] Verifica integrita' del database copiato...
if exist "%LOCAL_PYTHON%" (
    "%LOCAL_PYTHON%" -c "import sqlite3,sys; c=sqlite3.connect(r'%LOCAL_INSTANCE%\studio_dima.db'); c.execute('pragma wal_checkpoint(TRUNCATE)'); r=c.execute('pragma integrity_check').fetchone()[0]; print('integrity_check:', r); sys.exit(0 if r=='ok' else 1)"
    if errorlevel 1 (
        echo ERRORE: il database copiato non e' integro. Ripeti la copia con produzione ferma.
        echo Il backup locale e' disponibile in: %BACKUP_DIR%
        pause
        exit /b 1
    )
) else (
    echo ATTENZIONE: python del venv non trovato, verifica integrita' saltata.
)

echo [5/5] Messa in sicurezza della copia locale...
> "%LOCAL_INSTANCE%\database_mode.txt" echo dev
> "%LOCAL_INSTANCE%\sms_mode.txt" echo test
> "%LOCAL_INSTANCE%\ricetta_mode.txt" echo test

rem Flag che blocca ogni invio in uscita e l'avvio dello scheduler (vedi core/dev_guard.py).
type nul > "%LOCAL_INSTANCE%\disable_automations"

rem Disattiva anche i reminder nel json. Scrittura senza BOM: Python legge il file in UTF-8 puro.
powershell -NoProfile -Command "$p='%LOCAL_INSTANCE%\automation_settings.json'; if (Test-Path -LiteralPath $p) { $s=ConvertFrom-Json -InputObject (Get-Content -LiteralPath $p -Raw -Encoding UTF8); foreach ($k in 'appointment_reminder_24h_enabled','appointment_reminder_2h_enabled','appointment_reminder_recovery_enabled','appointment_followup_enabled') { Add-Member -InputObject $s -NotePropertyName $k -NotePropertyValue $false -Force }; [IO.File]::WriteAllText($p, (ConvertTo-Json -InputObject $s -Depth 20), (New-Object Text.UTF8Encoding $false)) }"
if errorlevel 1 (
    echo ATTENZIONE: impossibile disattivare le automazioni nel json.
    echo Il flag disable_automations e' comunque attivo, ma verifica automation_settings.json prima di avviare il server.
    pause
    exit /b 1
)

echo.
echo Sincronizzazione completata.
echo Backup locale: %BACKUP_DIR%
echo Modalita' locali impostate a: database=dev, sms=test, ricetta=test.
echo Nota: la copia e' coerente solo se produzione non scriveva durante la copia.
pause
