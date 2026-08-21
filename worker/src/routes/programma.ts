import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";

type Variables = { user: SessionUser };
const programma = new Hono<{ Bindings: Env; Variables: Variables }>();

// Mesi futuri bloccati, niente spoiler sul programma (brief, sezione 9) — applicato
// server-side, non solo nascosto in UI (come richiesto per i dati privati, sezione 3).
function meseCorrente(): { mese: number; anno: number } {
  const now = new Date();
  return { mese: now.getUTCMonth() + 1, anno: now.getUTCFullYear() };
}

function sbloccato(mese: number, anno: number): boolean {
  const c = meseCorrente();
  return anno < c.anno || (anno === c.anno && mese <= c.mese);
}

programma.get("/", requireAuth, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, mese, anno, focus_tema AS focusTema FROM programma_mensile ORDER BY anno, mese`
  ).all<{ id: number; mese: number; anno: number; focusTema: string | null }>();

  const mesi = results.map((r) => {
    const sblocc = sbloccato(r.mese, r.anno);
    return { id: r.id, mese: r.mese, anno: r.anno, sbloccato: sblocc, focusTema: sblocc ? r.focusTema : null };
  });

  return c.json({ mesi });
});

programma.get("/:id", requireAuth, async (c) => {
  const id = Number(c.req.param("id"));
  const mese = await c.env.DB.prepare(
    `SELECT id, mese, anno, focus_tema AS focusTema, descrizione, linee_guida_nutrizionali AS lineeGuidaNutrizionali
     FROM programma_mensile WHERE id = ?`
  )
    .bind(id)
    .first<{
      id: number;
      mese: number;
      anno: number;
      focusTema: string | null;
      descrizione: string | null;
      lineeGuidaNutrizionali: string | null;
    }>();

  if (!mese) return c.json({ error: "Mese non trovato" }, 404);
  if (!sbloccato(mese.mese, mese.anno)) return c.json({ error: "Questo mese non è ancora disponibile" }, 403);

  const { results: merende } = await c.env.DB.prepare(
    `SELECT titolo, descrizione, link_url AS linkUrl FROM merende_fit WHERE programma_id = ? ORDER BY ordine`
  )
    .bind(id)
    .all<{ titolo: string; descrizione: string | null; linkUrl: string | null }>();

  return c.json({ ...mese, merende });
});

// Gestione Focus del mese / Merende fit — riservata al coach (brief, sezione 15).
programma.post("/", requireCoach, async (c) => {
  const body = await c.req.json<{
    mese?: number;
    anno?: number;
    focusTema?: string;
    descrizione?: string;
    lineeGuidaNutrizionali?: string;
    merende?: { titolo: string; descrizione?: string; linkUrl?: string }[];
  }>();
  const { mese, anno, focusTema, descrizione, lineeGuidaNutrizionali, merende } = body;

  if (!mese || !anno) return c.json({ error: "Mese e anno sono obbligatori" }, 400);

  // Upsert parziale: un campo omesso nella richiesta lascia invariato il valore esistente
  // (COALESCE), invece di svuotarlo — utile quando in futuro un form aggiorna un campo alla volta.
  await c.env.DB.prepare(
    `INSERT INTO programma_mensile (mese, anno, focus_tema, descrizione, linee_guida_nutrizionali)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (mese, anno) DO UPDATE SET
       focus_tema = COALESCE(excluded.focus_tema, programma_mensile.focus_tema),
       descrizione = COALESCE(excluded.descrizione, programma_mensile.descrizione),
       linee_guida_nutrizionali = COALESCE(excluded.linee_guida_nutrizionali, programma_mensile.linee_guida_nutrizionali)`
  )
    .bind(mese, anno, focusTema ?? null, descrizione ?? null, lineeGuidaNutrizionali ?? null)
    .run();

  const programmaId = await c.env.DB.prepare(`SELECT id FROM programma_mensile WHERE mese = ? AND anno = ?`)
    .bind(mese, anno)
    .first<{ id: number }>();

  if (merende && programmaId) {
    await c.env.DB.prepare(`DELETE FROM merende_fit WHERE programma_id = ?`).bind(programmaId.id).run();
    for (const [i, m] of merende.entries()) {
      await c.env.DB.prepare(
        `INSERT INTO merende_fit (programma_id, titolo, descrizione, ordine, link_url) VALUES (?, ?, ?, ?, ?)`
      )
        .bind(programmaId.id, m.titolo, m.descrizione ?? null, i, m.linkUrl ?? null)
        .run();
    }
  }

  return c.json({ id: programmaId?.id }, 201);
});

export default programma;
