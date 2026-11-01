// Wrapper fetch verso l'API worker. In dev passa dal proxy Vite (vedi vite.config.js),
// in produzione va sostituito con l'URL pubblico del worker deployato.
const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Messaggio unico quando la fetch stessa fallisce (rete assente, server irraggiungibile,
// oppure la pagina è aperta da un indirizzo diverso da app.100-ft.com → il browser blocca
// la risposta per CORS). Non è un errore dell'API: è "non sono nemmeno riuscito a chiedere".
const ERRORE_RETE =
  "Impossibile contattare il server. Controlla la connessione e che l'indirizzo sia app.100-ft.com.";

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(ERRORE_RETE, 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? "Errore imprevisto", res.status);
  }
  return data;
}

// Le foto scattate col telefono pesano 2–7 MB: ridotte qui a max 1600 px sul lato lungo
// (JPEG 82%) diventano ~200–400 KB, e il Feed carica molto più in fretta. Solo i campi
// "foto": gli allegati del diario ("file", es. la scheda) restano com'erano. Se il browser
// non riesce a decodificarla, o il risultato non è più leggero, si manda l'originale.
const LATO_MAX_FOTO = 1600;
async function comprimiFoto(file) {
  if (!(file instanceof File) || !/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scala = Math.min(1, LATO_MAX_FOTO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scala);
    canvas.height = Math.round(bitmap.height * scala);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // i PNG trasparenti diventano JPEG: sfondo bianco invece di nero
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]*$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// Per upload di file (foto sfide/Daily Drop) — niente Content-Type esplicito, il browser
// imposta multipart/form-data con il boundary corretto da solo.
async function requestForm(path, formData) {
  for (const [campo, valore] of [...formData.entries()]) {
    if (campo === "foto" && valore instanceof File) formData.set(campo, await comprimiFoto(valore));
  }
  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
  } catch {
    throw new ApiError(ERRORE_RETE, 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? "Errore imprevisto", res.status);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  del: (path, body) => request(path, { method: "DELETE", body }),
  postForm: (path, formData) => requestForm(path, formData),
};

// I file caricati (foto profilo, feed, sfide) stanno su R2 e il worker li serve come
// path relativo "/api/foto/...". In sviluppo il proxy Vite li risolve same-origin; in
// produzione frontend (app.100-ft.com) e API (api.100-ft.com) sono su domini diversi,
// quindi un <img src="/api/foto/..."> punterebbe al frontend e non troverebbe nulla.
// mediaUrl ancora il path all'origine dell'API quando serve.
const API_ORIGIN = /^https?:\/\//.test(BASE_URL) ? new URL(BASE_URL).origin : "";

export function mediaUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

export { ApiError };
