# Domain Migration Plan

## 1. Overview
Transitioning a live monolith to a Domain-Driven Modular architecture poses significant risk if executed in a single "Big Bang" operation. Sprint 4 defines a phased, incremental migration strategy to guarantee Zero Downtime and Zero API breakage.

## 2. Migration Principles
1. **No API Contract Changes**: The external URL path (e.g., `/api/students`) remains exactly the same, regardless of where the physical route file is located.
2. **Incremental Routing**: The central `index.js` or `app.js` will support dual-routing (loading both the old `routes/` folder and the new `modules/` folder simultaneously) until the migration concludes.
3. **Refactor Intelligently**: Imports must be updated methodically. We will use absolute paths or module aliases (if configured) to prevent relative path breakage (e.g., `../../../models/Student`).

## 3. Migration Strategy (The 4-Batch Execution)

### Batch 1: Core Foundation Modules
Migrate the foundational structures that do not possess heavy upstream dependencies.
- **Target Domains**: `shared`, `auth`, `tenant`, `branch`
- **Actions**:
  - Migrate `authRoutes.js`, `Employee.js`, `authenticate.js` to `modules/auth/`.
  - Migrate Tenant and Branch controllers/models to their respective modules.
  - Establish the `shared/` directory and relocate `authMiddleware.js`, `branchFilter.js`, logger, and error classes.
  - Fix all dangling imports across the legacy `routes/` pointing to `shared`.

### Batch 2: Core Domain Entities
Migrate the primary business subjects.
- **Target Domains**: `student`, `teacher`, `course`
- **Actions**:
  - Relocate `studentRoutes.js`, `Student.js`.
  - Relocate `teacherRoutes.js`, `staffRoutes.js`, `Teacher.js`.
  - Relocate `courseRoutes.js`, `Course.js`.
  - Introduce strict Service-to-Service communication to break any direct Model-coupling from remaining legacy files.

### Batch 3: Transactional & Event Domains
Migrate domains that rely heavily on the Core Entities.
- **Target Domains**: `finance`, `enrollment`, `attendance`, `exam`
- **Actions**:
  - Move Invoicing, Ledger, Scheduling, and Proctoring code.
  - Implement Domain Events (e.g., `Finance Event Emitter`) to decouple side-effects from the core transactions.

### Batch 4: Edge & Support Domains
Migrate standalone or edge features.
- **Target Domains**: `notification`, `cms`, `report`, `ai`, `payment`
- **Actions**:
  - Move Blog, Feed, File upload logic.
  - Move Webhooks, Zalo/Email queues, Metrics, and System Logs.
  - Once Batch 4 completes, the old `routes/`, `controllers/`, and `models/` folders will be **empty** and can be safely deleted.

## 4. Verification Checkpoints
After every batch, the CI/CD pipeline must execute:
- `npm run lint` (to catch broken import paths).
- `npm run test:unit` (to verify service logic boundaries).
- `npm test` (to ensure API contracts and End-to-End flows remain intact).

## 5. Rollback Strategy
Because the migration happens in batches via Git branches, rolling back a failed batch is as simple as reverting the PR. Dual-routing ensures that legacy components remain 100% functional while the new modules are phased in.
