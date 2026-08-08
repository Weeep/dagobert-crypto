# Trading Bot Feature Plan

## Document purpose

This document is the implementation roadmap and development status reference for
the Dagobert trading bot feature. It is intended to be read at the beginning of
each new task so that implementation decisions remain consistent across tasks.

The initial product requirements have been agreed. Implementation has not
started yet. As work progresses, update the status tables, decision log, and
relevant milestone acceptance criteria in this document in the same change set
as the implementation.

## Current status

| Phase | Status | Outcome |
| --- | --- | --- |
| Phase 0: requirements | Complete | Initial product scope and constraints are agreed below. |
| Phase 1: domain and persistence | Not started | Bot configurations and immutable run snapshots can be stored. |
| Phase 2: market data | Not started | Historical and closed live candles are persisted reliably. |
| Phase 3: strategy engine | Not started | Versioned JSON strategies produce reproducible decisions. |
| Phase 4: backtesting | Not started | Strategies can be tested using historical candles. |
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
   cannot exceed the bot's assigned budget.

The baseline budget invariant is:

```text
availableBudget = assignedBudget - reservedBudget - investedCost
availableBudget >= 0
```

Fees must be included when deciding whether another position can be opened. A
configuration must therefore be rejected, or an entry skipped, when the
position amount plus estimated fees exceeds the available budget.

### Market and execution rules

1. Only fully closed candles may produce a trading decision.
2. The timeframe is configurable. The initial supported set should be explicit,
   for example `1h`, `4h`, and `1d`, and can be expanded later.
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
5. EMA periods and distance thresholds are configurable.
6. The initial EMA proximity calculation uses absolute distance:

   ```text
   abs(close - EMA(period)) / EMA(period) <= configuredDistance
   ```

   For a two-percent threshold, `configuredDistance` is `0.02`.
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
            "operator": "ABS_LTE",
            "value": 0.02
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
release, buy cost, sell proceeds, fee, and correction. A cached balance may be
maintained, but it must reconcile to the ledger.

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

#### Work

- Add bot, strategy, run, position, order, fill, ledger, decision, event, candle,
  and snapshot models with migrations.
- Add domain entities, repository contracts, Prisma adapters, DTOs, and use
  cases following the repository's feature-first module structure.
- Add bot create, update, list, detail, start, pause, and stop APIs.
- Validate `*USDC`, positive budgets, position amount plus fees, timeframe,
  strategy version, and mode transitions.
- Add transactional virtual-budget reservation and release operations.

#### Acceptance criteria

- A valid draft bot can be created and retrieved.
- Invalid pairs and budget configurations are rejected.
- Multiple positions can reserve capital without exceeding assigned USDC.
- Starting a bot creates immutable configuration and strategy snapshots.
- Lifecycle operations are idempotent and covered by unit/integration tests.

### Phase 2: market-data persistence

#### Work

- Add historical candle backfill from Binance REST.
- Add closed-candle ingestion from Binance WebSocket or a resilient scheduled
  poller.
- Upsert candles and detect duplicates and gaps.
- Validate OHLC relationships, timestamps, interval, and closed status.
- Track ingestion cursors and exchange/server clock drift.

#### Acceptance criteria

- Re-running an import creates no duplicate candles.
- Gaps are detected and can be backfilled.
- Only closed candles are eligible for strategy processing.
- Restarting ingestion resumes from persisted state.

### Phase 3: indicator and strategy engine

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
| Exact initial timeframe allow-list | Phase 1 |
| Whether an exit signal closes all open positions in one aggregate order or separate orders | Phase 4 |
| Backtest market-fill timing and slippage formula | Phase 4 |
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

