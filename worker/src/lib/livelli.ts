// Sistema di livelli (brief, sezione 5) — permanente, cumulativo, non a streak.
// Unità di misura = numero di singoli allenamenti fatti (presenze confermate dal coach),
// NON le settimane: nessuna consecutività richiesta. Gli anelli settimanali della Home
// sono solo una statistica e non incidono sul livello.
export type Livello = {
  numero: number;
  nome: string;
  colore: string;
  allenamentiMin: number;
};

// Soglie decise da Francesca (equivalenti a 1/6/12/20/25/30 settimane da 3 allenamenti).
export const LIVELLI: Livello[] = [
  { numero: 1, nome: "Facile", colore: "#8BC53F", allenamentiMin: 3 },
  { numero: 2, nome: "Inizio", colore: "#2D7DD2", allenamentiMin: 18 },
  { numero: 3, nome: "Intermedio", colore: "#F4B740", allenamentiMin: 36 },
  { numero: 4, nome: "Avanzato", colore: "#FF7A29", allenamentiMin: 60 },
  { numero: 5, nome: "Esperto", colore: "#E63946", allenamentiMin: 75 },
  { numero: 6, nome: "Leggendario", colore: "#A85CFF", allenamentiMin: 90 },
];

export type StatoLivello = {
  attuale: Livello;
  prossimo: Livello | null;
  allenamentiFatti: number;
};

export function calcolaLivello(allenamentiFatti: number): StatoLivello | null {
  if (allenamentiFatti <= 0) return null;

  let attuale = LIVELLI[0];
  for (const l of LIVELLI) {
    if (allenamentiFatti >= l.allenamentiMin) attuale = l;
  }
  const prossimo = LIVELLI.find((l) => l.allenamentiMin > allenamentiFatti) ?? null;

  return { attuale, prossimo, allenamentiFatti };
}
