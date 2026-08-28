// Tema chiaro/scuro. La scelta esplicita dell'utente sta in localStorage; senza scelta
// si segue l'impostazione di sistema del telefono (prefers-color-scheme).
// Lo stato iniziale è già applicato dallo script inline in index.html (prima del primo
// paint, per non avere un lampo del tema sbagliato) — qui gestiamo solo il pulsante.

const STORAGE_KEY = "100ft-theme";

const SOLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
const LUNA = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

function temaCorrente() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applicaTema(tema) {
  document.documentElement.dataset.theme = tema;
  try {
    localStorage.setItem(STORAGE_KEY, tema);
  } catch {
    // storage non disponibile (es. modalità privata) — il tema resta comunque per la sessione
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = tema === "light" ? "#ffffff" : "#0a0a0a";
  const btn = document.getElementById("theme-toggle");
  // Mostra l'icona della destinazione: sole quando sei al buio, luna quando sei al chiaro.
  if (btn) btn.innerHTML = tema === "light" ? LUNA : SOLE;
}

export function mountThemeToggle() {
  if (document.getElementById("theme-toggle")) return;
  const btn = document.createElement("button");
  btn.id = "theme-toggle";
  btn.type = "button";
  btn.className = "theme-toggle";
  btn.setAttribute("aria-label", "Cambia tema chiaro/scuro");
  btn.innerHTML = temaCorrente() === "light" ? LUNA : SOLE;
  btn.addEventListener("click", () => {
    applicaTema(temaCorrente() === "light" ? "dark" : "light");
  });
  document.body.appendChild(btn);
}
