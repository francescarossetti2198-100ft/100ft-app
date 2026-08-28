import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { oggi, sessioneOggi } from "../lib/oggi";

const CATEGORIE = ["Mobilità", "Gambe", "Parte superiore", "Altro"] as const;

type Variables = { user: SessionUser };
const richieste = new Hono<{ Bindings: Env; Variables: Variables }>();

// Chiudono alle 13:00 del giorno della sessione (brief, sezione 3) — stessa semplificazione
// sul fuso orario (UTC del Worker) già segnalata in lib/oggi.ts.
function apertoFinoAlle13(): boolean {
  return new Date().getUTCHours() < 13;
}

// Vista pubblica CON i nomi: ogni atleta vede cosa ha chiesto ciascun altro per la sessione
// di oggi (scelta esplicita di Francesca — supera la nota del brief sez. 7 che le voleva
// anonime). La vista coach dedicata resta comunque (/oggi/coach).
richieste.get("/oggi", requireAuth, async (c) => {
  const sessione = await sessioneOggi(c.env.DB);
  if (!sessione) return c.json({ sessione: null, aperte: false, inviata: false, richieste: [] });

  const { data } = oggi();
  const [mia, elenco] = await Promise.all([
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
  ]);

  return c.json({
    sessione,
    aperte: apertoFinoAlle13(),
    inviata: !!mia,
    richieste: elenco.results,
  });
});

richieste.post("/", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti possono inviare richieste" }, 403);
  if (!apertoFinoAlle13()) return c.json({ error: "Le richieste sono chiuse per oggi" }, 400);

  const sessione = await sessioneOggi(c.env.DB);
  if (!sessione) return c.json({ error: "Nessuna sessione oggi" }, 400);

  const body = await c.req.json<{ categoria?: string; testoLibero?: string }>();
  const categoria =
    body.categoria && (CATEGORIE as readonly string[]).includes(body.categoria) ? body.categoria : null;
  const testoLibero = body.testoLibero?.trim() || null;
  if (!categoria && !testoLibero) return c.json({ error: "Scegli una categoria o scrivi una richiesta" }, 400);

  const { data } = oggi();
  const esistente = await c.env.DB.prepare(
    `SELECT id FROM richieste_preallenamento WHERE user_id = ? AND sessione_id = ? AND data_sessione = ?`
  )
    .bind(c.var.user.userId, sessione.id, data)
    .first();
  if (esistente) return c.json({ error: "Hai già inviato una richiesta per oggi" }, 409);

  await c.env.DB.prepare(
    `INSERT INTO richieste_preallenamento (user_id, sessione_id, categoria, testo_libero, data_sessione)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(c.var.user.userId, sessione.id, categoria, testoLibero, data)
    .run();

  return c.json({ ok: true }, 201);
});

// Vista coach: elenco con nomi — non ha ancora una schermata dedicata (Coach Dashboard
// non costruita), ma l'endpoint è pronto.
richieste.get("/oggi/coach", requireCoach, async (c) => {
  const sessione = await sessioneOggi(c.env.DB);
  if (!sessione) return c.json({ richieste: [] });

  const { data } = oggi();
  const { results } = await c.env.DB.prepare(
    `SELECT p.nome, p.nickname, r.categoria, r.testo_libero AS testoLibero, r.creata_il AS creataIl
     FROM richieste_preallenamento r
     JOIN athlete_profile p ON p.user_id = r.user_id
     WHERE r.sessione_id = ? AND r.data_sessione = ?
     ORDER BY r.creata_il`
  )
    .bind(sessione.id, data)
    .all();

  return c.json({ richieste: results });
});

export default richieste;
