# Trading Bot Feature Plan

## Document purpose

This document is the implementation roadmap and development status reference for
the Dagobert trading bot feature. It is intended to be read at the beginning of
each new task so that implementation decisions remain consistent across tasks.

The initial product requirements have been agreed and implementation is in
progress. As work progresses, update the status tables, decision log, and
relevant milestone acceptance criteria in this document in the same change set
as the implementation.

## Current status

| Phase | Status | Outcome |
| --- | --- | --- |
| Phase 0: requirements | Complete | Initial product scope and constraints are agreed below. |
| Phase 1: domain and persistence | Complete | The implementation and automated integration suite have been verified against PostgreSQL. |
| Phase 2: market data | Complete | Steps 0-5 and the external acceptance gate are complete; the Prisma suite and Binance/PostgreSQL smoke test verified idempotent closed-candle ingestion, gap handling, and restart safety. |
| Phase 3: strategy engine | Complete | Steps 0-9 and the golden acceptance gate are complete; fixed independent indicator references, deterministic decisions, and look-ahead rejection are covered. |
| Phase 4: backtesting | In progress | Steps 0A-4D and both Step 5 golden suites are implemented; the PostgreSQL golden gate must pass in the target environment before Phase 4 closes. |
| Phase 5: paper trading | Not started | Bots run against live data without placing exchange orders. |
| Phase 6: replay UI | Not started | A run can be replayed with decisions and positions on a chart. |
| Phase 7: Spot test and live trading | Not started | Market orders can be tested and then placed on Binance Spot. |
| Phase 8: video rendering | Not started | Replays can be rendered in standard and vertical formats. |
| Phase 9: Margin trading | Deferred | Margin support is designed only after Spot is stable. |

## Phase 0: agreed requirements

### Bot and capital rules

1. One bot watches exactly one trading pair.
2. Only pairs whose quote asset is USDC are allowed, for example `BTCUSDC`.
3. The assigned USDC budget is a virtual allocation maintained by Dagobert. It
   is not represented by a separate Binance account or sub-account.
4. A bot may open as many positions as its available virtual budget permits.
   For example, a bot with 55 USDC assigned and a 10 USDC per-position amount
   may have five open positions. The remaining 5 USDC is insufficient for
   another position.
5. Each position is an independent lot. An exit closes the entire selected
   position; partial position exits and fixed-amount exits are not part of the
   initial scope.
6. Reserved and spent funds must be accounted for so concurrent decisions
   cannot exceed either the bot's virtual budget or the owner's shared Spot
   wallet balance. The reservation must be atomic at both levels.

The bot's available budget is derived from its append-only cash ledger, not by
subtracting current invested cost from the original allocation:

```text
botCashBalance = sum(posted bot cash-ledger entries)
availableBotBudget = botCashBalance - pendingBotReservations
availableBotBudget >= 0
```

The initial allocation credits the ledger. A filled buy debits its actual cost
and fees; a filled sell credits its actual proceeds and separately debits any
sell fee. Consequently, closing a losing position restores only its lower sale
proceeds, while closing a winning position makes the realized profit available
to the bot. `investedCost` remains a reporting value and must not be used to
reconstruct spendable cash.

Several `SPOT_TEST` or `SPOT_LIVE` bots may share one owner's Binance Spot
wallet. Passing the per-bot check is therefore not sufficient. Before placing
an order, the application must also enforce:

```text
availableOwnerWalletUsdc = lastReconciledFreeUsdc - pendingWalletReservations
entryCostWithEstimatedFees <= availableBotBudget
entryCostWithEstimatedFees <= availableOwnerWalletUsdc
```

The owner-wallet check and reservation must use a database transaction and a
row-level lock (or an equivalent serializable operation), together with the
bot-level reservation. This prevents two bots from simultaneously spending the
same exchange balance. A stale exchange balance, a rejected order, or a
reconciliation mismatch must stop new reservations until reconciliation
refreshes or corrects the shared wallet state.

### Market and execution rules

1. Only fully closed candles may produce a trading decision.
2. The timeframe is configurable. The initial supported set should be explicit,
   initially `15m`, `1h`, `4h`, and `1d`, and can be expanded later.
3. The initial market type is Spot. Margin is deliberately deferred.
4. Entries and exits use market orders.
5. The worker determines when an order must be placed after processing a closed
   candle.
6. An exit sells the full remaining quantity of one position.
7. Partial fills require schema and event placeholders, but sophisticated
   partial-fill orchestration is not required initially because bot allocations
   are expected to be small, typically around 50 USDC.
8. Fees and slippage are configurable and must be applied consistently in
   backtest, paper, and live accounting.

Even with small orders, the exchange can report a partial fill. The initial
implementation must preserve the executed quantity and status and must never
assume that more was sold than was actually held. It may stop the affected bot
and request reconciliation rather than automatically managing a complex chain
of remaining orders.

### Strategy rules

1. Strategies are declarative JSON documents with explicit versions.
2. A GUI must be provided for creating and editing supported strategy rules. The
   GUI produces validated JSON; it does not introduce a second strategy format.
3. User-provided JavaScript or other executable strategy code is not supported.
4. RSI periods and thresholds are configurable.
5. EMA periods, required price side, and optional distance thresholds are configurable.
6. An EMA condition requires the last closed candle's close to be strictly
   `ABOVE` or `BELOW` the EMA. Equality matches neither side. When the optional
   maximum distance is present, the proximity calculation is:

   ```text
   abs(close - EMA(period)) / EMA(period) * 100 <= maximumDistancePct
   ```

   For a two-percent threshold, `maximumDistancePct` is `2.0`. It is optional;
   without it, any distance on the configured side matches. When present it is
   between 0 and 100 percent with at most one decimal place.
7. Strategies can evaluate candle sequences and candle properties. For example,
   a rule may enter after three consecutive red candles, each having fallen by
   more than one percent.
8. Entry and exit conditions support nested `all` and `any` groups. The initial
   version should avoid arbitrary formulas and expose a constrained set of
   validated operators.
9. A strategy evaluation produces `BUY`, `SELL`, or `HOLD` and records the input
   values and human-readable reasons for the result.

An illustrative strategy document is:

```json
{
  "schemaVersion": 1,
  "name": "RSI EMA and red-candle entry",
  "entry": {
    "any": [
      {
        "all": [
          { "indicator": "RSI", "period": 14, "operator": "LT", "value": 20 },
          {
            "indicator": "EMA_DISTANCE",
            "period": 100,
            "position": "ABOVE",
            "maximumDistancePct": 2.0
          }
        ]
      },
      {
        "candleSequence": {
          "count": 3,
          "direction": "RED",
          "minimumBodyChangePct": 1
        }
      }
    ]
  },
  "exit": {
    "all": [
      { "indicator": "RSI", "period": 14, "operator": "GTE", "value": 80 }
    ]
  }
}
```

The exact JSON Schema is a Phase 3 deliverable. The example above communicates
intent and is not yet a stable API contract.

### Delivery order

The required implementation and validation progression is:

```text
Backtest -> Paper test -> Spot test -> Spot live
```

No later mode may be enabled until the preceding mode meets its acceptance
criteria. A mode is stored on each run so historical results cannot be confused
with live trading.

### Replay and publishing scope

1. An initial replay function is required.
2. Replay data must be deterministic and derived from persisted candles,
   decisions, orders, fills, positions, and portfolio snapshots.
