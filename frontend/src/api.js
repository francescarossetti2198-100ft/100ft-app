// Wrapper fetch verso l'API worker. In dev passa dal proxy Vite (vedi vite.config.js),
// in produzione va sostituito con l'URL pubblico del worker deployato.
const BASE_URL = import.meta.env.VITE_API_URL ?? "/api";

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? "Errore imprevisto", res.status);
  }
  return data;
}

// Per upload di file (foto sfide/Daily Drop) — niente Content-Type esplicito, il browser
// imposta multipart/form-data con il boundary corretto da solo.
async function requestForm(path, formData) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? "Errore imprevisto", res.status);
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  postForm: (path, formData) => requestForm(path, formData),
};

export { ApiError };
