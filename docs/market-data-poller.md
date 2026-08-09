# Market-data closed-candle poller

The market-data poller is a standalone Node.js process. It does not run inside
Next.js and does not expose an ingestion HTTP endpoint. It discovers the unique
`(symbol, interval)` subscriptions of running, non-backtest bots and merges
them with an optional rollout list.

Supported intervals are `15m`, `1h`, `4h`, and `1d`; the initial exchange
source is Binance and symbols must be USDC pairs.

## Behavior

For each subscription the service:

1. acquires a PostgreSQL advisory lease for `source/symbol/interval`;
2. reads the persisted ingestion cursor and Binance server time;
3. requests an overlap starting one candle before the cursor;
4. upserts only closed candles and runs the existing gap-repair service;
5. advances the cursor only across verified contiguous stored candles;
6. records an error without advancing the cursor when polling fails.

Catch-up is limited to at most one Binance page (1,000 candles by default) per
poll. If a cursor is older, the worker immediately schedules another bounded
poll and resumes from the newly persisted cursor. This prevents a stale cursor
from creating one unbounded in-memory response or database transaction.

Concurrent process instances are safe: only one instance obtains the advisory
lease for a subscription, while duplicate fetches remain harmless because
candle storage is an idempotent upsert.

## Prerequisites

Set `DATABASE_URL` and apply the Prisma migrations. The Binance adapter uses the
existing application Binance client configuration. No API key is required for
public server-time and kline endpoints unless the deployment configures the
client otherwise.

Run a historical backfill before rollout when a full history is required:

```bash
npm run market-data:backfill -- \
  --symbol BTCUSDC \
  --interval 1h
```

Without an existing cursor the poller intentionally bootstraps only the latest
closed interval; it does not silently start a 15,000-candle import.

## One-time execution

Use `--once` for deployment checks, diagnostics, cron-style execution, or a
single bounded catch-up step:

```bash
npm run market-data:poll -- --once
```

The command discovers subscriptions from running non-backtest bots. An
explicit rollout set can be added even when no matching bot is running:

```bash
npm run market-data:poll -- \
  --once \
  --subscriptions BTCUSDC:15m,ETHUSDC:1h \
  --max-candles-per-poll 250
```

The final machine-readable result is written to stdout:

```json
{"status":"completed","outcomes":[{"subscription":{"pairSymbol":"BTCUSDC","interval":"15m"},"consecutiveFailures":0,"nextRunAt":"2026-08-09T12:15:05.000Z"}]}
```

An individual subscription error is included in its outcome. The one-shot
process still checks all discovered subscriptions rather than stopping on the
first exchange failure.

## Continuous worker

Omit `--once` to run continuously:

```bash
npm run market-data:poll -- \
  --subscriptions BTCUSDC:15m,ETHUSDC:1h \
  --close-grace-ms 5000
```

After a successful up-to-date poll, the next execution is aligned to the next
interval boundary plus the close grace period. A stale cursor with more work is
scheduled immediately. Failures use bounded exponential backoff independently
per subscription; success resets that subscription's failure counter.

Continuous mode writes one structured JSON event per outcome to stderr. Send
`SIGTERM` or `SIGINT` to abort waits and in-flight Binance requests, then close
the Prisma connection cleanly.

## Configuration

Every CLI value also has an environment-variable equivalent:

| CLI option | Environment variable | Default | Purpose |
| --- | --- | ---: | --- |
| `--once` | `MARKET_DATA_ONCE=true` | false | Run each discovered subscription once and exit. |
| `--subscriptions` | `MARKET_DATA_SUBSCRIPTIONS` | empty | Comma-separated `SYMBOL:interval` rollout set. |
| `--close-grace-ms` | `MARKET_DATA_CLOSE_GRACE_MS` | 5000 | Delay after an interval boundary. |
| `--base-backoff-ms` | `MARKET_DATA_BASE_BACKOFF_MS` | 1000 | First retry delay. |
| `--max-backoff-ms` | `MARKET_DATA_MAX_BACKOFF_MS` | 60000 | Retry-delay ceiling. |
| `--discovery-interval-ms` | `MARKET_DATA_DISCOVERY_INTERVAL_MS` | 60000 | Maximum delay before bot subscriptions are rediscovered. |
| `--max-candles-per-poll` | `MARKET_DATA_MAX_CANDLES_PER_POLL` | 1000 | Bounded catch-up batch, from 2 through 1000. |
| `--lease-timeout-ms` | `MARKET_DATA_LEASE_TIMEOUT_MS` | 900000 | Maximum advisory-lock transaction lifetime. |

Example environment configuration:

```dotenv
DATABASE_URL=postgresql://dagobert:secret@postgres:5432/dagobert
MARKET_DATA_SUBSCRIPTIONS=BTCUSDC:15m,ETHUSDC:1h
MARKET_DATA_CLOSE_GRACE_MS=5000
MARKET_DATA_BASE_BACKOFF_MS=1000
MARKET_DATA_MAX_BACKOFF_MS=60000
MARKET_DATA_MAX_CANDLES_PER_POLL=500
MARKET_DATA_LEASE_TIMEOUT_MS=900000
```

The lease timeout must be longer than the maximum expected bounded poll. It is
configurable so the advisory lock covers the entire callback instead of
expiring at the previous fixed 60-second limit.

## Recommended rollout checks

1. Backfill a small explicit range and inspect its cursor.
2. Run the poller once for one explicit subscription.
3. Verify there are no duplicate `(pair_symbol, interval, open_time)` rows.
4. Verify no open candles were persisted.
5. Start two workers with the same subscription and confirm one skips the
   advisory lease while the other completes.
6. Stop and restart the worker, then verify it resumes from the stored cursor
   with a one-candle overlap.

