-- Questionario mensile: ogni atleta dà un feedback guidato sul mese appena concluso,
-- disponibile per tutto il mese successivo. Distinto dal feedback post-sessione
-- (feedback_allenamento). Le domande vivono nel frontend; qui si salvano le risposte
-- come JSON { idDomanda: valore | [valori] }.
CREATE TABLE feedback_mensile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mese INTEGER NOT NULL CHECK (mese BETWEEN 1 AND 12),   -- mese recensito (quello concluso)
  anno INTEGER NOT NULL,
  risposte TEXT NOT NULL,
  creato_il TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, mese, anno)
);

-- Dedup del promemoria push del giorno 1 (stesso pattern di daily_drop_notifiche /
-- allenamento_notifiche): "YYYY-MM" del mese recensito.
CREATE TABLE feedback_mensile_notifiche (periodo TEXT PRIMARY KEY);
