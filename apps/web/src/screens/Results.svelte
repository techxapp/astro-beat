<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { dateRange, segmentText } from "../lib/render.ts";
  import { chart, nav, predictions } from "../state/app.svelte.ts";

  const s = $derived(predictions.current);
  const r = $derived(s?.response);

  const TAB_FOR: Record<string, string> = {
    placement: "planets", charaKaraka: "planets", lordship: "relations", functionalRole: "relations", exchange: "relations",
    conjunction: "relations", aspect: "relations", relationship: "relations", yoga: "yogas", sav: "ashtakavarga",
    varga: "chart", vargaLagna: "chart", kpCusp: "kp", kpPlanet: "kp", kpSignificators: "kp", kpPlanetSignifies: "kp",
  };

  function openFact(payloadId: string): void {
    const analysisId = s?.factIdMap[payloadId];
    const a = chart.analysis;
    if (!analysisId || !a) return;
    const fact = [...a.parashari.facts, ...(a.kp?.facts ?? [])].find((f) => f.id === analysisId);
    nav.highlightFact = analysisId;
    nav.explorerTab = fact ? (TAB_FOR[fact.kind] ?? "chart") : "chart";
    nav.go("explorer");
  }

  const unknownFacts = $derived(new Set(r?.checks.unknownFactIds ?? []));
</script>

{#snippet rich(text: string)}
  {#each segmentText(text, s?.periodDates ?? {}) as seg, i (i)}
    {#if seg.kind === "text"}{seg.text}{:else if seg.kind === "period"}<strong>{seg.text}</strong>{:else}<button class="chip" onclick={() => openFact(seg.id)}>{seg.id}</button>{/if}
  {/each}
{/snippet}

{#if !s || !r}
  <p class="muted">No reading selected.</p>
{:else}
  <h1>{r.system === "kp" ? "KP" : "Parashari"} reading: {r.topic}</h1>
  <p class="small muted">{s.createdAt} · {r.promptVersion} · {r.model}</p>

  {#if r.checks.unknownFactIds.length || r.checks.unknownPeriods.length || r.checks.datesRedacted}
    <div class="warn small" role="note">
      {#if r.checks.unknownFactIds.length}<p>The reading cited facts that were not provided ({r.checks.unknownFactIds.join(", ")}); treat those parts with extra caution.</p>{/if}
      {#if r.checks.unknownPeriods.length}<p>It mentioned unknown periods ({r.checks.unknownPeriods.join(", ")}).</p>{/if}
      {#if r.checks.datesRedacted}<p>{r.checks.datesRedacted} date(s) or age(s) the model wrote were removed. Dates below come from your own chart.</p>{/if}
    </div>
  {/if}

  <section class="card"><p>{@render rich(r.output.summary)}</p></section>

  <h2>Themes</h2>
  {#each r.output.themes as t, i (i)}
    <section class="card">
      <h3>{t.title} <span class="chip">{t.tone}</span></h3>
      <p>{@render rich(t.detail)}</p>
      <p class="small">
        Based on:
        {#each t.basis as b (b)}
          <button class="chip" onclick={() => openFact(b)} title={unknownFacts.has(b) ? "Not a fact that was sent" : "Show in explorer"}>{b}{unknownFacts.has(b) ? " ⚠" : ""}</button>
        {/each}
      </p>
    </section>
  {/each}

  {#if r.output.periods.length}
    <h2>Periods</h2>
    <ul class="plain timeline">
      {#each r.output.periods as per, i (i)}
        <li>
          <strong>{dateRange(s.periodDates[per.period])}</strong> · {per.headline} <span class="chip">{per.confidence}</span>
          <p class="small">{@render rich(per.detail)}</p>
        </li>
      {/each}
    </ul>
  {/if}

  {#if r.output.limitations.length}
    <h2>Limitations</h2>
    <ul class="small">{#each r.output.limitations as l, i (i)}<li>{l}</li>{/each}</ul>
  {/if}
  {#if r.output.declined.length}
    <p class="small muted">Out of scope for this app: {r.output.declined.join(", ").replaceAll("_", " ")}.</p>
  {/if}

  <section class="card small muted">
    <p><strong>Please read.</strong> Astrology describes tendencies, not certainties. This reading was written by an AI model from precomputed chart facts and may be wrong.</p>
    <p>It is not medical, financial, legal or psychological advice. For decisions about health, money, law or wellbeing, talk to a qualified professional.</p>
  </section>
  <div class="row"><button onclick={() => nav.go("history")}>All readings</button><button onclick={() => nav.go("topic")}>Another reading</button></div>
{/if}
