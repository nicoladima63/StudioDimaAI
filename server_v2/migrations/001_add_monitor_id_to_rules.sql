-- Aggiunge la colonna monitor_id alla tabella automation_rules per associare ogni regola a un monitor specifico.
-- Questo è un passo fondamentale per l'architettura "monitor-first".

ALTER TABLE automation_rules ADD COLUMN monitor_id VARCHAR(255);
