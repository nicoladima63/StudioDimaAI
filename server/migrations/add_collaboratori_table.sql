-- Migration: Tabella per gestione collaboratori confermati
-- Creata per permettere apprendimento e correzione manuale dei collaboratori identificati automaticamente

CREATE TABLE IF NOT EXISTS collaboratori (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codice_fornitore VARCHAR(10) NOT NULL UNIQUE,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL, -- Chirurgia, Ortodonzia, Igienista
    attivo BOOLEAN DEFAULT TRUE,
    confermato_da_utente BOOLEAN DEFAULT FALSE,
    identificato_automaticamente BOOLEAN DEFAULT FALSE,
    data_inserimento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_ultima_modifica TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    note TEXT,
    
    -- Indici per performance
    INDEX idx_collaboratori_codice (codice_fornitore),
    INDEX idx_collaboratori_attivo (attivo),
    INDEX idx_collaboratori_tipo (tipo)
);

-- Inserisci i 5 collaboratori già noti come baseline
INSERT OR IGNORE INTO collaboratori (codice_fornitore, nome, tipo, confermato_da_utente, note) VALUES 
('ZZZZWB', 'Roberto Dott. Calvisi', 'Chirurgia', TRUE, 'Collaboratore storico - 21 fatture'),
('ZZZZXP', 'Dr. Giacomo D''Orlandi Odontoiatra', 'Ortodonzia', TRUE, 'Collaboratore storico'),
('ZZZZXJ', 'Armandi Lara', 'Igienista', TRUE, 'Collaboratore storico - Dott.ssa'),
('ZZZZUC', 'Jablonsky Anet', 'Igienista', TRUE, 'Collaboratore storico - Dott.ssa'),
('ZZZZRL', 'PISANTE ROSSELLA', 'Igienista', TRUE, 'Collaboratore storico - Pesaro');

-- ZZZZYM non inserito perché non ha fatture IVA esente nel DB attuale