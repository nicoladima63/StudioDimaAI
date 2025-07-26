@echo off
setlocal enabledelayedexpansion

echo ========================================
echo    STUDIO DIMA AI - SERVIZI AUTOMAZIONE
echo ========================================
echo.

set "SERVER=\\SERVERDIMA"
set "DEPLOY_PATH=%SERVER%\StudioDimaAI"

:: Verifica installazione
if not exist "%DEPLOY_PATH%\server" (
    echo ❌ ERRORE: Progetto non trovato su SERVERDIMA
    echo    Esegui prima deploy.bat
    pause
    exit /b 1
)

echo [1/4] Verifica servizi attivi...

:: Controlla se server principale è già attivo
tasklist /S 192.168.1.200 /FI "IMAGENAME eq python.exe" 2>nul | find "python.exe" >nul
if not errorlevel 1 (
    echo ✅ Server principale già attivo
) else (
    echo ⚠️  Server principale non attivo
    echo    Avviare prima start_server.bat sul server
)

echo.
echo [2/4] Configurazione servizi automatici...
echo.
echo Servizi disponibili:
echo   - Sincronizzazione calendari automatica
echo   - Invio SMS promemoria appuntamenti 
echo   - Invio SMS richiami pazienti
echo   - Lettura email RENTRI (futuro)
echo   - Backup automatico database (futuro)
echo.

:: Crea script servizio Windows
echo [3/4] Creazione servizio Windows...

:: Script per avvio automatico
echo @echo off > "%DEPLOY_PATH%\automation_service.bat"
echo title Studio Dima AI - Servizi Automazione >> "%DEPLOY_PATH%\automation_service.bat"
echo cd /d "%DEPLOY_PATH%\server" >> "%DEPLOY_PATH%\automation_service.bat"
echo call venv\Scripts\activate.bat >> "%DEPLOY_PATH%\automation_service.bat"
echo echo. >> "%DEPLOY_PATH%\automation_service.bat"
echo echo ======================================== >> "%DEPLOY_PATH%\automation_service.bat"
echo echo    STUDIO DIMA AI - AUTOMAZIONE ATTIVA >> "%DEPLOY_PATH%\automation_service.bat"
echo echo ======================================== >> "%DEPLOY_PATH%\automation_service.bat"
echo echo. >> "%DEPLOY_PATH%\automation_service.bat"
echo echo Servizi automatici avviati: >> "%DEPLOY_PATH%\automation_service.bat"
echo echo  - Sincronizzazione calendari >> "%DEPLOY_PATH%\automation_service.bat"
echo echo  - SMS promemoria appuntamenti >> "%DEPLOY_PATH%\automation_service.bat"
echo echo  - SMS richiami pazienti >> "%DEPLOY_PATH%\automation_service.bat"
echo echo. >> "%DEPLOY_PATH%\automation_service.bat"
echo echo Premi CTRL+C per fermare i servizi >> "%DEPLOY_PATH%\automation_service.bat"
echo echo. >> "%DEPLOY_PATH%\automation_service.bat"
echo python -c "from server.app.scheduler import *; import time; print('Scheduler avviato!'); time.sleep(999999)" >> "%DEPLOY_PATH%\automation_service.bat"

:: Script per Task Scheduler Windows
echo [4/4] Configurazione Task Scheduler...

