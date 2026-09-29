// SPDX-License-Identifier: AGPL-3.0-or-later
// Parashari fact assembly: placement → dignity/relations → states → aspects → lordship → vargas
// → ashtakavarga → chara karakas → yogas.
import type { AnalysisConventions, Fact, ParashariAnalysis } from "@astro/schema/analysis";
import type { Chart } from "@astro/schema/chart";
import { GRAHAS, PLANETS, type Dignity, type IsoDate, type Planet } from "@astro/schema/enums";
import type { MarakaFact, PeriodDates } from "@astro/schema/local";
import { aspectsOf, aspectsSign } from "./aspects.ts";
import { sarvashtakavarga } from "./ashtakavarga.ts";
import { natalContext, type NatalContext } from "./context.ts";
import { dignityBySign, dignityD1 } from "./dignity.ts";
import { charaKarakas } from "./karakas.ts";
import { badhakaLord, exchanges, functionalRole, lordOfHouse, marakaFacts } from "./lordship.ts";
import { buildPeriods, mutualPositionOf } from "./periods.ts";
import { compoundRelation, relationBucket } from "./relations.ts";
import { angularDistance, baladiAvastha, closenessBucket, isCombust, isGandanta, planetaryWar } from "./states.ts";
import {
  houseFrom, nakshatraLord, nakshatraName, ownedHouses, padaOf, signAt, signName, SIGN_LORD,
} from "./tables.ts";
import { transitEvents, transitTimeline } from "./transits.ts";
import { ANALYSIS_VARGAS, vargaSign } from "./vargas.ts";
import { detectYogas, type YogaContext } from "./yogas/index.ts";

export class FactIds {
  private n: number;
  constructor(start = 1) {
    this.n = start;
  }
  next(): string {
    return `F${this.n++}`;
  }
  get current(): number {
    return this.n;
  }
}

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

export interface ParashariResult {
  analysis: ParashariAnalysis;
  periodDates: PeriodDates;
  maraka: MarakaFact[];
  nextLabel: number;
  nextFactId: number;
  ctx: NatalContext;
  sav: number[];
}

export function buildYogaContext(ctx: NatalContext): YogaContext {
  const dignity = {} as Record<Planet, Dignity>;
  const combust = {} as Record<Planet, boolean>;
  for (const p of PLANETS) {
    dignity[p] = dignityD1(p, ctx.lon[p], ctx.sign, ctx.conventions.nodeDignity);
    combust[p] = isCombust(p, ctx.lon[p], ctx.pos[p].retrograde, ctx.lon.Sun, ctx.conventions.combustion);
  }
  const associated = (a: Planet, b: Planet): boolean => {
    if (ctx.sign[a] === ctx.sign[b]) return true;
    const na = ctx.conventions.nodeAspects;
    if (aspectsSign(a, ctx.sign[a], ctx.sign[b], na) && aspectsSign(b, ctx.sign[b], ctx.sign[a], na)) return true;
    return SIGN_LORD[ctx.sign[a]] === b && SIGN_LORD[ctx.sign[b]] === a;
  };
  return {
    ...ctx,
    dignity,
    combust,
    lord: (h) => lordOfHouse(ctx.lagnaSign, h),
    owns: (p) => ownedHouses(p, ctx.lagnaSign),
    associated,
  };
}

