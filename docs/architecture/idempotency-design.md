# Global Idempotency Design
## Architecture
- **Idempotency-Key Header**: Clients must provide `Idempotency-Key` on mutations.
- **Duplicate Request Detection**: Intercepted in middleware using Redis (`SETNX` with TTL).
- **Replay Protection**: Reject requests with keys older than 24h.
- **Safe Retry**: If Redis holds a resolved payload for a key, return it immediately without invoking CQRS logic.
