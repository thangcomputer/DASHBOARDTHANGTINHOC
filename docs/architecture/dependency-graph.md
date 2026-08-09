# Global Dependency Graph

## 1. Overview
This document analyzes the physical module graph of the platform following the Sprint 4.1 restructuring. While the files are now organized by domain, the `require()` graph still largely resembles a Monolith.

## 2. Global Dependency Map

### 2.1 Foundational Dependencies (Inward)
These domains are heavily relied upon by others but should depend on almost nothing themselves.
- **`auth`**: Required by nearly all routes for the `authMiddleware.js` (Shared Kernel) and Employee data.
- **`tenant` & `branch`**: Required globally for data scoping.
- **`system`**: Required for runtime configurations (Settings).
- *Observation*: `auth` currently reaches out to `branch` during user creation, which is acceptable but borders on cross-domain logic.

### 2.2 Core Operational Dependencies (Bidirectional)
- **`student`**:
  - *Outward*: Depends on `finance` (enrollment checks), `branch`.
  - *Inward*: Required by `finance`, `exam`, `chat`, `analytics`, `course`, `attendance`.
- **`teacher`**:
  - *Outward*: Depends on `branch`, `course`.
  - *Inward*: Required by `course`, `chat`, `analytics`, `attendance`.
- **`course`**:
  - *Outward*: Depends on `student`, `teacher`.
  - *Inward*: Required by `exam`, `analytics`.

### 2.3 Transactional Dependencies (Outward)
These domains orchestrate complex business flows and thus depend on many core modules.
- **`finance` & `invoice`**:
  - *Outward*: Heavily depends on `student`, `course`, `transaction`.
  - *Inward*: Required by `payment` (webhooks).
- **`enrollment`**:
  - *Outward*: Depends on `student`, `course`, `invoice` (finance).
- **`payment`**:
  - *Outward*: Depends on `invoice`, `transaction`, `finance` (ledger updates).
- **`exam`**:
  - *Outward*: Depends on `course`, `student`.

### 2.4 Edge & Communication Dependencies (Outward)
- **`notification`**:
  - *Outward*: Needs to know about `student`, `teacher` (to fetch contacts).
- **`chat`**:
  - *Outward*: Needs to know about `student`, `teacher`, `auth` (Identity verification).
- **`ai`**:
  - *Outward*: Reads from `course` (knowledge base extraction).

## 3. Forbidden Imports Identified
Because this was a structural-only sprint without logic refactoring, the following "forbidden" import patterns persist and flag as architectural violations:
1. **Direct Mongoose Model Grabbing**: Controllers in `module A` directly doing `require('../../modules/B/models/B_Model.js')`. This tightly couples Database Schemas across bounded contexts.
2. **Horizontal Service Calls**: `NotificationService` synchronously calling `StudentService.findById()` inside a transaction block.
3. **Leaking Secrets**: Modules reaching directly into `config/` rather than receiving injected parameters.

## 4. Circular Dependencies
1. **`student` ↔ `finance`**: Students query their balances (Student → Finance). Finance verifies enrollment status to generate invoices (Finance → Student).
2. **`teacher` ↔ `course`**: Teachers assign courses, courses list teachers.
3. **`invoice` ↔ `finance` (ledger)**: The ledger updates invoice states, while the invoice system uses the ledger for balance calculations.

## 5. Shared Kernel Usage
- **`shared/middleware/authorize.js`**: Imported by 95% of route files globally.
- **`shared/logger/auditLogger.js`**: Imported by almost all transactional and core controllers.
- **`shared/metrics/metricsCollector.js`**: Plugs into the Express pipeline.
- *Status*: The shared kernel is well-isolated. No domain business logic exists inside `shared/`.
