// Sistema di livelli (brief, sezione 5) — permanente, cumulativo, non a streak rigido.
export type Livello = {
  numero: number;
  nome: string;
  colore: string;
  settimaneMin: number;
};

export const LIVELLI: Livello[] = [
  { numero: 1, nome: "Facile", colore: "#8BC53F", settimaneMin: 1 },
  { numero: 2, nome: "Inizio", colore: "#2D7DD2", settimaneMin: 4 },
  { numero: 3, nome: "Intermedio", colore: "#F4B740", settimaneMin: 9 },
  { numero: 4, nome: "Avanzato", colore: "#FF7A29", settimaneMin: 16 },
  { numero: 5, nome: "Esperto", colore: "#E63946", settimaneMin: 25 },
  { numero: 6, nome: "Leggendario", colore: "#A85CFF", settimaneMin: 35 },
];

export type StatoLivello = {
  attuale: Livello;
  prossimo: Livello | null;
  settimaneCompletate: number;
};

// "Settimana completata" = tutti e 3 gli anelli chiusi (Training/Challenges/Feedback),
// calcolato in lib/settimana.ts — cumulativo, non richiede consecutività.
export function calcolaLivello(settimaneCompletate: number): StatoLivello | null {
  if (settimaneCompletate <= 0) return null;

  let attuale = LIVELLI[0];
  for (const l of LIVELLI) {
    if (settimaneCompletate >= l.settimaneMin) attuale = l;
  }
  const prossimo = LIVELLI.find((l) => l.settimaneMin > settimaneCompletate) ?? null;

  return { attuale, prossimo, settimaneCompletate };
}
