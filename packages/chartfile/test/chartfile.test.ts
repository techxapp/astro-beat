// SPDX-License-Identifier: AGPL-3.0-or-later
import { DEFAULT_ENGINE_SETTINGS, ReferenceEngine } from "@astro/core";
import type { BirthInput, ProfilePlain } from "@astro/schema/identifying";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  canonicalJson, exportChartOnly, exportEncryptedProfile, fromBase64, ImportError, importChartFile, migrate, safeJsonParse, toBase64,
} from "../src/index.ts";

const BIRTH: BirthInput = {
  name: "Canary Person",
  localDate: "1987-03-21",
  localTime: "14:05",
  timeAccuracy: "exact",
  place: { label: "Pune, India", lat: 18.5204, lon: 73.8567 },
  timezone: { iana: "Asia/Kolkata", utcOffsetMinutes: 330, overridden: false },
};
const { chart, temporal } = ReferenceEngine.computeChart(BIRTH, DEFAULT_ENGINE_SETTINGS, { ingressYears: 100 });
const PROFILE: ProfilePlain = { profileId: "5b8f0a6e-2a3c-4d6e-9f10-1a2b3c4d5e6f", birth: BIRTH, temporal, chart, predictions: [] };
const FAST = 100_000; // minimum allowed iterations, to keep tests fast

const code = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof ImportError ? e.code : `other:${String(e)}`;
  }
};

describe("canonical JSON", () => {
  it("sorts keys recursively and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[3,{"y":2,"z":1}]},"b":1}');
  });
  it("base64 round trip", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(60_000));
    expect(fromBase64(toBase64(bytes))).toEqual(bytes);
  });
});

describe("chart-only files", () => {
  it("round-trips and verifies the checksum", async () => {
    const text = await exportChartOnly(chart);
    const r = await importChartFile(text);
    expect(r.kind).toBe("chart-only");
    if (r.kind === "chart-only") expect(r.chart).toEqual(chart);
  });
  it("rejects any modification", async () => {
    const file = JSON.parse(await exportChartOnly(chart));
    file.chart.parashari.planets[0].lon = (file.chart.parashari.planets[0].lon + 1) % 360;
    expect(await code(importChartFile(JSON.stringify(file)))).toBe("checksum_mismatch");
  });
  it("rejects extra keys (strict schema)", async () => {
    const file = JSON.parse(await exportChartOnly(chart));
    file.chart.extra = "<script>alert(1)</script>";
    expect(await code(importChartFile(JSON.stringify(file)))).toBe("invalid_schema");
  });
  it("rejects a chart that passes the checksum but fails sanity checks", async () => {
    const bad = structuredClone(chart);
    const mds = bad.parashari.dasha.periods.filter((p) => p.level === "MD");
    mds[1]!.path = [mds[3]!.path[0]!];
    const text = await exportChartOnly(bad);
    expect(await code(importChartFile(text))).toBe("sanity_failed");
  });
});

describe("encrypted profiles", () => {
  it("round-trips", async () => {
    const text = await exportEncryptedProfile(PROFILE, "correct horse battery", FAST);
    expect(text).not.toContain("Canary");
    expect(text).not.toContain("1987");
    const r = await importChartFile(text, { passphrase: "correct horse battery" });
    expect(r.kind).toBe("encrypted-profile");
    if (r.kind === "encrypted-profile") expect(r.profile.birth).toEqual(BIRTH);
  });
  it("needs a passphrase and rejects a wrong one", async () => {
    const text = await exportEncryptedProfile(PROFILE, "correct horse battery", FAST);
    expect(await code(importChartFile(text))).toBe("needs_passphrase");
    expect(await code(importChartFile(text, { passphrase: "wrong passphrase" }))).toBe("decrypt_failed");
  });
  it("detects bit flips in the header (AAD) and the ciphertext", async () => {
    const file = JSON.parse(await exportEncryptedProfile(PROFILE, "correct horse battery", FAST));
    const headerFlip = { ...file, kdf: { ...file.kdf, iterations: file.kdf.iterations + 1 } };
    expect(await code(importChartFile(JSON.stringify(headerFlip), { passphrase: "correct horse battery" }))).toBe("decrypt_failed");
    const ct = fromBase64(file.ciphertext);
    ct[10] = (ct[10] as number) ^ 1;
    const ctFlip = { ...file, ciphertext: toBase64(ct) };
    expect(await code(importChartFile(JSON.stringify(ctFlip), { passphrase: "correct horse battery" }))).toBe("decrypt_failed");
  });
  it("refuses short passphrases and too few iterations", async () => {
    await expect(exportEncryptedProfile(PROFILE, "short", FAST)).rejects.toThrow();
    const file = JSON.parse(await exportEncryptedProfile(PROFILE, "correct horse battery", FAST));
    file.kdf.iterations = 1000;
    expect(await code(importChartFile(JSON.stringify(file), { passphrase: "correct horse battery" }))).toBe("invalid_schema");
  });
});

describe("versioning and migrations", () => {
  it("rejects future and missing versions", async () => {
    const file = JSON.parse(await exportChartOnly(chart));
    expect(await code(importChartFile(JSON.stringify({ ...file, fileVersion: 2 })))).toBe("unsupported_version");
    const { fileVersion: _v, ...noVersion } = file;
    expect(await code(importChartFile(JSON.stringify(noVersion)))).toBe("unsupported_version");
  });
  it("runs a from→to chain", () => {
    const out = migrate(
      { format: "astro-beat", fileVersion: 1, a: 1 },
      { 1: (f) => ({ ...f, fileVersion: 2, b: 2 }), 2: (f) => ({ ...f, fileVersion: 3, c: 3 }) },
      3,
    );
    expect(out).toEqual({ format: "astro-beat", fileVersion: 3, a: 1, b: 2, c: 3 });
  });
});

describe("hostile input", () => {
  it("rejects oversize files", async () => {
    expect(await code(importChartFile("x".repeat(1_000_001)))).toBe("too_large");
  });
  it("rejects prototype keys and deep nesting", async () => {
    expect(() => safeJsonParse('{"__proto__":{"polluted":true}}')).toThrow(ImportError);
    expect(() => safeJsonParse('{"a":{"constructor":{"prototype":{}}}}')).toThrow(ImportError);
    expect(await code(importChartFile("[".repeat(10_000) + "]".repeat(10_000)))).toBe("too_deep");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("fuzz: mutated files are rejected cleanly and never hang", async () => {
    const base = await exportChartOnly(chart);
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: base.length - 1 }), fc.string({ minLength: 0, maxLength: 5 }), fc.integer({ min: 0, max: 8 }), async (pos, insert, del) => {
        const mutated = base.slice(0, pos) + insert + base.slice(pos + del);
        const result = await code(importChartFile(mutated));
        if (mutated === base) expect(result).toBe("ok");
        else expect(result.startsWith("other:")).toBe(false);
      }),
      { numRuns: 200 },
    );
  }, 60_000);
  it("fuzz: arbitrary JSON values are rejected with a typed error", async () => {
    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), async (v) => {
        const r = await code(importChartFile(JSON.stringify(v)));
        expect(r.startsWith("other:")).toBe(false);
        expect(r).not.toBe("ok");
      }),
      { numRuns: 200 },
    );
  });
});
