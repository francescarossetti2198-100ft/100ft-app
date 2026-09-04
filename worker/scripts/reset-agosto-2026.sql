-- Reset Agosto 2026: via le sfide di prova e i punti guadagnati ad agosto, così la
-- classifica riparte da settembre. NON tocca le presenze (i livelli si basano sul
-- conteggio presenze, non sui punti) né le milestone.
-- In produzione: dopo un dry-run SELECT, con
--   npx wrangler d1 execute 100ft-db --remote --file=scripts/reset-agosto-2026.sql
DELETE FROM partecipazioni_sfide WHERE sfida_id IN (1, 2);
DELETE FROM post_feed WHERE tipo = 'sfida' AND substr(data, 1, 7) = '2026-08';
DELETE FROM sfide WHERE id IN (1, 2);
DELETE FROM xp_log WHERE substr(data, 1, 7) = '2026-08';
