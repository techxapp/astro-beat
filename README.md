# Astro-Beat

Privacy-first Vedic astrology (Parashari and KP) as an offline-capable web app. The chart and the
full deterministic analysis are computed in the browser. Only when you ask for a written reading
is a small set of categorical facts for one topic sent, after you approve the exact bytes, through
a stateless proxy to an LLM. That set has no degrees, no dates, no name and no place.

Licensed under **AGPL-3.0-or-later** (see `LICENSE`). The hosted app and proxy link to their exact
source commit (footer, About screen, `GET /v1/meta`).

## Layout

| Path | What |
|---|---|
| `packages/schema` | zod v4 schemas: chart (local only), analysis (public) / `local` (period dates, maraka), payload v3, API, chart files, `identifying` (birth data) |
| `packages/core` | Engine interface plus a pure-TS **reference engine** (see below): positions, ayanamsas, ascendant, Placidus, Vimshottari, ingress search |
| `packages/analysis` | Pure TS `Chart → Analysis`: placements, dignity, five-fold relations, states, aspects, lordship and functional roles, 15 vargas, BAV/SAV, chara karakas, 20 yogas, labelled periods and transits, KP sub table, cusp and planet lords, significators A–D, KP periods |
| `packages/payload` | `AnalysisPublic → PredictionPayload`: per-topic allowlists, renumbered fact ids and period labels, single serialization and a leak scanner |
| `packages/prompts` | Versioned prompts per (system, topic) and the strict-mode output JSON schema |
| `packages/chartfile` | Chart-only export (SHA-256 checksum) and encrypted profile export (PBKDF2 600k plus AES-256-GCM, header as AAD). Strict import with migrations and sanity checks |
| `packages/fixtures` | Sentinel and golden inputs, the canary unit test, and the **inversion harness** (`pnpm inversion-report`) |
| `apps/web` | Svelte 5 PWA: birth form (offline gazetteer, Intl historical offsets), chart worker, encrypted IndexedDB vault, explorer, files, topic picker, consent, results, history, settings |
| `apps/proxy` | Cloudflare Worker: origin → type and size → HMAC session → Durable Object rate limits → token budget → schema → server-owned prompt → OpenAI (`store:false`, strict schema) → output parse, grounding and date/age redaction |
| `e2e` | Playwright: canary network capture, consent byte-equality, CSP and Trusted Types violations, Clear everything, offline PWA |

## Commands

```sh
pnpm install
pnpm lint && pnpm typecheck && pnpm test   # unit, property, fuzz, proxy, canary tests
pnpm e2e                                   # builds the app and serves it with the production CSP
pnpm inversion-report [--check] [--charts N]
pnpm licenses:check
pnpm --filter @astro/web dev               # app
pnpm --filter @astro/proxy dev             # proxy (wrangler); needs OPENAI_API_KEY and SESSION_SECRET
```

## Status against the plan (rev 3)

Implemented and tested: M0 through M8. For M9, the threat-model tests and the measured residual
risk below are in place; the prompt-injection eval, the ZDR status and a written privacy notice remain.

### Deviations and decisions to review

1. **Ephemeris.** `packages/core` is a pure-TS reference engine (Schlyter orbital elements, Meeus
   node and sidereal time, about 1–2′). Q2 (your core design and the Swiss Ephemeris WASM build) is
   still open, so it sits behind a `ChartEngine` interface for the Swiss Ephemeris adapter to
   replace. Tests check it against Meeus's worked examples to within 3′. Golden tolerances are 2′
   for now and tighten to 1″ with Swiss Ephemeris. `kp-new` is refused until then; the default KP
   ayanamsa is `kp-old` (Krishnamurti).
2. **Golden references pending.** The harness runs against `packages/fixtures/golden/expected/*.json`,
   but no reference data from JHora or a KP tool (Q4b) is committed yet. 30 cases are skipped.
3. **Period labels are renumbered per payload**, like fact ids. A global label number would reveal
   how many periods have passed since birth, which gives the age. The client maps payload labels
   back through `periodLabelMap` to local dates. `order` is dropped from payload periods.
4. **Payload window.** The following MDs are sent at MD level only. Payload PDs carry only
   ingresses inside the PD, retrograde re-entries are deduplicated, and there are at most 12
   fact refs per period. Relationship facts are limited to core topic planets and dasha lord pairs.
5. **Proxy body limit is 32 KB, not 16 KB.** Measured Parashari payloads are 10–20 KB and KP
   payloads 5–9 KB.
6. **Charts store MD/AD/PD only.** Both systems' SD levels would push a chart file past the
   1 MB import limit. The explorer derives SDs on demand.
7. **Placement facts gain `gandanta`.** It is already implied by nakshatra and pada, so it leaks nothing new.
8. **Conventions (Q4/Q4a) are settings with defaults.** Rahu/Ketu aspects 5/7/9, 8 chara karakas,
   classical combustion orbs, neecha-bhanga with the canceller in a kendra from the lagna or Moon,
   lower longitude winning a planetary war, Rahu exalted in Taurus, KP node rule on, KP conjunctions off.
   Every yoga carries a `definition`, `variant` and `sourceNote` for your review (Q5).
9. **Model** `gpt-5-mini` in `wrangler.toml` is a placeholder (Q8). Verify the Responses API
   request shape against current OpenAI docs before deploying (see `apps/proxy/src/openai.ts`).

### Measured residual risk (inversion harness; answers part of Q1)

`pnpm inversion-report --charts 4` brute-forces 1900–2030, in 10-minute steps, at every 1° of
longitude and 5° of latitude up to ±60°, for 4 golden charts × 7 topics × 2 systems:

| | Candidate days in 130 years | Candidate hours (planets only) | Share of the Earth grid consistent with angle facts |
|---|---|---|---|
| Parashari | **1–2** | about 2–6 | about 0.3–0.9 % |
| KP | **1** | about 1–1.3 | under 0.05 % |

**The birth date is effectively pinned, not "roughly inferable".** This holds even with planet
placements reduced to sign only (what-if option in the harness). The Moon's nakshatra and pada,
which Vimshottari needs, together with the Sun's and slow planets' signs already give year, month
and day. Birth time and place are then constrained to a narrow band of local sidereal time,
much more tightly for KP. The payload is personal data. Widening the date would mean withholding
Moon detail or planet signs, which is a product decision for Q1. The CI thresholds in
`packages/fixtures/inversion-thresholds.json` are regression guards only, set just below the
measured values.

## Credits

GeoNames (CC BY 4.0) for place data; the committed `public/geo/cities.json` is a small seed, and
`apps/web/scripts/build-gazetteer.mjs` builds the full `cities15000` index. `@photostructure/tz-lookup`
(CC0). Swiss Ephemeris (Astrodienst, AGPL option) once the production engine lands.
