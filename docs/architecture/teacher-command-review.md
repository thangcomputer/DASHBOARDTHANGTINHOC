# Teacher Domain Command Review
## Overview
All write operations for the `Teacher` domain have been refactored into CQRS Commands, dispatching via `CommandBus`.
## Boundary
- Business logic is preserved perfectly in the existing `TeacherApplicationService`.
- `TeacherController` has 0 exposure to domain logic.
