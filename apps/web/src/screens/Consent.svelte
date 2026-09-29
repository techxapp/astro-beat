<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { PredictionRequest } from "@astro/schema/api";
  import type { StoredPrediction } from "@astro/schema/file";
  import { API_ORIGIN, ApiError, sendPrediction } from "../net/api.ts";
  import { factSentence, periodName, transitSentence } from "../lib/render.ts";
  import { chart, nav, predictions, profiles, todayIso } from "../state/app.svelte.ts";

  const p = $derived(predictions.pending);
  // The readable view is built from the very string that will be sent.
  const req = $derived(p ? PredictionRequest.parse(JSON.parse(p.body)) : null);
  const bytes = $derived(p ? new TextEncoder().encode(p.body).byteLength : 0);

  const ERRORS: Record<string, string> = {
    rate_limited: "Too many requests right now. Please wait a little and try again.",
    budget_exhausted: "The service has reached today's limit. Please try again tomorrow.",
    upstream_timeout: "The reading took too long. Please try again.",
    upstream_error: "The reading service had a problem. Please try again.",
    model_output_invalid: "The reading came back malformed and was discarded. Please try again.",
    consent_mismatch: "The request changed after you previewed it, so it was not sent.",
  };

  async function approve(): Promise<void> {
    if (!p || !profiles.active || !chart.analysis) return;
    predictions.sending = true;
    predictions.error = null;
    try {
      const response = await sendPrediction(p.body, p.hash);
      const dates = chart.analysis.localOnly.periodDates;
      const periodDates: StoredPrediction["periodDates"] = {};
      for (const [payloadLabel, analysisLabel] of Object.entries(p.periodLabelMap)) {
        const d = dates[analysisLabel];
        if (d) periodDates[payloadLabel] = d;
      }
      const stored: StoredPrediction = {
        id: crypto.randomUUID(), system: p.system, createdAt: todayIso(), response, periodDates, factIdMap: p.factIdMap,
      };
      const rec = $state.snapshot(profiles.active);
      rec.predictions = [stored, ...rec.predictions].slice(0, 200);
      await profiles.save(rec);
      profiles.active = rec;
      predictions.current = stored;
      predictions.pending = null;
      nav.go("results");
    } catch (e) {
      predictions.error = e instanceof ApiError ? (ERRORS[e.code] ?? `Request failed (${e.code}).`) : "Could not reach the reading service. You may be offline.";
    } finally {
      predictions.sending = false;
    }
  }

  function cancel(): void {
    predictions.pending = null;
    nav.go("topic");
  }
</script>

{#if !p || !req}
  <p class="muted">Nothing to review.</p>
{:else}
  <h1>Review before sending</h1>
  <section class="card">
    <p>
      This exact text ({bytes.toLocaleString()} bytes) will be sent to <code>{API_ORIGIN}</code>, then to OpenAI to write
      a <strong>{req.payload.system === "kp" ? "KP" : "Parashari"}</strong> reading about <strong>{req.payload.topic}</strong>.
    </p>
    <ul class="small">
      <li class="ok">✓ Not included: name, birth date, birth time, birth place, coordinates, time zone, notes</li>
      <li class="ok">✓ Not included: planet degrees, calendar dates, today's date</li>
      <li class="ok">✓ Not included: facts about other topics</li>
    </ul>
    <p class="small muted">Fingerprint (SHA-256): <code>{p.hash.slice(0, 16)}…</code> The app refuses to send anything that differs from this preview.</p>
  </section>

  <section class="card">
    <h2>What the facts say</h2>
    <p class="small">Lagna {req.payload.lagna.sign} (lord {req.payload.lagna.lord}); Moon in {req.payload.moon.sign}, {req.payload.moon.nakshatra} pada {req.payload.moon.pada}; {req.payload.ayanamsa} ayanamsa, {req.payload.nodeType} nodes.</p>
    <details open>
      <summary>{req.payload.facts.length} chart facts</summary>
      <ul class="plain small">
        {#each req.payload.facts as f (f.id)}<li><span class="chip">{f.id}</span> {factSentence(f)}</li>{/each}
      </ul>
    </details>
    <details>
      <summary>{req.payload.periods.length} periods (as labels, without dates)</summary>
      <ul class="plain small">
        {#each req.payload.periods as per (per.label)}
          <li>
            <span class="chip">{per.label}</span> {periodName(per)} · {per.status} · activates houses {per.activatedHouses.join(", ") || "–"}
            {#if per.transits.length}<div class="muted">{per.transits.map(transitSentence).join("; ")}</div>{/if}
          </li>
        {/each}
      </ul>
    </details>
    <details>
      <summary>Exact JSON</summary>
      <pre class="body">{p.body}</pre>
    </details>
  </section>

  {#if predictions.error}<p class="error" role="alert">{predictions.error}</p>{/if}
  <div class="row">
    <button class="primary" onclick={approve} disabled={predictions.sending}>{predictions.sending ? "Sending…" : "Approve and send"}</button>
    <button onclick={cancel} disabled={predictions.sending}>Cancel</button>
  </div>
{/if}
