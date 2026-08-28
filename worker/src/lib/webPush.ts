// Web Push: cifratura del messaggio (RFC 8291, content-coding aes128gcm) + autenticazione
// VAPID (RFC 8292), implementati con Web Crypto — il pacchetto npm "web-push" si appoggia ai
// moduli Node crypto/https e non gira nel runtime dei Workers, quindi si reimplementa qui.

export type PushSubscriptionInfo = {
  endpoint: string;
  p256dh: string; // base64url, chiave pubblica del client (65 byte non compressi)
  auth: string; // base64url, 16 byte
};

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function hmacSha256(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", keyBytes as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, data as BufferSource);
  return new Uint8Array(sig);
}

// HKDF-Expand a un solo blocco: qui non serve mai più di 32 byte di output.
async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const input = concatBytes(info, new Uint8Array([1]));
  const t = await hmacSha256(prk, input);
  return t.slice(0, length);
}

async function importVapidPrivateKey(privateKeyB64url: string, publicKeyB64url: string): Promise<CryptoKey> {
  const d = b64urlToBytes(privateKeyB64url);
  const pub = b64urlToBytes(publicKeyB64url);
  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);
  return crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: bytesToB64url(d), x: bytesToB64url(x), y: bytesToB64url(y), ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

function base64urlJson(obj: unknown): string {
  return bytesToB64url(new TextEncoder().encode(JSON.stringify(obj)));
}

async function buildVapidJwt(endpoint: string, publicKey: string, privateKey: string): Promise<string> {
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const header = { typ: "JWT", alg: "ES256" };
  const claims = {
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: "mailto:francescarossetti2198@gmail.com",
  };
  const signingInput = `${base64urlJson(header)}.${base64urlJson(claims)}`;

  const key = await importVapidPrivateKey(privateKey, publicKey);
  // Web Crypto firma ES256 restituisce direttamente r||s raw (64 byte) — il formato che
  // richiede JWS, non serve riconvertire da DER come con altre librerie.
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput) as BufferSource
  );

  return `${signingInput}.${bytesToB64url(new Uint8Array(signature))}`;
}

// Cifra il payload per il singolo destinatario (RFC 8291).
async function encryptPayload(payload: string, subscription: PushSubscriptionInfo): Promise<Uint8Array> {
  const clientPublicBytes = b64urlToBytes(subscription.p256dh);
  const authSecret = b64urlToBytes(subscription.auth);

  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicBytes as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const serverKeyPair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const serverPublicBytes = new Uint8Array(
    (await crypto.subtle.exportKey("raw", serverKeyPair.publicKey)) as ArrayBuffer
  );

  // Il tipo esatto dei parametri ECDH per deriveBits non è tra quelli esposti da
  // @cloudflare/workers-types (che non include la lib DOM) — la forma a runtime è corretta.
  const sharedSecretBits = (await crypto.subtle.deriveBits(
    { name: "ECDH", public: clientPublicKey } as unknown as Parameters<typeof crypto.subtle.deriveBits>[0],
    serverKeyPair.privateKey,
    256
  )) as ArrayBuffer;
  const sharedSecret = new Uint8Array(sharedSecretBits);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyInfo = concatBytes(new TextEncoder().encode("WebPush: info\0"), clientPublicBytes, serverPublicBytes);
  const prkKey = await hmacSha256(authSecret, sharedSecret);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  const prk = await hmacSha256(salt, ikm);
  const cek = await hkdfExpand(prk, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdfExpand(prk, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);

  const plaintext = new TextEncoder().encode(payload);
  const record = concatBytes(plaintext, new Uint8Array([2])); // delimitatore ultimo (unico) record, niente padding extra

  const cekKey = await crypto.subtle.importKey("raw", cek as BufferSource, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource, tagLength: 128 }, cekKey, record as BufferSource)
  );

  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, 4096, false);
  const header = concatBytes(salt, recordSize, new Uint8Array([serverPublicBytes.length]), serverPublicBytes);

  return concatBytes(header, ciphertext);
}

export async function sendWebPush(
  subscription: PushSubscriptionInfo,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  payload: { title: string; body: string; url?: string }
): Promise<Response> {
  const jwt = await buildVapidJwt(subscription.endpoint, vapidPublicKey, vapidPrivateKey);
  const body = await encryptPayload(JSON.stringify(payload), subscription);

  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      TTL: "60",
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
    },
    body: body as BodyInit,
  });
}
