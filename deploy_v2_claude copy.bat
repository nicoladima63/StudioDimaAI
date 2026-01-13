@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo    STUDIO DIMA AI V2 - DEPLOYMENT SCRIPT
echo    [Enhanced with Google Auth Protection]
echo ==========================================
echo.

:: Configurazione
set "SERVER=\\SERVERDIMA"
set "DEPLOY_PATH=%SERVER%\StudioDimaAI"
set "TIMESTAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"

echo ATTENZIONE: Questo script sovrascrivera' l'installazione esistente in:
echo %DEPLOY_PATH%
echo.
echo Verranno preservati:
echo   - instance/token.json (Google OAuth)
echo   - instance/credentials.json (Google Credentials)
echo   - instance/sync_state.json (Stato sincronizzazione)
echo.
pause

:: ============================================================================
:: [0/7] BACKUP FILE SENSIBILI
:: ============================================================================
echo [0/7] Backup file sensibili Google...

set "BACKUP_DIR=%DEPLOY_PATH%\instance\.backup_%TIMESTAMP%"
mkdir "%BACKUP_DIR%" 2>nul

:: Backup token.json
if exist "%DEPLOY_PATH%\instance\token.json" (
    copy "%DEPLOY_PATH%\instance\token.json" "%BACKUP_DIR%\token.json" /Y >nul 2>&1
    if errorlevel 1 (
        echo ATTENZIONE: Impossibile fare backup di token.json
    ) else (
        echo   [OK] token.json salvato
    )
) else (
    echo   [SKIP] token.json non presente
)

:: Backup credentials.json
if exist "%DEPLOY_PATH%\instance\credentials.json" (
    copy "%DEPLOY_PATH%\instance\credentials.json" "%BACKUP_DIR%\credentials.json" /Y >nul 2>&1
    if errorlevel 1 (
        echo ATTENZIONE: Impossibile fare backup di credentials.json
    ) else (
        echo   [OK] credentials.json salvato
    )
) else (
    echo   [SKIP] credentials.json non presente
)

:: Backup sync_state.json
if exist "%DEPLOY_PATH%\instance\sync_state.json" (
    copy "%DEPLOY_PATH%\instance\sync_state.json" "%BACKUP_DIR%\sync_state.json" /Y >nul 2>&1
    if errorlevel 1 (
        echo ATTENZIONE: Impossibile fare backup di sync_state.json
    ) else (
        echo   [OK] sync_state.json salvato
    )
) else (
    echo   [SKIP] sync_state.json non presente
)

:: Backup feature_flags.json
if exist "%DEPLOY_PATH%\instance\feature_flags.json" (
    copy "%DEPLOY_PATH%\instance\feature_flags.json" "%BACKUP_DIR%\feature_flags.json" /Y >nul 2>&1
    if errorlevel 1 (
        echo ATTENZIONE: Impossibile fare backup di feature_flags.json
    ) else (
        echo   [OK] feature_flags.json salvato
    )
) else (
    echo   [SKIP] feature_flags.json non presente
)

echo Backup completato in: %BACKUP_DIR%

:: ============================================================================
:: [1/7] Creazione cartelle sul server
:: ============================================================================
echo [1/7] Creazione cartelle sul server...
mkdir "%DEPLOY_PATH%" 2>nul
mkdir "%DEPLOY_PATH%\static" 2>nul
mkdir "%DEPLOY_PATH%\instance" 2>nul
mkdir "%DEPLOY_PATH%\logs" 2>nul
echo Cartelle create.

:: ============================================================================
:: [2/7] Copia file server V2
:: ============================================================================
echo [2/7] Copia server V2...
echo __pycache__ > exclude_v2.txt
echo *.pyc >> exclude_v2.txt
echo venv >> exclude_v2.txt
echo .pytest_cache >> exclude_v2.txt
echo logs >> exclude_v2.txt
echo *.log >> exclude_v2.txt
echo legacy_ricetta >> exclude_v2.txt
echo *.legacy_ricetta >> exclude_v2.txt
echo instance\token.json >> exclude_v2.txt
echo instance\credentials.json >> exclude_v2.txt
echo instance\sync_state.json >> exclude_v2.txt
echo instance\feature_flags.json >> exclude_v2.txt
echo instance\.backup_* >> exclude_v2.txt

