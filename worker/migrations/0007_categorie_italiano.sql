-- Categorie richieste pre-allenamento tradotte in italiano e ridotte a 4 (via nuova spec
-- Home): Mobilità, Gambe, Parte superiore, Altro — "Alta intensità" rimossa, i valori
-- esistenti con quella categoria confluiscono in "Altro".
CREATE TABLE richieste_preallenamento_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sessione_id INTEGER NOT NULL REFERENCES sessioni_gruppo(id) ON DELETE CASCADE,
  categoria TEXT CHECK (categoria IN ('Mobilità', 'Gambe', 'Parte superiore', 'Altro')),
  testo_libero TEXT,
  data_sessione TEXT NOT NULL,
  creata_il TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO richieste_preallenamento_new (id, user_id, sessione_id, categoria, testo_libero, data_sessione, creata_il)
SELECT id, user_id, sessione_id,
  CASE categoria
    WHEN 'Mobility' THEN 'Mobilità'
    WHEN 'Legs' THEN 'Gambe'
    WHEN 'Upper Body' THEN 'Parte superiore'
    WHEN 'Other' THEN 'Altro'
    WHEN 'Alta intensità' THEN 'Altro'
    ELSE categoria
  END,
  testo_libero, data_sessione, creata_il
FROM richieste_preallenamento;

DROP TABLE richieste_preallenamento;
ALTER TABLE richieste_preallenamento_new RENAME TO richieste_preallenamento;

CREATE INDEX idx_richieste_data ON richieste_preallenamento(data_sessione);
