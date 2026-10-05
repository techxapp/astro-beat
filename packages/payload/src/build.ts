// SPDX-License-Identifier: AGPL-3.0-or-later
// AnalysisPublic → PredictionPayload. This module can only see the public half of the analysis
// (no longitudes, no dates, no maraka): see the import restrictions in eslint.config.js.
import {
  YOGA_FAMILY, type AnalysisPublic, type Fact, type KpFact, type NumerologyAnalysis, type PeriodFact, type WesternAnalysis,
  type WesternFact,
} from "@astro/schema/analysis";
import { BRANCHES, type Branch, type ChartSystem, type Planet, type Topic, type WesternPoint } from "@astro/schema/enums";
import {
  PAYLOAD_VERSION, PredictionPayload, type KpPart, type NumerologyPart, type ParashariPart, type PayloadPart, type PayloadPeriodFact,
  type WesternPart,
} from "@astro/schema/payload";
import { COMBINED_WINDOW, KP_TOPIC_SPECS, TOPIC_SPECS, WESTERN_TOPIC_SPECS, type PeriodWindow } from "./topics.ts";

export const MAX_FACTS = { parashari: 250, kp: 120, western: 150 } as const;
/** Per-branch fact caps inside a combined payload. */
export const COMBINED_MAX_FACTS = { parashari: 90, kp: 45, western: 50 } as const;
export const MAX_WESTERN_PERIODS = 30;
export const MAX_PERIODS = 60;
/** Fact references per payload period (most important first). */
export const MAX_PERIOD_REFS = 12;
/** Transit events per payload period. */
export const MAX_TRANSITS_PER_PERIOD = 8;

/** Where a payload id or label points: the chart analysis, or the numerology result (its own namespace). */
export type Origin = "analysis" | "numerology";

export interface BuiltPayload {
  payload: PredictionPayload;
  /** payload period label → source period label (the client maps these to local dates) */
  periodLabelMap: Record<string, string>;
  /** payload fact id → source fact id (for basis chips in the explorer) */
  factIdMap: Record<string, string>;
  /** which source each payload period label and fact id refers to */
  origin: { periods: Record<string, Origin>; facts: Record<string, Origin> };
}

export class PayloadUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayloadUnavailableError";
  }
}

/** Periods in the topic window, in label order. */
export function selectPeriods(periods: readonly PeriodFact[], w: PeriodWindow): PeriodFact[] {
  const mds = periods.filter((p) => p.level === "MD");
  const current = mds.find((p) => p.status === "current") ?? mds.find((p) => p.status === "upcoming");
  if (!current) return [];
  // Following MDs are sent at MD level only; ADs come from the current MD.
  const chosenMds = mds.filter((p) => p.order >= current.order && p.order <= current.order + w.nextMds);
  const ads = periods.filter((p) =>
    p.level === "AD" && p.lords[0] === current.lords[0] && (w.currentMdAds === "all" || p.status !== "past"));
  const curAd = periods.find((p) => p.level === "AD" && p.status === "current")
    ?? periods.find((p) => p.level === "AD" && p.status === "upcoming");
  // The current AD and the ones after it (they may spill into the next MD) contribute their PDs.
  const pdParents = curAd
    ? periods.filter((p) => p.level === "AD" && p.order >= curAd.order && p.order < curAd.order + w.pdAds)
    : [];
  const adKeys = new Set(pdParents.map((p) => p.lords.join("|")));
  const pds = periods.filter((p) => p.level === "PD" && adKeys.has(p.lords.slice(0, 2).join("|")) && p.status !== "past");
  const chosen = new Set([...chosenMds, ...ads, ...pdParents, ...pds]);
  return periods.filter((p) => chosen.has(p)).slice(0, MAX_PERIODS);
}

interface WindowLords {
  /** every lord of a period in the window */
  all: ReadonlySet<Planet>;
  /** MD and AD lords */
  main: ReadonlySet<Planet>;
  /** "parent|child" lord pairs of AD and PD periods (both directions) */
  pairs: readonly string[];
}

function windowLords(periods: readonly PeriodFact[]): WindowLords {
  const pairs: string[] = [];
  for (const p of periods) {
    if (p.lords.length < 2) continue;
    const [a, b] = p.lords.slice(-2) as [Planet, Planet];
    if (a !== b) pairs.push(`${a}|${b}`, `${b}|${a}`);
  }
  return {
    all: new Set(periods.flatMap((p) => p.lords)),
    main: new Set(periods.filter((p) => p.level !== "PD").flatMap((p) => p.lords)),
    pairs,
  };
}

