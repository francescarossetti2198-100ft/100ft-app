-- Aggiunge 'compleanno' ai tipi di post ammessi nel Feed: il giorno del compleanno di un
-- iscritto (atleti e coach) il cron (lib/compleanniFeed.ts) pubblica alle 11:00 un post con
-- la sua foto e una frase d'auguri sempre diversa, più una push a tutti.
--
-- SQLite non permette di alterare un CHECK: si ricrea post_feed. `feed_reazioni` e
-- `feed_commenti` hanno una foreign key verso post_feed(id) ON DELETE CASCADE: su D1 il
-- `PRAGMA foreign_keys=OFF` NON è affidabile dentro una migrazione, quindi le child table si
-- mettono al sicuro, si droppano prima di post_feed e si rimettono a mano (come nella 0040).

CREATE TABLE feed_reazioni_bak AS SELECT * FROM feed_reazioni;
CREATE TABLE feed_commenti_bak AS SELECT * FROM feed_commenti;
DROP TABLE feed_reazioni;
DROP TABLE feed_commenti;

CREATE TABLE post_feed_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (
    tipo IN ('level_up', 'new_pb', 'consistency', 'athlete_of_week', 'daily_drop', 'annuncio_coach', 'sfida', 'badge', 'allenamento', 'merenda', 'compleanno')
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

CREATE TABLE feed_commenti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES post_feed(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  testo TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_feed_commenti_post ON feed_commenti(post_id);
INSERT INTO feed_commenti (id, post_id, user_id, testo, data)
  SELECT id, post_id, user_id, testo, data FROM feed_commenti_bak;
DROP TABLE feed_commenti_bak;

-- Un post di compleanno per persona per anno (dedup del cron) + quale frase è uscita, così
-- negli anni successivi la stessa persona non riceve di nuovo la stessa.
CREATE TABLE compleanni_feed (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anno INTEGER NOT NULL,
  frase INTEGER NOT NULL,
  PRIMARY KEY (user_id, anno)
);
