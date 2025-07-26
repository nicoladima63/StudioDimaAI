@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    STUDIO DIMA AI - DEPLOYMENT SCRIPT
echo ========================================
echo.

:: Configurazione
set "SERVER=\\SERVERDIMA"
set "DEPLOY_PATH=%SERVER%\StudioDimaAI"
set "BACKUP_PATH=%SERVER%\StudioDimaAI_backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%"

:: Verifica connessione server
echo [1/8] Verifica connessione server SERVERDIMA...
ping -n 1 192.168.1.200 >nul 2>&1
if errorlevel 1 (
    echo ❌ ERRORE: Server SERVERDIMA non raggiungibile
    echo    Verifica che il server sia acceso e connesso alla rete
    pause
    exit /b 1
)
echo ✅ Server raggiungibile

:: Backup esistente
echo.
echo [2/8] Backup installazione esistente...
if exist "%DEPLOY_PATH%" (
    echo Creazione backup in %BACKUP_PATH%...
    xcopy "%DEPLOY_PATH%" "%BACKUP_PATH%" /E /I /Q >nul 2>&1
    if errorlevel 1 (
        echo ⚠️  WARNING: Backup fallito, continuare? (y/n)
        set /p continue=
        if /i not "!continue!"=="y" exit /b 1
    ) else (
        echo ✅ Backup creato
    )
) else (
    echo ✅ Prima installazione, nessun backup necessario
)

:: Build client
echo.
echo [3/8] Build frontend React...
cd client
if not exist "node_modules" (
    echo Installazione dipendenze npm...
    call npm install
    if errorlevel 1 (
        echo ❌ ERRORE: npm install fallito
        echo    Verifica Node.js installato e connessione internet
        pause
        exit /b 1
    )
)

echo Build produzione...
call npm run build
if errorlevel 1 (
    echo ❌ ERRORE: Build React fallito
    echo    Controlla errori TypeScript/ESLint nel codice
    pause
    exit /b 1
)
echo ✅ Frontend buildato
cd ..

:: Crea cartelle sul server
echo.
echo [4/8] Creazione struttura cartelle sul server...
mkdir "%DEPLOY_PATH%" 2>nul
mkdir "%DEPLOY_PATH%\server" 2>nul
mkdir "%DEPLOY_PATH%\server\static" 2>nul
mkdir "%DEPLOY_PATH%\server\instance" 2>nul
echo ✅ Cartelle create

:: Copia file server
echo.
echo [5/8] Copia file server...
xcopy "server" "%DEPLOY_PATH%\server" /E /I /Q /Y >nul 2>&1
if errorlevel 1 (
    echo ❌ ERRORE: Copia file server fallita
    echo    Verifica permessi scrittura su SERVERDIMA
    pause
    exit /b 1
)
echo ✅ File server copiati

:: Copia build frontend
echo.
echo [6/8] Copia build frontend...
xcopy "client\dist" "%DEPLOY_PATH%\server\static" /E /I /Q /Y >nul 2>&1
if errorlevel 1 (
    echo ❌ ERRORE: Copia frontend fallita
    pause
    exit /b 1
)
echo ✅ Frontend copiato

:: Setup ambiente Python sul server
echo.
echo [7/8] Setup ambiente Python remoto...
echo Creazione virtual environment...
pushd "%DEPLOY_PATH%\server"

python -m venv venv
if errorlevel 1 (
    echo ❌ ERRORE: Creazione venv fallita
    echo    Verifica Python installato sul server
    pause
    exit /b 1
)

echo Installazione dipendenze Python...
call venv\Scripts\activate.bat
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ ERRORE: pip install fallito
    echo    Verifica requirements.txt e connessione internet server
    pause
    exit /b 1
)

pip install waitress
if errorlevel 1 (
    echo ⚠️  WARNING: Installazione waitress fallita, usa server dev
)

popd
echo ✅ Ambiente Python configurato

:: Configurazione produzione
echo.
echo [8/8] Configurazione produzione...

:: Imposta modalità database
echo prod > "%DEPLOY_PATH%\server\instance\database_mode.txt"

:: Copia .env se non esiste
if not exist "%DEPLOY_PATH%\server\.env" (
    if exist "server\.env" (
        copy "server\.env" "%DEPLOY_PATH%\server\.env" >nul
        echo ✅ File .env copiato
    ) else (
        echo ⚠️  WARNING: File .env non trovato
        echo    Crea manualmente %DEPLOY_PATH%\server\.env con le configurazioni
    )
) else (
    echo ✅ File .env già presente
)

:: Crea script avvio
echo @echo off > "%DEPLOY_PATH%\start_server.bat"
echo cd /d "%DEPLOY_PATH%\server" >> "%DEPLOY_PATH%\start_server.bat"
echo call venv\Scripts\activate.bat >> "%DEPLOY_PATH%\start_server.bat"
echo python -m server.app.run >> "%DEPLOY_PATH%\start_server.bat"
echo pause >> "%DEPLOY_PATH%\start_server.bat"

echo ✅ Script avvio creato

echo.
echo ========================================
echo    DEPLOYMENT COMPLETATO! 🎉
echo ========================================
echo.
echo Per avviare l'applicazione:
echo 1. Vai su SERVERDIMA
echo 2. Esegui: %DEPLOY_PATH%\start_server.bat
echo 3. Apri browser: http://192.168.1.200:5000
echo.
echo File configurazione: %DEPLOY_PATH%\server\.env
echo Log errori: Controlla console server
echo.
pause