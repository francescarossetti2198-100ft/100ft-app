-- Promemoria push opt-in, per utente (non per dispositivo):
--   promemoria_acqua   -> "bevi un po' d'acqua" alle 11:00 e alle 16:00
--   promemoria_merenda -> "fai merenda" 1 ora e mezza prima dell'allenamento
CREATE TABLE notifiche_preferenze (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  promemoria_acqua INTEGER NOT NULL DEFAULT 0,
  promemoria_merenda INTEGER NOT NULL DEFAULT 0,
  aggiornata_il TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dedup degli invii cron (stesso pattern di daily_drop_notifiche / allenamento_notifiche).
CREATE TABLE acqua_notifiche (chiave TEXT PRIMARY KEY);  -- "YYYY-MM-DD HH:MM"
CREATE TABLE merenda_notifiche (data TEXT PRIMARY KEY);
