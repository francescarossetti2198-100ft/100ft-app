import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { oggi, sessioneOggi } from "../lib/oggi";

// Box guidati per la richiesta pre-allenamento (nuova spec Home). Niente più testo libero
// nuovo; "Altro" resta come rete di sicurezza. Deve combaciare col CHECK della 0018 e con
// frontend/src/richieste-categorie.js.
const CATEGORIE = [
  "Upper body",
  "Lower body",
  "Addome / core",
  "Mobilità",
  "Stretching",
  "Alta intensità",
  "Lavoro tecnico",
  "Propriocezione",
  "Equilibrio",
  "Isometria",
  "Altro",
] as const;

type Variables = { user: SessionUser };
const richieste = new Hono<{ Bindings: Env; Variables: Variables }>();

// Chiudono alle 13:00 del giorno della sessione (brief, sezione 3) — stessa semplificazione
// sul fuso orario (UTC del Worker) già segnalata in lib/oggi.ts.
function apertoFinoAlle13(): boolean {
  return new Date().getUTCHours() < 13;
}

// Conteggi per categoria delle richieste di oggi — quanti hanno chiesto Upper, quanti
// Lower, ecc. Visti sia dagli atleti sia dalla coach, accanto alla lista con i nomi.
async function conteggiOggi(db: D1Database, sessioneId: number, data: string) {
  const { results } = await db
    .prepare(
      `SELECT categoria, COUNT(*) AS n
       FROM richieste_preallenamento
       WHERE sessione_id = ? AND data_sessione = ? AND categoria IS NOT NULL
       GROUP BY categoria
       ORDER BY n DESC, categoria`
    )
    .bind(sessioneId, data)
    .all<{ categoria: string; n: number }>();
  return results;
}

// Vista pubblica CON i nomi + i conteggi per categoria: ogni atleta vede cosa ha chiesto
// ciascun altro per la sessione di oggi (scelta esplicita di Francesca — supera la nota del
// brief sez. 7 che le voleva anonime). La vista coach dedicata resta comunque (/oggi/coach).
richieste.get("/oggi", requireAuth, async (c) => {
  const sessione = await sessioneOggi(c.env.DB);
  if (!sessione) return c.json({ sessione: null, aperte: false, inviata: false, richieste: [], conteggi: [] });

  const { data } = oggi();
  const [mia, elenco, conteggi] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id FROM richieste_preallenamento WHERE user_id = ? AND sessione_id = ? AND data_sessione = ?`
    )
      .bind(c.var.user.userId, sessione.id, data)
      .first(),
    c.env.DB.prepare(
      `SELECT p.nome, p.nickname, r.categoria, r.testo_libero AS testoLibero
       FROM richieste_preallenamento r
       JOIN athlete_profile p ON p.user_id = r.user_id
       WHERE r.sessione_id = ? AND r.data_sessione = ?
       ORDER BY r.creata_il`
    )
      .bind(sessione.id, data)
      .all<{ nome: string; nickname: string | null; categoria: string | null; testoLibero: string | null }>(),
    conteggiOggi(c.env.DB, sessione.id, data),
  ]);

  return c.json({
    sessione,
    aperte: apertoFinoAlle13(),
    inviata: !!mia,
    richieste: elenco.results,
    conteggi,
  });
});

richieste.post("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti possono inviare richieste" }, 403);
  if (!apertoFinoAlle13()) return c.json({ error: "Le richieste sono chiuse per oggi" }, 400);

  const sessione = await sessioneOggi(c.env.DB);
  if (!sessione) return c.json({ error: "Nessuna sessione oggi" }, 400);

  const body = await c.req.json<{ categoria?: string }>();
  const categoria =
    body.categoria && (CATEGORIE as readonly string[]).includes(body.categoria) ? body.categoria : null;
  if (!categoria) return c.json({ error: "Scegli una categoria" }, 400);

  const { data } = oggi();
  const esistente = await c.env.DB.prepare(
    `SELECT id FROM richieste_preallenamento WHERE user_id = ? AND sessione_id = ? AND data_sessione = ?`
  )
    .bind(c.var.user.userId, sessione.id, data)
    .first();
  if (esistente) return c.json({ error: "Hai già inviato una richiesta per oggi" }, 409);

  await c.env.DB.prepare(
    `INSERT INTO richieste_preallenamento (user_id, sessione_id, categoria, testo_libero, data_sessione)
     VALUES (?, ?, ?, NULL, ?)`
  )
    .bind(c.var.user.userId, sessione.id, categoria, data)
    .run();

  return c.json({ ok: true }, 201);
});

// Vista coach: elenco con nomi + conteggi per categoria.
richieste.get("/oggi/coach", requireCoach, async (c) => {
  const sessione = await sessioneOggi(c.env.DB);
  if (!sessione) return c.json({ richieste: [], conteggi: [] });

  const { data } = oggi();
  const [elenco, conteggi] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.nome, p.nickname, r.categoria, r.testo_libero AS testoLibero, r.creata_il AS creataIl
       FROM richieste_preallenamento r
       JOIN athlete_profile p ON p.user_id = r.user_id
       WHERE r.sessione_id = ? AND r.data_sessione = ?
       ORDER BY r.creata_il`
    )
      .bind(sessione.id, data)
      .all(),
    conteggiOggi(c.env.DB, sessione.id, data),
  ]);

  return c.json({ richieste: elenco.results, conteggi });
});

export default richieste;