3. The first replay UI includes play, pause, speed selection, candle stepping,
   entry and exit markers, indicator values, decision reasons, and profit/loss.
4. Standard 16:9 and vertical 9:16 layouts should be considered when designing
   the replay presentation.
5. Automatic YouTube upload is explicitly out of scope.
6. Automated video rendering is a later milestone; browser recording of the
   deterministic replay is acceptable initially.

## Architecture principles

### Separate decisions from execution

The strategy engine returns an intent and must never call Binance directly:

```text
closed candle
  -> indicator calculation
  -> strategy evaluation
  -> risk and budget validation
  -> order intent
  -> execution adapter
  -> event and accounting updates
```

Backtest, paper, Spot test, and Spot live must use the same indicator, strategy,
risk, and accounting domain logic. Only the execution and market-data adapters
vary by mode.

### Run bots in a worker

Bots must not depend on an open browser tab or a long-running Next.js request. A
separate worker process should ingest candles, claim work, evaluate strategies,
submit orders, reconcile state, and record events. PostgreSQL remains the source
of truth.

### Guarantee idempotency

Processing retries and worker restarts must not place duplicate orders. A
decision/order key should include at least:

```text
botRunId + symbol + timeframe + candleOpenTime + action + positionId
```

Use database uniqueness constraints and transactional budget reservation. Lock
or atomically claim a bot/candle evaluation before processing it.

### Preserve reproducibility

Starting a bot creates an immutable run snapshot containing its complete
configuration, strategy version, fee model, slippage model, and execution mode.
Editing a bot or strategy later must not change a historical run.

Prices, quantities, fees, and budgets use decimal arithmetic in domain and
persistence code. JavaScript floating-point numbers must not be used for money.

## Proposed domain and persistence model

Names may be refined during implementation, but the responsibilities and audit
data must be retained.

### `Bot`

- owner/user ID;
- unique display name per owner;
- one `*USDC` symbol;
- assigned USDC budget;
- USDC amount per new position;
- timeframe;
- mode and lifecycle status;
- active strategy version;
- configurable fees and slippage;
- created and updated timestamps.

Suggested lifecycle states are `DRAFT`, `RUNNING`, `PAUSED`, `STOPPED`, and
`ERROR`. Suggested modes are `BACKTEST`, `PAPER`, `SPOT_TEST`, and `SPOT_LIVE`.

### `TradingWallet` and `WalletReservation`

`TradingWallet` represents one owner's shared execution wallet for an exchange,
account, environment, and quote asset. It stores the last reconciled free USDC,
the reconciliation timestamp/status, and the version used for optimistic or
row-level locking. `WalletReservation` records pending spend by bot run and
order intent. Reservations are consumed by fills or released after rejection,
cancellation, timeout reconciliation, or an explicit correction.

Backtest and paper modes use a simulated wallet with the same reservation
contract. Spot test and Spot live modes use a wallet backed by reconciled
Binance balances. Bot allocations and wallet reservations are separate: an
allocation limits how much a bot may manage, while a wallet reservation proves
that the shared execution account can fund a specific pending order.

### `Strategy` and `StrategyVersion`

`Strategy` owns its identity and display metadata. `StrategyVersion` contains an
immutable validated JSON definition, JSON schema version, monotonically
increasing version number, and creation timestamp.

### `Candle`

Store symbol, interval, open time, close time, OHLC values, volume, quote volume,
trade count, closed status, source, and receipt time. Enforce uniqueness on:

```text
(symbol, interval, openTime)
```

### `BotRun`

Each start creates a run with bot ID, mode, configuration snapshot, strategy
snapshot, status, start/end timestamps, and error information. Backtests also
record their requested time range.

### `IndicatorSnapshot` and `StrategyDecision`

Store computed values for the evaluated candle and the resulting `BUY`, `SELL`,
or `HOLD`. A decision includes machine-readable reason codes, human-readable
explanations, and the exact inputs used.

### `Position`

Each successful entry creates an independent position lot. Store entry cost,
entry quantity, remaining quantity, average entry and exit prices, fees,
realized/unrealized profit, and open/close times. Multiple positions can be open
for the same bot and pair.

When an exit signal occurs, the initial policy is to close all currently open
positions for the bot. Execution should still create one auditable close action
per position or clearly preserve allocation of the aggregate fill back to its
positions.

### `BotOrder` and `Fill`

Separate requested orders from exchange fills. Store internal and exchange IDs,
idempotency key, side, market order type, requested quote amount/quantity,
executed quantity, status, timestamps, commission, commission asset, and raw
exchange references needed for reconciliation.

### `BotLedgerEntry`

Use an append-only virtual USDC ledger instead of deriving available capital
only from mutable bot fields. Entry types can include allocation, reserve,
release, buy cost, sell proceeds, fee, and correction. Buy costs and fees are
negative cash entries; sell proceeds are positive cash entries. Realized profit
or loss is therefore naturally carried into the next available budget. A cached
cash balance may be maintained, but it must reconcile exactly to the ledger.

### `BotEvent`

Use an append-only event timeline with a per-run sequence number, event type,
event timestamp, associated candle time, and JSON payload. Events include run
state changes, candle processing, decisions, risk rejections, orders, fills,
position changes, reconciliation, and failures.

### `PortfolioSnapshot`

Persist replay-ready snapshots of available budget, reserved budget, invested
cost, asset market value, realized profit, unrealized profit, and total equity.

## Milestone plan

### Phase 1: domain and persistence

#### Implementation progress

- [x] Add the bot, strategy, run, position, order, fill, ledger, decision, event,
  candle, indicator snapshot, and portfolio snapshot Prisma models and migration.
- [x] Add domain entities and repository contracts.
- [x] Add Prisma repository adapters and stable DTO mappers.
- [x] Add initial bot, run, strategy, and candle use cases and server composition.
- [x] Add authenticated HTTP APIs for bot management (strategy management remains pending).
- [x] Implement lifecycle transitions that update the bot and run atomically.
- [x] Implement transactional virtual-budget reservation/release, including
  shared owner-wallet locking and reservations across bots.
- [x] Add the shared `TradingWallet`/`WalletReservation` persistence model and
  migration before enabling Spot test or Spot live execution.
- [x] Complete the Phase 1 automated integration suite against PostgreSQL.

#### Work

- Add bot, strategy, run, position, order, fill, ledger, decision, event, candle,
  and snapshot models with migrations.
- Add domain entities, repository contracts, Prisma adapters, DTOs, and use
  cases following the repository's feature-first module structure.
- Add bot create, update, list, detail, start, pause, and stop APIs.
- Validate `*USDC`, positive budgets, the fee-inclusive position cash cap, timeframe,
  strategy version, and mode transitions.
- Add transactional bot-budget and owner-wallet reservation/release operations.

#### Acceptance criteria

- A valid draft bot can be created and retrieved.
- Invalid pairs and budget configurations are rejected.
- Multiple positions can reserve capital without exceeding assigned USDC.
- Multiple bots sharing one owner wallet cannot reserve more than the last
  reconciled free USDC, even when entry decisions execute concurrently.
- Closing positions credits actual sale proceeds and fees through the ledger,
  so subsequent availability includes realized profit or loss.
- Starting a bot creates immutable configuration and strategy snapshots.
- Lifecycle operations are idempotent and covered by unit/integration tests.

### Phase 2: market-data persistence

#### Implementation progress

