-- Nota del coach (brief, sezione 7) — un messaggio breve per giorno, editabile dal coach.
CREATE TABLE nota_coach (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL UNIQUE, -- YYYY-MM-DD
  testo TEXT NOT NULL,
  aggiornata_il TEXT NOT NULL DEFAULT (datetime('now'))
);
