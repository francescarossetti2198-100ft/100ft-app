// Test di forza: un blocco per test, ognuno col valore principale ed eventuali dettagli
// (ginocchia, segno a terra, kg). Le chiavi ⚠️ devono restare in sync con
// worker/src/lib/testForza.ts (TEST_FORZA_CAMPI), che le valida.
// tipo: "rip" = ripetizioni, "sec" = tempo (si scrive 1:45 o 105), "kg", "si_no", "testo".
export const TEST_FORZA = [
  {
    nome: "Push-up",
    emoji: "💪",
    regola: "1 minuto · petto a un pugno da terra, braccia tese in alto",
    campi: [
      { chiave: "push_up", tipo: "rip", label: "Ripetizioni" },
      { chiave: "push_up_ginocchia", tipo: "si_no", label: "Sulle ginocchia" },
    ],
  },
  {
    nome: "TRX pull-up",
    emoji: "🔙",
    regola: "1 minuto · corpo dritto, mani al petto",
    campi: [
      { chiave: "trx", tipo: "rip", label: "Ripetizioni" },
      { chiave: "trx_segno", tipo: "testo", label: "Dove avevi i talloni", placeholder: "es. segno 3" },
    ],
  },
  {
    nome: "Goblet squat",
    emoji: "🦵",
    regola: "1 minuto · anca sotto il ginocchio, su a gambe tese",
    campi: [
      { chiave: "goblet", tipo: "rip", label: "Ripetizioni" },
      { chiave: "goblet_kg", tipo: "kg", label: "Manubrio (kg)" },
    ],
  },
  {
    nome: "Plank",
    emoji: "🧱",
    regola: "Tempo massimo sui gomiti, corpo dritto",
    campi: [{ chiave: "plank", tipo: "sec", label: "Tempo" }],
  },
  {
    nome: "Wall sit",
    emoji: "🧱",
    regola: "Tempo massimo · cosce parallele, mani lontane dalle gambe",
    campi: [{ chiave: "wall_sit", tipo: "sec", label: "Tempo" }],
  },
];

// 105 → "1:45"
export function formattaSecondi(s) {
  if (s == null || s === "") return "";
  const n = Number(s);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}

// "1:45" / "1.45" / "105" → 105; "" → null; non valido → NaN
export function leggiSecondi(testo) {
  const t = String(testo ?? "").trim();
  if (!t) return null;
  const m = t.match(/^(\d{1,2})[:.,](\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

// Valore leggibile di un campo, per riepiloghi e tabella coach.
export function valoreLeggibile(campo, v) {
  if (v == null || v === "" || v === false) return "";
  if (campo.tipo === "sec") return formattaSecondi(v);
  if (campo.tipo === "kg") return `${String(v).replace(".", ",")} kg`;
  if (campo.tipo === "si_no") return campo.label.toLowerCase();
  return String(v);
}
