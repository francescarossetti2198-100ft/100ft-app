-- "Sfide punti extra" (ottobre 2026): box a parte sotto le sfide del mese, per le sfide
-- che danno punti in più ma NON contano per la coccarda (es. sfide in palestra, il bonus
-- "settimana completa"). Le sfide del mese restano alla portata di tutti, anche di chi
-- non può venire 3 volte a settimana. Solo informative: i punti li dà il bonus automatico
-- o la coach da "Punti extra". `data` = giorno della sfida in palestra (facoltativo).
CREATE TABLE sfide_extra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anno INTEGER NOT NULL,
  mese INTEGER NOT NULL CHECK (mese BETWEEN 1 AND 12),
  titolo TEXT NOT NULL,
  descrizione TEXT,
  punti INTEGER,
  data TEXT,
  creato_il TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sfide_extra_mese ON sfide_extra(anno, mese);
