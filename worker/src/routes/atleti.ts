import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { calcolaLivello } from "../lib/livelli";
import { parseFotoPersonalizzazione } from "../lib/fotoPersonalizzazione";
import { hashPassword } from "../lib/password";
import { parseRisposte } from "../lib/questionario";
import { statoTrofei } from "../lib/trofei";
import { statoBadgeMensili } from "../lib/badgeMensili";
import { calcolaAnelli } from "../lib/settimana";
import { adessoRoma } from "../lib/oggi";
import { pianoDelMese, pianoProssimo } from "../lib/abbonamenti";
import { prezzoPiano, nomePiano } from "../lib/abbonamentiPiani";

// Età in anni interi da una data YYYY-MM-DD (null se manca / non valida).
function calcolaEta(dataNascita: string | null): number | null {
  if (!dataNascita || !/^\d{4}-\d{2}-\d{2}$/.test(dataNascita)) return null;
  const nascita = new Date(`${dataNascita}T00:00:00Z`);
  if (Number.isNaN(nascita.getTime())) return null;
  const oggi = new Date();
  let eta = oggi.getUTCFullYear() - nascita.getUTCFullYear();
  const m = oggi.getUTCMonth() - nascita.getUTCMonth();
  if (m < 0 || (m === 0 && oggi.getUTCDate() < nascita.getUTCDate())) eta--;
  return eta >= 0 && eta < 150 ? eta : null;
}

