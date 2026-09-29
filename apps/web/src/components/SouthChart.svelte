<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { SIGNS } from "@astro/schema/enums";

  interface Props {
    title: string;
    lagnaSign: number;
    /** planet abbreviations by sign index */
    occupants: string[][];
  }
  let { title, lagnaSign, occupants }: Props = $props();
</script>

<div class="south" role="img" aria-label={`${title} chart, South Indian style`}>
  {#each SIGNS as sign, i (sign)}
    <div class={`cell pos-${i}`} class:lagna={i === lagnaSign}>
      <div class="sign">{sign}{i === lagnaSign ? " · Asc" : ""}</div>
      <div>{(occupants[i] ?? []).join(" ")}</div>
    </div>
  {/each}
  <div class="center">{title}</div>
</div>

<style>
  .pos-11 { grid-row: 1; grid-column: 1; }
  .pos-0 { grid-row: 1; grid-column: 2; }
  .pos-1 { grid-row: 1; grid-column: 3; }
  .pos-2 { grid-row: 1; grid-column: 4; }
  .pos-3 { grid-row: 2; grid-column: 4; }
  .pos-4 { grid-row: 3; grid-column: 4; }
  .pos-5 { grid-row: 4; grid-column: 4; }
  .pos-6 { grid-row: 4; grid-column: 3; }
  .pos-7 { grid-row: 4; grid-column: 2; }
  .pos-8 { grid-row: 4; grid-column: 1; }
  .pos-9 { grid-row: 3; grid-column: 1; }
  .pos-10 { grid-row: 2; grid-column: 1; }
</style>
