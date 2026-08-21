# Phase 4 backtest golden fixture

This directory is the immutable Phase 4 application-level acceptance dataset.

- `phase4-candles.json` contains one ordered, closed `GOLDENUSDC` 1h history.
  The first three candles are indicator warm-up only; the requested range starts
  at `golden-candle-003`.
- `phase4-strategy.json` enters after a two-candle confirmed cross above EMA(2)
  and exits a selected lot after its fee-aware net return reaches five percent.
- `phase4-execution.json` fixes the range, budget, position size, fee, and
  slippage snapshots used by the run.
- `phase4-expected-result.json` is the reviewed, canonical output of the
  production historical runner and metrics calculator. Update it only when an
  intentional backtest contract change has been reviewed together with the
  corresponding implementation.

The fixture deliberately produces a confirmed crossing, a next-open entry, a
position-aware exit decision, and a next-open full-lot close. Timestamps, IDs,
decimal strings, decisions, events, snapshots, fills, positions, and metrics are
fixed so a merely deterministic but unintended behavior change cannot silently
pass the acceptance gate.
