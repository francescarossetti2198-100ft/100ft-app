-- Diario allenamenti del coach: una voce per giorno di allenamento (L/M/V) con il focus
-- del giorno (pattern di lavoro) + un allegato PDF/Word con la scheda + foto opzionale.
-- La coach può pubblicare ogni voce nel Feed scegliendo cosa includere.

CREATE TABLE diario_allenamenti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL UNIQUE,            -- YYYY-MM-DD, una voce per giorno
  focus TEXT,                           -- annotazioni pattern/focus del giorno
  nota TEXT,                            -- nota libera opzionale
  file_url TEXT,                        -- path /api/foto/diario/<uuid>.<ext> (PDF/Word)
  file_nome TEXT,                       -- nome originale del file, per il download
  foto_url TEXT,                        -- immagine opzionale
  pubblicato_feed INTEGER NOT NULL DEFAULT 0,
  creato_il TEXT NOT NULL DEFAULT (datetime('now')),
  aggiornato_il TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_diario_data ON diario_allenamenti(data);

-- Aggiunge 'allenamento' ai tipi di post ammessi nel Feed (voce di diario pubblicata dalla
-- coach) + due colonne per l'allegato scaricabile del post (contenuto_url resta per l'immagine).
-- SQLite non permette di alterare un CHECK esistente: si ricrea la tabella preservando id e dati.
PRAGMA foreign_keys=OFF;

CREATE TABLE post_feed_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (
    tipo IN ('level_up', 'new_pb', 'consistency', 'athlete_of_week', 'daily_drop', 'annuncio_coach', 'sfida', 'badge', 'allenamento')
  ),
  contenuto_url TEXT,
  allegato_url TEXT,
  allegato_nome TEXT,
  testo TEXT,
  data TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO post_feed_new (id, user_id, tipo, contenuto_url, testo, data)
  SELECT id, user_id, tipo, contenuto_url, testo, data FROM post_feed;

DROP TABLE post_feed;
ALTER TABLE post_feed_new RENAME TO post_feed;

CREATE INDEX idx_feed_data ON post_feed(data);

PRAGMA foreign_keys=ON;
