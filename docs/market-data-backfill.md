# Market-data historical backfill

The `market-data:backfill` command is a standalone, operator-facing one-shot
process for importing Binance closed candles, detecting gaps in an existing
range, repairing those gaps, and advancing the persisted ingestion cursor only
across verified contiguous data. It does not run inside Next.js and does not
expose an ingestion HTTP endpoint.

Use the backfill before starting the continuous
[`market-data:poll`](./market-data-poller.md) worker when strategies require
historical candles, or run it later to inspect and repair a suspected gap.

## Required and optional input

The command requires:

- `DATABASE_URL` in the environment or `.env.local`;
- `--symbol`, containing a Binance USDC pair such as `BTCUSDC`;
- `--interval`, containing one of `15m`, `1h`, `4h`, or `1d`.

Minimal invocation:

```bash
npm run market-data:backfill -- --symbol BTCUSDC --interval 1h
```

All remaining parameters are optional:

| CLI option | Required | Default | Purpose |
| --- | --- | --- | --- |
| `--symbol` | yes | none | USDC pair to import; input is normalized to uppercase. |
| `--interval` | yes | none | Candle interval: `15m`, `1h`, `4h`, or `1d`. |
| `--start` | no | derived | Inclusive ISO-8601 range start, aligned to the interval boundary. |
| `--end` | no | current time | Exclusive ISO-8601 requested range end. Only intervals closed before the aligned effective end are eligible. |
| `--page-size` | no | 1000 | Binance/persistence page size from 1 through 1000. |
| `--max-pages` | no | enough for the 15,000-candle default | Maximum non-empty persistence pages processed by this invocation. |
| `--dry-run` | no | false | Detect and report gaps without fetching, writing candles, or advancing the cursor. |

Both `--name value` and `--name=value` forms are accepted. For example,
`--page-size 250` and `--page-size=250` are equivalent.

## Default range

When neither `--start` nor `--end` is supplied, the command:

1. uses the current time as the requested end;
2. aligns the effective end down to the selected interval boundary so the
   current open candle is excluded;
3. derives a start containing exactly 15,000 closed intervals;
4. derives a default page budget large enough to process those 15,000 candles.

Example:

```bash
npm run market-data:backfill -- --symbol BTCUSDC --interval 15m
```

This does not mean that exactly 15,000 new rows are always inserted. Existing
candles are retained, detected gaps alone are fetched, and matching candle
identities are idempotently upserted.

For the default derived range, time before the symbol's first Binance candle is
reported as `unavailableLeadingRange`, not as a repairable gap. For example, a
recently listed pair may legitimately have far fewer than 15,000 available
candles.

## Explicit ranges

Use an explicit range for a controlled import or repair:

```bash
npm run market-data:backfill -- \
  --symbol ETHUSDC \
  --interval 1h \
  --start 2026-07-01T00:00:00.000Z \
  --end 2026-08-01T00:00:00.000Z
```

Range semantics are `[start, end)`:

- `start` is inclusive and must be exactly aligned to the selected interval;
- `end` is exclusive;
- if `end` is not aligned, the effective end is rounded down;
- candles that are still open according to corrected Binance server time are
  never persisted.

Unlike the default range, history missing at the beginning of an explicit
range remains a strict gap. This makes explicit ranges appropriate for
verifying that a known historical period is complete.

## Dry-run gap inspection

Use `--dry-run` to inspect the database without calling Binance for candle
pages and without modifying candles or cursors:

```bash
npm run market-data:backfill -- \
  --symbol BTCUSDC \
  --interval 4h \
  --start 2026-01-01T00:00:00.000Z \
  --end 2026-08-01T00:00:00.000Z \
  --dry-run
```

The JSON result reports every contiguous missing range and its expected candle
count. A dry run always reports `status: "dry-run"` and never advances the
cursor.

## Bounded and resumable imports

Use `--page-size` and `--max-pages` to cap a single invocation:

```bash
npm run market-data:backfill -- \
  --symbol BTCUSDC \
  --interval 15m \
  --start 2025-01-01T00:00:00.000Z \
  --end 2026-01-01T00:00:00.000Z \
  --page-size 500 \
  --max-pages 2
```

