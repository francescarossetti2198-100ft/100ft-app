// Notifiche in-app della campanella (stile Instagram, ottobre 2026) — solo per gli atleti,
// mai push: si vedono aprendo l'app. Quasi tutto si calcola al volo da tabelle che esistono
// già, così non c'è niente da tenere allineato quando un commento, una reazione o dei punti
// vengono tolti (spariscono anche dalla campanella). Le uniche righe salvate apposta sono in
// `notifiche`: i sorpassi in classifica e le reazioni ai sorpassi (vedi rilevaSorpassi).
//
// "Nuova" = più recente di notifiche_lettura.ultima_lettura, che si aggiorna quando l'atleta
// apre la pagina Notifiche.
import { adessoRoma, mezzanotteRomaUtc, oggi } from "./oggi";
import { parseFotoPersonalizzazione } from "./fotoPersonalizzazione";

// Quanto indietro guarda la campanella.
const GIORNI_STORICO = 45;

// Emoji con cui si può rispondere a chi ti ha sorpassato (scelta di Francesca: anche il dito medio).
export const EMOJI_SORPASSO = ["🖕", "😤", "😂", "🔥", "👏"];

// Punti "di routine" (3 volte a settimana ciascuno): non fanno una notifica a testa per non
// riempire la lista, si vedono nel riepilogo del lunedì.
const AZIONI_ROUTINE = ["sessione_completata", "feedback_allenamento"];

const MESI = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];

type Attore = {
  userId: number | null;
  nome: string;
  fotoUrl: string | null;
  fotoPersonalizzazione: unknown;
};

export type Notifica = {
  id: string;
  tipo: string;
  data: string; // UTC "YYYY-MM-DD HH:MM:SS", come le altre date in DB
  nuova?: boolean;
  attori?: Attore[];
  totaleAttori?: number;
  testo: string; // quello che segue i nomi (o tutta la frase se non ci sono attori)
  anteprima?: string; // citazione (commento, testo del post...)
  icona?: string; // emoji al posto della foto quando non c'è un attore
  punti?: number;
  link?: string;
  // Sorpasso: id della riga in `notifiche`, emoji disponibili e risposta già data.
  sorpassoId?: number;
  emoji?: string[];
  reazione?: string | null;
  // Riepilogo del lunedì: il dettaglio dei punti della settimana.
  dettagli?: { testo: string; punti: number; data: string }[];
};

type RigaPersona = {
  userId: number | null;
  role: string | null;
  nome: string | null;
  nickname: string | null;
  fotoUrl: string | null;
  fotoPersonalizzazione: string | null;
};

function attoreDa(r: RigaPersona): Attore {
  return {
    userId: r.role === "coach" ? null : r.userId,
    nome: r.role === "coach" ? "Coach" : r.nickname || r.nome || "Atleta",
    fotoUrl: r.fotoUrl,
    fotoPersonalizzazione: parseFotoPersonalizzazione(r.fotoPersonalizzazione),
  };
}

