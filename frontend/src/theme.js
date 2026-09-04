// Tema chiaro/scuro. Tre modalità, salvate in localStorage:
//   "auto"  (default) — segue l'ora del giorno: buio dal crepuscolo all'alba,
//                       di giorno chiaro (ma se il sistema preferisce lo scuro lo rispetta);
//   "light" / "dark"  — scelta fissa dell'utente, ha sempre la priorità.
// Il pulsante in alto a destra cicla auto → chiaro → scuro → auto.
// Lo stato iniziale è già applicato dallo script inline in index.html (prima del primo
// paint, per non avere un lampo del tema sbagliato) — qui gestiamo pulsante e ricalcolo.

const STORAGE_KEY = "100ft-theme";

// Crepuscolo/alba approssimati con orari fissi (niente geolocalizzazione): buio dalle
// 19:00 alle 7:00. Se serve, si ritocca qui.
const ORA_BUIO_DA = 19;
const ORA_BUIO_A = 7;

const SOLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
const LUNA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
// Auto: cerchio mezzo pieno (come le icone "contrasto") — indica "il tema si regola da solo".
const AUTO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor"/></svg>`;

const ICONA = { auto: AUTO, light: SOLE, dark: LUNA };
const ETICHETTA = {
  auto: "Tema automatico (in base all'ora)",
  light: "Tema chiaro",
  dark: "Tema scuro",
};
const PROSSIMO = { auto: "light", light: "dark", dark: "auto" };

function modoSalvato() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

// Tema effettivo quando la modalità è "auto".
function temaAuto() {
  const h = new Date().getHours();
  const buio = h >= ORA_BUIO_DA || h < ORA_BUIO_A;
  if (buio) return "dark";
  const sistemaScuro =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return sistemaScuro ? "dark" : "light";
}

function temaEffettivo(modo) {
  return modo === "auto" ? temaAuto() : modo;
}

function applicaModo(modo) {
  const tema = temaEffettivo(modo);
  document.documentElement.dataset.theme = tema;

  try {
    if (modo === "auto") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, modo);
  } catch {
    // storage non disponibile (es. modalità privata) — il tema resta per la sessione
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = tema === "light" ? "#ffffff" : "#0a0a0a";

  const btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.innerHTML = ICONA[modo];
    btn.setAttribute("aria-label", `${ETICHETTA[modo]} — tocca per cambiare`);
    btn.title = ETICHETTA[modo];
  }
}

export function mountThemeToggle() {
  if (document.getElementById("theme-toggle")) return;
  const btn = document.createElement("button");
  btn.id = "theme-toggle";
  btn.type = "button";
  btn.className = "theme-toggle";
  btn.addEventListener("click", () => applicaModo(PROSSIMO[modoSalvato()]));
  document.body.appendChild(btn);
  applicaModo(modoSalvato());

  // In modalità automatica il tema può cambiare mentre l'app è aperta (arriva la sera):
  // ricalcoliamo quando si torna sull'app e ogni tanto.
  const ricalcola = () => {
    if (modoSalvato() === "auto") applicaModo("auto");
  };
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) ricalcola();
  });
  setInterval(ricalcola, 10 * 60 * 1000);
}
