import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireCoach } from "../middleware/auth";
import { adessoRoma } from "../lib/oggi";
import { pianoValido, nomePiano } from "../lib/abbonamentiPiani";
import { pianoDelMese } from "../lib/abbonamenti";

type Variables = { user: SessionUser };
const pagamenti = new Hono<{ Bindings: Env; Variables: Variables }>();

// Mese su cui lavorare: quello indicato (anno + mese) oppure il corrente. Niente mesi futuri:
// si può tornare indietro a correggere, non segnare in anticipo. null = parametri non validi.
function meseRichiesto(annoIn: unknown, meseIn: unknown): { anno: number; mese: number } | null {
  const ora = adessoRoma();
  const corrente = { anno: ora.getUTCFullYear(), mese: ora.getUTCMonth() + 1 };
  if (annoIn == null && meseIn == null) return corrente;
  const anno = Number(annoIn);
  const mese = Number(meseIn);
  if (!Number.isInteger(anno) || !Number.isInteger(mese) || mese < 1 || mese > 12 || anno < 2020) return null;
  if (anno * 100 + mese > corrente.anno * 100 + corrente.mese) return null;
  return { anno, mese };
}

// Elenco pagamenti di un mese (default: corrente) — la spunta della pagina Abbonamenti.
pagamenti.get("/", requireCoach, async (c) => {
  const m = meseRichiesto(c.req.query("anno"), c.req.query("mese"));
  if (!m) return c.json({ error: "Mese non valido" }, 400);
  const db = c.env.DB;

  const { results: utenti } = await db
    .prepare(
      `SELECT u.id AS userId, p.nome, p.cognome, p.nickname, pg.stato, pg.piano
       FROM users u
       JOIN athlete_profile p ON p.user_id = u.id
       LEFT JOIN pagamenti pg ON pg.user_id = u.id AND pg.mese = ? AND pg.anno = ?
       WHERE u.role = 'atleta' AND u.status = 'attivo'
       ORDER BY p.nome`
    )
    .bind(m.mese, m.anno)
    .all<{ userId: number; nome: string; cognome: string; nickname: string | null; stato: string | null; piano: string | null }>();

  const atleti = await Promise.all(
    utenti.map(async (u) => {
      const piano = u.piano ?? (await pianoDelMese(db, u.userId, m.anno, m.mese));
      return {
        userId: u.userId,
        nome: u.nome,
        cognome: u.cognome,
        nickname: u.nickname,
        pagamentoMese: u.stato ?? "non_pagato",
        piano,
        nomePiano: nomePiano(piano),
      };
    })
  );

  return c.json({ atleti, mese: m.mese, anno: m.anno });
});

// Segna il pagamento di un mese per un atleta (default: corrente; anche mesi passati, per
// correggere) — marcatura manuale della coach, nessun gateway di pagamento collegato (brief,
// sezione 14). Accetta anche `piano` per correggere il piano fatturato quel mese senza
// toccare lo stato.
pagamenti.post("/", requireCoach, async (c) => {
  const body = await c.req.json<{ userId?: number; stato?: string; piano?: string; anno?: number; mese?: number }>();
  const { userId, stato, piano } = body;

  if (!userId) return c.json({ error: "Manca userId" }, 400);
  const cambiaStato = stato === "pagato" || stato === "non_pagato";
  const cambiaPiano = typeof piano === "string";
  if (!cambiaStato && !cambiaPiano) {
    return c.json({ error: "Serve `stato` o `piano`" }, 400);
  }
  if (cambiaPiano && !pianoValido(piano!)) {
    return c.json({ error: "Piano non valido" }, 400);
  }

  const m = meseRichiesto(body.anno, body.mese);
  if (!m) return c.json({ error: "Mese non valido" }, 400);
  const { anno, mese } = m;
  const ora = adessoRoma();

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
