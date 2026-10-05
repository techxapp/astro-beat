// SPDX-License-Identifier: AGPL-3.0-or-later
// AnalysisPublic → PredictionPayload. This module can only see the public half of the analysis
// (no longitudes, no dates, no maraka): see the import restrictions in eslint.config.js.
import {
  YOGA_FAMILY, type AnalysisPublic, type Fact, type KpFact, type PeriodFact,
} from "@astro/schema/analysis";
import type { Planet, System, Topic } from "@astro/schema/enums";
import { PAYLOAD_VERSION, PredictionPayload, type PayloadPeriodFact } from "@astro/schema/payload";
import { KP_TOPIC_SPECS, TOPIC_SPECS, type PeriodWindow } from "./topics.ts";

export const MAX_FACTS = { parashari: 250, kp: 120 } as const;
export const MAX_PERIODS = 60;
/** Fact references per payload period (most important first). */
export const MAX_PERIOD_REFS = 12;
/** Transit events per payload period. */
export const MAX_TRANSITS_PER_PERIOD = 8;

export interface BuiltPayload {
  payload: PredictionPayload;
  /** payload period label → analysis period label (the client maps these to local dates) */
  periodLabelMap: Record<string, string>;
  /** payload fact id → analysis fact id (for basis chips in the explorer) */
  factIdMap: Record<string, string>;
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

function selectParashari(facts: readonly Fact[], topic: Topic, lords: WindowLords, lagnaLord: Planet): Fact[] {
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
  return rank(facts, keep).slice(0, MAX_FACTS.parashari);
}

function selectKp(facts: readonly KpFact[], topic: Topic, lords: WindowLords): KpFact[] {
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
    .slice(0, MAX_FACTS.kp);
}

/** Stable ranking: by priority bucket, then original order. */
function rank<F>(facts: readonly F[], keep: (f: F) => number | null): F[] {
  return facts
    .map((f, i) => ({ f, i, p: keep(f) }))
    .filter((x): x is { f: F; i: number; p: number } => x.p !== null)
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((x) => x.f);
}

/**
 * Build the payload for one system and topic. Fact ids and period labels are renumbered per
 * payload so they reveal neither catalog size nor how many periods have elapsed since birth.
 */
export function buildPayload(analysis: AnalysisPublic, system: System, topic: Topic): BuiltPayload {
  const sys = system === "kp" ? analysis.kp : analysis.parashari;
  if (!sys) throw new PayloadUnavailableError("KP analysis is unavailable for this chart (Placidus cusps undefined at this latitude).");
  const window = (system === "kp" ? KP_TOPIC_SPECS : TOPIC_SPECS)[topic].periodWindow;
  const periods = selectPeriods(sys.periods, window);
  const lords = windowLords(periods);

  const facts: (Fact | KpFact)[] = system === "kp"
    ? selectKp(sys.facts as KpFact[], topic, lords)
    : selectParashari(sys.facts as Fact[], topic, lords, sys.lagna.lord);

  const factIdMap: Record<string, string> = {};
  const toPayloadId = new Map<string, string>();
  const renumbered = facts.map((f, i) => {
    const id = `F${i + 1}`;
    factIdMap[id] = f.id;
    toPayloadId.set(f.id, id);
    return { ...f, id };
  });

  const periodLabelMap: Record<string, string> = {};
  const payloadPeriods: PayloadPeriodFact[] = periods.map((p, i) => {
    const label = `P${i + 1}`;
    periodLabelMap[label] = p.label;
    const { order: _order, ...rest } = p;
    return {
      ...rest,
      label,
      factRefs: p.factRefs.flatMap((r) => (toPayloadId.has(r) ? [toPayloadId.get(r) as string] : [])).slice(0, MAX_PERIOD_REFS),
      transits: trimTransits(p),
    };
  });

  const common = {
    payloadVersion: PAYLOAD_VERSION,
    topic,
    nodeType: analysis.settings.nodeType,
    lagna: sys.lagna,
    moon: sys.moon,
    periods: payloadPeriods,
  };
  const candidate = system === "kp"
    ? { system: "kp" as const, ayanamsa: analysis.settings.kp.ayanamsa, ...common, facts: renumbered }
    : { system: "parashari" as const, ayanamsa: analysis.settings.parashari.ayanamsa, ...common, facts: renumbered };
  // Strict parse: anything outside the payload schema is a bug, not something to send.
  return { payload: PredictionPayload.parse(candidate), periodLabelMap, factIdMap };
}
