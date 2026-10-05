// Trofei di stagione — 2 per stagione:
//   'autunno'   -> tutte le sfide di settembre..dicembre completate
//   'primavera' -> tutte le sfide di gennaio..luglio completate
// La stagione parte a settembre; gen..lug appartiene alla stagione iniziata a settembre
// dell'anno prima. Agosto è fuori stagione (nessun trofeo).

import { adessoRoma } from "./oggi";

export type Blocco = "autunno" | "primavera";

export const BLOCCO_ETICHETTA: Record<Blocco, string> = {
  autunno: "Set–Dic",
  primavera: "Gen–Lug",
};

// Blocco + stagione a cui appartiene una data YYYY-MM-DD (null per agosto / data non valida).
export function stagioneDi(dataInizio: string): { stagione: number; blocco: Blocco } | null {
  const m = Number(dataInizio.slice(5, 7));
  const anno = Number(dataInizio.slice(0, 4));
  if (!anno || !m) return null;
  if (m >= 9 && m <= 12) return { stagione: anno, blocco: "autunno" };
  if (m >= 1 && m <= 7) return { stagione: anno - 1, blocco: "primavera" };
  return null; // agosto
}

// Intervallo [dataMin, dataMax] delle sfide di un blocco (per il filtro su sfide.data_inizio).
export function intervalloBlocco(stagione: number, blocco: Blocco): [string, string] {
  return blocco === "autunno"
    ? [`${stagione}-09-01`, `${stagione}-12-31`]
    : [`${stagione + 1}-01-01`, `${stagione + 1}-07-31`];
}

// Stagione "corrente" (agosto rotola già alla stagione nuova).
export function stagioneCorrente(now: Date = adessoRoma()): number {
  const m = now.getUTCMonth() + 1;
  return m >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

async function conteggiBlocco(db: D1Database, userId: number, stagione: number, blocco: Blocco) {
  const [min, max] = intervalloBlocco(stagione, blocco);
  const totale = await db
    .prepare(`SELECT COUNT(*) AS n FROM sfide WHERE data_inizio BETWEEN ? AND ?`)
    .bind(min, max)
    .first<{ n: number }>();
  const fatte = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM partecipazioni_sfide ps
       JOIN sfide s ON s.id = ps.sfida_id
       WHERE ps.user_id = ? AND s.data_inizio BETWEEN ? AND ?`
    )
    .bind(userId, min, max)
    .first<{ n: number }>();
  return { totale: totale?.n ?? 0, fatte: fatte?.n ?? 0 };
}

// Da chiamare dopo che un atleta ha completato una sfida: se ha chiuso tutto il blocco,
// gli assegna il trofeo (idempotente).
export async function verificaEAssegnaTrofeo(
  db: D1Database,
  userId: number,
  stagione: number,
  blocco: Blocco
): Promise<void> {
  const { totale, fatte } = await conteggiBlocco(db, userId, stagione, blocco);
  if (totale > 0 && fatte >= totale) {
    await db
      .prepare(
        `INSERT INTO trofei (user_id, stagione, blocco) VALUES (?, ?, ?)
         ON CONFLICT (user_id, stagione, blocco) DO NOTHING`
      )
      .bind(userId, stagione, blocco)
      .run();
  }
}

export type StatoTrofeo = {
  blocco: Blocco;
  stagione: number;
  etichetta: string;
  conquistato: boolean;
  fatte: number;
  totale: number;
};

// Stato dei 2 trofei di una stagione per un atleta (per Profilo e pagina Sfide).
export async function statoTrofei(
  db: D1Database,
  userId: number,
  stagione = stagioneCorrente()
): Promise<StatoTrofeo[]> {
  const { results } = await db
    .prepare(`SELECT blocco FROM trofei WHERE user_id = ? AND stagione = ?`)
    .bind(userId, stagione)
    .all<{ blocco: Blocco }>();
  const conquistati = new Set(results.map((r) => r.blocco));

  const blocchi: Blocco[] = ["autunno", "primavera"];
  return Promise.all(
    blocchi.map(async (blocco) => {
      const { totale, fatte } = await conteggiBlocco(db, userId, stagione, blocco);
      return {
        blocco,
        stagione,
        etichetta: BLOCCO_ETICHETTA[blocco],
        conquistato: conquistati.has(blocco) || (totale > 0 && fatte >= totale),
        fatte,
        totale,
      };
    })
  );
}
