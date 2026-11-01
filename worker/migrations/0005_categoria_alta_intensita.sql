-- Rinomina la categoria "Conditioning" in "Alta intensità" nelle richieste pre-allenamento
-- (non tocca feedback_allenamento.miglioramento, che ha lo stesso valore ma è una feature
-- diversa — "What Did You Improve Today", non ancora costruita).
-- SQLite non supporta ALTER di un CHECK esistente: si ricrea la tabella.
CREATE TABLE richieste_preallenamento_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sessione_id INTEGER NOT NULL REFERENCES sessioni_gruppo(id) ON DELETE CASCADE,
  categoria TEXT CHECK (categoria IN ('Legs', 'Mobility', 'Upper Body', 'Alta intensità', 'Other')),
  testo_libero TEXT,
  data_sessione TEXT NOT NULL,
  creata_il TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO richieste_preallenamento_new (id, user_id, sessione_id, categoria, testo_libero, data_sessione, creata_il)
SELECT id, user_id, sessione_id,
  CASE categoria WHEN 'Conditioning' THEN 'Alta intensità' ELSE categoria END,
  testo_libero, data_sessione, creata_il
FROM richieste_preallenamento;

DROP TABLE richieste_preallenamento;
ALTER TABLE richieste_preallenamento_new RENAME TO richieste_preallenamento;

CREATE INDEX idx_richieste_data ON richieste_preallenamento(data_sessione);
