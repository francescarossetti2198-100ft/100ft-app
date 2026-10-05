// Personalizzazione dell'anello della foto profilo atleta (colore/stile/intensità).
// Deve restare allineata alle stesse chiavi validate in worker/src/routes/profilo.ts.

export const COLORI_FOTO = [
  { key: "viola", label: "Viola", hex: "#8b5cf6" },
  { key: "blu", label: "Blu", hex: "#2d7dd2" },
  { key: "verde", label: "Verde", hex: "#8bc53f" },
  { key: "arancio", label: "Arancio", hex: "#ff7a29" },
  { key: "rosso", label: "Rosso", hex: "#e63946" },
  { key: "rosa", label: "Rosa", hex: "#e8779c" },
  { key: "giallo", label: "Giallo", hex: "#f4b740" },
  { key: "bianco", label: "Bianco", hex: "#ffffff" },
];

export const STILI_FOTO = [
  { key: "solid", label: "Solid", desc: "Bordo pieno, pulito e minimal" },
  { key: "gradient", label: "Gradient", desc: "Sfumatura elegante" },
  { key: "glow", label: "Glow", desc: "Un leggero alone luminoso" },
  { key: "double", label: "Double", desc: "Doppio anello sottile" },
  { key: "dashed", label: "Dashed", desc: "Tratteggiato, molto discreto" },
  { key: "minimal", label: "Minimal", desc: "Estremamente sottile" },
];

export const INTENSITA_FOTO = [
  { key: "sottile", label: "Sottile" },
  { key: "medio", label: "Medio" },
  { key: "forte", label: "Forte" },
];

export const DEFAULT_FOTO_PERSONALIZZAZIONE = { colore: "viola", stile: "solid", intensita: "medio" };

function hexOf(coloreKey) {
  return COLORI_FOTO.find((c) => c.key === coloreKey)?.hex ?? COLORI_FOTO[0].hex;
}

const SPESSORE = { sottile: 2, medio: 3, forte: 5 };
const SPESSORE_MINIMAL = { sottile: 1, medio: 1.5, forte: 2 };
const ALPHA_MINIMAL = { sottile: 55, medio: 70, forte: 88 };
const GLOW = {
  sottile: { blur: 8, spread: 0, alpha: 32 },
  medio: { blur: 14, spread: 1, alpha: 42 },
  forte: { blur: 20, spread: 2, alpha: 55 },
};
const GAP_DOPPIO = { sottile: 2, medio: 3, forte: 4 };

// Sottile filo neutro sempre presente (oltre al colore scelto): dà definizione
// all'anello anche col Bianco su sfondo chiaro, senza cambiare la tinta.
const FILO = "box-shadow:0 0 0 1px var(--border);";

// Stile inline del wrapper <span> attorno alla foto (border-radius:50% applicato dal
// chiamante). Ritorna null se non c'è personalizzazione: il chiamante allora usa il
// bordo neutro di sempre, invariato.
export function anelloWrapperStyle(personalizzazione) {
  if (!personalizzazione?.colore || !personalizzazione?.stile) return null;
  const hex = hexOf(personalizzazione.colore);
  const intensita = INTENSITA_FOTO.some((i) => i.key === personalizzazione.intensita) ? personalizzazione.intensita : "medio";

  switch (personalizzazione.stile) {
    case "solid": {
      const s = SPESSORE[intensita];
      return `padding:${s}px; background:${hex}; ${FILO}`;
    }
    case "gradient": {
      const s = SPESSORE[intensita];
      const grad = `conic-gradient(from 210deg, color-mix(in srgb, ${hex} 55%, black), ${hex} 45%, color-mix(in srgb, ${hex} 35%, white) 75%, ${hex})`;
      return `padding:${s}px; background:${grad}; ${FILO}`;
    }
    case "glow": {
      const g = GLOW[intensita];
      return `padding:1.5px; background:color-mix(in srgb, ${hex} 75%, transparent);
              box-shadow:0 0 ${g.blur}px ${g.spread}px color-mix(in srgb, ${hex} ${g.alpha}%, transparent), 0 0 0 1px var(--border);`;
    }
    case "double": {
      const gap = GAP_DOPPIO[intensita];
      const r2 = 1.5 + gap;
      const r3 = r2 + 1.5;
      return `padding:0; box-shadow:0 0 0 1.5px ${hex}, 0 0 0 ${r2}px var(--surface), 0 0 0 ${r3}px ${hex}, 0 0 0 ${r3 + 1}px var(--border);`;
    }
    case "dashed": {
      const s = SPESSORE[intensita];
      return `padding:3px; border:${s}px dashed ${hex}; ${FILO}`;
    }
    case "minimal": {
      const s = SPESSORE_MINIMAL[intensita];
      const a = ALPHA_MINIMAL[intensita];
      return `padding:${s}px; background:color-mix(in srgb, ${hex} ${a}%, transparent); ${FILO}`;
    }
    default:
      return null;
  }
}
