@echo off
setlocal enabledelayedexpansion

:: LOGGING SU FILE
set "LOGFILE=%~dp0deploy_log.txt"
echo ========================================== > "%LOGFILE%"
echo DEPLOY LOG - %date% %time% >> "%LOGFILE%"
echo ========================================== >> "%LOGFILE%"

echo ==========================================
echo    STUDIO DIMA AI V2 - DEPLOYMENT SCRIPT
echo    [Optimized with Robocopy ^& Safety Checks]
echo ==========================================
echo.

:: Configurazione
set "SERVER=\\SERVERDIMA"
set "DEPLOY_PATH=%SERVER%\StudioDimaAI"
set "TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"

echo Server: %DEPLOY_PATH% >> "%LOGFILE%"
echo Timestamp: %TIMESTAMP% >> "%LOGFILE%"

echo ATTENZIONE: Questo script aggiornera' l'installazione in:
echo %DEPLOY_PATH%
echo.
echo NOTA: Verranno preservati i dati sensibili in instance/
echo.
echo Log salvato in: %LOGFILE%
echo.
pause

:: ============================================================================
:: [0/7] BACKUP FILE SENSIBILI
:: ============================================================================
echo [0/7] Backup file sensibili...
echo [0/7] Backup file sensibili... >> "%LOGFILE%"

set "BACKUP_ROOT=%DEPLOY_PATH%\_deploy_backups"
set "BACKUP_DIR=%BACKUP_ROOT%\backup_%TIMESTAMP%"
if not exist "%BACKUP_ROOT%" mkdir "%BACKUP_ROOT%" 2>nul
mkdir "%BACKUP_DIR%" 2>nul

:: File da preservare (con i path corretti dove il codice li cerca)
:: credentials.json -> instance/
:: tokens/token.json -> tokens/
:: NOTA: sync_state.json NON e' critico - il sync engine V2 usa UID/fingerprint da Google Calendar

if exist "%DEPLOY_PATH%\instance\credentials.json" (
    copy "%DEPLOY_PATH%\instance\credentials.json" "%BACKUP_DIR%\credentials.json" /Y >nul 2>&1
    echo   [OK] credentials.json salvato
    echo   [OK] credentials.json salvato >> "%LOGFILE%"
) else (
    echo   [SKIP] credentials.json non presente
    echo   [SKIP] credentials.json non presente >> "%LOGFILE%"
)

if exist "%DEPLOY_PATH%\tokens\token.json" (
    copy "%DEPLOY_PATH%\tokens\token.json" "%BACKUP_DIR%\token.json" /Y >nul 2>&1
    echo   [OK] token.json salvato da tokens/
    echo   [OK] token.json salvato da tokens/ >> "%LOGFILE%"
) else if exist "%DEPLOY_PATH%\instance\token.json" (
    copy "%DEPLOY_PATH%\instance\token.json" "%BACKUP_DIR%\token.json" /Y >nul 2>&1
    echo   [OK] token.json salvato da instance/
    echo   [OK] token.json salvato da instance/ >> "%LOGFILE%"
) else (
    echo   [SKIP] token.json non presente
    echo   [SKIP] token.json non presente >> "%LOGFILE%"
)

echo Backup completato in: %BACKUP_DIR%
echo Backup completato in: %BACKUP_DIR% >> "%LOGFILE%"

:: ============================================================================
:: [1/7] Preparazione cartelle server
:: ============================================================================
echo [1/7] Verifica cartelle server...
echo [1/7] Verifica cartelle server... >> "%LOGFILE%"
if not exist "%DEPLOY_PATH%" mkdir "%DEPLOY_PATH%"
if not exist "%DEPLOY_PATH%\static" mkdir "%DEPLOY_PATH%\static"
if not exist "%DEPLOY_PATH%\instance" mkdir "%DEPLOY_PATH%\instance"
if not exist "%DEPLOY_PATH%\tokens" mkdir "%DEPLOY_PATH%\tokens"
if not exist "%DEPLOY_PATH%\logs" mkdir "%DEPLOY_PATH%\logs"
if not exist "%DEPLOY_PATH%\_deploy_backups" mkdir "%DEPLOY_PATH%\_deploy_backups"

