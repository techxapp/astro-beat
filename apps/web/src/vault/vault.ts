// SPDX-License-Identifier: AGPL-3.0-or-later
// Encrypted local storage: IndexedDB records sealed with AES-256-GCM under a data-encryption key
// (DEK). The DEK is either a non-extractable device key kept in IndexedDB (casual protection
// only: anyone with this browser profile can use it) or wrapped by a passphrase (PBKDF2-SHA256).
import { openDB, type DBSchema, type IDBPDatabase } from "idb";

const DB_NAME = "astro-beat";
const PBKDF2_ITERATIONS = 600_000;

interface Sealed {
  iv: Uint8Array;
  ct: ArrayBuffer;
}

interface WrappedDek {
  salt: Uint8Array;
  iterations: number;
  iv: Uint8Array;
  ct: ArrayBuffer;
}

interface VaultDB extends DBSchema {
  meta: { key: string; value: unknown };
  records: { key: string; value: Sealed };
}

export type KeyMode = "device" | "passphrase";

export class VaultLockedError extends Error {
  constructor() {
    super("The vault is locked.");
    this.name = "VaultLockedError";
  }
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function kekFrom(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

const importDek = (raw: ArrayBuffer | Uint8Array): Promise<CryptoKey> =>
  crypto.subtle.importKey("raw", raw as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);

export class Vault {
  private db: IDBPDatabase<VaultDB> | null = null;
  private dek: CryptoKey | null = null;
  mode: KeyMode = "device";

  async open(): Promise<void> {
    this.db = await openDB<VaultDB>(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore("meta");
        db.createObjectStore("records");
      },
    });
    const mode = (await this.db.get("meta", "keymode")) as KeyMode | undefined;
    if (!mode) {
      // First run: device key.
      const dek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      await this.db.put("meta", dek, "dek");
      await this.db.put("meta", "device", "keymode");
      this.mode = "device";
      this.dek = dek;
      return;
    }
    this.mode = mode;
    if (mode === "device") this.dek = (await this.db.get("meta", "dek")) as CryptoKey;
  }

  get locked(): boolean {
    return this.dek === null;
  }

  private get store(): IDBPDatabase<VaultDB> {
    if (!this.db) throw new Error("vault not open");
    return this.db;
  }

  async unlock(passphrase: string): Promise<boolean> {
    const w = (await this.store.get("meta", "wrapped")) as WrappedDek | undefined;
    if (!w) return false;
    try {
      const kek = await kekFrom(passphrase, w.salt, w.iterations);
      const raw = await crypto.subtle.decrypt({ name: "AES-GCM", iv: w.iv as BufferSource }, kek, w.ct);
      this.dek = await importDek(raw);
      new Uint8Array(raw).fill(0);
      return true;
    } catch {
      return false;
    }
  }

  /** Drop the key from memory (passphrase mode only; device mode reopens without a prompt). */
  lock(): void {
    if (this.mode === "passphrase") this.dek = null;
  }

  private async seal(value: unknown): Promise<Sealed> {
    if (!this.dek) throw new VaultLockedError();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, this.dek, enc.encode(JSON.stringify(value)));
    return { iv, ct };
  }

  private async unseal<T>(s: Sealed, key: CryptoKey | null = this.dek): Promise<T> {
    if (!key) throw new VaultLockedError();
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: s.iv as BufferSource }, key, s.ct);
    return JSON.parse(dec.decode(pt)) as T;
  }

  async put(key: string, value: unknown): Promise<void> {
    await this.store.put("records", await this.seal(value), key);
  }

  async get<T>(key: string): Promise<T | undefined> {
    const s = await this.store.get("records", key);
    return s ? this.unseal<T>(s) : undefined;
  }

  async delete(key: string): Promise<void> {
    await this.store.delete("records", key);
  }

  async keys(prefix = ""): Promise<string[]> {
    return (await this.store.getAllKeys("records")).filter((k) => k.startsWith(prefix));
  }

  /** Unencrypted, non-sensitive settings (needed before unlock, e.g. auto-lock minutes). */
  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await this.store.get("meta", `pref:${key}`)) as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.store.put("meta", value, `pref:${key}`);
  }

  /** Re-encrypt every record under a new DEK. */
  private async rekey(newDek: CryptoKey): Promise<void> {
    const old = this.dek;
    if (!old) throw new VaultLockedError();
    const keys = await this.store.getAllKeys("records");
    const plain: [string, unknown][] = [];
    for (const k of keys) plain.push([k, await this.unseal(await this.store.get("records", k) as Sealed, old)]);
    this.dek = newDek;
    const tx = this.store.transaction("records", "readwrite");
    for (const [k, v] of plain) await tx.store.put(await this.seal(v), k);
    await tx.done;
  }

  async setPassphrase(passphrase: string): Promise<void> {
    if (passphrase.length < 8) throw new Error("Use at least 8 characters.");
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const kek = await kekFrom(passphrase, salt, PBKDF2_ITERATIONS);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, kek, raw as BufferSource);
    const newDek = await importDek(raw);
    raw.fill(0);
    await this.rekey(newDek);
    const wrapped: WrappedDek = { salt, iterations: PBKDF2_ITERATIONS, iv, ct };
    await this.store.put("meta", wrapped, "wrapped");
    await this.store.delete("meta", "dek");
    await this.store.put("meta", "passphrase", "keymode");
    this.mode = "passphrase";
  }

  async removePassphrase(): Promise<void> {
    const dek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await this.rekey(dek);
    await this.store.put("meta", dek, "dek");
    await this.store.delete("meta", "wrapped");
    await this.store.put("meta", "device", "keymode");
    this.mode = "device";
  }

  close(): void {
    this.db?.close();
    this.db = null;
    this.dek = null;
  }
}

/** Clear everything: IndexedDB, Cache Storage, local/session storage and the service worker. */
export async function clearEverything(vault: Vault | null): Promise<void> {
  vault?.close();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
  if (typeof caches !== "undefined") for (const k of await caches.keys()) await caches.delete(k);
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    /* storage may be unavailable */
  }
  if (typeof navigator !== "undefined" && navigator.serviceWorker) {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
  }
}
