# 03_TRANSACTION_BOUNDARY

## Objective
Prove the exact MongoDB transaction boundary and verify `Student`, `Invoice`, `LedgerEntry`, and `OutboxEvent` mutations share the same `ClientSession`.

## Transaction Lifecycle Trace

1. **Transaction Start**
   - **File**: `shared/transaction/TransactionFactory.js` (lines 8-9)
   - **Code**: `const session = await mongoose.startSession(); session.startTransaction();`
   - **Context**: Initiated by `TransactionManager.execute()` wrapped via `CommandBus`.

2. **Session Injection**
   - **File**: `shared/transaction/TransactionContext.js`
   - **Mechanism**: Node.js `AsyncLocalStorage` stores the active `tx.session`.
   - **Usage**: Child components retrieve it via `TransactionContext.current()`.

3. **Student Mutation**
   - **File**: `modules/student/commands/CreateStudentHandler.js` (line 28)
   - **Code**: `StudentRepository.save(aggregate, session)`
   - **Evidence**: Uses `{ session }`.

4. **Invoice & Ledger Mutation**
   - **File**: `modules/finance/commands/CreateInvoiceHandler.js` (lines 28, 44)
   - **Code**: `await invoice.save({ session }); await ledgerEntry.save({ session });`
   - **Evidence**: Retrieves `tx = TransactionContext.current()` and uses `{ session }`.

5. **Outbox Mutation**
   - **File**: `modules/student/commands/CreateStudentHandler.js` (line 48)
   - **Code**: `await outboxRecord.save({ session });`
   - **Evidence**: Uses `{ session }`.

6. **Transaction Commit / Rollback**
   - **File**: `shared/transaction/MongoTransaction.js`
   - **Code**: `await this.session.commitTransaction();` or `await this.session.abortTransaction();`

## Verdict
[VERIFIED]
All 4 models (`Student`, `Invoice`, `LedgerEntry`, `OutboxEvent`) explicitly pass the exact same `ClientSession` derived from `TransactionContext.current()`. The boundary spans the entirety of `StudentApplicationOrchestrator.createStudentWithInvoice`.
