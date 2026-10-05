// SPDX-License-Identifier: AGPL-3.0-or-later
// Human-readable renderings. Everything is plain text rendered through Svelte's escaping
// (no {@html} anywhere in the app).
import type {
  CoreNumber, Fact, KpFact, NumerologyFact, NumerologyPeriodFact, PeriodFact, TransitEvent, WesternFact, WesternPeriodFact,
  WesternTransitHit, WesternTransitStay,
} from "@astro/schema/analysis";
import type { System, WesternPoint } from "@astro/schema/enums";
import type { PeriodDates } from "@astro/schema/local";

export const SYSTEM_LABELS: Readonly<Record<System, string>> = {
  parashari: "Parashari", kp: "KP", western: "Western", numerology: "Numerology", combined: "Combined",
};
export const SYSTEM_TITLES: Readonly<Record<System, string>> = {
  parashari: "Parashari (Vedic)", kp: "KP (Krishnamurti)", western: "Western (tropical)", numerology: "Numerology (Pythagorean)",
  combined: "Combined comparison",
};

const POINT_NAMES: Partial<Record<WesternPoint, string>> = { NorthNode: "North Node", SouthNode: "South Node" };
const point = (p: WesternPoint): string => POINT_NAMES[p] ?? p;
const CORE_NAMES: Readonly<Record<CoreNumber, string>> = {
  lifePath: "Life Path", birthday: "Birthday", expression: "Expression", soulUrge: "Soul Urge", personality: "Personality", maturity: "Maturity",
};

const ord = (n: number): string => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};
const list = (xs: readonly string[]): string => (xs.length === 0 ? "none" : xs.join(", "));
const house = (h: number): string => `${ord(h)} house`;

export type AnyFact = Fact | KpFact | WesternFact | NumerologyFact;

export function factSentence(f: AnyFact): string {
  switch (f.kind) {
    case "placement": {
      const states = [
        f.retrograde && "retrograde", f.combust && "combust", f.vargottama && "vargottama", f.gandanta && "gandanta",
        f.planetaryWar !== "none" && `${f.planetaryWar} a planetary war`,
      ].filter(Boolean);
      return `${f.planet} in ${f.sign}, ${house(f.house)}, ${f.nakshatra} pada ${f.pada} (star lord ${f.nakshatraLord}); ${f.dignity}; ${f.avastha} avastha${states.length ? `; ${states.join(", ")}` : ""}.`;
    }
    case "lordship": return `Lord of the ${house(f.house)} is ${f.lord}, placed in the ${house(f.lordHouse)} (${f.lordSign}).`;
    case "aspect": return `${f.from} aspects the ${house(f.toHouse)} (${f.aspect} aspect)${f.toPlanets.length ? `, falling on ${list(f.toPlanets)}` : ""}.`;
    case "conjunction": return `${list(f.planets)} together in the ${house(f.house)} (${f.closeness}).`;
    case "exchange": return `${f.planets[0]} and ${f.planets[1]} exchange signs (${f.type}), linking houses ${f.houses[0]} and ${f.houses[1]}.`;
    case "functionalRole": return `${f.planet} is ${f.role === "badhaka" ? "the badhaka lord" : `functionally ${f.role}`} for this lagna.`;
    case "relationship": return `${f.a} regards ${f.b} as ${f.compound}.`;
    case "varga": return `${f.varga}: ${f.planet} in ${f.sign}, ${house(f.house)}, ${f.dignity}.`;
    case "vargaLagna": return `${f.varga} lagna is ${f.sign}.`;
    case "sav": return `${house(f.house)} has ${f.bindus} SAV bindus.`;
    case "charaKaraka": return `${f.planet} is the ${f.karaka} (chara karaka).`;
    case "yoga": return `${f.yoga} yoga with ${list(f.planets)} (houses ${f.houses.join(", ") || "–"})${f.modifiers.length ? `; ${f.modifiers.join(", ")}` : ""}.`;
    case "kpCusp": return `Cusp ${f.cusp} in ${f.sign}: sign lord ${f.signLord}, star lord ${f.starLord}, sub lord ${f.subLord}${f.subSubLord ? `, sub-sub ${f.subSubLord}` : ""}.`;
    case "kpPlanet": return `${f.planet} in ${f.sign}, bhava ${f.bhava}${f.retrograde ? ", retrograde" : ""}: star lord ${f.starLord}, sub lord ${f.subLord}.`;
    case "kpSignificators": return `House ${f.house} significators: A ${list(f.a)}; B ${list(f.b)}; C ${list(f.c)}; D ${list(f.d)}.`;
    case "kpPlanetSignifies": return `${f.planet} signifies houses ${f.houses.join(", ") || "none"} (via star lord ${f.viaStarLord.join(", ") || "none"}; sub lord ${f.viaSubLord.join(", ") || "none"}).`;
    case "wPlacement": return `${point(f.body)} in ${f.sign}, ${house(f.house)}${f.dignity === "none" ? "" : `; ${f.dignity}`}${f.retrograde ? "; retrograde" : ""}.`;
    case "wAngle": return `${f.angle} in ${f.sign} (ruled by ${f.ruler}).`;
    case "wHouseRuler": return `The ${house(f.house)} begins in ${f.cuspSign}; its ruler ${f.ruler} is in ${f.rulerSign}, ${house(f.rulerHouse)}.`;
    case "wAspect": return `${point(f.a)} ${f.aspect} ${point(f.b)} (${f.closeness}).`;
    case "wBalance": return `Elements: fire ${f.fire}, earth ${f.earth}, air ${f.air}, water ${f.water}; cardinal ${f.cardinal}, fixed ${f.fixed}, mutable ${f.mutable}.`;
    case "numCore": return `${CORE_NAMES[f.number]} number ${f.value}${f.karmicDebt ? ` (karmic debt ${f.karmicDebt})` : ""}.`;
    case "numKarmicLessons": return `Karmic lessons (digits missing from the name): ${f.missing.length ? f.missing.join(", ") : "none"}.`;
    case "numHiddenPassion": return `Hidden passion: ${f.values.join(", ")}.`;
  }
}

