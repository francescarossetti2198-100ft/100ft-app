-- Messaggi privati coach <-> atleta: un'unica conversazione per atleta con la coach.
-- atleta_id identifica sempre il thread (di chi è la conversazione), mittente_id chi ha
-- scritto quel messaggio (l'atleta stesso o la coach) — un solo coach nel sistema per ora.
CREATE TABLE messaggi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atleta_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mittente_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  testo TEXT NOT NULL,
  creato_il TEXT NOT NULL DEFAULT (datetime('now')),
  letto INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_messaggi_atleta ON messaggi(atleta_id, creato_il);
