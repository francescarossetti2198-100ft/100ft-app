-- Data di iscrizione dell'atleta in palestra (impostata dalla coach, non dall'atleta) —
-- visibile sul proprio profilo e nella scheda pubblica che vedono gli altri atleti.
-- Diversa dalla data di creazione dell'account: è la data reale di iscrizione in palestra.
ALTER TABLE athlete_profile ADD COLUMN data_iscrizione TEXT;
