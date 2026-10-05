# Astro-Beat

Privacy-first astrology (Vedic Parashari and KP, and Western) and numerology as an offline-capable web app. The chart and the
full deterministic analysis are computed in the browser. Only when you ask for a written reading
is a small set of categorical facts for one topic sent, after you approve the exact bytes, through
a stateless proxy to an LLM. That set has no degrees, no dates, no name and no place.

Written readings come from one of five systems:

| System | What is sent | Timing |
|---|---|---|
| **Parashari** (Vedic) | sidereal placements, lordships, aspects, yogas, vargas, SAV | Vimshottari MD/AD/PD with transits |
| **KP** (Krishnamurti) | cusp and planet lords, significators A–D | Vimshottari periods of significators |
| **Western** (tropical) | traditional dignities, Placidus houses (whole-sign near the poles), house rulers, Ptolemaic aspects, element/modality balance | yearly profections and their quarters, Jupiter/Saturn/node transits to natal points |
| **Numerology** (Pythagorean) | Life Path, Birthday, Expression, Soul Urge, Personality, Maturity, karmic debt and lessons | pinnacles and challenges, personal years and months |
| **Combined** | the topic's facts from the branches you pick (at least two), in one request | each branch's own periods |

A combined reading comes back as one report whose centrepiece is a side-by-side table: one row per
question (overall outlook, right now, coming months, best window, strengths, challenges, two
topic-specific rows, what to focus on), one column per branch, and an "Overall" column with how far
the branches agree and the balanced conclusion.

Place search is offline by default (a bundled GeoNames `cities5000` index). If a town is missing,
an explicit "Search online" button sends only the text you typed to the proxy's `POST /v1/geocode`,
which forwards it to the Open-Meteo geocoding API. It is never sent automatically, is not logged,
and carries no other form data.

Licensed under **AGPL-3.0-or-later** (see `LICENSE`). The hosted app and proxy link to their exact
source commit (footer, About screen, `GET /v1/meta`).

## Layout

| Path | What |
|---|---|
| `packages/schema` | zod v4 schemas: chart and Western chart (local only), analysis (public: Parashari, KP, Western, numerology) / `local` (period dates, maraka), payload v3 (one branch, or several `parts` for combined), API (with the comparison table), chart files, `identifying` (birth data) |
| `packages/core` | Engine interface plus a pure-TS **reference engine** (see below): positions, ayanamsas, ascendant, Placidus, Vimshottari, ingress search, tropical (Western) view of a chart with transit samples |
| `packages/analysis` | Pure TS `Chart → Analysis`: placements, dignity, five-fold relations, states, aspects, lordship and functional roles, 15 vargas, BAV/SAV, chara karakas, 20 yogas, labelled periods and transits, KP sub table, cusp and planet lords, significators A–D, KP periods; Western dignities, houses, rulers, aspects, profections and transit hits |
| `packages/numerology` | Pure TS Pythagorean numerology from a plain birth date and name: core numbers, karmic debt and lessons, pinnacles and challenges, personal years and months |
| `packages/payload` | `AnalysisPublic` (and numerology) `→ PredictionPayload`: per-topic allowlists, renumbered fact ids and period labels (numbered across branches in combined payloads), single serialization and a leak scanner |
| `packages/prompts` | Versioned prompts per (system, topic), including the combined comparison contract, and the strict-mode output JSON schema |
| `packages/chartfile` | Chart-only export (SHA-256 checksum) and encrypted profile export (PBKDF2 600k plus AES-256-GCM, header as AAD). Strict import with migrations and sanity checks |
| `packages/fixtures` | Sentinel and golden inputs, the canary unit test, and the **inversion harness** (`pnpm inversion-report`) |
| `apps/web` | Svelte 5 PWA: birth form (offline gazetteer with opt-in online place search, Intl historical offsets), chart worker, encrypted IndexedDB vault, explorer, files, topic picker, consent, results, history, settings |
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
9. **Western uses the seven traditional planets and the nodes.** The reference engine has no
   Uranus, Neptune or Pluto; the prompt forbids inventing them. Natal Western positions are the
   chart's sidereal ones plus the ayanamsa at the birth date (read from the start of the dasha tree),
   so chart-only imports get Western readings too. Transit samples cover the current profection year
   and the next six and are computed by the worker on each analysis, never stored.
10. **Numerology runs on the device from the profile's birth date and name.** Only the reduced
    numbers (≤ 33) are sent. It is unavailable for chart-only imports (no birth date); without a
    name only the date-based numbers are used. Personal years follow the calendar year.
11. **Combined readings disclose more in one request.** They carry several branches' facts at once
    (35–46 KB measured for all four branches), with shorter Vedic windows (the current AD's PDs only)
    and lower fact caps. The proxy gives them a larger output budget (16k tokens) and timeout (120 s).
    The inversion harness models the Vedic payloads only; Western angles add little beyond what KP
    already pins.
12. **Model** `gpt-5.5` in `wrangler.toml` is a placeholder (Q8). Verify the Responses API
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

GeoNames (CC BY 4.0) for place data; `public/geo/cities.json` is built by
`apps/web/scripts/build-gazetteer.mjs` from the `cities5000` dump. Open-Meteo geocoding (CC BY 4.0,
non-commercial free tier) backs the opt-in online search. `@photostructure/tz-lookup`
(CC0). Swiss Ephemeris (Astrodienst, AGPL option) once the production engine lands.
