@echo off
cd /d "C:\StudioDimaAI"

:: Creazione venv se non esiste
if not exist venv (
    echo Creazione ambiente virtuale...
    python -m venv venv
)

:: Attivazione venv
call venv\Scripts\activate.bat

:: Aggiornamento dipendenze
echo Installazione dipendenze...
pip install -r requirements.txt

:: Avvio Nginx
set NGINX_PATH=C:\nginx\nginx.exe
echo Avvio Nginx...
tasklist /FI "IMAGENAME eq nginx.exe" | find /I "nginx.exe" >nul
if errorlevel 1 (
    start "" "%NGINX_PATH%"
    echo Nginx avviato.
) else (
    echo Nginx già in esecuzione.
)

:: Avvio server Flask
echo Avvio StudioDimaAI Server V2...
start "" python run_v2.py --config production --port 5001
