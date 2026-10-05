<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { nav, profiles, settings, vaultState } from "../state/app.svelte.ts";

  async function start(): Promise<void> {
    settings.seenWelcome = true;
    await vaultState.saveSettings();
    nav.go(profiles.list.length > 0 ? "profiles" : "birth");
  }
</script>

<h1>Your chart stays on your device</h1>
<p>
  Astro-Beat computes your Vedic chart and a detailed analysis (placements, dignities, yogas, dashas, ashtakavarga,
  and the KP cusps and significators) entirely in this browser. It works offline. Place search is offline too, unless you press "Search online" for a town
  that is not in the built-in list, which sends just the place name you typed.
</p>

<div class="grid2">
  <section class="card">
    <h2>Stays here, always</h2>
    <ul>
      <li>Your name, birth date, birth time and birth place</li>
      <li>Coordinates, time zone and any notes</li>
      <li>Planet degrees and all dasha dates</li>
      <li>Today's date</li>
    </ul>
    <p class="small muted">Stored encrypted in this browser. Nothing is uploaded to us.</p>
  </section>
  <section class="card">
    <h2>Sent only if you ask for a written reading</h2>
    <p>
      A small set of <strong>categorical facts</strong> for the one topic you pick: signs, houses, nakshatras,
      dignities, yogas, and dasha periods as labels such as "P3". No degrees, no dates, no name or place.
    </p>
    <p class="small">
      You see the exact text before it is sent and approve it every time. It goes to our proxy and then to OpenAI,
      which writes the reading. We keep no copy. OpenAI is asked not to store it (<code>store: false</code>), but may
      keep API data for up to 30 days for abuse monitoring, and does not train on API data by default.
      <a href="https://openai.com/policies/api-data-usage-policies" rel="noreferrer noopener" target="_blank">OpenAI's policy</a>.
    </p>
  </section>
</div>

<section class="warn">
  <strong>De-identified, not anonymous.</strong> Even without dates, the facts in a reading can roughly reveal your
  birth date (slow planets give the year, the Sun the month, the Moon a window of hours to a day). Birth time and
  place are much harder to recover, and KP readings reveal more than Parashari ones because cusp sub-lords narrow the
  birth time. Treat a reading request as personal data.
</section>

<div class="row">
  <button class="primary" onclick={start}>{profiles.list.length > 0 ? "Go to my profiles" : "Create my chart"}</button>
  <button onclick={() => nav.go("files")}>Import a chart file</button>
</div>
