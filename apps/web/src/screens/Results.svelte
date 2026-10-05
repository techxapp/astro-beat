<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { BRANCHES } from "@astro/schema/enums";
  import { dateRange, factSentence, segmentText, SYSTEM_LABELS, SYSTEM_TITLES, type AnyFact } from "../lib/render.ts";
  import { chart, nav, predictions } from "../state/app.svelte.ts";

  const s = $derived(predictions.current);
  const r = $derived(s?.response);
  /** Readings saved before combined readings existed have no comparison field. */
  const comparison = $derived(r?.output.comparison ?? []);
  /** Branch columns of the comparison table, in the usual branch order. */
  const columns = $derived(BRANCHES.filter((b) => comparison.some((row) => row.views.some((v) => v.system === b))));
  const AGREEMENT: Record<string, string> = { agree: "Agree", partly: "Partly agree", differ: "Differ", single: "One branch only" };

  const TAB_FOR: Record<string, string> = {
    placement: "planets", charaKaraka: "planets", lordship: "relations", functionalRole: "relations", exchange: "relations",
    conjunction: "relations", aspect: "relations", relationship: "relations", yoga: "yogas", sav: "ashtakavarga",
    varga: "chart", vargaLagna: "chart", kpCusp: "kp", kpPlanet: "kp", kpSignificators: "kp", kpPlanetSignifies: "kp",
  };

  /** The analysis fact behind a payload id (numerology facts are not kept in the analysis). */
  function factFor(payloadId: string): AnyFact | undefined {
    const analysisId = s?.factIdMap[payloadId];
    const a = chart.analysis;
    if (!analysisId || !a) return undefined;
    return [...a.parashari.facts, ...(a.kp?.facts ?? []), ...(a.western?.facts ?? [])].find((f) => f.id === analysisId);
  }

  function openFact(payloadId: string): void {
    const analysisId = s?.factIdMap[payloadId];
    const a = chart.analysis;
    if (!analysisId || !a) return;
    const fact = [...a.parashari.facts, ...(a.kp?.facts ?? [])].find((f) => f.id === analysisId);
    // Western facts have no explorer tab: their chip shows the fact as a tooltip instead.
    if (!fact) return;
    nav.highlightFact = analysisId;
    nav.explorerTab = fact ? (TAB_FOR[fact.kind] ?? "chart") : "chart";
    nav.go("explorer");
  }

  const unknownFacts = $derived(new Set(r?.checks.unknownFactIds ?? []));
  function tip(payloadId: string): string {
    if (unknownFacts.has(payloadId)) return "Not a fact that was sent";
    const f = factFor(payloadId);
    return f ? factSentence(f) : "Show in explorer";
  }
</script>

{#snippet rich(text: string)}
  {#each segmentText(text, s?.periodDates ?? {}) as seg, i (i)}
    {#if seg.kind === "text"}{seg.text}{:else if seg.kind === "period"}<strong>{seg.text}</strong>{:else}<button class="chip" onclick={() => openFact(seg.id)} title={tip(seg.id)}>{seg.id}</button>{/if}
  {/each}
{/snippet}

{#if !s || !r}
  <p class="muted">No reading selected.</p>
{:else}
  <h1>{SYSTEM_LABELS[r.system]} reading: {r.topic}</h1>
  <p class="small muted">{s.createdAt} · {r.promptVersion} · {r.model}</p>

  {#if r.checks.unknownFactIds.length || r.checks.unknownPeriods.length || r.checks.datesRedacted}
    <div class="warn small" role="note">
      {#if r.checks.unknownFactIds.length}<p>The reading cited facts that were not provided ({r.checks.unknownFactIds.join(", ")}); treat those parts with extra caution.</p>{/if}
      {#if r.checks.unknownPeriods.length}<p>It mentioned unknown periods ({r.checks.unknownPeriods.join(", ")}).</p>{/if}
      {#if r.checks.datesRedacted}<p>{r.checks.datesRedacted} date(s) or age(s) the model wrote were removed. Dates below come from your own chart.</p>{/if}
    </div>
  {/if}

  <section class="card"><p>{@render rich(r.output.summary)}</p></section>

  {#if comparison.length}
    <h2>Side-by-side comparison</h2>
    <p class="small muted">What each branch predicts for the same questions, and where they agree. Dates come from each branch's own periods.</p>
    <div class="table-wrap">
      <table class="compare">
        <thead>
          <tr>
            <th scope="col">Question</th>
            {#each columns as b (b)}<th scope="col">{SYSTEM_TITLES[b]}</th>{/each}
            <th scope="col">Overall</th>
          </tr>
        </thead>
        <tbody>
          {#each comparison as row, i (i)}
            <tr>
              <th scope="row">{row.aspect}</th>
              {#each columns as b (b)}
                {@const v = row.views.find((x) => x.system === b)}
                <td>
                  {#if v}
                    {@render rich(v.view)}
                    {#if v.periods.length}<div class="small"><strong>{v.periods.map((p) => dateRange(s.periodDates[p])).join(", ")}</strong></div>{/if}
                    {#if v.basis.length}
                      <div>{#each v.basis as b2 (b2)}<button class="chip" onclick={() => openFact(b2)} title={tip(b2)}>{b2}{unknownFacts.has(b2) ? " ⚠" : ""}</button>{/each}</div>
                    {/if}
                  {:else}<span class="muted">–</span>{/if}
                </td>
              {/each}
              <td><span class="chip agree-{row.agreement}">{AGREEMENT[row.agreement]}</span> {@render rich(row.synthesis)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if r.output.table.length}
    <h2>At a glance</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>What</th><th>When</th><th>Details</th><th>Confidence</th></tr></thead>
        <tbody>
          {#each r.output.table as row, i (i)}
            <tr>
              <th scope="row">{row.label}</th>
              <td>{row.periods.length ? row.periods.map((p) => dateRange(s.periodDates[p])).join(", ") : "–"}</td>
              <td>{@render rich(row.detail)}</td>
              <td><span class="chip">{row.confidence}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <h2>Key takeaways</h2>
  {#each r.output.themes as t, i (i)}
    <section class="card">
      <h3>{t.title} <span class="chip">{t.tone}</span></h3>
      <p>{@render rich(t.detail)}</p>
      <details class="small">
        <summary>Why? (chart details)</summary>
        {#each t.basis as b (b)}
          <button class="chip" onclick={() => openFact(b)} title={tip(b)}>{b}{unknownFacts.has(b) ? " ⚠" : ""}</button>
        {/each}
      </details>
    </section>
  {/each}

  {#if r.output.periods.length}
    <h2>Timeline: now and ahead</h2>
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