function corto(testo: string | null | undefined, max = 70): string {
  const t = String(testo ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function utc(d: Date): string {
  return d.toISOString().slice(0, 19).replace("T", " ");
}

// "YYYY-MM-DD" + ora di Roma -> istante UTC nel formato del DB.
function romaAUtc(data: string, ora: number): string {
  const [a, m, g] = data.split("-").map(Number);
  const mezzanotte = new Date(`${mezzanotteRomaUtc(a, m, g).replace(" ", "T")}Z`);
  return utc(new Date(mezzanotte.getTime() + ora * 3600_000));
}

function spostaGiorni(data: string, giorni: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + giorni);
  return d.toISOString().slice(0, 10);
}

function inizioUtc(data: string): string {
  const [a, m, g] = data.split("-").map(Number);
  return mezzanotteRomaUtc(a, m, g);
}

// Il "perché" di ogni riga di xp_log, in parole.
export function etichettaPunti(azione: string, titoloSfida: string | null, motivo: string | null): string {
  if (azione === "sfida") return titoloSfida ? `Sfida completata: ${titoloSfida}` : "Sfida completata";
  if (azione.startsWith("sfida_extra_")) return motivo ? `Sfida extra completata: ${motivo}` : "Sfida extra completata";
  if (azione.startsWith("settimana_completa_")) return "Settimana completa: lunedì, mercoledì e venerdì";
  if (azione.startsWith("sfide_mese_complete_")) {
    const m = Number(azione.slice(-2));
    return `Bonus: tutte le sfide di ${MESI[m - 1] ?? "questo mese"} completate`;
  }
  if (azione === "daily_drop") return "Daily Drop";
  if (azione === "feedback_mensile") return "Questionario del mese";
  if (azione === "punti_extra") return motivo ? `Punti extra dalla coach: ${motivo}` : "Punti extra dalla coach";
  if (azione === "sessione_completata") return "Allenamento confermato";
  if (azione === "feedback_allenamento") return "Feedback dopo l'allenamento";
  return azione;
}

const PERSONA_SQL = `u.id AS userId, u.role, a.nome, a.nickname, a.foto_url AS fotoUrl,
                     a.foto_personalizzazione AS fotoPersonalizzazione`;

// ─── Sorpassi ────────────────────────────────────────────────────────────────────────────
// Confronta i punti del mese di ogni atleta con l'ultima fotografia (classifica_snapshot):
// X sorpassa Y se prima X aveva MENO punti di Y e adesso ne ha di PIÙ. Così quando l'appello
// dà +10 a tutti insieme nessuno "sorpassa" nessuno. Chiamata dal cron ogni minuto e quando
// un atleta apre le notifiche; la `chiave` UNIQUE evita doppioni se girano insieme.
export async function rilevaSorpassi(db: D1Database): Promise<void> {
  const r = adessoRoma();
  const anno = r.getUTCFullYear();
  const mese = r.getUTCMonth() + 1;
  const meseKey = `${anno}-${String(mese).padStart(2, "0")}`;

  const [{ results: attuali }, { results: salvati }] = await Promise.all([
    db
      .prepare(
        `SELECT u.id AS userId, COALESCE(SUM(x.xp_assegnati), 0) AS punti
         FROM users u
         JOIN athlete_profile p ON p.user_id = u.id
         LEFT JOIN xp_log x ON x.user_id = u.id AND x.data >= ?
         WHERE u.role = 'atleta' AND u.status = 'attivo'
         GROUP BY u.id`
      )
      .bind(mezzanotteRomaUtc(anno, mese))
      .all<{ userId: number; punti: number }>(),
    db
      .prepare(`SELECT user_id AS userId, punti FROM classifica_snapshot WHERE mese = ?`)
      .bind(meseKey)
      .all<{ userId: number; punti: number }>(),
  ]);

  const prima = new Map(salvati.map((s) => [s.userId, s.punti]));
  const scritture: D1PreparedStatement[] = [];

  if (salvati.length) {
    // Posizione attuale (1, 2, 2, 4) per il testo "ora è 3°".
    const ordinati = [...attuali].sort((a, b) => b.punti - a.punti);
    const posizione = new Map<number, number>();
    ordinati.forEach((a, i) => {
      const pos = i > 0 && a.punti === ordinati[i - 1].punti ? posizione.get(ordinati[i - 1].userId)! : i + 1;
      posizione.set(a.userId, pos);
    });

    for (const x of attuali) {
      const xPrima = prima.get(x.userId) ?? x.punti;
      if (x.punti <= xPrima) continue;
      for (const y of attuali) {
        if (y.userId === x.userId || y.punti <= 0) continue;
        const yPrima = prima.get(y.userId) ?? y.punti;
        if (xPrima < yPrima && x.punti > y.punti) {
          scritture.push(
            db
              .prepare(
                `INSERT OR IGNORE INTO notifiche (user_id, tipo, attore_id, dato, chiave)
                 VALUES (?, 'sorpasso', ?, ?, ?)`
              )
              .bind(
                y.userId,
                x.userId,
                JSON.stringify({ mese: meseKey, posizione: posizione.get(x.userId) }),
                `sorpasso:${meseKey}:${x.userId}:${y.userId}:${x.punti}`
              )
          );
        }
      }
    }
  } else {
    // Primo giro del mese: si riparte da zero, le fotografie dei mesi passati non servono più.
    scritture.push(db.prepare(`DELETE FROM classifica_snapshot WHERE mese <> ?`).bind(meseKey));
  }

  for (const a of attuali) {
    if (prima.get(a.userId) === a.punti) continue;
    scritture.push(
      db
        .prepare(
          `INSERT INTO classifica_snapshot (mese, user_id, punti) VALUES (?, ?, ?)
           ON CONFLICT (mese, user_id) DO UPDATE SET punti = excluded.punti`
        )
        .bind(meseKey, a.userId, a.punti)
    );
  }

  if (scritture.length) await db.batch(scritture);
}

// ─── Elenco ──────────────────────────────────────────────────────────────────────────────

// Prima volta: si considera "già visto" tutto tranne gli ultimi 3 giorni, così il numerino
// iniziale non è enorme.
async function ultimaLettura(db: D1Database, userId: number): Promise<string> {
  const riga = await db
    .prepare(`SELECT ultima_lettura AS v FROM notifiche_lettura WHERE user_id = ?`)
    .bind(userId)
    .first<{ v: string }>();
  if (riga) return riga.v;
  const v = utc(new Date(Date.now() - 3 * 86400_000));
  await db
    .prepare(`INSERT OR IGNORE INTO notifiche_lettura (user_id, ultima_lettura) VALUES (?, ?)`)
    .bind(userId, v)
    .run();
  return v;
}

export async function segnaLette(db: D1Database, userId: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO notifiche_lettura (user_id, ultima_lettura) VALUES (?, datetime('now'))
       ON CONFLICT (user_id) DO UPDATE SET ultima_lettura = excluded.ultima_lettura`
    )
    .bind(userId)
    .run();
}

export async function elencoNotifiche(db: D1Database, userId: number): Promise<Notifica[]> {
  const utente = await db
    .prepare(`SELECT created_at AS creato FROM users WHERE id = ?`)
    .bind(userId)
    .first<{ creato: string }>();
  const limite = utc(new Date(Date.now() - GIORNI_STORICO * 86400_000));
  const da = utente && utente.creato > limite ? utente.creato : limite;
  const { data: oggiData } = oggi();
  const lettura = await ultimaLettura(db, userId);

  const [commenti, reazioni, punti, mieiPost, compleanni, postCoach, note, sfideNuove, salvate] = await Promise.all([
    db
      .prepare(
        `SELECT co.id, co.post_id AS postId, co.testo, co.data, ${PERSONA_SQL}, p.tipo AS postTipo
         FROM feed_commenti co
         JOIN post_feed p ON p.id = co.post_id
         JOIN users u ON u.id = co.user_id
         LEFT JOIN athlete_profile a ON a.user_id = u.id
         WHERE p.user_id = ? AND co.user_id <> ? AND co.data >= ?`
      )
      .bind(userId, userId, da)
      .all<RigaPersona & { id: number; postId: number; testo: string; data: string; postTipo: string }>(),
    db
      .prepare(
        `SELECT r.post_id AS postId, r.emoji, r.data, ${PERSONA_SQL}, p.tipo AS postTipo, p.testo AS postTesto
         FROM feed_reazioni r
         JOIN post_feed p ON p.id = r.post_id
         JOIN users u ON u.id = r.user_id
         LEFT JOIN athlete_profile a ON a.user_id = u.id
         WHERE p.user_id = ? AND r.user_id <> ? AND r.data >= ?
         ORDER BY r.data DESC`
      )
      .bind(userId, userId, da)
      .all<RigaPersona & { postId: number; emoji: string; data: string; postTipo: string; postTesto: string | null }>(),
    db
      .prepare(
        `SELECT x.id, x.azione, x.xp_assegnati AS punti, x.data, x.motivo, s.titolo
         FROM xp_log x LEFT JOIN sfide s ON s.id = x.sfida_id
         WHERE x.user_id = ? AND x.data >= ?
           AND x.azione NOT IN (${AZIONI_ROUTINE.map(() => "?").join(",")})`
      )
      .bind(userId, da, ...AZIONI_ROUTINE)
      .all<{ id: number; azione: string; punti: number; data: string; motivo: string | null; titolo: string | null }>(),
    db
      .prepare(
        `SELECT id, tipo, testo, data FROM post_feed
         WHERE user_id = ? AND tipo IN ('level_up', 'badge', 'athlete_of_week', 'consistency') AND data >= ?`
      )
      .bind(userId, da)
      .all<{ id: number; tipo: string; testo: string | null; data: string }>(),
    db
      .prepare(
        `SELECT p.id, p.data, ${PERSONA_SQL}
         FROM post_feed p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN athlete_profile a ON a.user_id = u.id
         WHERE p.tipo = 'compleanno' AND p.data >= ?`
      )
      .bind(da)
      .all<RigaPersona & { id: number; data: string }>(),
    db
      .prepare(
        `SELECT id, tipo, testo, data FROM post_feed
         WHERE user_id IS NULL AND tipo IN ('annuncio_coach', 'allenamento') AND data >= ?`
      )
      .bind(da)
      .all<{ id: number; tipo: string; testo: string | null; data: string }>(),
    db
      .prepare(
        `SELECT data, testo, MAX(aggiornata_il, data || ' 05:00:00') AS ts FROM nota_coach
         WHERE data <= ? AND data >= ?`
      )
      .bind(oggiData, spostaGiorni(oggiData, -14))
      .all<{ data: string; testo: string; ts: string }>(),
    db
      .prepare(
        `SELECT id, titolo, flash, data_inizio AS dataInizio FROM sfide
         WHERE data_inizio <= ? AND data_inizio >= ?`
      )
      .bind(oggiData, da.slice(0, 10))
      .all<{ id: number; titolo: string; flash: number; dataInizio: string }>(),
    db
      .prepare(
        `SELECT n.id, n.tipo, n.dato, n.reazione, n.data, ${PERSONA_SQL}
         FROM notifiche n
         JOIN users u ON u.id = n.attore_id
         LEFT JOIN athlete_profile a ON a.user_id = u.id
         WHERE n.user_id = ? AND n.data >= ?`
      )
      .bind(userId, da)
      .all<RigaPersona & { id: number; tipo: string; dato: string | null; reazione: string | null; data: string }>(),
  ]);

  // La foto della coach per i suoi post (che hanno user_id NULL), come fa il Feed.
  const fotoCoach = await db
    .prepare(
      `SELECT p.foto_url AS fotoUrl, p.foto_personalizzazione AS fotoPersonalizzazione
       FROM users u JOIN athlete_profile p ON p.user_id = u.id WHERE u.role = 'coach' LIMIT 1`
    )
    .first<{ fotoUrl: string | null; fotoPersonalizzazione: string | null }>();
  const coach: Attore = {
    userId: null,
    nome: "Coach",
    fotoUrl: fotoCoach?.fotoUrl ?? null,
    fotoPersonalizzazione: parseFotoPersonalizzazione(fotoCoach?.fotoPersonalizzazione ?? null),
  };

  const out: Notifica[] = [];

  for (const c of commenti.results) {
    out.push({
      id: `commento-${c.id}`,
      tipo: "commento",
      data: c.data,
      attori: [attoreDa(c)],
      totaleAttori: 1,
      testo: c.postTipo === "compleanno" ? "ti ha scritto sotto il post di compleanno:" : "ha commentato il tuo post:",
      anteprima: corto(c.testo, 90),
      link: `/feed?post=${c.postId}&commenti=1`,
    });
  }

  // Reazioni: una riga per post, come su Instagram ("Marco e altri 3 hanno reagito").
  const perPost = new Map<number, typeof reazioni.results>();
  for (const r of reazioni.results) perPost.set(r.postId, [...(perPost.get(r.postId) ?? []), r]);
  for (const [postId, righe] of perPost) {
    const attori: Attore[] = [];
    const visti = new Set<number | null>();
    for (const r of righe) {
      if (visti.has(r.userId)) continue;
      visti.add(r.userId);
      attori.push(attoreDa(r));
    }
    const emoji = [...new Set(righe.map((r) => r.emoji))].join("");
    const post = righe[0];
    out.push({
      id: `reazioni-${postId}`,
      tipo: "reazione",
      data: righe[0].data, // la più recente (ORDER BY data DESC)
      attori: attori.slice(0, 2),
      totaleAttori: attori.length,
      testo: `${attori.length > 1 ? "hanno" : "ha"} reagito ${emoji} al tuo post`,
      anteprima: post.postTipo === "compleanno" ? "🎂 Il tuo compleanno" : corto(post.postTesto),
      link: `/feed?post=${postId}`,
    });
  }

  for (const p of punti.results) {
    out.push({
      id: `punti-${p.id}`,
      tipo: "punti",
      data: p.data,
      punti: p.punti,
      testo: etichettaPunti(p.azione, p.titolo, p.motivo),
      link: p.azione === "sfida" || p.azione.startsWith("sfida_extra_") || p.azione.startsWith("sfide_mese_complete_") ? "/sfide" : undefined,
    });
  }

  for (const p of mieiPost.results) {
    const testo =
      p.tipo === "level_up"
        ? `Hai sbloccato un nuovo livello: ${p.testo ?? ""}`
        : p.tipo === "badge"
          ? `Hai conquistato il badge di ${p.testo ?? "questo mese"}`
          : p.tipo === "athlete_of_week"
            ? `Sei l'Atleta del Mese! ${p.testo ?? ""}`
            : `Traguardo raggiunto: ${p.testo ?? ""}`;
    out.push({
      id: `traguardo-${p.id}`,
      tipo: "traguardo",
      data: p.data,
      icona: p.tipo === "level_up" ? "⬆️" : p.tipo === "badge" ? "🎖️" : "🏆",
      testo: testo.trim(),
      link: `/feed?post=${p.id}`,
    });
  }

  for (const c of compleanni.results) {
    const mio = c.userId === userId;
    out.push({
      id: `compleanno-${c.id}`,
      tipo: "compleanno",
      data: c.data,
      attori: mio ? undefined : [attoreDa(c)],
      totaleAttori: mio ? undefined : 1,
      icona: mio ? "🎂" : undefined,
      testo: mio
        ? "Tanti auguri! 🎉 Oggi è il tuo compleanno: guarda il post nel Feed"
        : "oggi compie gli anni 🎂 Passa a fare gli auguri!",
      link: `/feed?post=${c.id}&commenti=1`,
    });
  }

  for (const p of postCoach.results) {
    out.push({
      id: `coach-${p.id}`,
      tipo: "coach",
      data: p.data,
      attori: [coach],
      totaleAttori: 1,
      testo: p.tipo === "annuncio_coach" ? "ha pubblicato un annuncio:" : "ha scritto le note dell'allenamento:",
      anteprima: corto(p.testo),
      link: `/feed?post=${p.id}`,
    });
  }

  for (const n of note.results) {
    out.push({
      id: `nota-${n.data}`,
      tipo: "coach",
      data: n.ts,
      attori: [coach],
      totaleAttori: 1,
      testo: n.data === oggiData ? "ha scritto le info sull'allenamento di oggi:" : "ha scritto le info sull'allenamento:",
      anteprima: corto(n.testo),
      link: n.data === oggiData ? "/?nota=1" : undefined,
    });
  }

  // Sfide che partono lo stesso giorno (di solito tutte quelle del mese, il 1°): una riga sola.
  const sfidePerGiorno = new Map<string, typeof sfideNuove.results>();
  for (const sf of sfideNuove.results) sfidePerGiorno.set(sf.dataInizio, [...(sfidePerGiorno.get(sf.dataInizio) ?? []), sf]);
  for (const [giorno, lista] of sfidePerGiorno) {
    const lampo = lista.every((sf) => sf.flash);
    const titoli = lista.map((sf) => sf.titolo);
    out.push({
      id: `sfide-${giorno}`,
      tipo: "sfida",
      data: romaAUtc(giorno, 7),
      icona: lampo ? "⚡" : "🎯",
      testo:
        lista.length === 1
          ? `${lampo ? "Nuova sfida lampo" : "Nuova sfida"}: ${titoli[0]}`
          : `${lista.length} nuove sfide: ${titoli.slice(0, 3).join(", ")}${lista.length > 3 ? ` e altre ${lista.length - 3}` : ""}`,
      link: "/sfide",
    });
  }

  for (const n of salvate.results) {
    if (n.tipo === "sorpasso") {
      let dato: { mese?: string; posizione?: number } = {};
      try {
        dato = JSON.parse(n.dato ?? "{}");
      } catch {
        // dato non leggibile: frase senza dettagli
      }
      const nomeMese = dato.mese ? MESI[Number(dato.mese.slice(5)) - 1] : null;
      out.push({
        id: `sorpasso-${n.id}`,
        tipo: "sorpasso",
        data: n.data,
        attori: [attoreDa(n)],
        totaleAttori: 1,
        testo: `ti ha sorpassato nella classifica${nomeMese ? ` di ${nomeMese}` : ""} 😈${
          dato.posizione ? ` Ora è ${dato.posizione}°.` : ""
        }`,
        link: "/sfide",
        sorpassoId: n.id,
        emoji: EMOJI_SORPASSO,
        reazione: n.reazione,
      });
    } else if (n.tipo === "reazione_sorpasso") {
      out.push({
        id: `rs-${n.id}`,
        tipo: "reazione_sorpasso",
        data: n.data,
        attori: [attoreDa(n)],
        totaleAttori: 1,
        testo: `ha risposto al tuo sorpasso: ${n.reazione ?? ""}`,
        link: "/sfide",
      });
    }
  }

  const [promemoria, riepilogo] = await Promise.all([
    promemoriaSfide(db, userId, oggiData),
    riepilogoSettimana(db, userId),
  ]);
  if (promemoria && promemoria.data >= da) out.push(promemoria);
  if (riepilogo && riepilogo.data >= da) out.push(riepilogo);

  out.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return out.slice(0, 100).map((n) => ({ ...n, nuova: n.data > lettura }));
}

