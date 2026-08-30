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

// Per upload di file (foto sfide/Daily Drop) — niente Content-Type esplicito, il browser
// imposta multipart/form-data con il boundary corretto da solo.
async function requestForm(path, formData) {
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
