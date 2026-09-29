# Golden reference data

`src/index.ts` defines 30 synthetic golden births (no real people). For each one, reference values
from an external tool go in `expected/<id>.json`:

```json
{
  "longitudes": { "Sun": 123.4567, "Moon": 45.6789 },
  "ascendant": 210.1234,
  "placements": [{ "planet": "Sun", "sign": "Leo", "nakshatra": "Magha", "pada": 1, "dignity": "own" }],
  "mahadashas": [{ "lord": "Venus", "start": "1990-01-01" }],
  "kpCusps": [{ "cusp": 7, "subLord": "Saturn" }]
}
```

- Parashari: JHora, Lahiri ayanamsa, mean nodes, whole-sign houses, cross-checked by hand.
- KP: tool to be chosen (open question Q4b).

Tolerances are 2′ for longitudes and 2′ for the ascendant with the current reference engine. They
tighten to 1″ / 1′ when the Swiss Ephemeris adapter replaces it. Charts without a reference file
are skipped and listed as pending in the test output.