- [x] Step 0: Phase 1 PostgreSQL gate verified and shared market-data contract implemented.
- [x] Step 1: ingestion cursor schema/contracts, exact candle validation, and transactional candle/cursor persistence.
- [x] Step 2: Binance REST server-time and historical-kline adapter with pagination, retries, timeout, cancellation, and closed-candle filtering.
- [x] Step 3: historical backfill and gap repair, including resumable bounded imports, dry-run CLI, and timeframe defaults.
- [x] Step 4: resilient closed-candle polling, including active-bot/configured subscription discovery, advisory leases, bounded overlap catch-up, boundary scheduling, retry/backoff, one-shot and continuous CLI modes, and operator documentation.
- [ ] Step 5: operability and the Phase 2 acceptance gate.

#### Recommended implementation sequence

Implement Phase 2 as the following small, independently testable changes. Do
not combine the Binance transport, persistence changes, and continuously
running process in one change: the backfill service should already work and be
covered by tests before scheduling it.

##### Step 0: close the Phase 1 gate and fix the market-data contract

- Run the complete Phase 1 unit and PostgreSQL integration suites, including
  the lifecycle and real concurrent budget-reservation cases, then mark the
  remaining Phase 1 integration checkbox complete. Phase 2 should not conceal
  a Phase 1 persistence failure.
- Make the `15m`, `1h`, `4h`, and `1d` allow-list the shared source of truth
  for bots, candle ingestion, API input, and cursor records.
- Document and test these candle semantics before adding an exchange adapter:
  UTC timestamps; Binance kline open time as identity; `[openTime, closeTime]`
  range boundaries; a WebSocket candle is closed only when its exchange close
  flag is set, while a REST candle is closed only after its close time is at or
  before corrected server time; decimal strings throughout; and later Binance
  corrections overwrite the mutable values of the same
  `(symbol, interval, openTime)` row.
- Decide the initial process boundary. Use a standalone, restartable scheduled
  poller for the first version rather than a WebSocket: the initial timeframes
  are long, REST overlap polling naturally repairs missed updates, and a
  WebSocket can be added later behind the same ingestion port.

**Exit:** Phase 1 tests pass against PostgreSQL, the old Phase 1 checkbox is
closed, and the candle/cursor contract has focused unit tests.

##### Step 1: add ingestion state and harden candle persistence

- Add a `CandleIngestionCursor` (or equivalently named) Prisma model and
  migration, unique by source, symbol, and interval. Store the last contiguous
  closed candle open time, last successful poll time, exchange/server clock
  offset, status, and last error. A cursor is an optimization and recovery
  checkpoint, never evidence that all earlier candles exist.
- Extend the market-data domain with typed interval/range values, a cursor
  repository, a market-data source port, and explicit validation errors.
- Replace `Number`-based OHLC validation with exact decimal comparison. Validate
  finite non-negative OHLCV values, `low <= open/close <= high`, non-negative
  trade count, expected interval duration/timestamps, supported symbol and
  interval, and closed status.
- Make a batch save transactional: upsert candles first and advance the cursor
  only to the last contiguous successfully persisted closed candle. Keep the
  existing database uniqueness constraint as the final idempotency guard.

**Exit:** repository integration tests prove idempotent upsert, correction
updates, rollback behavior, cursor monotonicity, and rejection of invalid or
open candles.

##### Step 2: implement the Binance REST adapter

- Implement an adapter for Binance server time and historical klines behind the
  market-data source port; do not call the legacy Next.js kline route from the
  application service.
- Map exchange values to domain candles without converting prices or volumes to
  JavaScript numbers. Normalize symbols and intervals and derive `isClosed`
  using the Step 0 clock rule.
- Support Binance page limits, deterministic ascending pagination, bounded
  retries with jitter for retryable failures and rate limits, request timeout,
  and cancellation. Reject malformed, duplicated, or out-of-order responses at
  the adapter boundary.

**Exit:** fixture-based adapter tests cover mapping, pagination boundaries,
clock drift, rate limiting, malformed responses, and exclusion of the current
open candle without requiring live Binance access.

##### Step 3: build the historical backfill and gap-repair service

- Keep the rolling default backfill range in one shared policy. Without an
  explicit start, align the default end (`now`) to the selected interval and
  derive a start that includes exactly 15,000 closed candles. Explicit start
  and end values override these defaults. The default invocation page budget
  is also derived from the same 15,000-candle policy.
- Treat the leading part of a default range before a symbol's first available
  Binance candle as unavailable history rather than a repairable gap. Report it
  separately and start continuity/cursor verification at the first available
  candle. Explicit start overrides retain strict gap semantics.
- Accept a symbol, interval, inclusive start, and exclusive end; split the range
  into Binance pages and persist each validated page through the application
  service.
- Calculate expected open times using interval-aware UTC arithmetic. Compare
  them with persisted candles to report every missing contiguous range, then
  refill only those ranges.
- Re-read the repaired range before advancing the contiguous cursor. Bound work
  per invocation so a large history can resume safely after interruption.
- Advance the cursor with a targeted stored-range continuity check and cursor
  update; never re-upsert the complete historical prefix merely to checkpoint it.
- Do not let empty pre-listing Binance pages exhaust the persistence-page limit:
  continue scanning the bounded requested range until the symbol's available
  history is reached, while retaining a separate hard ceiling for empty pages.
- Expose an operator-facing CLI command with dry-run, range, symbol, interval,
  page/batch limit, and structured summary output. Do not expose arbitrary
  unauthenticated ingestion over HTTP.
- Emit structured page progress to stderr during long CLI imports while keeping
  the final machine-readable summary on stdout.

**Exit:** an integration test interrupts a multi-page import, resumes it, and
proves that reruns create no duplicates and repair deliberately removed
candles.

##### Step 4: add resilient closed-candle polling

- Add a standalone poller entry point, separate from Next.js. Discover active
  `(symbol, interval)` subscriptions from running non-backtest bots, while also
  allowing an explicit configured set during rollout.
- On every tick, fetch from at least one candle before the cursor through server
  `now`. This overlap makes corrections and a missed final candle self-healing.
  Persist only closed candles and reuse the same validation/upsert/backfill
  service as manual imports.
- Use a database advisory lock or lease per source/symbol/interval so multiple
  process instances do not do duplicate work. Duplicate fetches must still be
  harmless because storage is idempotent.
- Align polling to interval boundaries with a small close grace period. Apply
  bounded exponential backoff after failure, persist error state, and re-check
  server clock instead of advancing the cursor.

**Exit:** fake-clock tests prove boundary scheduling, overlap, retry, lease
exclusion, restart from the persisted cursor, and that an open candle is never
made eligible for strategy processing.

**Completed:** the standalone poller discovers unique subscriptions from
running non-backtest bots and an optional configured rollout set, processes
each source/symbol/interval under a PostgreSQL advisory lease, and bounds stale
cursor recovery to resumable pages. Deterministic worker tests cover exact
boundary-plus-grace scheduling, exponential retry, overlap, restart, and open
candle rejection; Prisma integration coverage exercises lease exclusion,
idempotent corrective reruns, and cursor monotonicity. The CLI supports both a
single diagnostic run and a continuously supervised worker, with separate
operator guides for polling and historical backfill.

##### Step 5: add operability and complete the Phase 2 gate

- Add structured logs and metrics for last closed candle, cursor lag, detected
  and repaired gaps, clock offset, request latency/rate-limit retries, rejected
  payloads, and consecutive failures. Add a health check that becomes unhealthy
  when freshness or clock-drift thresholds are exceeded.
