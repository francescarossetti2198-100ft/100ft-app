// Campi dei test di forza — usati per validare i POST.
// ⚠️ Tenere in sync con frontend/src/test-forza.js (stesse chiavi e limiti).
// tipo: "rip" = ripetizioni, "sec" = secondi, "kg" = carico, "si_no" = flag, "testo" = nota breve.
type Campo = { chiave: string; tipo: "rip" | "sec" | "kg" | "si_no" | "testo"; max?: number };

export const TEST_FORZA_CAMPI: Campo[] = [
  { chiave: "push_up", tipo: "rip", max: 300 },
  { chiave: "push_up_ginocchia", tipo: "si_no" },
  { chiave: "trx", tipo: "rip", max: 300 },
  { chiave: "trx_segno", tipo: "testo", max: 40 },
  { chiave: "goblet", tipo: "rip", max: 300 },
  { chiave: "goblet_kg", tipo: "kg", max: 200 },
  { chiave: "plank", tipo: "sec", max: 1800 },
  { chiave: "wall_sit", tipo: "sec", max: 1800 },
];

// Tiene solo i campi noti e validi; i campi vuoti/null vengono scartati (risultato parziale ok).
// Ritorna null se un valore presente è fuori limite, così il POST risponde 400.
export function validaRisultati(input: unknown): Record<string, number | boolean | string> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const src = input as Record<string, unknown>;
  const out: Record<string, number | boolean | string> = {};
  for (const c of TEST_FORZA_CAMPI) {
    const v = src[c.chiave];
    if (v === undefined || v === null || v === "") continue;
    if (c.tipo === "si_no") {
      if (typeof v !== "boolean") return null;
      if (v) out[c.chiave] = true;
    } else if (c.tipo === "testo") {
      if (typeof v !== "string") return null;
      const t = v.trim();
      if (t.length > (c.max ?? 40)) return null;
      if (t) out[c.chiave] = t;
    } else {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > (c.max ?? 1000)) return null;
      // kg può avere il mezzo chilo (es. 12,5); ripetizioni e secondi sono interi.
      out[c.chiave] = c.tipo === "kg" ? Math.round(n * 2) / 2 : Math.round(n);
    }
  }
  return out;
}

export function parseRisultati(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}
