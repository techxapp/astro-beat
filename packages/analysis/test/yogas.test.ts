// SPDX-License-Identifier: AGPL-3.0-or-later
// One positive and one negative fixture per yoga, plus modifiers.
import type { YogaId } from "@astro/schema/analysis";
import type { Planet } from "@astro/schema/enums";
import { describe, expect, it } from "vitest";
import { detectYogas, YOGA_CATALOG } from "../src/index.ts";
import { at, yogaCtx } from "./helpers.ts";

type Case = { asc: number; lons: Partial<Record<Planet, number>>; planets?: Planet[] };

// Default positions (see helpers): Sun Ari, Moon Tau, Mars Gem, Mercury Ari, Jupiter Leo, Venus Vir,
// Saturn Lib, Rahu Cap, Ketu Can.
const FIXTURES: Record<YogaId, { yes: Case; no: Case }> = {
  ruchaka: { yes: { asc: at(0), lons: { Mars: at(9) }, planets: ["Mars"] }, no: { asc: at(0), lons: {} } },
  bhadra: { yes: { asc: at(2), lons: { Mercury: at(5) }, planets: ["Mercury"] }, no: { asc: at(2), lons: {} } },
  hamsa: { yes: { asc: at(0), lons: { Jupiter: at(3) }, planets: ["Jupiter"] }, no: { asc: at(0), lons: {} } },
  malavya: { yes: { asc: at(0), lons: { Venus: at(6) }, planets: ["Venus"] }, no: { asc: at(0), lons: {} } },
  sasa: { yes: { asc: at(0), lons: {}, planets: ["Saturn"] }, no: { asc: at(1), lons: {} } },
  gajakesari: { yes: { asc: at(0), lons: {}, planets: ["Jupiter", "Moon"] }, no: { asc: at(0), lons: { Jupiter: at(5) } } },
  "budha-aditya": { yes: { asc: at(0), lons: {}, planets: ["Sun", "Mercury"] }, no: { asc: at(0), lons: { Mercury: at(1) } } },
  "raja-kendra-trikona": {
    yes: { asc: at(0), lons: { Moon: at(0, 20) }, planets: ["Moon", "Sun"] },
    no: { asc: at(0), lons: { Moon: at(1), Sun: at(10), Jupiter: at(7), Mars: at(1), Venus: at(9), Saturn: at(3), Mercury: at(4) } },
  },
  dhana: {
    yes: { asc: at(0), lons: { Venus: at(4, 20) }, planets: ["Jupiter", "Venus"] },
    no: { asc: at(0), lons: { Venus: at(5), Saturn: at(3), Mars: at(10), Sun: at(8), Jupiter: at(1) } },
  },
  "viparita-harsha": { yes: { asc: at(0), lons: { Mercury: at(7) }, planets: ["Mercury"] }, no: { asc: at(0), lons: {} } },
  "viparita-sarala": { yes: { asc: at(0), lons: { Mars: at(11) }, planets: ["Mars"] }, no: { asc: at(0), lons: {} } },
  "viparita-vimala": { yes: { asc: at(0), lons: { Jupiter: at(5) }, planets: ["Jupiter"] }, no: { asc: at(0), lons: {} } },
  "neecha-bhanga": {
    yes: { asc: at(0), lons: { Sun: at(6), Venus: at(0) }, planets: ["Sun", "Venus", "Saturn"] },
    no: { asc: at(0), lons: { Sun: at(6), Venus: at(1), Saturn: at(10), Moon: at(2) } },
  },
  parivartana: { yes: { asc: at(0), lons: { Mars: at(1), Venus: at(0) }, planets: ["Mars", "Venus"] }, no: { asc: at(0), lons: { Mars: at(8) } } },
  kemadruma: { yes: { asc: at(0), lons: { Mars: at(8), Mercury: at(4) }, planets: ["Moon"] }, no: { asc: at(0), lons: {} } },
  "chandra-mangala": { yes: { asc: at(0), lons: { Mars: at(1) }, planets: ["Moon", "Mars"] }, no: { asc: at(0), lons: {} } },
  sunapha: { yes: { asc: at(0), lons: { Mercury: at(4) }, planets: ["Moon", "Mars"] }, no: { asc: at(0), lons: {} } },
  anapha: { yes: { asc: at(0), lons: { Mars: at(8) }, planets: ["Moon", "Mercury"] }, no: { asc: at(0), lons: {} } },
  durudhara: { yes: { asc: at(0), lons: {}, planets: ["Moon", "Mars", "Mercury"] }, no: { asc: at(0), lons: { Mars: at(8) } } },
  adhi: {
    yes: { asc: at(0), lons: { Mercury: at(6, 5), Jupiter: at(8), Venus: at(7), Saturn: at(10) }, planets: ["Moon", "Mercury", "Venus", "Jupiter"] },
    no: { asc: at(0), lons: { Mercury: at(6, 5), Jupiter: at(8), Venus: at(7) } },
  },
};

