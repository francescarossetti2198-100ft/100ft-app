import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { requireAuth, requireCoach } from "../middleware/auth";
import { awardXp } from "../lib/xp";
import { salvaFoto } from "../lib/storage";
import { inizioSettimana } from "../lib/settimana";
import { snapshotProgressione, segnalaAvanzamento } from "../lib/progressione";
import { stagioneDi, verificaEAssegnaTrofeo, statoTrofei } from "../lib/trofei";
import { verificaTraguardi, verificaBonusMese, criterioValido } from "../lib/traguardi";
import { adessoRoma, mezzanotteRomaUtc } from "../lib/oggi";
import { classificaNascostaPer } from "../lib/suspense";
import { faseVotazione } from "../lib/votazioneSfide";
import { parseFotoPersonalizzazione } from "../lib/fotoPersonalizzazione";

type Variables = { user: SessionUser };
const sfide = new Hono<{ Bindings: Env; Variables: Variables }>();

const PERIODI = ["settimana", "mese", "totale"] as const;
type Periodo = (typeof PERIODI)[number];

// Classifiche multiple (brief, sezione 10) — Settimana/Mese/Totale per ora; Season e
// Improvement (basata sul miglioramento personale, non sui punti totali) restano da fare.
//
// Ogni riga porta anche `variazione`: di quante posizioni l'atleta si è mosso all'ULTIMO
// cambio di posizione (> 0 salito = freccia verde, < 0 sceso = freccia rossa). Il confronto
// è con la posizione precedente registrata — che si aggiorna a ogni sorpasso di punti — non
// con un periodo passato. La freccia resta finché la posizione non cambia di nuovo. `null`
// per chi è a 0 punti o non ha ancora avuto un cambio. Le posizioni stanno in
// `classifica_posizioni` e questo GET le aggiorna quando cambiano.
sfide.get("/classifica", requireAuth, async (c) => {
  const richiesto = c.req.query("periodo");
  const periodo: Periodo = PERIODI.includes(richiesto as Periodo) ? (richiesto as Periodo) : "mese";

  // Ultima settimana del mese: per gli atleti la classifica è segreta fino all'Atleta del mese
  // (lib/suspense.ts). Niente calcolo, così non si aggiornano nemmeno le frecce.
  const nascosta = classificaNascostaPer(c.var.user.role);
  if (nascosta) return c.json({ classifica: [], periodo, nascosta: true, svelaIl: nascosta.fino });

  const oggi = adessoRoma();

  // Da quando contano i punti per questo periodo ("totale" = da sempre). xp_log.data è UTC:
  // il confine va calcolato sulla mezzanotte di ROMA, altrimenti i punti fatti dopo la
  // mezzanotte italiana del 1° (es. il questionario mensile alle 00:41 del 1° ottobre =
  // 22:41 UTC del 30 settembre) finiscono nel periodo prima. Stesso confine dell'Atleta
  // del mese (lib/atletaMese.ts).
  let minCorr: string | null = null;
  if (periodo === "settimana") {
    const lun = inizioSettimana(oggi);
    minCorr = mezzanotteRomaUtc(lun.getUTCFullYear(), lun.getUTCMonth() + 1, lun.getUTCDate());
  } else if (periodo === "mese") {
    minCorr = mezzanotteRomaUtc(oggi.getUTCFullYear(), oggi.getUTCMonth() + 1);
  }

  const filtro = minCorr ? "AND x.data >= ?" : "";
  const bindPunti = minCorr ? [minCorr] : [];
  const { results: corrente } = await c.env.DB.prepare(
    `SELECT u.id AS userId, p.nome, p.nickname, p.foto_url AS fotoUrl,
            COALESCE(SUM(x.xp_assegnati), 0) AS punti
     FROM users u
     JOIN athlete_profile p ON p.user_id = u.id
     LEFT JOIN xp_log x ON x.user_id = u.id ${filtro}
     WHERE u.role = 'atleta' AND u.status = 'attivo'
     GROUP BY u.id
     ORDER BY punti DESC, p.nome ASC`
  )
    .bind(...bindPunti)
    .all<{ userId: number; nome: string; nickname: string | null; fotoUrl: string | null; punti: number }>();

  // Posizione "sportiva" (1, 2, 2, 4): a parità di punti stessa posizione.
  const posizioni = new Map<number, number>();
  {
    let puntiPrec: number | null = null;
    let posPrec = 0;
    corrente.forEach((r, i) => {
      const pos = r.punti === puntiPrec ? posPrec : i + 1;
      posizioni.set(r.userId, pos);
      puntiPrec = r.punti;
      posPrec = pos;
    });
  }

  // Posizioni registrate all'ultimo giro per questo periodo.
  const { results: salvate } = await c.env.DB.prepare(
    `SELECT user_id AS userId, posizione, posizione_prec AS posizionePrec
     FROM classifica_posizioni WHERE periodo = ?`
  )
    .bind(periodo)
    .all<{ userId: number; posizione: number; posizionePrec: number | null }>();
  const salvatePer = new Map(salvate.map((s) => [s.userId, s]));

  const daAggiornare: { userId: number; posizione: number; posizionePrec: number | null }[] = [];

  const classifica = corrente.map((r) => {
    const posCurr = posizioni.get(r.userId) ?? 0;
    const salvata = salvatePer.get(r.userId);

    let posizionePrec: number | null;
    if (!salvata) {
      // Prima volta in classifica: registra e basta, niente freccia.
      daAggiornare.push({ userId: r.userId, posizione: posCurr, posizionePrec: null });
      posizionePrec = null;
    } else if (salvata.posizione !== posCurr) {
      // Posizione cambiata (un sorpasso): la vecchia diventa la "precedente".
      daAggiornare.push({ userId: r.userId, posizione: posCurr, posizionePrec: salvata.posizione });
      posizionePrec = salvata.posizione;
    } else {
      // Ferma: la freccia resta quella dell'ultimo cambio.
      posizionePrec = salvata.posizionePrec;
    }

    // Niente freccia a 0 punti (a inizio periodo sono tutti pari merito → sarebbe rumore).
    const variazione = r.punti > 0 && posizionePrec != null ? posizionePrec - posCurr : null;
    return { ...r, posizione: posCurr, variazione };
  });

  if (daAggiornare.length) {
    await c.env.DB.batch(
      daAggiornare.map((d) =>
        c.env.DB.prepare(
          `INSERT INTO classifica_posizioni (periodo, user_id, posizione, posizione_prec, aggiornata_il)
           VALUES (?, ?, ?, ?, datetime('now'))
           ON CONFLICT (periodo, user_id) DO UPDATE SET
             posizione = excluded.posizione,
             posizione_prec = excluded.posizione_prec,
             aggiornata_il = excluded.aggiornata_il`
        ).bind(periodo, d.userId, d.posizione, d.posizionePrec)
      )
    );
  }

  return c.json({ classifica, periodo });
});

