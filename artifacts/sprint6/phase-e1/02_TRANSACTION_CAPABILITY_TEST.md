# 02. TRANSACTION CAPABILITY TEST

## Goal
Prove definitively whether the current MongoDB infrastructure supports multi-document transactions.

## Execution
- **Script**: `tests/api/transaction_capability.test.js`
- **Steps**:
  1. `mongoose.connect()`
  2. `mongoose.startSession()`
  3. `session.startTransaction()`
  4. `TestModel.create([{ name: 'Test' }], { session })`
  5. `session.commitTransaction()`

## Results
The script successfully connected and started the session (which is allowed in memory). However, the first database write operation strictly failed because MongoDB refused to assign a transaction number on a standalone topology.

## Evidence
```
[Test] Connected to MongoDB at mongodb://127.0.0.1:27017/dashboardthangtinhoc
[Test] Session started successfully
[Test] Transaction started (in-memory state)
[Test] FAILED: MongoDB transaction capability test failed.
MongoServerError: Transaction numbers are only allowed on a replica set member or mongos
```

## Verdict
**[BLOCKED]** - The MongoDB infrastructure strictly requires conversion to a Replica Set to unblock Phase E.
