// I 5 piani di abbonamento 100FT. Il prezzo NON si mostra mai nell'app dell'atleta —
// solo sulla dashboard coach. ⚠️ Tenere in sync con worker/src/lib/abbonamentiPiani.ts.
export const PIANI = [
  {
    key: "full",
    nome: "FULL",
    giorni: "Lun · Mar · Mer · Ven",
    prezzo: 60,
    colore: "var(--livello-5)",
  },
  {
    key: "trio",
    nome: "TRIO",
    giorni: "Lun · Mer · Ven",
    prezzo: 50,
    colore: "var(--livello-2)",
  },
  {
    key: "solo",
    nome: "SOLO",
    giorni: "1 giorno a settimana a scelta",
    prezzo: 25,
    colore: "var(--livello-1)",
  },
  {
    key: "mix",
    nome: "MIX",
    giorni: "1 funzionale + Mar + 1 corso fitness in palestra a scelta",
    prezzo: 50,
    colore: "var(--livello-6)",
  },
  {
    key: "fitnessdream",
    nome: "FITNESSDREAM",
    giorni:
      "Lun · Mer · Ven — valido solo per chi ha un abbonamento attivo ai corsi della palestra FitnessDream",
    prezzo: 30,
    colore: "var(--sessione-extra)",
  },
];

// Nota fissa in fondo alla card "Abbonamenti": cosa si fa nei vari giorni.
export const LEGENDA_GIORNI =
  "Lun · Mer · Ven: allenamento funzionale — Mar: core & stretching";

export function pianoByKey(key) {
  return PIANI.find((p) => p.key === key) ?? null;
}
