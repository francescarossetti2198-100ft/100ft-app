-- Aggiunge 'merenda' ai tipi di post ammessi nel Feed: la merenda fit del giorno,
-- pubblicata in automatico dal cron (lib/merendaFeed.ts) con un messaggio diverso ogni volta.
--
-- SQLite non permette di alterare un CHECK: si ricrea post_feed. `feed_reazioni` ha una
-- foreign key verso post_feed(id) ON DELETE CASCADE: su D1 il `PRAGMA foreign_keys=OFF`
-- NON è affidabile dentro una migrazione, quindi le reazioni vanno messe al sicuro e
-- rimesse a mano (la child table si droppa prima del DROP di post_feed).

CREATE TABLE feed_reazioni_bak AS SELECT * FROM feed_reazioni;
DROP TABLE feed_reazioni;

CREATE TABLE post_feed_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (
    tipo IN ('level_up', 'new_pb', 'consistency', 'athlete_of_week', 'daily_drop', 'annuncio_coach', 'sfida', 'badge', 'allenamento', 'merenda')
  ),
  contenuto_url TEXT,
  allegato_url TEXT,
  allegato_nome TEXT,
  testo TEXT,
  data TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO post_feed_new (id, user_id, tipo, contenuto_url, allegato_url, allegato_nome, testo, data)
  SELECT id, user_id, tipo, contenuto_url, allegato_url, allegato_nome, testo, data FROM post_feed;

DROP TABLE post_feed;
ALTER TABLE post_feed_new RENAME TO post_feed;
CREATE INDEX idx_feed_data ON post_feed(data);

CREATE TABLE feed_reazioni (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES post_feed(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (post_id, user_id, emoji)
);

INSERT INTO feed_reazioni (id, post_id, user_id, emoji, data)
  SELECT id, post_id, user_id, emoji, data FROM feed_reazioni_bak;
DROP TABLE feed_reazioni_bak;

-- Dedup: una sola pubblicazione della merenda del giorno nel Feed (come daily_drop_notifiche).
CREATE TABLE merenda_feed_notifiche (data TEXT PRIMARY KEY); -- "YYYY-MM-DD"
