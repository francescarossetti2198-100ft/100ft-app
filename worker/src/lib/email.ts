import type { Env } from "../types";

// Invio email transazionali via Resend (resend.com, piano gratuito).
// Richiede:
//   - RESEND_API_KEY   (secret) — chiave API del progetto Resend
//   - EMAIL_FROM        (var)   — mittente, DEVE usare un dominio verificato su Resend,
//                                 es. "100FT <no-reply@100ft.app>". Se il dominio non è
//                                 ancora verificato l'invio dà 403.
const FROM_ADDRESS_DEFAULT = "100FT <onboarding@resend.dev>";

export async function sendResetPasswordEmail(env: Env, to: string, resetUrl: string): Promise<void> {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY non configurata");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM || FROM_ADDRESS_DEFAULT,
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
