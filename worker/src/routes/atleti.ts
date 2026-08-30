import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireCoach } from "../middleware/auth";
import { calcolaLivello } from "../lib/livelli";
import { hashPassword } from "../lib/password";
import { parseRisposte } from "../lib/questionario";
import { statoTrofei } from "../lib/trofei";

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
  const ora = new Date();
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
          .prepare(`SELECT stato FROM pagamenti WHERE user_id = ? AND mese = ? AND anno = ?`)
          .bind(u.userId, mese, anno)
          .first<{ stato: string }>(),
      ]);

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
      };
    })
  );

  return c.json({ atleti: risultato, mese, anno });
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
      peso: number | null;
      altezza: number | null;
      noteInfortuni: string | null;
      personalizzazione: string | null;
    }>();

  if (!anagraficaRow) return c.json({ error: "Atleta non trovato" }, 404);

  const ora = new Date();
  const mese = ora.getUTCMonth() + 1;
  const anno = ora.getUTCFullYear();

  const [presenzeTotali, presenze4Sett, feedbackRecenti, sfideFatte, richiesteRecenti, pagamento, feedbackMensile, trofei, performance] =
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
        .prepare(`SELECT stato FROM pagamenti WHERE user_id = ? AND mese = ? AND anno = ?`)
        .bind(id, mese, anno)
        .first<{ stato: string }>(),
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
    ]);

  return c.json({
    userId: id,
    anagrafica: {
      nome: anagraficaRow.nome,
      cognome: anagraficaRow.cognome,
      nickname: anagraficaRow.nickname,
      fotoUrl: anagraficaRow.fotoUrl,
      dataNascita: anagraficaRow.dataNascita,
      eta: calcolaEta(anagraficaRow.dataNascita),
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
      trofei,
      performance: performance.results,
    },
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
