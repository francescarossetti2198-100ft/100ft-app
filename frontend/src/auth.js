import { api, ApiError } from "./api.js";

// Stato di sessione in memoria, popolato all'avvio interrogando /api/auth/me
// (il cookie di sessione lo gestisce il browser, "il device ricorda il login").
let currentUser = null;
let loaded = false;

export async function loadSession() {
  try {
    currentUser = await api.get("/auth/me");
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    currentUser = null;
  }
  loaded = true;
  return currentUser;
}

export function getUser() {
  return currentUser;
}

export function isSessionLoaded() {
  return loaded;
}

export function setUser(user) {
  currentUser = user;
}

export async function logout() {
  await api.post("/auth/logout");
  currentUser = null;
}
