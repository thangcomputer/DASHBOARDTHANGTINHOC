# Failure Mode Analysis
## Scenarios
1. **Mongo Timeout**: Commands must wrap in native transactions. Return 503.
2. **Redis Unavailable**: Degrade gracefully (skip cache), but halt rate-limiting/idempotency checks.
3. **Partial Update**: Prevented by Mongo Native Transactions and Outbox.
4. **Event Publish Failure**: Prevented by Outbox.
5. **Worker Crash**: BullMQ will re-deliver the job after visibility timeout.
6. **Network Partition**: System runs in degraded mode.
