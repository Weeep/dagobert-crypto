# Redis to PostgreSQL mapping

This document records the relational model and the Redis export migration. The
runtime repositories remain backed by Redis until the application cutover.

## Source inventory

Run the read-only audit before preparing an import:

```bash
npm run audit-kv-db
# An alternative dump can be supplied as the first argument:
npm run audit-kv-db -- path/to/export.json
```

For the committed `vercel_kv_export.json`, the audit currently finds 1 user,
24 configured pairs, 1,055 transactions, 276 transaction groups, and 52 import
cursors. Plaintext credentials are expected in the legacy export. References
to symbols absent from `pairs` identify records for deleted pairs and are
deliberately filtered by the PostgreSQL importer.

The audit never connects to Redis or PostgreSQL and never prints password
values. It only reads the selected JSON file.

## Field mapping

| Redis source | PostgreSQL model | Mapping notes |
| --- | --- | --- |
| `users[email] = password` | `User` | `email` remains unique. The plaintext value must never be copied to `passwordHash`. |
| `pairs[symbol]` | `Pair` | `pair` becomes the primary key `symbol`; `decimals` is an integer and `keyLevels` is a PostgreSQL decimal array. |
| `dtransactions[orderId]` | `Transaction` | `orderId` is the global primary key. Monetary and quantity values use `Decimal(38,18)`; epoch and Binance IDs use `BigInt`. |
| `dtransactionGroups[groupId]` | `TransactionGroup` | `groupId` becomes UUID `id`. Embedded `groupedTrans` objects are not duplicated; they become the `Transaction.transactionGroupId` relation. |
| `last_transaction_epoch_<tradeType>_<pair>` | `ImportCursor` | The key is split into `tradeType` and `pairSymbol`; together they form the primary key. |

Empty or missing legacy `note` values should become `""`. Empty or missing
`otherSideOrderId` values should become `NULL`. ISO `date` is authoritative for
the PostgreSQL timestamp; `dateEpoch` is retained for compatibility and must be
checked against it during import.

## Relations and compatibility fields

- `Pair` is referenced by transactions, groups, and import cursors. The import
  cannot enable these foreign keys until every referenced symbol exists.
- A transaction can belong to at most one transaction group. Group membership
  is stored on `Transaction.transactionGroupId` rather than as embedded JSON.
- The legacy `Transaction.grouped` flag is retained for the first migration so
  existing domain behavior is unchanged. The importer must set it consistently
  with `transactionGroupId`; it can be removed in a later cleanup.
- `otherSideOrderId` is retained as an optional string. Current values resemble
  Binance order IDs and cannot safely be treated as a self-reference to the
  globally unique Dagobert `orderId`.
- `binanceApiId` is not unique because legacy records use `-1` as a sentinel.

## Enum mapping

The schema constrains values observed in the dump and represented by the
domain:

- `TradeType`: `spot`, `margin`
- `TradeStyle`: `day`, `swing`, `hodling`, `trash`
- `OrderSide`: `BUY`, `SELL`
- `OrderStatus`: `FILLED`, `CANCELED`, `NEW`

The audit must be extended alongside the Prisma enum before a new external
value is imported.

## Password migration policy

The future importer must hash every Redis plaintext password before any user is
inserted. Use Node's built-in `crypto.scrypt` with a random 16-byte salt,
`N=32768`, `r=8`, `p=1`, and a 64-byte derived key. Store a versioned encoded
value containing the algorithm, parameters, salt, and derived key, for example:

```text
scrypt$v=1$N=32768$r=8$p=1$<base64-salt>$<base64-derived-key>
```

The scrypt call must set `maxmem` to at least 64 MiB so the selected work factor
has explicit memory headroom.

Authentication must be updated to verify this format before the runtime is
switched to the Prisma user repository. Passwords and hashes must never appear
in audit output or migration logs.

## Import and validation

1. Take and retain an immutable Redis export and run `npm run audit-kv-db`.
2. Resolve any multiple-group memberships reported by the audit. The importer
   refuses to choose one silently.
3. Configure `DATABASE_URL`, apply the Prisma migration, and run:

   ```bash
   npm run import-kv-db
   npm run import-kv-db -- path/to/export.json
   ```

   The atomic import replaces the migration-owned tables. It hashes every
   password and skips transactions, groups, and import cursors for symbols not
   present in the export's `pairs` hash. Thus no trace of deleted pairs is
   inserted into PostgreSQL. If a retained-pair transaction was embedded in a
   skipped group, its legacy `grouped` flag remains true so the completed trade
   does not incorrectly reappear as open, while its `transactionGroupId` is
   `NULL` because the deleted-pair group itself is not retained.
4. Validate the result against the same immutable export:

   ```bash
   npm run validate-kv-import
   npm run validate-kv-import -- path/to/export.json
   ```

   The validator reconstructs the filtered source view, compares every field,
   relationship, cursor, and skipped-row count, and verifies each scrypt hash
   against the legacy password without logging either value.
5. Only after repository contract tests pass should the server composition
   root be changed from KV repositories to Prisma repositories.

## Temporary visual comparison switch

The authenticated application's header contains an `Adatforrás` switch. Its
selection is stored in browser local storage; changing it reloads the page and
routes all subsequent GET requests to either Redis or PostgreSQL. PostgreSQL is
read-only in this comparison mode. All PUT and DELETE requests continue to use
Redis regardless of the selected read source, so the switch cannot modify the
migrated snapshot accidentally.

The Prisma adapters live beside the corresponding KV and HTTP adapters in each
module's `infrastructure/prisma` directory. The authentication adapter is not
switched yet: PostgreSQL stores password hashes, while the current login port
still expects a directly comparable credential. That contract must be changed
to password verification before adding `PrismaUserCredentialRepository`.
