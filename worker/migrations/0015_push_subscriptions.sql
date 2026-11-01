-- Sottoscrizioni Web Push (notifica reale del Daily Drop, brief sezione 8).
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  creata_il TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);

-- Traccia se il Daily Drop di oggi ha già mandato il push, per non spammare ad ogni tick
-- del cron trigger (gira ogni minuto).
CREATE TABLE daily_drop_notifiche (
  data TEXT PRIMARY KEY,
  inviata_il TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Stesso scopo per il promemoria "Ti alleni oggi?" delle 13:00.
CREATE TABLE allenamento_notifiche (
  data TEXT PRIMARY KEY,
  inviata_il TEXT NOT NULL DEFAULT (datetime('now'))
);
