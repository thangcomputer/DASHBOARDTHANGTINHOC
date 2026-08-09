# Native Outbox Pattern Design
## Architecture
- **Outbox Collection**: Mongoose schema storing `{ eventType, payload, status (PENDING|PROCESSED|FAILED), retryCount }`.
- **Publisher**: Business logic writes to Outbox in the *same* Mongo transaction as the domain mutation.
- **Retry Worker**: BullMQ job polling `PENDING` records every 5s, publishing to EventBus.
- **Failure Recovery & DLQ**: After 5 retries, status becomes `FAILED` (Dead Letter Queue) requiring manual intervention.
- **Ordering**: Processed sequentially by `createdAt` per `aggregateId`.
