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
echo.
pause

:: [1/5] Creazione cartelle sul server
echo [1/5] Creazione cartelle sul server...
mkdir "%DEPLOY_PATH%" 2>nul
mkdir "%DEPLOY_PATH%\static" 2>nul
mkdir "%DEPLOY_PATH%\instance" 2>nul
echo Cartelle create.

:: [2/5] Copia file server V2 (escludendo venv, log, cache)
echo [2/5] Copia server V2...
echo __pycache__ > exclude_v2.txt
echo *.pyc >> exclude_v2.txt
echo venv >> exclude_v2.txt
echo .pytest_cache >> exclude_v2.txt
echo logs >> exclude_v2.txt
echo *.log >> exclude_v2.txt

xcopy "server_v2" "%DEPLOY_PATH%" /E /I /Q /Y /EXCLUDE:exclude_v2.txt
if errorlevel 1 (
    echo ERRORE: Copia server_v2 fallita.
    del exclude_v2.txt 2>nul
    pause
    exit /b 1
)
del exclude_v2.txt 2>nul
echo Server V2 copiato.

:: [3/5] Build frontend React V2
echo [3/5] Build frontend React V2...
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

:: [4/5] Copia build frontend sul server
echo [4/5] Copia build frontend nella cartella static...
xcopy "client_v2\dist" "%DEPLOY_PATH%\static" /E /I /Q /Y
echo Frontend copiato.

:: [5/5] Copia BAT di avvio sul server
echo [5/5] Creazione BAT di avvio sul server...
(
echo @echo off
echo cd /d "%DEPLOY_PATH%"
echo if not exist venv (
echo     python -m venv venv
echo )
echo call venv\Scripts\activate.bat
echo pip install -r requirements.txt
echo start python run_v2.py --config production --port 5001
) > "%DEPLOY_PATH%\setup_server_env.bat"

echo.
echo ========================================
echo DEPLOYMENT COMPLETATO! 🎉
echo Per avviare server e frontend, esegui start_server_v2.bat sul server.
echo ========================================
pause
