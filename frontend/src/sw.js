import { precacheAndRoute } from "workbox-precaching";

precacheAndRoute(self.__WB_MANIFEST);

// Aggiornamento immediato: senza questo il nuovo service worker resta in "waiting" finché
// tutte le finestre non vengono chiuse — e una PWA installata su iPhone non si chiude quasi
// mai, quindi dopo un deploy l'utente continuava a vedere la versione vecchia in cache.
// Con skipWaiting + clients.claim il SW nuovo prende il controllo subito; main.js ricarica
// una volta la pagina all'evento `controllerchange`.
self.skipWaiting();
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Notifiche push reali (Daily Drop + promemoria allenamento) — vedi worker/src/lib/webPush.ts
// per la cifratura lato server. Il payload arriva già in chiaro qui (il browser lo decifra
// prima di consegnare l'evento), è solo JSON {title, body, url}.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "100FT", body: event.data ? event.data.text() : "" };
  }

  // Daily Drop arrivato in ritardo, a finestra già chiusa: niente invito a rispondere (non si
  // potrebbe più), lo si mostra direttamente come chiuso.
  if (data.tipo === "daily-drop" && data.scadeAlle && Date.now() > data.scadeAlle) {
    data = { ...data, tipo: "daily-drop-chiuso", title: "100FT — Daily Drop chiuso", body: "Il Daily Drop di oggi è finito ⏱ Al prossimo!" };
  }

  event.waitUntil(
    (async () => {
      // Il push di chiusura prende il posto della notifica del Daily Drop rimasta sul telefono.
      // Va comunque mostrata una notifica: su iPhone un push senza notifica visibile, ripetuto,
      // fa revocare l'iscrizione da Safari.
      if (data.tag) {
        const vecchie = await self.registration.getNotifications({ tag: data.tag });
        vecchie.forEach((n) => n.close());
      }
      await self.registration.showNotification(data.title || "100FT", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.tag,
        silent: data.tipo === "daily-drop-chiuso",
        data: { url: data.url || "/" },
      });
    })()
  );
});

// Il browser ha rinnovato da solo l'iscrizione push (token APNs/FCM scaduto): la si rifà e la
// si registra sul server, altrimenti il server continua a mandare al vecchio endpoint (410 →
// iscrizione cancellata) e l'atleta smette di ricevere notifiche senza saperlo.
const API_URL = import.meta.env.VITE_API_URL ?? "/api";

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const chiave = event.oldSubscription?.options?.applicationServerKey;
      const sub =
        event.newSubscription ||
        (chiave ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chiave }) : null);
      if (!sub) return;
      const json = sub.toJSON();
      await fetch(`${API_URL}/push`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
      });
    })().catch(() => {})
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
