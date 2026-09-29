// SPDX-License-Identifier: AGPL-3.0-or-later
import { PromptVersion } from "@astro/schema/api";
import { TOPICS } from "@astro/schema/enums";
import { describe, expect, it } from "vitest";
import { getPrompt, listPromptIds, outputJsonSchema, STRICT_ALLOWED_KEYWORDS } from "../src/index.ts";

describe("prompts", () => {
  it("has a prompt for every (system, topic) with a valid version id", () => {
    for (const system of ["parashari", "kp"] as const) {
      for (const topic of TOPICS) {
        const p = getPrompt(system, topic)!;
        expect(PromptVersion.safeParse(p.id).success).toBe(true);
        expect(p.instructions).toContain("CHART_FACTS");
        expect(p.instructions).toMatch(/Never write calendar dates/);
      }
    }
    expect(listPromptIds()).toHaveLength(14);
  });
  it("rejects unknown pinned versions", () => {
    expect(getPrompt("kp", "marriage", "kp-marriage@1")).not.toBeNull();
    expect(getPrompt("kp", "marriage", "kp-marriage@99")).toBeNull();
    expect(getPrompt("kp", "marriage", "parashari-marriage@1")).toBeNull();
  });
  it("KP prompts forbid Parashari concepts", () => {
    expect(getPrompt("kp", "career")!.instructions).toMatch(/must not be invented/);
  });
  it("health and children carry their guardrails", () => {
    expect(getPrompt("parashari", "health")!.instructions).toMatch(/Never name diseases/);
    expect(getPrompt("parashari", "children")!.instructions).toMatch(/Never predict conception/);
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