:: Crea file XML per Task Scheduler
echo ^<?xml version="1.0" encoding="UTF-16"?^> > "%DEPLOY_PATH%\automation_task.xml"
echo ^<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task"^> >> "%DEPLOY_PATH%\automation_task.xml"
echo   ^<Triggers^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<BootTrigger^> >> "%DEPLOY_PATH%\automation_task.xml"
echo       ^<Enabled^>true^</Enabled^> >> "%DEPLOY_PATH%\automation_task.xml"
echo       ^<Delay^>PT2M^</Delay^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^</BootTrigger^> >> "%DEPLOY_PATH%\automation_task.xml"
echo   ^</Triggers^> >> "%DEPLOY_PATH%\automation_task.xml"
echo   ^<Actions^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<Exec^> >> "%DEPLOY_PATH%\automation_task.xml"
echo       ^<Command^>%DEPLOY_PATH%\automation_service.bat^</Command^> >> "%DEPLOY_PATH%\automation_task.xml"
echo       ^<WorkingDirectory^>%DEPLOY_PATH%\server^</WorkingDirectory^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^</Exec^> >> "%DEPLOY_PATH%\automation_task.xml"
echo   ^</Actions^> >> "%DEPLOY_PATH%\automation_task.xml"
echo   ^<Settings^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<MultipleInstancesPolicy^>IgnoreNew^</MultipleInstancesPolicy^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<DisallowStartIfOnBatteries^>false^</DisallowStartIfOnBatteries^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<StopIfGoingOnBatteries^>false^</StopIfGoingOnBatteries^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<AllowHardTerminate^>true^</AllowHardTerminate^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<StartWhenAvailable^>true^</StartWhenAvailable^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<RunOnlyIfNetworkAvailable^>false^</RunOnlyIfNetworkAvailable^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<AllowStartOnDemand^>true^</AllowStartOnDemand^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<Enabled^>true^</Enabled^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<Hidden^>false^</Hidden^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<RunOnlyIfIdle^>false^</RunOnlyIfIdle^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<WakeToRun^>false^</WakeToRun^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<ExecutionTimeLimit^>PT0S^</ExecutionTimeLimit^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<Priority^>7^</Priority^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<RestartOnFailure^> >> "%DEPLOY_PATH%\automation_task.xml"
echo       ^<Interval^>PT1M^</Interval^> >> "%DEPLOY_PATH%\automation_task.xml"
echo       ^<Count^>3^</Count^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^</RestartOnFailure^> >> "%DEPLOY_PATH%\automation_task.xml"
echo   ^</Settings^> >> "%DEPLOY_PATH%\automation_task.xml"
echo   ^<RegistrationInfo^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<Description^>Studio Dima AI - Servizi Automazione^</Description^> >> "%DEPLOY_PATH%\automation_task.xml"
echo   ^</RegistrationInfo^> >> "%DEPLOY_PATH%\automation_task.xml"
echo   ^<Principals^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^<Principal id="Author"^> >> "%DEPLOY_PATH%\automation_task.xml"
echo       ^<LogonType^>InteractiveToken^</LogonType^> >> "%DEPLOY_PATH%\automation_task.xml"
echo       ^<RunLevel^>LeastPrivilege^</RunLevel^> >> "%DEPLOY_PATH%\automation_task.xml"
echo     ^</Principal^> >> "%DEPLOY_PATH%\automation_task.xml"
echo   ^</Principals^> >> "%DEPLOY_PATH%\automation_task.xml"
echo ^</Task^> >> "%DEPLOY_PATH%\automation_task.xml"

echo ✅ File automazione creati

echo.
echo ========================================
echo    CONFIGURAZIONE COMPLETATA! 🎉
echo ========================================
echo.
echo PROSSIMI PASSI SUL SERVER:
echo.
echo 1. AVVIO MANUALE (per test):
echo    Esegui: %DEPLOY_PATH%\automation_service.bat
echo.
echo 2. AVVIO AUTOMATICO (produzione):
echo    - Vai su SERVERDIMA come Amministratore
echo    - Apri Task Scheduler
echo    - Importa attività: %DEPLOY_PATH%\automation_task.xml
echo    - Nome attività: "Studio Dima AI Automazione"
echo.
echo 3. MONITORAGGIO:
echo    - Log calendario: %DEPLOY_PATH%\server\automation_calendar_sync.log
echo    - Log richiami: %DEPLOY_PATH%\server\automation_recall.log
echo    - Log server: Console applicazione
echo.
echo 4. CONFIGURAZIONE ORARI:
echo    - Accedi a: http://192.168.1.200:5000
echo    - Vai in Impostazioni ^> Automazione
echo    - Configura orari sincronizzazione e SMS
echo.
echo IMPORTANTE: 
echo Il servizio deve essere avviato DOPO il server principale!
echo.
pause