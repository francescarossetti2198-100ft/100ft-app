// I piani di abbonamento 100FT — chiave, nome, prezzo (in €).
// ⚠️ Tenere in sync con frontend/src/abbonamenti.js.
export type PianoKey = "full" | "trio" | "solo" | "fitnessdream";

export const PIANI: { key: PianoKey; nome: string; prezzo: number }[] = [
  { key: "full", nome: "FULL", prezzo: 60 },
  { key: "trio", nome: "TRIO", prezzo: 50 },
  { key: "solo", nome: "SOLO", prezzo: 30 },
  { key: "fitnessdream", nome: "FITNESSDREAM", prezzo: 30 },
];

// Piani non più offerti ma che possono ancora comparire in dati storici (pagamenti,
// scelte, suddivisioni). Servono a mostrarne nome/prezzo senza offrirli nella scelta.
const PIANI_STORICI: { key: string; nome: string; prezzo: number }[] = [
  { key: "mix", nome: "MIX", prezzo: 50 },
];

const BY_KEY = new Map(PIANI.map((p) => [p.key, p]));
// include anche gli storici: per leggere nome/prezzo di un piano vecchio già salvato.
const BY_KEY_TUTTI = new Map<string, { nome: string; prezzo: number }>([
  ...PIANI.map((p) => [p.key, p] as const),
  ...PIANI_STORICI.map((p) => [p.key, p] as const),
]);

// Un piano "valido" è uno di quelli ANCORA offerti — usato per validare la scelta di un atleta.
export function pianoValido(key: string): key is PianoKey {
  return BY_KEY.has(key as PianoKey);
}

export function prezzoPiano(key: string | null | undefined): number | null {
  return key ? (BY_KEY_TUTTI.get(key)?.prezzo ?? null) : null;
}

export function nomePiano(key: string | null | undefined): string | null {
  return key ? (BY_KEY_TUTTI.get(key)?.nome ?? null) : null;
}