export async function contaNuove(db: D1Database, userId: number): Promise<number> {
  const lista = await elencoNotifiche(db, userId);
  return lista.filter((n) => n.nuova).length;
}

// Promemoria della domenica sera (18:00 di Roma), uno a settimana: le sfide ancora aperte che
// l'atleta non ha fatto. Il contenuto è sempre quello di adesso: se nel frattempo le fa, il
// promemoria sparisce da solo.
async function promemoriaSfide(db: D1Database, userId: number, oggiData: string): Promise<Notifica | null> {
  const r = adessoRoma();
  let indietro = r.getUTCDay(); // 0 = domenica
  if (indietro === 0 && r.getUTCHours() < 18) indietro = 7;
  const domenica = spostaGiorni(oggiData, -indietro);

  const { results } = await db
    .prepare(
      `SELECT s.titolo, s.data_fine AS dataFine FROM sfide s
       WHERE s.data_inizio <= ? AND s.data_fine >= ?
         AND NOT EXISTS (SELECT 1 FROM partecipazioni_sfide ps WHERE ps.sfida_id = s.id AND ps.user_id = ?)
       ORDER BY s.data_fine, s.id`
    )
    .bind(oggiData, oggiData, userId)
    .all<{ titolo: string; dataFine: string }>();
  if (!results.length) return null;

  const n = results.length;
  const scadenza = results[0].dataFine;
  const [, m, g] = scadenza.split("-").map(Number);
  return {
    id: `promemoria-${domenica}`,
    tipo: "promemoria",
    data: romaAUtc(domenica, 18),
    icona: "⏰",
    testo: `${n === 1 ? "Ti manca ancora 1 sfida" : `Ti mancano ancora ${n} sfide`}: ${results
      .slice(0, 3)
      .map((s) => s.titolo)
      .join(", ")}${n > 3 ? ` e altre ${n - 3}` : ""}. La prima scade il ${g} ${MESI[m - 1]}, non lasciartela scappare! 💪`,
    link: "/sfide",
  };
}

