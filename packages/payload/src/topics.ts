// SPDX-License-Identifier: AGPL-3.0-or-later
// Per-topic allowlists. Only what a topic needs leaves the device (§5.2, §9).
import type { CharaKaraka, Planet, Topic, Varga, WesternBody, YogaFamily } from "@astro/schema/enums";

export interface PeriodWindow {
  /** ADs of the current MD: only the current and upcoming ones, or all of them */
  currentMdAds: "remaining" | "all";
  /** how many following MDs to include (MD level only) */
  nextMds: number;
  /** how many ADs (the current one and the ones after it) contribute their PDs: month-level timing */
  pdAds: number;
}

export interface TopicSpec {
  houses: number[];
  karakas: Planet[];
  charaKarakas: CharaKaraka[];
  /** only the vargas this topic needs: each extra varga lagna narrows birth time (§9) */
  vargas: Varga[];
  yogaFamilies: YogaFamily[];
  periodWindow: PeriodWindow;
}

export interface KpTopicSpec {
  cusps: number[];
  /** sub-sub lords narrow birth time sharply; off unless a topic needs them */
  includeSubSub: boolean;
  periodWindow: PeriodWindow;
}

// Three ADs of month-level periods keep the near term (this year and the next few) fine-grained.
const WINDOW: PeriodWindow = { currentMdAds: "remaining", nextMds: 1, pdAds: 3 };
const ALL_HOUSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const ALL_PLANETS: Planet[] = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];

export const TOPIC_SPECS: Readonly<Record<Topic, TopicSpec>> = {
  career: {
    houses: [1, 2, 6, 10, 11], karakas: ["Sun", "Saturn", "Mercury", "Jupiter"], charaKarakas: ["AmK"],
    vargas: ["D9", "D10"], yogaFamilies: ["raja", "dhana", "mahapurusha", "solar"], periodWindow: WINDOW,
  },
  marriage: {
    houses: [1, 2, 7, 8, 11], karakas: ["Venus", "Jupiter"], charaKarakas: ["DK"],
    vargas: ["D9"], yogaFamilies: [], periodWindow: WINDOW,
  },
  finance: {
    houses: [1, 2, 5, 9, 11], karakas: ["Jupiter", "Venus", "Mercury"], charaKarakas: [],
    vargas: ["D2", "D9"], yogaFamilies: ["dhana"], periodWindow: WINDOW,
  },
  health: {
    houses: [1, 6, 8, 12], karakas: ["Sun", "Moon", "Saturn", "Mars"], charaKarakas: [],
    vargas: ["D9"], yogaFamilies: [], periodWindow: WINDOW,
  },
  education: {
    houses: [2, 4, 5, 9], karakas: ["Mercury", "Jupiter"], charaKarakas: [],
    vargas: ["D9", "D24"], yogaFamilies: [], periodWindow: WINDOW,
  },
  children: {
    houses: [5, 9], karakas: ["Jupiter"], charaKarakas: ["PK"],
    vargas: ["D7", "D9"], yogaFamilies: [], periodWindow: WINDOW,
  },
  general: {
    houses: ALL_HOUSES, karakas: ALL_PLANETS, charaKarakas: [],
    vargas: ["D9"],
    yogaFamilies: ["mahapurusha", "raja", "dhana", "viparita", "lunar", "solar", "parivartana", "cancellation"],
    periodWindow: WINDOW,
  },
};

/** KP house groups per topic: defaults drawn from common KP practice; pending review (Q4a). */
export const KP_TOPIC_SPECS: Readonly<Record<Topic, KpTopicSpec>> = {
  career: { cusps: [2, 6, 10, 11], includeSubSub: false, periodWindow: WINDOW },
  marriage: { cusps: [1, 2, 6, 7, 10, 11], includeSubSub: false, periodWindow: WINDOW },
  finance: { cusps: [2, 6, 11], includeSubSub: false, periodWindow: WINDOW },
  health: { cusps: [1, 6, 8, 12], includeSubSub: false, periodWindow: WINDOW },
  education: { cusps: [4, 9, 11], includeSubSub: false, periodWindow: WINDOW },
  children: { cusps: [2, 5, 11], includeSubSub: false, periodWindow: WINDOW },
  general: { cusps: ALL_HOUSES, includeSubSub: false, periodWindow: WINDOW },
};

export interface WesternTopicSpec {
  /** houses (Placidus, or whole-sign at high latitudes) */
  houses: number[];
  /** natural significators */
  bodies: WesternBody[];
}

/** Western house groups and significators per topic: common modern practice, pending review. */
export const WESTERN_TOPIC_SPECS: Readonly<Record<Topic, WesternTopicSpec>> = {
  career: { houses: [2, 6, 10], bodies: ["Sun", "Saturn", "Mars", "Jupiter", "Mercury"] },
  marriage: { houses: [5, 7, 8], bodies: ["Venus", "Mars", "Moon", "Jupiter", "Sun"] },
  finance: { houses: [2, 8, 11], bodies: ["Venus", "Jupiter", "Saturn", "Mercury"] },
  health: { houses: [1, 6, 12], bodies: ["Sun", "Moon", "Mars", "Saturn"] },
  education: { houses: [3, 9], bodies: ["Mercury", "Jupiter", "Moon"] },
  children: { houses: [5, 11], bodies: ["Moon", "Jupiter", "Venus"] },
  general: { houses: ALL_HOUSES, bodies: ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "NorthNode", "SouthNode"] },
};

/**
 * A combined reading carries several branches in one request, so each Vedic branch sends only the
 * current AD's month-level periods and fewer facts (the proxy body limit and the model's attention
 * are shared).
 */
export const COMBINED_WINDOW: PeriodWindow = { currentMdAds: "remaining", nextMds: 1, pdAds: 1 };
