@echo off
setlocal EnableExtensions
REM Rimette in piedi tutto il server di produzione dopo un blackout o un riavvio:
REM Docker Desktop, i container Docker (postgres, evolution, cloudflared), nginx e il backend.
REM Si puo' rilanciare quando si vuole: cio' che e' gia' attivo non viene toccato.
REM Va tenuto nella cartella dell'installazione, accanto a start_server_v2.bat.
REM Nei testi echo non usare parentesi: dentro i blocchi if chiuderebbero il blocco.

cd /d "%~dp0"
set "PORTA=5001"
set "LOG=%~dp0ripristino_server.log"

echo.
echo ==========================================
echo  STUDIODIMA - Ripristino server
echo ==========================================
echo [%date% %time%] Ripristino avviato >> "%LOG%"

REM ---------- 1. Docker Desktop ----------
echo.
echo [1/5] Docker Desktop...
docker info >nul 2>&1
if not errorlevel 1 goto docker_ok

set "DOCKER_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if not exist "%DOCKER_EXE%" goto docker_assente
echo   Docker non attivo, lo avvio e attendo fino a 3 minuti...
start "" "%DOCKER_EXE%"
set /a TENTATIVI=0

:attesa_docker
docker info >nul 2>&1
if not errorlevel 1 goto docker_ok
set /a TENTATIVI+=1
if %TENTATIVI% GEQ 36 goto docker_ko
timeout /t 5 /nobreak >nul
goto attesa_docker

:docker_assente
echo   ATTENZIONE: Docker Desktop non trovato, salto container e bot WhatsApp.
echo [%date% %time%] Docker Desktop non trovato >> "%LOG%"
goto backend

:docker_ko
echo   ATTENZIONE: Docker non e' partito entro 3 minuti, salto i container.
echo [%date% %time%] Docker non partito >> "%LOG%"
goto backend

:docker_ok
echo   Docker attivo.

REM ---------- 2. Container ----------
echo.
echo [2/5] Container postgres, evolution e cloudflared...
if not exist ".env.docker" goto env_assente
if not exist "docker-compose.yml" goto env_assente
docker-compose --env-file .env.docker up -d
if errorlevel 1 goto compose_ko
echo   Container avviati.
goto backend

:env_assente
echo   ATTENZIONE: manca docker-compose.yml o .env.docker, lancia un deploy da main.
echo [%date% %time%] docker-compose.yml o .env.docker mancanti >> "%LOG%"
goto backend

:compose_ko
echo   ATTENZIONE: docker-compose up non e' riuscito, guarda l'errore qui sopra.
echo [%date% %time%] docker-compose up fallito >> "%LOG%"

REM ---------- 3. nginx ----------
:backend
echo.
echo [3/5] nginx sulla porta 8000, serve il sito e inoltra al backend...
netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul
if not errorlevel 1 goto nginx_ok

set "NGINX_DIR="
for /d %%D in (C:\nginx*) do if exist "%%D\nginx.exe" set "NGINX_DIR=%%D"
if not defined NGINX_DIR goto nginx_assente
echo   nginx non attivo, lo avvio da %NGINX_DIR%
start "" /D "%NGINX_DIR%" nginx.exe
timeout /t 3 /nobreak >nul
netstat -ano | findstr /R /C:":8000 .*LISTENING" >nul
if not errorlevel 1 goto nginx_ok
echo   ATTENZIONE: nginx non ascolta sulla porta 8000, controlla error.log nella sua cartella.
echo [%date% %time%] nginx non in ascolto >> "%LOG%"
goto nginx_fine

:nginx_assente
echo   ATTENZIONE: nginx non trovato in C:\nginx*, avvialo a mano.
echo [%date% %time%] nginx non trovato >> "%LOG%"
goto nginx_fine

:nginx_ok
echo   nginx attivo.

REM ---------- 4. Backend ----------
:nginx_fine
echo.
echo [4/5] Backend sulla porta %PORTA%...
netstat -ano | findstr /R /C:":%PORTA% .*LISTENING" >nul
if not errorlevel 1 goto backend_attivo

if not exist "start_server_v2.bat" goto bat_assente
echo   Backend non attivo, lo avvio in una nuova finestra. Non chiuderla.
start "StudioDimaAI Server" "%~dp0start_server_v2.bat"
echo [%date% %time%] Backend avviato >> "%LOG%"
set /a TENTATIVI=0

:attesa_backend
netstat -ano | findstr /R /C:":%PORTA% .*LISTENING" >nul
if not errorlevel 1 goto backend_attivo
set /a TENTATIVI+=1
if %TENTATIVI% GEQ 36 goto backend_ko
timeout /t 5 /nobreak >nul
goto attesa_backend

:bat_assente
echo   ERRORE: start_server_v2.bat non trovato in %~dp0
echo   Lancia un deploy da main, poi rilancia questo file.
echo [%date% %time%] start_server_v2.bat mancante >> "%LOG%"
goto fine

:backend_ko
echo   ERRORE: il backend non ascolta sulla porta %PORTA% dopo 3 minuti.
echo   Guarda la finestra "StudioDimaAI Server" per l'errore.
echo [%date% %time%] Backend non in ascolto >> "%LOG%"
goto fine

:backend_attivo
echo   Backend in ascolto.

REM ---------- 4. Verifica ----------
echo.
echo [5/5] Verifica...
curl.exe -sf -m 20 -o nul http://localhost:%PORTA%/api/v2/health
if errorlevel 1 goto health_ko
echo   Il server risponde: tutto a posto.
echo [%date% %time%] Server OK >> "%LOG%"
goto elenco

:health_ko
echo   Il server e' in ascolto ma non risponde ancora. Riprova fra un minuto.
echo [%date% %time%] Health check fallito >> "%LOG%"

:elenco
echo.
docker ps --format "  {{.Names}}  {{.Status}}" 2>nul

:fine
echo.
echo Fatto. Log in %LOG%
timeout /t 20
exit /b 0