:: ============================================================================
:: [2/7] Sincronizzazione Server V2 (ROBOCOPY)
:: ============================================================================
echo [2/7] Sincronizzazione Server V2...
echo [2/7] Sincronizzazione Server V2... >> "%LOGFILE%"

robocopy "server_v2" "%DEPLOY_PATH%" /MIR ^
    /XD "venv" "__pycache__" ".pytest_cache" ".git" "logs" "legacy_ricetta" "instance" "tokens" "_deploy_backups" ^
    /XF "*.pyc" "*.log" "*.legacy_ricetta" ".env" "sync_state.json" "database_mode.txt" "credentials.json" "token.json" ^
    /R:2 /W:2 /NP >> "%LOGFILE%" 2>&1

set "ROBO_EXIT=%ERRORLEVEL%"
echo Robocopy exit code: %ROBO_EXIT% >> "%LOGFILE%"
if %ROBO_EXIT% geq 8 (
    echo ERRORE CRITICO: Robocopy ha fallito con codice %ROBO_EXIT%
    echo ERRORE CRITICO: Robocopy ha fallito con codice %ROBO_EXIT% >> "%LOGFILE%"
    echo.
    echo Controlla il log: %LOGFILE%
    pause
    exit /b 1
)
echo   [OK] Sync Server V2 completata.
echo   [OK] Sync Server V2 completata. >> "%LOGFILE%"

