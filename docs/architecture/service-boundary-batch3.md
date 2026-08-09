# Service Boundary — Batch 3

## Architecture After Batch 3
Transactional logic is highly complex, but the flow remains strictly constrained:

```
Express Route
     ↓
 Controller (payload extraction only)
     ↓
 Application Service (transaction logic, validations)
     ↓
 Repository (aggregations, atomic operations)
     ↓
 MongoDB
```

## Cross-Domain Dependencies After Batch 3
- `FinanceApplicationService` requires access to Ledger, Student, and Invoice Repositories.
- Strict rules maintained: **Controllers NEVER orchestrate repositories from another domain**. All cross-domain actions happen via `ApplicationService` or `Repository`.

This structure will be fully decoupled via Event Bus in Sprint 4.4.
