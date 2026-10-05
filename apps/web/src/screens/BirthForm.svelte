<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import tzlookup from "@photostructure/tz-lookup";
  import { BirthInput } from "@astro/schema/identifying";
  import { placeLabel, searchPlaces, searchPlacesOnline, type Place } from "../lib/gazetteer.ts";
  import { formatOffset, isValidZone, utcOffsetMinutes } from "../lib/tz.ts";
  import { chart, nav, profiles } from "../state/app.svelte.ts";

  let name = $state("");
  let localDate = $state("");
  let localTime = $state("12:00");
  let timeAccuracy = $state<"exact" | "approx" | "unknown">("exact");
  let query = $state("");
  let results = $state<Place[]>([]);
  let placeText = $state("");
  let lat = $state<number | null>(null);
  let lon = $state<number | null>(null);
  let iana = $state("");
  let override = $state(false);
  let overrideOffset = $state(0);
  let notes = $state("");
  let error = $state<string | null>(null);

  let searched = $state(false);
  let onlineBusy = $state(false);
  let onlineNote = $state<string | null>(null);

  $effect(() => {
    const q = query;
    let cancelled = false;
    searched = false;
    onlineNote = null;
    searchPlaces(q).then((r) => {
      if (!cancelled) {
        results = r;
        searched = true;
      }
    });
    return () => {
      cancelled = true;
    };
  });

  // Explicit user action only: this sends the typed place text to our proxy.
  async function searchOnline(): Promise<void> {
    const q = query;
    onlineBusy = true;
    onlineNote = null;
    try {
      const found = await searchPlacesOnline(q);
      if (q !== query) return;
      results = found;
      if (found.length === 0) onlineNote = "No matches online either. You can enter coordinates manually below.";
    } catch {
      if (q === query) onlineNote = "Online search is unavailable right now. You can enter coordinates manually below.";
    } finally {
      onlineBusy = false;
    }
  }

  function pick(p: Place): void {
    placeText = placeLabel(p);
    lat = p.lat;
    lon = p.lon;
    iana = p.tz;
    query = "";
    results = [];
  }

  function coordsChanged(): void {
    if (lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      try {
        iana = tzlookup(lat, lon);
      } catch {
        /* leave as is */
      }
    }
  }

  const autoOffset = $derived.by(() => {
    if (!iana || !isValidZone(iana) || !/^\d{4}-\d{2}-\d{2}$/.test(localDate) || !/^\d{2}:\d{2}/.test(localTime)) return null;
    try {
      return utcOffsetMinutes(iana, localDate, localTime);
    } catch {
      return null;
    }
  });

  async function submit(e: SubmitEvent): Promise<void> {
    e.preventDefault();
    error = null;
    const offset = override ? Math.round(overrideOffset) : autoOffset;
    if (offset === null) {
      error = "Choose a place (or coordinates and a time zone) so the UTC offset can be worked out, or enter it manually.";
      return;
    }
    const candidate = {
      ...(name.trim() ? { name: name.trim() } : {}),
      localDate,
      localTime,
      timeAccuracy,
      place: { label: placeText.trim() || "Manual coordinates", lat: Number(lat), lon: Number(lon) },
      timezone: { iana: iana || "UTC", utcOffsetMinutes: offset, overridden: override },
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    const parsed = BirthInput.safeParse(candidate);
    if (!parsed.success) {
      error = `Please check: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`;
      return;
    }
    try {
      await profiles.create(parsed.data);
      nav.go("explorer");
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
</script>

<h1>New chart</h1>
<p class="muted small">Everything on this form stays on this device, unless you choose "Search online" for a place.</p>
<form class="card" onsubmit={submit}>
  <label for="name">Name (optional)</label>
  <input id="name" maxlength="100" bind:value={name} autocomplete="off" />

  <div class="grid2">
    <div>
      <label for="date">Birth date</label>
      <input id="date" type="date" required bind:value={localDate} />
    </div>
    <div>
      <label for="time">Birth time (local clock time)</label>
      <input id="time" type="time" step="60" required bind:value={localTime} />
    </div>
  </div>

  <fieldset class="card">
    <legend>How accurate is the time?</legend>
    <label class="inline"><input type="radio" name="acc" value="exact" bind:group={timeAccuracy} /> Exact (from a record)</label>
    <label class="inline"><input type="radio" name="acc" value="approx" bind:group={timeAccuracy} /> Approximate</label>
    <label class="inline"><input type="radio" name="acc" value="unknown" bind:group={timeAccuracy} /> Unknown</label>
    {#if timeAccuracy !== "exact"}
      <p class="warn small">The lagna, houses and especially KP cusp sub-lords depend on the birth time. Readings will be less reliable.</p>
    {/if}
  </fieldset>

  <label for="place">Birth place</label>
  <input id="place" placeholder="Search a city (offline)" bind:value={query} autocomplete="off" />
  {#if results.length > 0}
    <ul class="plain card">
      {#each results as r (placeLabel(r) + r.lat)}
        <li><button type="button" onclick={() => pick(r)}>{placeLabel(r)}</button> <span class="small muted">{r.tz}</span></li>
      {/each}
    </ul>
  {/if}
  {#if searched && query.trim().length >= 2}
    <p class="small muted">
      {results.length === 0 ? "Not in the offline list." : "Not the one you want?"}
      <button type="button" disabled={onlineBusy} onclick={searchOnline}>{onlineBusy ? "Searching…" : "Search online"}</button>
      Sends the text you typed ("{query.trim()}") to our server and a geocoding provider. Nothing else from this form is sent.
    </p>
  {/if}
  {#if onlineNote}<p class="small warn" role="status">{onlineNote}</p>{/if}
  {#if placeText}<p class="small">Selected: <strong>{placeText}</strong></p>{/if}

  <details>
    <summary>Enter coordinates manually</summary>
    <div class="grid2">
      <div>
        <label for="lat">Latitude (−90 to 90, north positive)</label>
        <input id="lat" type="number" step="0.0001" min="-90" max="90" bind:value={lat} onchange={coordsChanged} />
      </div>
      <div>
        <label for="lon">Longitude (−180 to 180, east positive)</label>
        <input id="lon" type="number" step="0.0001" min="-180" max="180" bind:value={lon} onchange={coordsChanged} />
      </div>
    </div>
    <label for="plabel">Place label</label>
    <input id="plabel" maxlength="200" bind:value={placeText} />
  </details>

  <label for="tz">Time zone (IANA)</label>
  <input id="tz" bind:value={iana} placeholder="e.g. Asia/Kolkata" />
  <p class="small">
    {#if autoOffset !== null}
      Offset in force at that date and time: <strong>{formatOffset(autoOffset)}</strong>.
      Historical time-zone data can be wrong for some places and years; check it against the birth record.
    {:else if iana && !isValidZone(iana)}
      <span class="error">Unknown time zone.</span>
    {/if}
  </p>
  <label class="inline"><input type="checkbox" bind:checked={override} /> Override the UTC offset</label>
  {#if override}
    <label for="off">UTC offset in minutes (e.g. 330 for UTC+05:30)</label>
    <input id="off" type="number" step="1" min="-960" max="960" bind:value={overrideOffset} />
    <p class="small muted">{formatOffset(Math.round(overrideOffset || 0))}</p>
  {/if}

  <label for="notes">Notes (optional, stays local)</label>
  <textarea id="notes" rows="2" maxlength="5000" bind:value={notes}></textarea>

  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="row">
    <button class="primary" type="submit" disabled={chart.busy}>{chart.busy ? "Computing…" : "Compute chart"}</button>
  </div>
</form>