- Add configuration validation, graceful shutdown, a single-run mode for
  deployments/diagnostics, and a short runbook for initial backfill, normal
  startup, gap repair, and cursor recovery. Never log API credentials.
- Run unit, Prisma integration, and deterministic adapter/worker tests. Perform
  a staging smoke test against Binance with a small range, then query the
  database for duplicates, gaps, and accidentally persisted open candles.
- Update the phase status and decision log only after every acceptance criterion
  below is demonstrated. Phase 3 may consume candles only through a query that
  explicitly filters `isClosed = true`.

**Exit:** all Phase 2 acceptance criteria pass and the poller can be stopped,
restarted, and safely run twice for the same interval.

**Complete:** the single-maintainer scope adds structured cursor lag, gap totals,
clock drift, consecutive failures, and a simple health/reasons result; validates
startup configuration; redacts Binance credentials; and documents startup,
restart, gap repair, and cursor audits. Deterministic tests cover stale cursors,
clock drift, gap reporting, credential redaction, restart overlap, gap repair,
and open-candle exclusion. The Prisma integration suite and a small
Binance/PostgreSQL smoke test verified duplicate-free closed-candle persistence,
gap detection and repair, restart-safe cursor continuation, open-candle
exclusion, and safe repeated processing of the same interval.

For the current single-user, single-maintainer hobby deployment, the structured
one-shot result is the health check. Prometheus/OpenTelemetry, dashboards,
alerts, HTTP liveness/readiness endpoints, and persistent metric history are
deferred until multiple maintainers or independent users require unattended
availability.

#### Dependency order

```text
Step 0 contract/gate
  -> Step 1 persistence and cursor
  -> Step 2 Binance REST adapter
  -> Step 3 backfill and gap repair
  -> Step 4 scheduled polling
  -> Step 5 observability and acceptance gate
```

The schema and ports in Steps 0-1 enable adapter and fixture work, but the main
delivery path should remain sequential so each later step builds on a tested
idempotent persistence boundary.

#### Acceptance criteria

- Re-running an import creates no duplicate candles.
- Gaps are detected and can be backfilled.
- Only closed candles are eligible for strategy processing.
- Restarting ingestion resumes from persisted state.

### Phase 3: indicator and strategy engine

#### Implementation progress

- [x] Step 0: indicator warm-up, edge-case, candle-body, and decision-priority contracts fixed.
- [x] Step 1: shared pure RSI, EMA, candle direction, body-change, and consecutive-sequence calculations implemented.
- [x] Step 2: versioned strategy TypeScript AST, JSON Schema, and runtime activation validation.
- [x] Step 3: nested condition-tree evaluation and explainable results.
- [x] Step 4: deterministic position-aware strategy engine and look-ahead protection.
- [x] Step 5: closed-candle application service and atomic decision/snapshot persistence.
- [x] Step 6: owned immutable strategy-version creation, concurrency-safe numbering, and activation.
- [x] Step 7: authenticated strategy validation, lifecycle, version, and activation API.
- [x] Step 8: nested form/rule-builder GUI with preview, validation, creation, and versioning.
- [x] Step 9: golden acceptance suite and Phase 3 gate.

#### Step 0 indicator and evaluation contract

- RSI uses Wilder smoothing and defaults to period 14, while the strategy may
  configure the period. Its first average gain and loss are the simple averages
  of the first `period` close-to-close changes. Subsequent values use
  `(previousAverage * (period - 1) + currentChange) / period`.
- RSI requires `period + 1` closed candles and returns `null` during warm-up. If
  both average gain and loss are zero RSI is 50; otherwise zero average loss
  produces 100 and zero average gain produces 0.
- EMA uses candle close, starts with the simple average of the first `period`
  closed candles, and then uses `alpha = 2 / (period + 1)`. It requires `period`
  closed candles and returns `null` during warm-up.
- Indicators must reject an explicitly open candle rather than silently include
  or skip it. Candle ingestion rejects an open price of zero before a candle can
  reach the strategy engine.
- Candle direction is `RED` when `close < open`, `GREEN` when `close > open`, and
  `DOJI` when they are equal. Absolute body change percentage is
  `abs(close - open) / open * 100`.
- A missing indicator is never coerced to zero. Insufficient history makes its
  condition false with reason code `INSUFFICIENT_HISTORY`.
- Exit conditions are evaluated before entry conditions. If both match the same
  candle, exit has priority and the single decision is `SELL`; the same candle
  cannot both close and open a position.

#### Position-aware decision contract for Steps 3-5

- Step 3 evaluates the declarative entry and exit condition trees independently
  and returns their matches, observed values, and reasons. This condition
  evaluator has no position, repository, database, or exchange dependency.
- Step 4 receives an immutable evaluation context containing the ordered open
  lots (id, entry price/cost/fees, remaining quantity, and opening time) in
  addition to `hasOpenPositions` and `openPositionCount`. The strategy engine
  evaluates the exit tree once per lot and never queries position state itself.
- With open positions, one or more matching lot exits produce `SELL` and the
  decision records their stable ids in `selectedPositionIds`, even when entry
  also matches. Without an open position, an exit match is recorded with
  `EXIT_MATCHED_NO_OPEN_POSITION` but is not executable; entry is then evaluated
  and produces `BUY` when it matches, otherwise the result is `HOLD`.
- Open positions do not by themselves prevent another `BUY`, because a bot may
  hold multiple independent lots. Risk and budget validation decides whether
  the resulting buy intent can actually reserve another position amount.
- A scheduled sell snapshots `selectedPositionIds` at decision time. At the next
  candle open, `closeSelected` closes exactly those full lots and leaves every
  unselected lot open; it rejects duplicate, empty, or unknown selections.
- `POSITION_RETURN_PCT` is an exit-only, per-lot condition. Its signed observed
  value is `(estimated net exit proceeds - fee-inclusive entry outflow) /
  fee-inclusive entry outflow * 100`, where estimated net exit proceeds uses the
  latest closed-candle price minus the configured exit fee. Positive thresholds
  represent profit and negative thresholds represent loss. An `any` group with
  `GTE +2` and `LTE -4`, for example, implements a 2% take-profit or 4% stop-loss
  independently for every open lot.
- Step 5 loads the current position state, constructs the immutable evaluation
  context, calls the pure engine, and persists the context, condition results,
  final decision, values, and reasons. Phase 4 first integrates and verifies this
  contract against a changing virtual portfolio and complete position lifecycle.

#### Step 2 strategy definition v1 contract

- `StrategyDefinitionV1` is the TypeScript AST and the matching Draft 2020-12
  JSON Schema is the external format contract. Both require `schemaVersion`,
  `name`, `entry`, and `exit` and reject unknown properties.
- Conditions are recursive non-empty `all`/`any` groups, RSI comparisons,
  directional EMA-distance comparisons, or candle-sequence rules. RSI supports
  `LT`, `LTE`, `GT`, and `GTE`; `EMA_DISTANCE` requires `ABOVE` or `BELOW` and
  optionally accepts `maximumDistancePct`.
- Periods and sequence counts are positive safe integers; thresholds are finite
  non-negative numbers and RSI thresholds cannot exceed 100. Runtime validation
  additionally limits a definition to 100 condition nodes and 10 levels of
  nesting.
