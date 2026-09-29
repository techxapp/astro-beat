<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<script lang="ts">
  import { onMount } from "svelte";
  import { chart, nav, profiles, vaultState, type Screen } from "./state/app.svelte.ts";
  import Welcome from "./screens/Welcome.svelte";
  import Profiles from "./screens/Profiles.svelte";
  import BirthForm from "./screens/BirthForm.svelte";
  import Explorer from "./screens/Explorer.svelte";
  import Files from "./screens/Files.svelte";
  import TopicPicker from "./screens/TopicPicker.svelte";
  import Consent from "./screens/Consent.svelte";
  import Results from "./screens/Results.svelte";
  import History from "./screens/History.svelte";
  import Settings from "./screens/Settings.svelte";
  import About from "./screens/About.svelte";
  import Unlock from "./screens/Unlock.svelte";

  let initError = $state<string | null>(null);

  onMount(() => {
    vaultState.init().then(
      () => {
        nav.screen = "welcome";
      },
      (e: unknown) => {
        initError = e instanceof Error ? e.message : String(e);
      },
    );
    const touch = () => vaultState.touch();
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    return () => {
      window.removeEventListener("pointerdown", touch);
      window.removeEventListener("keydown", touch);
    };
  });

  const items: { screen: Screen; label: string; needsProfile?: boolean }[] = [
    { screen: "profiles", label: "Profiles" },
    { screen: "explorer", label: "Explorer", needsProfile: true },
    { screen: "topic", label: "Reading", needsProfile: true },
    { screen: "history", label: "History", needsProfile: true },
    { screen: "files", label: "Files" },
    { screen: "settings", label: "Settings" },
  ];
</script>

<div class="shell">
  <header class="top">
    <button class="brand" onclick={() => nav.go("welcome")}>✦ Astro-Beat</button>
    {#if vaultState.ready && !vaultState.locked}
      <nav class="menu" aria-label="Main">
        {#each items as it (it.screen)}
          <button
            aria-current={nav.screen === it.screen ? "page" : undefined}
            disabled={it.needsProfile && !profiles.active}
            onclick={() => nav.go(it.screen)}>{it.label}</button
          >
        {/each}
        {#if vaultState.mode === "passphrase"}
          <button onclick={() => vaultState.lock()}>Lock</button>
        {/if}
      </nav>
    {/if}
  </header>

  {#if initError}
    <div class="card error" role="alert">Could not open local storage: {initError}</div>
  {:else if !vaultState.ready}
    <p class="muted">Opening your local vault…</p>
  {:else if vaultState.locked}
    <Unlock />
  {:else}
    {#if profiles.active && nav.screen !== "welcome" && nav.screen !== "profiles"}
      <p class="small muted">Active profile: <strong>{profiles.active.label}</strong>{#if chart.busy} · computing…{/if}</p>
    {/if}
    {#if nav.screen === "welcome"}<Welcome />
    {:else if nav.screen === "profiles"}<Profiles />
    {:else if nav.screen === "birth"}<BirthForm />
    {:else if nav.screen === "explorer"}<Explorer />
    {:else if nav.screen === "files"}<Files />
    {:else if nav.screen === "topic"}<TopicPicker />
    {:else if nav.screen === "consent"}<Consent />
    {:else if nav.screen === "results"}<Results />
    {:else if nav.screen === "history"}<History />
    {:else if nav.screen === "settings"}<Settings />
    {:else if nav.screen === "about"}<About />
    {/if}
  {/if}

  <footer class="foot">
    Astro-Beat is free software under the GNU AGPL v3 or later.
    <a href={`${__SOURCE_URL__}/tree/${__COMMIT_SHA__}`} rel="noreferrer noopener" target="_blank">Source code</a>
    (commit <code>{__COMMIT_SHA__.slice(0, 12)}</code>) ·
    <button class="chip" onclick={() => nav.go("about")}>About &amp; credits</button>
  </footer>
</div>
