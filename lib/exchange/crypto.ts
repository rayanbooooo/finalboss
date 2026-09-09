/**
 * Envelope encryption for exchange API secrets.
 *
 * The secret is encrypted in the browser under a passphrase only the user
 * knows, and only the ciphertext reaches our database. A full breach of the
 * database and the server yields bytes that are useless without each
 * individual user's passphrase - which is the whole point, and the reason
 * this app never signs requests server-side.
 *
 * Uses WebCrypto only, so the same code runs in the browser and under Node
 * for the tests.
 */

/** OWASP's floor for PBKDF2-HMAC-SHA256. Costs ~1s in a browser, paid once
 * per unlock rather than per request. */
const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12; // 96 bits, the size AES-GCM is specified for.

export interface EncryptedSecret {
  ciphertext: string;
  salt: string;
  iv: string;
  iterations: number;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptSecret(
  secret: string,
  passphrase: string
): Promise<EncryptedSecret> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(secret)
  );

  return {
    ciphertext: toBase64(new Uint8Array(ciphertext)),
    salt: toBase64(salt),
    iv: toBase64(iv),
    iterations: PBKDF2_ITERATIONS,
  };
}

/**
 * Throws if the passphrase is wrong or the ciphertext was altered - AES-GCM's
 * authentication tag makes those the same failure, which is what we want:
 * tampering is not silently decrypted into a plausible-looking secret.
 */
export async function decryptSecret(
  encrypted: EncryptedSecret,
  passphrase: string
): Promise<string> {
  const key = await deriveKey(
    passphrase,
    fromBase64(encrypted.salt),
    encrypted.iterations
  );
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(encrypted.iv) as BufferSource },
      key,
      fromBase64(encrypted.ciphertext) as BufferSource
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    throw new Error("Wrong passphrase, or the stored key has been tampered with.");
  }
}
