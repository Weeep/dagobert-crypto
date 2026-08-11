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

Set `DATABASE_URL` in the process environment, `.env.local`, or `.env`, and apply
the Prisma migrations. When both files define a value, `.env.local` takes
precedence. The Binance adapter uses the
existing application Binance client configuration. No API key is required for
public server-time and kline endpoints unless the deployment configures the
client otherwise.

### Required and optional input

`DATABASE_URL` is the only mandatory poller configuration. All CLI options,
including `--subscriptions`, are optional.

When `--subscriptions` / `MARKET_DATA_SUBSCRIPTIONS` is omitted, the service
queries PostgreSQL and polls every unique `(pairSymbol, timeframe)` required by
a bot whose status is `RUNNING` and whose mode is not `BACKTEST`. Draft,
paused, stopped, errored, and backtest bots do not create subscriptions.

For example, if the database contains these bots:

| Pair | Timeframe | Status | Mode | Polled? |
| --- | --- | --- | --- | --- |
| `BTCUSDC` | `15m` | `RUNNING` | `PAPER` | yes |
| `BTCUSDC` | `15m` | `RUNNING` | `SPOT_TEST` | yes, but deduplicated with the previous row |
| `ETHUSDC` | `1h` | `RUNNING` | `BACKTEST` | no |
| `SOLUSDC` | `4h` | `PAUSED` | `SPOT_LIVE` | no |

then an invocation without `--subscriptions` fetches only `BTCUSDC:15m`.

The explicit subscription option is intended for controlled rollout,
diagnostics, or preloading data before a bot is started:

```bash
npm run market-data:poll -- --once --subscriptions ETHUSDC:1h,SOLUSDC:4h
```

Explicit subscriptions are **added to**, rather than substituted for, the
subscriptions discovered from running non-backtest bots. Duplicate entries are
normalized and fetched only once. Consequently, the example above also polls
any subscriptions currently required by eligible bots. To run only an explicit
set, use a database/environment where no eligible bot is running.

If neither eligible bots nor explicit subscriptions exist, one-shot mode
returns an empty `outcomes` array and continuous mode remains alive, periodically
checking the database for newly started bots.

Run a historical backfill before rollout when a full history is required:

```bash
npm run market-data:backfill -- \
  --symbol BTCUSDC \
  --interval 1h
```

See the [historical backfill guide](./market-data-backfill.md) for mandatory
parameters, explicit ranges, dry-run, bounded resume, output, and deployment
examples.

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

### Recommended background deployment

Run the poller as a supervised, restartable service, separately from the
Next.js process. Prefer the deployment platform already used by the project:

- a dedicated Docker Compose service with `restart: unless-stopped`;
- a Kubernetes Deployment with one or more replicas;
- or a `systemd` service on a single virtual machine.

Multiple replicas are supported because subscription work is protected by the
PostgreSQL advisory lease. Start with one replica; add another only when failover
or subscription throughput requires it.

Example `systemd` unit:

```ini
[Unit]
Description=Dagobert market-data poller
After=network-online.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/srv/dagobert
EnvironmentFile=/srv/dagobert/.env.local
ExecStart=/usr/bin/npm run market-data:poll
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
KillSignal=SIGTERM
User=dagobert
Group=dagobert

[Install]
WantedBy=multi-user.target
```

Enable and inspect it with:

```bash
sudo systemctl enable --now dagobert-market-data-poller
sudo journalctl -u dagobert-market-data-poller -f
```

For Docker or Kubernetes, keep the process in the foreground and let the
container runtime supervise it; do not start it with `nohup`, `&`, PM2, or an
in-container init system unless that is already the platform convention.

### Log routing

In continuous mode each per-subscription structured outcome and each fatal
process error is written to **stderr**. The recommended destinations are:

- `journald` for `systemd`, queried with `journalctl` as shown above;
- the container's standard log stream for Docker, collected with
  `docker logs` or the configured logging driver;
- the pod log stream for Kubernetes, collected by the cluster's existing log
  agent.

