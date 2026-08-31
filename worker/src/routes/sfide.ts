import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { awardXp } from "../lib/xp";
import { salvaFoto } from "../lib/storage";
import { inizioSettimana } from "../lib/settimana";
import { snapshotProgressione, segnalaAvanzamento } from "../lib/progressione";
import { stagioneDi, verificaEAssegnaTrofeo, statoTrofei } from "../lib/trofei";
import { verificaTraguardi, verificaBonusMese, criterioValido } from "../lib/traguardi";
import { adessoRoma } from "../lib/oggi";

type Variables = { user: SessionUser };
const sfide = new Hono<{ Bindings: Env; Variables: Variables }>();

const PERIODI = ["settimana", "mese", "totale"] as const;
type Periodo = (typeof PERIODI)[number];

// Classifiche multiple (brief, sezione 10) — Settimana/Mese/Totale per ora; Season e
// Improvement (basata sul miglioramento personale, non sui punti totali) restano da fare.
//
// Ogni riga porta anche `variazione`: di quante posizioni l'atleta è salito (valore > 0,
// freccia verde) o sceso (< 0, freccia rossa) rispetto al periodo PRECEDENTE comparabile
// — settimana scorsa, mese scorso, o (per "totale") la classifica cumulativa com'era
// all'inizio di questa settimana. `null` per chi non era ancora in classifica allora.
sfide.get("/classifica", requireAuth, async (c) => {
  const richiesto = c.req.query("periodo");
  const periodo: Periodo = PERIODI.includes(richiesto as Periodo) ? (richiesto as Periodo) : "mese";

  const oggi = adessoRoma();
  const primoDelMese = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;

  // Finestra corrente [minCorr, +∞) e finestra precedente [minPrec, maxPrec).
  let minCorr: string | null = null;
  let minPrec: string | null = null;
  let maxPrec: string | null = null;
  if (periodo === "settimana") {
    const inizio = inizioSettimana(oggi);
    minCorr = inizio.toISOString().slice(0, 10);
    const inizioPrec = new Date(inizio);
    inizioPrec.setUTCDate(inizioPrec.getUTCDate() - 7);
    minPrec = inizioPrec.toISOString().slice(0, 10);
    maxPrec = minCorr;
  } else if (periodo === "mese") {
    minCorr = primoDelMese(oggi);
    minPrec = primoDelMese(new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() - 1, 1)));
    maxPrec = minCorr;
  } else {
    // totale: corrente = tutto, precedente = cumulativo fino all'inizio di questa settimana
    maxPrec = inizioSettimana(oggi).toISOString().slice(0, 10);
  }

  const classificaPer = async (min: string | null, max: string | null) => {
    const condizioni: string[] = [];
    const bind: string[] = [];
    if (min) {
      condizioni.push("x.data >= ?");
      bind.push(min);
    }
    if (max) {
      condizioni.push("x.data < ?");
      bind.push(max);
    }
    const filtro = condizioni.length ? `AND ${condizioni.join(" AND ")}` : "";
    const { results } = await c.env.DB.prepare(
      `SELECT u.id AS userId, p.nome, p.nickname, p.foto_url AS fotoUrl,
              COALESCE(SUM(x.xp_assegnati), 0) AS punti
       FROM users u
       JOIN athlete_profile p ON p.user_id = u.id
       LEFT JOIN xp_log x ON x.user_id = u.id ${filtro}
       GROUP BY u.id
       ORDER BY punti DESC, p.nome ASC`
    )
      .bind(...bind)
      .all<{ userId: number; nome: string; nickname: string | null; fotoUrl: string | null; punti: number }>();
    return results;
  };

  // Posizione "sportiva" (1, 2, 2, 4): a parità di punti stessa posizione.
  const posizioni = (righe: { userId: number; punti: number }[]) => {
    const mappa = new Map<number, number>();
    let puntiPrec: number | null = null;
    let posPrec = 0;
    righe.forEach((r, i) => {
      const pos = r.punti === puntiPrec ? posPrec : i + 1;
      mappa.set(r.userId, pos);
      puntiPrec = r.punti;
      posPrec = pos;
    });
    return mappa;
  };

  const [corrente, precedente] = await Promise.all([
    classificaPer(minCorr, null),
    classificaPer(minPrec, maxPrec),
  ]);

  const posCorrente = posizioni(corrente);
  const posPrecedente = posizioni(precedente);
  const puntiPrecedente = new Map(precedente.map((r) => [r.userId, r.punti]));

  const classifica = corrente.map((r) => {
    // Freccia solo per chi ha davvero punti in questo periodo ed era già a punti in quello
    // precedente — altrimenti (tutti a 0 a inizio settimana) la classifica è un mucchio di
    // pari merito e le frecce diventano rumore.
    const confrontabile = r.punti > 0 && (puntiPrecedente.get(r.userId) ?? 0) > 0;
    const variazione = confrontabile
      ? (posPrecedente.get(r.userId) ?? 0) - (posCorrente.get(r.userId) ?? 0)
      : null;
    return { ...r, posizione: posCorrente.get(r.userId) ?? 0, variazione };
  });

  return c.json({ classifica, periodo });
});