- Strategy creation, new-version creation, and bot start all validate the schema
  version and complete definition. Unknown versions, fields, indicators, and
  unsupported indicator/operator combinations cannot be saved or activated.

#### Steps 3-4 evaluation and engine contract

- Every condition returns a boolean match, stable machine-readable reason code,
  human-readable explanation, observed values, and the complete ordered child
  result tree. `all` and `any` evaluate every child rather than short-circuiting,
  so an audit retains both matching and non-matching reasons.
- RSI and EMA-distance leaves use the shared indicator implementations. EMA
  compares the last closed price strictly to the configured side; when present,
  distance is `abs(close - EMA) / EMA * 100` and cannot exceed
  `maximumDistancePct`. Candle sequences use the trailing configured count. Missing warm-up history returns false with
  `INSUFFICIENT_HISTORY`, never a substituted numeric value.
- The engine requires strictly ascending, unique, closed candles for one symbol
  and timeframe. The evaluated candle must occur exactly once as the final
  history candle, and any later candle, duplicate identity, open candle, mixed
  market, invalid timestamp, or mismatching evaluated-candle payload is rejected.
- Both entry and exit trees are retained in every result. The position-aware
  policy described above then produces exactly one intent and policy reason.
  Repeating an evaluation with the same definition, candle history, evaluated
  candle, and position snapshot produces the same complete result.

#### Step 5 closed-candle evaluation and persistence contract

- The application service resolves a running bot run, its immutable configuration
  and strategy snapshots, and the requested closed candle. It derives the minimum
  required lookback from both condition trees and queries only closed candles at
  or before the evaluated candle, in ascending order and with a bounded limit.
- Current `OPENING`, `OPEN`, and `CLOSING` positions form the immutable position
  context. The service invokes the pure engine and records every `BUY`, `SELL`,
  and `HOLD`, including exact candle/configuration inputs, the complete engine
  output, indicator/condition trees, explanations, and reason codes.
- Decision and indicator snapshot persistence is one transaction and uses the
  unique `(botRunId, candleId)` keys. Retrying or concurrently evaluating the
  same run/candle returns the first complete stored evaluation without overwriting
  it or creating duplicates; a half-written decision/snapshot pair is an error.

#### Step 6 strategy-version lifecycle and activation contract

- Creating a version requires ownership of the parent strategy and full v1
  validation. PostgreSQL assigns the next monotonically increasing version in a
  serializable transaction with bounded retries for write/uniqueness conflicts.
- Activating a version requires ownership of both bot and strategy, a valid and
  supported immutable definition, and a bot that is not currently running.
  Activation changes only the bot's selected version; existing run strategy
  snapshots remain unchanged.
- Step 6 establishes and tests the application and persistence boundaries called
  by the Step 7 HTTP endpoints.

#### Step 7 strategy API contract

- `POST /api/strategies/validate` validates a schema version and definition
  without persistence and returns either the typed definition or all structured
  issues with their field paths and machine-readable codes.
- `GET/POST /api/strategies` lists the authenticated owner's strategies or creates
  a validated strategy with its immutable first version. `GET /api/strategies/:id`
  returns owned strategy detail and its ordered versions.
- `POST /api/strategies/:id/versions` creates the next owned immutable version;
  `GET /api/strategies/:id/versions/:version` retrieves an owned numeric version.
- `PUT /api/bots/:id/strategy-version` explicitly activates an owned, supported
  strategy version on an owned non-running bot. Activation remains distinct from
  generic bot editing so its ownership and lifecycle policy is auditable.
- Every route is authenticated, rejects unsupported methods with `Allow`, returns
  consistent `BAD_REQUEST`, `VALIDATION_ERROR`, `NOT_FOUND`, or
  `INVALID_TRANSITION` errors, and sanitizes unexpected failures as
  `INTERNAL_ERROR` without exposing persistence details.

#### Step 8 strategy rule-builder GUI contract

- The Bot page provides a form-only editor for recursive `all`/`any` groups,
  RSI comparisons, EMA side plus optional percentage-distance thresholds, and candle-sequence rules.
  Users can add, replace, and remove nested rules while groups always retain at
  least one child; no executable JavaScript or arbitrary formula input exists.
- The editor continuously renders the exact `StrategyDefinitionV1` JSON it will
  submit. Validation calls the authenticated backend contract and displays every
  returned issue with its JSON path; invalid definitions cannot be saved.
- Creating a new strategy persists version 1. Selecting an existing strategy
  loads its latest immutable definition, and saving creates a new version rather
  than mutating history. The strategy list is refreshed after every successful
  write and timestamps/versions come from the server DTOs.
- Rule-tree transformations are pure and covered independently from React so
  nested path replacement, append/removal invariants, and emitted schema validity
  remain regression-testable.

#### Step 9 golden acceptance contract

- The immutable fixture contains 140 ordered, closed one-hour candles. Its first
  38 closes reproduce the published Wilder RSI worksheet series and its
  deterministic synthetic continuation crosses warm-up, trend, reversal,
  candle-sequence, and EMA-position boundaries.
- Expected RSI(14), EMA(20), and EMA(100) values are calculated for every candle
  prefix by an auditable Python `Decimal` reference implementation with 50-digit
  precision, independently of the production TypeScript indicators. Golden
  numeric comparisons use an absolute `1e-10` tolerance; warm-up `null` values
  must match exactly.
- A fixed valid v1 strategy and fixed position snapshots cover HOLD, BUY, SELL,
  non-actionable exits, simultaneous entry/exit with exit priority, and
  insufficient-history reasons. Every scenario also reruns against the identical
  snapshot and requires a deeply equal complete evaluation.
- The gate verifies closed/single-market/ordered fixture invariants, rejects the
  legacy EMA JSON contract, and proves that adding a candle after the evaluated
  candle is rejected as look-ahead. Fixture provenance and manual update policy
  are documented beside the data; CI never regenerates expected values from
  production code.

#### Work

- Implement pure, configurable RSI and EMA calculations.
- Implement candle direction, body-change percentage, and consecutive-candle
  sequence evaluation.
- Define and validate the versioned strategy JSON Schema.
- Implement nested `all`/`any` groups and constrained operators.
- Persist every `BUY`, `SELL`, and `HOLD` with values and reasons.
- Build the GUI editor as a form/rule builder that emits the same JSON format.

#### Acceptance criteria

- RSI and EMA match trusted fixed reference datasets.
- Historical evaluation cannot read a future candle.
- The JSON example's intent can be represented and evaluated.
- Invalid JSON and unsupported operators cannot be activated.
- The same candle history and run snapshot always produce the same decisions.

### Phase 4: backtesting

#### Implementation progress

- [x] Step 0A: Phase 2 external acceptance gate completed.
- [x] Step 0B: backtest execution, fill, exit, and end-of-range contracts fixed.
- [x] Step 1: pure backtest wallet, fill, fee, slippage, position, and risk domain.
- [x] Step 2: deterministic historical runner and production strategy integration.
- [x] Step 3: transactional persistence, idempotency, replay events, and portfolio snapshots.
- [x] Step 4: performance metrics, buy-and-hold comparison, application service, API, and results GUI.
- [x] Step 4A: configurable level/edge entry triggers and post-fill candle cooldown.
- [x] Step 4B: position-aware exit selection and selected-lot lifecycle.
- [x] Step 4C: fee-aware per-lot percentage-return exit condition.
- [x] Step 4D: confirmed EMA crossing condition.
- [ ] Step 5: immutable golden acceptance suites implemented; PostgreSQL Phase 4 gate verification pending.