export function westernStaySentence(t: WesternTransitStay): string {
  return `${point(t.planet)} in ${t.sign} (${house(t.house)})`;
}
export function westernHitSentence(h: WesternTransitHit): string {
  return `${point(h.planet)} ${h.aspect} natal ${point(h.to)}`;
}

export function transitSentence(t: TransitEvent): string {
  const extra = [t.savBindus !== undefined && `${t.savBindus} SAV`, t.sadeSati && t.sadeSati !== "none" && `sade sati ${t.sadeSati}`].filter(Boolean);
  return `${t.planet} in ${t.sign} (${ord(t.houseFromLagna)} from lagna, ${ord(t.houseFromMoon)} from Moon${extra.length ? `; ${extra.join(", ")}` : ""})`;
}

type AnyPeriod = Pick<PeriodFact, "lords" | "level"> | Pick<WesternPeriodFact, "level" | "profection"> | Pick<NumerologyPeriodFact, "level" | "value" | "challenge">;

export function periodName(p: AnyPeriod): string {
  if ("lords" in p) return `${p.lords.join("–")} ${p.level}`;
  if ("profection" in p) {
    const y = `${ord(p.profection.house)}-house year (${p.profection.sign}, lord ${p.profection.lord})`;
    return p.level === "year" ? `Profection: ${y}` : `Quarter of the ${y}`;
  }
  switch (p.level) {
    case "pinnacle": return `Pinnacle ${p.value}${p.challenge === undefined ? "" : ` (challenge ${p.challenge})`}`;
    case "personalYear": return `Personal year ${p.value}`;
    case "personalMonth": return `Personal month ${p.value}`;
  }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthYear(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1] ?? "?"} ${y}`;
}
export function dateRange(d: { start: string; end: string } | undefined): string {
  return d ? `${monthYear(d.start)} – ${monthYear(d.end)}` : "dates unavailable";
}

export type Segment = { kind: "text"; text: string } | { kind: "period"; label: string; text: string } | { kind: "fact"; id: string };

/**
 * Split LLM text into segments, replacing payload period labels (P3) with local dates and
 * marking fact ids (F12) as chips. Unknown labels are left as they are.
 */
export function segmentText(text: string, dates: PeriodDates, names: Record<string, string> = {}): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(/\b([PF])(\d{1,3})\b/g)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: "text", text: text.slice(last, idx) });
    const token = m[0];
    if (m[1] === "P" && dates[token]) {
      out.push({ kind: "period", label: token, text: `${names[token] ? `${names[token]} ` : ""}(${dateRange(dates[token])})` });
    } else if (m[1] === "F") {
      out.push({ kind: "fact", id: token });
    } else {
      out.push({ kind: "text", text: token });
    }
    last = idx + token.length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
  return out;
}
