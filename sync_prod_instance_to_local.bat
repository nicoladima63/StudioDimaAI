@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

rem Copia i dati persistenti della produzione per i test locali.
rem Non copia credenziali OAuth/token e non mantiene le modalita' prod in locale.

set "PROD_INSTANCE=\\SERVERDIMA\StudioDimaAI\instance"
set "LOCAL_INSTANCE=%~dp0server_v2\instance"
set "BACKUP_ROOT=%~dp0_local_instance_backups"

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
echo Verranno copiati database e configurazioni applicative.
echo Le credenziali OAuth, i token e le modalita' PROD locali saranno preservati/esclusi.
echo Le automazioni reminder saranno disattivate nella copia locale per evitare invii reali.
echo.
choice /C YN /N /M "Procedere"
if errorlevel 2 exit /b 0

if not exist "%PROD_INSTANCE%\" (
    echo.
    echo ERRORE: cartella instance di produzione non raggiungibile.
    echo Verifica la connessione a SERVERDIMA e riprova.
    pause
    exit /b 1
)

if not exist "%LOCAL_INSTANCE%\" mkdir "%LOCAL_INSTANCE%"
if not exist "%BACKUP_ROOT%\" mkdir "%BACKUP_ROOT%"

echo.
echo [1/3] Backup dei dati locali...
robocopy "%LOCAL_INSTANCE%" "%BACKUP_DIR%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:2 /NP /NFL /NDL >nul
set "BACKUP_EXIT=%ERRORLEVEL%"
if %BACKUP_EXIT% geq 8 (
    echo ERRORE: backup locale fallito ^(codice %BACKUP_EXIT%^).
    pause
    exit /b 1
)

echo [2/3] Copia dati da produzione...
rem /E evita cancellazioni locali; /XF esclude identita' e stati macchina/sicurezza.
robocopy "%PROD_INSTANCE%" "%LOCAL_INSTANCE%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:2 /Z /NP ^
    /XF "credentials.json" "token.json" "gmail_token.json" "oauth_state.json" "gmail_oauth_state.json" ^
        "database_mode.txt" "sms_mode.txt" "ricetta_mode.txt" "calendar_mode.txt" >nul
set "SYNC_EXIT=%ERRORLEVEL%"
if %SYNC_EXIT% geq 8 (
    echo ERRORE: copia da produzione fallita ^(codice %SYNC_EXIT%^).
    echo Il backup locale e' disponibile in: %BACKUP_DIR%
    pause
    exit /b 1
)

echo [3/3] Messa in sicurezza della copia locale...
> "%LOCAL_INSTANCE%\database_mode.txt" echo dev
> "%LOCAL_INSTANCE%\sms_mode.txt" echo test
> "%LOCAL_INSTANCE%\ricetta_mode.txt" echo test

rem I reminder vengono disabilitati solo in locale: i dati restano identici a prod.
powershell -NoProfile -Command "$p='%LOCAL_INSTANCE%\automation_settings.json'; if (Test-Path -LiteralPath $p) { $s=ConvertFrom-Json -InputObject (Get-Content -LiteralPath $p -Raw); Add-Member -InputObject $s -NotePropertyName appointment_reminder_24h_enabled -NotePropertyValue $false -Force; Add-Member -InputObject $s -NotePropertyName appointment_reminder_2h_enabled -NotePropertyValue $false -Force; Add-Member -InputObject $s -NotePropertyName appointment_followup_enabled -NotePropertyValue $false -Force; Set-Content -LiteralPath $p -Value (ConvertTo-Json -InputObject $s -Depth 20) -Encoding UTF8 }"
if errorlevel 1 (
    echo ATTENZIONE: impossibile disattivare le automazioni locali.
    echo Non avviare il server locale finche' non hai verificato automation_settings.json.
    pause
    exit /b 1
)

echo.
echo Sincronizzazione completata.
echo Backup locale: %BACKUP_DIR%
echo Nota: per una copia SQLite perfettamente consistente, esegui lo script quando il server prod non sta scrivendo nel database.
pause
