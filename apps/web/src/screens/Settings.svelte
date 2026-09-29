<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import type { BirthInput } from "@astro/schema/identifying";
  import { callWorker } from "../workers/client.ts";
  import { chart, profiles, settings, todayIso, vaultState } from "../state/app.svelte.ts";

  let pass1 = $state("");
  let pass2 = $state("");
  let msg = $state<string | null>(null);
  let busy = $state(false);

  async function saveConventions(): Promise<void> {
    await vaultState.saveSettings();
    await chart.analyzeActive();
    msg = "Conventions saved; the analysis was recomputed.";
  }

  async function saveEngine(): Promise<void> {
    await vaultState.saveSettings();
    msg = "Engine settings saved. They apply to new charts; use “Recompute active chart” for the open one.";
  }

  async function recompute(): Promise<void> {
    const p = profiles.active;
    if (!p?.birth) return;
    busy = true;
    try {
      const r = await callWorker({ type: "compute", birth: $state.snapshot(p.birth) as BirthInput, settings: $state.snapshot(settings.engine), conventions: $state.snapshot(settings.conventions), asOf: todayIso() });
      const rec = { ...$state.snapshot(p), chart: r.chart, temporal: r.temporal };
      await profiles.save(rec);
      profiles.active = rec;
      chart.analysis = r.analysis;
      await chart.cache();
      msg = "Chart recomputed.";
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function setPass(): Promise<void> {
    if (pass1 !== pass2) {
      msg = "Passphrases do not match.";
      return;
    }
    busy = true;
    try {
      await vaultState.setPassphrase(pass1);
      msg = "Vault now protected by your passphrase.";
      pass1 = pass2 = "";
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function removePass(): Promise<void> {
    if (!confirm("Remove the passphrase? Data will be protected only by a key stored in this browser.")) return;
    busy = true;
    await vaultState.removePassphrase();
    busy = false;
    msg = "Passphrase removed.";
  }
</script>

<h1>Settings</h1>
{#if msg}<p class="small" role="status">{msg}</p>{/if}

<section class="card">
  <h2>Conventions</h2>
  <p class="small muted">Where classical texts differ, pick the convention you follow. These change the analysis only.</p>
  <div class="grid2">
    <div>
      <label for="na">Rahu/Ketu aspects</label>
      <select id="na" bind:value={settings.conventions.nodeAspects}>
        <option value="5-7-9">5th, 7th and 9th</option><option value="7">7th only</option><option value="none">None</option>
      </select>
    </div>
    <div>
      <label for="ck">Chara karakas</label>
      <select id="ck" bind:value={settings.conventions.charaKarakas}>
        <option value={8}>8 (with Rahu)</option><option value={7}>7</option>
      </select>
    </div>
    <div>
      <label for="cb">Combustion orbs</label>
      <select id="cb" bind:value={settings.conventions.combustion}>
        <option value="classical">Classical (smaller orbs for retrograde Mercury/Venus)</option>
        <option value="classical-no-retro-reduction">Classical, no retrograde reduction</option>
      </select>
    </div>
    <div>
      <label for="nb">Neecha-bhanga</label>
      <select id="nb" bind:value={settings.conventions.neechaBhanga}>
        <option value="kendra-from-lagna-or-moon">Canceller in kendra from lagna or Moon</option>
        <option value="kendra-from-lagna">Canceller in kendra from lagna only</option>
      </select>
    </div>
    <div>
      <label for="gy">Planetary war winner</label>
      <select id="gy" bind:value={settings.conventions.planetaryWarWinner}>
        <option value="lower-longitude">Lower longitude wins</option><option value="higher-longitude">Higher longitude wins</option>
      </select>
    </div>
    <div>
      <label for="nd">Node dignity</label>
      <select id="nd" bind:value={settings.conventions.nodeDignity}>
        <option value="taurus-scorpio">Rahu exalted in Taurus, Ketu in Scorpio</option>
        <option value="gemini-sagittarius">Rahu exalted in Gemini, Ketu in Sagittarius</option>
        <option value="none">No node dignity</option>
      </select>
    </div>
  </div>
  <label class="inline"><input type="checkbox" bind:checked={settings.conventions.kpNodeRule} /> KP: Rahu/Ketu also signify their sign lord's houses</label>
  <label class="inline"><input type="checkbox" bind:checked={settings.conventions.kpSignificatorConjunctions} /> KP: conjunctions (within 3°20′) count as significators</label>
  <div class="row"><button onclick={saveConventions}>Save conventions</button></div>
</section>

<section class="card">
  <h2>Engine</h2>
  <div class="grid2">
    <div>
      <label for="pa">Parashari ayanamsa</label>
      <select id="pa" bind:value={settings.engine.parashari.ayanamsa}><option value="lahiri">Lahiri</option><option value="raman">Raman</option></select>
    </div>
    <div>
      <label for="ka">KP ayanamsa</label>
      <select id="ka" bind:value={settings.engine.kp.ayanamsa}>
        <option value="kp-old">KP (Krishnamurti, classic)</option>
        <option value="kp-new" disabled>KP new (needs the Swiss Ephemeris engine)</option>
      </select>
    </div>
    <div>
      <label for="nt">Lunar nodes</label>
      <select id="nt" bind:value={settings.engine.nodeType}><option value="mean">Mean</option><option value="true">True</option></select>
    </div>
  </div>
  <div class="row">
    <button onclick={saveEngine}>Save engine settings</button>
    <button onclick={recompute} disabled={busy || !profiles.active?.birth}>Recompute active chart</button>
  </div>
  <p class="small muted">The current engine is a pure-TypeScript reference ephemeris (about 1–2 arc-minutes). The Swiss Ephemeris engine will replace it.</p>
</section>

<section class="card">
  <h2>Vault</h2>
  {#if vaultState.mode === "device"}
    <p class="small">Your data is encrypted with a key kept in this browser. That stops casual access to the stored files, but anyone who can use this browser profile can open it. Add a passphrase for real protection.</p>
    <div class="grid2">
      <div><label for="v1">New passphrase (8+ characters)</label><input id="v1" type="password" autocomplete="new-password" bind:value={pass1} /></div>
      <div><label for="v2">Repeat</label><input id="v2" type="password" autocomplete="new-password" bind:value={pass2} /></div>
    </div>
    <div class="row"><button onclick={setPass} disabled={busy || pass1.length < 8}>Protect with passphrase</button></div>
  {:else}
    <p class="small">Protected by your passphrase. It locks automatically after inactivity.</p>
    <label for="al">Auto-lock after (minutes)</label>
    <input id="al" type="number" min="1" max="240" bind:value={settings.autoLockMinutes} onchange={() => vaultState.saveSettings()} />
    <div class="row"><button onclick={removePass} disabled={busy}>Remove passphrase</button></div>
  {/if}
</section>

<section class="card">
  <h2>Clear everything</h2>
  <p class="small">Deletes all profiles, readings, settings, cached app files and the service worker from this browser.</p>
  <button class="danger" onclick={() => confirm("Delete all local data? This cannot be undone.") && vaultState.clearEverything()}>Clear everything</button>
</section>
