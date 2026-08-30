// Sfide "traguardo": si completano da sole quando l'atleta soddisfa un criterio
// verificabile dallo stato dell'app. Da richiamare quando l'atleta apre le Sfide o il
// Profilo (e in coda a una partecipazione manuale, per il bonus mese).
import { awardXp } from "./xp";
import { snapshotProgressione, segnalaAvanzamento } from "./progressione";
import { stagioneDi, verificaEAssegnaTrofeo } from "./trofei";
import { parseRisposte } from "./questionario";

const PUNTI_SFIDA = 10;
const PUNTI_BONUS_MESE = 10;

const NOMI_MESE = [
  "", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

// "2026-09" -> "Settembre 2026"
function etichettaMese(meseKey: string): string {
  const [anno, mm] = meseKey.split("-");
  return `${NOMI_MESE[Number(mm)] ?? meseKey} ${anno}`;
}

// Criteri ammessi per tipo = 'traguardo'.
export const CRITERI_TRAGUARDO = ["profilo_completo", "obiettivi_completi", "daily_drop"] as const;
export function criterioValido(criterio: string): boolean {
  return (CRITERI_TRAGUARDO as readonly string[]).includes(criterio) || /^presenze:([1-9]\d?)$/.test(criterio);
}

type SfidaTraguardo = {
  id: number;
  criterio: string | null;
  data_inizio: string;
  data_fine: string;
};

async function criterioSoddisfatto(db: D1Database, userId: number, s: SfidaTraguardo): Promise<boolean> {
  const criterio = s.criterio ?? "";

  if (criterio === "profilo_completo") {
    const r = await db
      .prepare(
        `SELECT ap.foto_url AS foto, ap.nickname, ap.data_nascita AS dn, av.peso, av.altezza
         FROM athlete_profile ap
         LEFT JOIN athlete_private av ON av.user_id = ap.user_id
         WHERE ap.user_id = ?`
      )
      .bind(userId)
      .first<{ foto: string | null; nickname: string | null; dn: string | null; peso: number | null; altezza: number | null }>();
    return !!(r && r.foto && r.nickname && r.dn && r.peso != null && r.altezza != null);
  }

  if (criterio === "obiettivi_completi") {
    const r = await db
      .prepare(`SELECT personalizzazione FROM athlete_private WHERE user_id = ?`)
      .bind(userId)
      .first<{ personalizzazione: string | null }>();
    return Object.keys(parseRisposte(r?.personalizzazione)).length > 0;
  }

  if (criterio === "daily_drop") {
    const r = await db
      .prepare(`SELECT 1 FROM post_feed WHERE user_id = ? AND tipo = 'daily_drop' LIMIT 1`)
      .bind(userId)
      .first();
    return !!r;
  }

  const m = criterio.match(/^presenze:(\d+)$/);
  if (m) {
    const r = await db
      .prepare(
        `SELECT COUNT(*) AS c FROM presenze
         WHERE user_id = ? AND confermata = 1 AND data BETWEEN ? AND ?`
      )
      .bind(userId, s.data_inizio, s.data_fine)
      .first<{ c: number }>();
    return (r?.c ?? 0) >= Number(m[1]);
  }

  return false;
}

export async function verificaTraguardi(db: D1Database, userId: number): Promise<void> {
  const oggi = new Date().toISOString().slice(0, 10);
  const { results } = await db
    .prepare(
      `SELECT s.id, s.criterio, s.data_inizio, s.data_fine
       FROM sfide s
       WHERE s.tipo = 'traguardo' AND s.data_fine >= ?
         AND (s.data_inizio <= ? OR substr(s.data_inizio, 1, 7) IN
           (SELECT printf('%04d-%02d', anno, mese) FROM programma_mensile WHERE pubblicato = 1))
         AND NOT EXISTS (SELECT 1 FROM partecipazioni_sfide p WHERE p.sfida_id = s.id AND p.user_id = ?)`
    )
    .bind(oggi, oggi, userId)
    .all<SfidaTraguardo>();

  for (const s of results) {
    if (!(await criterioSoddisfatto(db, userId, s))) continue;

    const prima = await snapshotProgressione(db, userId);
    await db
      .prepare(
        `INSERT INTO partecipazioni_sfide (sfida_id, user_id, valore, foto_url, data, punti_assegnati)
         VALUES (?, ?, NULL, NULL, ?, ?)`
      )
      .bind(s.id, userId, oggi, PUNTI_SFIDA)
      .run();
    await awardXp(db, userId, "sfida", PUNTI_SFIDA);
    const dopo = await snapshotProgressione(db, userId);
    await segnalaAvanzamento(db, userId, prima, dopo);

    const blocco = stagioneDi(s.data_inizio);
    if (blocco) await verificaEAssegnaTrofeo(db, userId, blocco.stagione, blocco.blocco);

    await verificaBonusMese(db, userId, s.data_inizio.slice(0, 7));
  }
}

// +10 punti se l'atleta ha completato TUTTE le sfide del mese (che ne ha almeno una).
export async function verificaBonusMese(db: D1Database, userId: number, meseKey: string): Promise<void> {
  const azione = `sfide_mese_complete_${meseKey.replace("-", "_")}`;
  const gia = await db
    .prepare(`SELECT 1 FROM xp_log WHERE user_id = ? AND azione = ? LIMIT 1`)
    .bind(userId, azione)
    .first();
  if (gia) return;

  const c = await db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM sfide WHERE substr(data_inizio, 1, 7) = ?) AS totali,
         (SELECT COUNT(*) FROM sfide s
           JOIN partecipazioni_sfide p ON p.sfida_id = s.id
          WHERE substr(s.data_inizio, 1, 7) = ? AND p.user_id = ?) AS fatte`
    )
    .bind(meseKey, meseKey, userId)
    .first<{ totali: number; fatte: number }>();

  if (c && c.totali > 0 && c.fatte >= c.totali) {
    await awardXp(db, userId, azione, PUNTI_BONUS_MESE);
    // Badge del mese conquistato -> post nel Feed (una sola volta: la guard su xp_log sopra
    // impedisce di rientrare qui per lo stesso mese).
    await db
      .prepare(`INSERT INTO post_feed (user_id, tipo, testo) VALUES (?, 'badge', ?)`)
      .bind(userId, etichettaMese(meseKey))
      .run();
  }
}
