import { renderPaginaCoach } from "../../components/coach-shell.js";
import { api, ApiError } from "../../api.js";
import { SEL_STYLE, formatGiornoBreve, oggiIso, esc } from "../coach.js";

const FACCE = ["", "😫", "😕", "😐", "🙂", "🔥"];
const STATO_COL = {
  presente: "var(--livello-1)",
  assente: "var(--livello-5)",
  prenotato: "var(--accent)",
  indeciso: "var(--mute)",
};

export function renderCoachPresenze(appEl) {
  renderPaginaCoach(appEl, { titolo: "Presenze & feedback" }, (el) => {
    el.innerHTML = `
      <div class="card">
        <select id="pf-data" style="width:100%; ${SEL_STYLE}"></select>

        <div style="margin-top:14px">
          <p class="mono" style="color:var(--mute); font-size:12px">APPELLO</p>
          <div id="pf-appello" style="margin-top:8px"><p class="mono" style="color:var(--mute)">Carico...</p></div>
          <p class="error-text" id="pf-error" hidden style="margin-top:6px"></p>
          <p class="success-text" id="pf-ok" hidden style="margin-top:6px">Appello confermato ✓</p>
          <button class="btn" id="pf-salva" style="width:100%; margin-top:8px" hidden>Conferma appello</button>
        </div>

        <div style="margin-top:18px; padding-top:12px; border-top:1px solid var(--border)">
          <p class="mono" style="color:var(--mute); font-size:12px">FEEDBACK DI QUEL GIORNO</p>
          <div id="pf-feedback" style="margin-top:8px"></div>
        </div>
      </div>`;

    const sel = el.querySelector("#pf-data");
    const boxApp = el.querySelector("#pf-appello");
    const boxFb = el.querySelector("#pf-feedback");
    const err = el.querySelector("#pf-error");
    const ok = el.querySelector("#pf-ok");
    const btn = el.querySelector("#pf-salva");
    let sessioneId = null;

    async function carica() {
      err.hidden = true;
      ok.hidden = true;
      boxApp.innerHTML = `<p class="mono" style="color:var(--mute)">Carico...</p>`;
      boxFb.innerHTML = "";

      let app;
      try {
        app = await api.get(`/presenze/appello${sel.value ? `?data=${sel.value}` : ""}`);
      } catch (e) {
        boxApp.innerHTML = `<p class="error-text">${e instanceof ApiError ? e.message : "Errore imprevisto"}</p>`;
        return;
      }

      if (!sel.dataset.pop && app.giorniRecenti?.length) {
        sel.innerHTML = app.giorniRecenti
          .map((g) => `<option value="${g}">${g === oggiIso() ? "Oggi" : formatGiornoBreve(g)}</option>`)
          .join("");
        sel.value = app.data;
        sel.dataset.pop = "1";
      }

      if (!app.sessione) {
        sessioneId = null;
        btn.hidden = true;
        boxApp.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Nessun allenamento in questa data.</p>`;
        return;
      }

      sessioneId = app.sessione.id;
      btn.hidden = false;
      btn.textContent = app.confermato ? "Aggiorna appello" : "Conferma appello";
      boxApp.innerHTML = app.atleti.length
        ? app.atleti
            .map((a) => {
              const nome = [a.nome, a.cognome].filter(Boolean).join(" ") || a.nickname || a.nome;
              const spuntato = a.confermata || a.richiesta ? "checked" : "";
              const tag = a.richiesta
                ? `<span class="mono" style="color:var(--accent); font-size:11px; white-space:nowrap">ha prenotato</span>`
                : "";
              return `
                <label style="display:flex; align-items:center; gap:10px; padding:9px 0; border-top:1px solid var(--border)">
                  <input type="checkbox" class="pf-check" data-user-id="${a.userId}" ${spuntato} />
                  <span style="flex:1; font-size:14px">${esc(nome)}</span>${tag}
                </label>`;
            })
            .join("")
        : `<p class="mono" style="color:var(--mute); font-size:13px">Nessun atleta.</p>`;

      // Feedback (sola lettura) per la stessa data
      try {
        const rip = await api.get(`/presenze/riepilogo?data=${sel.value}`);
        const conFb = (rip.atleti || []).filter((a) => a.feedback);
        boxFb.innerHTML = conFb.length
          ? conFb
              .map(
                (a) => `
                <div style="padding:8px 0; border-top:1px solid var(--border)">
                  <p style="font-size:14px">${esc(a.nome)}
                    <span class="mono" style="font-size:11px; color:${STATO_COL[a.stato] ?? "var(--mute)"}"> · ${a.stato}</span>
                  </p>
                  <p class="mono" style="font-size:12px; margin-top:2px">
                    ${FACCE[a.feedback.faccina] ?? ""} <span style="color:var(--mute)">${a.feedback.difficolta ?? ""}</span>${a.feedback.nota ? ` — ${esc(a.feedback.nota)}` : ""}
                  </p>
                </div>`
              )
              .join("")
          : `<p class="mono" style="color:var(--mute); font-size:13px">Nessun feedback per questa data.</p>`;
      } catch {
        boxFb.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Feedback non disponibile.</p>`;
      }
    }

    sel.addEventListener("change", carica);

    btn.addEventListener("click", async () => {
      if (!sessioneId) return;
      err.hidden = true;
      ok.hidden = true;
      const presentiUserIds = [...boxApp.querySelectorAll(".pf-check:checked")].map((c) => Number(c.dataset.userId));
      btn.disabled = true;
      try {
        await api.post("/presenze/appello", { data: sel.value, sessioneId, presentiUserIds });
        ok.hidden = false;
        await carica();
      } catch (e) {
        err.textContent = e instanceof ApiError ? e.message : "Errore imprevisto";
        err.hidden = false;
      } finally {
        btn.disabled = false;
      }
    });

    carica();
  });
}
