# Composition roots

Runtime-specific dependency wiring lives here instead of in the domain or
application layers.

- `clientUseCases.ts` wires HTTP repositories for entity reads and writes.
- `serverUseCases.ts` is the production server root and wires
  Prisma/PostgreSQL-backed repositories plus infrastructure services.
- `createServerUseCases.ts` is the deprecated injectable KV-backed server
  factory retained for migration-era tests and historical compatibility.
- `createUseCases.ts` contains storage-agnostic use-case wiring shared by both
  roots.

The use cases depend on the domain repository interfaces, not on Redis/KV.
PostgreSQL is the production runtime. Existing KV adapters are deprecated and
retained only for migration-era tooling, tests, and historical compatibility;
future features should not add KV-backed behavior.
