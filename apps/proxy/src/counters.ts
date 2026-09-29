// SPDX-License-Identifier: AGPL-3.0-or-later
// Fixed-window counters: rate limits and the global daily token budget.

export interface HitResult {
  allowed: boolean;
  /** seconds until the window resets (0 when allowed) */
  retryAfter: number;
}

export interface CounterStore {
  /** Count one request against `limit` per `windowSec`. */
  hit(key: string, limit: number, windowSec: number, nowMs: number): Promise<HitResult>;
  /** Current value of an accumulating counter (e.g. tokens today). */
  get(key: string, nowMs: number): Promise<number>;
  /** Add to an accumulating counter that expires after `windowSec`. */
  add(key: string, amount: number, windowSec: number, nowMs: number): Promise<number>;
}

interface Window {
  count: number;
  resetAt: number;
}

/** Shared window logic, used by the in-memory store and the Durable Object. */
export class WindowTable {
  constructor(private readonly load: (key: string) => Promise<Window | undefined>, private readonly save: (key: string, w: Window) => Promise<void>) {}

  async hit(key: string, limit: number, windowSec: number, nowMs: number): Promise<HitResult> {
    const w = await this.current(key, windowSec, nowMs);
    if (w.count >= limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((w.resetAt - nowMs) / 1000)) };
    w.count += 1;
    await this.save(key, w);
    return { allowed: true, retryAfter: 0 };
  }

  async get(key: string, nowMs: number): Promise<number> {
    const w = await this.load(key);
    return w && w.resetAt > nowMs ? w.count : 0;
  }

  async add(key: string, amount: number, windowSec: number, nowMs: number): Promise<number> {
    const w = await this.current(key, windowSec, nowMs);
    w.count += amount;
    await this.save(key, w);
    return w.count;
  }

  private async current(key: string, windowSec: number, nowMs: number): Promise<Window> {
    const w = await this.load(key);
    if (w && w.resetAt > nowMs) return w;
    return { count: 0, resetAt: nowMs + windowSec * 1000 };
  }
}

export class MemoryCounterStore implements CounterStore {
  private readonly map = new Map<string, Window>();
  private readonly table = new WindowTable(async (k) => this.map.get(k), async (k, w) => void this.map.set(k, w));
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
