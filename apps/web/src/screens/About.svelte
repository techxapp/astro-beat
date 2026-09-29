<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  const sourceAtCommit = `${__SOURCE_URL__}/tree/${__COMMIT_SHA__}`;
</script>

<h1>About &amp; credits</h1>
<section class="card">
  <h2>Licence and source</h2>
  <p>
    Astro-Beat is free software: you can redistribute and modify it under the terms of the GNU Affero General Public
    License, version 3 or (at your option) any later version. It comes with no warranty.
  </p>
  <p>
    The complete corresponding source for the version you are using, including the proxy and its prompts, is at
    <a href={sourceAtCommit} rel="noreferrer noopener" target="_blank">{sourceAtCommit}</a>.
  </p>
</section>
<section class="card">
  <h2>Credits</h2>
  <ul>
    <li>
      Ephemeris: the current build uses a pure-TypeScript reference engine based on Paul Schlyter's orbital elements
      and Jean Meeus, <em>Astronomical Algorithms</em>. The planned production engine is the Swiss Ephemeris by
      Astrodienst AG, used under its AGPL licence option; its copyright notice and licence will be reproduced here.
    </li>
    <li>
      Place names and coordinates: <a href="https://www.geonames.org" rel="noreferrer noopener" target="_blank">GeoNames</a>,
      licensed under <a href="https://creativecommons.org/licenses/by/4.0/" rel="noreferrer noopener" target="_blank">CC BY 4.0</a>.
    </li>
    <li>Time-zone boundaries: @photostructure/tz-lookup (CC0).</li>
  </ul>
</section>
<section class="card">
  <h2>Privacy summary</h2>
  <p class="small">
    Birth data, degrees and dates never leave this device. A written reading sends only the categorical facts for one
    topic, after you approve the exact text. The request passes through our stateless proxy (no bodies logged) to
    OpenAI with <code>store: false</code>; OpenAI may retain API data for up to 30 days for abuse monitoring. The
    facts can still roughly reveal a birth date, so they are personal data: de-identified, not anonymous.
  </p>
</section>
