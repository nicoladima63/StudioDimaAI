@echo off
setlocal EnableExtensions
REM Registra l'avvio automatico del server (start_server_v2.bat) in Task Scheduler.
REM Da eseguire UNA VOLTA sul PC di produzione, dalla cartella dell'installazione
REM (stessa cartella di start_server_v2.bat), con un prompt avviato come amministratore.
REM Parte al logon dell'utente che lo esegue: serve che il PC faccia login automatico
REM dopo un riavvio. Se il server e' gia' avviato a mano, la seconda istanza attende
REM e poi si ferma da sola (mutex per porta), quindi non si creano doppioni.

cd /d "%~dp0"

if not exist "start_server_v2.bat" (
    echo ERRORE: start_server_v2.bat non trovato in %~dp0
    echo Esegui prima un deploy, oppure lancia questo script dalla cartella giusta.
    pause
    exit /b 1
)

set "TASK_NAME=StudioDimaAI_Server"

schtasks /Create /TN "%TASK_NAME%" /TR "\"%~dp0start_server_v2.bat\"" /SC ONLOGON /RL HIGHEST /F
if errorlevel 1 (
    echo ERRORE: creazione del task non riuscita. Riprova da un prompt amministratore.
    pause
    exit /b 1
)

echo.
echo Task "%TASK_NAME%" creato: il server partira' ad ogni logon di %USERNAME%.
echo Per verificarlo:   schtasks /Query /TN "%TASK_NAME%"
echo Per rimuoverlo:    schtasks /Delete /TN "%TASK_NAME%" /F
pause
exit /b 0
