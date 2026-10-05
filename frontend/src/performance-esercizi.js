// Esercizi fondamentali 100FT per la sezione "Performance" del profilo.
// L'atleta registra SOLO il peso in kg usato — nient'altro (serie/rip/RPE/durata).
// ⚠️ Tenere in sync con worker/src/lib/performanceEsercizi.ts (validazione server).
export const PERFORMANCE_ESERCIZI = [
  {
    categoria: "Parte bassa",
    emoji: "🦵",
    esercizi: [
      "Squat manubri",
      "Squat bilanciere",
      "Sumo squat manubri",
      "Sumo squat bilanciere",
      "Stacco",
      "Affondo manubri",
      "Affondo bilanciere",
      "Good morning",
      "Goblet squat",
      "Affondi bulgari",
    ],
  },
  {
    categoria: "Upper body",
    emoji: "💪",
    esercizi: [
      "Rematore manubri",
      "Rematore bilanciere",
      "Shoulder press manubri",
      "Shoulder press bilanciere",
      "Curl manubri",
      "Curl bilanciere",
      "Tricipiti manubri",
      "Chest press (petto) manubri",
      "Chest press (petto) bilanciere",
      "Alzate frontali",
      "Alzate laterali",
    ],
  },
];

// Elenco piatto di tutti i nomi validi.
export const PERFORMANCE_ESERCIZI_NOMI = PERFORMANCE_ESERCIZI.flatMap((c) => c.esercizi);
