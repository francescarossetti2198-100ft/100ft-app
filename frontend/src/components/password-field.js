// Campo password con occhio mostra/nascondi. Stesso markup `.field` del resto dei form,
// con l'input dentro un wrapper relativo e un bottone occhio assoluto a destra.
// I <button> nativi ignorano box-shadow senza appearance: qui serve solo posizionamento,
// quindi va bene una classe CSS semplice (.pw-eye in style.css).

const OCCHIO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`;
const OCCHIO_OFF = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>`;

export function passwordFieldHtml(id, label, autocomplete = "current-password", extraAttrs = "") {
  return `
    <div class="field">
      <label for="${id}">${label}</label>
      <div class="pw-wrap">
        <input id="${id}" type="password" autocomplete="${autocomplete}" ${extraAttrs} />
        <button type="button" class="pw-eye" data-for="${id}" aria-label="Mostra password" aria-pressed="false">${OCCHIO}</button>
      </div>
    </div>
  `;
}

export function attachPasswordToggles(container) {
  container.querySelectorAll(".pw-eye").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = container.querySelector(`#${btn.dataset.for}`);
      if (!input) return;
      const mostra = input.type === "password";
      input.type = mostra ? "text" : "password";
      btn.innerHTML = mostra ? OCCHIO_OFF : OCCHIO;
      btn.setAttribute("aria-pressed", String(mostra));
      btn.setAttribute("aria-label", mostra ? "Nascondi password" : "Mostra password");
    });
  });
}
