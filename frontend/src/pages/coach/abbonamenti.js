import { renderPaginaCoach } from "../../components/coach-shell.js";
import { initSuddivisioni, MESI, SEL_STYLE, oraCorrente, esc } from "../coach.js";
import { api, ApiError } from "../../api.js";
import { PIANI } from "../../abbonamenti.js";

// Spunta veloce di chi ha pagato l'abbonamento del mese — tutti su una schermata, come
// l'appello. Nessun bisogno di entrare nel profilo di ognuno. Le frecce ‹ › portano ai mesi
// passati per correggere i pagamenti (non oltre il mese corrente).
function initPagamenti(el) {
  const box = el.querySelector("#pag-lista");
  const contatore = el.querySelector("#pag-contatore");
  const prevBtn = el.querySelector("#pag-prev");
  const nextBtn = el.querySelector("#pag-next");
  const corrente = oraCorrente();
  let sel = { ...corrente };
  const chiave = (m) => m.anno * 100 + m.mese;

  async function carica() {
    el.querySelector("#pag-titolo").textContent = `Pagamenti · ${MESI[sel.mese - 1]} ${sel.anno}`;
    const alCorrente = chiave(sel) >= chiave(corrente);
    nextBtn.disabled = alCorrente;
    nextBtn.style.opacity = alCorrente ? "0.3" : "1";
    box.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Carico...</p>`;
    contatore.textContent = "—";
    const richiesto = { ...sel };
    let d;
    try {
      d = await api.get(`/pagamenti?anno=${richiesto.anno}&mese=${richiesto.mese}`);
    } catch (err) {
      box.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
      return;
    }
    if (chiave(richiesto) !== chiave(sel)) return; // nel frattempo si è cambiato mese
    disegna(d.atleti);
  }

  prevBtn.addEventListener("click", () => {
    sel = sel.mese === 1 ? { anno: sel.anno - 1, mese: 12 } : { anno: sel.anno, mese: sel.mese - 1 };
    carica();
  });
  nextBtn.addEventListener("click", () => {
    if (chiave(sel) >= chiave(corrente)) return;
    sel = sel.mese === 12 ? { anno: sel.anno + 1, mese: 1 } : { anno: sel.anno, mese: sel.mese + 1 };
    carica();
  });

  function disegna(atleti) {
    const pagati = atleti.filter((a) => a.pagamentoMese === "pagato").length;
    contatore.textContent = `${pagati} / ${atleti.length} hanno pagato`;

    box.innerHTML = atleti
      .map((a) => {
        const nome = a.nickname || `${a.nome} ${a.cognome}`.trim();
        const pagato = a.pagamentoMese === "pagato";
        const col = pagato ? "var(--livello-1)" : "var(--livello-5)";
        const opzioni =
          `<option value="">— abbonamento —</option>` +
          PIANI.map(
            (pl) => `<option value="${pl.key}" ${a.piano === pl.key ? "selected" : ""}>${pl.nome}</option>`
          ).join("");
        return `
          <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 0; border-top:1px solid var(--border)">
            <span style="min-width:0">
              <span style="font-size:14px; font-weight:600">${esc(nome)}</span>
              <select class="pag-piano" data-user-id="${a.userId}"
                style="display:block; margin-top:4px; ${SEL_STYLE}; font-size:11px; padding:4px 6px; ${a.piano ? "" : "color:var(--livello-5)"}">
                ${opzioni}
              </select>
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

    box.querySelectorAll(".pag-piano").forEach((selEl) => {
      selEl.addEventListener("change", async () => {
        const piano = selEl.value;
        if (!piano) return; // "— abbonamento —": nessuna azione
        selEl.disabled = true;
        try {
          await api.post("/pagamenti", { userId: Number(selEl.dataset.userId), piano, anno: sel.anno, mese: sel.mese });
          selEl.style.color = "";
        } catch (err) {
          alert(err instanceof ApiError ? err.message : "Errore imprevisto");
        } finally {
          selEl.disabled = false;
        }
      });
    });

    box.querySelectorAll(".pag-toggle").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const nuovo = btn.dataset.stato === "pagato" ? "non_pagato" : "pagato";
        btn.disabled = true;
        try {
          await api.post("/pagamenti", { userId: Number(btn.dataset.userId), stato: nuovo, anno: sel.anno, mese: sel.mese });
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
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px">
          <button type="button" id="pag-prev" aria-label="Mese precedente"
            style="background:none; border:1px solid var(--border); border-radius:8px; color:var(--text); padding:4px 12px; cursor:pointer; font-size:16px">‹</button>
          <p class="mono" style="color:var(--mute); font-size:12px; margin:0; text-align:center" id="pag-titolo">Pagamenti del mese</p>
          <button type="button" id="pag-next" aria-label="Mese successivo"
            style="background:none; border:1px solid var(--border); border-radius:8px; color:var(--text); padding:4px 12px; cursor:pointer; font-size:16px">›</button>
        </div>
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