#### Step 0B execution and accounting contract

- A decision for candle `t` is made only after that closed candle and cannot fill
  using its close. An executable intent fills at candle `t+1` open; without a
  next candle it remains unfilled and is recorded as `UNFILLED_AT_END_OF_RANGE`.
- A simulated buy fills at `nextOpen * (1 + slippageRate)` and a simulated sell
  fills at `nextOpen * (1 - slippageRate)`. Fees are calculated from the actual
  fill notional after slippage. A slippage-adjusted simulated market fill need
  not remain inside the source candle's high-low range.
- `amountPerPosition` is the maximum total cash outflow for an entry, including
  its buy fee. Quantity is derived so the fill notional plus fee cannot exceed
  that amount or the available bot cash. All financial arithmetic uses decimal
  values rather than binary floating point.
- Each buy opens one independent position lot. One executable sell decision
  closes every open lot in full at the same execution time, using a separate
  order and fill per lot so fees, profit/loss, and holding time remain auditable.
- Open positions are not force-closed at the end of the requested range. Results
  report realized profit/loss, open-position unrealized profit/loss, and total
  equity separately. A future force-close option must be an explicit immutable
  run setting and produce its own auditable events.
- Backtest, paper, test, and live modes must share position, ledger, risk, and
  execution lifecycle logic; only the execution adapter and its fill policy may
  differ by mode.

#### Step 1 backtest portfolio contract

- The pure portfolio domain has no repository, database, clock, strategy, or
  exchange dependency. Callers supply stable reservation and position identities,
  fill timestamps, the next candle open, and the immutable execution configuration.
- Entry reservations immediately reduce available cash and reject duplicate
  identities or insufficient funds. Filling consumes exactly one reservation;
  releasing it restores availability without changing cash or the ledger-ready
  fill result.
- Entry quantity is derived from the configured maximum total cash outflow after
  accounting for the buy fee. Buy and sell fills apply adverse side-specific
  slippage, calculate fees from actual fill notional, and return explicit cash
  changes for later transactional ledger persistence.
- Every buy creates an independent immutable lot. A sell closes all currently
  open lots in full, produces one fill and realized profit/loss per lot, and
  retains closed lots for audit while keeping total fees and aggregate realized
  profit/loss consistent.
- Mark-to-market snapshots report cash, reservations, available cash, invested
  cost, market value, realized and unrealized profit/loss, total equity, fees,
  and open-position count without changing or force-closing the portfolio.

#### Step 2 historical runner contract

- The pure runner accepts an immutable ordered closed-candle history, execution
  range, validated strategy definition, and execution configuration. Candles
  before the requested range are available only as indicator warm-up; they never
  produce decisions, fills, events, or positions.
- At each candle open the runner executes at most the intent created after the
  preceding evaluated candle. At that candle close it evaluates the production
  strategy against only the prefix ending at that exact candle and the portfolio
  position count after the open fill, then reserves or schedules the next intent.
- BUY decisions that cannot reserve the fee-inclusive position amount remain
  auditable strategy decisions with `INSUFFICIENT_AVAILABLE_CASH`; they do not
  create a position or pending fill. SELL decisions schedule all currently open
  lots for separate full fills at the next evaluated candle open.
- Stable candle-derived reservation and position identities, caller-supplied
  candle timestamps, monotonically increasing in-memory events, and pure
  portfolio transitions make identical inputs deeply reproducible.
- An intent created by the final evaluated candle is recorded as
  `UNFILLED_AT_END_OF_RANGE`. A final BUY reservation is released from the result
  portfolio, and no synthetic candle, fill, position, or forced exit is created.

#### Step 3 transactional persistence contract

- A completed runner result is converted into positions, orders, fills,
  append-only cash-ledger entries, strategy decisions, indicator snapshots,
  replay events, and portfolio snapshots before persistence. Stable UUIDv5 keys
  derived from the run and domain identities make every generated record and
  order idempotency key reproducible.
- Financial values are rounded once at the PostgreSQL `Decimal(38,18)` boundary.
  Any sub-scale accumulation difference is represented by an explicit bounded
  `CORRECTION` ledger entry; a difference larger than rounding can explain is a
  reconciliation error and the result is rejected.
- Persistence locks the backtest run row and writes the complete generated
  record graph plus the `COMPLETED` run transition in one transaction. The bot
  moves from `RUNNING` to `PAUSED` only with that successful commit. A foreign-key,
  validation, or write failure leaves the run and every generated table unchanged.
- Retrying or concurrently persisting an already completed run returns the first
  committed result without inserting duplicate positions, orders, fills,
  decisions, ledger entries, events, or snapshots. A running backtest containing
  any non-allocation partial record set is rejected for explicit reconciliation
  rather than overwritten or silently resumed.
- Runner event sequence numbers and portfolio snapshot sequence numbers remain
  monotonic and run-scoped. Decisions and indicator snapshots retain their
  candle identities and complete explainable strategy output for later replay.

#### Step 4 metrics, application, API, and GUI contract

- The authenticated backtest application service verifies bot ownership and
  `BACKTEST` mode, validates the immutable strategy version and requested range,
  loads closed candles plus the minimum pre-range indicator warm-up, rejects a
  range gap, starts a snapshotted run, executes the pure runner, and persists the
  complete result before returning success.
- Summary calculation reports starting capital, ending cash and equity, net
  profit, return, maximum equity-curve drawdown, closed-lot win rate and profit
  factor, total fees, closed/open position counts, and average closed-lot holding
  time. Runs without losses report an unbounded profit factor as `null`; runs
  without closed trades report zero win rate and no average holding time.
- The buy-and-hold comparison invests the same initial capital at the first
  evaluated candle open using configured adverse buy slippage and buy fee, then
  marks the acquired quantity at the final evaluated candle close without a
  forced sale. Strategy-versus-benchmark is reported in percentage points.
- `POST /api/bots/:id/backtests` accepts ISO `from` and `to` timestamps, applies
  authentication and ownership at the application boundary, returns structured
  validation/not-found/rejection errors, sanitizes unexpected failures, and
  returns the completed metrics, fills, positions, decisions, events, and
  snapshots required by the initial GUI.
- The Bot page lets the user select a backtest bot and date range, displays a
  running/completed state, then shows summary cards, every executed BUY/SELL with
  timestamp, price, quantity and fee, plus the complete decision timeline,
  execution reason, entry/exit match state, and observed RSI, EMA, or candle
  sequence values and thresholds. Interactive chart replay remains Phase 6 scope.

#### Step 4A entry trigger policy contract

- A strategy may optionally define `entryPolicy.trigger` as
  `EVERY_MATCHING_CANDLE` or `ON_FALSE_TO_TRUE` and a non-negative safe-integer
  `cooldownCandles`. Definitions without `entryPolicy` retain the original
  `EVERY_MATCHING_CANDLE` behavior with zero cooldown, preserving every existing
  immutable strategy version and golden fixture.
- `EVERY_MATCHING_CANDLE` allows each matching close to reserve a new lot when
  risk and budget permit. `ON_FALSE_TO_TRUE` allows the first matching close,
  suppresses further entries while the raw entry tree remains true, and rearms
  only after at least one evaluated close where the entry tree is false.
