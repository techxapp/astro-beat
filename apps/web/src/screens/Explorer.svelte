<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { bhinnashtakavarga, natalContext, vargaSign, YOGA_CATALOG, yogaDefinition } from "@astro/analysis";
  import type { FactOf } from "@astro/schema/analysis";
  import { GRAHAS, SIGNS, VARGAS, type Planet, type Varga } from "@astro/schema/enums";
  import DashaTimeline from "../components/DashaTimeline.svelte";
  import KpTab from "../components/KpTab.svelte";
  import SouthChart from "../components/SouthChart.svelte";
  import { factSentence } from "../lib/render.ts";
  import { chart, nav, profiles, settings } from "../state/app.svelte.ts";

  const TABS = [
    ["chart", "Charts"], ["planets", "Planets"], ["relations", "Lordship & aspects"], ["ashtakavarga", "Ashtakavarga"],
    ["yogas", "Yogas"], ["dashas", "Dashas"], ["kp", "KP"], ["notes", "Lordship notes"],
  ] as const;

  const ABBR: Record<Planet, string> = { Sun: "Su", Moon: "Mo", Mars: "Ma", Mercury: "Me", Jupiter: "Ju", Venus: "Ve", Saturn: "Sa", Rahu: "Ra", Ketu: "Ke" };

  let varga = $state<Varga>("D9");
  const a = $derived(chart.analysis);
  const c = $derived(profiles.active?.chart);
  const facts = $derived(a?.parashari.facts ?? []);
  const of = <K extends FactOf<"placement">["kind"] | string>(kind: K) => facts.filter((f) => f.kind === kind);
  const placements = $derived(facts.filter((f): f is FactOf<"placement"> => f.kind === "placement"));
  const yogas = $derived(facts.filter((f): f is FactOf<"yoga"> => f.kind === "yoga"));

  function occupants(v: Varga): { lagna: number; occ: string[][] } {
    const occ: string[][] = Array.from({ length: 12 }, () => []);
    if (!c) return { lagna: 0, occ };
    for (const p of c.parashari.planets) occ[vargaSign(v, p.lon)]?.push(ABBR[p.planet] + (p.retrograde && p.planet !== "Rahu" && p.planet !== "Ketu" ? "℞" : ""));
    return { lagna: vargaSign(v, c.parashari.ascendantLon), occ };
  }
  const d1 = $derived(occupants("D1"));
  const dv = $derived(occupants(varga));

  const deg = (lon: number): string => {
    const d = lon % 30;
    return `${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, "0")}′`;
  };
  const lonOf = (p: Planet): number => c?.parashari.planets.find((x) => x.planet === p)?.lon ?? 0;

  const bav = $derived(c ? bhinnashtakavarga(natalContext(c.parashari, settings.conventions)) : null);
  const lagnaSign = $derived(c ? Math.floor(c.parashari.ascendantLon / 30) : 0);

  const highlighted = (id: string): boolean => nav.highlightFact === id;
</script>

