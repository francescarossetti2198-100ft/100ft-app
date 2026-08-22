import { currentPath } from "../router.js";
import { getUser } from "../auth.js";

const TABS = [
  { path: "/", label: "Home", icon: "🏠" },
  { path: "/programma", label: "Programma", icon: "📅" },
  { path: "/sfide", label: "Sfide", icon: "🏆" },
  { path: "/feed", label: "Feed", icon: "📣" },
  { path: "/profilo", label: "Profilo", icon: "👤" },
];

const TAB_MESSAGGI = { path: "/messaggi", label: "Messaggi", icon: "💬" };
const TAB_COACH = { path: "/coach", label: "Coach", icon: "🎓" };

export function renderTabbar() {
  const nav = document.createElement("nav");
  nav.className = "tabbar";

  const ruolo = getUser()?.role;
  const tabs = ruolo === "coach" ? [...TABS, TAB_COACH] : [...TABS, TAB_MESSAGGI];
  const active = currentPath();
  for (const tab of tabs) {
    const a = document.createElement("a");
    a.href = `#${tab.path}`;
    a.className = tab.path === active ? "active" : "";
    a.innerHTML = `<span>${tab.icon}</span><span>${tab.label}</span>`;
    nav.appendChild(a);
  }
  return nav;
}
