-- 100FT — schema iniziale D1
-- Basato su 100FT-app-brief.md v2, sezione 3.

-- Autenticazione: account unico per atleti e coach, ruolo distingue i permessi.
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('atleta', 'coach')),
  status TEXT NOT NULL CHECK (status IN ('attivo', 'sospeso')) DEFAULT 'attivo',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Profilo pubblico atleta (visibile al gruppo).
CREATE TABLE athlete_profile (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  nickname TEXT,
  foto_url TEXT,
  data_nascita TEXT
);

-- Dati privati atleta (visibili solo al coach, mai restituiti dalle API destinate ad altri atleti).
CREATE TABLE athlete_private (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  peso REAL,
  altezza REAL,
  obiettivi TEXT,
  note_infortuni TEXT,
  aree_miglioramento TEXT
);

-- Programma mensile
CREATE TABLE programma_mensile (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mese INTEGER NOT NULL CHECK (mese BETWEEN 1 AND 12),
  anno INTEGER NOT NULL,
  focus_tema TEXT,
  descrizione TEXT,
  linee_guida_nutrizionali TEXT,
  UNIQUE (mese, anno)
);

CREATE TABLE merende_fit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  programma_id INTEGER NOT NULL REFERENCES programma_mensile(id) ON DELETE CASCADE,
  titolo TEXT NOT NULL,
  descrizione TEXT,
  ordine INTEGER NOT NULL DEFAULT 0
);

-- Sessioni di gruppo + presenze
CREATE TABLE sessioni_gruppo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giorno_settimana INTEGER NOT NULL CHECK (giorno_settimana BETWEEN 1 AND 7), -- 1=lunedi ... 7=domenica
  ora_inizio TEXT NOT NULL,
  ora_fine TEXT NOT NULL,
  tipo_sessione TEXT NOT NULL CHECK (tipo_sessione IN ('A', 'B', 'C'))
);

CREATE TABLE presenze (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sessione_id INTEGER NOT NULL REFERENCES sessioni_gruppo(id) ON DELETE CASCADE,
  data TEXT NOT NULL, -- YYYY-MM-DD
  confermata INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, sessione_id, data)
);

CREATE INDEX idx_presenze_data ON presenze(data);
CREATE INDEX idx_presenze_user ON presenze(user_id);

-- Richieste pre-allenamento — categoria fissa o testo libero (brief, sez. 3 e 7).
-- Vista pubblica: aggregata e anonima (conteggi per categoria). Vista coach: con nome dell'atleta.
CREATE TABLE richieste_preallenamento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sessione_id INTEGER NOT NULL REFERENCES sessioni_gruppo(id) ON DELETE CASCADE,
  categoria TEXT CHECK (categoria IN ('Legs', 'Mobility', 'Upper Body', 'Conditioning', 'Other')),
  testo_libero TEXT,
  data_sessione TEXT NOT NULL, -- YYYY-MM-DD, giorno a cui si riferisce la richiesta
  creata_il TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_richieste_data ON richieste_preallenamento(data_sessione);

-- Sfide + partecipazioni (validazione automatica per tipo=presenza, upload solo per Daily Drop)
CREATE TABLE sfide (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titolo TEXT NOT NULL,
  descrizione TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('presenza', 'foto', 'valore_manuale')),
  punti INTEGER NOT NULL DEFAULT 0,
  data_inizio TEXT NOT NULL,
  data_fine TEXT NOT NULL
);

CREATE TABLE partecipazioni_sfide (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sfida_id INTEGER NOT NULL REFERENCES sfide(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  foto_url TEXT,
  valore TEXT,
  data TEXT NOT NULL,
  punti_assegnati INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_partecipazioni_user ON partecipazioni_sfide(user_id);
CREATE INDEX idx_partecipazioni_sfida ON partecipazioni_sfide(sfida_id);

-- Personal best — competizione principalmente con se stessi (sez. 10)
CREATE TABLE personal_best (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  esercizio TEXT NOT NULL, -- push-ups/plank/squat/jump rope/1km/altro definito dal coach
  valore TEXT NOT NULL,
  data TEXT NOT NULL,
  is_new_pb INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX idx_personal_best_user ON personal_best(user_id, esercizio);

-- Milestones raccolte in "Achievements" nel Profile (sez. 10)
CREATE TABLE milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (
    tipo IN ('first_session', '10_sessions', '25_sessions', 'first_month', 'hydration_hero', 'team_player', 'new_pb')
  ),
  data_raggiunta TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, tipo)
);

-- Athlete of the Week — scelta del coach (sez. 12)
CREATE TABLE athlete_of_the_week (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  settimana TEXT NOT NULL, -- YYYY-WW o data di inizio settimana
  motivazione TEXT,
  UNIQUE (settimana)
);

-- XP log — mai totali fissi, sempre calcolati al volo (sez. 3-5: Level/Season Score/Month Score)
CREATE TABLE xp_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  azione TEXT NOT NULL,
  xp_assegnati INTEGER NOT NULL,
  data TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_xp_log_user ON xp_log(user_id, data);

-- Feed + reazioni ("The 100FT Community Board", sez. 11)
CREATE TABLE post_feed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, -- NULL = post generato dal sistema
  tipo TEXT NOT NULL CHECK (
    tipo IN ('level_up', 'new_pb', 'consistency', 'athlete_of_week', 'daily_drop', 'annuncio_coach')
  ),
  contenuto_url TEXT,
  testo TEXT,
  data TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE feed_reazioni (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES post_feed(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (post_id, user_id, emoji)
);

CREATE INDEX idx_feed_data ON post_feed(data);

-- Feedback allenamento — solo chi era presente (sez. 7)
CREATE TABLE feedback_allenamento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sessione_id INTEGER NOT NULL REFERENCES sessioni_gruppo(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  faccina INTEGER NOT NULL CHECK (faccina BETWEEN 1 AND 5),
  miglioramento TEXT CHECK (miglioramento IN ('Mobility', 'Strength', 'Technique', 'Conditioning', 'Other')),
  UNIQUE (user_id, sessione_id, data)
);

-- Pagamenti (segnati manualmente dal coach)
CREATE TABLE pagamenti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mese INTEGER NOT NULL CHECK (mese BETWEEN 1 AND 12),
  anno INTEGER NOT NULL,
  stato TEXT NOT NULL CHECK (stato IN ('pagato', 'non_pagato')) DEFAULT 'non_pagato',
  data_pagamento TEXT,
  note TEXT,
  UNIQUE (user_id, mese, anno)
);

-- Sessioni di login — token opaco, revocabile, "il device ricorda il login"
CREATE TABLE sessioni_login (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creata_il TEXT NOT NULL DEFAULT (datetime('now')),
  scade_il TEXT NOT NULL,
  user_agent TEXT
);

CREATE INDEX idx_sessioni_scadenza ON sessioni_login(scade_il);

-- Token di reset password (flusso email via Resend)
CREATE TABLE reset_password_token (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creata_il TEXT NOT NULL DEFAULT (datetime('now')),
  scade_il TEXT NOT NULL,
  usato INTEGER NOT NULL DEFAULT 0
);