- Cooldown begins when a BUY is actually filled, not when a signal is merely
  produced, reserved, rejected, or suppressed. With `cooldownCandles = N`, the
  fill candle and the next `N - 1` close evaluations cannot reserve another BUY;
  zero disables cooldown. Edge rearming and cooldown must both allow an entry.
- Suppression never rewrites the explainable raw strategy evaluation. It records
  `ENTRY_NOT_REARMED` or `ENTRY_COOLDOWN_ACTIVE` as the execution reason and an
  `ENTRY_SUPPRESSED` replay event, without reserving funds or creating a fill.
- The rule builder exposes both trigger modes and cooldown. New definitions
  default to `ON_FALSE_TO_TRUE` with zero cooldown to avoid accidental repeated
  entries, while loaded legacy definitions visibly retain their level-triggered
  default until a new immutable version is saved.

#### Step 4D confirmed EMA crossing contract

- `EMA_CROSS_CONFIRMATION` requires a positive EMA period, an `ABOVE` or
  `BELOW` direction, and a positive confirmation-candle count. It is available
  in nested entry and exit trees, the JSON Schema, the rule builder, and the
  documented v1 strategy format.
- The close immediately before the confirmation sequence must be on the
  opposite side of, or equal to, its contemporaneous EMA. Every confirmation
  close must then be strictly on the requested new side of its own
  contemporaneous EMA.
- Evaluation requires `period + confirmationCandles` closed candles and uses the
  same bounded trailing window in historical and live execution. This keeps EMA
  seeding deterministic across modes and prevents future candles from entering
  the calculation.
- The Phase 4 application golden fixture exercises the production historical
  runner from a confirmed cross through next-open entry, fee-aware selected-lot
  exit, next-open full-lot close, events, snapshots, and metrics.

#### Step 5 golden acceptance contract

- Committed candle, strategy, execution, and expected-result fixtures form the
  immutable application contract. The production runner and metrics calculator
  must reproduce the complete decisions, fills, positions, events, snapshots,
  decimal accounting, and performance result on every run.
- The PostgreSQL golden gate runs the same scenario with persisted candles and
  compares every generated position, order, fill, non-allocation ledger entry,
  strategy decision, indicator snapshot, replay event, and portfolio snapshot
  with the deterministic persistence plan.
- Two concurrent completion attempts must produce exactly one initial commit and
  one idempotent reuse. The run becomes `COMPLETED`, its bot becomes `PAUSED`,
  event and snapshot sequences remain monotonic, and no duplicate trading record
  may be inserted.
- The Phase 4 gate consists of the normal application suite plus the Prisma
  integration suite against PostgreSQL. Phase 5 must not start unless both gates
  pass for the commit being promoted.

#### Work

- Implement a historical runner using the production strategy and risk logic.
- Add a virtual wallet, multiple independent positions, market-order fill model,
  configured fees, and configured slippage.
- Fill an entry at a documented price, preferably the next candle open plus the
  configured slippage, to avoid look-ahead bias.
- Record all events and portfolio snapshots required by replay.
- Calculate net profit, return, maximum drawdown, win rate, profit factor, fees,
  trade count, holding time, and buy-and-hold comparison.

#### Acceptance criteria

- No look-ahead bias is present.
- Funds never become negative and assigned capital is never exceeded.
- A 55/10 USDC configuration opens at most five simultaneous positions,
  accounting for fees.
- Exits close full positions.
- A fixed golden dataset produces a fixed event and result set.

### Phase 5: paper trading

#### Work

- Create a separately deployed worker.
- Process each closed candle exactly once per bot run.
- Add scheduling/claiming, retries, locks, stale-data detection, and recovery.
- Use real-time market data with simulated fills and the same ledger.
- Add daily order/volume limits, a global kill switch, and failure circuit
  breakers.

#### Acceptance criteria

- A worker restart does not duplicate a decision or order.
- Several bots can process the same shared candle independently.
- Several positions per bot are accounted for correctly.
- Paper runs can operate for an agreed soak period without unexplained ledger or
  position differences.

### Phase 6: replay UI

#### Work

- Extend the candlestick chart with EMA, RSI, entry/exit markers, and positions.
- Add play, pause, speed, step, and timeline controls.
- Display decision reasons, balances, equity, fees, and profit/loss.
- Add layouts suitable for 1920x1080 (16:9) and 1080x1920 (9:16).
- Drive playback from persisted event sequence and virtual replay time.

#### Acceptance criteria

- Reloading the same run produces the same visible sequence.
- A user can inspect why every entry, exit, and hold occurred.
- A replay can be manually recorded in both target aspect ratios.

### Phase 7: Spot test and Spot live

#### Work

- Define an exchange execution port and Binance Spot adapters.
- Respect Binance symbol filters, step size, precision, minimum quantity, and
  minimum notional.
- Generate deterministic client order IDs.
- Persist order intent before submission and reconcile orders, fills, balances,
  and positions afterward.
- Keep a partial-fill placeholder and fail safely into reconciliation when a
  partial fill cannot be completed automatically.
- Enable `SPOT_TEST` first, then a tightly limited `SPOT_LIVE` mode.

#### Acceptance criteria

- Test orders and fills reconcile to local positions and ledger entries.
- Timeout/retry scenarios do not submit duplicate orders.
- Stale data, reconciliation mismatch, or exhausted loss limits stop trading.
- Live mode requires an explicit additional confirmation and conservative
  configurable caps.

### Phase 8: deterministic video rendering

#### Work

- Add a dedicated replay render route with deterministic virtual time.
- Optionally render frames through Chromium/Playwright and compose MP4 output
  with FFmpeg.
- Add summary frames and reusable standard/vertical layouts.

#### Acceptance criteria

- The same run can be rendered repeatedly with the same timing and content.
- Exported files are suitable for standard YouTube videos and Shorts.
- Upload remains manual; automatic YouTube publishing is not implemented.

### Phase 9: Margin trading (deferred)

Margin requires a separate design for isolated versus cross margin, borrowing,
repayment, interest, short positions, margin level, liquidation risk, and
emergency closing. It must not be enabled merely by adding a market-type flag to
the Spot flow.

## Testing strategy

### Unit tests

- RSI and EMA against fixed reference values;
- EMA absolute distance;
- candle color and body-change calculations;
- consecutive-candle conditions;
- nested strategy groups and operators;
- budget reservation, fee, slippage, and ledger arithmetic;
- full-position exits;
- timeframe and lifecycle validation;
- exchange precision and rounding.

### Invariants and property tests

- available virtual USDC never becomes negative;
- allocated capital is never exceeded;
- Spot position quantity never becomes negative;
- one bot/candle/action cannot create duplicate orders;
- only closed candles create decisions;
- ledger totals reconcile to cached balances and portfolio snapshots;
- realized and unrealized profit calculations remain internally consistent.

### Integration tests

- Prisma repositories and transactional reservations;
- candle upsert, cursor, and gap detection;
- bot start/pause/stop and worker recovery;
- concurrent candle claims;
- order accepted, rejected, timed out, canceled, and partially filled;
- exchange reconciliation mismatch;
- replay API event ordering.

### Golden tests

Maintain fixed candle fixtures with expected indicators, decisions, position
changes, ledger entries, events, and final performance metrics. Any intentional
change to these outputs must be reviewed as a strategy/accounting behavior
change, not merely accepted as a snapshot update.

## Operational and security requirements

- Binance keys must remain server-side and encrypted at rest where applicable.
- Live keys should have only the required Spot trading permissions; withdrawal
  permission must be disabled.
