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

The `prisma` CLI is a development dependency, so the migration stage must not
use `npm ci --omit=dev` before `migrate deploy`. A runtime image may omit
development dependencies after migrations, client generation, and the build
have completed.

Schema migration creates or updates PostgreSQL structures only. It does not
import the Redis export and does not switch the runtime repositories from Redis
to Prisma.
