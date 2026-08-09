# 06_OUTBOX_RUNTIME_TRACE

## Objective
Trace the Outbox lifecycle from Repository insertion to EventBus publication.

## Trace

### 1. Creation Boundary
- **File**: `modules/student/commands/CreateStudentHandler.js` (line 48)
- **Mechanism**: `await outboxRecord.save({ session })`
- **Result**: The event is atomically saved in the `OutboxEvent` collection with status `PENDING`.

### 2. Polling Mechanism
- **File**: `shared/outbox/OutboxWorker.js`
- **Mechanism**: `setInterval(() => this.processOutbox(), this.pollInterval)`
- **Query**: `OutboxEvent.find({ status: 'PENDING' }).sort({ createdAt: 1 }).limit(50)`

### 3. Publication
- **File**: `shared/outbox/OutboxWorker.js` (line 44)
- **Mechanism**: `await eventBus.publish(domainEvent)`
- **Rule Satisfied**: It explicitly waits for the event to be persisted in MongoDB before picking it up in the background worker, guaranteeing it does NOT publish before commit.

### 4. Completion
- **File**: `shared/outbox/OutboxWorker.js` (lines 47-49)
- **Mechanism**: 
  ```javascript
  record.status = 'PROCESSED';
  record.processedAt = new Date();
  await record.save();
  ```

## Verdict
[VERIFIED]
The Outbox runtime path is completely verifiable from transaction commit to background asynchronous publication.
