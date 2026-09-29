// SPDX-License-Identifier: AGPL-3.0-or-later
// Rune stores. `nav` is an in-memory view machine: no router, no URL parameters (nothing about
// the chart ever lands in history or the address bar).
import { DEFAULT_ENGINE_SETTINGS } from "@astro/core";
import { DEFAULT_CONVENTIONS, type AnalysisConventions } from "@astro/schema/analysis";
import type { EngineSettings } from "@astro/schema/chart";
import type { System, Topic } from "@astro/schema/enums";
import type { StoredPrediction } from "@astro/schema/file";
import type { BirthInput } from "@astro/schema/identifying";
import type { Analysis } from "@astro/schema/local";
import { callWorker } from "../workers/client.ts";
import { clearEverything, Vault } from "../vault/vault.ts";
import type { ProfileRecord, ProfileSummary } from "./types.ts";

export type Screen =
  | "welcome" | "profiles" | "birth" | "explorer" | "files" | "topic" | "consent" | "results" | "history" | "settings" | "about";

export const todayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

class Nav {
  screen = $state<Screen>("welcome");
  explorerTab = $state<string>("chart");
  /** analysis fact id to highlight in the explorer (basis chips) */
  highlightFact = $state<string | null>(null);
  go(screen: Screen): void {
    this.screen = screen;
    if (typeof window !== "undefined") window.scrollTo?.(0, 0);
  }
}
export const nav = new Nav();

class Settings {
  conventions = $state<AnalysisConventions>({ ...DEFAULT_CONVENTIONS });
  engine = $state<EngineSettings>({ ...DEFAULT_ENGINE_SETTINGS });
  autoLockMinutes = $state(10);
  seenWelcome = $state(false);
}
export const settings = new Settings();

class VaultState {
  vault: Vault | null = null;
  ready = $state(false);
  locked = $state(false);
  mode = $state<"device" | "passphrase">("device");
  private timer: ReturnType<typeof setTimeout> | null = null;

  async init(): Promise<void> {
    const v = new Vault();
    await v.open();
    this.vault = v;
    this.mode = v.mode;
    this.locked = v.locked;
    settings.conventions = (await v.getMeta<AnalysisConventions>("conventions")) ?? { ...DEFAULT_CONVENTIONS };
    settings.engine = (await v.getMeta<EngineSettings>("engine")) ?? { ...DEFAULT_ENGINE_SETTINGS };
    settings.autoLockMinutes = (await v.getMeta<number>("autoLockMinutes")) ?? 10;
    settings.seenWelcome = (await v.getMeta<boolean>("seenWelcome")) ?? false;
    this.ready = true;
    if (!this.locked) await profiles.refresh();
  }

  async unlock(passphrase: string): Promise<boolean> {
    if (!this.vault) return false;
    const ok = await this.vault.unlock(passphrase);
    this.locked = this.vault.locked;
    if (ok) {
      await profiles.refresh();
      this.touch();
    }
    return ok;
  }

  lock(): void {
    this.vault?.lock();
    this.locked = this.vault?.locked ?? false;
    if (this.locked) {
      profiles.active = null;
      profiles.list = [];
      chart.analysis = null;
      predictions.reset();
    }
  }

  /** Reset the auto-lock timer on activity (passphrase mode only). */
  touch(): void {
    if (this.mode !== "passphrase") return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.lock(), settings.autoLockMinutes * 60_000);
  }

  async saveSettings(): Promise<void> {
    await this.vault?.setMeta("conventions", $state.snapshot(settings.conventions));
    await this.vault?.setMeta("engine", $state.snapshot(settings.engine));
    await this.vault?.setMeta("autoLockMinutes", settings.autoLockMinutes);
    await this.vault?.setMeta("seenWelcome", settings.seenWelcome);
  }

  async setPassphrase(p: string): Promise<void> {
    await this.vault?.setPassphrase(p);
    this.mode = "passphrase";
    this.touch();
  }

  async removePassphrase(): Promise<void> {
    await this.vault?.removePassphrase();
    this.mode = "device";
  }

  async clearEverything(): Promise<void> {
    await clearEverything(this.vault);
    this.vault = null;
    location.reload();
  }
}
export const vaultState = new VaultState();

