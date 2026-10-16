-- Sfide extra "a foto" (ottobre 2026, prima: 🥾 Trekking ai Castelli Romani del 18/10):
-- dentro una finestra di giorni l'atleta carica la foto e completa la sfida → +punti della
-- sfida extra e post nel Feed. Come le altre sfide extra NON conta per la coccarda del mese
-- (le sfide del mese restano alla portata di chi non partecipa).
ALTER TABLE sfide_extra ADD COLUMN foto INTEGER NOT NULL DEFAULT 0;  -- 1 = si completa con una foto
ALTER TABLE sfide_extra ADD COLUMN aperta_dal TEXT;                   -- "YYYY-MM-DD", primo giorno utile
ALTER TABLE sfide_extra ADD COLUMN aperta_fino TEXT;                  -- "YYYY-MM-DD", ultimo giorno utile

CREATE TABLE partecipazioni_sfide_extra (
  sfida_extra_id INTEGER NOT NULL REFERENCES sfide_extra(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  foto_url TEXT,
  data TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (sfida_extra_id, user_id)
);
