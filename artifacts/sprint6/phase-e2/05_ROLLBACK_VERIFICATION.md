# 05_ROLLBACK_VERIFICATION

## Objective
Verify that a failure during the transaction lifecycle correctly aborts and rolls back all prior mutations in the database.

## Execution Record

**Test Script**: `tests/api/transaction_rollback.test.js`
**Status**: [PASS]

### Runtime Output (from previous session)
```
Connected to DB
Expected error caught in Next: INTENTIONAL_INVOICE_FAILURE
Student persisted after rollback: false
Outbox persisted after rollback: false
ROLLBACK TEST SUCCESSFUL
```

### Verification
- **MongoDB Topology**: Replica Set (`rs0`)
- **Transaction Start**: YES (`session.startTransaction()`)
- **Commit**: NO
- **Rollback**: YES (`session.abortTransaction()`)
- **Atomicity**: The script monkey-patched `CreateInvoiceHandler.execute` to intentionally throw an error *after* `StudentRepository.save()` was executed. The test then verified that `Student.findOne()` and `OutboxEvent.findOne()` both returned `null`.

## Verdict
[VERIFIED]
Tests pass with a real transaction rollback. The database state remains clean. No false positives.
