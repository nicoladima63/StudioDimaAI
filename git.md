# Git – Comandi principali (grouped by category, inline explanations)

## 🧰 Configurazione iniziale

- `git config --global user.name 'Tuo Nome GitHub'` — imposta il nome utente globale  
- `git config --global user.email email@github.com` — imposta l’email globale

---

## 📦 Inizializzare o clonare un progetto

- `git init` — inizializza un repository Git vuoto  
- `git clone serverURL.git` — clona un repository esistente dal server

---

## 🌐 Configurare il server remoto

- `git remote -v` — visualizza i server remoti configurati  
- `git remote add nomeServer URL` — aggiunge un server remoto  
- `git remote rename nomeVecchio nomeNuovo` — rinomina un server remoto  
- `git remote rm nomeServer` — rimuove un server remoto

---

## 📂 Gestione dei file

- `git add nome_file` — aggiunge un file all’index  
- `git add *` — aggiunge tutti i file (escludendo quelli in `.gitignore`)  
- `git rm nomeFile` — rimuove un file dal repository  
- `git mv vecchio nuovo` — rinomina o sposta un file  
- `git checkout -- nomeFile` — ripristina un file alla versione dell’ultimo commit

---

## 💾 Commit e storicizzazione

- `git commit -m "Messaggio"` — registra modifiche con messaggio  
- `git commit -a -m "Messaggio"` — committa anche file già tracciati  
- `git commit --amend` — modifica l’ultimo commit

---

## 🔄 Sincronizzazione con server remoto

- `git pull` — scarica modifiche dal server e le integra  
- `git push nomeServer nomeBranch` — invia le modifiche al server  
- `git push nomeServer --tag` — invia tutti i tag  
- `git push nomeServer nomeTag` — invia un singolo tag

---

## 🔎 Stato e differenze

- `git status` — mostra lo stato del repository  
- `git diff` — mostra differenze nei file  
- `git log` — mostra la cronologia dei commit

---

## 🏷️ Gestione dei tag

- `git tag` — visualizza tutti i tag  
- `git tag -l 1*` — filtra i tag che iniziano con "1"  
- `git tag -a 1.2.3 -m "Messaggio"` — crea un tag annotato  
- `git show 1.2.3` — mostra i dettagli di un tag

---

## 🌳 Gestione dei branch

- `git branch` — elenca i branch  
- `git branch nomeBranch` — crea un nuovo branch  
- `git checkout nomeBranch` — passa a un branch esistente  
- `git checkout master` — torna al branch principale  
- `git checkout -b nomeBranch` — crea e passa al nuovo branch  
- `git branch -d nomeBranch` — elimina un branch  
- `git merge nomeBranch` — unisce il branch corrente con `nomeBranch`

---

## 🧭 Comandi avanzati

- `git reset` — resetta l’HEAD a uno stato precedente  
- `git rebase` — riapplica i commit su un’altra base  
- `git fetch` — recupera dati da un remoto senza fare merge  
- `git bisect` — trova il commit che ha introdotto un bug  
- `git grep` — cerca pattern nel codice sorgente
