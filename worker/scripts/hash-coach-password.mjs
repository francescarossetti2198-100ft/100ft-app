// Genera l'hash da usare come secret COACH_PASSWORD_HASH.
// Uso: node scripts/hash-coach-password.mjs "la-password-scelta"
import { webcrypto as crypto } from "node:crypto";

const ITERATIONS = 100_000;
const HASH_BITS = 256;

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const password = process.argv[2];
if (!password) {
  console.error('Uso: node scripts/hash-coach-password.mjs "la-password-scelta"');
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

console.log(`pbkdf2:${ITERATIONS}:${toHex(salt)}:${toHex(bits)}`);
