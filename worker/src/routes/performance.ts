import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { PERFORMANCE_ESERCIZI_NOMI } from "../lib/performanceEsercizi";

type Variables = { user: SessionUser };
const performance = new Hono<{ Bindings: Env; Variables: Variables }>();

// Elenco esercizi con l'ultimo peso registrato dall'atleta (null se mai inserito).
performance.get("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti" }, 403);

  const { results } = await c.env.DB.prepare(
    `SELECT esercizio, peso_kg AS peso, creato_il AS data
     FROM performance_carichi WHERE user_id = ? ORDER BY creato_il DESC, id DESC`
  )
    .bind(c.var.user.userId)
    .all<{ esercizio: string; peso: number; data: string }>();

  const ultimo = new Map<string, { peso: number; data: string }>();
  for (const r of results) {
    if (!ultimo.has(r.esercizio)) ultimo.set(r.esercizio, { peso: r.peso, data: r.data });
  }

  return c.json({
    esercizi: PERFORMANCE_ESERCIZI_NOMI.map((nome) => ({
      nome,
      ultimoPeso: ultimo.get(nome)?.peso ?? null,
      ultimaData: ultimo.get(nome)?.data ?? null,
    })),
  });
});

// Storico completo di un esercizio (dal più recente).
performance.get("/:esercizio", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti" }, 403);
  const esercizio = c.req.param("esercizio") ?? "";
  if (!PERFORMANCE_ESERCIZI_NOMI.includes(esercizio)) return c.json({ error: "Esercizio non valido" }, 404);

  const { results } = await c.env.DB.prepare(
    `SELECT peso_kg AS peso, creato_il AS data FROM performance_carichi
     WHERE user_id = ? AND esercizio = ? ORDER BY creato_il DESC, id DESC LIMIT 50`
  )
    .bind(c.var.user.userId, esercizio)
    .all<{ peso: number; data: string }>();

  return c.json({ storico: results });
});

// Registra un nuovo carico. Solo il peso in kg (intero), niente altri campi.
performance.post("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti" }, 403);

  const body = await c.req
    .json<{ esercizio?: string; peso?: number }>()
    .catch(() => ({}) as { esercizio?: string; peso?: number });
  const esercizio = typeof body.esercizio === "string" ? body.esercizio : "";
  const peso = Number(body.peso);

  if (!PERFORMANCE_ESERCIZI_NOMI.includes(esercizio)) {
    return c.json({ error: "Esercizio non valido" }, 400);
  }
  if (!Number.isInteger(peso) || peso < 1 || peso > 500) {
    return c.json({ error: "Inserisci un peso in kg (numero intero)" }, 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO performance_carichi (user_id, esercizio, peso_kg) VALUES (?, ?, ?)`
  )
    .bind(c.var.user.userId, esercizio, peso)
    .run();

  return c.json({ ok: true, esercizio, peso }, 201);
});

export default performance;
