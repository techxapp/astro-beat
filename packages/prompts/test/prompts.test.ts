// SPDX-License-Identifier: AGPL-3.0-or-later
import { PromptVersion } from "@astro/schema/api";
import { SYSTEMS, TOPICS } from "@astro/schema/enums";
import { describe, expect, it } from "vitest";
import { getPrompt, listPromptIds, outputJsonSchema, STRICT_ALLOWED_KEYWORDS } from "../src/index.ts";

describe("prompts", () => {
  it("has a prompt for every (system, topic) with a valid version id", () => {
    for (const system of SYSTEMS) {
      for (const topic of TOPICS) {
        const p = getPrompt(system, topic)!;
        expect(PromptVersion.safeParse(p.id).success).toBe(true);
        expect(p.instructions).toContain("CHART_FACTS");
        expect(p.instructions).toMatch(/Never write calendar dates/);
      }
    }
    expect(listPromptIds()).toHaveLength(35);
  });
  it("rejects unknown pinned versions", () => {
    expect(getPrompt("kp", "marriage", "kp-marriage@3")).not.toBeNull();
    expect(getPrompt("kp", "marriage", "kp-marriage@99")).toBeNull();
    expect(getPrompt("kp", "marriage", "parashari-marriage@3")).toBeNull();
  });
  it("KP prompts forbid Parashari concepts", () => {
    expect(getPrompt("kp", "career")!.instructions).toMatch(/must not be invented/);
  });
  it("asks for plain language and fine-grained near-term coverage", () => {
    const text = getPrompt("parashari", "general")!.instructions;
    expect(text).toMatch(/NO astrology jargon/);
    expect(text).toMatch(/status is "current"/);
    expect(text).toMatch(/month-level/);
  });
  it("marriage prompts (every single-branch system) require the at-a-glance table; other topics do not", () => {
    for (const system of ["parashari", "kp", "western", "numerology"] as const) {
      const text = getPrompt(system, "marriage")!.instructions;
      for (const row of ["Most likely marriage window", "When you may meet your partner", "Partner's personality", "Partner's background"]) {
        expect(text).toContain(row);
      }
      expect(text).toMatch(/never predict divorce/);
      expect(getPrompt(system, "career")!.instructions).not.toContain("Most likely marriage window");
    }
  });
  it("Western prompts stay within the data (no outer planets, no Vedic concepts)", () => {
    const text = getPrompt("western", "career")!.instructions;
    expect(text).toMatch(/never invent Uranus, Neptune or Pluto/);
    expect(text).toMatch(/profections/);
    expect(text).toMatch(/must not be invented|never use Vedic concepts/);
  });
  it("numerology prompts explain the cycles and the missing-name case", () => {
    const text = getPrompt("numerology", "general")!.instructions;
    expect(text).toMatch(/personal years/);
    expect(text).toMatch(/"nameUsed" is false/);
  });
  it("combined prompts require the comparison table and leave the at-a-glance table empty", () => {
    for (const topic of TOPICS) {
      const text = getPrompt("combined", topic)!.instructions;
      for (const row of ["Overall outlook", "Right now", "Best window ahead", "What to focus on"]) expect(text).toContain(`"${row}"`);
      expect(text).toMatch(/one entry per branch present in "parts"/);
      expect(text).toMatch(/"table" stays empty/);
      for (const rules of ["Parashari:", "KP:", "Western:", "Numerology (Pythagorean):"]) expect(text).toContain(rules);
    }
    expect(getPrompt("combined", "marriage")!.instructions).toContain("Marriage or partnership timing");
    expect(getPrompt("parashari", "career")!.instructions).not.toContain('Fill "comparison"');
  });
  it("health and children carry their guardrails", () => {
    for (const system of SYSTEMS) {
      expect(getPrompt(system, "health")!.instructions).toMatch(/Never name diseases/);
      expect(getPrompt(system, "children")!.instructions).toMatch(/Never predict conception/);
    }
  });
});

describe("output schema for strict structured outputs", () => {
  const schema = outputJsonSchema();
  it("uses only strict-mode keywords", () => {
    const bad: string[] = [];
    const walk = (n: unknown, path: string): void => {
      if (Array.isArray(n)) return n.forEach((x, i) => walk(x, `${path}[${i}]`));
      if (!n || typeof n !== "object") return;
      for (const [k, v] of Object.entries(n as Record<string, unknown>)) {
        if (!STRICT_ALLOWED_KEYWORDS.has(k)) bad.push(`${path}.${k}`);
        if (k === "properties") for (const [pk, pv] of Object.entries(v as object)) walk(pv, `${path}.properties.${pk}`);
        else walk(v, `${path}.${k}`);
      }
    };
    walk(schema, "$");
    expect(bad).toEqual([]);
  });
  it("every object is closed and requires all its properties", () => {
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== "object") return;
      const o = n as Record<string, unknown>;
      if (o.type === "object") {
        expect(o.additionalProperties).toBe(false);
        expect(new Set(o.required as string[])).toEqual(new Set(Object.keys(o.properties as object)));
      }
      Object.values(o).forEach(walk);
    };
    walk(schema);
    expect(schema.type).toBe("object");
  });
});
