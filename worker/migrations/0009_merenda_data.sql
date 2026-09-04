-- Data libera assegnata a ogni merenda (es. il coach sceglie se vale per lunedì, mercoledì
-- o venerdì di una data settimana) — non un giorno della settimana fisso e ricorrente.
ALTER TABLE merende_fit ADD COLUMN data TEXT;
