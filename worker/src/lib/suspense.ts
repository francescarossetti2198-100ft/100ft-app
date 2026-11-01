import { adessoRoma } from "./oggi";

// "Effetto suspense" sulla classifica (richiesta di Francesca, ott 2026): nell'ultima
// settimana del mese (gli ultimi 7 giorni) le atlete non vedono più classifica né punti
// propri, finché il 1° del mese dopo non esce l'Atleta del mese. La coach vede sempre tutto.

// Ora dell'annuncio dell'Atleta del mese, il 1° di ogni mese (Francesca: "sempre alle 13").
export const ORARIO_ATLETA_MESE = "13:00";

// "YYYY-MM-DD HH:MM" adesso, a Roma — confrontabile come stringa con gli orari delle sfide
// con votazione.
export function adessoRomaTesto(now: Date = new Date()): string {
  return adessoRoma(now).toISOString().slice(0, 16).replace("T", " ");
}

// Finestra di suspense attiva adesso, o null. `fino` ("YYYY-MM-DD HH:MM") serve alla UI.
export function classificaNascosta(now: Date = new Date()): { fino: string } | null {
  const r = adessoRoma(now);
  const anno = r.getUTCFullYear();
  const mese = r.getUTCMonth() + 1;
  const giorno = r.getUTCDate();
  const ora = r.toISOString().slice(11, 16);
  const ym = (a: number, m: number) => `${a}-${String(m).padStart(2, "0")}`;

  // Il 1° del mese, fino all'annuncio: ancora nascosta (è la coda del mese prima).
  if (giorno === 1 && ora < ORARIO_ATLETA_MESE) return { fino: `${ym(anno, mese)}-01 ${ORARIO_ATLETA_MESE}` };

  const ultimoGiorno = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
  if (giorno <= ultimoGiorno - 7) return null;

  const [annoDopo, meseDopo] = mese === 12 ? [anno + 1, 1] : [anno, mese + 1];
  return { fino: `${ym(annoDopo, meseDopo)}-01 ${ORARIO_ATLETA_MESE}` };
}

// Per chi guarda: nascosta solo agli atleti.
export function classificaNascostaPer(role: string): { fino: string } | null {
  return role === "coach" ? null : classificaNascosta();
}
