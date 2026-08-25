import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireCoach } from "../middleware/auth";
import { calcolaAnelli } from "../lib/settimana";
import { calcolaLivello } from "../lib/livelli";

type Variables = { user: SessionUser };
const atleti = new Hono<{ Bindings: Env; Variables: Variables }>();

// Vista coach — sezione ATLETI della Coach Dashboard: insight per allievo (presenze recenti,
// livello, ultima reaction di feedback, ultime richieste pre-allenamento). Non esisteva prima
// nessun elenco atleti lato coach, solo le richieste del giorno.
atleti.get("/", requireCoach, async (c) => {
  const db = c.env.DB;
  const ora = new Date();
  const mese = ora.getUTCMonth() + 1;
  const anno = ora.getUTCFullYear();

  const { results: utenti } = await db
    .prepare(
      `SELECT u.id AS userId, p.nome, p.cognome, p.nickname
       FROM users u JOIN athlete_profile p ON p.user_id = u.id
       WHERE u.role = 'atleta' AND u.status = 'attivo'
       ORDER BY p.nome`
    )
    .all<{ userId: number; nome: string; cognome: string; nickname: string | null }>();

  const risultato = await Promise.all(
    utenti.map(async (u) => {
      const [anelli, ultimoFeedback, richiesteRecenti, presenze4Sett, pagamento] = await Promise.all([
        calcolaAnelli(db, u.userId),
        db
          .prepare(`SELECT faccina, data FROM feedback_allenamento WHERE user_id = ? ORDER BY data DESC LIMIT 1`)
          .bind(u.userId)
          .first<{ faccina: number; data: string }>(),
        db
          .prepare(
            `SELECT categoria, testo_libero AS testoLibero, data_sessione AS data
             FROM richieste_preallenamento WHERE user_id = ? ORDER BY data_sessione DESC LIMIT 3`
          )
          .bind(u.userId)
          .all<{ categoria: string | null; testoLibero: string | null; data: string }>(),
        db
          .prepare(
            `SELECT COUNT(*) AS n FROM presenze WHERE user_id = ? AND confermata = 1 AND data >= date('now', '-28 days')`
          )
          .bind(u.userId)
          .first<{ n: number }>(),
        db
          .prepare(`SELECT stato FROM pagamenti WHERE user_id = ? AND mese = ? AND anno = ?`)
          .bind(u.userId, mese, anno)
          .first<{ stato: string }>(),
      ]);

      return {
        userId: u.userId,
        nome: u.nome,
        cognome: u.cognome,
        nickname: u.nickname,
        livello: calcolaLivello(anelli.settimaneCompletateTotali),
        presenzeUltime4Settimane: presenze4Sett?.n ?? 0,
        ultimoFeedback: ultimoFeedback ?? null,
        richiesteRecenti: richiesteRecenti.results,
        pagamentoMese: pagamento?.stato ?? "non_pagato",
      };
    })
  );

  return c.json({ atleti: risultato, mese, anno });
});

export default atleti;
