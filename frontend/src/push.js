import { api } from "./api.js";

// Su iPhone il Push API funziona solo se l'app è stata aggiunta alla Home (iOS 16.4+) — in
// una scheda Safari normale "PushManager" non esiste proprio, da qui il caso "non-supportato".
function supportato() {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
}

function base64urlToUint8Array(base64url) {
  const b64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// "non-supportato" | "negato" | "attive" | "disattive"
export async function statoNotifiche() {
  if (!supportato()) return "non-supportato";
  if (Notification.permission === "denied") return "negato";

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return sub ? "attive" : "disattive";
}

// L'atleta ha premuto "Disattiva" nel Profilo: in quel caso sincronizzaPush non deve
// riattivarle da sola (il permesso del telefono resta "concesso" anche dopo la disattivazione).
const CHIAVE_DISATTIVATE = "100ft-push-disattivate";
function segnaDisattivate(si) {
  try {
    if (si) localStorage.setItem(CHIAVE_DISATTIVATE, "1");
    else localStorage.removeItem(CHIAVE_DISATTIVATE);
  } catch {
    // storage non disponibile: pazienza
  }
}
function disattivateDallUtente() {
  try {
    return localStorage.getItem(CHIAVE_DISATTIVATE) === "1";
  } catch {
    return false;
  }
}

async function iscriviERegistra(reg) {
  const { publicKey } = await api.get("/push/vapid-public-key");
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64urlToUint8Array(publicKey),
  });
  const json = sub.toJSON();
  await api.post("/push", { endpoint: json.endpoint, keys: json.keys });
}

export async function attivaNotifiche() {
  if (!supportato()) throw new Error("Le notifiche non sono supportate su questo dispositivo/browser");

  const permesso = await Notification.requestPermission();
  if (permesso !== "granted") throw new Error("Permesso per le notifiche negato");

  const reg = await navigator.serviceWorker.ready;
  await iscriviERegistra(reg);
  segnaDisattivate(false);
}

// Notifica di prova verso i propri dispositivi iscritti.
export async function inviaNotificaDiProva() {
  return api.post("/push/test");
}

// Ri-registra sul server la sottoscrizione che il browser ha già, nel caso il server
// l'abbia persa (endpoint scaduto lato FCM/APNs → cancellato dopo un 404/410, poi il
// browser rinnova il token da solo). Se invece il permesso c'è ma l'iscrizione nel telefono
// non c'è più (persa da iOS, o da una vecchia versione di "Ricarica l'app"), la ricrea senza
// chiedere nulla — a meno che sia stato l'atleta a disattivarle. Da chiamare all'avvio.
export async function sincronizzaPush() {
  if (!supportato() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) {
      if (!disattivateDallUtente()) await iscriviERegistra(reg);
      return;
    }
    const json = sub.toJSON();
    await api.post("/push", { endpoint: json.endpoint, keys: json.keys });
  } catch {
    // best-effort: se fallisce, l'utente può sempre riattivare dal Profilo
  }
}

// Promemoria opzionali: "bevi acqua" e "fai merenda". { promemoriaAcqua, promemoriaMerenda }.
export async function leggiPromemoria() {
  return api.get("/push/preferenze");
}

export async function salvaPromemoria(prefs) {
  return api.post("/push/preferenze", prefs);
}

export async function disattivaNotifiche() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  segnaDisattivate(true);
  await api.del("/push", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
