import { getUser } from "../auth.js";
import { navigate, currentPath, currentQuery } from "../router.js";

// Struttura del menù della coach. Un elemento è { rotta, label } oppure
// { gruppo, voci: [{ rotta, label }] } (i gruppi sono solo intestazioni, non rotte).
const MENU = [
  { rotta: "/coach", label: "Oggi" },
  { rotta: "/coach/diario", label: "Diario allenamenti" },
  {
    gruppo: "Allenamenti",
    voci: [
      { rotta: "/coach/presenze", label: "Presenze & feedback" },
      { rotta: "/coach/chiusure", label: "Giorni di chiusura" },
    ],
  },
  {
    gruppo: "Il mese",
    voci: [
      { rotta: "/coach/mese?sez=focus", label: "Focus & obiettivi" },
      { rotta: "/coach/mese?sez=abitudini", label: "Sane abitudini" },
      { rotta: "/coach/mese?sez=merende", label: "Merende fit" },
      { rotta: "/coach/sfide", label: "Gestione sfide" },
    ],
  },
  { rotta: "/coach/atleti", label: "Atleti" },
  { rotta: "/coach/punti-extra", label: "Punti extra" },
  { rotta: "/coach/comunicazioni", label: "Comunicazioni" },
  { rotta: "/coach/sfide-vista", label: "Sfide" },
  { rotta: "/coach/feed", label: "Feed" },
  { rotta: "/coach/abbonamenti", label: "Abbonamenti" },
  { rotta: "/coach/impostazioni", label: "Impostazioni" },
];

function voceAttiva(rotta) {
  const [base, q] = rotta.split("?");
  if (currentPath() !== base) return false;
  if (!q) return true;
  const vuoiSez = new URLSearchParams(q).get("sez");
  const sez = currentQuery().get("sez");
  return sez ? sez === vuoiSez : vuoiSez === "focus"; // default: focus
}

function drawerHtml() {
  const link = (v, sub) =>
    `<a href="#${v.rotta}" class="coach-drawer-voce${sub ? " sub" : ""}${voceAttiva(v.rotta) ? " attiva" : ""}">${v.label}</a>`;
  const righe = MENU.map((m) =>
    m.gruppo
      ? `<p class="coach-drawer-gruppo">${m.gruppo}</p>${m.voci.map((v) => link(v, true)).join("")}`
      : link(m, false)
  ).join("");
  return `
    <div class="coach-drawer-backdrop"></div>
    <aside class="coach-drawer">
      <p class="coach-drawer-titolo">100FT · Coach</p>
      ${righe}
    </aside>`;
}

// Monta una pagina della dashboard coach: bottone ☰ + drawer + <h1> + contenitore.
// `montaContenuto(el)` riceve il div in cui disegnare la pagina.
export function renderPaginaCoach(appEl, { titolo }, montaContenuto) {
  if (getUser()?.role !== "coach") {
    navigate("/");
    return;
  }

  const el = document.createElement("div");
  el.className = "screen coach-screen";
  el.innerHTML = `
    <button type="button" class="coach-hamburger" aria-label="Menù">
      <span></span><span></span><span></span>
    </button>
    ${drawerHtml()}
    <h1 style="padding-left:44px">${titolo}</h1>
    <div id="coach-page" style="margin-top:12px"></div>
  `;
  appEl.appendChild(el);

  const drawer = el.querySelector(".coach-drawer");
  const backdrop = el.querySelector(".coach-drawer-backdrop");
  const apri = () => { drawer.classList.add("aperto"); backdrop.classList.add("aperto"); };
  const chiudi = () => { drawer.classList.remove("aperto"); backdrop.classList.remove("aperto"); };

  el.querySelector(".coach-hamburger").addEventListener("click", apri);
  backdrop.addEventListener("click", chiudi);
  drawer.querySelectorAll(".coach-drawer-voce").forEach((a) => {
    // stessa pagina: chiudi e basta; pagina diversa: il router ridisegna tutto
    a.addEventListener("click", () => setTimeout(chiudi, 0));
  });

  montaContenuto(el.querySelector("#coach-page"));
}
