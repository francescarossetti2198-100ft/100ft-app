import { currentPath } from "../router.js";

const TABS = [
  { path: "/", label: "Home", icon: "🏠" },
  { path: "/programma", label: "Programma", icon: "📅" },
  { path: "/sfide", label: "Sfide", icon: "🏆" },
  { path: "/feed", label: "Feed", icon: "📣" },
  { path: "/profilo", label: "Profilo", icon: "👤" },
];

export function renderTabbar() {
  const nav = document.createElement("nav");
  nav.className = "tabbar";

  const active = currentPath();
  for (const tab of TABS) {
    const a = document.createElement("a");
    a.href = `#${tab.path}`;
    a.className = tab.path === active ? "active" : "";
    a.innerHTML = `<span>${tab.icon}</span><span>${tab.label}</span>`;
    nav.appendChild(a);
  }
  return nav;
}
