<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { vaultState } from "../state/app.svelte.ts";

  let passphrase = $state("");
  let error = $state<string | null>(null);
  let busy = $state(false);

  async function submit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    busy = true;
    error = null;
    const ok = await vaultState.unlock(passphrase);
    busy = false;
    passphrase = "";
    if (!ok) error = "That passphrase did not unlock the vault.";
  }
</script>

<section class="card">
  <h1>Vault locked</h1>
  <p class="muted">Your profiles are encrypted with your passphrase.</p>
  <form onsubmit={submit}>
    <label for="pp">Passphrase</label>
    <input id="pp" type="password" autocomplete="current-password" bind:value={passphrase} />
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="row">
      <button class="primary" type="submit" disabled={busy || passphrase.length === 0}>{busy ? "Unlocking…" : "Unlock"}</button>
    </div>
  </form>
  <p class="small muted">Forgot it? Settings → Clear everything is the only way back; encrypted data cannot be recovered.</p>
  <button class="danger" onclick={() => confirm("Delete all local data? This cannot be undone.") && vaultState.clearEverything()}>Clear everything</button>
</section>
