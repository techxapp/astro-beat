<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { serializeRequest } from "@astro/payload";
  import { BRANCHES, SYSTEMS, TOPICS, type Branch, type System, type Topic } from "@astro/schema/enums";
  import { sha256Hex } from "../net/api.ts";
  import { prepareReading, readingBranches } from "../lib/reading.ts";
  import { SYSTEM_TITLES } from "../lib/render.ts";
  import { chart, nav, predictions, profiles, todayIso } from "../state/app.svelte.ts";

  const LABELS: Record<Topic, string> = {
    career: "Career & work", marriage: "Relationships & marriage", finance: "Money & resources",
    health: "Wellbeing tendencies", education: "Learning & education", children: "Children & creativity", general: "General overview",
  };

  let error = $state<string | null>(null);
  const birth = $derived(profiles.active?.birth);
  const accuracy = $derived(birth?.timeAccuracy ?? "unknown");
  const available = $derived(chart.analysis ? readingBranches(chart.analysis, birth, todayIso()) : []);
  const chosenBranches = $derived(predictions.branches.filter((b) => available.includes(b)));
  const canUse = (s: System): boolean => (s === "combined" ? available.length >= 2 : available.includes(s));
  const ready = $derived(!!chart.analysis && canUse(predictions.system) && (predictions.system !== "combined" || chosenBranches.length >= 2));

  function toggle(b: Branch, on: boolean): void {
    predictions.branches = BRANCHES.filter((x) => (x === b ? on : predictions.branches.includes(x)));
  }

  async function prepare(): Promise<void> {
    error = null;
    const a = chart.analysis;
    if (!a) return;
    try {
      const prepared = prepareReading($state.snapshot(a), $state.snapshot(birth), predictions.system, predictions.topic, chosenBranches, todayIso());
      const body = serializeRequest(prepared.payload, crypto.randomUUID());
      predictions.pending = {
        system: predictions.system, topic: predictions.topic, body, hash: await sha256Hex(body),
        periodDates: prepared.periodDates, factIdMap: prepared.factIdMap,
      };
      nav.go("consent");
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<h1>Written reading</h1>
<p class="muted">Pick one topic and a system, or compare several systems side by side. Only that topic's facts are prepared, and you will see them before anything is sent.</p>

<section class="card">
  <h2>System</h2>
  <div class="row" role="radiogroup" aria-label="System">
    {#each SYSTEMS as s (s)}
      <button aria-pressed={predictions.system === s} disabled={!canUse(s)} onclick={() => (predictions.system = s)}>{SYSTEM_TITLES[s]}</button>
    {/each}
  </div>
  {#if !available.includes("kp")}
    <p class="small muted">KP is unavailable: Placidus cusps are undefined at this birth latitude.</p>
  {/if}
  {#if !available.includes("numerology")}
    <p class="small muted">Numerology needs the birth date, which this profile (a chart-only import) does not have.</p>
  {/if}

  {#if predictions.system === "kp" || (predictions.system === "combined" && chosenBranches.includes("kp"))}
    {#if accuracy !== "exact"}
      <p class="warn small">The birth time is {accuracy === "approx" ? "approximate" : "unknown"}. KP judgements rest on cusp sub-lords, which can change within minutes, so a KP reading is unreliable here.</p>
    {/if}
    <p class="small muted">KP readings reveal more about the birth time than Parashari ones (cusp sub-lords narrow it down). Only the topic's cusps are sent.</p>
  {/if}
  {#if (predictions.system === "western" || (predictions.system === "combined" && chosenBranches.includes("western"))) && accuracy !== "exact"}
    <p class="warn small">The birth time is {accuracy === "approx" ? "approximate" : "unknown"}. The Western Ascendant, Midheaven, houses and yearly profections depend on it, so treat those parts as rough.</p>
  {/if}
  {#if predictions.system === "western"}
    <p class="small muted">Tropical zodiac with traditional rulerships, Placidus houses (whole-sign near the poles), yearly profections and Jupiter, Saturn and node transits. Outer planets are not available yet.</p>
  {:else if predictions.system === "numerology"}
    <p class="small muted">
      Pythagorean numerology from your birth date{birth?.name ? " and name" : ""}, worked out on this device. Only the resulting numbers are sent, never the date or the name.
      {#if birth && !birth.name}Add a name to the profile for the name numbers (Expression, Soul Urge, Personality).{/if}
    </p>
  {/if}

  {#if predictions.system === "combined"}
    <h3>Branches to compare</h3>
    <div class="row">
      {#each BRANCHES as b (b)}
        <label class="inline">
          <input type="checkbox" checked={chosenBranches.includes(b)} disabled={!available.includes(b)} onchange={(e) => toggle(b, e.currentTarget.checked)} />
          {SYSTEM_TITLES[b]}
        </label>
      {/each}
    </div>
    {#if chosenBranches.length < 2}<p class="error small">Pick at least two branches.</p>{/if}
    <p class="small muted">
      One request carries every selected branch's facts for this topic (each Vedic branch with a shorter month-level window), and the reading
      comes back as one report with a side-by-side table of what each branch predicts and where they agree.
    </p>
  {/if}
</section>

<section class="card">
  <h2>Topic</h2>
  <div class="grid2">
    {#each TOPICS as t (t)}
      <label class="inline"><input type="radio" name="topic" value={t} bind:group={predictions.topic} /> {LABELS[t]}</label>
    {/each}
  </div>
</section>

{#if error}<p class="error" role="alert">{error}</p>{/if}
<div class="row">
  <button class="primary" onclick={prepare} disabled={!ready}>Prepare and preview</button>
</div>
