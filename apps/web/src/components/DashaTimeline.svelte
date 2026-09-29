<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { subPeriodsOf } from "@astro/analysis";
  import type { PeriodFact } from "@astro/schema/analysis";
  import type { PeriodDates } from "@astro/schema/local";
  import { dateRange, transitSentence } from "../lib/render.ts";

  interface Props {
    periods: PeriodFact[];
    dates: PeriodDates;
  }
  let { periods, dates }: Props = $props();

  const mds = $derived(periods.filter((p) => p.level === "MD"));
  const childrenOf = (parent: PeriodFact, level: "AD" | "PD"): PeriodFact[] =>
    periods.filter((p) => p.level === level && p.lords.slice(0, parent.lords.length).join() === parent.lords.join());
  const sds = (pd: PeriodFact) => {
    const d = dates[pd.label];
    return d ? subPeriodsOf({ level: "PD", path: pd.lords, start: d.start, end: d.end }) : [];
  };
</script>

<ul class="plain timeline">
  {#each mds as md (md.label)}
    <li class:current={md.status === "current"}>
      <details open={md.status === "current"}>
        <summary>
          {md.lords[0]} mahadasha · {dateRange(dates[md.label])}
          {#if md.status === "current"}<span class="chip">now</span>{/if}
          <span class="small muted">activates houses {md.activatedHouses.join(", ")}</span>
        </summary>
        <ul class="plain">
          {#each childrenOf(md, "AD") as ad (ad.label)}
            <li class:current={ad.status === "current"}>
              <details open={ad.status === "current"}>
                <summary>
                  {ad.lords.join("–")} · {dateRange(dates[ad.label])}
                  {#if ad.status === "current"}<span class="chip">now</span>{/if}
                  {#if ad.lordRelation}<span class="small muted">lords {ad.lordRelation}, {ad.mutualPosition}</span>{/if}
                </summary>
                {#if ad.transits.length}
                  <p class="small muted">Transits: {ad.transits.map(transitSentence).join("; ")}</p>
                {/if}
                <ul class="plain small">
                  {#each childrenOf(ad, "PD") as pd (pd.label)}
                    <li class:current={pd.status === "current"}>
                      <details>
                        <summary>{pd.lords.join("–")} · {dateRange(dates[pd.label])}{#if pd.status === "current"} <span class="chip">now</span>{/if}</summary>
                        <ul class="plain">
                          {#each sds(pd) as sd (sd.path.join())}
                            <li class="muted">{sd.path.join("–")} · {sd.start} → {sd.end}</li>
                          {/each}
                        </ul>
                      </details>
                    </li>
                  {/each}
                </ul>
              </details>
            </li>
          {/each}
        </ul>
      </details>
    </li>
  {/each}
</ul>
