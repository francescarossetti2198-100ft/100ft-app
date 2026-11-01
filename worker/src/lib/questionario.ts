// Helper condivisi per i questionari a risposta guidata (personalizzazione del profilo,
// feedback mensile). Le domande vivono nel frontend; qui si conservano/validano solo le
// scelte dell'atleta, un oggetto { idDomanda: stringa | stringa[] }.

export type RisposteQuestionario = Record<string, string | string[]>;

// Parsing difensivo di una colonna JSON: qualunque cosa non torni diventa {}.
export function parseRisposte(raw: string | null | undefined): RisposteQuestionario {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

// Valida l'oggetto in arrivo dal client: solo valori "piccoli" (stringa o array di
// stringhe), serializzato < 2KB. Le domande vere (e quindi i valori ammessi) stanno nel
// frontend — qui si tiene solo la forma.
export function validaRisposte(v: unknown): v is RisposteQuestionario {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  for (const val of Object.values(v as Record<string, unknown>)) {
    const ok =
      typeof val === "string" || (Array.isArray(val) && val.every((x) => typeof x === "string"));
    if (!ok) return false;
  }
  return JSON.stringify(v).length <= 2000;
}
