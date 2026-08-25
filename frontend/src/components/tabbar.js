import { currentPath } from "../router.js";

// Icone custom fornite da Francesca (Lucide) — stroke="currentColor" così restano bianche
// dentro il box viola (.tab-icon-box in style.css) sia da attive che da inattive.
const ICONA_HOME = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>`;
const ICONA_PROGRAMMA = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>`;
const ICONA_SFIDE = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/></svg>`;
const ICONA_FEED = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/><path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1"/></svg>`;
const ICONA_PROFILO = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="m19 16-3 3"/><path d="M2 21a8 8 0 0 1 12.664-6.5"/><path d="M22 19h-6l3 3"/><circle cx="10" cy="8" r="5"/></svg>`;

const TABS = [
  { path: "/", label: "Home", icon: ICONA_HOME },
  { path: "/programma", label: "Programma", icon: ICONA_PROGRAMMA },
  { path: "/sfide", label: "Sfide", icon: ICONA_SFIDE },
  { path: "/feed", label: "Feed", icon: ICONA_FEED },
  { path: "/profilo", label: "Profilo", icon: ICONA_PROFILO },
];

export function renderTabbar() {
  const nav = document.createElement("nav");
  nav.className = "tabbar";

  const active = currentPath();
  for (const tab of TABS) {
    const a = document.createElement("a");
    // La coach vede la sua dashboard alla radice "/" (vedi main.js): il tab Home
    // resta attivo anche quando la pagina montata è /coach.
    const percorsoAttivo = tab.path === "/" ? active === "/" || active === "/coach" : tab.path === active;
    a.href = `#${tab.path}`;
    a.className = percorsoAttivo ? "active" : "";
    a.innerHTML = `<span class="tab-icon-box">${tab.icon}</span><span>${tab.label}</span>`;
    nav.appendChild(a);
  }
  return nav;
}