:: ============================================================================
:: [2.5/7] Verifica e ripristino file sensibili (PROD ha priorita')
:: ============================================================================
echo [2.5/7] Verifica file sensibili post-sync (prod ha priorita')...
echo [2.5/7] Verifica file sensibili post-sync (prod ha priorita')... >> "%LOGFILE%"

:: Crea le directory necessarie
if not exist "%DEPLOY_PATH%\instance" mkdir "%DEPLOY_PATH%\instance"

:: --- credentials.json ---
:: Se esiste ancora su prod (come dovrebbe - instance/ e' esclusa da robocopy), non toccare.
:: Ripristina da backup SOLO se e' sparito.
if exist "%DEPLOY_PATH%\instance\credentials.json" (
    echo   [OK] credentials.json preservato su prod - gia' presente, skip
    echo   [OK] credentials.json preservato su prod - gia' presente, skip >> "%LOGFILE%"
) else if exist "%BACKUP_DIR%\credentials.json" (
    echo   [WARN] credentials.json mancante dopo sync! Ripristino da backup...
    echo   [WARN] credentials.json mancante dopo sync! Ripristino da backup... >> "%LOGFILE%"
    copy "%BACKUP_DIR%\credentials.json" "%DEPLOY_PATH%\instance\credentials.json" /Y >nul 2>&1
    echo   [OK] credentials.json ripristinato da backup
    echo   [OK] credentials.json ripristinato da backup >> "%LOGFILE%"
) else (
    echo   [WARN] credentials.json non presente su prod ne' in backup - configurazione manuale necessaria
    echo   [WARN] credentials.json non presente su prod ne' in backup >> "%LOGFILE%"
)

:: --- token.json ---
:: Percorso standard: instance/token.json (unica fonte di verita')
:: Se esiste su prod, non toccare. Ripristina SOLO se sparito.
:: Gestione migrazione: se backup ha token (preso da tokens/ o instance/), va in instance/
if exist "%DEPLOY_PATH%\instance\token.json" (
    echo   [OK] token.json preservato su prod in instance/ - gia' presente, skip
    echo   [OK] token.json preservato su prod in instance/ - gia' presente, skip >> "%LOGFILE%"
) else if exist "%DEPLOY_PATH%\tokens\token.json" (
    echo   [OK] token.json trovato in tokens/ - copio in instance/ per standardizzare
    echo   [OK] token.json trovato in tokens/ - migrazione a instance/ >> "%LOGFILE%"
    copy "%DEPLOY_PATH%\tokens\token.json" "%DEPLOY_PATH%\instance\token.json" /Y >nul 2>&1
) else if exist "%BACKUP_DIR%\token.json" (
    echo   [WARN] token.json mancante dopo sync! Ripristino da backup...
    echo   [WARN] token.json mancante dopo sync! Ripristino da backup... >> "%LOGFILE%"
    copy "%BACKUP_DIR%\token.json" "%DEPLOY_PATH%\instance\token.json" /Y >nul 2>&1
    echo   [OK] token.json ripristinato da backup in instance/
    echo   [OK] token.json ripristinato da backup in instance/ >> "%LOGFILE%"
) else (
    echo   [WARN] token.json non presente - ri-autenticazione Google necessaria dopo avvio
    echo   [WARN] token.json non presente - ri-autenticazione necessaria >> "%LOGFILE%"
)

echo Verifica file sensibili completata.
echo Verifica file sensibili completata. >> "%LOGFILE%"

:: ============================================================================
:: [2.6/7] Creazione database_mode.txt per PROD
:: ============================================================================
echo [2.6/7] Creazione database_mode.txt per produzione...
echo [2.6/7] Creazione database_mode.txt per produzione... >> "%LOGFILE%"

:: Verifica che la directory instance esista
if not exist "%DEPLOY_PATH%\instance" (
    echo   [WARN] Directory instance non trovata, la creo...
    echo   [WARN] Directory instance non trovata, la creo... >> "%LOGFILE%"
    mkdir "%DEPLOY_PATH%\instance"
)

:: Crea database_mode.txt con "prod"
echo prod > "%DEPLOY_PATH%\instance\database_mode.txt"
echo   [OK] database_mode.txt creato con modalità PROD
echo   [OK] database_mode.txt creato con modalità PROD >> "%LOGFILE%"



:: ============================================================================
:: [3/7] Aggiornamento .env
:: ============================================================================
echo [3/7] Copia file .env...
echo [3/7] Copia file .env... >> "%LOGFILE%"
copy ".env" "%DEPLOY_PATH%" /Y >nul
if errorlevel 1 (
    echo ERRORE: Copia .env fallita.
    echo ERRORE: Copia .env fallita. >> "%LOGFILE%"
    pause
    exit /b 1
)
echo   [OK] .env aggiornato.
echo   [OK] .env aggiornato. >> "%LOGFILE%"

:: ============================================================================
:: [4/7] Build Frontend React V2
:: ============================================================================
echo [4/7] Build frontend React V2...
echo [4/7] Build frontend React V2... >> "%LOGFILE%"

if not exist "client_v2" (
    echo ERRORE: Cartella client_v2 non trovata!
    echo ERRORE: Cartella client_v2 non trovata! >> "%LOGFILE%"
    pause
    exit /b 1
)

cd client_v2

:: Verifica node_modules
if not exist "node_modules" (
    echo   [INFO] Installazione dipendenze npm...
    echo   [INFO] Installazione dipendenze npm... >> "%LOGFILE%"
    call npm install >> "%LOGFILE%" 2>&1
    if errorlevel 1 (
        echo ERRORE: npm install fallito.
        echo ERRORE: npm install fallito. >> "%LOGFILE%"
        cd ..
        pause
        exit /b 1
    )
) else (
    echo   [INFO] node_modules gia' presente, skip install
    echo   [INFO] node_modules gia' presente, skip install >> "%LOGFILE%"
)

echo   [INFO] Esecuzione build...
echo   [INFO] Esecuzione build... >> "%LOGFILE%"
call npm run build >> "%LOGFILE%" 2>&1
if errorlevel 1 (
    echo ERRORE: Build React V2 fallito.
    echo ERRORE: Build React V2 fallito. >> "%LOGFILE%"
    cd ..
    pause
    exit /b 1
)
cd ..
echo   [OK] Build completata.
echo   [OK] Build completata. >> "%LOGFILE%"

:: ============================================================================
:: [5/7] Deploy Frontend (ROBOCOPY)
:: ============================================================================
echo [5/7] Deploy frontend in static...
echo [5/7] Deploy frontend in static... >> "%LOGFILE%"

if not exist "client_v2\dist" (
    echo ERRORE: Cartella dist non trovata! Build fallita?
    echo ERRORE: Cartella dist non trovata! Build fallita? >> "%LOGFILE%"
    pause
    exit /b 1
)

robocopy "client_v2\dist" "%DEPLOY_PATH%\static" /MIR ^
    /R:2 /W:2 /NP >> "%LOGFILE%" 2>&1

set "ROBO_EXIT_FRONTEND=%ERRORLEVEL%"
echo Robocopy frontend exit code: %ROBO_EXIT_FRONTEND% >> "%LOGFILE%"
if %ROBO_EXIT_FRONTEND% geq 8 (
    echo ERRORE: Deploy frontend fallito con codice %ROBO_EXIT_FRONTEND%
    echo ERRORE: Deploy frontend fallito con codice %ROBO_EXIT_FRONTEND% >> "%LOGFILE%"
    pause
    exit /b 1
)
echo   [OK] Frontend deployato.
echo   [OK] Frontend deployato. >> "%LOGFILE%"

:: ============================================================================
:: [6/7] Generazione script avvio
:: ============================================================================
echo [6/7] Generazione start script...
echo [6/7] Generazione start script... >> "%LOGFILE%"
(
echo @echo off
echo cd /d "%%~dp0"
echo.
echo echo ==========================================
echo echo    STUDIO DIMA AI V2 - STARTING SERVER
echo echo ==========================================
echo.
echo set "STUDIODIMAAI_DATA_DIR=%%~dp0instance"
echo set "GOOGLE_CREDENTIALS_PATH=%%~dp0instance\credentials.json"
echo set "GOOGLE_TOKEN_PATH=%%~dp0instance\token.json"
echo set "GOOGLE_OAUTH_STATE_PATH=%%~dp0instance\oauth_state.json"
echo set "CALENDAR_SYNC_STATE_PATH=%%~dp0instance\sync_state.json"
echo set "STUDIO_DIMA_DB_PATH=%%~dp0instance\studio_dima.db"
echo set "GOOGLE_OAUTH_REDIRECT_URI=http://SERVERDIMA:5001/oauth/callback"
echo.
echo if not exist venv ^(
echo     echo Creazione virtual environment...
echo     python -m venv venv
echo ^)
echo.
echo call venv\Scripts\activate.bat
echo.
echo echo Verifica dipendenze...
echo pip install -r requirements.txt --quiet
echo.
echo echo Server in avvio su porta 5001...
echo start "StudioDimaAI V2 Server" cmd /k python run_v2.py --config production --port 5001
) > "%DEPLOY_PATH%\start_server_v2.bat"

if not exist "%DEPLOY_PATH%\start_server_v2.bat" (
    echo   [ERRORE] start_server_v2.bat non creato - problema scrittura sulla share!
    echo   [ERRORE] start_server_v2.bat non creato >> "%LOGFILE%"
) else (
    echo   [OK] start_server_v2.bat creato.
    echo   [OK] start_server_v2.bat creato. >> "%LOGFILE%"
)

:: ============================================================================
:: [7/7] Utility Script
:: ============================================================================
echo [7/7] Generazione utility reset...
echo [7/7] Generazione utility reset... >> "%LOGFILE%"
(
echo @echo off
echo cd /d "%%~dp0"
echo echo RESETTING SYNC STATE...
echo if exist instance\sync_state.json copy instance\sync_state.json instance\sync_state.bak /Y
echo echo {} ^> instance\sync_state.json
echo echo Fatto.
echo pause
) > "%DEPLOY_PATH%\reset_sync_state.bat"

echo   [OK] reset_sync_state.bat creato.
echo   [OK] reset_sync_state.bat creato. >> "%LOGFILE%"

:: ============================================================================
:: COMPLETATO
:: ============================================================================
echo.
echo ========================================
echo DEPLOYMENT COMPLETATO CON SUCCESSO!
echo ========================================
echo.
echo Server: %DEPLOY_PATH%
echo Backup: %BACKUP_DIR%
echo Log: %LOGFILE%
echo.
echo DEPLOYMENT COMPLETATO CON SUCCESSO! >> "%LOGFILE%"
pause