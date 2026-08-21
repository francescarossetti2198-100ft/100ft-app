import type { Env } from "../types";

// Invio email transazionali via Resend (resend.com, piano gratuito).
// Richiede il secret RESEND_API_KEY e un mittente verificato su Resend.
const FROM_ADDRESS = "100FT <no-reply@100ft.app>"; // aggiorna col dominio verificato su Resend

export async function sendResetPasswordEmail(env: Env, to: string, resetUrl: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to,
      subject: "Recupera la tua password — 100FT",
      html: `
        <p>Ciao,</p>
        <p>Hai richiesto di reimpostare la password del tuo account 100FT.</p>
        <p><a href="${resetUrl}">Clicca qui per scegliere una nuova password</a> (link valido 1 ora).</p>
        <p>Se non sei stata tu, ignora questa email.</p>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Invio email fallito (${res.status}): ${body}`);
  }
}
