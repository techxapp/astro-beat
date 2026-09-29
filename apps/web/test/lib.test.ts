// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from "vitest";
import { dateRange, factSentence, segmentText } from "../src/lib/render.ts";
import { formatOffset, isValidZone, utcOffsetMinutes } from "../src/lib/tz.ts";

describe("historical UTC offsets (Intl tz database)", () => {
  it.each([
    ["Asia/Kolkata", "1987-03-21", "14:05", 330],
    ["Asia/Kolkata", "1943-06-01", "12:00", 390], // wartime IST +06:30
    ["America/New_York", "2020-01-15", "12:00", -300],
    ["America/New_York", "2020-07-15", "12:00", -240], // DST
    ["Europe/London", "1970-06-01", "12:00", 60], // British Standard Time experiment
    ["Australia/Sydney", "2021-01-10", "08:00", 660],
  ] as const)("%s %s %s → %i", (zone, date, time, expected) => {
    expect(utcOffsetMinutes(zone, date, time)).toBe(expected);
  });
  it("validates zones and formats offsets", () => {
    expect(isValidZone("Asia/Kolkata")).toBe(true);
    expect(isValidZone("Mars/Olympus")).toBe(false);
    expect(formatOffset(330)).toBe("UTC+05:30");
    expect(formatOffset(-210)).toBe("UTC−03:30");
  });
});

describe("rendering", () => {
  it("replaces known period labels with local dates and marks fact chips", () => {
    const segs = segmentText("In P2 (see F7) things improve; P9 is unknown.", { P2: { start: "2027-03-01", end: "2030-01-15" } });
    expect(segs).toEqual([
      { kind: "text", text: "In " },
      { kind: "period", label: "P2", text: "(Mar 2027 – Jan 2030)" },
      { kind: "text", text: " (see " },
      { kind: "fact", id: "F7" },
      { kind: "text", text: ") things improve; " },
      { kind: "text", text: "P9" },
      { kind: "text", text: " is unknown." },
    ]);
    expect(dateRange(undefined)).toBe("dates unavailable");
  });
  it("renders facts as sentences", () => {
    expect(factSentence({ id: "F1", kind: "sav", house: 10, bindus: 31 })).toBe("10th house has 31 SAV bindus.");
    expect(factSentence({ id: "F2", kind: "lordship", house: 11, lord: "Saturn", lordHouse: 3, lordSign: "Gemini" })).toBe(
      "Lord of the 11th house is Saturn, placed in the 3rd house (Gemini).",
    );
  });
});
