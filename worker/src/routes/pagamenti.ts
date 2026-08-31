import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireCoach } from "../middleware/auth";
import { adessoRoma } from "../lib/oggi";
import { pianoValido } from "../lib/abbonamentiPiani";
import { pianoDelMese } from "../lib/abbonamenti";

type Variables = { user: SessionUser };
const pagamenti = new Hono<{ Bindings: Env; Variables: Variables }>();

// Segna il pagamento del mese corrente per un atleta — marcatura manuale della coach,
// nessun gateway di pagamento collegato (brief, sezione 14). Accetta anche `piano` per
// correggere il piano fatturato quel mese senza toccare lo stato.
pagamenti.post("/", requireCoach, async (c) => {
  const { userId, stato, piano } = await c.req.json<{ userId?: number; stato?: string; piano?: string }>();

  if (!userId) return c.json({ error: "Manca userId" }, 400);
  const cambiaStato = stato === "pagato" || stato === "non_pagato";
  const cambiaPiano = typeof piano === "string";
  if (!cambiaStato && !cambiaPiano) {
    return c.json({ error: "Serve `stato` o `piano`" }, 400);
  }
  if (cambiaPiano && !pianoValido(piano!)) {
    return c.json({ error: "Piano non valido" }, 400);
  }

  const ora = adessoRoma();
  const mese = ora.getUTCMonth() + 1;
  const anno = ora.getUTCFullYear();

  if (cambiaPiano) {
    await c.env.DB.prepare(
      `INSERT INTO pagamenti (user_id, mese, anno, stato, piano) VALUES (?, ?, ?, 'non_pagato', ?)
       ON CONFLICT (user_id, mese, anno) DO UPDATE SET piano = excluded.piano`
    )
      .bind(userId, mese, anno, piano)
      .run();
  }

  if (cambiaStato) {
    const dataPagamento = stato === "pagato" ? ora.toISOString().slice(0, 10) : null;
    // Congela il piano fatturato: se non è ancora impostato, prendi quello valido questo mese.
    const pianoFreeze = await pianoDelMese(c.env.DB, userId, anno, mese);
    await c.env.DB.prepare(
      `INSERT INTO pagamenti (user_id, mese, anno, stato, data_pagamento, piano)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, mese, anno) DO UPDATE SET
         stato = excluded.stato,
         data_pagamento = excluded.data_pagamento,
         piano = COALESCE(pagamenti.piano, excluded.piano)`
    )
      .bind(userId, mese, anno, stato, dataPagamento, pianoFreeze)
      .run();
  }

  return c.json({ ok: true });
});

export default pagamenti;
