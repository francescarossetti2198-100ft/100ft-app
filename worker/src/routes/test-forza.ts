import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { oggi } from "../lib/oggi";
import { validaRisultati, parseRisultati } from "../lib/testForza";

type Variables = { user: SessionUser };
const testForza = new Hono<{ Bindings: Env; Variables: Variables }>();

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// Giorni dopo il test in cui l'atleta può ancora inserire o correggere i risultati.
// 0 = solo il giorno del test (scelta di Francesca, nov 2026: "solo oggi, non tutti i giorni").
const GIORNI_PER_INSERIRE = 0;

// Giorno di test "aperto" per l'atleta: il più recente segnato dalla coach nel Diario,
// tra oggi e GIORNI_PER_INSERIRE giorni fa (ora di Roma).
async function giornoTestAperto(db: D1Database): Promise<string | null> {
  const { data: oggiData } = oggi();
  const d = new Date(`${oggiData}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - GIORNI_PER_INSERIRE);
  const r = await db
    .prepare(
      `SELECT data FROM diario_allenamenti
       WHERE test_forza = 1 AND data <= ? AND data >= ? ORDER BY data DESC LIMIT 1`
    )
    .bind(oggiData, d.toISOString().slice(0, 10))
    .first<{ data: string }>();
  return r?.data ?? null;
}

// Atleta: c'è un test da compilare? + i risultati già inseriti.
testForza.get("/oggi", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ data: null });
  const data = await giornoTestAperto(c.env.DB);
  if (!data) return c.json({ data: null });
  const r = await c.env.DB.prepare(
    `SELECT risultati FROM test_forza_risultati WHERE user_id = ? AND data = ?`
  )
    .bind(c.var.user.userId, data)
    .first<{ risultati: string }>();
  return c.json({ data, oggi: data === oggi().data, risultati: parseRisultati(r?.risultati ?? null) });
});

// Atleta: salva (o corregge) i propri risultati del giorno di test aperto.
testForza.post("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti" }, 403);
  const body = await c.req.json<{ data?: string; risultati?: unknown }>().catch(() => ({}) as { data?: string; risultati?: unknown });
  const aperto = await giornoTestAperto(c.env.DB);
  if (!aperto || body.data !== aperto) {
    return c.json({ error: "Non ci sono test da compilare in questo momento" }, 400);
  }
  const risultati = validaRisultati(body.risultati);
  if (!risultati) return c.json({ error: "Controlla i valori inseriti" }, 400);
  if (Object.keys(risultati).length === 0) return c.json({ error: "Inserisci almeno un risultato" }, 400);

  await c.env.DB.prepare(
    `INSERT INTO test_forza_risultati (user_id, data, risultati) VALUES (?, ?, ?)
     ON CONFLICT (user_id, data) DO UPDATE SET risultati = excluded.risultati, aggiornato_il = datetime('now')`
  )
    .bind(c.var.user.userId, aperto, JSON.stringify(risultati))
    .run();
  return c.json({ data: aperto, risultati });
});

// Coach: tabella dei risultati di un giorno, un atleta per riga (anche chi non ha inserito).
testForza.get("/coach/:data", requireCoach, async (c) => {
  const data = c.req.param("data") ?? "";
  if (!DATA_REGEX.test(data)) return c.json({ error: "Data non valida" }, 400);
  const { results } = await c.env.DB.prepare(
    `SELECT u.id AS userId, p.nome, p.cognome, p.nickname, t.risultati
     FROM users u
     JOIN athlete_profile p ON p.user_id = u.id
     LEFT JOIN test_forza_risultati t ON t.user_id = u.id AND t.data = ?
     WHERE u.role = 'atleta' AND u.status = 'attivo'
     ORDER BY t.risultati IS NULL, p.nome ASC`
  )
    .bind(data)
    .all<{ userId: number; nome: string; cognome: string; nickname: string | null; risultati: string | null }>();
  return c.json({
    atleti: results.map((r) => ({
      userId: r.userId,
      nome: `${r.nome} ${r.cognome ?? ""}`.trim(),
      nickname: r.nickname,
      risultati: parseRisultati(r.risultati),
    })),
  });
});

export default testForza;
