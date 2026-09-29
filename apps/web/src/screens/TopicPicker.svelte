<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { buildPayload, serializeRequest } from "@astro/payload";
  import type { AnalysisPublic } from "@astro/schema/analysis";
  import { TOPICS, type Topic } from "@astro/schema/enums";
  import { sha256Hex } from "../net/api.ts";
  import { chart, nav, predictions, profiles } from "../state/app.svelte.ts";

  const LABELS: Record<Topic, string> = {
    career: "Career & work", marriage: "Relationships & marriage", finance: "Money & resources",
    health: "Wellbeing tendencies", education: "Learning & education", children: "Children & creativity", general: "General overview",
  };

  let error = $state<string | null>(null);
  const kpAvailable = $derived(chart.analysis?.kp !== null && chart.analysis?.kp !== undefined);
  const accuracy = $derived(profiles.active?.birth?.timeAccuracy ?? "unknown");

  async function prepare(): Promise<void> {
    error = null;
    const a = chart.analysis;
    if (!a) return;
    try {
      // Only the public half of the analysis reaches the payload builder.
      const { localOnly: _localOnly, ...publicPart } = $state.snapshot(a);
      const built = buildPayload(publicPart as AnalysisPublic, predictions.system, predictions.topic);
      const body = serializeRequest(built.payload, crypto.randomUUID());
      predictions.pending = {
        system: predictions.system, topic: predictions.topic, body, hash: await sha256Hex(body),
        periodLabelMap: built.periodLabelMap, factIdMap: built.factIdMap,
      };
      nav.go("consent");
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
</script>

<h1>Written reading</h1>
<p class="muted">Pick one topic and one system. Only that topic's facts are prepared, and you will see them before anything is sent.</p>

<section class="card">
  <h2>System</h2>
  <div class="row" role="radiogroup" aria-label="System">
    <button aria-pressed={predictions.system === "parashari"} onclick={() => (predictions.system = "parashari")}>Parashari</button>
    <button aria-pressed={predictions.system === "kp"} disabled={!kpAvailable} onclick={() => (predictions.system = "kp")}>KP (Krishnamurti)</button>
  </div>
  {#if !kpAvailable}
    <p class="small muted">KP is unavailable: Placidus cusps are undefined at this birth latitude.</p>
  {:else if predictions.system === "kp"}
    {#if accuracy !== "exact"}
      <p class="warn small">The birth time is {accuracy === "approx" ? "approximate" : "unknown"}. KP judgements rest on cusp sub-lords, which can change within minutes, so a KP reading is unreliable here.</p>
    {/if}
    <p class="small muted">KP readings reveal more about the birth time than Parashari ones (cusp sub-lords narrow it down). Only the topic's cusps are sent.</p>
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
  <button class="primary" onclick={prepare} disabled={!chart.analysis || (predictions.system === "kp" && !kpAvailable)}>Prepare and preview</button>
</div>
