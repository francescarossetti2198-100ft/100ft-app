-- Sfide "traguardo": si completano da sole quando l'atleta soddisfa un criterio verificabile
-- dallo stato dell'app (profilo completo, obiettivi compilati, un daily drop, N presenze).
-- SQLite non permette di alterare un CHECK: si ricrea la tabella preservando id e dati.
PRAGMA foreign_keys=OFF;

CREATE TABLE sfide_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titolo TEXT NOT NULL,
  descrizione TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('presenza', 'foto', 'valore_manuale', 'traguardo')),
  criterio TEXT,
  punti INTEGER NOT NULL DEFAULT 0,
  data_inizio TEXT NOT NULL,
  data_fine TEXT NOT NULL
);

INSERT INTO sfide_new (id, titolo, descrizione, tipo, punti, data_inizio, data_fine)
  SELECT id, titolo, descrizione, tipo, punti, data_inizio, data_fine FROM sfide;

DROP TABLE sfide;
ALTER TABLE sfide_new RENAME TO sfide;

PRAGMA foreign_keys=ON;
