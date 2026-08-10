# AI Code Knowledge Platform

## Visione

AI Code Knowledge Platform è un sistema che trasforma un repository software in una Knowledge Base interrogabile dagli agenti AI.

L'obiettivo non è far leggere più codice all'LLM, ma fornire il minimo contesto necessario per svolgere un'attività.

Principio:

Repository → Comprensione → Knowledge Base → Context → LLM


---

# Obiettivi

## Primari

- Ridurre consumo di token.
- Ridurre tempo necessario agli agenti AI per comprendere un progetto.
- Evitare apertura indiscriminata di file.
- Creare una rappresentazione semantica del codice.
- Rendere il sistema riutilizzabile su diversi repository.


## Secondari

- Supporto multi-linguaggio.
- Integrazione con diversi LLM.
- Creazione di Skill per agenti AI.
- Analisi automatica dell'architettura software.


---

# Architettura generale

             Repository

                  |
                  v

          INDEX ENGINE

   Scanner
      |
   Parsers
      |
   Classifier
      |
   Pipeline

                  |
                  v

         KNOWLEDGE BASE

   Entities
   Files
   Relationships
   Features
   Summaries
   Graph

                  |
                  v

         QUERY ENGINE

                  |
                  v

         CONTEXT BUILDER

                  |
                  v

    ChatGPT / Claude / Qwen / GLM
	
	

---

# Componenti


## 1. Index Engine

Responsabilità:

- leggere repository;
- estrarre struttura;
- identificare simboli;
- costruire informazioni semantiche.


### Scanner

Determina:

- directory da analizzare;
- directory escluse;
- linguaggi supportati.


Configurazione:

config/index_config.json

---

## 2. Parsers

Usano Tree-sitter.

Responsabilità:

Estrarre:

- classi;
- funzioni;
- componenti;
- hook;
- definizioni.


Esempi:


python_parser.py
typescript_parser.py

---

## 3. Classifier

Trasforma simboli tecnici in concetti utili.

Esempio:

Input:


const useDocker = () => {}


Output:


name: useDocker
kind: hook
language: typescript



---

# Knowledge Base


La Knowledge Base rappresenta la conoscenza del progetto.


Struttura prevista:



knowledge/

├── entities
├── files
├── relationships
├── features
├── summaries
└── graph



---

# Entity


Rappresenta un elemento software.


Esempio:


```json
{
 "id": "typescript:hook:useDocker",
 "name": "useDocker",
 "kind": "hook",
 "language": "typescript",
 "path": "src/hooks/useDocker.ts",
 "line": 20,
 "summary": null
}

Relationships

Rappresentano i collegamenti.

Esempi:

Component
    imports
        Service


Page
    uses
        Hook


API
    calls
        Database
Context Builder

È il componente più importante.

Responsabilità:

Trasformare una richiesta generica in un contesto minimo.

Esempio:

Input:

Modifica gestione Docker

Output:

client/src/pages/Docker.tsx

client/src/hooks/useDocker.ts

server/api/docker.py

server/services/docker.py

L'LLM riceve solo ciò che serve.

Query Engine

Espone interrogazioni:

find_entity()

find_file()

find_feature()

find_dependencies()

find_callers()

build_context()
Skill Layer

La Skill non contiene la logica di analisi.

Utilizza il Query Engine.

Flusso:

Utente

↓

Skill

↓

Query Engine

↓

Context Builder

↓

LLM