Do not redirect worker logs to `/dev/null`. If a plain host without `systemd` is
unavoidable, redirect stderr to a dedicated file managed by `logrotate`:

```bash
npm run market-data:poll 2>>/var/log/dagobert/market-data-poller.jsonl
```

One-shot mode is different: its final machine-readable summary goes to
**stdout**, while fatal errors go to **stderr**. This allows cron or deployment
automation to archive the result and the errors separately:

```bash
npm run market-data:poll -- --once \
  > /var/log/dagobert/market-data-poll-once.json \
  2> /var/log/dagobert/market-data-poll-once.err
```

Step 5 observability can later route the same structured events to the project's
central log and metrics backend without changing the worker invocation.

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
| `--max-cursor-lag-intervals` | `MARKET_DATA_MAX_CURSOR_LAG_INTERVALS` | 1 | Maximum tolerated lag, measured in subscription intervals. |
| `--max-clock-offset-ms` | `MARKET_DATA_MAX_CLOCK_OFFSET_MS` | 5000 | Maximum tolerated absolute Binance/local clock offset. |

Example environment configuration:

```dotenv
DATABASE_URL=postgresql://dagobert:secret@postgres:5432/dagobert
MARKET_DATA_SUBSCRIPTIONS=BTCUSDC:15m,ETHUSDC:1h
MARKET_DATA_CLOSE_GRACE_MS=5000
MARKET_DATA_BASE_BACKOFF_MS=1000
MARKET_DATA_MAX_BACKOFF_MS=60000
MARKET_DATA_MAX_CANDLES_PER_POLL=500
MARKET_DATA_LEASE_TIMEOUT_MS=900000
MARKET_DATA_MAX_CURSOR_LAG_INTERVALS=1
MARKET_DATA_MAX_CLOCK_OFFSET_MS=5000
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

## Single-maintainer operations checklist

This hobby deployment deliberately uses the structured one-shot outcome as its
health check instead of running a separate metrics or health HTTP service. Each
outcome reports cursor lag, detected/repaired/remaining candles, clock offset,
consecutive failures, and `health` with machine-readable `reasons`. A cursor is
stale after the configured number of complete subscription intervals; excessive
absolute clock offset also makes the outcome unhealthy.

1. **Initial startup:** run the historical backfill for every required
   subscription, then run `npm run market-data:poll -- --once --subscriptions
   BTCUSDC:1h`. Confirm `health` is `healthy` before starting continuous mode.
2. **Normal startup:** run `npm run market-data:poll` under the process supervisor
   described above and retain stderr JSON logs.
3. **Restart:** send `SIGTERM`, wait for a clean exit, restart the same command,
   and confirm the next outcome overlaps the stored cursor without duplicates.
4. **Gap repair:** run a bounded explicit backfill over the affected range, then
   repeat one-shot polling and confirm `missingCandlesRemaining` is zero.
5. **Cursor recovery:** never move a cursor forward manually. Inspect it with the
   query below, repair the missing range, and let verified continuity advance it.

Run these PostgreSQL audits after initial rollout, repair, or cursor recovery:

```sql
-- The unique constraint should make this return no rows.
SELECT pair_symbol, interval, open_time, COUNT(*)
FROM candles
GROUP BY pair_symbol, interval, open_time
HAVING COUNT(*) > 1;

-- Closed-candle ingestion should make this return no rows.
SELECT pair_symbol, interval, open_time
FROM candles
WHERE is_closed = false;

-- Inspect persisted restart and health state.
SELECT source, pair_symbol, interval, last_closed_open_time,
       last_successful_poll_at, clock_offset_ms, status, last_error
FROM candle_ingestion_cursors
ORDER BY pair_symbol, interval;
```

For a single-user, single-maintainer deployment, dashboards, alerting, a
Prometheus/OpenTelemetry backend, HTTP liveness/readiness endpoints, and
persistent metric history are deferred. Add them before multiple maintainers or
independent users rely on unattended availability.
