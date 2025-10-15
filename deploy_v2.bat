@echo off
setlocal enabledelayedexpansion

echo ==========================================
 echo    STUDIO DIMA AI V2 - DEPLOYMENT SCRIPT
 echo ==========================================
 echo.

:: Configurazione
set "SERVER=\\SERVERDIMA"
set "DEPLOY_PATH=%SERVER%\StudioDimaAI"

echo ATTENZIONE: Questo script sovrascrivera' l'installazione esistente in:
 echo %DEPLOY_PATH%
 echo con la nuova versione V2.
 echo.
pause

:: [1/8] Verifica connessione server
echo [1/8] Verifica connessione server %SERVER%...
ping -n 1 192.168.1.200 >nul 2>&1
if errorlevel 1 (
    echo ERRORE: Server %SERVER% non raggiungibile.
    pause
    exit /b 1
)
echo Server raggiungibile.

:: [2/8] Pulizia contenuto cartella destinazione (DISABILITATO COME RICHIESTO)
:: echo.
:: echo [2/8] Pulizia contenuto cartella destinazione %DEPLOY_PATH%...
:: if exist "%DEPLOY_PATH%" (
::     del /s /q "%DEPLOY_PATH%\*.*" >nul 2>&1
::     for /d %%i in ("%DEPLOY_PATH%\*") do rmdir /s /q "%%i" >nul 2>&1
:: )
:: echo Cartella di destinazione pronta.

:: [3/8] Build client React V2
echo.
 echo [3/8] Build frontend React V2...
cd client_v2
if not exist "node_modules" (
    echo Installazione dipendenze npm client_v2...
    call npm install
    if errorlevel 1 (
        echo ERRORE: npm install fallito.
        pause
        exit /b 1
    )
)
echo Build produzione V2...
call npm run build
if errorlevel 1 (
    echo ERRORE: Build React V2 fallito.
    pause
    exit /b 1
)
echo Frontend V2 buildato.
cd ..

:: [4/8] Crea struttura cartelle
echo.
 echo [4/8] Creazione struttura cartelle sul server...
mkdir "%DEPLOY_PATH%" 2>nul
mkdir "%DEPLOY_PATH%\static" 2>nul
mkdir "%DEPLOY_PATH%\instance" 2>nul
echo Cartelle create.

:: [5/8] Copia file server V2
echo.
 echo [5/8] Copia file server V2...

:: Crea file esclusioni
echo __pycache__ > exclude_v2.txt
echo *.pyc >> exclude_v2.txt
echo venv >> exclude_v2.txt
echo .pytest_cache >> exclude_v2.txt
echo logs >> exclude_v2.txt
echo *.log >> exclude_v2.txt

:: Copia solo file necessari
xcopy "server_v2" "%DEPLOY_PATH%\" /E /I /Q /Y /EXCLUDE:exclude_v2.txt >nul 2>&1
if errorlevel 1 (
    echo ERRORE: Copia file server_v2 fallita.
    del exclude_v2.txt 2>nul
    pause
    exit /b 1
)
del exclude_v2.txt 2>nul
echo File server V2 copiati.

:: [6/8] Copia build frontend V2
echo.
 echo [6/8] Copia build frontend V2...
xcopy "client_v2\dist" "%DEPLOY_PATH%\static" /E /I /Q /Y >nul 2>&1
if errorlevel 1 (
    echo ERRORE: Copia frontend V2 fallita.
    pause
    exit /b 1
)
echo Frontend V2 copiato in \static.

:: [7/8] Copia file di configurazione
echo.
 echo [7/8] Copia file di configurazione...

:: Copia requirements.txt
copy "server_v2\requirements.txt" "%DEPLOY_PATH%\requirements.txt" >nul

:: Copia .env
if exist ".env" (
    copy ".env" "%DEPLOY_PATH%\.env" >nul
    echo .env copiato.
) else (
    echo ERRORE: File .env non trovato!
    pause
    exit /b 1
)

:: Copia certificati
if exist "certs" (
    xcopy "certs" "%DEPLOY_PATH%\certs" /E /I /Q /Y >nul 2>&1
    echo Certificati copiati.
) else (
    echo WARNING: Cartella certs non trovata.
)

echo Configurazione copiata.

:: [8/8] Completato
echo.
 echo ========================================
 echo    DEPLOYMENT V2 COMPLETATO! 🎉
 echo ========================================
 echo.
 echo Files copiati in: %DEPLOY_PATH%
 echo.
 echo PROSSIMI STEP MANUALI SUL SERVER:
 echo 1. Vai su %SERVER% nella cartella: %DEPLOY_PATH%
 echo 2. Esegui solo la prima volta: python -m venv venv
 echo 3. Esegui: call venv\Scripts\activate.bat
 echo 4. Aggiorna le dipendenze: pip install -r requirements.txt
 echo 5. Avvia il nuovo server: python run_v2.py --config production --port 5000
 echo.
pause