-- Notifiche in-app (campanella, stile Instagram — ottobre 2026). NON sono push: si vedono
-- solo aprendo l'app. Quasi tutte si calcolano al volo dalle tabelle che esistono già
-- (commenti, reazioni, xp_log, post del Feed, sfide, nota della coach): qui si salva solo
-- quello che non è scritto da nessun'altra parte.

-- Eventi senza altra traccia: i sorpassi in classifica e le reazioni a un sorpasso.
-- Niente CHECK su `tipo`, così aggiungerne uno nuovo non obbliga a ricreare la tabella.
CREATE TABLE notifiche (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- destinatario
  tipo TEXT NOT NULL,                                               -- 'sorpasso' | 'reazione_sorpasso'
  attore_id INTEGER REFERENCES users(id) ON DELETE CASCADE,         -- chi ha sorpassato / reagito
  riferimento_id INTEGER,                                           -- reazione_sorpasso -> id del sorpasso
  dato TEXT,                                                        -- JSON con i dettagli (mese, posizione)
  reazione TEXT,                                                    -- emoji: risposta data / ricevuta
  chiave TEXT UNIQUE,                                               -- dedup (cron e GET possono girare insieme)
  data TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notifiche_user ON notifiche(user_id, data);

-- Fin dove l'atleta ha già visto: tutto ciò che è più recente è "nuovo" (il numerino rosso).
CREATE TABLE notifiche_lettura (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ultima_lettura TEXT NOT NULL
);

-- Punti del mese di ogni atleta all'ultimo controllo: confrontandoli coi punti attuali si
-- trovano i sorpassi (anche quando l'appello dà +10 a tutti insieme, nessun falso sorpasso).
CREATE TABLE classifica_snapshot (
  mese TEXT NOT NULL,                -- 'YYYY-MM'
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  punti INTEGER NOT NULL,
  PRIMARY KEY (mese, user_id)
);

-- Il "perché" dei punti extra dati dalla coach, mostrato all'atleta nelle notifiche.
ALTER TABLE xp_log ADD COLUMN motivo TEXT;
