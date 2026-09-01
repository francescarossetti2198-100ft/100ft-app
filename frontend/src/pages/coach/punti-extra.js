import { renderPaginaCoach } from "../../components/coach-shell.js";
import { api, ApiError } from "../../api.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function quando(iso) {
  const d = new Date((iso || "").replace(" ", "T") + "Z");
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 60) return `${Math.max(diff, 0)} min fa`;
  if (diff < 1440) return `${Math.floor(diff / 60)} h fa`;
  return `${Math.floor(diff / 1440)} g fa`;
}

export function renderCoachPuntiExtra(appEl) {
  renderPaginaCoach(appEl, { titolo: "Punti extra" }, (el) => {
    el.innerHTML = `
      <div class="card">
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:0">
          Assegna punti a mano per le sfide fatte in palestra. Entrano in classifica, non nel Feed.
        </p>
        <div id="pe-atleti" style="margin-top:12px"><p class="mono" style="color:var(--mute); font-size:13px">Carico...</p></div>
      </div>
      <div class="card" style="margin-top:16px">
        <p class="mono" style="color:var(--mute); font-size:12px; margin-top:0">ULTIMI PUNTI EXTRA</p>
        <div id="pe-storico" style="margin-top:10px"><p class="mono" style="color:var(--mute); font-size:13px">Carico...</p></div>
      </div>`;

    const boxAtleti = el.querySelector("#pe-atleti");
    const boxStorico = el.querySelector("#pe-storico");

    async function caricaStorico() {
      try {
        const { storico } = await api.get("/punti-extra");
        boxStorico.innerHTML = storico.length
          ? storico
              .map(
                (s) => `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 0; border-top:1px solid var(--border)">
                  <span style="font-size:13px">${esc(s.nome)} <span class="mono" style="color:var(--livello-1)">+${s.punti}</span></span>
                  <span style="display:flex; align-items:center; gap:10px">
                    <span class="mono" style="color:var(--mute); font-size:11px">${quando(s.data)}</span>
                    <button type="button" class="link-btn pe-annulla" data-id="${s.id}" style="color:var(--livello-5); text-decoration:none; font-size:15px">🗑</button>
                  </span>
                </div>`
              )
              .join("")
          : `<p class="mono" style="color:var(--mute); font-size:13px">Ancora nessun punto extra.</p>`;

        boxStorico.querySelectorAll(".pe-annulla").forEach((btn) => {
          btn.addEventListener("click", async () => {
            if (!confirm("Annullare questa assegnazione?")) return;
            btn.disabled = true;
            try {
              await api.del(`/punti-extra/${btn.dataset.id}`);
              await caricaStorico();
            } catch (err) {
              alert(err instanceof ApiError ? err.message : "Errore imprevisto");
              btn.disabled = false;
            }
          });
        });
      } catch {
        boxStorico.innerHTML = `<p class="error-text">Impossibile caricare lo storico</p>`;
      }
    }

    function rigaAtleta(a) {
      const nome = a.nickname || `${a.nome} ${a.cognome}`.trim();
      const row = document.createElement("div");
      row.style.cssText = "border-top:1px solid var(--border); padding:10px 0";
      row.innerHTML = `
        <button type="button" class="pe-toggle" style="display:block; width:100%; text-align:left; background:none; border:none; color:inherit; font:inherit; cursor:pointer; font-size:14px; font-weight:600">
          ${esc(nome)}
        </button>
        <div class="pe-pannello" hidden style="margin-top:8px; flex-wrap:wrap; align-items:center; gap:8px">
          <button type="button" class="btn pe-quick" data-n="5" style="background:var(--surface-2); color:var(--text); padding:8px 12px">+5</button>
          <button type="button" class="btn pe-quick" data-n="10" style="background:var(--surface-2); color:var(--text); padding:8px 12px">+10</button>
          <button type="button" class="btn pe-quick" data-n="15" style="background:var(--surface-2); color:var(--text); padding:8px 12px">+15</button>
          <input type="number" class="pe-n" min="1" max="100" placeholder="altro"
            style="width:74px; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:8px; color:var(--text); font:inherit" />
          <button type="button" class="btn pe-assegna" style="padding:8px 14px">Assegna</button>
          <span class="pe-esito mono" style="font-size:12px"></span>
        </div>`;

      const toggle = row.querySelector(".pe-toggle");
      const pannello = row.querySelector(".pe-pannello");
      const nInput = row.querySelector(".pe-n");
      const esito = row.querySelector(".pe-esito");

      toggle.addEventListener("click", () => {
        pannello.hidden = !pannello.hidden;
        pannello.style.display = pannello.hidden ? "none" : "flex";
      });

      async function assegna(punti) {
        esito.textContent = "";
        esito.style.color = "";
        if (!Number.isInteger(punti) || punti < 1 || punti > 100) {
          esito.textContent = "1–100";
          esito.style.color = "var(--livello-5)";
          return;
        }
        try {
          await api.post("/punti-extra", { userId: a.userId, punti });
          esito.textContent = `+${punti} ✓`;
          esito.style.color = "var(--livello-1)";
          nInput.value = "";
          await caricaStorico();
        } catch (err) {
          esito.textContent = err instanceof ApiError ? err.message : "Errore";
          esito.style.color = "var(--livello-5)";
        }
      }

      row.querySelectorAll(".pe-quick").forEach((b) =>
        b.addEventListener("click", () => assegna(Number(b.dataset.n)))
      );
      row.querySelector(".pe-assegna").addEventListener("click", () => assegna(Number(nInput.value)));

      return row;
    }

    api
      .get("/atleti")
      .then(({ atleti }) => {
        if (!atleti.length) {
          boxAtleti.innerHTML = `<p class="mono" style="color:var(--mute); font-size:13px">Nessun atleta.</p>`;
          return;
        }
        boxAtleti.innerHTML = "";
        atleti.forEach((a) => boxAtleti.appendChild(rigaAtleta(a)));
      })
      .catch((err) => {
        boxAtleti.innerHTML = `<p class="error-text">${err instanceof ApiError ? err.message : "Errore imprevisto"}</p>`;
      });

    caricaStorico();
  });
}