class Profiles {
  list = $state<ProfileSummary[]>([]);
  active = $state<ProfileRecord | null>(null);

  async refresh(): Promise<void> {
    const v = vaultState.vault;
    if (!v || v.locked) return;
    const out: ProfileSummary[] = [];
    for (const k of await v.keys("profile:")) {
      const p = await v.get<ProfileRecord>(k);
      if (p) out.push({ profileId: p.profileId, label: p.label });
    }
    this.list = out.sort((a, b) => a.label.localeCompare(b.label));
  }

  async save(p: ProfileRecord): Promise<void> {
    await vaultState.vault?.put(`profile:${p.profileId}`, $state.snapshot(p));
    await this.refresh();
  }

  async open(id: string): Promise<void> {
    const p = await vaultState.vault?.get<ProfileRecord>(`profile:${id}`);
    if (!p) return;
    this.active = p;
    predictions.reset();
    await chart.analyzeActive();
  }

  async remove(id: string): Promise<void> {
    await vaultState.vault?.delete(`profile:${id}`);
    await vaultState.vault?.delete(`analysis:${id}`);
    if (this.active?.profileId === id) {
      this.active = null;
      chart.analysis = null;
    }
    await this.refresh();
  }

  /** Create from birth input: compute the chart in the worker, save, open. */
  async create(birth: BirthInput): Promise<void> {
    chart.busy = true;
    try {
      const r = await callWorker({
        type: "compute", birth: $state.snapshot(birth) as BirthInput, settings: $state.snapshot(settings.engine),
        conventions: $state.snapshot(settings.conventions), asOf: todayIso(),
      });
      const rec: ProfileRecord = {
        profileId: crypto.randomUUID(), label: birth.name?.trim() || "Unnamed chart", birth, temporal: r.temporal,
        chart: r.chart, predictions: [], createdAt: todayIso(),
      };
      await this.save(rec);
      this.active = rec;
      chart.analysis = r.analysis;
      await chart.cache();
    } finally {
      chart.busy = false;
    }
  }
}
export const profiles = new Profiles();

class ChartState {
  analysis = $state<Analysis | null>(null);
  busy = $state(false);
  error = $state<string | null>(null);

  private cacheKey(p: ProfileRecord): string {
    return JSON.stringify([p.chart.settings, settings.conventions, todayIso()]);
  }

  async analyzeActive(): Promise<void> {
    const p = profiles.active;
    if (!p) return;
    this.error = null;
    const cached = await vaultState.vault?.get<{ key: string; analysis: Analysis }>(`analysis:${p.profileId}`);
    if (cached && cached.key === this.cacheKey(p)) {
      this.analysis = cached.analysis;
      return;
    }
    this.busy = true;
    try {
      const r = await callWorker({ type: "analyze", chart: $state.snapshot(p.chart), conventions: $state.snapshot(settings.conventions), asOf: todayIso() });
      this.analysis = r.analysis;
      await this.cache();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.busy = false;
    }
  }

  async cache(): Promise<void> {
    const p = profiles.active;
    if (p && this.analysis) {
      await vaultState.vault?.put(`analysis:${p.profileId}`, { key: this.cacheKey(p), analysis: $state.snapshot(this.analysis) });
    }
  }
}
export const chart = new ChartState();

export interface PendingRequest {
  system: System;
  topic: Topic;
  /** the exact serialized request body shown in consent and sent */
  body: string;
  hash: string;
  periodLabelMap: Record<string, string>;
  factIdMap: Record<string, string>;
}

class Predictions {
  system = $state<System>("parashari");
  topic = $state<Topic>("career");
  pending = $state<PendingRequest | null>(null);
  current = $state<StoredPrediction | null>(null);
  sending = $state(false);
  error = $state<string | null>(null);
  reset(): void {
    this.pending = null;
    this.current = null;
    this.error = null;
  }
}
export const predictions = new Predictions();
