<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Readable view of one branch of a request body, built from the very string that will be sent. -->
<script lang="ts">
  import type { PayloadPart } from "@astro/schema/payload";
  import { factSentence, periodName, transitSentence, westernHitSentence, westernStaySentence } from "../lib/render.ts";

  let { part }: { part: PayloadPart } = $props();
</script>

{#if part.system === "parashari" || part.system === "kp"}
  <p class="small">Lagna {part.lagna.sign} (lord {part.lagna.lord}); Moon in {part.moon.sign}, {part.moon.nakshatra} pada {part.moon.pada}; {part.ayanamsa} ayanamsa, {part.nodeType} nodes.</p>
{:else if part.system === "western"}
  <p class="small">Tropical zodiac, {part.houseSystem} houses; Ascendant {part.ascendant.sign} (ruler {part.ascendant.ruler}); Sun in {part.sun.sign}; Moon in {part.moon.sign}.</p>
{:else}
  <p class="small">Pythagorean numerology; name numbers {part.nameUsed ? "included (from the name on the profile)" : "not included (no name on the profile)"}.</p>
{/if}
<details open>
  <summary>{part.facts.length} facts</summary>
  <ul class="plain small">
    {#each part.facts as f (f.id)}<li><span class="chip">{f.id}</span> {factSentence(f)}</li>{/each}
  </ul>
</details>
<details>
  <summary>{part.periods.length} periods (as labels, without dates)</summary>
  <ul class="plain small">
    {#each part.periods as per (per.label)}
      <li>
        <span class="chip">{per.label}</span> {periodName(per)} · {per.status}
        {#if "activatedHouses" in per} · activates houses {per.activatedHouses.join(", ") || "–"}{/if}
        {#if "lords" in per}
          {#if per.transits.length}<div class="muted">{per.transits.map(transitSentence).join("; ")}</div>{/if}
        {:else if "profection" in per}
          {#if per.transits.length}<div class="muted">{per.transits.map(westernStaySentence).join("; ")}</div>{/if}
          {#if per.aspects.length}<div class="muted">{per.aspects.map(westernHitSentence).join("; ")}</div>{/if}
        {/if}
      </li>
    {/each}
  </ul>
</details>
