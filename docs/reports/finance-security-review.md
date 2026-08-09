# Financial Security Audit Report

## 1. Overview
As part of the Sprint 3.6 Batch 2 migration, a comprehensive security audit was conducted on the financial modules (Finance, Invoice, Analytics, Transaction).

## 2. Security Findings

### 2.1 Privilege Escalation Vulnerability (RESOLVED)
- **Detection**: Mapping the legacy string `MANAGE_FINANCE` directly via `authorizeAny()` resulted in any user possessing just the read-only `FINANCE_VIEW` permission gaining full write access to endpoints such as `POST /api/finance/ledger/:id/void` and `POST /api/transactions`.
- **Resolution**: The migration script was updated to abandon the wildcard alias mapping for write endpoints. Instead, strict atomic mappings were enforced:
  - Invoice/Salary Generation -> `authorize(NEW_PERMISSIONS.FINANCE_PAYMENT_CREATE)`
  - Ledger Void/Cancel -> `authorize(NEW_PERMISSIONS.FINANCE_REFUND_APPROVE)`

### 2.2 Unauthorized Refund & Payment Manipulation (SECURED)
- **Detection**: Checked endpoints for manual amount injection or lack of idempotency keys.
- **Resolution**: Both `/discount` and `/ledger/:id/void` rely on `ledgerService.js`, which strictly enforces dual-entry ledger accounting and immutability (voids create reversal entries rather than destroying data). Write access is successfully walled by `FINANCE_REFUND_APPROVE`.

### 2.3 Unauthorized Invoice & Salary Access (SECURED)
- **Detection**: A student attempting to query another student's invoice or a teacher viewing another teacher's salary.
- **Resolution**: Business logic rules were intentionally preserved. E.g., `if (req.currentUser.role !== 'admin' && req.currentUser.id !== invoice.hocVien?._id)` blocks horizontal access regardless of RBAC permissions.

### 2.4 Cross-Branch / Cross-Tenant Access (SECURED)
- **Detection**: Staff from Branch A querying revenue for Branch B.
- **Resolution**: The `branchFilter` middleware securely attaches `req.branchFilter.branchId` based on the user's session. Controllers enforce `String(student.branchId) === String(req.branchFilter.branchId)`. The RBAC `BranchPolicy` acts as a secondary orchestration layer during authorization.

## 3. Audit Logging Verification
All financial write operations correctly delegate to `ledgerService.js` and generate corresponding Audit Logs containing:
- Timestamp
- Action (e.g., `FINANCE_PAYMENT_CREATE`)
- Request ID & Correlation ID (via `correlationContext`)
- User ID and Branch ID of the initiating actor

## 4. Conclusion
The financial module architecture is secure against horizontal access attacks and privilege escalation under the new RBAC model.
