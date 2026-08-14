# Phase 3 golden strategy fixtures

These files are immutable acceptance inputs for the Phase 3 strategy engine:

- `reference-candles.json` contains 140 ordered, closed `REFERENCEUSDC` one-hour candles. Its first 38 closes are the Welles Wilder RSI worksheet series already used by the indicator unit tests. The remaining closes are a deterministic synthetic extension designed to cross warm-up, trend, reversal, candle-sequence, and EMA-position boundaries.
- `strategy-v1.json` exercises nested `all`/`any`, Wilder RSI, strict EMA position with an optional percentage distance, and candle-sequence rules.
- `expected-indicators.json` contains independently calculated RSI(14), EMA(20), and EMA(100) for every candle prefix. Values were produced with Python `decimal.Decimal` at 50-digit precision, not with the production TypeScript functions.
- `expected-decisions.json` fixes the expected policy outcomes for warm-up, HOLD, BUY, exit-without-position, and exit-priority scenarios.
- `generate-reference.py` is the auditable, manual-only reference generator. The test runner never executes it.

## Update policy

Do not refresh expected values from the production indicator or strategy-engine implementation. A fixture update must be intentional and reviewed together with the formulas and scenario expectations. Run `python tests/fixtures/strategy/generate-reference.py` only when deliberately replacing the reference dataset, then review the JSON diff and run the full suite.

Indicator comparisons use an absolute tolerance of `1e-10` only to bridge the final `Decimal` to JavaScript `number` conversion. Warm-up values must match `null` exactly. Candle timestamps and decimal price strings must remain unchanged so repeated runs are deterministic.