xcopy "server_v2" "%DEPLOY_PATH%" /E /I /Q /Y /EXCLUDE:exclude_v2.txt
if errorlevel 1 (
    echo ERRORE: Copia server_v2 fallita.
    del exclude_v2.txt 2>nul
    pause
    exit /b 1
)
del exclude_v2.txt 2>nul
echo Server V2 copiato.

:: ============================================================================
:: [2.5/7] RIPRISTINO FILE SENSIBILI
:: ============================================================================
echo [2.5/7] Ripristino file sensibili...

:: Ripristina token.json
if exist "%BACKUP_DIR%\token.json" (
    copy "%BACKUP_DIR%\token.json" "%DEPLOY_PATH%\instance\token.json" /Y >nul 2>&1
    if errorlevel 1 (
        echo ERRORE: Impossibile ripristinare token.json!
        echo   Dovrai ri-autenticare Google Calendar!
    ) else (
        echo   [OK] token.json ripristinato
    )
)

:: Ripristina credentials.json
if exist "%BACKUP_DIR%\credentials.json" (
    copy "%BACKUP_DIR%\credentials.json" "%DEPLOY_PATH%\instance\credentials.json" /Y >nul 2>&1
    if errorlevel 1 (
        echo ERRORE: Impossibile ripristinare credentials.json!
    ) else (
        echo   [OK] credentials.json ripristinato
    )
)

:: Ripristina sync_state.json
if exist "%BACKUP_DIR%\sync_state.json" (
    copy "%BACKUP_DIR%\sync_state.json" "%DEPLOY_PATH%\instance\sync_state.json" /Y >nul 2>&1
    if errorlevel 1 (
        echo ATTENZIONE: Impossibile ripristinare sync_state.json
    ) else (
        echo   [OK] sync_state.json ripristinato
    )
)

:: Ripristina feature_flags.json
if exist "%BACKUP_DIR%\feature_flags.json" (
    copy "%BACKUP_DIR%\feature_flags.json" "%DEPLOY_PATH%\instance\feature_flags.json" /Y >nul 2>&1
    if errorlevel 1 (
        echo ATTENZIONE: Impossibile ripristinare feature_flags.json
    ) else (
        echo   [OK] feature_flags.json ripristinato
    )
)

echo Ripristino completato.

:: ============================================================================
:: [3/7] Copia file .env
:: ============================================================================
echo [3/7] Copia file .env...
copy ".env" "%DEPLOY_PATH%" /Y
if errorlevel 1 (
    echo ERRORE: Copia .env fallita.
    pause
    exit /b 1
)
echo File .env copiato.

:: ============================================================================
:: [4/7] Build frontend React V2
:: ============================================================================
echo [4/7] Build frontend React V2...
cd client_v2
if not exist "node_modules" (
    echo Installazione dipendenze npm...
    call npm install
    if errorlevel 1 (
        echo ERRORE: npm install fallito.
        pause
        exit /b 1
    )
)
call npm run build
if errorlevel 1 (
    echo ERRORE: Build React V2 fallito.
    pause
    exit /b 1
)
cd ..
echo Frontend buildato.

:: ============================================================================
:: [5/7] Copia build frontend sul server
:: ============================================================================
echo [5/7] Copia build frontend nella cartella static...
xcopy "client_v2\dist" "%DEPLOY_PATH%\static\" /E /I /Q /Y
echo Frontend copiato.

