# Composition roots

Runtime-specific dependency wiring lives here instead of in the domain or
application layers.

- `clientUseCases.ts` wires HTTP repositories for all entity reads. Until the
  write APIs are introduced, mutations and transaction import epoch state are
  delegated by those repositories to the temporary browser cache adapters.
- `serverUseCases.ts` is the production server root and wires Redis/KV-backed
  repositories.
- `createServerUseCases.ts` is the injectable server factory used by tests and
  by runtimes that need their own store instance.
- `createUseCases.ts` contains storage-agnostic use-case wiring shared by both
  roots.

The use cases depend on the domain repository interfaces, not on Redis. A
future Prisma/PostgreSQL migration should therefore add Prisma repository
implementations and select them in the server composition root; application
use cases and the client composition root do not need to change.
