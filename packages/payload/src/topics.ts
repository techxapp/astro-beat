// SPDX-License-Identifier: AGPL-3.0-or-later
// Per-topic allowlists. Only what a topic needs leaves the device (§5.2, §9).
import type { CharaKaraka, Planet, Topic, Varga, YogaFamily } from "@astro/schema/enums";

export interface PeriodWindow {
  /** ADs of the current MD: only the current and upcoming ones, or all of them */
  currentMdAds: "remaining" | "all";
  /** how many following MDs to include (MD level only) */
  nextMds: number;
  /** which ADs contribute their PDs */
  pdsIn: "currentAd" | "currentAndNextAd";
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

const WINDOW: PeriodWindow = { currentMdAds: "remaining", nextMds: 1, pdsIn: "currentAd" };
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
    periodWindow: { currentMdAds: "remaining", nextMds: 1, pdsIn: "currentAndNextAd" },
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
  general: { cusps: ALL_HOUSES, includeSubSub: false, periodWindow: { currentMdAds: "remaining", nextMds: 1, pdsIn: "currentAndNextAd" } },
};