:: ============================================================================
:: [6/7] Creazione script di avvio con health check
:: ============================================================================
echo [6/7] Creazione script di avvio sul server...
(
echo @echo off
echo cd /d "%DEPLOY_PATH%"
echo.
echo echo ==========================================
echo echo    STUDIO DIMA AI V2 - STARTING SERVER
echo echo ==========================================
echo echo.
echo.
echo :: Creazione/attivazione venv
echo if not exist venv ^(
echo     echo Creazione virtual environment...
echo     python -m venv venv
echo     if errorlevel 1 ^(
echo         echo ERRORE: Impossibile creare venv
echo         pause
echo         exit /b 1
echo     ^)
echo ^)
echo.
echo call venv\Scripts\activate.bat
echo.
echo :: Installazione dipendenze
echo echo Installazione/aggiornamento dipendenze...
echo pip install -r requirements.txt --quiet
echo if errorlevel 1 ^(
echo     echo ERRORE: Installazione dipendenze fallita
echo     pause
echo     exit /b 1
echo ^)
echo.
echo :: Health check Google Calendar
echo echo Verifica connessione Google Calendar...
echo python -c "from services.calendar_service import calendar_service; result = calendar_service.test_google_connection(); print('✅ Google Calendar OK' if result['success'] else '❌ Google Calendar ERROR: ' + result.get('message', 'Unknown'))"
echo.
echo echo.
echo echo Server in avvio su porta 5001...
echo echo Apri http://localhost:5001 nel browser
echo echo.
echo start "StudioDimaAI V2 Server" cmd /k python run_v2.py --config production --port 5001
) > "%DEPLOY_PATH%\start_server_v2.bat"

echo Script di avvio creato.

:: ============================================================================
:: [7/7] Creazione script di pulizia sync state
:: ============================================================================
echo [7/7] Creazione script di utility...
(
echo @echo off
echo cd /d "%DEPLOY_PATH%"
echo call venv\Scripts\activate.bat
echo.
echo echo ==========================================
echo echo    RESET SYNC STATE
echo echo ==========================================
echo echo.
echo echo ATTENZIONE: Questo cancellerà lo stato di sincronizzazione.
echo echo La prossima sync ricreerà tutti gli eventi.
echo echo.
echo pause
echo.
echo :: Backup attuale
echo if exist instance\sync_state.json ^(
echo     copy instance\sync_state.json instance\sync_state.backup.json
echo     echo Backup salvato in: instance\sync_state.backup.json
echo ^)
echo.
echo :: Reset
echo echo ^{^} ^> instance\sync_state.json
echo echo.
echo echo Sync state resettato!
echo pause
) > "%DEPLOY_PATH%\reset_sync_state.bat"

echo Script di utility creati:
echo   - start_server_v2.bat (avvio server con health check)
echo   - reset_sync_state.bat (reset stato sincronizzazione)

:: ============================================================================
:: RIEPILOGO FINALE
:: ============================================================================
echo.
echo ========================================
echo DEPLOYMENT COMPLETATO! 🎉
echo ========================================
echo.
echo File sensibili preservati:
if exist "%DEPLOY_PATH%\instance\token.json" (
    echo   [✓] token.json
) else (
    echo   [X] token.json - MANCANTE! Ri-autentica Google!
)
if exist "%DEPLOY_PATH%\instance\credentials.json" (
    echo   [✓] credentials.json
) else (
    echo   [X] credentials.json - MANCANTE!
)
if exist "%DEPLOY_PATH%\instance\sync_state.json" (
    echo   [✓] sync_state.json
) else (
    echo   [~] sync_state.json - Verra' ricreato
)
echo.
echo Backup salvato in:
echo   %BACKUP_DIR%
echo.
echo Per avviare il server:
echo   1. Vai su %DEPLOY_PATH%
echo   2. Esegui start_server_v2.bat
echo.
echo In caso di problemi di sync:
echo   - Esegui reset_sync_state.bat
echo   - Oppure usa l'interfaccia web (Settings ^> Calendar ^> Fix Sync)
echo.
echo ========================================
pause