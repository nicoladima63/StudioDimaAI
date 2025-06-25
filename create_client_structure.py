import os
import subprocess

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
CLIENT_DIR = os.path.join(BASE_DIR, "client")

def run_cmd(command, cwd=None):
    print(f"Eseguo: {command}")
    subprocess.run(command, shell=True, check=True, cwd=cwd)

def main():
    if os.path.exists(CLIENT_DIR):
        print("❗ La cartella 'client' esiste già.")
        return

    # Step 1: Crea Vite con TypeScript
    run_cmd("npm create vite@latest client -- --template react-ts", cwd=BASE_DIR)

    # Step 2: Entra in client e installa dipendenze principali
    run_cmd("npm install", cwd=CLIENT_DIR)
    run_cmd("npm install axios react-router-dom", cwd=CLIENT_DIR)

    # Step 3: Aggiunge cartelle strutturate
    for subdir in ["src/api", "src/pages", "src/components"]:
        path = os.path.join(CLIENT_DIR, subdir)
        os.makedirs(path, exist_ok=True)
        print(f"✅ Creata: {subdir}")

    print("\n✅ Setup completato. Ora entra in 'client/' e lancia 'npm run dev'.")

if __name__ == "__main__":
    main()
