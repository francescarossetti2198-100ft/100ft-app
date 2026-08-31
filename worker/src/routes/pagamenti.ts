import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireCoach } from "../middleware/auth";
import { adessoRoma } from "../lib/oggi";

type Variables = { user: SessionUser };
const pagamenti = new Hono<{ Bindings: Env; Variables: Variables }>();

// Segna il pagamento del mese corrente per un atleta — marcatura manuale della coach,
// nessun gateway di pagamento collegato (brief, sezione 14).
pagamenti.post("/", requireCoach, async (c) => {
  const { userId, stato } = await c.req.json<{ userId?: number; stato?: string }>();

  if (!userId || (stato !== "pagato" && stato !== "non_pagato")) {
    return c.json({ error: "Dati mancanti o non validi" }, 400);
  }

  const ora = adessoRoma();
  const mese = ora.getUTCMonth() + 1;
  const anno = ora.getUTCFullYear();
  const dataPagamento = stato === "pagato" ? ora.toISOString().slice(0, 10) : null;

  await c.env.DB.prepare(
    `INSERT INTO pagamenti (user_id, mese, anno, stato, data_pagamento) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, mese, anno) DO UPDATE SET stato = excluded.stato, data_pagamento = excluded.data_pagamento`
  )
    .bind(userId, mese, anno, stato, dataPagamento)
    .run();

  return c.json({ ok: true });
});

export default pagamenti;
