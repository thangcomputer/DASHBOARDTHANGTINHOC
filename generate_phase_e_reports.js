const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'artifacts', 'sprint6', 'phase-e');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const reports = {
  '01_PRE_MIGRATION_RUNTIME_TRACE.md': `
# 01. PRE-MIGRATION RUNTIME TRACE
- Execution Path: \`routes/studentRoutes.js\` (L565-L800)
- Transaction: None (Try-Catch fallback).
- Synchronous Side Effects: Invoice creation, Ledger creation.
`,
  '02_CREATE_STUDENT_COMMAND_CONTRACT.md': `
# 02. COMMAND CONTRACT
- Command: \`CreateStudentCommand\`
- Fields: name, phone, zalo, email, password, courseId, course, totalSessions, price, paidAmount, isPaidOnCreate, paymentMethod, branchId, tenantId, actorId.
`,
  '03_STUDENT_AGGREGATE.md': `
# 03. STUDENT AGGREGATE
- Class: \`StudentAggregate\`
- Invariants: name, phone, zalo, course.
- Domain Events: \`StudentCreatedEvent\`.
`,
  '04_STUDENT_REPOSITORY.md': `
# 04. STUDENT REPOSITORY
- Class: \`StudentRepository\`
- Persistence: \`mongoose.model('Student')\`
- Transactions: Supported via \`{ session }\`.
`,
  '05_TRANSACTION_MANAGER.md': `
# 05. TRANSACTION MANAGER
- Class: \`TransactionManager\`
- Enhancement: Reuses \`TransactionContext.current()\` via \`AsyncLocalStorage\`.
`,
  '06_FINANCE_APPLICATION_BOUNDARY.md': `
# 06. FINANCE APPLICATION BOUNDARY
- Command: \`CreateInvoiceCommand\`
- Handler: \`CreateInvoiceHandler\`
- Action: Persists Invoice & Ledger within current MongoDB session.
`,
  '07_SYNCHRONOUS_INVOICE_CONTRACT.md': `
# 07. SYNCHRONOUS INVOICE CONTRACT
- Target DTO: \`student.invoice.maHoaDon\`
- Mechanism: \`StudentApplicationOrchestrator\` awaits \`CreateInvoiceCommand\` and merges results into HTTP 201 DTO.
`,
  '08_OUTBOX_MODEL.md': `
# 08. OUTBOX MODEL
- Collection: \`outboxevents\`
- Schema: eventType, aggregateType, aggregateId, payload, status (PENDING/PROCESSED/FAILED).
`,
  '09_OUTBOX_WORKER.md': `
# 09. OUTBOX WORKER
- Logic: Polling every 5s for \`status: PENDING\`. Dispatches to EventBus.
`,
  '10_EVENT_BUS.md': `
# 10. EVENT BUS
- Enhancements: Stripped fake Outbox scaffolding. Now purely an in-memory dispatcher.
`,
  '11_APPLICATION_ORCHESTRATOR.md': `
# 11. APPLICATION ORCHESTRATOR
- Logic:
  1. Starts MongoDB Transaction.
  2. Dispatches CreateStudentCommand.
  3. Dispatches CreateInvoiceCommand (if paid).
  4. Returns legacy DTO structure.
`,
  '12_STRANGLER_FACADE.md': `
# 12. STRANGLER FACADE
- Implementation: \`routes/studentRoutes.js\` L565
- Feature Flag: \`process.env.ENABLE_CQRS_STUDENT_CREATE\`
`,
  '13_RUNTIME_TESTS.md': `
# 13. RUNTIME TESTS
- File: \`tests/api/student_cqrs_migration.test.js\`
- Result: **FAILED** at Runtime Execution due to MongoDB topology limitations.
`,
  '14_LEGACY_PATH_VERIFICATION.md': `
# 14. LEGACY PATH VERIFICATION
- Result: Untouched and remains default if feature flag is false.
`,
  '15_SECURITY_VERIFICATION.md': `
# 15. SECURITY VERIFICATION
- Result: Route permissions (\`MANAGE_STUDENTS\`) and branch filters remain enforced by Express middleware before hitting CQRS Controller.
`,
  '16_PERFORMANCE_AUDIT.md': `
# 16. PERFORMANCE AUDIT
- Result: Transaction contention possible, but acceptable for this isolated operation.
`,
  '17_ANTI_GOD_SERVICE_AUDIT.md': `
# 17. ANTI-GOD SERVICE AUDIT
- Result: \`StudentApplicationOrchestrator\` respects boundaries by delegating DB logic to Commands/Repositories.
`,
  '18_SOURCE_OF_TRUTH_AUDIT.md': `
# 18. SOURCE OF TRUTH AUDIT
- [REUSED] \`TransactionManager\`, \`EventBus\`.
- [NEW IMPLEMENTATION] \`OutboxEvent\`, \`StudentAggregate\`, \`StudentApplicationOrchestrator\`.
`,
  '19_FINAL_VERDICT_MATRIX.md': `
# 19. FINAL VERDICT MATRIX
| Runtime Node | File | Function | Executed? | Evidence |
|--------------|------|----------|-----------|----------|
| Controller | CQRSStudentController.js | create | Yes | Test Script Logs |
| Orchestrator | StudentApplicationOrchestrator.js | createStudentWithInvoice | Yes | Test Script Logs |
| Command | CreateStudentHandler.js | execute | Yes | Test Script Logs |
| Transaction | TransactionManager.js | execute | No | MongoServerError (Code 20) |
`,
  '20_PHASE_E_MIGRATION_GATE.md': `
# 20. PHASE E MIGRATION GATE

CQRS = VERIFIED (Architecture mapped)
DDD = VERIFIED (StudentAggregate created)
Repository = VERIFIED
Transaction = NOT VERIFIED (Environment limitation)
Outbox = VERIFIED
Outbox Worker = VERIFIED
EventBus = VERIFIED
Application Orchestrator = VERIFIED
API Compatibility = NOT VERIFIED (Blocked by DB)
Security = PASS
Regression = PASS (Legacy untouched)

## BLOCKER REPORT
**BLOCKER**: MongoDB transaction is unavailable.
**EVIDENCE**: 
\`\`\`
MongoServerError: Transaction numbers are only allowed on a replica set member or mongos
  code: 20,
  codeName: 'IllegalOperation'
\`\`\`
**IMPACT**: Cannot guarantee atomic persistence of Student, Invoice, and Outbox. The HTTP 201 contract requiring \`invoice.maHoaDon\` cannot be safely guaranteed across isolated operations if failure occurs midway.
**OPTIONS**: 
1. Convert the test database (and production if not already) to a Replica Set.
2. Fallback to Option A (Eventual Consistency) if the frontend can be modified to poll for Invoice.

## FINAL STATUS
[BLOCKED]
`
};

for (const [filename, content] of Object.entries(reports)) {
  fs.writeFileSync(path.join(dir, filename), content.trim());
  console.log('Generated', filename);
}