sfide.get("/", requireAuth, async (c) => {
  // Il coach può creare sfide in anticipo (es. tutta la settimana la domenica prima) —
  // restano bloccate agli atleti finché data_inizio non arriva, stesso principio anti-spoiler
  // già applicato al Programma mensile.
  const isCoach = c.var.user.role === "coach";
  const oggi = adessoRoma().toISOString().slice(0, 10);

  // Aprendo le Sfide l'atleta fa scattare le "traguardo" già maturate.
  if (!isCoach) await verificaTraguardi(c.env.DB, c.var.user.userId);

  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.titolo, s.descrizione, s.tipo, s.criterio, s.punti, s.flash, s.data_inizio, s.data_fine,
            EXISTS(SELECT 1 FROM partecipazioni_sfide p WHERE p.sfida_id = s.id AND p.user_id = ?) AS partecipato,
            (SELECT COUNT(*) FROM partecipazioni_sfide p WHERE p.sfida_id = s.id) AS numeroPartecipanti
     FROM sfide s
     ${isCoach ? "" : `WHERE (s.data_inizio <= ? OR substr(s.data_inizio, 1, 7) IN
       (SELECT printf('%04d-%02d', anno, mese) FROM programma_mensile WHERE pubblicato = 1))`}
     ORDER BY s.data_fine DESC`
  )
    .bind(...(isCoach ? [c.var.user.userId] : [c.var.user.userId, oggi]))
    .all();

  return c.json({ sfide: results });
});

sfide.post("/:id/partecipa", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") {
    return c.json({ error: "Solo gli atleti possono partecipare alle sfide" }, 403);
  }

  const sfidaId = Number(c.req.param("id"));

  const sfida = await c.env.DB.prepare(
    `SELECT id, titolo, tipo, punti, flash, data_inizio, data_fine FROM sfide WHERE id = ?`
  )
    .bind(sfidaId)
    .first<{ id: number; titolo: string; tipo: string; punti: number; flash: number; data_inizio: string; data_fine: string }>();
  if (!sfida) return c.json({ error: "Sfida non trovata" }, 404);
  if (sfida.tipo === "traguardo") {
    return c.json({ error: "Questa sfida si completa da sola quando raggiungi il traguardo" }, 400);
  }

  const oggi = adessoRoma().toISOString().slice(0, 10);
  if (sfida.data_fine < oggi) return c.json({ error: "Sfida terminata" }, 400);

  const esistente = await c.env.DB.prepare(`SELECT id FROM partecipazioni_sfide WHERE sfida_id = ? AND user_id = ?`)
    .bind(sfidaId, c.var.user.userId)
    .first();
  if (esistente) return c.json({ error: "Hai già partecipato a questa sfida" }, 409);

  // Le sfide foto vanno convalidate con una foto — niente autocertificazione.
  const body = await c.req.parseBody();
  const foto = body.foto instanceof File ? body.foto : null;
  const valore = typeof body.valore === "string" ? body.valore : null;

  if (sfida.tipo === "foto" && !foto) {
    return c.json({ error: "Questa sfida richiede una foto per essere convalidata" }, 400);
  }

  const fotoUrl = foto ? await salvaFoto(c.env.FOTO_SFIDE, "sfide", foto) : null;

  const prima = await snapshotProgressione(c.env.DB, c.var.user.userId);

  await c.env.DB.prepare(
    `INSERT INTO partecipazioni_sfide (sfida_id, user_id, valore, foto_url, data, punti_assegnati) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(sfidaId, c.var.user.userId, valore, fotoUrl, oggi, sfida.punti)
    .run();

  await awardXp(c.env.DB, c.var.user.userId, "sfida", sfida.punti, sfida.id);

  // Ogni sfida completata finisce nel Feed (scelta di Francesca, 31 ago): quelle foto con
  // la foto, le altre (presenza/valore_manuale) solo col titolo; le "lampo" col prefisso ⚡.
  // I traguardi automatici pubblicano da lib/traguardi.ts.
  await c.env.DB.prepare(`INSERT INTO post_feed (user_id, tipo, contenuto_url, testo) VALUES (?, 'sfida', ?, ?)`)
    .bind(c.var.user.userId, fotoUrl, sfida.flash ? `⚡ ${sfida.titolo}` : sfida.titolo)
    .run();

  // Completare una sfida chiude l'anello CHALLENGES del mese, che può chiudere una
  // settimana (e far salire di livello) — non solo confermare la presenza.
  const dopo = await snapshotProgressione(c.env.DB, c.var.user.userId);
  await segnalaAvanzamento(c.env.DB, c.var.user.userId, prima, dopo);

  // Se questa era l'ultima sfida mancante del blocco di stagione (Set–Dic o Gen–Lug),
  // assegna il trofeo corrispondente.
  const blocco = stagioneDi(sfida.data_inizio);
  if (blocco) {
    await verificaEAssegnaTrofeo(c.env.DB, c.var.user.userId, blocco.stagione, blocco.blocco);
  }

  // Bonus se questa era l'ultima sfida mancante del mese.
  await verificaBonusMese(c.env.DB, c.var.user.userId, sfida.data_inizio.slice(0, 7));

  return c.json({ ok: true });
});

