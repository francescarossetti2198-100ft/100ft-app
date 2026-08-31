// I 5 piani di abbonamento 100FT — chiave, nome, prezzo (in €).
// ⚠️ Tenere in sync con frontend/src/abbonamenti.js.
export type PianoKey = "full" | "trio" | "duo" | "solo" | "mix" | "fitnessdream";

export const PIANI: { key: PianoKey; nome: string; prezzo: number }[] = [
  { key: "full", nome: "FULL", prezzo: 60 },
  { key: "trio", nome: "TRIO", prezzo: 50 },
  { key: "duo", nome: "DUO", prezzo: 35 },
  { key: "solo", nome: "SOLO", prezzo: 25 },
  { key: "mix", nome: "MIX", prezzo: 50 },
  { key: "fitnessdream", nome: "FITNESSDREAM", prezzo: 30 },
];

const BY_KEY = new Map(PIANI.map((p) => [p.key, p]));

export function pianoValido(key: string): key is PianoKey {
  return BY_KEY.has(key as PianoKey);
}

export function prezzoPiano(key: string | null | undefined): number | null {
  return key ? (BY_KEY.get(key as PianoKey)?.prezzo ?? null) : null;
}

export function nomePiano(key: string | null | undefined): string | null {
  return key ? (BY_KEY.get(key as PianoKey)?.nome ?? null) : null;
}
