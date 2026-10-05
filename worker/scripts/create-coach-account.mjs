// Genera lo statement SQL per creare l'account coach (ruolo "coach" nella tabella users).
// Uso: node scripts/create-coach-account.mjs "coach@esempio.it" "la-password-scelta"
//
// Copia l'output ed eseguilo con:
//   npx wrangler d1 execute 100ft-db --local --command "..."   (sviluppo locale)
//   npx wrangler d1 execute 100ft-db --remote --command "..."  (produzione)
import { webcrypto as crypto } from "node:crypto";

const ITERATIONS = 100_000;
const HASH_BITS = 256;

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Uso: node scripts/create-coach-account.mjs "coach@esempio.it" "la-password-scelta"');
  process.exit(1);
}

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
  "deriveBits",
]);
const bits = await crypto.subtle.deriveBits(
  { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
  key,
  HASH_BITS
);
const passwordHash = `pbkdf2:${ITERATIONS}:${toHex(salt)}:${toHex(bits)}`;

const escapedEmail = email.replace(/'/g, "''");
console.log(
  `INSERT INTO users (email, password_hash, role) VALUES ('${escapedEmail}', '${passwordHash}', 'coach');`
);
