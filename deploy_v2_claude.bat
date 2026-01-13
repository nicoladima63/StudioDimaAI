@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo    STUDIO DIMA AI V2 - DEPLOYMENT SCRIPT
echo    [Optimized with Robocopy & Safety Checks]
echo ==========================================
echo.

:: Configurazione
set "SERVER=\\SERVERDIMA"
set "DEPLOY_PATH=%SERVER%\StudioDimaAI"
set "TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"

echo ATTENZIONE: Questo script aggiornera' l'installazione in:
echo %DEPLOY_PATH%
echo.
echo NOTA: Verranno preservati i dati sensibili in instance/
echo.
pause

:: ============================================================================
:: [0/7] BACKUP FILE SENSIBILI
:: ============================================================================
echo [0/7] Backup file sensibili...

set "BACKUP_DIR=%DEPLOY_PATH%\instance\.backup_%TIMESTAMP%"
mkdir "%BACKUP_DIR%" 2>nul

set "SENSITIVE_FILES=token.json credentials.json sync_state.json feature_flags.json"

for %%F in (%SENSITIVE_FILES%) do (
    if exist "%DEPLOY_PATH%\instance\%%F" (
        copy "%DEPLOY_PATH%\instance\%%F" "%BACKUP_DIR%\%%F" /Y >nul 2>&1
        if !errorlevel! neq 0 (
            echo   [WARN] Impossibile fare backup di %%F
        ) else (
            echo   [OK] %%F salvato
        )
    ) else (
        echo   [SKIP] %%F non presente
    )
)

echo Backup completato in: %BACKUP_DIR%

:: ============================================================================
:: [1/7] Preparazione cartelle server
:: ============================================================================
echo [1/7] Verifica cartelle server...
if not exist "%DEPLOY_PATH%" mkdir "%DEPLOY_PATH%"
if not exist "%DEPLOY_PATH%\static" mkdir "%DEPLOY_PATH%\static"
if not exist "%DEPLOY_PATH%\instance" mkdir "%DEPLOY_PATH%\instance"
if not exist "%DEPLOY_PATH%\logs" mkdir "%DEPLOY_PATH%\logs"

:: ============================================================================
:: [2/7] Sincronizzazione Server V2 (ROBOCOPY)
:: ============================================================================
echo [2/7] Sincronizzazione Server V2...

:: Robocopy Exit Codes:
:: 0 = No files copied
:: 1 = Files copied successfully
:: 2 = Extra files detected (not copied)
:: 4 = Mismatched files detected
:: 8 = Failure
:: >=8 is generally an error for us.

robocopy "server_v2" "%DEPLOY_PATH%" /MIR ^
    /XD "venv" "__pycache__" ".pytest_cache" ".git" "instance" "logs" "legacy_ricetta" ^
    /XF "*.pyc" "*.log" "*.legacy_ricetta" ".env" ^
    /R:2 /W:2 /NP /NJH /NJS

set "ROBO_EXIT=%ERRORLEVEL%"
if %ROBO_EXIT% geq 8 (
    echo ERRORE CRITICO: Robocopy ha fallito con codice %ROBO_EXIT%
    pause
    exit /b 1
)
echo   [OK] Sync Server V2 completata.

:: ============================================================================
:: [2.5/7] Ripristino file sensibili
:: ============================================================================
echo [2.5/7] Ripristino file sensibili...

for %%F in (%SENSITIVE_FILES%) do (
    if exist "%BACKUP_DIR%\%%F" (
        copy "%BACKUP_DIR%\%%F" "%DEPLOY_PATH%\instance\%%F" /Y >nul 2>&1
        if !errorlevel! neq 0 (
            echo   [ERR] Impossibile ripristinare %%F!
        ) else (
            echo   [OK] %%F ripristinato
        )
    )
)

:: ============================================================================
:: [3/7] Aggiornamento .env
:: ============================================================================
echo [3/7] Copia file .env...
copy ".env" "%DEPLOY_PATH%" /Y >nul
if errorlevel 1 (
    echo ERRORE: Copia .env fallita.
    pause
    exit /b 1
)
echo   [OK] .env aggiornato.

:: ============================================================================
:: [4/7] Build Frontend React V2
:: ============================================================================
echo [4/7] Build frontend React V2...
cd client_v2

:: Verifica pulizia node_modules se necessario
if not exist "node_modules" (
    echo   [INFO] Installazione dipendenze (npm ci)...
    call npm ci
)

echo   [INFO] Esecuzione build...
call npm run build
if errorlevel 1 (
    echo ERRORE: Build React V2 fallito.
    cd ..
    pause
    exit /b 1
)
cd ..
echo   [OK] Build completata.

:: ============================================================================
:: [5/7] Deploy Frontend (ROBOCOPY)
:: ============================================================================
echo [5/7] Deploy frontend in static...

robocopy "client_v2\dist" "%DEPLOY_PATH%\static" /MIR ^
    /R:2 /W:2 /NP /NJH /NJS

if %ERRORLEVEL% geq 8 (
    echo ERRORE: Deploy frontend fallito.
    pause
    exit /b 1
)
echo   [OK] Frontend deployato.

:: ============================================================================
:: [6/7] Generazione script avvio
:: ============================================================================
echo [6/7] Generazione start script...
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

:: ============================================================================
:: [7/7] Utility Script
:: ============================================================================
echo [7/7] Generazione utility reset...
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
echo.
pause