/**
 * Transit context without repetition: MDs carry none, ADs carry theirs, PDs carry only ingresses
 * that happen inside the PD (the enclosing AD already describes the ongoing transits).
 */
function trimTransits(p: PeriodFact): PeriodFact["transits"] {
  if (p.level === "MD") return [];
  const events = p.level === "PD" ? p.transits.filter((t) => !t.spansBoundary) : p.transits;
  // Retrograde re-entries repeat a planet+sign already listed; keep the first occurrence.
  const seen = new Set<string>();
  return events.filter((t) => {
    const key = `${t.planet}|${t.sign}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_TRANSITS_PER_PERIOD);
}

const intersects = <T>(a: readonly T[], b: ReadonlySet<T>): boolean => a.some((x) => b.has(x));

function selectParashari(facts: readonly Fact[], topic: Topic, lords: WindowLords, lagnaLord: Planet, max: number): Fact[] {
  const spec = TOPIC_SPECS[topic];
  const houses = new Set(spec.houses);
  const core = new Set<Planet>([...spec.karakas, lagnaLord, "Moon"]);
  for (const f of facts) {
    if (f.kind === "lordship" && houses.has(f.house)) core.add(f.lord);
    if (f.kind === "placement" && houses.has(f.house)) core.add(f.planet);
  }
  // MD/AD lords are weighed like topic planets; PD lords contribute their placement only.
  const relevant = new Set<Planet>([...core, ...lords.main]);
  const dashaPairs = new Set(lords.pairs);
  const vargas = new Set(spec.vargas);
  const families = new Set(spec.yogaFamilies);
  const karakas = new Set(spec.charaKarakas);
  const keep = (f: Fact): number | null => {
    switch (f.kind) {
      case "placement": return relevant.has(f.planet) || lords.all.has(f.planet) ? 0 : null;
      case "lordship": return houses.has(f.house) || f.house === 1 ? 1 : null;
      case "functionalRole": return relevant.has(f.planet) ? 2 : null;
      case "yoga":
        return families.has(YOGA_FAMILY[f.yoga]) || (intersects(f.planets, relevant) && intersects(f.houses, houses)) ? 3 : null;
      case "exchange": return intersects(f.planets, relevant) || intersects(f.houses, houses) ? 4 : null;
      case "conjunction": return intersects(f.planets, relevant) ? 5 : null;
      case "aspect": return relevant.has(f.from) || houses.has(f.toHouse) ? 6 : null;
      case "sav": return houses.has(f.house) ? 7 : null;
      case "charaKaraka": return karakas.has(f.karaka) ? 8 : null;
      case "vargaLagna": return vargas.has(f.varga) ? 9 : null;
      case "varga": return vargas.has(f.varga) && relevant.has(f.planet) ? 10 : null;
      case "relationship": return (core.has(f.a) && core.has(f.b)) || dashaPairs.has(`${f.a}|${f.b}`) ? 11 : null;
    }
  };
  return rank(facts, keep).slice(0, max);
}

function selectKp(facts: readonly KpFact[], topic: Topic, lords: WindowLords, max: number): KpFact[] {
  const spec = KP_TOPIC_SPECS[topic];
  const cusps = new Set(spec.cusps);
  const planets = new Set<Planet>(lords.all);
  for (const f of facts) {
    if (f.kind === "kpSignificators" && cusps.has(f.house)) for (const p of [...f.a, ...f.b, ...f.c, ...f.d]) planets.add(p);
    if (f.kind === "kpCusp" && cusps.has(f.cusp)) planets.add(f.subLord);
  }
  const keep = (f: KpFact): number | null => {
    switch (f.kind) {
      case "kpCusp": return cusps.has(f.cusp) ? 0 : null;
      case "kpSignificators": return cusps.has(f.house) ? 1 : null;
      case "kpPlanet": return planets.has(f.planet) ? 2 : null;
      case "kpPlanetSignifies": return planets.has(f.planet) ? 3 : null;
    }
  };
  return rank(facts, keep)
    .map((f) => {
      if ((f.kind === "kpCusp" && spec.includeSubSub) || (f.kind !== "kpCusp" && f.kind !== "kpPlanet")) return f;
      const { subSubLord: _drop, ...rest } = f;
      return rest as KpFact;
    })
    .slice(0, max);
}

function selectWestern(w: WesternAnalysis, topic: Topic, lords: ReadonlySet<string>, max: number): WesternFact[] {
  const spec = WESTERN_TOPIC_SPECS[topic];
  const houses = new Set(spec.houses);
  const relevant = new Set<WesternPoint>([...spec.bodies, w.ascendant.ruler, "Sun", "Moon", "Ascendant", "Midheaven"]);
  for (const l of lords) relevant.add(l as WesternPoint);
  for (const f of w.facts) {
    if (f.kind === "wHouseRuler" && houses.has(f.house)) relevant.add(f.ruler);
    if (f.kind === "wPlacement" && houses.has(f.house)) relevant.add(f.body);
  }
  const keep = (f: WesternFact): number | null => {
    switch (f.kind) {
      case "wAngle": return 0;
      case "wPlacement": return relevant.has(f.body) ? 1 : null;
      case "wHouseRuler": return houses.has(f.house) || f.house === 1 ? 2 : null;
      case "wAspect":
        return (relevant.has(f.a) && relevant.has(f.b)) || ((relevant.has(f.a) || relevant.has(f.b)) && f.closeness === "tight") ? 3 : null;
      case "wBalance": return 4;
    }
  };
  return rank(w.facts, keep).slice(0, max);
}

/** Stable ranking: by priority bucket, then original order. */
function rank<F>(facts: readonly F[], keep: (f: F) => number | null): F[] {
  return facts
    .map((f, i) => ({ f, i, p: keep(f) }))
    .filter((x): x is { f: F; i: number; p: number } => x.p !== null)
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((x) => x.f);
}

/** Renumbers fact ids and period labels across the parts of one payload and records the maps. */
class Renumber {
  private nextFact = 1;
  private nextPeriod = 1;
  readonly factIdMap: Record<string, string> = {};
  readonly periodLabelMap: Record<string, string> = {};
  readonly origin: BuiltPayload["origin"] = { periods: {}, facts: {} };

  facts<F extends { id: string }>(facts: readonly F[], origin: Origin): { facts: F[]; ids: Map<string, string> } {
    const ids = new Map<string, string>();
    const out = facts.map((f) => {
      const id = `F${this.nextFact++}`;
      this.factIdMap[id] = f.id;
      this.origin.facts[id] = origin;
      ids.set(f.id, id);
      return { ...f, id };
    });
    return { facts: out, ids };
  }

  label(source: string, origin: Origin): string {
    const label = `P${this.nextPeriod++}`;
    this.periodLabelMap[label] = source;
    this.origin.periods[label] = origin;
    return label;
  }
}

const mapRefs = (refs: readonly string[], ids: ReadonlyMap<string, string>): string[] =>
  refs.flatMap((r) => (ids.has(r) ? [ids.get(r) as string] : [])).slice(0, MAX_PERIOD_REFS);

interface VedicLimits {
  maxFacts: number;
  window?: PeriodWindow;
}

function vedicPart(analysis: AnalysisPublic, system: "parashari" | "kp", topic: Topic, ctx: Renumber, limits: VedicLimits): ParashariPart | KpPart {
  const sys = system === "kp" ? analysis.kp : analysis.parashari;
  if (!sys) throw new PayloadUnavailableError("KP analysis is unavailable for this chart (Placidus cusps undefined at this latitude).");
  const window = limits.window ?? (system === "kp" ? KP_TOPIC_SPECS : TOPIC_SPECS)[topic].periodWindow;
  const periods = selectPeriods(sys.periods, window);
  const lords = windowLords(periods);
  const selected: (Fact | KpFact)[] = system === "kp"
    ? selectKp(sys.facts as KpFact[], topic, lords, limits.maxFacts)
    : selectParashari(sys.facts as Fact[], topic, lords, sys.lagna.lord, limits.maxFacts);
  const { facts, ids } = ctx.facts(selected, "analysis");
  const payloadPeriods: PayloadPeriodFact[] = periods.map((p) => {
    const { order: _order, ...rest } = p;
    return { ...rest, label: ctx.label(p.label, "analysis"), factRefs: mapRefs(p.factRefs, ids), transits: trimTransits(p) };
  });
  const common = { nodeType: analysis.settings.nodeType, lagna: sys.lagna, moon: sys.moon, periods: payloadPeriods };
  return system === "kp"
    ? { system: "kp", ayanamsa: analysis.settings.kp.ayanamsa, ...common, facts: facts as KpFact[] }
    : { system: "parashari", ayanamsa: analysis.settings.parashari.ayanamsa, ...common, facts: facts as Fact[] };
}

function westernPart(analysis: AnalysisPublic, topic: Topic, ctx: Renumber, maxFacts: number): WesternPart {
  const w = analysis.western;
  if (!w) throw new PayloadUnavailableError("The Western chart is unavailable for this chart.");
  const periods = w.periods.filter((p) => p.status !== "past").slice(0, MAX_WESTERN_PERIODS);
  const { facts, ids } = ctx.facts(selectWestern(w, topic, new Set(periods.map((p) => p.profection.lord)), maxFacts), "analysis");
  return {
    system: "western", zodiac: w.zodiac, houseSystem: w.houseSystem, ascendant: w.ascendant, sun: w.sun, moon: w.moon, facts,
    periods: periods.map((p) => {
      const { order: _order, ...rest } = p;
      return { ...rest, label: ctx.label(p.label, "analysis"), factRefs: mapRefs(p.factRefs, ids) };
    }),
  };
}

function numerologyPart(n: NumerologyAnalysis, ctx: Renumber): NumerologyPart {
  // Every number is short and relevant to any topic; past cycles are dropped.
  const { facts } = ctx.facts(n.facts, "numerology");
  return {
    system: "numerology", method: n.method, nameUsed: n.nameUsed, facts,
    periods: n.periods.filter((p) => p.status !== "past").map((p) => {
      const { order: _order, ...rest } = p;
      return { ...rest, label: ctx.label(p.label, "numerology") };
    }),
  };
}

function finish(candidate: unknown, ctx: Renumber): BuiltPayload {
  // Strict parse: anything outside the payload schema is a bug, not something to send.
  return { payload: PredictionPayload.parse(candidate), periodLabelMap: ctx.periodLabelMap, factIdMap: ctx.factIdMap, origin: ctx.origin };
}

/**
 * Build the payload for one chart-based system and topic. Fact ids and period labels are
 * renumbered per payload so they reveal neither catalog size nor how many periods have elapsed
 * since birth.
 */
export function buildPayload(analysis: AnalysisPublic, system: ChartSystem, topic: Topic): BuiltPayload {
  const ctx = new Renumber();
  const part = system === "western"
    ? westernPart(analysis, topic, ctx, MAX_FACTS.western)
    : vedicPart(analysis, system, topic, ctx, { maxFacts: MAX_FACTS[system] });
  return finish({ ...part, payloadVersion: PAYLOAD_VERSION, topic }, ctx);
}

/** Build a numerology payload (numbers from the birth date and name, computed on the device). */
export function buildNumerologyPayload(numerology: NumerologyAnalysis, topic: Topic): BuiltPayload {
  const ctx = new Renumber();
  return finish({ ...numerologyPart(numerology, ctx), payloadVersion: PAYLOAD_VERSION, topic }, ctx);
}

export interface ReadingSources {
  analysis: AnalysisPublic;
  /** null when there is no birth date (chart-only import) */
  numerology: NumerologyAnalysis | null;
}

/** Branches that can contribute to a reading for these sources. */
export function availableBranches(sources: ReadingSources): Branch[] {
  return BRANCHES.filter((b) =>
    b === "kp" ? sources.analysis.kp !== null
      : b === "western" ? sources.analysis.western !== null
        : b === "numerology" ? sources.numerology !== null
          : true);
}

/**
 * Build one payload with several branches side by side. Ids and labels are numbered across all
 * parts, so the model can cite any of them; each Vedic branch sends a shorter period window.
 */
export function buildCombinedPayload(sources: ReadingSources, branches: readonly Branch[], topic: Topic): BuiltPayload {
  const chosen = BRANCHES.filter((b) => branches.includes(b));
  if (chosen.length < 2) throw new PayloadUnavailableError("A combined reading needs at least two branches.");
  const ctx = new Renumber();
  const parts: PayloadPart[] = chosen.map((b) => {
    switch (b) {
      case "parashari":
      case "kp":
        return vedicPart(sources.analysis, b, topic, ctx, { maxFacts: COMBINED_MAX_FACTS[b], window: COMBINED_WINDOW });
      case "western":
        return westernPart(sources.analysis, topic, ctx, COMBINED_MAX_FACTS.western);
      case "numerology":
        if (!sources.numerology) throw new PayloadUnavailableError("Numerology needs the birth date, which this profile does not have.");
        return numerologyPart(sources.numerology, ctx);
    }
  });
  return finish({ system: "combined", payloadVersion: PAYLOAD_VERSION, topic, parts }, ctx);
}
