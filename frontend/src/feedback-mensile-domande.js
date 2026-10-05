// ────────────────────────────────────────────────────────────────────────────
// Questionario mensile — feedback guidato sul mese appena concluso.
//
// Per cambiare le domande basta riscrivere QUESTO array — salvataggio, riassunto e
// rendering non cambiano.
// Voce: { id, testo, tipo: "faccine" | "singola" | "multipla", max?, opzioni?: [{ v, label, esclusiva? }] }
//   - "faccine": le 5 faccine fisse 😫 😕 😐 🙂 🔥 (nessun opzioni)
//   - "singola" : una sola scelta
//   - "multipla": più scelte, opzionale `max`; un'opzione con `esclusiva: true` azzera le altre
// Risposte salvate: { [id]: "v" }  |  { [id]: ["v1","v2"] }   (per faccine: "1".."5")
// ────────────────────────────────────────────────────────────────────────────
export const FEEDBACK_MENSILE_DOMANDE = [
  {
    id: "andamento",
    testo: "Com'è andato il tuo mese?",
    tipo: "faccine",
  },
  {
    id: "aiutato",
    testo: "Cosa ti ha aiutato di più nel tuo percorso?",
    tipo: "multipla",
    opzioni: [
      { v: "costanza", label: "Costanza" },
      { v: "risultati", label: "Risultati" },
      { v: "allenamenti", label: "Allenamenti" },
      { v: "gruppo", label: "Atmosfera del gruppo" },
      { v: "sfide", label: "Sfide" },
      { v: "alimentazione", label: "Alimentazione" },
      { v: "organizzazione", label: "Organizzazione / orari" },
    ],
  },
  {
    id: "piu",
    testo: "Cosa vorresti trovare di più nei prossimi allenamenti?",
    tipo: "multipla",
    opzioni: [
      { v: "varieta", label: "Varietà" },
      { v: "intensita", label: "Intensità" },
      { v: "tecnica", label: "Lavoro tecnico" },
      { v: "mobilita", label: "Mobilità / stretching" },
      { v: "recupero", label: "Recupero / gradualità" },
      { v: "niente", label: "Niente, va bene così", esclusiva: true },
    ],
  },
  {
    id: "fisico",
    testo: "Come ti sei sentito/a fisicamente questo mese?",
    tipo: "singola",
    opzioni: [
      { v: "energia", label: "In forma e con energia" },
      { v: "bene", label: "Bene" },
      { v: "stanco", label: "Un po' stanco/a" },
      { v: "affaticato", label: "Affaticato/a o acciaccato/a" },
    ],
  },
  {
    id: "prossimo",
    testo: "Su cosa vuoi concentrarti maggiormente il mese prossimo?",
    tipo: "multipla",
    opzioni: [
      { v: "forza", label: "Forza" },
      { v: "resistenza", label: "Resistenza" },
      { v: "mobilita", label: "Mobilità" },
      { v: "forma", label: "Forma fisica" },
      { v: "tecnica", label: "Tecnica" },
      { v: "costanza", label: "Costanza" },
      { v: "energia", label: "Energia / benessere" },
      { v: "alimentazione", label: "Alimentazione / idratazione" },
    ],
  },
];
