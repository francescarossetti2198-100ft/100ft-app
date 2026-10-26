-- Halloween 2026 rifatta (richiesta di Francesca, 26/10): via la vecchia sfida lampo
-- "Halloween" (0 partecipanti), al suo posto una sfida lampo foto CON VOTAZIONE
-- (migrazione 0051). Foto fino al 31/10 alle 14:00 (+5 a tutte), voto il 31 dalle 14:00
-- a mezzanotte, risultato il 1/11 alle 13:00 (+5 in più alla più votata = 10).
-- In produzione:
--   npx wrangler d1 execute 100ft-db --remote --file=scripts/sfida-halloween-votazione-2026.sql
DELETE FROM sfide WHERE titolo = 'Halloween' AND flash = 1 AND data_inizio = '2026-10-26'
  AND NOT EXISTS (SELECT 1 FROM partecipazioni_sfide p WHERE p.sfida_id = sfide.id);

INSERT INTO sfide (titolo, descrizione, tipo, criterio, punti, flash, foto_richieste, data_inizio, data_fine,
                   votazione_dal, votazione_fino, risultati_dal, punti_vincitore) VALUES
  ('🎃 Halloween: la foto più bella',
   'Carica una foto a tema Halloween: un travestimento, un trucco, una foto artistica… quello che vuoi tu, non serve un selfie! Entro il 31 ottobre alle 14:00. Il 31 dalle 14:00 a mezzanotte si vota la più bella: il risultato esce il 1° novembre alle 13:00, insieme all''Atleta del mese.',
   'foto', NULL, 5, 1, 1, '2026-10-26', '2026-10-31',
   '2026-10-31 14:00', '2026-11-01 00:00', '2026-11-01 13:00', 5);

-- 26/10 (Francesca): non per forza un selfie, va bene qualsiasi foto a tema. Già in prod:
-- UPDATE sfide SET descrizione = '...' WHERE id = 13;
