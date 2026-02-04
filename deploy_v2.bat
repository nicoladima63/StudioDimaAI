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

set "BACKUP_DIR=%DEPLOY_PATH%\.backup_%TIMESTAMP%"
mkdir "%BACKUP_DIR%" 2>nul

:: File da preservare (con i path corretti dove il codice li cerca)
:: credentials.json -> instance/
:: tokens/google_calendar.json -> tokens/
:: instance/sync_state.json -> instance/

if exist "%DEPLOY_PATH%\instance\credentials.json" (
    copy "%DEPLOY_PATH%\instance\credentials.json" "%BACKUP_DIR%\credentials.json" /Y >nul 2>&1
    if !errorlevel! neq 0 (
        echo   [WARN] Impossibile fare backup di credentials.json
        echo   [WARN] Impossibile fare backup di credentials.json >> "%LOGFILE%"
    ) else (
        echo   [OK] credentials.json salvato
        echo   [OK] credentials.json salvato >> "%LOGFILE%"
    )
) else (
    echo   [SKIP] credentials.json non presente
    echo   [SKIP] credentials.json non presente >> "%LOGFILE%"
)

if exist "%DEPLOY_PATH%\tokens\google_calendar.json" (
    copy "%DEPLOY_PATH%\tokens\google_calendar.json" "%BACKUP_DIR%\google_calendar.json" /Y >nul 2>&1
    if !errorlevel! neq 0 (
        echo   [WARN] Impossibile fare backup di google_calendar.json
        echo   [WARN] Impossibile fare backup di google_calendar.json >> "%LOGFILE%"
    ) else (
        echo   [OK] google_calendar.json salvato
        echo   [OK] google_calendar.json salvato >> "%LOGFILE%"
    )
) else (
    echo   [SKIP] google_calendar.json non presente
    echo   [SKIP] google_calendar.json non presente >> "%LOGFILE%"
)

if exist "%DEPLOY_PATH%\instance\sync_state.json" (
    copy "%DEPLOY_PATH%\instance\sync_state.json" "%BACKUP_DIR%\sync_state.json" /Y >nul 2>&1
    if !errorlevel! neq 0 (
        echo   [WARN] Impossibile fare backup di sync_state.json
        echo   [WARN] Impossibile fare backup di sync_state.json >> "%LOGFILE%"
    ) else (
        echo   [OK] sync_state.json salvato
        echo   [OK] sync_state.json salvato >> "%LOGFILE%"
    )
) else (
    echo   [SKIP] sync_state.json non presente
    echo   [SKIP] sync_state.json non presente >> "%LOGFILE%"
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
if not exist "%DEPLOY_PATH%\logs" mkdir "%DEPLOY_PATH%\logs"

:: ============================================================================
:: [2/7] Sincronizzazione Server V2 (ROBOCOPY)
:: ============================================================================
echo [2/7] Sincronizzazione Server V2...
echo [2/7] Sincronizzazione Server V2... >> "%LOGFILE%"

robocopy "server_v2" "%DEPLOY_PATH%" /MIR ^
    /XD "venv" "__pycache__" ".pytest_cache" ".git" "logs" "legacy_ricetta" ^
    /XF "*.pyc" "*.log" "*.legacy_ricetta" ".env" "sync_state.json" "database_mode.txt" ^
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
:: [2.5/7] Ripristino file sensibili
:: ============================================================================
echo [2.5/7] Ripristino file sensibili...
echo [2.5/7] Ripristino file sensibili... >> "%LOGFILE%"

:: Crea le directory necessarie
if not exist "%DEPLOY_PATH%\tokens" mkdir "%DEPLOY_PATH%\tokens"
if not exist "%DEPLOY_PATH%\instance" mkdir "%DEPLOY_PATH%\instance"

:: Ripristina credentials.json in instance/
if exist "%BACKUP_DIR%\credentials.json" (
    copy "%BACKUP_DIR%\credentials.json" "%DEPLOY_PATH%\instance\credentials.json" /Y >nul 2>&1
    if !errorlevel! neq 0 (
        echo   [ERR] Impossibile ripristinare credentials.json!
        echo   [ERR] Impossibile ripristinare credentials.json! >> "%LOGFILE%"
    ) else (
        echo   [OK] credentials.json ripristinato
        echo   [OK] credentials.json ripristinato >> "%LOGFILE%"
    )
)

:: Ripristina google_calendar.json in tokens/
if exist "%BACKUP_DIR%\google_calendar.json" (
    copy "%BACKUP_DIR%\google_calendar.json" "%DEPLOY_PATH%\tokens\google_calendar.json" /Y >nul 2>&1
    if !errorlevel! neq 0 (
        echo   [ERR] Impossibile ripristinare google_calendar.json!
        echo   [ERR] Impossibile ripristinare google_calendar.json! >> "%LOGFILE%"
    ) else (
        echo   [OK] google_calendar.json ripristinato
        echo   [OK] google_calendar.json ripristinato >> "%LOGFILE%"
    )
)

:: Ripristina sync_state.json in instance/
if exist "%BACKUP_DIR%\sync_state.json" (
    copy "%BACKUP_DIR%\sync_state.json" "%DEPLOY_PATH%\instance\sync_state.json" /Y >nul 2>&1
    if !errorlevel! neq 0 (
        echo   [ERR] Impossibile ripristinare sync_state.json!
        echo   [ERR] Impossibile ripristinare sync_state.json! >> "%LOGFILE%"
    ) else (
        echo   [OK] sync_state.json ripristinato
        echo   [OK] sync_state.json ripristinato >> "%LOGFILE%"
    )
)

echo Ripristino file sensibili completato.
echo Ripristino file sensibili completato. >> "%LOGFILE%"

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
echo :: VENV Check
echo if not exist venv ^(
echo     echo Creazione virtual environment...
echo     python -m venv venv
echo ^)
echo.
echo call venv\Scripts\activate.bat
echo.
echo :: Dependencies Check
echo echo Verifica dipendenze...
echo pip install -r requirements.txt --quiet
echo.
echo :: Health Checks
echo echo Verifica connessioni...
echo python -c "from services.calendar_service import calendar_service; r = calendar_service.test_google_connection(); print(' Google: ' + ('OK' if r['success'] else '! ERR: '+r.get('message','?')))"
echo.
echo echo Server in avvio su porta 5001...
echo start "StudioDimaAI V2 Server" cmd /k python run_v2.py --config production --port 5001
) > "%DEPLOY_PATH%\start_server_v2.bat"

echo   [OK] start_server_v2.bat creato.
echo   [OK] start_server_v2.bat creato. >> "%LOGFILE%"

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