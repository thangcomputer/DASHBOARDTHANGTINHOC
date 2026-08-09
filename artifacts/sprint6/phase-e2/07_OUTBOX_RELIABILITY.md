# 07_OUTBOX_RELIABILITY

## Objective
Verify the resilience, retry, and deduplication guarantees of the Outbox implementation.

## Features

### A. Atomicity
- **Verified**: `OutboxEvent` is saved in the exact same `ClientSession` as the business mutation.

### B. Retry Logic
- **Verified**: The worker increments `retryCount` on `eventBus.publish` failure. If `retryCount >= 3`, the status is permanently marked as `FAILED`.

### C. Failed Transaction Orphan Protection
- **Verified**: If the MongoDB transaction fails, the `OutboxEvent` is never written to the collection. The worker cannot accidentally pick up an orphaned, uncommitted event.

### D. Concurrency and Deduplication
- **Status**: [NOT VERIFIED]
- **Evidence**: `OutboxWorker.js` uses `OutboxEvent.find({ status: 'PENDING' })` without an atomic update operator (e.g., `findOneAndUpdate` with a status change to `PROCESSING`). If multiple Node.js server instances run `OutboxWorker.start()`, they will query the same `PENDING` records, publish duplicate events to the EventBus, and attempt to save the same record simultaneously, leading to race conditions.
- **Deduplication**: There is no Event ID deduplication table verified on the consuming side in this trace.

## Verdict
[CONDITIONAL APPROVAL]
The core Outbox reliability (atomicity, retry limits, orphan prevention) is robust. However, concurrency protection (leasing/locking) is absent. If deployed to a multi-instance production environment without locking, duplicate events will be dispatched.
