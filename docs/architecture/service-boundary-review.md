# Service Boundary Review

## 1. Domain Isolation
We must guarantee that domains do not leak persistence details to other domains. 
Currently, `studentRoutes.js` leaks into `finance` and `teacher` domains by calling their repositories.

## 2. Service-to-Service Communication
To resolve these leaks, we must establish standard Service APIs:
- e.g., `studentService` calls `financeService.createInvoice()` rather than `invoiceRepository.create()`.

## 3. Strict Encapsulation
Each domain's `index.js` should export ONLY its Services (and perhaps public DTOs). Internal Repositories and Models should not be exported or accessed by external domains.
