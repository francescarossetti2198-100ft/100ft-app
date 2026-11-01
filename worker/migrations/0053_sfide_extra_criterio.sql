-- Sfide extra automatiche (novembre 2026, "6 allenamenti di fila"): `criterio` dice come si
-- completano da sole, come le sfide traguardo. Oggi c'è solo 'due_settimane' = lunedì,
-- mercoledì e venerdì di due settimane consecutive del mese (giorni chiusi esclusi), una
-- volta sola. Il controllo gira all'appello (lib/bonusSettimana.ts). NULL = extra normale.
ALTER TABLE sfide_extra ADD COLUMN criterio TEXT;
