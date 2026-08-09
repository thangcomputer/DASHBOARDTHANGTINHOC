# Teacher Domain Query Review
## Overview
All read operations for the `Teacher` domain have been refactored into CQRS Queries, dispatching via `QueryBus`.
## Boundary
- Queries are read-only and never publish `DomainEvents`.
