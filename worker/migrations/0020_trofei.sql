-- Trofei di stagione: 2 per stagione (Set 2026 -> Lug 2027).
--   blocco 'autunno'   = tutte le sfide di settembre..dicembre completate
--   blocco 'primavera' = tutte le sfide di gennaio..luglio completate
-- Una volta conquistato resta per sempre (nessun ricalcolo se il coach aggiunge sfide dopo).
CREATE TABLE trofei (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stagione INTEGER NOT NULL,                 -- anno di inizio stagione (settembre)
  blocco TEXT NOT NULL CHECK (blocco IN ('autunno', 'primavera')),
  data_conquista TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, stagione, blocco)
);
