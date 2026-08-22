import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { awardXp } from "../lib/xp";
import { oggi, sessioneOggi } from "../lib/oggi";
import { calcolaAnelli } from "../lib/settimana";
import { calcolaLivello } from "../lib/livelli";
import { pubblicaPost } from "../lib/feed";
import { assegnaMilestone } from "../lib/milestones";

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

presenze.post("/conferma", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") {
    return c.json({ error: "Solo gli atleti possono confermare la presenza" }, 403);
  }

  const sessione = await sessioneOggi(c.env.DB);
  if (!sessione) return c.json({ error: "Nessuna sessione oggi" }, 400);

  const { data } = oggi();
  const esistente = await c.env.DB.prepare(
    `SELECT confermata FROM presenze WHERE user_id = ? AND sessione_id = ? AND data = ?`
  )
    .bind(c.var.user.userId, sessione.id, data)
    .first<{ confermata: number }>();

  if (esistente?.confermata) return c.json({ ok: true });

  // Snapshot prima della conferma, per rilevare level up / streak da pubblicare nel feed.
  const primaAnelli = await calcolaAnelli(c.env.DB, c.var.user.userId);
  const livelloPrima = calcolaLivello(primaAnelli.settimaneChiuseTotali);

  await c.env.DB.prepare(
    `INSERT INTO presenze (user_id, sessione_id, data, confermata) VALUES (?, ?, ?, 1)
     ON CONFLICT (user_id, sessione_id, data) DO UPDATE SET confermata = 1`
  )
    .bind(c.var.user.userId, sessione.id, data)
    .run();

  // +10 XP per sessione completata (brief, sezione 4) — assegnato una sola volta alla conferma.
  await awardXp(c.env.DB, c.var.user.userId, "sessione_completata", 10);

  // Post automatici nel feed: Level Up e Consistency (brief, sezione 11).
  const dopoAnelli = await calcolaAnelli(c.env.DB, c.var.user.userId);
  const livelloDopo = calcolaLivello(dopoAnelli.settimaneChiuseTotali);

  if (livelloDopo && (!livelloPrima || livelloDopo.attuale.numero > livelloPrima.attuale.numero)) {
    await pubblicaPost(
      c.env.DB,
      c.var.user.userId,
      "level_up",
      `Livello ${livelloDopo.attuale.numero} — ${livelloDopo.attuale.nome}`
    );
  }
  if (dopoAnelli.streakSettimane > primaAnelli.streakSettimane && dopoAnelli.streakSettimane % 4 === 0) {
    await pubblicaPost(
      c.env.DB,
      c.var.user.userId,
      "consistency",
      `${dopoAnelli.streakSettimane} settimane di fila con tutti gli allenamenti completati`
    );
  }

  // Milestones legate alle presenze (brief, sezione 10) — "first_month" semplificato come
  // il raggiungimento del Livello 2 (4 settimane chiuse), stessa semplificazione già
  // dichiarata per il calcolo dei livelli.
  const totalePresenze = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM presenze WHERE user_id = ? AND confermata = 1`
  )
    .bind(c.var.user.userId)
    .first<{ n: number }>();

  if (totalePresenze?.n === 1) await assegnaMilestone(c.env.DB, c.var.user.userId, "first_session");
  if (totalePresenze?.n === 10) await assegnaMilestone(c.env.DB, c.var.user.userId, "10_sessions");
  if (totalePresenze?.n === 25) await assegnaMilestone(c.env.DB, c.var.user.userId, "25_sessions");
  if (livelloDopo?.attuale.numero === 2 && (!livelloPrima || livelloPrima.attuale.numero < 2)) {
    await assegnaMilestone(c.env.DB, c.var.user.userId, "first_month");
  }

  return c.json({ ok: true });
});

export default presenze;
