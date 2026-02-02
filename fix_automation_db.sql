-- Create automation_rules table if missing
CREATE TABLE IF NOT EXISTS automation_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT DEFAULT 'prestazione',
    trigger_id TEXT NOT NULL,
    action_id INTEGER NOT NULL,
    action_params_json TEXT DEFAULT '{}',
    attiva INTEGER DEFAULT 1,
    priorita INTEGER DEFAULT 100,
    monitor_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (action_id) REFERENCES actions(id)
);

-- Create actions table if missing
CREATE TABLE IF NOT EXISTS actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    parameters_json TEXT DEFAULT '[]',
    is_system_action INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update rule 45 with correct work_id parameter
UPDATE automation_rules
SET action_params_json = '{"work_id": 1}',
    updated_at = datetime('now')
WHERE id = 45;