- Logs must not contain credentials or signed request secrets.
- Add health checks for worker heartbeat, candle freshness, database access, and
  exchange connectivity.
- Add structured logs and metrics for evaluation latency, ingestion lag, order
  results, reconciliation failures, and bot stops.
- Define retention/archival policies before candle and event volumes become
  large.
- Provide a global kill switch and per-bot pause/stop controls.
- Treat exchange responses as authoritative for actual executed quantity and
  fees, while the application remains authoritative for virtual allocations.

## Initial out-of-scope list

- Margin trading and short selling;
- futures or derivatives;
- pairs not quoted in USDC;
- multiple symbols per bot;
- limit orders;
- advanced partial-fill continuation logic;
- partial position exits;
- user-authored JavaScript strategies;
- automatic YouTube upload;
- machine-learning strategy generation;
- strategy execution based on an unclosed candle.

## Open decisions for later phases

These items do not block Phase 1 but must be resolved before the noted phase:

| Decision | Required by |
| --- | --- |
| Exact initial timeframe allow-list (`15m`, `1h`, `4h`, `1d`) | Resolved in the shared Step 0 contract; enforce in bot and market-data inputs |
| Paper fill price and latency model | Phase 5 |
| Required paper-trading soak duration | Phase 7 |
| Binance test environment/API choice for Spot test | Phase 7 |
| Live-mode maximum budget and daily loss defaults | Phase 7 |
| Candle/event retention and archive policy | Before production growth |

## Task-start checklist

At the start of every bot-related task:

1. Read this document and inspect the current status table.
2. Confirm the task belongs to the earliest unfinished applicable phase.
3. Preserve the requirements and invariants above.
4. Reuse the same domain logic across backtest, paper, test, and live modes.
5. Add or update automated tests and golden fixtures for behavior changes.
6. Update this document's phase status and decision log when implementation
   state or an agreed decision changes.
7. Do not enable a later execution mode before its predecessor meets acceptance
   criteria.

## Decision log

| Date | Decision |
| --- | --- |
| 2026-08-08 | One bot watches one `*USDC` pair and uses app-managed virtual USDC allocation. |
| 2026-08-08 | Multiple independent positions are allowed up to the assigned budget. |
| 2026-08-08 | Decisions use only closed candles and a configurable timeframe. |
| 2026-08-08 | Initial execution is Spot market orders; exits close full positions. |
| 2026-08-08 | Strategies are versioned JSON edited through a GUI; user JavaScript is excluded. |
| 2026-08-08 | RSI, EMA, and candle-sequence conditions are configurable. |
| 2026-08-08 | Fees and slippage are configurable in all execution modes. |
| 2026-08-08 | Delivery order is Backtest, Paper test, Spot test, then Spot live. |
| 2026-08-08 | Basic replay is required; automatic YouTube upload is excluded. |
| 2026-08-08 | Phase 2 starts with a Phase 1 verification gate, then delivers cursor-backed REST backfill, gap repair, and a standalone overlap poller in that order. |
| 2026-08-08 | The initial live candle source is a resilient scheduled REST poller; WebSocket ingestion may be added later behind the same port. |
| 2026-08-09 | Historical backfill uses a centralized rolling default of 15,000 closed candles for every timeframe, ending at the interval boundary at or before now; explicit range overrides remain supported. |
| 2026-08-09 | The Phase 1 automated integration suite and the Phase 2 Step 0 gate were verified against a real PostgreSQL database; Phase 1 is complete. |
| 2026-08-09 | Phase 2 Step 3 historical backfill and gap repair were verified with live Binance data and PostgreSQL, including rolling ranges, pre-listing history, resumable batches, and cursor advancement. |
| 2026-08-09 | Phase 2 Step 4 resilient closed-candle polling was completed with active-bot plus configured subscription discovery, bounded overlap catch-up, PostgreSQL advisory leases, interval-boundary scheduling, per-subscription backoff, restart-safe cursor handling, standalone one-shot/continuous execution, and deterministic plus Prisma integration coverage. |
| 2026-08-11 | Phase 2 Step 5 uses structured one-shot outcomes as the initial single-maintainer health check; dedicated metrics backends, dashboards, alerts, HTTP probes, and persistent metric history are deferred until the project has multiple maintainers/users or unattended availability requirements. |
| 2026-08-14 | The v1 EMA rule requires a strict `ABOVE` or `BELOW` close position; equality matches neither. Its optional `maximumDistancePct` is expressed as a percentage from 0 to 100 with at most one decimal place. |
| 2026-08-14 | Phase 3 is complete after its golden gate verified independently calculated RSI/EMA prefix series, deterministic position-aware decisions, schema rejection, and look-ahead protection against immutable fixtures. |
| 2026-08-15 | Phase 2 is complete after the Prisma integration suite and Binance/PostgreSQL smoke test verified duplicate-free closed-candle ingestion, gap repair, restart-safe continuation, and safe repeated interval processing. |
| 2026-08-15 | Backtest decisions made after candle `t` fill at candle `t+1` open; buy/sell slippage worsens the fill in its respective direction, fees use actual fill notional, and an intent without a next candle remains unfilled. |
| 2026-08-15 | Backtest entries cap total cash outflow, including buy fees, at `amountPerPosition`; one buy opens one independent lot and one sell signal closes every open lot in full through separate orders and fills. |
| 2026-08-15 | Backtests do not force-close positions at the range end and report realized profit/loss, unrealized profit/loss, and total equity separately. |
| 2026-08-15 | Phase 4 Step 1 uses a pure decimal portfolio domain with cash reservations, adverse side-specific fills, fee-inclusive entry caps, independent position lots, full-lot exits, and immutable mark-to-market transitions. |
| 2026-08-15 | Phase 4 Step 2 runs the production strategy on closed-candle prefixes after applying only the preceding intent at the current open; pre-range candles are warm-up only and final intents never fill beyond the requested range. |
| 2026-08-15 | Phase 4 Step 3 persists the complete backtest record graph under a run-row lock and one transaction with deterministic identities, bounded decimal-scale ledger correction, idempotent completion, and rollback on any partial failure. |
| 2026-08-15 | Phase 4 Step 4 exposes owned synchronous backtest execution through the API and Bot GUI with deterministic performance metrics, a fee/slippage-aware buy-and-hold benchmark, executed fill history, and decision reasons. |
| 2026-08-15 | Backtest decision rows render the already persisted condition trees and observed indicator values, including RSI period, value, operator, and threshold, so HOLD and warm-up outcomes are diagnosable without reading raw JSON. |
| 2026-08-15 | Entry execution supports backward-compatible `EVERY_MATCHING_CANDLE`, episode-based `ON_FALSE_TO_TRUE`, and an optional post-fill candle cooldown; new GUI definitions default to episode-based triggering. |
| 2026-08-21 | Phase 4 Step 4D is closed after auditing confirmed EMA crossing across validation, schema, GUI, documentation, live/backtest bounded history, and production-runner coverage. A committed application golden fixture now fixes the complete deterministic result and metrics; Step 5 remains open for the PostgreSQL persistence gate. |
| 2026-08-21 | The Phase 4 PostgreSQL golden gate is implemented against the immutable application fixture and covers the complete persisted record graph, atomic completion, monotonic replay sequences, and concurrent idempotent reuse; Phase 4 remains open until that gate passes in the target PostgreSQL environment. |
