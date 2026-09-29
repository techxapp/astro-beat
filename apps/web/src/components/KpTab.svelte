<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import type { KpAnalysis, KpFactOf } from "@astro/schema/analysis";
  import type { KpSystemChart } from "@astro/schema/chart";
  import type { BirthInput } from "@astro/schema/identifying";
  import type { PeriodDates } from "@astro/schema/local";
  import { settings } from "../state/app.svelte.ts";
  import { callWorker } from "../workers/client.ts";
  import type { CuspSensitivity } from "../workers/protocol.ts";
  import DashaTimeline from "./DashaTimeline.svelte";

  interface Props {
    kp: KpAnalysis;
    chart: KpSystemChart;
    dates: PeriodDates;
    birth: BirthInput | undefined;
  }
  let { kp, chart, dates, birth }: Props = $props();

  const cusps = $derived(kp.facts.filter((f): f is KpFactOf<"kpCusp"> => f.kind === "kpCusp"));
  const planets = $derived(kp.facts.filter((f): f is KpFactOf<"kpPlanet"> => f.kind === "kpPlanet"));
  const sigs = $derived(kp.facts.filter((f): f is KpFactOf<"kpSignificators"> => f.kind === "kpSignificators"));
  const signifies = $derived(kp.facts.filter((f): f is KpFactOf<"kpPlanetSignifies"> => f.kind === "kpPlanetSignifies"));
  const deg = (lon: number): string => {
    const d = lon % 30;
    const m = Math.floor((d % 1) * 60);
    return `${Math.floor(d)}°${String(m).padStart(2, "0")}′`;
  };

  let sensitivity = $state<CuspSensitivity[] | null>(null);
  let sensBusy = $state(false);
  async function computeSensitivity(): Promise<void> {
    if (!birth) return;
    sensBusy = true;
    try {
      sensitivity = (await callWorker({ type: "sensitivity", birth: $state.snapshot(birth) as BirthInput, settings: $state.snapshot(settings.engine) })).cusps;
    } finally {
      sensBusy = false;
    }
  }
  const mins = (m: number | null): string => (m === null ? "> 60 min" : `${m} min`);
</script>

{#if birth && birth.timeAccuracy !== "exact"}
  <p class="warn">Birth time is marked {birth.timeAccuracy}. KP cusp sub-lords can change within a few minutes, so treat this tab with caution.</p>
{/if}

<h2>Cusps (Placidus, KP ayanamsa {settings.engine.kp.ayanamsa})</h2>
<div class="table-wrap">
  <table>
    <thead><tr><th>Cusp</th><th>Degree</th><th>Sign</th><th>Sign lord</th><th>Star lord</th><th>Sub lord</th><th>Sub-sub</th><th>Sub-lord change</th></tr></thead>
    <tbody>
      {#each cusps as c, i (c.id)}
        <tr>
          <td>{c.cusp}</td><td>{chart.cusps ? deg(chart.cusps[i] ?? 0) : "–"}</td><td>{c.sign}</td><td>{c.signLord}</td><td>{c.starLord}</td>
          <td><strong>{c.subLord}</strong></td><td>{c.subSubLord ?? "–"}</td>
          <td class="small">{#if sensitivity}{@const s = sensitivity[i]}{#if s}−{mins(s.earlier)} / +{mins(s.later)}{/if}{:else}–{/if}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
{#if birth}
  <button onclick={computeSensitivity} disabled={sensBusy}>{sensBusy ? "Computing…" : "Show minutes until each sub-lord changes"}</button>
  <p class="small muted">How far the birth time can move before each cusp's sub-lord changes. Computed locally; never sent.</p>
{/if}

<h2>Planets</h2>
<div class="table-wrap">
  <table>
    <thead><tr><th>Planet</th><th>Sign</th><th>Bhava</th><th>Star lord</th><th>Sub lord</th><th>Signifies</th></tr></thead>
    <tbody>
      {#each planets as p (p.id)}
        {@const s = signifies.find((x) => x.planet === p.planet)}
        <tr>
          <td>{p.planet}{p.retrograde ? " ℞" : ""}</td><td>{p.sign}</td><td>{p.bhava}</td><td>{p.starLord}</td><td>{p.subLord}</td>
          <td class="small">{s?.houses.join(", ")} <span class="muted">(star lord {s?.viaStarLord.join(", ") || "–"}; sub {s?.viaSubLord.join(", ") || "–"})</span></td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<h2>Significators</h2>
<div class="table-wrap">
  <table>
    <thead><tr><th>House</th><th>A (in star of occupants)</th><th>B (occupants)</th><th>C (in star of owner)</th><th>D (owner)</th></tr></thead>
    <tbody>
      {#each sigs as s (s.id)}
        <tr><td>{s.house}</td><td>{s.a.join(", ")}</td><td>{s.b.join(", ")}</td><td>{s.c.join(", ")}</td><td>{s.d.join(", ")}</td></tr>
      {/each}
    </tbody>
  </table>
</div>

<h2>KP Vimshottari</h2>
<p class="small muted">Computed from the Moon under the KP ayanamsa, so dates differ slightly from the Parashari dashas.</p>
<DashaTimeline periods={kp.periods} {dates} />
