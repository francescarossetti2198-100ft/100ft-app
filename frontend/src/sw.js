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

  event.waitUntil(
    self.registration.showNotification(data.title || "100FT", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
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
