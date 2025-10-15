# server_v2/run_with_ngrok.py
import os
import subprocess
import sys
import time
from pyngrok import ngrok, conf
from pyngrok.exception import PyngrokError
from dotenv import load_dotenv

# --- Configurazione ---
# Assicurati che questa sia la porta del tuo SERVER V2
FLASK_PORT = 5001
# --------------------

def run_server_with_ngrok():
    """
    Avvia un tunnel ngrok, imposta l'URL come variabile d'ambiente
    e poi avvia il server Flask V2.
    """
    print("🚀 Avvio del server di sviluppo V2 con ngrok...")

    # Carica le variabili d'ambiente dal file .env nella root del progetto
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    dotenv_path = os.path.join(project_root, '.env')
    load_dotenv(dotenv_path=dotenv_path)

    try:
        # --- 1. Autenticazione ngrok esplicita dal file .env ---
        authtoken = os.environ.get("NGROK_AUTHTOKEN")
        if authtoken:
            print("🔑 Trovato NGROK_AUTHTOKEN, configuro ngrok...")
            conf.get_default().auth_token = authtoken

        # --- 2. Cleanup robusto di ngrok (dopo l'autenticazione) ---
        print("🧹 Pulizia di eventuali sessioni ngrok precedenti...")
        try:
            for tunnel in ngrok.get_tunnels():
                print(f"   -> Disconnessione tunnel esistente: {tunnel.public_url}")
                ngrok.disconnect(tunnel.public_url)
            ngrok.kill()
            print("   -> Attendo 2 secondi per la terminazione dei processi...")
            time.sleep(2)
            print("✅ Pulizia completata.")
        except Exception as cleanup_error:
            print(f"⚠️  Avviso durante la pulizia: {cleanup_error}")


        # --- Avvio ngrok con logica di retry ---
        tunnel = None
        max_retries = 3
        retry_delay = 5  # secondi

        for attempt in range(max_retries):
            try:
                print(f"Tentativo {attempt + 1}/{max_retries} di avviare il tunnel ngrok...")
                print(f" tunneling verso http://127.0.0.1:{FLASK_PORT}")
                # Aumentiamo il timeout per dare più tempo alla connessione
                tunnel = ngrok.connect(FLASK_PORT, "http")
                break  # Se la connessione ha successo, esce dal ciclo
            except PyngrokError as e:
                print(f"⚠️  Tentativo {attempt + 1} fallito: {e}")
                if attempt < max_retries - 1:
                    print(f"Riprovo tra {retry_delay} secondi...")
                    time.sleep(retry_delay)
                else:
                    print("❌ Numero massimo di tentativi raggiunto. Impossibile avviare ngrok.")
                    raise  # Rilancia l'eccezione per terminare lo script

        public_url = tunnel.public_url
        print(f"✅ Tunnel ngrok attivo: {public_url}")

        # Imposta la variabile d'ambiente che l'app Flask leggerà
        # Aggiungiamo il suffisso /r per l'endpoint di reindirizzamento
        tracked_link_base_url = f"{public_url}/r"
        os.environ['TRACKED_LINK_BASE_URL'] = tracked_link_base_url
        print(f"🔧 Variabile d'ambiente impostata: TRACKED_LINK_BASE_URL={tracked_link_base_url}")

        # Avvia l'applicazione Flask V2 come un sottoprocesso
        print("\n🔥 Avvio del server Flask V2...")
        
        flask_process = subprocess.Popen(
            [sys.executable, "-m", "server_v2.app.run"],
            cwd=project_root # Esegui dalla root del progetto
        )

        flask_process.wait()

    except Exception as e:
        print(f"❌ Errore durante l'avvio: {e}")
    finally:
        print("\n🛑 Chiusura dei tunnel ngrok e del server...")
        ngrok.kill()

if __name__ == "__main__":
    run_server_with_ngrok()