// Riepilogo del lunedì mattina (08:00 di Roma) sulla settimana appena finita: allenamenti,
// punti (col dettaglio di ognuno) e posizione nella classifica di quella settimana. Solo se
// l'atleta ha fatto qualcosa: un "0 allenamenti" non motiva nessuno.
async function riepilogoSettimana(db: D1Database, userId: number): Promise<Notifica | null> {
  const r = adessoRoma();
  const oggiData = r.toISOString().slice(0, 10);
  let indietro = (r.getUTCDay() + 6) % 7; // 0 = lunedì
  if (indietro === 0 && r.getUTCHours() < 8) indietro = 7;
  const lunCorr = spostaGiorni(oggiData, -indietro);
  const lunPrev = spostaGiorni(lunCorr, -7);
  const [da, a] = [inizioUtc(lunPrev), inizioUtc(lunCorr)];

  const [allenamenti, righe, totali] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(DISTINCT data) AS n FROM presenze
         WHERE user_id = ? AND confermata = 1 AND data >= ? AND data < ?`
      )
      .bind(userId, lunPrev, lunCorr)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT x.azione, x.xp_assegnati AS punti, x.data, x.motivo, s.titolo
         FROM xp_log x LEFT JOIN sfide s ON s.id = x.sfida_id
         WHERE x.user_id = ? AND x.data >= ? AND x.data < ?
         ORDER BY x.data`
      )
      .bind(userId, da, a)
      .all<{ azione: string; punti: number; data: string; motivo: string | null; titolo: string | null }>(),
    db
      .prepare(
        `SELECT u.id AS userId, COALESCE(SUM(x.xp_assegnati), 0) AS punti
         FROM users u
         JOIN athlete_profile p ON p.user_id = u.id
         LEFT JOIN xp_log x ON x.user_id = u.id AND x.data >= ? AND x.data < ?
         WHERE u.role = 'atleta' AND u.status = 'attivo'
         GROUP BY u.id`
      )
      .bind(da, a)
      .all<{ userId: number; punti: number }>(),
  ]);

  const nAllenamenti = allenamenti?.n ?? 0;
  const somma = righe.results.reduce((s, x) => s + x.punti, 0);
  if (!nAllenamenti && somma <= 0) return null;

  const mieiPunti = totali.results.find((t) => t.userId === userId)?.punti ?? somma;
  const posizione = totali.results.filter((t) => t.punti > mieiPunti).length + 1;

  const parti = [
    `${nAllenamenti} ${nAllenamenti === 1 ? "allenamento" : "allenamenti"}`,
    `+${somma} punti`,
  ];
  if (somma > 0) parti.push(`${posizione}° in classifica`);

  return {
    id: `riepilogo-${lunCorr}`,
    tipo: "riepilogo",
    data: romaAUtc(lunCorr, 8),
    icona: "📊",
    testo: `La tua settimana: ${parti.join(" · ")}. Tocca per vedere da dove arrivano i punti.`,
    punti: somma,
    dettagli: righe.results.map((x) => ({
      testo: etichettaPunti(x.azione, x.titolo, x.motivo),
      punti: x.punti,
      data: x.data,
    })),
  };
}
