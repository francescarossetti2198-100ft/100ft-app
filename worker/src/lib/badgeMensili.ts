// Badge mensili (Set→Lug della stagione): uno per mese, "conquistato" quando l'atleta
// ha completato TUTTE le sfide di quel mese. Nessuna tabella dedicata — il segnale è la
// riga xp_log azione = 'sfide_mese_complete_YYYY_MM' scritta da verificaBonusMese()
// in lib/traguardi.ts (o il conteggio fatte>=totali per i mesi ancora in corso).
import { stagioneCorrente } from "./trofei";

const NOMI_MESE = [
  "", "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

// I mesi di una stagione, in ordine: Set–Dic dell'anno di stagione, Gen–Lug dell'anno dopo.
export function mesiStagione(stagione: number): { mese: number; anno: number }[] {
  const out: { mese: number; anno: number }[] = [];
  for (let m = 9; m <= 12; m++) out.push({ mese: m, anno: stagione });
  for (let m = 1; m <= 7; m++) out.push({ mese: m, anno: stagione + 1 });
  return out;
}

export type BadgeMese = {
  mese: number;
  anno: number;
  nome: string;
  conquistato: boolean;
  fatte: number;
  totali: number;
};

export async function statoBadgeMensili(
  db: D1Database,
  userId: number,
  stagione = stagioneCorrente()
): Promise<BadgeMese[]> {
  const mesi = mesiStagione(stagione);

  const { results: conteggi } = await db
    .prepare(
      `SELECT substr(s.data_inizio, 1, 7) AS k,
              COUNT(DISTINCT s.id) AS totali,
              COUNT(DISTINCT CASE WHEN p.user_id = ? THEN s.id END) AS fatte
       FROM sfide s
       LEFT JOIN partecipazioni_sfide p ON p.sfida_id = s.id
       GROUP BY substr(s.data_inizio, 1, 7)`
    )
    .bind(userId)
    .all<{ k: string; totali: number; fatte: number }>();
  const perMese = new Map(conteggi.map((r) => [r.k, r]));

  const { results: bonus } = await db
    .prepare(`SELECT azione FROM xp_log WHERE user_id = ? AND azione LIKE 'sfide_mese_complete_%'`)
    .bind(userId)
    .all<{ azione: string }>();
  const bonusSet = new Set(bonus.map((r) => r.azione));

  return mesi.map(({ mese, anno }) => {
    const mm = String(mese).padStart(2, "0");
    const c = perMese.get(`${anno}-${mm}`);
    const totali = c?.totali ?? 0;
    const fatte = c?.fatte ?? 0;
    return {
      mese,
      anno,
      nome: NOMI_MESE[mese],
      conquistato: bonusSet.has(`sfide_mese_complete_${anno}_${mm}`) || (totali > 0 && fatte >= totali),
      fatte,
      totali,
    };
  });
}
