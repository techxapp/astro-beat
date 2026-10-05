<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import type { StoredPrediction } from "@astro/schema/file";
  import { SYSTEM_LABELS } from "../lib/render.ts";
  import { nav, predictions, profiles } from "../state/app.svelte.ts";

  function open(p: StoredPrediction): void {
    predictions.current = p;
    nav.go("results");
  }

  async function remove(id: string): Promise<void> {
    if (!profiles.active || !confirm("Delete this reading from this device?")) return;
    const rec = $state.snapshot(profiles.active);
    rec.predictions = rec.predictions.filter((p) => p.id !== id);
    await profiles.save(rec);
    profiles.active = rec;
  }
</script>

<h1>Readings</h1>
{#if !profiles.active || profiles.active.predictions.length === 0}
  <p class="muted">No saved readings for this profile yet.</p>
{:else}
  <ul class="plain">
    {#each profiles.active.predictions as p (p.id)}
      <li class="row">
        <span>{p.createdAt} · {SYSTEM_LABELS[p.system]} · {p.response.topic}</span>
        <span class="small muted">{p.response.promptVersion}</span>
        <button onclick={() => open(p)}>Open</button>
        <button class="danger" onclick={() => remove(p.id)}>Delete</button>
      </li>
    {/each}
  </ul>
  <p class="small muted">Each reading keeps the label-to-date mapping from the day it was made, so its dates stay as they were.</p>
{/if}
