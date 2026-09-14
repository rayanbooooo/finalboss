import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, type EncryptedSecret } from "@/lib/exchange/crypto";

/**
 * These run against real WebCrypto, not a stub. PBKDF2 at 600,000 iterations
 * is deliberately slow - about a second per derivation - so the suite keeps
 * the number of round trips small rather than lowering the cost, which is the
 * one parameter that must not drift.
 */
const SECRET = "bybit-api-secret-abc123XYZ";
const PASSPHRASE = "correct horse battery staple";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a secret", async () => {
    const encrypted = await encryptSecret(SECRET, PASSPHRASE);
    expect(await decryptSecret(encrypted, PASSPHRASE)).toBe(SECRET);
  }, 20_000);

  it("stores nothing that reveals the secret or the passphrase", async () => {
    const encrypted = await encryptSecret(SECRET, PASSPHRASE);
    const stored = JSON.stringify(encrypted);
    expect(stored).not.toContain(SECRET);
    expect(stored).not.toContain(PASSPHRASE);
    // Only these four fields are ever persisted - no plaintext, no key.
    expect(Object.keys(encrypted).sort()).toEqual(["ciphertext", "iterations", "iv", "salt"]);
  }, 20_000);

  /** The cost factor is the whole security margin of a stolen database. A
   * change that lowers it should fail here rather than ship quietly. */
  it("derives at OWASP's floor for PBKDF2-HMAC-SHA256", async () => {
    const encrypted = await encryptSecret(SECRET, PASSPHRASE);
    expect(encrypted.iterations).toBe(600_000);
  }, 20_000);

  it("uses a fresh salt and iv every time", async () => {
    const [a, b] = await Promise.all([
      encryptSecret(SECRET, PASSPHRASE),
      encryptSecret(SECRET, PASSPHRASE),
    ]);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    // Same plaintext, same passphrase, different ciphertext.
    expect(a.ciphertext).not.toBe(b.ciphertext);
  }, 30_000);

  it("rejects the wrong passphrase", async () => {
    const encrypted = await encryptSecret(SECRET, PASSPHRASE);
    await expect(decryptSecret(encrypted, "wrong passphrase")).rejects.toThrow(
      /Wrong passphrase/
    );
  }, 30_000);

  /**
   * AES-GCM's authentication tag makes tampering and a wrong passphrase the
   * same failure, which is what we want: altered ciphertext must not decrypt
   * into a plausible-looking secret that then gets used to sign an order.
   */
  it("rejects tampered ciphertext rather than decrypting it", async () => {
    const encrypted = await encryptSecret(SECRET, PASSPHRASE);
    const bytes = Buffer.from(encrypted.ciphertext, "base64");
    bytes[0] ^= 0xff;
    const tampered: EncryptedSecret = {
      ...encrypted,
      ciphertext: bytes.toString("base64"),
    };
    await expect(decryptSecret(tampered, PASSPHRASE)).rejects.toThrow(/tampered/);
  }, 30_000);
});
