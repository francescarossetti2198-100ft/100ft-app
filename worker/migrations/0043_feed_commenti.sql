-- Commenti sotto i post del Feed (prima solo reazioni, brief sezione 11 — richiesta
-- esplicita di Francesca il 2026-09-15 di aggiungerli).
CREATE TABLE feed_commenti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES post_feed(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  testo TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_feed_commenti_post ON feed_commenti(post_id);