// Password temporanea leggibile da dettare a voce/WhatsApp: niente caratteri ambigui
// (0/O, 1/l/I). 10 caratteri -> ben oltre il minimo di 8.
function generaPasswordTemporanea(): string {
  const alfabeto = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

type Variables = { user: SessionUser };
const atleti = new Hono<{ Bindings: Env; Variables: Variables }>();

// Vista coach — sezione ATLETI della Coach Dashboard: insight per allievo (presenze recenti,
// livello, ultima reaction di feedback, ultime richieste pre-allenamento). Non esisteva prima
// nessun elenco atleti lato coach, solo le richieste del giorno.
atleti.get("/", requireCoach, async (c) => {
  const db = c.env.DB;
  const ora = adessoRoma();
  const mese = ora.getUTCMonth() + 1;
  const anno = ora.getUTCFullYear();

  const { results: utenti } = await db
    .prepare(
      `SELECT u.id AS userId, p.nome, p.cognome, p.nickname
       FROM users u JOIN athlete_profile p ON p.user_id = u.id
       WHERE u.role = 'atleta' AND u.status = 'attivo'
       ORDER BY p.nome`
    )
    .all<{ userId: number; nome: string; cognome: string; nickname: string | null }>();

  const risultato = await Promise.all(
    utenti.map(async (u) => {
      const [presenzeTotali, ultimoFeedback, richiesteRecenti, presenze4Sett, pagamento] = await Promise.all([
        db
          .prepare(`SELECT COUNT(*) AS n FROM presenze WHERE user_id = ? AND confermata = 1`)
          .bind(u.userId)
          .first<{ n: number }>(),
        db
          .prepare(`SELECT faccina, data FROM feedback_allenamento WHERE user_id = ? ORDER BY data DESC LIMIT 1`)
          .bind(u.userId)
          .first<{ faccina: number; data: string }>(),
        db
          .prepare(
            `SELECT categoria, testo_libero AS testoLibero, data_sessione AS data
             FROM richieste_preallenamento WHERE user_id = ? ORDER BY data_sessione DESC LIMIT 3`
          )
          .bind(u.userId)
          .all<{ categoria: string | null; testoLibero: string | null; data: string }>(),
        db
          .prepare(
            `SELECT COUNT(*) AS n FROM presenze WHERE user_id = ? AND confermata = 1 AND data >= date('now', '-28 days')`
          )
          .bind(u.userId)
          .first<{ n: number }>(),
        db
          .prepare(`SELECT stato, piano FROM pagamenti WHERE user_id = ? AND mese = ? AND anno = ?`)
          .bind(u.userId, mese, anno)
          .first<{ stato: string; piano: string | null }>(),
      ]);

      const piano = pagamento?.piano ?? (await pianoDelMese(db, u.userId, anno, mese));

      return {
        userId: u.userId,
        nome: u.nome,
        cognome: u.cognome,
        nickname: u.nickname,
        livello: calcolaLivello(presenzeTotali?.n ?? 0),
        presenzeUltime4Settimane: presenze4Sett?.n ?? 0,
        ultimoFeedback: ultimoFeedback ?? null,
        richiesteRecenti: richiesteRecenti.results,
        pagamentoMese: pagamento?.stato ?? "non_pagato",
        piano,
        nomePiano: nomePiano(piano),
      };
    })
  );

  return c.json({ atleti: risultato, mese, anno });
});

// Ricerca atleti per nome / cognome / nickname — barra di ricerca del Feed. Aperta a
// chiunque sia loggato (come /:id/pubblico); solo dati pubblici. DEVE stare prima di
// "/:id" (altrimenti "cerca" verrebbe interpretato come un id → requireCoach).
atleti.get("/cerca", requireAuth, async (c) => {
  const q = (c.req.query("q") ?? "").trim();
  if (q.length < 2) return c.json({ atleti: [] });

  const like = `%${q}%`;
  const { results } = await c.env.DB.prepare(
    `SELECT u.id AS userId, p.nome, p.cognome, p.nickname,
            p.foto_url AS fotoUrl, p.foto_personalizzazione AS fotoPersonalizzazione
     FROM users u
     JOIN athlete_profile p ON p.user_id = u.id
     WHERE u.role = 'atleta' AND u.status = 'attivo'
       AND (p.nome LIKE ? OR p.cognome LIKE ? OR p.nickname LIKE ?
            OR (p.nome || ' ' || p.cognome) LIKE ?)
     ORDER BY p.nome, p.cognome
     LIMIT 12`
  )
    .bind(like, like, like, like)
    .all<{
      userId: number;
      nome: string;
      cognome: string;
      nickname: string | null;
      fotoUrl: string | null;
      fotoPersonalizzazione: string | null;
    }>();

  return c.json({
    atleti: results.map((r) => ({
      ...r,
      fotoPersonalizzazione: parseFotoPersonalizzazione(r.fotoPersonalizzazione),
    })),
  });
});

// Scheda completa di un atleta — pagina PROFILI della coach. Include i dati privati
// (anagrafica + questionario) che NON sono mai esposti alle API rivolte ad altri atleti.
atleti.get("/:id", requireCoach, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "ID atleta non valido" }, 400);
  const db = c.env.DB;

  const anagraficaRow = await db
    .prepare(
      `SELECT p.nome, p.cognome, p.nickname, p.foto_url AS fotoUrl, p.data_nascita AS dataNascita,
              p.data_iscrizione AS dataIscrizione,
              a.peso, a.altezza, a.note_infortuni AS noteInfortuni, a.personalizzazione
       FROM users u
       JOIN athlete_profile p ON p.user_id = u.id
       LEFT JOIN athlete_private a ON a.user_id = u.id
       WHERE u.id = ? AND u.role = 'atleta'`
    )
    .bind(id)
    .first<{
      nome: string;
      cognome: string;
      nickname: string | null;
      fotoUrl: string | null;
      dataNascita: string | null;
      dataIscrizione: string | null;
      peso: number | null;
      altezza: number | null;
      noteInfortuni: string | null;
      personalizzazione: string | null;
    }>();

  if (!anagraficaRow) return c.json({ error: "Atleta non trovato" }, 404);

  const ora = adessoRoma();
  const mese = ora.getUTCMonth() + 1;
  const anno = ora.getUTCFullYear();

  const [presenzeTotali, presenze4Sett, feedbackRecenti, sfideFatte, richiesteRecenti, pagamento, feedbackMensile, trofei, performance, badgeMensili] =
    await Promise.all([
      db.prepare(`SELECT COUNT(*) AS n FROM presenze WHERE user_id = ? AND confermata = 1`).bind(id).first<{ n: number }>(),
      db
        .prepare(`SELECT COUNT(*) AS n FROM presenze WHERE user_id = ? AND confermata = 1 AND data >= date('now', '-28 days')`)
        .bind(id)
        .first<{ n: number }>(),
      db
        .prepare(
          `SELECT faccina, difficolta, nota, data FROM feedback_allenamento
           WHERE user_id = ? ORDER BY data DESC LIMIT 6`
        )
        .bind(id)
        .all<{ faccina: number; difficolta: string | null; nota: string | null; data: string }>(),
      db
        .prepare(
          `SELECT s.titolo, ps.data, ps.punti_assegnati AS punti
           FROM partecipazioni_sfide ps JOIN sfide s ON s.id = ps.sfida_id
           WHERE ps.user_id = ? ORDER BY ps.data DESC LIMIT 15`
        )
        .bind(id)
        .all<{ titolo: string; data: string; punti: number }>(),
      db
        .prepare(
          `SELECT categoria, testo_libero AS testoLibero, data_sessione AS data
           FROM richieste_preallenamento WHERE user_id = ? ORDER BY data_sessione DESC LIMIT 5`
        )
        .bind(id)
        .all<{ categoria: string | null; testoLibero: string | null; data: string }>(),
      db
        .prepare(`SELECT stato, piano FROM pagamenti WHERE user_id = ? AND mese = ? AND anno = ?`)
        .bind(id, mese, anno)
        .first<{ stato: string; piano: string | null }>(),
      db
        .prepare(
          `SELECT mese, anno, risposte, creato_il AS creatoIl FROM feedback_mensile
           WHERE user_id = ? ORDER BY anno DESC, mese DESC LIMIT 6`
        )
        .bind(id)
        .all<{ mese: number; anno: number; risposte: string; creatoIl: string }>(),
      statoTrofei(db, id),
      db
        .prepare(
          `SELECT esercizio, peso, data FROM (
             SELECT esercizio, peso_kg AS peso, creato_il AS data,
                    ROW_NUMBER() OVER (PARTITION BY esercizio ORDER BY creato_il DESC, id DESC) AS rn
             FROM performance_carichi WHERE user_id = ?
           ) WHERE rn = 1 ORDER BY esercizio`
        )
        .bind(id)
        .all<{ esercizio: string; peso: number; data: string }>(),
      statoBadgeMensili(db, id),
    ]);

  const pianoAtt = pagamento?.piano ?? (await pianoDelMese(db, id, anno, mese));
  const pianoProx = await pianoProssimo(db, id);

  return c.json({
    userId: id,
    anagrafica: {
      nome: anagraficaRow.nome,
      cognome: anagraficaRow.cognome,
      nickname: anagraficaRow.nickname,
      fotoUrl: anagraficaRow.fotoUrl,
      dataNascita: anagraficaRow.dataNascita,
      eta: calcolaEta(anagraficaRow.dataNascita),
      dataIscrizione: anagraficaRow.dataIscrizione,
    },
    datiPrivati: {
      peso: anagraficaRow.peso ?? null,
      altezza: anagraficaRow.altezza ?? null,
      noteInfortuni: anagraficaRow.noteInfortuni ?? null,
      personalizzazione: parseRisposte(anagraficaRow.personalizzazione),
    },
    attivita: {
      livello: calcolaLivello(presenzeTotali?.n ?? 0),
      presenzeTotali: presenzeTotali?.n ?? 0,
      presenzeUltime4Settimane: presenze4Sett?.n ?? 0,
      feedbackRecenti: feedbackRecenti.results,
      feedbackMensile: feedbackMensile.results.map((f) => ({
        mese: f.mese,
        anno: f.anno,
        risposte: parseRisposte(f.risposte),
        creatoIl: f.creatoIl,
      })),
      sfideFatte: sfideFatte.results,
      richiesteRecenti: richiesteRecenti.results,
      pagamentoMese: pagamento?.stato ?? "non_pagato",
      abbonamento: {
        piano: pianoAtt,
        nomePiano: nomePiano(pianoAtt),
        prezzo: prezzoPiano(pianoAtt),
        pianoProssimo: pianoProx,
        nomePianoProssimo: nomePiano(pianoProx),
      },
      trofei,
      badgeMensili,
      performance: performance.results,
    },
  });
});

