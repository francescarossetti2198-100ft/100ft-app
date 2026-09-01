import { renderPaginaCoach } from "../../components/coach-shell.js";
import { initSuddivisioni, MESI, SEL_STYLE, oraCorrente, esc } from "../coach.js";
import { api, ApiError } from "../../api.js";

// Spunta veloce di chi ha pagato l'abbonamento del mese — tutti su una schermata, come
// l'appello. Nessun bisogno di entrare nel profilo di ognuno.
function initPagamenti(el) {
  const box = el.querySelector("#pag-lista");
  const contatore = el.querySelector("#pag-contatore");

  async function carica() {
    box.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Carico...</p>`;
    let d;
    try {
      d = await api.get("/atleti");
    } catch (err) {
      box.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
      return;
    }

    el.querySelector("#pag-titolo").textContent = `Pagamenti · ${MESI[d.mese - 1]} ${d.anno}`;
    disegna(d.atleti);
  }

  function disegna(atleti) {
    const pagati = atleti.filter((a) => a.pagamentoMese === "pagato").length;
    contatore.textContent = `${pagati} / ${atleti.length} hanno pagato`;

    box.innerHTML = atleti
      .map((a) => {
        const nome = a.nickname || `${a.nome} ${a.cognome}`.trim();
        const pagato = a.pagamentoMese === "pagato";
        const col = pagato ? "var(--livello-1)" : "var(--livello-5)";
        return `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 0; border-top:1px solid var(--border)">
            <span style="min-width:0">
              <span style="font-size:14px; font-weight:600">${esc(nome)}</span>
              <span class="mono" style="color:var(--mute); font-size:11px; display:block; margin-top:2px">${esc(a.nomePiano || a.piano || "nessun piano")}</span>
            </span>
            <button type="button" class="pag-toggle" data-user-id="${a.userId}" data-stato="${a.pagamentoMese}"
              style="flex-shrink:0; padding:8px 12px; border-radius:999px; cursor:pointer; white-space:nowrap;
                     border:1px solid ${col}; background:color-mix(in srgb, ${col} 14%, transparent);
                     color:${col}; font-family:var(--font-mono); font-size:12px; font-weight:700; letter-spacing:.5px">
              ${pagato ? "✓ PAGATO" : "DA PAGARE"}
            </button>
          </div>`;
      })
      .join("");

    box.querySelectorAll(".pag-toggle").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const nuovo = btn.dataset.stato === "pagato" ? "non_pagato" : "pagato";
        btn.disabled = true;
        try {
          await api.post("/pagamenti", { userId: Number(btn.dataset.userId), stato: nuovo });
          btn.dataset.stato = nuovo;
          const pagato = nuovo === "pagato";
          const col = pagato ? "var(--livello-1)" : "var(--livello-5)";
          btn.textContent = pagato ? "✓ PAGATO" : "DA PAGARE";
          btn.style.borderColor = col;
          btn.style.background = `color-mix(in srgb, ${col} 14%, transparent)`;
          btn.style.color = col;
          const n = [...box.querySelectorAll('.pag-toggle[data-stato="pagato"]')].length;
          contatore.textContent = `${n} / ${box.querySelectorAll(".pag-toggle").length} hanno pagato`;
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Errore imprevisto");
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  carica();
}

export function renderCoachAbbonamenti(appEl) {
  const { mese, anno } = oraCorrente();
  renderPaginaCoach(appEl, { titolo: "Abbonamenti" }, (el) => {
    el.innerHTML = `
      <div class="card">
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:0" id="pag-titolo">Pagamenti del mese</p>
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:4px" id="pag-contatore">—</p>
        <div id="pag-lista" style="margin-top:8px"></div>
      </div>

      <div class="card" style="margin-top:16px">
        <details class="blocco-mese" style="border-top:0">
          <summary>Suddivisioni & PDF</summary>
          <div class="blocco-corpo">
            <p class="mono" style="color:var(--mute); font-size:11px; margin-top:0">Bozza — imposta le % mancanti quando hai deciso.</p>
            <div style="display:flex; gap:8px; margin-top:12px">
              <select id="sudd-mese" style="flex:2; ${SEL_STYLE}">
                ${MESI.map((m, i) => `<option value="${i + 1}" ${i + 1 === mese ? "selected" : ""}>${m}</option>`).join("")}
              </select>
              <input id="sudd-anno" type="number" value="${anno}" style="flex:1; ${SEL_STYLE}" />
            </div>
            <div id="sudd-body" style="margin-top:12px"><p class="mono" style="color:var(--mute); font-size:13px">Carico...</p></div>
          </div>
        </details>
      </div>`;

    initPagamenti(el);
    initSuddivisioni(el);
  });
}
