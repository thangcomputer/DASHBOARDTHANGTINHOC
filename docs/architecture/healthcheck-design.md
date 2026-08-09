# Health Checks Blueprint
## Endpoints
- `/health/liveness`: Immediate 200 OK if Node loop is running.
- `/health/readiness`: 200 OK only if DB, Redis, and core dependencies are reachable.
- `/health/startup`: One-time check for container orchestration.
- `/health/dependencies`: Deep diagnostic JSON of MongoDB, BullMQ, Storage, SMTP, and External APIs status.