const hits = (c: Case, id: YogaId) => detectYogas(yogaCtx(c.asc, c.lons)).filter((y) => y.yoga === id);

describe("yoga catalog", () => {
  it("has a definition, source note and variant for every yoga", () => {
    for (const y of YOGA_CATALOG) {
      expect(y.definition.length).toBeGreaterThan(10);
      expect(y.sourceNote.length).toBeGreaterThan(3);
      expect(y.variant.length).toBeGreaterThan(3);
    }
    expect(new Set(YOGA_CATALOG.map((y) => y.id)).size).toBe(YOGA_CATALOG.length);
    expect(Object.keys(FIXTURES).sort()).toEqual(YOGA_CATALOG.map((y) => y.id).sort());
  });

  for (const [id, { yes, no }] of Object.entries(FIXTURES) as [YogaId, { yes: Case; no: Case }][]) {
    it(`${id}: positive fixture`, () => {
      const found = hits(yes, id);
      expect(found.length).toBeGreaterThan(0);
      if (yes.planets) expect(found.some((f) => [...f.planets].sort().join() === [...yes.planets!].sort().join())).toBe(true);
    });
    it(`${id}: negative fixture`, () => {
      const found = hits(no, id);
      if (id === "raja-kendra-trikona" || id === "dhana") {
        // Only the specific pair from the positive fixture must be absent.
        const pair = [...(yes.planets ?? [])].sort().join();
        expect(found.some((f) => [...f.planets].sort().join() === pair)).toBe(false);
      } else {
        expect(found).toEqual([]);
      }
    });
  }
});

describe("yoga modifiers", () => {
  it("exalted participant in a kendra", () => {
    const [y] = hits({ asc: at(0), lons: { Mars: at(9) } }, "ruchaka");
    expect(y?.modifiers).toEqual(["participant-exalted", "in-kendra"]);
    expect(y?.houses).toEqual([10]);
  });
  it("debilitated participant, dusthana", () => {
    // Aries lagna, Sun debilitated in Libra (7), Venus in Aries (1) cancels.
    const [y] = hits({ asc: at(0), lons: { Sun: at(6), Venus: at(0) } }, "neecha-bhanga");
    expect(y?.modifiers).toContain("participant-debilitated");
    const [v] = hits({ asc: at(0), lons: { Mercury: at(7) } }, "viparita-harsha");
    expect(v?.modifiers).toContain("involves-dusthana");
  });
  it("combust participant", () => {
    const [y] = hits({ asc: at(0), lons: { Sun: at(0, 10), Mercury: at(0, 14) } }, "budha-aditya");
    expect(y?.modifiers).toContain("participant-combust");
  });
  it("kemadruma is marked cancelled when a planet occupies a kendra", () => {
    const [y] = hits({ asc: at(0), lons: { Mars: at(8), Mercury: at(4) } }, "kemadruma");
    expect(y?.modifiers).toContain("cancelled");
  });
  it("neecha-bhanga honours the from-Moon setting", () => {
    // Venus (dispositor of debilitated Sun in Libra) in Cancer: kendra from Moon (Aries) but not from lagna (Taurus... 3rd).
    const lons = { Sun: at(6), Venus: at(3), Saturn: at(11), Moon: at(0) };
    const on = detectYogas(yogaCtx(at(1), lons, { neechaBhanga: "kendra-from-lagna-or-moon" })).filter((y) => y.yoga === "neecha-bhanga");
    const off = detectYogas(yogaCtx(at(1), lons, { neechaBhanga: "kendra-from-lagna" })).filter((y) => y.yoga === "neecha-bhanga");
    expect(on.length).toBe(1);
    expect(off.length).toBe(0);
  });
});
