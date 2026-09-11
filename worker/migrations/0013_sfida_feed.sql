-- Aggiunge 'sfida' ai tipi di post ammessi nel feed (foto delle sfide-foto completate).
-- SQLite non permette di alterare un CHECK esistente: si ricrea la tabella preservando id e dati.
PRAGMA foreign_keys=OFF;

CREATE TABLE post_feed_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (
    tipo IN ('level_up', 'new_pb', 'consistency', 'athlete_of_week', 'daily_drop', 'annuncio_coach', 'sfida')
  ),
  contenuto_url TEXT,
  testo TEXT,
  data TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO post_feed_new (id, user_id, tipo, contenuto_url, testo, data)
  SELECT id, user_id, tipo, contenuto_url, testo, data FROM post_feed;

DROP TABLE post_feed;
ALTER TABLE post_feed_new RENAME TO post_feed;

CREATE INDEX idx_feed_data ON post_feed(data);

PRAGMA foreign_keys=ON;
