-- Il campo bio (0011) non è più usato: il Profilo coach ora è STATO ABBONAMENTI, non
-- un'identità con bio editabile.
ALTER TABLE athlete_profile DROP COLUMN bio;
