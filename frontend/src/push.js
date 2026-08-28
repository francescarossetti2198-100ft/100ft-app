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

export async function attivaNotifiche() {
  if (!supportato()) throw new Error("Le notifiche non sono supportate su questo dispositivo/browser");

  const permesso = await Notification.requestPermission();
  if (permesso !== "granted") throw new Error("Permesso per le notifiche negato");

  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await api.get("/push/vapid-public-key");
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64urlToUint8Array(publicKey),
  });

  const json = sub.toJSON();
  await api.post("/push", { endpoint: json.endpoint, keys: json.keys });
}

// Notifica di prova verso i propri dispositivi iscritti.
export async function inviaNotificaDiProva() {
  return api.post("/push/test");
}

export async function disattivaNotifiche() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await api.del("/push", { endpoint: sub.endpoint }).catch(() => {});
  await sub.unsubscribe();
}
