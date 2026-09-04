// Box guidati per la richiesta pre-allenamento. Sorgente unica: usata da home.js
// (form atleta + lista), coach.js (lista coach) e profilo.js (scheda atleta).
// Deve combaciare col CHECK della migrazione 0018 e con worker/src/routes/richieste.ts.
// "Altro" resta come rete di sicurezza per le richieste vecchie; non c'è più testo libero.

export const CATEGORIE_RICHIESTA = [
  { v: "Upper body", emoji: "💪" },
  { v: "Lower body", emoji: "🦵" },
  { v: "Addome / core", emoji: "🎯" },
  { v: "Mobilità", emoji: "🧘" },
  { v: "Stretching", emoji: "🤸" },
  { v: "Alta intensità", emoji: "🔥" },
  { v: "Lavoro tecnico", emoji: "🛠️" },
  { v: "Propriocezione", emoji: "🧠" },
  { v: "Equilibrio", emoji: "⚖️" },
  { v: "Isometria", emoji: "⏱️" },
  { v: "Altro", emoji: "✏️" },
];

const EMOJI = Object.fromEntries(CATEGORIE_RICHIESTA.map((c) => [c.v, c.emoji]));

// "💪 Upper body" — se la categoria non è nell'elenco (dato vecchio) torna il valore grezzo.
export function etichettaCategoria(cat) {
  if (!cat) return "";
  return EMOJI[cat] ? `${EMOJI[cat]} ${cat}` : cat;
}
