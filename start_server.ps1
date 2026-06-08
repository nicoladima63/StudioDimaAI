# StudioDimaAI Server Launcher - PowerShell
# Avvia il server Flask e lo mantiene in esecuzione

$projectRoot = "C:\StudioDimaAI"
$serverDir = "$projectRoot\server_v2"
$logFile = "$projectRoot\log-server-autostart.txt"

# Funzione per loggare
function Write-Log {
    param([string]$message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $message"
    Add-Content -Path $logFile -Value $logMessage
    Write-Host $logMessage
}

Write-Log "=== Avvio StudioDimaAI Server (Auto-start) ==="
Write-Log "Directory: $serverDir"

# Attendi che i servizi di Windows siano pronti
Start-Sleep -Seconds 10

# Loop infinito per mantenere il server attivo
$restartCount = 0
while ($true) {
    try {
        Write-Log "Avvio server (tentativo $($restartCount + 1))..."

        # Avvia il server
        & python "$serverDir\run_v2.py" --config production --log-level WARNING

        Write-Log "Server terminato. Restart tra 15 secondi..."
        Start-Sleep -Seconds 15
        $restartCount++

        if ($restartCount -gt 10) {
            Write-Log "ERRORE: Troppi restart. Verifica la configurazione."
            exit 1
        }
    }
    catch {
        Write-Log "ERRORE: $_"
        Start-Sleep -Seconds 15
    }
}
