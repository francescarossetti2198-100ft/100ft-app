// Helper condiviso: presenze, sfide e feedback possono tutti far chiudere una settimana o
// far salire di livello — questa logica va richiamata dopo ciascuna delle tre azioni.
import { calcolaAnelli, type StatoAnelli } from "./settimana";
import { calcolaLivello, type StatoLivello } from "./livelli";
import { pubblicaPost } from "./feed";
import { assegnaMilestone } from "./milestones";

export type Snapshot = { anelli: StatoAnelli; livello: StatoLivello | null };

// Il livello ora si calcola dal numero di allenamenti (presenze confermate), non dalle
// settimane complete — vedi lib/livelli.ts.
export async function snapshotProgressione(db: D1Database, userId: number): Promise<Snapshot> {
  const [anelli, presenze] = await Promise.all([
    calcolaAnelli(db, userId),
    db
      .prepare(`SELECT COUNT(*) AS n FROM presenze WHERE user_id = ? AND confermata = 1`)
      .bind(userId)
      .first<{ n: number }>(),
  ]);
  return { anelli, livello: calcolaLivello(presenze?.n ?? 0) };
}

export async function segnalaAvanzamento(
  db: D1Database,
  userId: number,
  prima: Snapshot,
  dopo: Snapshot
): Promise<void> {
  if (dopo.livello && (!prima.livello || dopo.livello.attuale.numero > prima.livello.attuale.numero)) {
    await pubblicaPost(db, userId, "level_up", `Livello ${dopo.livello.attuale.numero} — ${dopo.livello.attuale.nome}`);
  }

  // "consistency" ora segnala settimane complete cumulative (non più uno streak), ogni 4.
  if (
    dopo.anelli.settimaneCompletateTotali > prima.anelli.settimaneCompletateTotali &&
    dopo.anelli.settimaneCompletateTotali % 4 === 0
  ) {
    await pubblicaPost(db, userId, "consistency", `${dopo.anelli.settimaneCompletateTotali} settimane completate`);
  }

  if (dopo.livello?.attuale.numero === 2 && (!prima.livello || prima.livello.attuale.numero < 2)) {
    await assegnaMilestone(db, userId, "first_month");
  }
}
