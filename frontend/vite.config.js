import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    proxy: {
      // In sviluppo il browser parla solo con Vite: le richieste /api vengono
      // inoltrate al worker locale (`npm run dev` dentro worker/), mantenendo
      // tutto same-origin così i cookie di sessione funzionano senza problemi.
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      // Service worker scritto a mano (src/sw.js) invece che generato — serve per gestire
      // gli eventi "push"/"notificationclick" delle notifiche reali, non solo la cache offline.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      injectManifest: {
        injectionPoint: "self.__WB_MANIFEST",
      },
      // Di default il service worker non viene servito affatto durante `vite dev` (solo nella
      // build) — le notifiche push, che dipendono dal SW, non potrebbero mai registrarsi in
      // sviluppo senza questo. "module" perché src/sw.js usa import ES (workbox-precaching).
      devOptions: {
        enabled: true,
        type: "module",
      },
      manifest: {
        name: "100FT Functional Training",
        short_name: "100FT",
        description: "App atleti — 100FT Functional Training, Centocelle",
        theme_color: "#0A0A0A",
        background_color: "#0A0A0A",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
});
