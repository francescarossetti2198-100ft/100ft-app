-- Appello digitale: l'atleta "prenota" la presenza (presenza_richiesta), ma la presenza
-- che conta per punti/livello (presenze.confermata) la mette il coach a fine allenamento.
ALTER TABLE presenze ADD COLUMN presenza_richiesta INTEGER NOT NULL DEFAULT 0;

-- Le presenze già confermate finora erano auto-confermate dall'atleta: valgono anche come prenotate.
UPDATE presenze SET presenza_richiesta = 1 WHERE confermata = 1;

-- Dedup della push "fai l'appello" mandata al coach a fine sessione (come allenamento_notifiche).
CREATE TABLE appello_notifiche (
  data TEXT NOT NULL,
  sessione_id INTEGER NOT NULL,
  inviata_il TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (data, sessione_id)
);

-- Registra quando il coach ha confermato l'appello di una sessione: serve per distinguere
-- "in attesa di conferma" (appello non ancora fatto) da "assente" (coach ha fatto l'appello
-- e non ti ha segnato presente).
CREATE TABLE appello_conferme (
  data TEXT NOT NULL,
  sessione_id INTEGER NOT NULL,
  confermato_il TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (data, sessione_id)
);
