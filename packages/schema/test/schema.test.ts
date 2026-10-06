// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { PredictionOutput, PredictionRequest, PromptVersion } from "../src/api.ts";
import { BirthInput } from "../src/identifying.ts";

describe("schema", () => {
  it("prompt versions", () => {
    for (const ok of ["career@1", "kp-marriage@2", "parashari-general@10"]) expect(PromptVersion.safeParse(ok).success).toBe(true);
    for (const bad of ["Career@1", "kp_marriage@1", "kp-marriage", "@1", "kp-@1"]) expect(PromptVersion.safeParse(bad).success).toBe(false);
  });
  it("requests are strict", () => {
    const r = PredictionRequest.safeParse({ requestId: crypto.randomUUID(), payload: {}, extra: "x" });
    expect(r.success).toBe(false);
  });
  it("output requires at least one theme with a basis", () => {
    const base = { summary: "s", themes: [], periods: [], limitations: [], declined: [] };
    expect(PredictionOutput.safeParse(base).success).toBe(false);
    expect(PredictionOutput.safeParse({ ...base, themes: [{ title: "t", detail: "d", tone: "mixed", basis: ["F1"] }] }).success).toBe(true);
    expect(PredictionOutput.safeParse({ ...base, themes: [{ title: "t", detail: "d", tone: "mixed", basis: ["X1"] }] }).success).toBe(false);
  });
  it("older outputs without a comparison table still parse (stored readings)", () => {
    const old = { summary: "s", themes: [{ title: "t", detail: "d", tone: "mixed", basis: ["F1"] }], periods: [], limitations: [], declined: [] };
    const parsed = PredictionOutput.parse(old);
    expect(parsed.comparison).toEqual([]);
    expect(parsed.table).toEqual([]);
  });
  it("comparison views name a branch, never 'combined'", () => {
    const base = { summary: "s", themes: [{ title: "t", detail: "d", tone: "mixed", basis: ["F1"] }], periods: [], limitations: [], declined: [] };
    const row = (system: string) => ({ aspect: "Right now", views: [{ system, view: "v", periods: ["P1"], basis: ["F1"] }], agreement: "single", synthesis: "s" });
    expect(PredictionOutput.safeParse({ ...base, comparison: [row("western")] }).success).toBe(true);
    expect(PredictionOutput.safeParse({ ...base, comparison: [row("combined")] }).success).toBe(false);
  });
  it("birth input validates ranges", () => {
    const b = {
      localDate: "1990-01-01", localTime: "10:00", timeAccuracy: "exact",
      place: { label: "x", lat: 91, lon: 0 }, timezone: { iana: "UTC", utcOffsetMinutes: 0, overridden: false },
    };
    expect(BirthInput.safeParse(b).success).toBe(false);
    expect(BirthInput.safeParse({ ...b, place: { ...b.place, lat: 45 } }).success).toBe(true);
  });
});