{#if chart.busy}
  <p class="muted">Computing the analysis…</p>
{:else if chart.error}
  <p class="error">Analysis failed: {chart.error}</p>
{:else if !a || !c}
  <p class="muted">Open or create a profile first.</p>
{:else}
  <h1>Chart &amp; analysis</h1>
  <p class="small muted">
    Lagna {a.parashari.lagna.sign} (lord {a.parashari.lagna.lord}) · Moon {a.parashari.moon.sign}, {a.parashari.moon.nakshatra} pada {a.parashari.moon.pada}
    · {settings.engine.parashari.ayanamsa} ayanamsa, {a.settings.nodeType} nodes, whole-sign houses · analysis v{a.analysisVersion}
  </p>
  <div class="tabs" role="tablist">
    {#each TABS as [id, label] (id)}
      <button role="tab" aria-selected={nav.explorerTab === id} onclick={() => (nav.explorerTab = id)}>{label}</button>
    {/each}
  </div>

  {#if nav.explorerTab === "chart"}
    <div class="grid2">
      <SouthChart title="D1 Rasi" lagnaSign={d1.lagna} occupants={d1.occ} />
      <div>
        <label for="varga">Divisional chart</label>
        <select id="varga" bind:value={varga}>
          {#each VARGAS.filter((v) => v !== "D1") as v (v)}<option value={v}>{v}</option>{/each}
        </select>
        <SouthChart title={varga} lagnaSign={dv.lagna} occupants={dv.occ} />
      </div>
    </div>
  {:else if nav.explorerTab === "planets"}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Planet</th><th>Sign</th><th>Degree</th><th>House</th><th>Nakshatra</th><th>Dignity</th><th>States</th><th>Avastha</th></tr></thead>
        <tbody>
          {#each placements as p (p.id)}
            <tr class:highlight={highlighted(p.id)}>
              <td>{p.planet}</td><td>{p.sign}</td><td>{deg(lonOf(p.planet))}</td><td>{p.house}</td>
              <td>{p.nakshatra} {p.pada} <span class="muted small">({p.nakshatraLord})</span></td>
              <td>{p.dignity}</td>
              <td class="small">{[p.retrograde && "retrograde", p.combust && "combust", p.vargottama && "vargottama", p.gandanta && "gandanta", p.planetaryWar !== "none" && `war ${p.planetaryWar}`].filter(Boolean).join(", ") || "–"}</td>
              <td>{p.avastha}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <h2>Chara karakas</h2>
    <p>{of("charaKaraka").map((f) => (f.kind === "charaKaraka" ? `${f.karaka} ${f.planet}` : "")).join(" · ")}</p>
  {:else if nav.explorerTab === "relations"}
    {#each [["lordship", "House lords"], ["functionalRole", "Functional roles"], ["exchange", "Exchanges"], ["conjunction", "Conjunctions"], ["aspect", "Aspects"], ["relationship", "Compound relationships"]] as const as [kind, title] (kind)}
      <h2>{title}</h2>
      <ul class="plain small">
        {#each of(kind) as f (f.id)}
          <li class:highlight={highlighted(f.id)}>{factSentence(f)}</li>
        {:else}
          <li class="muted">None.</li>
        {/each}
      </ul>
    {/each}
  {:else if nav.explorerTab === "ashtakavarga" && bav}
    <div class="table-wrap">
      <table>
        <thead><tr><th>BAV</th>{#each SIGNS as s, i (s)}<th>{s.slice(0, 3)}{i === lagnaSign ? "*" : ""}</th>{/each}<th>Total</th></tr></thead>
        <tbody>
          {#each GRAHAS as g (g)}
            <tr><td>{g}</td>{#each bav[g] as b, i (i)}<td>{b}</td>{/each}<td>{bav[g].reduce((x, y) => x + y, 0)}</td></tr>
          {/each}
          <tr>
            <td><strong>SAV</strong></td>
            {#each SIGNS as s, i (s)}<td><strong>{GRAHAS.reduce((sum, g) => sum + (bav[g][i] ?? 0), 0)}</strong></td>{/each}
            <td><strong>337</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="small muted">* lagna sign. SAV of 28 or more is conventionally considered supportive.</p>
  {:else if nav.explorerTab === "yogas"}
    {#if yogas.length === 0}<p class="muted">None of the {YOGA_CATALOG.length} catalogued yogas were detected.</p>{/if}
    <ul class="plain">
      {#each yogas as y (y.id)}
        {@const def = yogaDefinition(y.yoga)}
        <li class:highlight={highlighted(y.id)}>
          <strong>{y.yoga}</strong> · {y.planets.join(", ")} · houses {y.houses.join(", ")}
          {#each y.modifiers as m (m)}<span class="chip">{m}</span>{/each}
          {#if def}
            <p class="small">{def.definition}</p>
            <p class="small muted">Variant used: {def.variant}. Source: {def.sourceNote}</p>
          {/if}
        </li>
      {/each}
    </ul>
    <p class="small muted">Detection only. Whether a yoga is strong or meaningful is interpretation, which the written reading addresses.</p>
  {:else if nav.explorerTab === "dashas"}
    <DashaTimeline periods={a.parashari.periods} dates={a.localOnly.periodDates} />
  {:else if nav.explorerTab === "kp"}
    {#if a.kp}
      <KpTab kp={a.kp} chart={c.kp} dates={a.localOnly.periodDates} birth={profiles.active?.birth} />
    {:else}
      <p class="warn">KP needs Placidus house cusps, which are undefined at this latitude (beyond roughly 66°). The KP analysis is unavailable for this chart.</p>
    {/if}
  {:else if nav.explorerTab === "notes"}
    <p class="small muted">Lords of and planets in the 2nd and 7th houses (shown here for completeness; never sent anywhere).</p>
    <ul class="plain small">
      {#each a.localOnly.marakaFacts as m, i (i)}
        <li>{m.planet}: {m.reason.replaceAll("-", " ")}</li>
      {/each}
    </ul>
  {/if}
{/if}
