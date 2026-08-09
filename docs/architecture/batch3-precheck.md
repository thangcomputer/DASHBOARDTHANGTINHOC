# Batch 3 Transactional & Event Domain Relocation Precheck

## 1. Overview
Sprint 4.1 Batch 3 targets transactional and event-driven domains. Following the updated ARB module specifications, the previously monolithic finance domain has been split into dedicated modules (`finance`, `payment`, `invoice`, `transaction`). 

## 2. File Verification & Target Mapping

### Domain: `invoice`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/invoiceRoutes.js` | `modules/invoice/routes/invoiceRoutes.js` | Route | `Invoice`, `Student`, `ledgerService` |
| `models/Invoice.js` | `modules/invoice/models/Invoice.js` | Model | `mongoose` |

### Domain: `transaction`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/transactionRoutes.js`| `modules/transaction/routes/transactionRoutes.js`| Route | `Transaction`, `Invoice`, `ledgerService` |
| `models/Transaction.js` | `modules/transaction/models/Transaction.js`| Model | `mongoose` |

### Domain: `finance`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/financeRoutes.js` | `modules/finance/routes/financeRoutes.js` | Route | `Student`, `Transaction`, `ledgerService` |
| `routes/biRoutes.js` | `modules/finance/routes/biRoutes.js` | Route | `biService` |
| `models/LedgerEntry.js` | `modules/finance/models/LedgerEntry.js` | Model | `mongoose` |
| `models/CreditNote.js` | `modules/finance/models/CreditNote.js` | Model | `mongoose` |
| `models/FinanceDailySnapshot.js`|`modules/finance/models/FinanceDailySnapshot.js`| Model | `mongoose` |
| `models/PayrollLog.js` | `modules/finance/models/PayrollLog.js` | Model | `mongoose` |
| `services/ledgerService.js` | `modules/finance/services/ledgerService.js`| Service | `LedgerEntry`, `Invoice`, `Student`, `CreditNote` |
| `services/revenueAggregate.js`| `modules/finance/services/revenueAggregate.js`| Service | `Invoice`, `Transaction` |
| `services/biService.js` | `modules/finance/services/biService.js` | Service | `Student`, `Invoice` |

### Domain: `payment`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/webhookRoutes.js` | `modules/payment/routes/webhookRoutes.js` | Route | `Invoice`, `Transaction`, `SepayWebhookEvent`, `PaymentSession`, `ledgerService` |
| `models/PaymentSession.js` | `modules/payment/models/PaymentSession.js`| Model | `mongoose` |
| `models/SepayWebhookEvent.js`| `modules/payment/models/SepayWebhookEvent.js`| Model | `mongoose` |

### Domain: `exam`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/examResultRoutes.js` | `modules/exam/routes/examResultRoutes.js` | Route | `ExamResult`, `Course`, `Student`, `examProgressService` |
| `routes/proctorRoutes.js` | `modules/exam/routes/proctorRoutes.js` | Route | `ProctorEvent`, `proctorAuditService` |
| `routes/quizRoutes.js` | `modules/exam/routes/quizRoutes.js` | Route | `LessonQuiz` |
| `routes/evaluationRoutes.js` | `modules/exam/routes/evaluationRoutes.js` | Route | `Evaluation`, `Student` |
| `models/ExamResult.js` | `modules/exam/models/ExamResult.js` | Model | `mongoose` |
| `models/ProctorEvent.js` | `modules/exam/models/ProctorEvent.js` | Model | `mongoose` |
| `models/LessonQuiz.js` | `modules/exam/models/LessonQuiz.js` | Model | `mongoose` |
| `models/Evaluation.js` | `modules/exam/models/Evaluation.js` | Model | `mongoose` |
| `services/examProgressService.js`|`modules/exam/services/examProgressService.js`| Service | `ExamResult`, `Course` |
| `services/examSubjectCatalog.js` |`modules/exam/services/examSubjectCatalog.js`| Service | `Course` |
| `services/proctorAuditService.js`|`modules/exam/services/proctorAuditService.js`| Service | `ProctorEvent` |

### Domain: `analytics`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/analyticsRoutes.js` | `modules/analytics/routes/analyticsRoutes.js`| Route | `Student`, `Teacher`, `Course` |

### Domain: `report` (Monitoring, Audit, Backup)
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/monitoringRoutes.js` | `modules/report/routes/monitoringRoutes.js`| Route | `monitoringService`, `metricsCollector` |
| `routes/systemLogRoutes.js` | `modules/report/routes/systemLogRoutes.js`| Route | `SystemLog` |
| `routes/backupRoutes.js` | `modules/report/routes/backupRoutes.js` | Route | `backupService` |
| `models/ReportDefinition.js` | `modules/report/models/ReportDefinition.js`| Model | `mongoose` |
| `models/SystemLog.js` | `modules/report/models/SystemLog.js` | Model | `mongoose` |
| `models/AuditLog.js` | `modules/report/models/AuditLog.js` | Model | `mongoose` |
| `models/BackupJob.js` | `modules/report/models/BackupJob.js` | Model | `mongoose` |
| `services/reportService.js` | `modules/report/services/reportService.js`| Service | `ReportDefinition`, `Course`, `Invoice` |
| `services/monitoringService.js`| `modules/report/services/monitoringService.js`| Service | `SystemLog` |
| `services/backupService.js` | `modules/report/services/backupService.js`| Service | `BackupJob` |
| `services/metricsCollector.js`| `modules/report/services/metricsCollector.js`| Service | Global Memory/Redis |
| `services/auditLogService.js`| `modules/report/services/auditLogService.js`| Service | `AuditLog` |

### Domain: `certificate`
- **Current Path**: N/A (Does not currently exist natively)
- **Target Path**: `modules/certificate/`
- **Type**: Empty Placeholder Structure.

## 3. Placeholder Directory Structure
For every domain above, the following directories will be generated:
- `controllers/`, `services/`, `repositories/`, `routes/`, `models/`, `validators/`, `dto/`, `events/`, `tests/`
- An empty `index.js`.

## 4. Execution Readiness
The dependencies are fully mapped. Relocation is safe to proceed under Phase 2 using the automated abstract syntax tree string replacement strategy to update all inter-module references globally.
