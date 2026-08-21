-- 100FT — schema iniziale D1
-- Basato su 100FT-app-brief.md, sezione 3 (8 blocchi) + aggiunte segnalate nel brief.

-- 1. Atleti (dati pubblici, visibili al gruppo)
CREATE TABLE atleti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  nickname TEXT,
  foto_url TEXT,
  data_nascita TEXT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  data_iscrizione TEXT NOT NULL DEFAULT (datetime('now')),
  attivo INTEGER NOT NULL DEFAULT 1
);

-- 2. Dati privati (visibili solo al coach)
CREATE TABLE dati_privati_atleta (
  atleta_id INTEGER PRIMARY KEY REFERENCES atleti(id) ON DELETE CASCADE,
  peso REAL,
  altezza REAL,
  obiettivi TEXT,
  note_infortuni TEXT,
  aree_miglioramento TEXT
);

-- 3. Programma mensile
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

-- 4. Sessioni di gruppo + presenze
CREATE TABLE sessioni_gruppo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giorno_settimana INTEGER NOT NULL CHECK (giorno_settimana BETWEEN 1 AND 7), -- 1=lunedi ... 7=domenica
  ora_inizio TEXT NOT NULL,
  ora_fine TEXT NOT NULL,
  tipo_sessione TEXT NOT NULL CHECK (tipo_sessione IN ('A', 'B', 'C'))
);

CREATE TABLE presenze (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atleta_id INTEGER NOT NULL REFERENCES atleti(id) ON DELETE CASCADE,
  sessione_id INTEGER NOT NULL REFERENCES sessioni_gruppo(id) ON DELETE CASCADE,
  data TEXT NOT NULL, -- YYYY-MM-DD
  confermata INTEGER NOT NULL DEFAULT 0,
  UNIQUE (atleta_id, sessione_id, data)
);

CREATE INDEX idx_presenze_data ON presenze(data);
CREATE INDEX idx_presenze_atleta ON presenze(atleta_id);

-- 5. Sfide + partecipazioni
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
  atleta_id INTEGER NOT NULL REFERENCES atleti(id) ON DELETE CASCADE,
  foto_url TEXT,
  valore TEXT,
  data TEXT NOT NULL,
  punti_assegnati INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_partecipazioni_atleta ON partecipazioni_sfide(atleta_id);
CREATE INDEX idx_partecipazioni_sfida ON partecipazioni_sfide(sfida_id);

-- 6. Feed + reazioni
CREATE TABLE post_feed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atleta_id INTEGER REFERENCES atleti(id) ON DELETE CASCADE, -- NULL = annuncio del coach
  tipo TEXT NOT NULL CHECK (tipo IN ('foto_sfida', 'traguardo', 'annuncio_coach')),
  contenuto_url TEXT,
  testo TEXT,
  data TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE feed_reazioni (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES post_feed(id) ON DELETE CASCADE,
  atleta_id INTEGER NOT NULL REFERENCES atleti(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (post_id, atleta_id, emoji)
);

CREATE INDEX idx_feed_data ON post_feed(data);

-- 7. Feedback allenamento (solo chi era presente)
CREATE TABLE feedback_allenamento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atleta_id INTEGER NOT NULL REFERENCES atleti(id) ON DELETE CASCADE,
  sessione_id INTEGER NOT NULL REFERENCES sessioni_gruppo(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  faccina INTEGER NOT NULL CHECK (faccina BETWEEN 1 AND 5),
  note TEXT,
  UNIQUE (atleta_id, sessione_id, data)
);

-- 8. Pagamenti (segnati manualmente dal coach)
CREATE TABLE pagamenti (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atleta_id INTEGER NOT NULL REFERENCES atleti(id) ON DELETE CASCADE,
  mese INTEGER NOT NULL CHECK (mese BETWEEN 1 AND 12),
  anno INTEGER NOT NULL,
  stato TEXT NOT NULL CHECK (stato IN ('pagato', 'non_pagato')) DEFAULT 'non_pagato',
  data_pagamento TEXT,
  note TEXT,
  UNIQUE (atleta_id, mese, anno)
);

-- Richieste pre-allenamento (sezione 3 del brief — visibili a tutti, chiudono alle 13:00 del giorno sessione)
CREATE TABLE richieste_preallenamento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atleta_id INTEGER NOT NULL REFERENCES atleti(id) ON DELETE CASCADE,
  data_sessione TEXT NOT NULL, -- YYYY-MM-DD, giorno a cui si riferisce la richiesta
  testo TEXT NOT NULL,
  creata_il TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_richieste_data ON richieste_preallenamento(data_sessione);

-- Sessioni di login (atleti + coach) — token opaco, revocabile, "il device ricorda il login"
CREATE TABLE sessioni_login (
  token TEXT PRIMARY KEY,
  atleta_id INTEGER REFERENCES atleti(id) ON DELETE CASCADE, -- NULL = sessione del coach
  is_coach INTEGER NOT NULL DEFAULT 0,
  creata_il TEXT NOT NULL DEFAULT (datetime('now')),
  scade_il TEXT NOT NULL,
  user_agent TEXT
);

CREATE INDEX idx_sessioni_scadenza ON sessioni_login(scade_il);

-- Token di reset password (flusso email via Resend)
CREATE TABLE reset_password_token (
  token TEXT PRIMARY KEY,
  atleta_id INTEGER NOT NULL REFERENCES atleti(id) ON DELETE CASCADE,
  creata_il TEXT NOT NULL DEFAULT (datetime('now')),
  scade_il TEXT NOT NULL,
  usato INTEGER NOT NULL DEFAULT 0
);
