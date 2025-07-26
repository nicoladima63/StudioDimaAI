@echo off
echo ========================================
echo    VERIFICA SERVIZI AUTOMAZIONE
echo ========================================
echo.

set "SERVER=\\SERVERDIMA"
set "DEPLOY_PATH=%SERVER%\StudioDimaAI"

echo Controllo servizi automazione...
echo.

:: Verifica file automazione
echo [1/5] File automazione:
if exist "%DEPLOY_PATH%\automation_service.bat" (
    echo ✅ Script servizio presente
) else (
    echo ❌ Script servizio mancante
)

if exist "%DEPLOY_PATH%\automation_task.xml" (
    echo ✅ Task scheduler config presente
) else (
    echo ❌ Task scheduler config mancante  
)

echo.
echo [2/5] Log files:
if exist "%DEPLOY_PATH%\server\automation_calendar_sync.log" (
    echo ✅ Log sincronizzazione calendario presente
    echo    Ultima riga:
    for /f "delims=" %%i in ('type "%DEPLOY_PATH%\server\automation_calendar_sync.log" ^| tail -1 2^>nul') do echo    %%i
) else (
    echo ⚠️  Log sincronizzazione calendario non presente (normale se mai eseguito)
)

if exist "%DEPLOY_PATH%\server\automation_recall.log" (
    echo ✅ Log richiami presente
    echo    Ultima riga:
    for /f "delims=" %%i in ('type "%DEPLOY_PATH%\server\automation_recall.log" ^| tail -1 2^>nul') do echo    %%i
) else (
    echo ⚠️  Log richiami non presente (normale se mai eseguito)
)

echo.
echo [3/5] Configurazione automazione:
if exist "%DEPLOY_PATH%\server\automation_settings.json" (
    echo ✅ Configurazione automazione presente
    findstr /C:"calendar_sync_enabled" "%DEPLOY_PATH%\server\automation_settings.json" >nul 2>&1
    if not errorlevel 1 (
        echo ✅ Sincronizzazione calendario configurata
    ) else (
        echo ⚠️  Sincronizzazione calendario non configurata
    )
    findstr /C:"reminder_enabled" "%DEPLOY_PATH%\server\automation_settings.json" >nul 2>&1
    if not errorlevel 1 (
        echo ✅ Promemoria SMS configurati
    ) else (
        echo ⚠️  Promemoria SMS non configurati
    )
    findstr /C:"recall_enabled" "%DEPLOY_PATH%\server\automation_settings.json" >nul 2>&1
    if not errorlevel 1 (
        echo ✅ Richiami SMS configurati
    ) else (
        echo ⚠️  Richiami SMS non configurati
    )
) else (
    echo ❌ File configurazione automazione mancante
    echo    Accedi al pannello web per configurare
)

echo.
echo [4/5] Processo attivi sul server:
tasklist /S 192.168.1.200 /FI "IMAGENAME eq python.exe" 2>nul | find "python.exe" >nul
if not errorlevel 1 (
    echo ✅ Processi Python attivi sul server
    tasklist /S 192.168.1.200 /FI "IMAGENAME eq python.exe" /FO CSV | find /C "python.exe" > temp_count.txt
    set /p process_count=<temp_count.txt
    del temp_count.txt
    echo    Numero processi: !process_count!
    if !process_count! GEQ 2 (
        echo ✅ Probabilmente server + automazione attivi
    ) else (
        echo ⚠️  Solo 1 processo - potrebbe mancare automazione
    )
) else (
    echo ❌ Nessun processo Python attivo
    echo    Avviare prima il server principale
)

echo.
echo [5/5] Task Scheduler Windows:
schtasks /Query /S 192.168.1.200 /TN "Studio Dima AI Automazione" >nul 2>&1
if not errorlevel 1 (
    echo ✅ Task automatico configurato
    schtasks /Query /S 192.168.1.200 /TN "Studio Dima AI Automazione" /FO LIST | findstr /C:"Status:"
) else (
    echo ⚠️  Task automatico non configurato
    echo    Importare manualmente automation_task.xml in Task Scheduler
)

echo.
echo ========================================
echo COMANDI UTILI:
echo.
echo Avvio manuale:
echo   %DEPLOY_PATH%\automation_service.bat
echo.
echo Configurazione web:
echo   http://192.168.1.200:5000 - Impostazioni
echo.
echo Log in tempo reale:
echo   tail -f %DEPLOY_PATH%\server\automation_*.log
echo.
echo ========================================
pause