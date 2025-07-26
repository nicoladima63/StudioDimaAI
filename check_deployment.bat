@echo off
echo ========================================
echo    VERIFICA DEPLOYMENT
echo ========================================
echo.

set "SERVER=\\SERVERDIMA"
set "DEPLOY_PATH=%SERVER%\StudioDimaAI"

echo Controllo file deployment...
echo.

if not exist "%DEPLOY_PATH%" (
    echo ❌ Cartella progetto non trovata
    exit /b 1
)

if not exist "%DEPLOY_PATH%\server\venv" (
    echo ❌ Virtual environment non trovato
    exit /b 1
)

if not exist "%DEPLOY_PATH%\server\static\index.html" (
    echo ❌ Build frontend non trovato
    exit /b 1
)

if not exist "%DEPLOY_PATH%\server\.env" (
    echo ⚠️  File .env mancante
) else (
    echo ✅ File .env presente
)

if not exist "%DEPLOY_PATH%\server\instance\database_mode.txt" (
    echo ⚠️  Modalità database non configurata
) else (
    echo ✅ Modalità database configurata
)

echo.
echo Test connessione server...
ping -n 1 192.168.1.200 >nul 2>&1
if errorlevel 1 (
    echo ❌ Server non raggiungibile
) else (
    echo ✅ Server raggiungibile
)

echo.
echo ========================================
echo Per avviare: %DEPLOY_PATH%\start_server.bat
echo URL: http://192.168.1.200:5000
echo ========================================
pause