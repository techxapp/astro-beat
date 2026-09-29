// SPDX-License-Identifier: AGPL-3.0-or-later
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { Vault } from "../src/vault/vault.ts";

describe("vault", () => {
  it("encrypts records at rest and supports passphrase protection", async () => {
    const v = new Vault();
    await v.open();
    expect(v.mode).toBe("device");
    await v.put("profile:1", { name: "Zyxwv Canary", date: "1987-03-21" });
    expect(await v.get("profile:1")).toEqual({ name: "Zyxwv Canary", date: "1987-03-21" });

    // Raw IndexedDB contents never contain the plaintext.
    const raw = await new Promise<unknown[]>((resolve) => {
      const r = indexedDB.open("astro-beat");
      r.onsuccess = () => {
        const q = r.result.transaction("records").objectStore("records").getAll();
        q.onsuccess = () => resolve(q.result);
      };
    });
    const bytes = raw.map((x) => new TextDecoder().decode(new Uint8Array((x as { ct: ArrayBuffer }).ct))).join("");
    expect(bytes).not.toContain("Zyxwv");

    await v.setPassphrase("correct horse battery");
    expect(await v.get("profile:1")).toEqual({ name: "Zyxwv Canary", date: "1987-03-21" });
    v.lock();
    expect(v.locked).toBe(true);
    await expect(v.get("profile:1")).rejects.toThrow(/locked/);
    expect(await v.unlock("wrong passphrase")).toBe(false);
    expect(await v.unlock("correct horse battery")).toBe(true);
    expect(await v.get("profile:1")).toEqual({ name: "Zyxwv Canary", date: "1987-03-21" });

    // Reopen from storage: passphrase mode starts locked.
    v.close();
    const v2 = new Vault();
    await v2.open();
    expect(v2.locked).toBe(true);
    expect(await v2.unlock("correct horse battery")).toBe(true);
    await v2.removePassphrase();
    v2.close();
    const v3 = new Vault();
    await v3.open();
    expect(v3.locked).toBe(false);
    expect(await v3.get("profile:1")).toEqual({ name: "Zyxwv Canary", date: "1987-03-21" });
  }, 30_000);
});