sfide.get("/", requireAuth, async (c) => {
  // Il coach può creare sfide in anticipo (es. tutta la settimana la domenica prima) —
  // restano bloccate agli atleti finché data_inizio non arriva, stesso principio anti-spoiler
  // già applicato al Programma mensile.
  const isCoach = c.var.user.role === "coach";
  const oggi = adessoRoma().toISOString().slice(0, 10);
  // `?vista=atleta`: la pagina Sfide della coach mostra esattamente quello che vedono gli
  // atleti (stesse sfide, flash segrete glitchate). La dashboard "Gestione sfide" non lo
  // passa e vede tutto in chiaro. Richiesta di Francesca, ott 2026.
  const comeAtleta = !isCoach || c.req.query("vista") === "atleta";

  // Aprendo le Sfide l'atleta fa scattare le "traguardo" già maturate.
  if (!isCoach) await verificaTraguardi(c.env.DB, c.var.user.userId);

  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.titolo, s.descrizione, s.tipo, s.criterio, s.punti, s.flash, s.data_inizio, s.data_fine,
            s.foto_richieste AS fotoRichieste, s.votazione_dal, s.votazione_fino, s.risultati_dal,
            s.punti_vincitore AS puntiVincitore,
            (SELECT COUNT(*) FROM sfide_foto f WHERE f.sfida_id = s.id AND f.user_id = ?) AS fotoCaricate,
            EXISTS(SELECT 1 FROM partecipazioni_sfide p WHERE p.sfida_id = s.id AND p.user_id = ?) AS partecipato,
            (SELECT COUNT(*) FROM partecipazioni_sfide p WHERE p.sfida_id = s.id) AS numeroPartecipanti
     FROM sfide s
     ${!comeAtleta ? "" : `WHERE (s.data_inizio <= ? OR substr(s.data_inizio, 1, 7) IN
       (SELECT printf('%04d-%02d', anno, mese) FROM programma_mensile WHERE pubblicato = 1))`}
     ORDER BY s.data_fine DESC`
  )
    .bind(...(!comeAtleta ? [c.var.user.userId, c.var.user.userId] : [c.var.user.userId, c.var.user.userId, oggi]))
    .all<Record<string, unknown> & { flash: number; data_inizio: string }>();

  // Sfida flash non ancora iniziata (es. Halloween, dal 26/10): l'atleta vede che c'è, ma
  // titolo e descrizione restano segreti fino a data_inizio — tolti qui, non solo nascosti
  // dalla UI, così non si leggono nemmeno dalla risposta. Scelta di Francesca, ott 2026.
  const sfideVisibili = !comeAtleta
    ? results
    : results.map((s) =>
        s.flash && s.data_inizio > oggi ? { ...s, titolo: null, descrizione: null, nascosta: 1 } : s
      );

  // Sfide con votazione (es. Halloween): la fase attuale, per la card.
  const conFase = sfideVisibili.map((s) => {
    const fase = faseVotazione(s as unknown as Parameters<typeof faseVotazione>[0]);
    return fase ? { ...s, votazione: fase } : s;
  });

  return c.json({ sfide: conFase });
});

// Galleria di una sfida con votazione (lib/votazioneSfide.ts). Agli atleti le foto degli
// altri restano segrete finché non si apre il voto; i conteggi si vedono solo coi risultati.
// La coach vede sempre tutto.
sfide.get("/:id/votazione", requireAuth, async (c) => {
  const sfidaId = Number(c.req.param("id"));
  const sfida = await c.env.DB.prepare(
    `SELECT id, titolo, punti, punti_vincitore AS puntiVincitore, votazione_dal, votazione_fino, risultati_dal
     FROM sfide WHERE id = ?`
  )
    .bind(sfidaId)
    .first<{
      id: number; titolo: string; punti: number; puntiVincitore: number;
      votazione_dal: string | null; votazione_fino: string | null; risultati_dal: string | null;
    }>();
  const fase = sfida ? faseVotazione(sfida) : null;
  if (!sfida || !fase) return c.json({ error: "Sfida non trovata" }, 404);

  const isCoach = c.var.user.role === "coach";
  const io = c.var.user.userId;
  const vediTutte = isCoach || fase !== "caricamento";
  const vediVoti = isCoach || fase === "risultati";

  const { results } = await c.env.DB.prepare(
    `SELECT p.user_id AS userId, p.foto_url AS foto, a.nome, a.nickname, a.foto_url AS fotoUrl,
            a.foto_personalizzazione AS fotoPersonalizzazione,
            (SELECT COUNT(*) FROM voti_sfide v WHERE v.sfida_id = p.sfida_id AND v.votato_id = p.user_id) AS voti
     FROM partecipazioni_sfide p
     LEFT JOIN athlete_profile a ON a.user_id = p.user_id
     WHERE p.sfida_id = ? ${vediTutte ? "" : "AND p.user_id = ?"}
     ORDER BY p.id`
  )
    .bind(...(vediTutte ? [sfidaId] : [sfidaId, io]))
    .all<{
      userId: number; foto: string | null; nome: string | null; nickname: string | null;
      fotoUrl: string | null; fotoPersonalizzazione: string | null; voti: number;
    }>();

  const mioVoto = await c.env.DB.prepare(`SELECT votato_id AS userId FROM voti_sfide WHERE sfida_id = ? AND votante_id = ?`)
    .bind(sfidaId, io)
    .first<{ userId: number }>();

  const massimo = Math.max(0, ...results.map((r) => r.voti));
  const foto = results.map((r) => ({
    userId: r.userId,
    foto: r.foto,
    nome: r.nome,
    nickname: r.nickname,
    fotoUrl: r.fotoUrl,
    fotoPersonalizzazione: parseFotoPersonalizzazione(r.fotoPersonalizzazione),
    mia: r.userId === io,
    voti: vediVoti ? r.voti : null,
    vincitrice: fase === "risultati" && massimo > 0 && r.voti === massimo,
  }));
  // Coi risultati, la più votata in cima.
  if (vediVoti) foto.sort((a, b) => (b.voti ?? 0) - (a.voti ?? 0));

  return c.json({
    fase,
    votazioneDal: sfida.votazione_dal,
    votazioneFino: sfida.votazione_fino,
    risultatiDal: sfida.risultati_dal,
    puntiVincitore: sfida.puntiVincitore,
    puntiTotali: sfida.punti + sfida.puntiVincitore, // della più votata: quelli di tutte + i suoi in più
    totaleFoto: vediTutte ? results.length : null,
    mioVoto: mioVoto?.userId ?? null,
    foto,
  });
});

// Voto alla foto più bella: un voto a testa (si può cambiare finché è aperto), mai la propria.
// Può votare ogni atleta, anche chi non ha caricato la foto.
sfide.post("/:id/vota", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") return c.json({ error: "Solo gli atleti possono votare" }, 403);
  const sfidaId = Number(c.req.param("id"));
  const body = await c.req.json<{ userId?: number }>().catch(() => ({}) as { userId?: number });
  const votato = Number(body.userId);
  if (!Number.isInteger(votato)) return c.json({ error: "Scegli una foto da votare" }, 400);

  const sfida = await c.env.DB.prepare(`SELECT votazione_dal, votazione_fino, risultati_dal FROM sfide WHERE id = ?`)
    .bind(sfidaId)
    .first<{ votazione_dal: string | null; votazione_fino: string | null; risultati_dal: string | null }>();
  const fase = sfida ? faseVotazione(sfida) : null;
  if (!fase) return c.json({ error: "Sfida non trovata" }, 404);
  if (fase === "caricamento") return c.json({ error: "La votazione non è ancora aperta" }, 400);
  if (fase !== "voto") return c.json({ error: "La votazione è chiusa" }, 400);
  if (votato === c.var.user.userId) return c.json({ error: "Non puoi votare la tua foto 😉" }, 400);

  const partecipa = await c.env.DB.prepare(`SELECT 1 FROM partecipazioni_sfide WHERE sfida_id = ? AND user_id = ?`)
    .bind(sfidaId, votato)
    .first();
  if (!partecipa) return c.json({ error: "Questa atleta non ha caricato la foto" }, 400);

  await c.env.DB.prepare(
    `INSERT INTO voti_sfide (sfida_id, votante_id, votato_id) VALUES (?, ?, ?)
     ON CONFLICT (sfida_id, votante_id) DO UPDATE SET votato_id = excluded.votato_id, data = datetime('now')`
  )
    .bind(sfidaId, c.var.user.userId, votato)
    .run();

  return c.json({ ok: true, mioVoto: votato });
});

sfide.post("/:id/partecipa", requireAuth, async (c) => {
  if (c.var.user.role !== "atleta") {
    return c.json({ error: "Solo gli atleti possono partecipare alle sfide" }, 403);
  }

  const sfidaId = Number(c.req.param("id"));

  const sfida = await c.env.DB.prepare(
    `SELECT id, titolo, tipo, punti, flash, data_inizio, data_fine, foto_richieste,
            votazione_dal, votazione_fino, risultati_dal FROM sfide WHERE id = ?`
  )
    .bind(sfidaId)
    .first<{
      id: number; titolo: string; tipo: string; punti: number; flash: number;
      data_inizio: string; data_fine: string; foto_richieste: number;
      votazione_dal: string | null; votazione_fino: string | null; risultati_dal: string | null;
    }>();
  if (!sfida) return c.json({ error: "Sfida non trovata" }, 404);
  if (sfida.tipo === "traguardo") {
    return c.json({ error: "Questa sfida si completa da sola quando raggiungi il traguardo" }, 400);
  }

  const oggi = adessoRoma().toISOString().slice(0, 10);
  if (sfida.data_fine < oggi) return c.json({ error: "Sfida terminata" }, 400);
  // Una sfida del mese si vede dal 1° (programma pubblicato), ma una "lampo" con date
  // precise (es. Halloween 26–31 ottobre) si può completare solo dentro il suo periodo.
  if (sfida.data_inizio > oggi) return c.json({ error: "La sfida non è ancora iniziata" }, 400);
  // Sfida con votazione: le foto si caricano solo prima che si apra il voto.
  const fase = faseVotazione(sfida);
  if (fase && fase !== "caricamento") return c.json({ error: "Il caricamento delle foto è chiuso: ora si vota!" }, 400);

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

  // Sfida con più foto (es. "3 merende"): ogni foto si salva in sfide_foto; finché non si
  // arriva a foto_richieste niente punti né Feed, si risponde solo col conteggio.
  if (sfida.tipo === "foto" && sfida.foto_richieste > 1 && fotoUrl) {
    await c.env.DB.prepare(`INSERT INTO sfide_foto (sfida_id, user_id, foto_url) VALUES (?, ?, ?)`)
      .bind(sfidaId, c.var.user.userId, fotoUrl)
      .run();
    const n = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM sfide_foto WHERE sfida_id = ? AND user_id = ?`)
      .bind(sfidaId, c.var.user.userId)
      .first<{ n: number }>();
    const caricate = n?.n ?? 0;
    if (caricate < sfida.foto_richieste) {
      return c.json({ ok: true, completata: false, fotoCaricate: caricate, fotoRichieste: sfida.foto_richieste });
    }
  }

  const prima = await snapshotProgressione(c.env.DB, c.var.user.userId);

  // `INSERT OR IGNORE` (vincolo UNIQUE su sfida_id+user_id): due tap ravvicinati non
  // creano una doppia partecipazione. Se non è stata inserita nessuna riga, era già fatta.
  const ins = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO partecipazioni_sfide (sfida_id, user_id, valore, foto_url, data, punti_assegnati) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(sfidaId, c.var.user.userId, valore, fotoUrl, oggi, sfida.punti)
    .run();
  if ((ins.meta.changes ?? 0) === 0) return c.json({ error: "Hai già partecipato a questa sfida" }, 409);

  await awardXp(c.env.DB, c.var.user.userId, "sfida", sfida.punti, sfida.id);

  // Ogni sfida completata finisce nel Feed (scelta di Francesca, 31 ago): quelle foto con
  // la foto, le altre (presenza/valore_manuale) solo col titolo; le "lampo" col prefisso ⚡.
  // I traguardi automatici pubblicano da lib/traguardi.ts.
  // Con votazione la foto resta segreta: nel Feed va solo la più votata, ai risultati
  // (lib/votazioneSfide.ts).
  if (!fase) {
    await c.env.DB.prepare(`INSERT INTO post_feed (user_id, tipo, contenuto_url, testo) VALUES (?, 'sfida', ?, ?)`)
      .bind(c.var.user.userId, fotoUrl, sfida.flash ? `⚡ ${sfida.titolo}` : sfida.titolo)
      .run();
  }

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

  return c.json({ ok: true, completata: true });
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
    foto_richieste?: number;
    data_inizio?: string;
    data_fine?: string;
  }>();
  const { titolo, descrizione, tipo, criterio, data_inizio, data_fine } = body;
  const flash = body.flash ? 1 : 0;
  const fotoRichieste = tipo === "foto" ? Number(body.foto_richieste ?? 1) : 1;

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
  if (!Number.isInteger(fotoRichieste) || fotoRichieste < 1 || fotoRichieste > 10) {
    return c.json({ error: "Il numero di foto deve essere tra 1 e 10" }, 400);
  }

  // Ogni sfida completata vale 10 punti fissi (sistema punti 2026-08) — non più deciso dal coach.
  const PUNTI_SFIDA = 10;
  const result = await c.env.DB.prepare(
    `INSERT INTO sfide (titolo, descrizione, tipo, criterio, punti, flash, foto_richieste, data_inizio, data_fine)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      titolo,
      descrizione ?? null,
      tipo,
      tipo === "traguardo" ? criterio : null,
      PUNTI_SFIDA,
      flash,
      fotoRichieste,
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
