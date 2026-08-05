# Composition roots

Runtime-specific dependency wiring lives here instead of in the domain or
application layers.

- `clientUseCases.ts` wires HTTP repositories for all entity reads. Until the
  write APIs are introduced, mutations and transaction import epoch state are
  delegated by those repositories to the temporary browser cache adapters.
- `serverUseCases.ts` is the production server root and wires Prisma/PostgreSQL
  repositories for non-auth persistence while authentication still uses the
  temporary Redis/KV credential adapter.
- `createServerUseCases.ts` is the injectable server factory used by tests and
  by runtimes that need their own store instance.
- `createUseCases.ts` contains storage-agnostic use-case wiring shared by both
  roots.

The use cases depend on the domain repository interfaces, not on a concrete
storage engine. Authentication is the remaining KV-backed server dependency
because PostgreSQL stores password hashes and the login flow still needs hash
verification before it can move to a Prisma credential repository.
