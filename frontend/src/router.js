import { getUser } from "./auth.js";

const routes = {};

export function registerRoute(path, { render, protected: isProtected = true }) {
  routes[path] = { render, protected: isProtected };
}

export function navigate(path) {
  window.location.hash = path;
}

export function startRouter(appEl) {
  window.addEventListener("hashchange", () => renderCurrent(appEl));
  renderCurrent(appEl);
}

function currentPath() {
  const hash = window.location.hash.replace(/^#/, "");
  const [path] = hash.split("?");
  return path || "/";
}

function currentQuery() {
  const hash = window.location.hash.replace(/^#/, "");
  const [, query = ""] = hash.split("?");
  return new URLSearchParams(query);
}

function renderCurrent(appEl) {
  const path = currentPath();
  const route = routes[path] ?? routes["/"];

  if (route.protected && !getUser()) {
    if (path !== "/login") {
      navigate("/login");
      return;
    }
  }

  appEl.innerHTML = "";
  route.render(appEl);
}

export { currentPath, currentQuery };
