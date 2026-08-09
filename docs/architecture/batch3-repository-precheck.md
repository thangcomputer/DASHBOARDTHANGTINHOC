# Batch 3 Repository Precheck

## Scope
**Target Domains**: Finance, Invoice, Payment, Transaction, Exam, Certificate, Analytics, Report

## Current Status Analysis

### 1. Finance & Payment Domains
- **Models**: `Invoice.js`, `PaymentSession.js`, `SepayWebhookEvent.js`, `Transaction.js`, `CreditNote.js`, `FinanceDailySnapshot.js`, `LedgerEntry.js`, `PayrollLog.js`
- **Observations**: The finance domains feature multiple interconnected models. Aggregations (e.g., revenue calculation) are currently performed inside `ledgerService.js` and `revenueAggregate.js`.
- **Action Items**: 
  - Migrate all 8 models to granular repositories (`InvoiceRepository`, `LedgerRepository`, etc.).
  - Encapsulate revenue aggregation into `FinanceRepository` or specific domain repositories, ensuring controllers/services do not construct pipelines.

### 2. Exam & Certificate Domains
- **Models**: `Evaluation.js`, `ExamResult.js`, `LessonQuiz.js`, `ProctorEvent.js`
- **Observations**: Direct model usage present in controllers.
- **Action Items**: 
  - Migrate models to `EvaluationRepository`, `ExamResultRepository`, `LessonQuizRepository`, `ProctorEventRepository`.

### 3. Analytics & Report Domains
- **Models**: `AuditLog.js`, `BackupJob.js`, `ReportDefinition.js`, `SystemLog.js`
- **Observations**: `Analytics` domain lacks its own models but serves as an aggregation nexus. ARB ruled that cross-domain aggregations belong inside `AnalyticsRepository` or `FinanceRepository`.
- **Action Items**: 
  - Create `AnalyticsRepository` for orchestrating complex aggregations.
  - Migrate Report models to `AuditLogRepository`, etc.

## Architecture Guidelines
- **No Controller Redesign**: Business logic stays in controllers.
- **No Direct Mongoose Access**: Route all `Model.method` calls through `Repository.method`.
- **Performance Hooks Prepared**: `BaseRepository` extended with duration and frequency tracking for future monitoring layers.
- **Repository Registry Prepared**: Infrastructure in place for future Dependency Injection.
