<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { exportChartOnly, exportEncryptedProfile, ImportError, importChartFile, MAX_FILE_BYTES } from "@astro/chartfile";
  import type { BirthInput, ProfilePlain } from "@astro/schema/identifying";
  import { callWorker } from "../workers/client.ts";
  import { chart, nav, profiles, settings, todayIso } from "../state/app.svelte.ts";
  import type { ProfileRecord } from "../state/types.ts";

  let includePredictions = $state(false);
  let includePredictionsEnc = $state(true);
  let exportPass = $state("");
  let exportPass2 = $state("");
  let exportMsg = $state<string | null>(null);
  let importPass = $state("");
  let importMsg = $state<string | null>(null);
  let needsPass = $state(false);
  let pendingFile = $state<Uint8Array | null>(null);
  let busy = $state(false);

  const active = $derived(profiles.active);
  const safeName = (s: string): string => s.replace(/[^\w-]+/g, "_").slice(0, 40) || "chart";

  function download(text: string, filename: string): void {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportChart(): Promise<void> {
    if (!active) return;
    const snap = $state.snapshot(active) as ProfileRecord;
    download(await exportChartOnly(snap.chart, includePredictions ? snap.predictions : undefined), `${safeName(snap.label)}.chart.json`);
    exportMsg = "Chart file saved.";
  }

  async function exportProfile(): Promise<void> {
    if (!active?.birth || !active.temporal) return;
    if (exportPass !== exportPass2) {
      exportMsg = "Passphrases do not match.";
      return;
    }
    busy = true;
    try {
      const snap = $state.snapshot(active) as ProfileRecord;
      const plain: ProfilePlain = {
        profileId: snap.profileId, birth: snap.birth as BirthInput, temporal: snap.temporal!, chart: snap.chart,
        predictions: includePredictionsEnc ? snap.predictions : [],
      };
      download(await exportEncryptedProfile(plain, exportPass), `${safeName(snap.label)}.profile.json`);
      exportMsg = "Encrypted profile saved. Keep the passphrase safe: it cannot be recovered.";
      exportPass = exportPass2 = "";
    } catch (e) {
      exportMsg = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function onFile(e: Event): Promise<void> {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    importMsg = null;
    needsPass = false;
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      importMsg = "File is larger than 1 MB.";
      return;
    }
    pendingFile = new Uint8Array(await file.arrayBuffer());
    await runImport();
  }

  async function runImport(): Promise<void> {
    if (!pendingFile) return;
    busy = true;
    try {
      const r = await importChartFile(pendingFile, needsPass ? { passphrase: importPass } : {});
      let rec: ProfileRecord;
      if (r.kind === "chart-only") {
        rec = { profileId: crypto.randomUUID(), label: `Imported chart ${todayIso()}`, chart: r.chart, predictions: r.predictions, createdAt: todayIso() };
      } else {
        // Never trust the stored chart: recompute it from the birth data.
        const fresh = await callWorker({ type: "compute", birth: r.profile.birth, settings: r.profile.chart.settings, conventions: $state.snapshot(settings.conventions), asOf: todayIso() });
        rec = {
          profileId: crypto.randomUUID(), label: r.profile.birth.name ?? "Imported profile", birth: r.profile.birth,
          temporal: fresh.temporal, chart: fresh.chart, predictions: r.profile.predictions, createdAt: todayIso(),
        };
      }
      await profiles.save(rec);
      await profiles.open(rec.profileId);
      pendingFile = null;
      importPass = "";
      needsPass = false;
      nav.go("explorer");
    } catch (e) {
      if (e instanceof ImportError && e.code === "needs_passphrase") {
        needsPass = true;
        importMsg = "This profile is encrypted. Enter its passphrase.";
      } else {
        importMsg = e instanceof ImportError ? e.message : `Import failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    } finally {
      busy = false;
    }
  }
</script>

<h1>Files</h1>

<section class="card">
  <h2>Export</h2>
  {#if !active}
    <p class="muted">Open a profile to export it.</p>
  {:else}
    <h3>Chart only</h3>
    <p class="warn small">
      A chart file has no name or place, but its planet degrees and dasha dates still reveal the birth date and time.
      It is a file you control; nothing is sent to us.
    </p>
    <label class="inline"><input type="checkbox" bind:checked={includePredictions} /> Include saved readings</label>
    <div class="row"><button onclick={exportChart}>Save chart file</button></div>

    <h3>Encrypted profile</h3>
    {#if active.birth}
      <p class="small muted">Everything (birth details, chart, readings), encrypted with AES-256-GCM under your passphrase.</p>
      <label class="inline"><input type="checkbox" bind:checked={includePredictionsEnc} /> Include saved readings</label>
      <div class="grid2">
        <div><label for="p1">Passphrase (8+ characters)</label><input id="p1" type="password" autocomplete="new-password" bind:value={exportPass} /></div>
        <div><label for="p2">Repeat passphrase</label><input id="p2" type="password" autocomplete="new-password" bind:value={exportPass2} /></div>
      </div>
      <div class="row"><button onclick={exportProfile} disabled={busy || exportPass.length < 8}>Save encrypted profile</button></div>
    {:else}
      <p class="muted small">This profile was imported from a chart-only file and has no birth details to export.</p>
    {/if}
    {#if exportMsg}<p class="small" role="status">{exportMsg}</p>{/if}
  {/if}
</section>

<section class="card">
  <h2>Import</h2>
  <p class="small muted">Chart files and encrypted profiles up to 1 MB. Files are checked strictly and the analysis is always recomputed on this device. Imported readings are shown as they are and never sent anywhere.</p>
  <input type="file" accept="application/json,.json" onchange={onFile} disabled={busy || chart.busy} />
  {#if needsPass}
    <label for="ip">Passphrase</label>
    <input id="ip" type="password" autocomplete="off" bind:value={importPass} />
    <div class="row"><button class="primary" onclick={runImport} disabled={busy || !importPass}>Decrypt and import</button></div>
  {/if}
  {#if importMsg}<p class="small" role="alert">{importMsg}</p>{/if}
</section>
