-- "Performance" (sezione dentro la card Obiettivi del profilo atleta): memoria semplice
-- dell'ultimo carico usato negli esercizi fondamentali 100FT. Solo KG, niente serie/rip/RPE.
-- Ogni salvataggio è una riga nuova: "ultimo peso" = la più recente, lo storico resta.
CREATE TABLE performance_carichi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  esercizio TEXT NOT NULL,
  peso_kg REAL NOT NULL,
  creato_il TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_performance_user_es ON performance_carichi(user_id, esercizio, creato_il);
