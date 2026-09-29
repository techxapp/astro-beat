// SPDX-License-Identifier: AGPL-3.0-or-later
// PBKDF2-SHA256 (600k iterations, 16-byte salt) → AES-256-GCM (12-byte IV, header as AAD). WebCrypto only.
import { canonicalJson, fromBase64, toBase64, utf8 } from "./encoding.ts";
import type { EncryptedProfileHeader } from "@astro/schema/file";

export const PBKDF2_ITERATIONS = 600_000;

export async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number, usages: KeyUsage[] = ["encrypt", "decrypt"]): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", utf8.encode(passphrase.normalize("NFC")) as BufferSource, "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

/** Additional authenticated data: the canonical header, so any header change breaks decryption. */
export const headerAad = (h: EncryptedProfileHeader): Uint8Array => utf8.encode(canonicalJson(h));

export async function encryptWithHeader(
  plaintext: string, passphrase: string, iterations = PBKDF2_ITERATIONS,
): Promise<{ header: EncryptedProfileHeader; ciphertext: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const header: EncryptedProfileHeader = {
    format: "astro-beat", fileVersion: 1, kind: "encrypted-profile",
    kdf: { name: "PBKDF2-SHA256", iterations, salt: toBase64(salt) },
    cipher: { name: "AES-256-GCM", iv: toBase64(iv) },
  };
  const key = await deriveKey(passphrase, salt, iterations, ["encrypt"]);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: headerAad(header) as BufferSource, tagLength: 128 },
    key,
    utf8.encode(plaintext) as BufferSource,
  );
  return { header, ciphertext: toBase64(new Uint8Array(ct)) };
}

/** Throws on a wrong passphrase or any tampering (GCM tag / AAD mismatch). */
export async function decryptWithHeader(header: EncryptedProfileHeader, ciphertext: string, passphrase: string): Promise<Uint8Array> {
  const salt = fromBase64(header.kdf.salt);
  const iv = fromBase64(header.cipher.iv);
  if (salt.length !== 16 || iv.length !== 12) throw new Error("bad salt or iv length");
  const key = await deriveKey(passphrase, salt, header.kdf.iterations, ["decrypt"]);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: headerAad(header) as BufferSource, tagLength: 128 },
    key,
    fromBase64(ciphertext) as BufferSource,
  );
  return new Uint8Array(pt);
}
