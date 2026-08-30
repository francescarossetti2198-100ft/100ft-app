import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth } from "../middleware/auth";
import { calcolaLivello } from "../lib/livelli";
import { calcolaAnelli, sessioniSettimanaConStato } from "../lib/settimana";
import { salvaFoto } from "../lib/storage";
import { parseRisposte, validaRisposte } from "../lib/questionario";
import { statoTrofei } from "../lib/trofei";
import { verificaTraguardi } from "../lib/traguardi";

type Variables = { user: SessionUser };
const profilo = new Hono<{ Bindings: Env; Variables: Variables }>();

// YYYY-MM-DD, data reale e nel passato.
function dataNascitaValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

profilo.get("/me", requireAuth, async (c) => {
  const userId = c.var.user.userId;

  // Profilo coach: niente livello/scala/achievements (la coach non si allena) — il tab
  // Profilo per lei è lo STATO ABBONAMENTI (vedi GET /atleti). Serve però la foto profilo:
  // vale anche per la coach ed è mostrata in classifica accanto al nome.
  if (c.var.user.role === "coach") {
    const row = await c.env.DB.prepare(`SELECT foto_url AS fotoUrl FROM athlete_profile WHERE user_id = ?`)
      .bind(userId)
      .first<{ fotoUrl: string | null }>();
    return c.json({ role: "coach" as const, fotoUrl: row?.fotoUrl ?? null });
  }

  // Le sfide "traguardo" (completa profilo, obiettivi, ecc.) scattano anche solo aprendo
  // il Profilo, senza passare dalla pagina Sfide.
  await verificaTraguardi(c.env.DB, userId);

  // Abbonamento = pagamento segnato dalla coach per il MESE corrente (stessa chiave
  // di POST /api/pagamenti). Nessuna riga = non attivo.
  const oraAbb = new Date();
  const meseAbb = oraAbb.getUTCMonth() + 1;
  const annoAbb = oraAbb.getUTCFullYear();

  const [profiloRow, datiPrivatiRow, anelli, sfideCompletate, presenzeTotali, milestones, sessioniSettimana, posizione, trofei, pagamento] = await Promise.all([
    c.env.DB.prepare(
      `SELECT nome, cognome, nickname, foto_url AS fotoUrl, data_nascita AS dataNascita, card_colore AS cardColore
       FROM athlete_profile WHERE user_id = ?`
    )
      .bind(userId)
      .first<{ nome: string; cognome: string; nickname: string | null; fotoUrl: string | null; dataNascita: string | null; cardColore: string | null }>(),
    c.env.DB.prepare(
      `SELECT peso, altezza, note_infortuni AS noteInfortuni, personalizzazione
       FROM athlete_private WHERE user_id = ?`
    )
      .bind(userId)
      .first<{ peso: number | null; altezza: number | null; noteInfortuni: string | null; personalizzazione: string | null }>(),
    calcolaAnelli(c.env.DB, userId),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM partecipazioni_sfide WHERE user_id = ?`).bind(userId).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM presenze WHERE user_id = ? AND confermata = 1`).bind(userId).first<{ n: number }>(),
    c.env.DB.prepare(`SELECT tipo, data_raggiunta AS dataRaggiunta FROM milestones WHERE user_id = ? ORDER BY data_raggiunta`)
      .bind(userId)
      .all<{ tipo: string; dataRaggiunta: string }>(),
    sessioniSettimanaConStato(c.env.DB, userId),
    // Posizione nella classifica Totale (stessa logica di GET /sfide/classifica?periodo=totale,
    // senza filtro data) — a parità di punti si condivide la stessa posizione.
    c.env.DB.prepare(
      `WITH punti_atleti AS (
         SELECT u.id AS userId, COALESCE(SUM(x.xp_assegnati), 0) AS punti
         FROM users u
         JOIN athlete_profile p ON p.user_id = u.id
         LEFT JOIN xp_log x ON x.user_id = u.id
         WHERE u.role = 'atleta' AND u.status = 'attivo'
         GROUP BY u.id
       )
       SELECT (SELECT COUNT(*) FROM punti_atleti WHERE punti > mio.punti) + 1 AS posizione,
              (SELECT COUNT(*) FROM punti_atleti) AS totaleAtleti,
              mio.punti AS punti
       FROM punti_atleti mio WHERE mio.userId = ?`
    )
      .bind(userId)
      .first<{ posizione: number; totaleAtleti: number; punti: number }>(),
    statoTrofei(c.env.DB, userId),
    c.env.DB.prepare(`SELECT stato FROM pagamenti WHERE user_id = ? AND mese = ? AND anno = ?`)
      .bind(userId, meseAbb, annoAbb)
      .first<{ stato: string }>(),
  ]);

  return c.json({
    nome: profiloRow?.nome ?? null,
    cognome: profiloRow?.cognome ?? null,
    nickname: profiloRow?.nickname ?? null,
    fotoUrl: profiloRow?.fotoUrl ?? null,
    cardColore: profiloRow?.cardColore ?? null,
    // Dati privati (solo l'atleta stesso e la coach) — vedi anche GET /api/atleti/:id.
    dataNascita: profiloRow?.dataNascita ?? null,
    datiPrivati: {
      peso: datiPrivatiRow?.peso ?? null,
      altezza: datiPrivatiRow?.altezza ?? null,
      noteInfortuni: datiPrivatiRow?.noteInfortuni ?? null,
      personalizzazione: parseRisposte(datiPrivatiRow?.personalizzazione),
    },
    role: c.var.user.role,
    anelli,
    livello: calcolaLivello(presenzeTotali?.n ?? 0),
    puntiTotali: posizione?.punti ?? 0,
    classificaTotale: { posizione: posizione?.posizione ?? 1, totaleAtleti: posizione?.totaleAtleti ?? 0 },
    sfideCompletate: sfideCompletate?.n ?? 0,
    presenzeTotali: presenzeTotali?.n ?? 0,
    trofei,
    milestones: milestones.results,
    sessioniSettimana,
    abbonamentoAttivo: pagamento?.stato === "pagato",
  });
});