If work remains, the result has:

```json
{
  "status": "partial",
  "hasMoreWork": true,
  "resumeFrom": "2025-01-07T22:40:00.000Z"
}
```

Rerun the same command to resume safely. Already stored rows are not duplicated,
and only remaining gaps are requested. `resumeFrom` is informational; the
recommended retry is the same original command so the service can re-verify the
entire requested range before advancing the cursor.

Empty Binance pages before a symbol's listing do not consume `--max-pages`.
They are protected by a separate internal hard limit so unavailable early
history cannot make the process unbounded.

## Output and log routing

The command separates machine-readable output from progress:

- **stdout** receives one final formatted JSON summary;
- **stderr** receives newline-delimited structured page progress and fatal
  errors.

Example with separate files:

```bash
npm run market-data:backfill -- \
  --symbol BTCUSDC \
  --interval 1h \
  > /var/log/dagobert/backfill-BTCUSDC-1h-result.json \
  2> /var/log/dagobert/backfill-BTCUSDC-1h-progress.jsonl
```

During a large import, follow progress with:

```bash
tail -f /var/log/dagobert/backfill-BTCUSDC-1h-progress.jsonl
```

The summary contains the requested/effective range, existing and expected
candle counts, detected and remaining gaps, repaired candles, unavailable
leading history, fetched/saved page totals, last contiguous open time, cursor
advancement, and resumability fields.

Representative completed result:

```json
{
  "status": "completed",
  "source": "BINANCE",
  "pairSymbol": "BTCUSDC",
  "interval": "1h",
  "dryRun": false,
  "missingCandlesDetected": 12,
  "missingCandlesRemaining": 0,
  "repairedCandles": 12,
  "pagesFetched": 1,
  "candlesFetched": 12,
  "candlesSaved": 12,
  "cursorAdvanced": true,
  "hasMoreWork": false,
  "resumeFrom": null
}
```

## Background and scheduled execution

Backfill is deliberately a finite one-shot operator command, not a continuously
running worker. Prefer an interactive operator run, deployment Job, Kubernetes
Job, or a `systemd` oneshot service. Use the continuous market-data poller for
normal ongoing ingestion.

For a scheduled audit/repair, a systemd timer or Kubernetes CronJob is preferable
to an unmanaged `nohup` process. Keep stdout and stderr in the platform's normal
log collector, or redirect them separately as shown above. Always retain the
final stdout summary because it records whether work completed or must resume.

Example Kubernetes Job command:

```yaml
command: ["npm", "run", "market-data:backfill", "--"]
args: ["--symbol", "BTCUSDC", "--interval", "1h", "--max-pages", "2"]
```

If a scheduler repeatedly receives `status: "partial"`, allow subsequent runs
to reuse the same range until `hasMoreWork` becomes `false`. Do not schedule
overlapping backfill processes for the same subscription; the historical
backfill command itself is idempotent but does not acquire the poller's advisory
lease.

## Validation and failure behavior

The command exits non-zero for invalid configuration, Binance failures,
persistence failures, or cancellation. Common validation errors include:

- missing `--symbol` or `--interval`;
- a non-USDC symbol;
- an unsupported interval;
- an invalid ISO-8601 date;
- a start not aligned to the interval boundary;
- `start >= end` or a range containing no closed interval;
- `--page-size` outside 1 through 1000;
- a non-positive `--max-pages`.

Binance retry, rate-limit, timeout, response-ordering, and closed-candle rules
are enforced by the shared REST adapter. A failed page does not falsely advance
the cursor. Rerunning the same command is the normal recovery procedure.

## Recommended rollout checks

1. Run an explicit small range with `--dry-run` and inspect the gaps.
2. Run the same range without `--dry-run`.
3. Confirm the result is `completed`, `missingCandlesRemaining` is zero, and
   `cursorAdvanced` has the expected value.
4. Rerun it and confirm that no duplicate rows are created and no missing pages
   are fetched.
5. Delete one test candle, rerun the command, and confirm exactly that gap is
   repaired.
6. Query the database for duplicate identities and accidentally stored open
   candles before starting the continuous poller.