export function analyzeParashari(chart: Chart, conventions: AnalysisConventions, asOf: IsoDate, ids: FactIds, labelStart: number): ParashariResult {
  const ctx = natalContext(chart.parashari, conventions);
  const yctx = buildYogaContext(ctx);
  const facts: Fact[] = [];
  const add = (f: WithoutId<Fact>): void => {
    facts.push({ id: ids.next(), ...f } as Fact);
  };

  // Placement, dignity, states
  const war = planetaryWar(ctx.lon, conventions.planetaryWarWinner);
  for (const p of PLANETS) {
    const lon = ctx.lon[p];
    add({
      kind: "placement", planet: p, sign: signName(ctx.sign[p]), house: ctx.house[p],
      nakshatra: nakshatraName(lon), pada: padaOf(lon), nakshatraLord: nakshatraLord(lon),
      dignity: yctx.dignity[p], retrograde: ctx.pos[p].retrograde, combust: yctx.combust[p],
      vargottama: vargaSign("D9", lon) === ctx.sign[p], gandanta: isGandanta(lon),
      avastha: baladiAvastha(lon), planetaryWar: war.get(p) ?? "none",
    });
  }

  // Lordship
  for (let h = 1; h <= 12; h++) {
    const lord = lordOfHouse(ctx.lagnaSign, h);
    add({ kind: "lordship", house: h, lord, lordHouse: ctx.house[lord], lordSign: signName(ctx.sign[lord]) });
  }

  // Functional roles (+ badhaka as its own fact)
  for (const g of GRAHAS) add({ kind: "functionalRole", planet: g, role: functionalRole(g, ctx.lagnaSign) });
  add({ kind: "functionalRole", planet: badhakaLord(ctx.lagnaSign), role: "badhaka" });

  // Aspects
  for (const p of PLANETS) {
    for (const a of aspectsOf(p, conventions.nodeAspects)) {
      const toSign = signAt(ctx.sign[p], a.offset);
      add({
        kind: "aspect", from: p, toHouse: houseFrom(ctx.lagnaSign, toSign),
        toPlanets: (ctx.occupants[toSign] as Planet[]).filter((q) => q !== p), aspect: a.kind,
      });
    }
  }

  // Conjunctions (pairs in the same sign; closeness bucket from the degree gap, computed locally)
  for (let i = 0; i < PLANETS.length; i++) {
    for (let j = i + 1; j < PLANETS.length; j++) {
      const a = PLANETS[i] as Planet;
      const b = PLANETS[j] as Planet;
      if (ctx.sign[a] !== ctx.sign[b]) continue;
      add({ kind: "conjunction", planets: [a, b], house: ctx.house[a], closeness: closenessBucket(angularDistance(ctx.lon[a], ctx.lon[b])) });
    }
  }

  // Exchanges
  for (const x of exchanges(ctx)) add({ kind: "exchange", planets: x.planets, houses: x.houses, type: x.type });

  // Compound relationships (directional: a's view of b)
  for (const a of PLANETS) {
    for (const b of PLANETS) {
      if (a === b) continue;
      add({ kind: "relationship", a, b, compound: compoundRelation(a, b, ctx.sign[a], ctx.sign[b]) });
    }
  }

  // Vargas
  for (const v of ANALYSIS_VARGAS) {
    const lagnaV = vargaSign(v, ctx.ascendantLon);
    add({ kind: "vargaLagna", varga: v, sign: signName(lagnaV) });
    for (const p of PLANETS) {
      const s = vargaSign(v, ctx.lon[p]);
      add({ kind: "varga", varga: v, planet: p, sign: signName(s), house: houseFrom(lagnaV, s), dignity: dignityBySign(p, s, ctx.sign, conventions.nodeDignity) });
    }
  }

  // Ashtakavarga
  const sav = sarvashtakavarga(ctx);
  for (let h = 1; h <= 12; h++) add({ kind: "sav", house: h, bindus: sav[signAt(ctx.lagnaSign, h)] as number });

  // Chara karakas
  for (const k of charaKarakas(ctx, conventions.charaKarakas)) add({ kind: "charaKaraka", karaka: k.karaka, planet: k.planet });

  // Yogas
  for (const y of detectYogas(yctx)) add(y);

  // Periods
  const birthDate = chart.parashari.dasha.periods[0]?.start ?? asOf;
  const timeline = transitTimeline(chart, birthDate);
  const frame = { houseFromLagna: (s: number) => houseFrom(ctx.lagnaSign, s), moonSign: ctx.sign.Moon, sav };
  const { periods, dates, nextLabel } = buildPeriods(chart.parashari.dasha.periods, asOf, labelStart, {
    lordRelation: (a, b) => (a === b ? "same" : relationBucket(compoundRelation(a, b, ctx.sign[a], ctx.sign[b]))),
    mutualPosition: (a, b) => mutualPositionOf(ctx.sign[a], ctx.sign[b]),
    activatedHouses: (lords) => [...new Set(lords.flatMap((l) => [...ownedHouses(l, ctx.lagnaSign), ctx.house[l]]))].sort((x, y) => x - y),
    factRefs: (lords) => parashariFactRefs(facts, lords),
    transits: (level, start, end) => (level === "MD" ? [] : transitEvents(timeline, start, end, frame)),
  });

  const lagnaLord = lordOfHouse(ctx.lagnaSign, 1);
  const moonLon = ctx.lon.Moon;
  return {
    analysis: {
      lagna: { sign: signName(ctx.lagnaSign), lord: lagnaLord },
      moon: { sign: signName(ctx.sign.Moon), nakshatra: nakshatraName(moonLon), pada: padaOf(moonLon) },
      facts,
      periods,
    },
    periodDates: dates,
    maraka: marakaFacts(ctx),
    nextLabel,
    nextFactId: ids.current,
    ctx,
    sav,
  };
}

const REF_PRIORITY: Record<Fact["kind"], number> = {
  placement: 0, functionalRole: 1, lordship: 2, yoga: 3, exchange: 4, conjunction: 5, aspect: 6,
  charaKaraka: 7, relationship: 8, sav: 99, varga: 99, vargaLagna: 99,
};

/** Natal facts that involve any of the given lords, most important first. */
export function parashariFactRefs(facts: readonly Fact[], lords: readonly Planet[]): string[] {
  const has = (p: Planet): boolean => lords.includes(p);
  const involved = facts.filter((f) => {
    switch (f.kind) {
      case "placement": case "functionalRole": case "charaKaraka": return has(f.planet);
      case "lordship": return has(f.lord);
      case "yoga": case "exchange": case "conjunction": return f.planets.some(has);
      case "aspect": return has(f.from);
      case "relationship": return lords.length > 1 && has(f.a) && has(f.b);
      default: return false;
    }
  });
  return involved.sort((a, b) => REF_PRIORITY[a.kind] - REF_PRIORITY[b.kind]).slice(0, 40).map((f) => f.id);
}
