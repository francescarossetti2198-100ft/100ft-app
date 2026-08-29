// ────────────────────────────────────────────────────────────────────────────
// Questionario mensile — feedback guidato sul mese appena concluso.
//
// ⚠️ SEGNAPOSTO: Francesca fornirà le domande definitive. Per sostituirle basta
// riscrivere QUESTO array — salvataggio, riassunto e rendering non cambiano.
// Voce: { id, testo, tipo: "faccine" | "singola" | "multipla", max?, opzioni?: [{ v, label }] }
//   - "faccine": le 5 faccine fisse 😫 😕 😐 🙂 🔥 (nessun opzioni: da fornire)
//   - "singola" : una sola scelta
//   - "multipla": più scelte, opzionale `max`
// Risposte salvate: { [id]: "v" }  |  { [id]: ["v1","v2"] }   (per faccine: "1".."5")
// ────────────────────────────────────────────────────────────────────────────
export const FEEDBACK_MENSILE_DOMANDE = [
  {
    id: "andamento",
    testo: "Com'è andato il mese?",
    tipo: "faccine",
  },
  {
    id: "funzionato",
    testo: "Cosa ha funzionato di più?",
    tipo: "multipla",
    opzioni: [
      { v: "costanza", label: "La mia costanza" },
      { v: "risultati", label: "I risultati sul corpo" },
      { v: "gruppo", label: "L'atmosfera del gruppo" },
      { v: "sfide", label: "Le sfide" },
      { v: "coach", label: "Il rapporto con la coach" },
      { v: "organizzazione", label: "L'organizzazione / gli orari" },
    ],
  },
  {
    id: "mancato",
    testo: "Cosa è mancato o vorresti diverso?",
    tipo: "multipla",
    opzioni: [
      { v: "varieta", label: "Più varietà" },
      { v: "intensita", label: "Più intensità" },
      { v: "tecnica", label: "Più lavoro tecnico" },
      { v: "mobilita", label: "Più mobilità / stretching" },
      { v: "individuale", label: "Più attenzione individuale" },
      { v: "recupero", label: "Più recupero / gradualità" },
      { v: "niente", label: "Niente, tutto ok" },
    ],
  },
  {
    id: "sensazione",
    testo: "Come ti sei sentito fisicamente questo mese?",
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
    testo: "Su cosa vuoi puntare il mese prossimo?",
    tipo: "multipla",
    max: 2,
    opzioni: [
      { v: "forza", label: "Forza" },
      { v: "resistenza", label: "Resistenza" },
      { v: "mobilita", label: "Mobilità" },
      { v: "dimagrimento", label: "Dimagrimento" },
      { v: "tecnica", label: "Tecnica" },
      { v: "costanza", label: "Costanza" },
    ],
  },
];
