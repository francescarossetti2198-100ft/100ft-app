import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { awardXp } from "../lib/xp";
import { oggi, sessioneOggi } from "../lib/oggi";
import { assegnaMilestone } from "../lib/milestones";
import { snapshotProgressione, segnalaAvanzamento } from "../lib/progressione";

type Variables = { user: SessionUser };
const presenze = new Hono<{ Bindings: Env; Variables: Variables }>();

// Presenza è solo per il giorno stesso, niente prenotazioni future (brief, sezione 3).
presenze.get("/oggi", requireAuth, async (c) => {
  const sessione = await sessioneOggi(c.env.DB);
  if (!sessione) return c.json({ sessione: null, confermata: false, inSala: [] });

  const { data } = oggi();
  const [mia, inSala] = await Promise.all([
    c.env.DB.prepare(`SELECT confermata FROM presenze WHERE user_id = ? AND sessione_id = ? AND data = ?`)
      .bind(c.var.user.userId, sessione.id, data)
      .first<{ confermata: number }>(),
    // "In The Room": community pubblica di chi si allena oggi, con nome (brief, sezione 7).
    c.env.DB.prepare(
      `SELECT p.nome, p.nickname
       FROM presenze pr
       JOIN athlete_profile p ON p.user_id = pr.user_id
       WHERE pr.sessione_id = ? AND pr.data = ? AND pr.confermata = 1
       ORDER BY p.nome`
    )
      .bind(sessione.id, data)
      .all<{ nome: string; nickname: string | null }>(),
  ]);

  return c.json({ sessione, confermata: !!mia?.confermata, inSala: inSala.results });
});

// Presenza / assenza per la sessione di OGGI — sempre modificabile nel giorno stesso
// (l'atleta può cambiare idea finché è oggi). Body `{ presente?: boolean }`: assente se
// `false`, altrimenti presente (una chiamata senza body = conferma, come prima).
presenze.post("/conferma", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") {
    return c.json({ error: "Solo gli atleti possono cambiare la presenza" }, 403);
  }

  const sessione = await sessioneOggi(c.env.DB);
  if (!sessione) return c.json({ error: "Nessuna sessione oggi" }, 400);

  const body = await c.req.json<{ presente?: boolean }>().catch(() => ({}) as { presente?: boolean });
  const presente = body.presente !== false;

  const { data } = oggi();
  const esistente = await c.env.DB.prepare(
    `SELECT confermata FROM presenze WHERE user_id = ? AND sessione_id = ? AND data = ?`
  )
    .bind(c.var.user.userId, sessione.id, data)
    .first<{ confermata: number }>();

  // Nessun cambiamento: presente e già confermata, oppure assente e (mai segnata O già assente).
  if (presente === !!esistente?.confermata && (presente || esistente != null)) {
    return c.json({ ok: true, confermata: !!esistente?.confermata });
  }

  const prima = await snapshotProgressione(c.env.DB, c.var.user.userId);

  await c.env.DB.prepare(
    `INSERT INTO presenze (user_id, sessione_id, data, confermata) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, sessione_id, data) DO UPDATE SET confermata = excluded.confermata`
  )
    .bind(c.var.user.userId, sessione.id, data, presente ? 1 : 0)
    .run();

  if (presente) {
    // +10 XP per sessione completata (brief, sezione 4).
    await awardXp(c.env.DB, c.var.user.userId, "sessione_completata", 10);
  } else {
    // Torna assente: toglie i +10 XP dati alla conferma di oggi (le milestone già
    // raggiunte restano — il conteggio presenze si ricorregge da solo se riconferma).
    await c.env.DB.prepare(
      `DELETE FROM xp_log WHERE id = (
         SELECT id FROM xp_log
         WHERE user_id = ? AND azione = 'sessione_completata' AND date(data) = date('now')
         ORDER BY id DESC LIMIT 1
       )`
    )
      .bind(c.var.user.userId)
      .run();
  }

  const dopo = await snapshotProgressione(c.env.DB, c.var.user.userId);
  await segnalaAvanzamento(c.env.DB, c.var.user.userId, prima, dopo);

  if (presente) {
    // Milestones legate al numero di presenze (brief, sezione 10).
    const totalePresenze = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM presenze WHERE user_id = ? AND confermata = 1`
    )
      .bind(c.var.user.userId)
      .first<{ n: number }>();

    if (totalePresenze?.n === 1) await assegnaMilestone(c.env.DB, c.var.user.userId, "first_session");
    if (totalePresenze?.n === 10) await assegnaMilestone(c.env.DB, c.var.user.userId, "10_sessions");
    if (totalePresenze?.n === 25) await assegnaMilestone(c.env.DB, c.var.user.userId, "25_sessions");
  }

  return c.json({ ok: true, confermata: presente });
});

export default presenze;
