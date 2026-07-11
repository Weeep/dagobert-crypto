# Modules

This folder follows a feature-first clean architecture layout.

Each module may contain these layers when there is code for them:

- `domain/`: business entities, value objects, repository contracts, domain services
- `application/`: use cases and orchestration
- `infrastructure/`: external adapters such as database, exchange, auth or third-party API implementations
- `dto/`: request/response shapes used at API boundaries

Empty layer folders are intentionally not kept unless a module is only a placeholder for planned work.
