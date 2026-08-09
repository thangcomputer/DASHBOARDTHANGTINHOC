# Batch 2 Migration Pre-check: Finance, Invoice, Analytics, Transaction

## Phase 1: Endpoint Analysis

### Module: Analytics (`routes/analyticsRoutes.js`)
| Endpoint | Legacy Authorization | Required Permission (Mapped) | Financial Impact | Risk Level |
|---|---|---|---|---|
| `GET /api/analytics/revenue` | `checkAnyPermission(MANAGE_FINANCE, VIEW_BRANCH_REVENUE)` | `FINANCE_VIEW` | None (Read-only) | Low |
| `GET /api/analytics/enrollment` | `checkAnyPermission(MANAGE_FINANCE, VIEW_BRANCH_REVENUE)` | `FINANCE_VIEW` | None (Read-only) | Low |
| `GET /api/analytics/branches` | `checkAnyPermission(MANAGE_FINANCE, VIEW_BRANCH_REVENUE)` | `FINANCE_VIEW` | None (Read-only) | Low |

### Module: Finance (`routes/financeRoutes.js`)
| Endpoint | Legacy Authorization | Required Permission (Mapped) | Financial Impact | Risk Level |
|---|---|---|---|---|
| `GET /api/finance/summary` | `checkAnyPermission(MANAGE_FINANCE, VIEW_BRANCH_REVENUE)` | `FINANCE_VIEW` | None (Read-only) | Low |
| `GET /api/finance/ledger` | `checkAnyPermission(MANAGE_FINANCE, VIEW_BRANCH_REVENUE)` | `FINANCE_VIEW` | None (Read-only) | Low |
| `GET /api/finance/students/:id` | `checkAnyPermission(MANAGE_FINANCE, VIEW_BRANCH_REVENUE)` | `FINANCE_VIEW` | None (Read-only) | Low |
| `POST /api/finance/ledger/:id/void` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_REFUND_APPROVE`, `FINANCE_PAYMENT_CREATE` | Voids ledger entry, changes financial balance | HIGH |
| `POST /api/finance/discount` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_PAYMENT_CREATE` | Creates discount coupon, reduces tuition | HIGH |
| `GET /api/finance/reconcile` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_VIEW` | None (Read-only) | Low |
| `POST /api/finance/snapshots/rebuild` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_VIEW`, `FINANCE_PAYMENT_CREATE` | Overwrites cached financial stats | Medium |
| `POST /api/finance/students/:id/sync-cache` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_VIEW` | Syncs cache | Low |

### Module: Invoice (`routes/invoiceRoutes.js`)
| Endpoint | Legacy Authorization | Required Permission (Mapped) | Financial Impact | Risk Level |
|---|---|---|---|---|
| `GET /api/invoices` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_VIEW` | None (Read-only) | Low |
| `GET /api/invoices/stats` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_VIEW` | None (Read-only) | Low |
| `GET /api/invoices/:id` | `authMiddleware` + Business Rule | Route is accessible, scoped by Ownership Rule | None (Read-only) | Low |
| `POST /api/invoices` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_PAYMENT_CREATE` | Issues invoice to student | HIGH |
| `GET /api/invoices/:id/pdf` | `authMiddleware` + Business Rule | Scoped by Ownership Rule | None (Read-only) | Low |
| `POST /api/invoices/:id/pdf/queue` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_VIEW` | Triggers PDF generation worker | Low |
| `POST /api/invoices/:id/email` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_VIEW` | Triggers Email worker | Low |
| `DELETE /api/invoices/:id` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_REFUND_APPROVE` | Voids/Deletes invoice | HIGH |

### Module: Transaction (`routes/transactionRoutes.js`)
| Endpoint | Legacy Authorization | Required Permission (Mapped) | Financial Impact | Risk Level |
|---|---|---|---|---|
| `GET /api/transactions` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_VIEW` | None (Read-only) | Low |
| `GET /api/transactions/stats` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_VIEW` | None (Read-only) | Low |
| `GET /api/transactions/teacher/:id` | `authMiddleware` + Business Rule | Scoped by Ownership Rule | None (Read-only) | Low |
| `POST /api/transactions/calculate` | `isTeacher` + Business Rule | `TEACHER_VIEW` | None (Read-only logic) | Low |
| `POST /api/transactions` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_PAYMENT_CREATE` | Issues pending salary ticket | Medium |
| `PUT /api/transactions/:id/confirm` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_PAYMENT_CREATE` | Pays teacher salary | CRITICAL |
| `PUT /api/transactions/:id/cancel` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_REFUND_APPROVE` | Cancels salary ticket | HIGH |
| `DELETE /api/transactions/:id` | `checkPermission(MANAGE_FINANCE)` | `FINANCE_REFUND_APPROVE` | Deletes salary ticket | HIGH |
