@echo off
REM StudioDimaAI Server Launcher
REM Avvia il server Flask in modo persistente

cd /d "C:\StudioDimaAI\server_v2"

REM Attendere 5 secondi dopo il boot (permette ai servizi di partire)
timeout /t 5 /nobreak

REM Avvia il server in modalità produzione
echo [%date% %time%] Avvio StudioDimaAI Server...
python run_v2.py --config production --log-level WARNING

REM Se il server si ferma, tenta il restart
echo [%date% %time%] Server terminato. Tentativo di riavvio tra 10 secondi...
timeout /t 10 /nobreak
goto loop

:loop
python run_v2.py --config production --log-level WARNING
goto loop

REM Fine
exit /b 0