// YYYY-MM-DD, formato valido (nessun vincolo passato/futuro: è la data reale
// dell'iscrizione in palestra, che la coach conosce meglio di qualunque calcolo).
function dataValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime());
}

// La coach imposta la data di iscrizione in palestra dell'atleta (scheda PROFILI) — resta
// visibile sia sul profilo dell'atleta sia agli altri atleti (scheda pubblica, sotto).
atleti.post("/:id/iscrizione", requireCoach, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "ID atleta non valido" }, 400);

  const { dataIscrizione } = await c.req.json<{ dataIscrizione?: string | null }>();
  if (dataIscrizione != null && !dataValida(String(dataIscrizione))) {
    return c.json({ error: "Data non valida" }, 400);
  }

  const esistente = await c.env.DB.prepare(`SELECT 1 FROM athlete_profile WHERE user_id = ?`).bind(id).first();
  if (!esistente) return c.json({ error: "Atleta non trovato" }, 404);

  await c.env.DB.prepare(`UPDATE athlete_profile SET data_iscrizione = ? WHERE user_id = ?`)
    .bind(dataIscrizione || null, id)
    .run();

  return c.json({ ok: true });
});

// Scheda pubblica di un atleta — quello che un compagno vede toccando la sua foto (nel
// Feed, in classifica, ecc.): foto, nickname, nome/cognome e livello. Niente dati privati
// (età, peso, note, feedback, sfide, pagamento) — quelli restano solo per la coach, vedi
// GET /:id sopra. Aperta a chiunque sia loggato (atleta o coach), non solo alla coach.
atleti.get("/:id/pubblico", requireAuth, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "ID atleta non valido" }, 400);

  const row = await c.env.DB.prepare(
    `SELECT p.nome, p.cognome, p.nickname, p.foto_url AS fotoUrl, p.foto_personalizzazione AS fotoPersonalizzazione,
            p.data_iscrizione AS dataIscrizione
     FROM users u
     JOIN athlete_profile p ON p.user_id = u.id
     WHERE u.id = ? AND u.role = 'atleta' AND u.status = 'attivo'`
  )
    .bind(id)
    .first<{
      nome: string;
      cognome: string;
      nickname: string | null;
      fotoUrl: string | null;
      fotoPersonalizzazione: string | null;
      dataIscrizione: string | null;
    }>();

  if (!row) return c.json({ error: "Atleta non trovato" }, 404);

  // Stessi numeri che l'atleta vede nel proprio Profilo ("I miei progressi" + "I miei
  // badge"), qui in sola lettura per un compagno. Niente statistiche, niente dati privati.
  const [presenzeTotali, anelli, badgeMensili, posizione] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM presenze WHERE user_id = ? AND confermata = 1`)
      .bind(id)
      .first<{ n: number }>(),
    calcolaAnelli(c.env.DB, id),
    statoBadgeMensili(c.env.DB, id),
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
              (SELECT COUNT(*) FROM punti_atleti) AS totaleAtleti
       FROM punti_atleti mio WHERE mio.userId = ?`
    )
      .bind(id)
      .first<{ posizione: number; totaleAtleti: number }>(),
  ]);

  return c.json({
    userId: id,
    nome: row.nome,
    cognome: row.cognome,
    nickname: row.nickname,
    fotoUrl: row.fotoUrl,
    fotoPersonalizzazione: parseFotoPersonalizzazione(row.fotoPersonalizzazione),
    dataIscrizione: row.dataIscrizione,
    livello: calcolaLivello(presenzeTotali?.n ?? 0),
    presenzeTotali: presenzeTotali?.n ?? 0,
    settimaneComplete: anelli.settimaneCompletateTotali,
    classifica: { posizione: posizione?.posizione ?? 1, totaleAtleti: posizione?.totaleAtleti ?? 0 },
    badgeMensili,
  });
});

// Reset password gestito dalla coach — l'unico recupero possibile finché non c'è un
// dominio email verificato per i link di reset. Genera una password temporanea, la
// restituisce UNA volta (la coach la comunica all'atleta) e chiude le sue sessioni
// aperte, così un eventuale accesso non autorizzato viene interrotto.
atleti.post("/:id/reset-password", requireCoach, async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "ID atleta non valido" }, 400);

  const target = await c.env.DB.prepare(
    `SELECT u.id, p.nome, p.cognome, p.nickname
     FROM users u JOIN athlete_profile p ON p.user_id = u.id
     WHERE u.id = ? AND u.role = 'atleta'`
  )
    .bind(id)
    .first<{ id: number; nome: string; cognome: string; nickname: string | null }>();

  if (!target) return c.json({ error: "Atleta non trovato" }, 404);

  const passwordTemporanea = generaPasswordTemporanea();
  const passwordHash = await hashPassword(passwordTemporanea);

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`).bind(passwordHash, id),
    c.env.DB.prepare(`DELETE FROM sessioni_login WHERE user_id = ?`).bind(id),
  ]);

  return c.json({
    passwordTemporanea,
    atleta: target.nickname || `${target.nome} ${target.cognome}`.trim(),
  });
});

export default atleti;
