-- Abbonamenti (ago 2026): 5 piani a prezzo fisso, l'atleta sceglie il suo dall'app, la coach
-- vede piano + prezzo per segnare l'incasso, e c'è una vista che divide gli incassi tra coach
-- e palestra. Il piano è SOLO fatturazione: non cambia anelli/livelli (restano Lun/Mer/Ven).

-- Log append-only delle scelte: "da questo mese l'atleta X è sul piano Y". Serve per lo
-- storico — la suddivisione si calcola mese per mese, anche sui mesi passati. Il rollover
-- ("la scelta futura diventa attuale da sola") è implicito nella query, niente cron.
CREATE TABLE abbonamenti_scelte (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  piano TEXT NOT NULL,
  dal_anno INTEGER NOT NULL,
  dal_mese INTEGER NOT NULL CHECK (dal_mese BETWEEN 1 AND 12),
  creato_il TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, dal_anno, dal_mese)
);

-- Snapshot del piano fatturato quel mese, congelato quando la coach segna il pagamento.
ALTER TABLE pagamenti ADD COLUMN piano TEXT;

-- % che spetta alla coach per ogni piano (il resto va alla palestra). Solo TRIO deciso per ora.
CREATE TABLE abbonamenti_suddivisione (
  piano TEXT PRIMARY KEY,
  quota_coach_pct INTEGER NOT NULL
);
INSERT INTO abbonamenti_suddivisione (piano, quota_coach_pct) VALUES ('trio', 60);
