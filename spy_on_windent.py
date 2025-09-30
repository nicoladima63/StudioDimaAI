
import time
import logging
import os
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Configura il logging per mostrare chiaramente l'ora e il file modificato
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - MODIFIED: %(message)s',
                    datefmt='%Y-%m-%d %H:%M:%S')

class SpyHandler(FileSystemEventHandler):
    """Un gestore di eventi che logga solo le modifiche ai file."""
    def on_modified(self, event):
        # Ignora gli eventi relativi a cartelle
        if not event.is_directory:
            # Logga solo il percorso del file
            logging.info(event.src_path)

if __name__ == "__main__":
    # Percorsi assoluti delle cartelle da monitorare
    # Assicurati che questi percorsi siano corretti per il tuo sistema
    path_dati = r"C:\pixel\windent\DATI"
    path_user = r"C:\pixel\windent\USER"

    # Controlla se le cartelle esistono prima di avviare il monitoraggio
    if not os.path.exists(path_dati):
        print(f"ERRORE: La cartella {path_dati} non esiste.")
        exit()
    if not os.path.exists(path_user):
        print(f"ERRORE: La cartella {path_user} non esiste.")
        exit()

    print("--- Windent Spy Monitor ---")
    print(f"In ascolto per modifiche su:")
    print(f"- {path_dati}")
    print(f"- {path_user}")
    print("\nPremi Ctrl+C per fermare il monitoraggio.")

    # Crea e configura l'observer
    event_handler = SpyHandler()
    observer = Observer()
    observer.schedule(event_handler, path_dati, recursive=True)
    observer.schedule(event_handler, path_user, recursive=True)

    # Avvia il monitoraggio
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n--- Monitoraggio terminato. ---")
    
    observer.join()
