-- Preferenza colore d'accento delle card del Profilo (scelto dall'atleta da una
-- palette fissa di brand: i 6 colori livello + il viola accent). NULL = default
-- (var(--accent) del tema). Il frontend applica il valore come --accent sul
-- wrapper #profilo-content; la whitelist dei valori ammessi vive in profilo.ts.
ALTER TABLE athlete_profile ADD COLUMN card_colore TEXT;