// Dati modificabili dall'atleta dal suo Profilo: nickname + anagrafica privata
// (data di nascita, peso, altezza, note infortuni) + risposte al questionario.
// Salvataggio parziale: i campi non presenti nel body restano invariati.
profilo.post("/me", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo per gli atleti" }, 403);
  const userId = c.var.user.userId;

  const body = await c.req.json<{
    nickname?: string | null;
    nome?: string | null;
    cognome?: string | null;
    cardColore?: string | null;
    dataNascita?: string | null;
    peso?: number | null;
    altezza?: number | null;
    noteInfortuni?: string | null;
    personalizzazione?: unknown;
  }>();

  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);

  // Palette fissa di brand per l'accento delle card del Profilo (6 livelli + accent).
  // Deve restare allineata a COLORI_CARD in frontend/src/pages/profilo.js.
  const COLORI_CARD = ["#8b5cf6", "#8bc53f", "#2d7dd2", "#f4b740", "#ff7a29", "#e63946", "#a85cff"];

  // --- validazioni sui soli campi presenti ---
  if (has("nome") && (body.nome == null || String(body.nome).trim() === "" || String(body.nome).trim().length > 60)) {
    return c.json({ error: "Nome non valido (1–60 caratteri)" }, 400);
  }
  if (has("cognome") && (body.cognome == null || String(body.cognome).trim() === "" || String(body.cognome).trim().length > 60)) {
    return c.json({ error: "Cognome non valido (1–60 caratteri)" }, 400);
  }
  if (has("cardColore") && body.cardColore != null && !COLORI_CARD.includes(String(body.cardColore))) {
    return c.json({ error: "Colore non valido" }, 400);
  }
  if (has("dataNascita") && body.dataNascita != null && !dataNascitaValida(String(body.dataNascita))) {
    return c.json({ error: "Data di nascita non valida" }, 400);
  }
  if (has("peso") && body.peso != null && (!Number.isFinite(body.peso) || body.peso < 20 || body.peso > 300)) {
    return c.json({ error: "Peso non valido (20–300 kg)" }, 400);
  }
  if (has("altezza") && body.altezza != null && (!Number.isFinite(body.altezza) || body.altezza < 100 || body.altezza > 250)) {
    return c.json({ error: "Altezza non valida (100–250 cm)" }, 400);
  }
  if (has("noteInfortuni") && body.noteInfortuni != null && String(body.noteInfortuni).length > 1000) {
    return c.json({ error: "Note troppo lunghe (max 1000 caratteri)" }, 400);
  }
  if (has("personalizzazione") && !validaRisposte(body.personalizzazione)) {
    return c.json({ error: "Risposte non valide" }, 400);
  }

  // --- athlete_profile: nickname, nome, cognome, colore card, data di nascita ---
  if (has("nickname") || has("nome") || has("cognome") || has("cardColore") || has("dataNascita")) {
    // nickname: stringa vuota -> null (rimuove il nickname). nome/cognome: già
    // validati non vuoti sopra. cardColore: null ammesso (torna al default tema).
    const nickname = has("nickname") ? (String(body.nickname ?? "").trim() || null) : undefined;
    const nome = has("nome") ? String(body.nome).trim() : undefined;
    const cognome = has("cognome") ? String(body.cognome).trim() : undefined;
    const dataNascita = has("dataNascita") ? (body.dataNascita || null) : undefined;

    await c.env.DB.prepare(
      `UPDATE athlete_profile
       SET nickname = CASE WHEN ? THEN ? ELSE nickname END,
           nome = COALESCE(?, nome),
           cognome = COALESCE(?, cognome),
           card_colore = CASE WHEN ? THEN ? ELSE card_colore END,
           data_nascita = COALESCE(?, data_nascita)
       WHERE user_id = ?`
    )
      .bind(
        has("nickname") ? 1 : 0,
        nickname ?? null,
        nome ?? null,
        cognome ?? null,
        has("cardColore") ? 1 : 0,
        has("cardColore") ? (body.cardColore ?? null) : null,
        dataNascita ?? null,
        userId
      )
      .run();
  }

  // --- athlete_private: merge con la riga esistente ---
  if (has("peso") || has("altezza") || has("noteInfortuni") || has("personalizzazione")) {
    const esistente = await c.env.DB.prepare(
      `SELECT peso, altezza, note_infortuni AS noteInfortuni, personalizzazione
       FROM athlete_private WHERE user_id = ?`
    )
      .bind(userId)
      .first<{ peso: number | null; altezza: number | null; noteInfortuni: string | null; personalizzazione: string | null }>();

    const peso = has("peso") ? (body.peso ?? null) : esistente?.peso ?? null;
    const altezza = has("altezza") ? (body.altezza ?? null) : esistente?.altezza ?? null;
    const noteInfortuni = has("noteInfortuni")
      ? (String(body.noteInfortuni ?? "").trim() || null)
      : esistente?.noteInfortuni ?? null;
    const personalizzazione = has("personalizzazione")
      ? JSON.stringify(body.personalizzazione)
      : esistente?.personalizzazione ?? null;

    await c.env.DB.prepare(
      `INSERT INTO athlete_private (user_id, peso, altezza, note_infortuni, personalizzazione)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         peso = excluded.peso,
         altezza = excluded.altezza,
         note_infortuni = excluded.note_infortuni,
         personalizzazione = excluded.personalizzazione`
    )
      .bind(userId, peso, altezza, noteInfortuni, personalizzazione)
      .run();
  }

  return c.json({ ok: true });
});

// Foto profilo — vale per atleti e coach, mostrata anche in classifica (sfide.ts).
profilo.post("/foto", requireAuth, async (c) => {
  const body = await c.req.parseBody();
  const file = body.foto instanceof File ? body.foto : null;
  if (!file) return c.json({ error: "Serve una foto" }, 400);

  const fotoUrl = await salvaFoto(c.env.FOTO_SFIDE, "profilo", file);

  await c.env.DB.prepare(
    `INSERT INTO athlete_profile (user_id, nome, cognome, foto_url) VALUES (?, '', '', ?)
     ON CONFLICT (user_id) DO UPDATE SET foto_url = excluded.foto_url`
  )
    .bind(c.var.user.userId, fotoUrl)
    .run();

  return c.json({ ok: true, fotoUrl });
});

export default profilo;
