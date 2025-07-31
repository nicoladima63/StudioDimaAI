@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    STUDIO DIMA AI - DEPLOYMENT SCRIPT
echo ========================================
echo.

:: Configurazione
set "SERVER=\\SERVERDIMA"
set "DEPLOY_PATH=%SERVER%\StudioDimaAI"

:: [1/8] Verifica connessione server
echo [1/8] Verifica connessione server SERVERDIMA...
ping -n 1 192.168.1.200 >nul 2>&1
if errorlevel 1 (
    echo ERRORE: Server SERVERDIMA non raggiungibile
    echo Verifica che il server sia acceso e connesso alla rete
    pause
    exit /b 1
)
echo Server raggiungibile

:: [2/8] Pulizia contenuto cartella destinazione
echo.
echo [2/8] Pulizia contenuto cartella destinazione...
if exist "%DEPLOY_PATH%" (
    echo Cancellazione contenuto cartella esistente...
    del /s /q "%DEPLOY_PATH%\*.*" >nul 2>&1
    for /d %%i in ("%DEPLOY_PATH%\*") do rmdir /s /q "%%i" >nul 2>&1
    echo Contenuto cartella pulito
) else (
    echo Prima installazione, nessuna pulizia necessaria
)

:: [3/8] Build client React
echo.
echo [3/8] Build frontend React...
cd client
if not exist "node_modules" (
    echo Installazione dipendenze npm...
    call npm install
    if errorlevel 1 (
        echo ERRORE: npm install fallito
        pause
        exit /b 1
    )
)

echo Build produzione...
call npm run build
if errorlevel 1 (
    echo ERRORE: Build React fallito
    pause
    exit /b 1
)
echo Frontend buildato
cd ..

:: [4/8] Crea struttura cartelle
echo.
echo [4/8] Creazione struttura cartelle sul server...
mkdir "%DEPLOY_PATH%" 2>nul
mkdir "%DEPLOY_PATH%\server" 2>nul
mkdir "%DEPLOY_PATH%\server\static" 2>nul
mkdir "%DEPLOY_PATH%\server\instance" 2>nul
echo Cartelle create

:: [5/8] Copia file server (solo necessari)
echo.
echo [5/8] Copia file server (solo necessari)...

:: Crea file esclusioni per evitare cache e temp
echo __pycache__ > exclude.txt
echo *.pyc >> exclude.txt
echo *.pyo >> exclude.txt
echo *.log >> exclude.txt
echo venv >> exclude.txt
echo node_modules >> exclude.txt
echo .pytest_cache >> exclude.txt
echo *.tmp >> exclude.txt
echo windent >> exclude.txt
echo test >> exclude.txt
echo tests >> exclude.txt

:: Copia solo file necessari (no venv, no cache, no temp)
echo Copia file Python applicazione...
xcopy "server" "%DEPLOY_PATH%\server" /E /I /Q /Y /EXCLUDE:exclude.txt >nul 2>&1
if errorlevel 1 (
    echo ERRORE: Copia file server fallita
    del exclude.txt 2>nul
    pause
    exit /b 1
)

:: Pulizia file temporaneo
del exclude.txt 2>nul

:: Copia cartella instance (database e configurazioni)
echo Copia cartella instance (database)...
if exist "instance" (
    xcopy "instance" "%DEPLOY_PATH%\instance" /E /I /Q /Y >nul 2>&1
    echo Instance copiata
) else (
    echo WARNING: cartella instance non trovata
)

echo File server copiati (no cache/venv/temp)

:: Crea requirements unificato
echo Creazione requirements.txt unificato per produzione...
echo # Requirements unificato per produzione > "%DEPLOY_PATH%\requirements.txt"
type "requirements.txt" >> "%DEPLOY_PATH%\requirements.txt"
echo. >> "%DEPLOY_PATH%\requirements.txt"
echo # Dipendenze produzione >> "%DEPLOY_PATH%\requirements.txt"
type "server\requirements-prod.txt" >> "%DEPLOY_PATH%\requirements.txt"
echo Requirements unificato creato

:: Copia build React
echo.
echo [6/8] Copia build frontend...
xcopy "client\dist" "%DEPLOY_PATH%\server\static" /E /I /Q /Y >nul 2>&1
if errorlevel 1 (
    echo ERRORE: Copia frontend fallita
    pause
    exit /b 1
)
echo Frontend copiato

:: [6.5/8] Copia certificati digitali
echo.
echo [6.5/8] Copia certificati digitali...
if exist "certs" (
    xcopy "certs" "%DEPLOY_PATH%\certs" /E /I /Q /Y >nul 2>&1
    if errorlevel 1 (
        echo WARNING: Copia certificati fallita
    ) else (
        echo Certificati digitali copiati
    )
) else (
    echo WARNING: Cartella certs non trovata
)

:: Copia credenziali Google Calendar
echo Copia credenziali Google Calendar...
if exist "server\credentials.json" (
    copy "server\credentials.json" "%DEPLOY_PATH%\server\credentials.json" >nul
    echo credentials.json copiato
) else (
    echo WARNING: credentials.json non trovato
)
if exist "server\token.json" (
    copy "server\token.json" "%DEPLOY_PATH%\server\token.json" >nul
    echo token.json copiato
) else (
    echo WARNING: token.json non trovato
)

:: [7/8] Configurazione finale
echo.
echo [7/8] Configurazione produzione...

:: Imposta modalità DB
echo prod > "%DEPLOY_PATH%\server\instance\database_mode.txt"

:: Copia .env produzione
echo Copia file .env...
if exist ".env" (
    copy ".env" "%DEPLOY_PATH%\.env" >nul
    echo File .env copiato nella destinazione
) else (
    echo ERRORE: File .env non trovato nella root del progetto
    pause
    exit /b 1
)

echo.
echo ========================================
echo    DEPLOYMENT COMPLETATO! 🎉
echo ========================================
echo.
echo Files copiati in: %DEPLOY_PATH%
echo.
echo PROSSIMI STEP MANUALI SUL SERVER:
echo 1. Vai su SERVERDIMA nella cartella: %DEPLOY_PATH%
echo 2. Crea venv: python -m venv venv
echo 3. Attiva venv: call venv\Scripts\activate.bat
echo 4. Installa dipendenze: pip install -r requirements.txt
echo 5. Avvia server: python -m server.app.run
echo 6. Apri browser: http://SERVERDIMA:5000
echo.
pause
