-- Bio libera per l'identità pubblica del profilo — riusa athlete_profile anche per la coach,
-- come già avviene per nome/cognome/nickname (nessuna tabella "coach_profile" separata).
ALTER TABLE athlete_profile ADD COLUMN bio TEXT;
