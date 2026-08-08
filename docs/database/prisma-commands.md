# Prisma commands by environment

Prisma reads the PostgreSQL connection string from `DATABASE_URL`. Always use a
dedicated development database locally and a protected secret in production.

## Development

Install dependencies, validate the schema, and apply or create development
migrations:

```bash
npm ci
npm run prisma:validate
npm run prisma:migrate
```

`npm run prisma:migrate` runs `prisma migrate dev`. When creating a migration
for a new schema change, give it a descriptive name:

```bash
npm run prisma:migrate -- --name describe_the_change
```

For the trading-bot schema in this repository the migration is already
committed as `20260808120000_add_trading_bot_models`. To introduce it into an
existing development database, do not create another migration; apply the
committed one and regenerate the client:

```bash
npm ci
npm run prisma:migrate
npm run prisma:generate
```

`migrate dev` also triggers Prisma Client generation in the normal Prisma
workflow, so running `generate` first is not required. Keeping the explicit
`prisma:generate` step afterward is harmless and makes the generated-client
step visible and repeatable. When authoring a future schema change, run
`migrate dev --name ...` first and then commit both the schema and generated
migration; run `generate` explicitly afterward if the development tooling did
not already do it.

### Unexpected extra migration prompt

After all committed migrations have been applied, `prisma migrate dev` should
finish without asking for another migration name when `schema.prisma` has not
been changed. If it does ask, do not enter a placeholder name and commit the
result automatically. Inspect the generated SQL first: it means the schema
reconstructed from migration history differs from `schema.prisma`, even when
the live database itself was previously reported as up to date.

The wallet migrations need
`20260808191500_align_trading_wallet_constraints`. The earlier handwritten
wallet migration omitted Prisma's default `ON UPDATE CASCADE` actions, and
PostgreSQL truncated its long unique-index identifier differently from Prisma.
The alignment migration records those changes explicitly. On a fresh database,
applying every committed migration must therefore produce no additional diff.

If a local disposable development database already applied an untracked
placeholder migration containing the same wallet constraint/index changes,
remove that untracked directory and reset the development database before
applying the committed history:

```bash
rm -rf prisma/migrations/<timestamp>_<placeholder>
npx prisma migrate reset
```

`migrate reset` deletes all data. If the database contains data that must be
kept, do not delete migration files or edit the `_prisma_migrations` table by
hand. Back up the database and restore/migrate it using an explicitly reviewed
recovery plan instead.

Useful optional checks and tools:

```bash
npm run prisma:generate
npm run test:prisma
npm run prisma:studio
```

`migrate dev` can request a database reset when it detects drift. Never point a
development `DATABASE_URL` at production.

## Production

Back up an existing database first. In the release/deployment stage, install
the Prisma CLI, validate the committed schema, apply only committed migrations,
generate the client, and run the connection smoke test:

```bash
npm ci
npm run prisma:validate
npx prisma migrate status
npx prisma migrate deploy
npm run prisma:generate
npm run test:prisma
npm run build
```

Do **not** run `npm run prisma:migrate` (`prisma migrate dev`) in production.
Use `prisma migrate deploy`; it applies pending files from `prisma/migrations`
without creating a new migration.

In production, `migrate deploy` must run before starting application instances
that use the new schema. `generate` does not update the database: it only builds
the type-safe Prisma Client from `schema.prisma`. It may run before or after
`migrate deploy` in a build pipeline, but the recommended release order above
keeps database deployment explicit. Besides `migrate deploy`, run the connection
smoke test and application build shown above; no `migrate dev`, `db push`, or
extra schema command is needed in production. Take a backup and use a deployment
strategy that prevents old application instances from relying on incompatible
schema behavior during rollout.

The `prisma` CLI is a development dependency, so the migration stage must not
use `npm ci --omit=dev` before `migrate deploy`. A runtime image may omit
development dependencies after migrations, client generation, and the build
have completed.

Schema migration creates or updates PostgreSQL structures only. It does not
import the Redis export. The application runtime is already wired to
Prisma/PostgreSQL; Redis/KV code remains deprecated legacy support for migration
tooling and tests only.
