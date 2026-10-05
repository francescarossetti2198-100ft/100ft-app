import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { parseFotoPersonalizzazione } from "../lib/fotoPersonalizzazione";

type Variables = { user: SessionUser };
const atletaMese = new Hono<{ Bindings: Env; Variables: Variables }>();

// Albo d'oro "Atleta del mese" — storico completo, più recente prima. `attuale` è il primo
// elemento (il mese più di recente assegnato), per mostrare il badge di chi lo detiene ora.
atletaMese.get("/", requireAuth, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT a.mese, a.anno, a.punti, u.id AS userId, p.nome, p.nickname,
            p.foto_url AS fotoUrl, p.foto_personalizzazione AS fotoPersonalizzazione
     FROM atleta_del_mese a
     JOIN users u ON u.id = a.user_id
     LEFT JOIN athlete_profile p ON p.user_id = u.id
     ORDER BY a.anno DESC, a.mese DESC, a.punti DESC`
  ).all<{
    mese: number;
    anno: number;
    punti: number;
    userId: number;
    nome: string | null;
    nickname: string | null;
    fotoUrl: string | null;
    fotoPersonalizzazione: string | null;
  }>();

  const perMese = new Map<string, { mese: number; anno: number; vincitori: unknown[] }>();
  for (const r of results) {
    const chiave = `${r.anno}-${r.mese}`;
    if (!perMese.has(chiave)) perMese.set(chiave, { mese: r.mese, anno: r.anno, vincitori: [] });
    perMese.get(chiave)!.vincitori.push({
      userId: r.userId,
      nome: r.nome,
      nickname: r.nickname,
      fotoUrl: r.fotoUrl,
      fotoPersonalizzazione: parseFotoPersonalizzazione(r.fotoPersonalizzazione),
      punti: r.punti,
    });
  }

  const storico = [...perMese.values()];
  return c.json({ attuale: storico[0] ?? null, storico });
});

export default atletaMese;