// Stato dei 2 trofei di stagione dell'atleta (Set–Dic / Gen–Lug) — pagina Sfide + Profilo.
sfide.get("/trofei", requireAuth, async (c) => {
  return c.json({ trofei: await statoTrofei(c.env.DB, c.var.user.userId) });
});

// Creazione sfida — riservata al coach (brief, sezione 15).
sfide.post("/", requireCoach, async (c) => {
  const body = await c.req.json<{
    titolo?: string;
    descrizione?: string;
    tipo?: string;
    criterio?: string;
    flash?: boolean | number;
    data_inizio?: string;
    data_fine?: string;
  }>();
  const { titolo, descrizione, tipo, criterio, data_inizio, data_fine } = body;
  const flash = body.flash ? 1 : 0;

  if (!titolo || !tipo || !data_inizio || !data_fine) {
    return c.json({ error: "Titolo, tipo, data_inizio e data_fine sono obbligatori" }, 400);
  }
  if (!["presenza", "foto", "valore_manuale", "traguardo"].includes(tipo)) {
    return c.json({ error: "Tipo sfida non valido" }, 400);
  }
  if (tipo === "traguardo" && (!criterio || !criterioValido(criterio))) {
    return c.json({ error: "Criterio del traguardo mancante o non valido" }, 400);
  }
  if (data_fine < data_inizio) {
    return c.json({ error: "La data di fine è prima di quella di inizio" }, 400);
  }

  // Ogni sfida completata vale 10 punti fissi (sistema punti 2026-08) — non più deciso dal coach.
  const PUNTI_SFIDA = 10;
  const result = await c.env.DB.prepare(
    `INSERT INTO sfide (titolo, descrizione, tipo, criterio, punti, flash, data_inizio, data_fine)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      titolo,
      descrizione ?? null,
      tipo,
      tipo === "traguardo" ? criterio : null,
      PUNTI_SFIDA,
      flash,
      data_inizio,
      data_fine
    )
    .run();

  return c.json({ id: result.meta.last_row_id }, 201);
});

// Eliminazione sfida dalla dashboard coach — cancella anche partecipazioni, punti e post nel
// Feed collegati (la classifica si ricalcola da xp_log). Scelta di Francesca (ago 2026).
sfide.delete("/:id", requireCoach, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "ID sfida non valido" }, 400);

  const sfida = await c.env.DB.prepare(`SELECT titolo, flash FROM sfide WHERE id = ?`)
    .bind(id)
    .first<{ titolo: string; flash: number }>();
  if (!sfida) return c.json({ error: "Sfida non trovata" }, 404);

  const { results: parti } = await c.env.DB.prepare(
    `SELECT user_id AS userId, COUNT(*) AS n, COALESCE(SUM(punti_assegnati), 0) AS punti
     FROM partecipazioni_sfide WHERE sfida_id = ? GROUP BY user_id`
  )
    .bind(id)
    .all<{ userId: number; n: number; punti: number }>();
  const puntiRimossi = parti.reduce((tot, p) => tot + p.punti, 0);

  // 1. Post nel Feed di questa sfida (match per titolo, con/senza prefisso ⚡, e utenti coinvolti).
  if (parti.length) {
    const ph = parti.map(() => "?").join(",");
    await c.env.DB.prepare(
      `DELETE FROM post_feed WHERE tipo = 'sfida' AND testo IN (?, ?) AND user_id IN (${ph})`
    )
      .bind(sfida.titolo, `⚡ ${sfida.titolo}`, ...parti.map((p) => p.userId))
      .run();
  }

  // 2. Punti: via xp_log.sfida_id (esatto). Fallback per le sfide create prima della 0029
  //    (sfida_id NULL): per ogni partecipante, tolgo le righe 'sfida' generiche mancanti.
  const { results: xpLinkati } = await c.env.DB.prepare(
    `SELECT user_id AS userId, COUNT(*) AS n FROM xp_log WHERE sfida_id = ? GROUP BY user_id`
  )
    .bind(id)
    .all<{ userId: number; n: number }>();
  const linkatiPerUtente = new Map(xpLinkati.map((r) => [r.userId, r.n]));

  await c.env.DB.prepare(`DELETE FROM xp_log WHERE sfida_id = ?`).bind(id).run();

  for (const p of parti) {
    const daTogliere = p.n - (linkatiPerUtente.get(p.userId) ?? 0);
    if (daTogliere > 0) {
      await c.env.DB.prepare(
        `DELETE FROM xp_log WHERE id IN (
           SELECT id FROM xp_log WHERE user_id = ? AND azione = 'sfida' AND sfida_id IS NULL
           ORDER BY id DESC LIMIT ?
         )`
      )
        .bind(p.userId, daTogliere)
        .run();
    }
  }

  // 3. Partecipazioni + 4. sfida.
  await c.env.DB.prepare(`DELETE FROM partecipazioni_sfide WHERE sfida_id = ?`).bind(id).run();
  await c.env.DB.prepare(`DELETE FROM sfide WHERE id = ?`).bind(id).run();

  return c.json({ ok: true, puntiRimossi, atletiCoinvolti: parti.length });
});

export default sfide;
