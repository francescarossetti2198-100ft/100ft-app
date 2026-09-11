// Personalizzazione dell'anello della foto profilo atleta (colore/stile/intensità).
// Deve restare allineata a COLORI_FOTO/STILI_FOTO/INTENSITA_FOTO in frontend/src/foto-ring.js.
const COLORI_FOTO = ["viola", "blu", "verde", "arancio", "rosso", "rosa", "giallo", "bianco"];
const STILI_FOTO = ["solid", "gradient", "glow", "double", "dashed", "minimal"];
const INTENSITA_FOTO = ["sottile", "medio", "forte"];

export type FotoPersonalizzazione = { colore: string; stile: string; intensita: string };

// null = nessuna personalizzazione (bordo neutro di default). Altrimenti serve l'oggetto
// completo {colore, stile, intensita}, tutti e tre validi.
export function fotoPersonalizzazioneValida(v: unknown): boolean {
  if (v === null) return true;
  if (typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return COLORI_FOTO.includes(String(o.colore)) && STILI_FOTO.includes(String(o.stile)) && INTENSITA_FOTO.includes(String(o.intensita));
}

export function parseFotoPersonalizzazione(raw: string | null | undefined): FotoPersonalizzazione | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return fotoPersonalizzazioneValida(v) ? (v as FotoPersonalizzazione) : null;
  } catch {
    return null;
  }
}
