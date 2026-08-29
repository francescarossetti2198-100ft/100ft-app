-- Richieste pre-allenamento: da 4 categorie a un set di "box" guidati più ricco (nuova
-- spec Home). Niente più testo libero nuovo; "Altro" resta come rete di sicurezza.
-- Stesso schema di ricreazione della 0007 (SQLite non permette di modificare un CHECK).
CREATE TABLE richieste_preallenamento_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sessione_id INTEGER NOT NULL REFERENCES sessioni_gruppo(id) ON DELETE CASCADE,
  categoria TEXT CHECK (categoria IN (
    'Upper body', 'Lower body', 'Addome / core', 'Mobilità', 'Stretching',
    'Alta intensità', 'Lavoro tecnico', 'Propriocezione', 'Equilibrio', 'Isometria', 'Altro'
  )),
  testo_libero TEXT,
  data_sessione TEXT NOT NULL,
  creata_il TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO richieste_preallenamento_new (id, user_id, sessione_id, categoria, testo_libero, data_sessione, creata_il)
SELECT id, user_id, sessione_id,
  CASE
    WHEN categoria IS NULL THEN NULL
    WHEN categoria = 'Gambe' THEN 'Lower body'
    WHEN categoria = 'Parte superiore' THEN 'Upper body'
    WHEN categoria = 'Mobilità' THEN 'Mobilità'
    ELSE 'Altro'
  END,
  testo_libero, data_sessione, creata_il
FROM richieste_preallenamento;

DROP TABLE richieste_preallenamento;
ALTER TABLE richieste_preallenamento_new RENAME TO richieste_preallenamento;

CREATE INDEX idx_richieste_data ON richieste_preallenamento(data_sessione);
