<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { chart, nav, profiles } from "../state/app.svelte.ts";

  async function open(id: string): Promise<void> {
    await profiles.open(id);
    nav.go("explorer");
  }

  async function remove(id: string, label: string): Promise<void> {
    if (confirm(`Delete the profile "${label}" and its readings from this device?`)) await profiles.remove(id);
  }
</script>

<h1>Profiles</h1>
{#if profiles.list.length === 0}
  <p class="muted">No profiles yet.</p>
{:else}
  <ul class="plain">
    {#each profiles.list as p (p.profileId)}
      <li class="row">
        <strong>{p.label}</strong>
        {#if profiles.active?.profileId === p.profileId}<span class="chip">active</span>{/if}
        <span class="row">
          <button onclick={() => open(p.profileId)} disabled={chart.busy}>Open</button>
          <button class="danger" onclick={() => remove(p.profileId, p.label)}>Delete</button>
        </span>
      </li>
    {/each}
  </ul>
{/if}
<div class="row">
  <button class="primary" onclick={() => nav.go("birth")}>New chart</button>
  <button onclick={() => nav.go("files")}>Import</button>
</div>
