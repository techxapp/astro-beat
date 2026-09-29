// SPDX-License-Identifier: AGPL-3.0-or-later
// Cloudflare Worker entry. Secrets: OPENAI_API_KEY, SESSION_SECRET (wrangler secret put).
import { DurableObject } from "cloudflare:workers";
import { WindowTable, type CounterStore, type HitResult } from "./counters.ts";
import { createHandler } from "./handler.ts";
import { openAiClient } from "./openai.ts";

export interface Env {
  ALLOWED_ORIGIN: string;
  SESSION_SECRET: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  DAILY_TOKEN_BUDGET: string;
  SOURCE_URL: string;
  COMMIT_SHA: string;
  COUNTERS: DurableObjectNamespace<Counters>;
}

/** One Durable Object per counter key; state lives only in DO storage. */
export class Counters extends DurableObject<Env> {
  private readonly table = new WindowTable(
    async (k) => this.ctx.storage.get(k),
    async (k, w) => this.ctx.storage.put(k, w),
  );
  hit(key: string, limit: number, windowSec: number, nowMs: number): Promise<HitResult> {
    return this.table.hit(key, limit, windowSec, nowMs);
  }
  get(key: string, nowMs: number): Promise<number> {
    return this.table.get(key, nowMs);
  }
  add(key: string, amount: number, windowSec: number, nowMs: number): Promise<number> {
    return this.table.add(key, amount, windowSec, nowMs);
  }
}

function doCounters(ns: DurableObjectNamespace<Counters>): CounterStore {
  const stub = (key: string) => ns.get(ns.idFromName(key));
  return {
    hit: (key, limit, windowSec, nowMs) => stub(key).hit(key, limit, windowSec, nowMs),
    get: (key, nowMs) => stub(key).get(key, nowMs),
    add: (key, amount, windowSec, nowMs) => stub(key).add(key, amount, windowSec, nowMs),
  };
}

export default {
  fetch(req: Request, env: Env): Promise<Response> {
    const handler = createHandler({
      config: {
        allowedOrigin: env.ALLOWED_ORIGIN,
        sessionSecret: env.SESSION_SECRET,
        model: env.OPENAI_MODEL,
        dailyTokenBudget: Number(env.DAILY_TOKEN_BUDGET),
        sourceUrl: env.SOURCE_URL,
        commit: env.COMMIT_SHA,
      },
      counters: doCounters(env.COUNTERS),
      model: openAiClient(env.OPENAI_API_KEY),
    });
    return handler(req);
  },
} satisfies ExportedHandler<Env>;
