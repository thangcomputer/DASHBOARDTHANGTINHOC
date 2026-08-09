# 📘 Final Software Architecture Specification (SAS v2.0)
## DASHBOARDTHANGTINHOC — Education Management ERP/LMS
### Chief Architect Approval | Pragmatic Enterprise Architecture Standard

This document establishes the official architectural standards, module boundaries, coding guidelines, and scalability patterns for the **DASHBOARDTHANGTINHOC** project. All future development and refactoring MUST strictly adhere to this specification.

---

## 1. Final Business Domains

The system is organized into **7 core business domains**. Each domain groups related capabilities and defines high-level logical boundaries.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          DASHBOARDTHANGTINHOC                           │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ├── 🎓 Academic Domain        (Student, Teacher, Course, Schedule, Exam)
    ├── 💰 Finance Domain         (Tuition, Payments, Refunds, Ledger)
    ├── 💬 Communication Domain   (Chat, Notifications, Announcements)
    ├── ⚙️ System Domain          (Auth, Permissions, Branch, Settings, Tenant)
    ├── 📝 CMS Domain             (Blog, News, Media)
    ├── 📊 Analytics Domain       (Dashboard, Financial & Academic Reports)
    └── 🤖 AI Domain              (Future Chatbot, Grading, Recommendations)
```

### Domain Descriptions
1. **Academic Domain**: Handles student lifecycle, teacher schedules, courses, course registry, class hours, test/exam execution, and grading.
2. **Finance Domain**: Manages tuition invoices, payment processing (including automatic QR matching via SePay), refund approvals, and double-entry ledger bookkeeping.
3. **Communication Domain**: Drives real-time chat (1:1 and groups) and automated multi-channel notifications (in-app, email, SMS).
4. **System Domain**: Cross-cutting foundation handling authentication, authorization (RBAC), multi-branch isolation, multi-tenant configs, and central settings.
5. **CMS Domain**: Manages public pages, blogs, news feeds, public forms, and static media files.
6. **Analytics Domain**: Aggregates business data to generate real-time metrics, financial statements, student performance reviews, and BI reporting.
7. **AI Domain (Future)**: Houses machine learning capabilities like OCR reading, automatic grading, test generation, and personalized learning recommendations.

---

## 2. Final Modules

To balance maintainability and keep cognitive load low for a small development team (1-3 developers), the system is organized into **16 business modules**. Small, trivial concerns are merged to avoid directory fragmentation.

```text
modules/
├── auth/           # Identity verification (Login, Logout, MFA, password reset, OAuth)
├── student/        # Student registry + enrollments (merged) + completion certificates
├── teacher/        # Teacher registry + class assignments + lesson logs
├── course/         # Course catalog + pricing
├── schedule/       # Class scheduling + student attendance tracking (merged)
├── exam/           # Question bank + quiz builder + online test room + proctor/anti-cheat
├── finance/        # Payments + refunds + ledger transactions (all 3 in one module)
├── chat/           # Real-time instant messaging + file sharing
├── notification/   # Push alerts + email dispatch + announcements
├── branch/         # Branch / Center registry + regional configurations
├── settings/       # Global system flags + configuration parameters
├── support/        # Help center + support tickets
├── cms/            # Blogs + news cards + landing content
├── analytics/      # General dashboards + PDF reports
├── tenant/         # White-label tenancy setup (future scaling)
└── ai/             # GenAI helper services (future scaling)
```

---

## 3. Backend Folder Structure (3-Layer Architecture)

We utilize a **3-Layer Architecture** (Controller → Service → Model) inside a **Modular Monolith** package structure. The heavy database abstraction layers (Repository Pattern) and dummy wrappers (DTOs) are removed to minimize code indirection.

```text
src/
├── bootstrap/                          # App initialization
│   ├── app.js                          # Express app configuration
│   ├── database.js                     # MongoDB connection
│   ├── redis.js                        # Redis connection
│   ├── socket.js                       # Socket.io connection & rooms
│   └── routes.js                       # Route mounting orchestrator
│
├── shared/                             # Stateless code used across modules
│   ├── middleware/
│   │   ├── authenticate.js             # JWT extraction & identification
│   │   ├── authorize.js                # Permission checks: authorize('student:write')
│   │   ├── validate.js                 # Validation schema wrapper
│   │   ├── rateLimiter.js              # Rate limits (Redis-backed)
│   │   └── branchFilter.js             # Scopes queries to user's branch
│   ├── errors/
│   │   ├── AppError.js                 # Base HTTP error class
│   │   ├── ValidationError.js          # 400 Bad Request
│   │   ├── NotFoundError.js            # 404 Not Found
│   │   └── ForbiddenError.js           # 403 Forbidden
│   ├── utils/
│   │   ├── cache.js                    # Redis cache helper
│   │   └── responseBuilder.js          # Standard response JSON formatter
│   └── constants/
│       └── permissions.js              # System-wide permissions dictionary
│
├── modules/                            # Bounded Context modules
│   ├── student/
│   │   ├── student.routes.js           # Endpoint paths & validation middleware
│   │   ├── student.controller.js       # HTTP req parsing & status codes
│   │   ├── student.service.js          # Core business logic & DB operations
│   │   ├── student.validator.js        # Joi/Zod input validation rules
│   │   └── __tests__/                  # Unit/Integration tests
│   │       └── student.service.test.js
│   └── ...                             # Other modules follow this pattern
│
├── models/                             # Shared read-only schemas (Mongoose)
│   ├── Student.js
│   ├── Teacher.js
│   ├── Course.js
│   └── ...
│
├── infrastructure/                     # Outbound integrations
│   ├── email/                          # Mail dispatch adapter (Nodemailer)
│   ├── storage/                        # Disk / S3 upload helper
│   └── queue/                          # Redis BullMQ queues & workers
│
├── config/                             # Env validations & constants
└── server.js                           # Entry point
```

---

## 4. Frontend Folder Structure (Feature-Based)

The frontend codebase is organized using **Feature-Based Architecture**. Files are grouped by business feature rather than technical file type (reducers, views, pages).

```text
client/src/
├── app/
│   ├── App.jsx                         # Main app component
│   ├── router.jsx                      # React Router route registry
│   └── providers.jsx                   # Wrapper compositing Context Providers
│
├── shared/                             # Global components and helpers
│   ├── components/                     # Pure UI (Button, Modal, Table, Card)
│   ├── hooks/                          # Reusable helpers (useAuth, useDebounce)
│   ├── utils/                          # Pure functions (formatCurrency)
│   └── layouts/                        # Frame templates (DashboardLayout)
│
├── features/                           # Self-contained business features
│   ├── student/
│   │   ├── components/                 # Sub-elements (StudentTable, StudentFilters)
│   │   │   └── StudentDetailModal/     # God Component split into smaller views
│   │   │       ├── index.jsx           # Tab selector & orchestrator
│   │   │       ├── ProfileTab.jsx      # Personal info
│   │   │       └── EnrollmentTab.jsx   # Enrolled classes
│   │   ├── hooks/                      # Feature hooks (useStudents, useStudentDetail)
│   │   ├── services/
│   │   │   └── studentApi.js           # API fetch definitions for student features
│   │   └── pages/
│   │       └── StudentManagementPage.jsx
│   └── ...
│
├── services/                           # Shared network layer
│   ├── apiClient.js                    # Base Axios/Fetch instance & interceptors
│   └── tokenManager.js                 # Access/Refresh token cache
└── styles/
    └── index.css                       # Tailwind + overrides
```

---

## 5. Dependency Rules

We enforce **3 Simple Dependency Rules** to prevent the project from decaying into a "spaghetti" codebase:

```text
┌───────────────────────────┐
│       Shared Layers       │  ◄── Can be imported by ANY module
│ (shared/, config/, model/)│
└─────────────▲─────────────┘
              │
┌─────────────┴─────────────┐
│      Module Services      │  ◄── CANNOT call each other directly
│     (student, finance)    │      (Use controller orchestration or domain events)
└───────────────────────────┘
```

1. **Shared layers are open**: Files in `shared/`, `config/`, and `models/` have zero business dependencies and can be imported by any module controller or service.
2. **Horizontal isolation**: Module services MUST NOT import services from other modules directly.
   * *Allowed*: A controller calls `studentService` and then `financeService` sequentially to handle a multi-module action.
   * *Allowed*: Services communicate asynchronously via simple callback integrations or event notifications if necessary.
3. **Outward Dependency**: Database models, schemas, and framework configurations (`models/`, `infrastructure/`) must never contain business rules or reference module services.

---

## 6. Architecture Decision Records (ADR)

### ADR-001: Pragmatic Modular Monolith
* **Status**: Approved.
* **Context**: The team size is small (1-3 developers). Microservices add operational complexity, data consistency overhead, and deployment costs.
* **Decision**: Adopt a Modular Monolith. Ensure strong encapsulation using directory boundaries (`modules/`).
* **Consequences**: Single repository, unified deployment pipeline, easy debugging, and direct database queries while maintaining boundaries for future microservice extraction if needed.

### ADR-002: Document Store with MongoDB
* **Status**: Approved.
* **Context**: Educational profiles (exam logs, dynamic settings, user settings) have flexible schemas.
* **Decision**: Run a document-based store (MongoDB) via Mongoose. Optimize via compound indexes.
* **Consequences**: Rapid schema alterations without SQL migrations. Transactions are used only for sensitive ledger actions.

### ADR-003: Skip Repository Pattern (Direct Model Queries)
* **Status**: Approved.
* **Context**: Mongoose acts as a complete Data Access Layer. Adding a Repository wrapper class creates duplicate proxy functions (e.g., `userRepo.find(q) => UserModel.find(q)`), adding boilerplate with no value.
* **Decision**: Query Mongoose models directly inside the Service layer. Use separate query helper files (`*.queries.js`) ONLY for complex queries exceeding 5 lines.
* **Consequences**: Boilerplate is reduced by 25%. Testing is handled by mocking Mongoose queries via stubbing libraries.

### ADR-004: 2-Level Permission-Based Access Control
* **Status**: Approved.
* **Context**: Hardcoded checks (e.g., `role === 'admin'`) are prone to missing checks and cannot adapt to custom role/permissions requirements.
* **Decision**: Use a two-level permission check: `{resource}:{action}` (e.g., `student:create`, `finance:manage`). Roles are merely collection containers for permissions.
* **Consequences**: Adding roles does not require code changes. Checking permissions is centralized in the `authorize` middleware.

### ADR-005: Feature-Based Frontend Structure
* **Status**: Approved.
* **Context**: Storing files in flat folders (`components/`, `pages/`, `hooks/`) creates navigation bloat when the component count exceeds 50.
* **Decision**: Group all frontend code in feature folders inside `client/src/features/`.
* **Consequences**: Easy feature code-splitting, modular bundle sizing, and developers find all files related to a feature in a single folder.

### ADR-006: Embedded Enrollments Array in Student
* **Status**: Approved.
* **Context**: Moving `enrollments` into a separate collection requires rewriting dozens of existing queries and components.
* **Decision**: Retain the embedded `enrollments` array inside the `Student` schema. Postpone collection splitting until the student count exceeds 50,000 documents OR enrollment queries degrade below 200ms p95.
* **Consequences**: Maintains backward compatibility, reduces refactoring risk, and maintains high performance at the current scale.

### ADR-007: Direct Service Calls Over EventBus
* **Status**: Approved.
* **Context**: Event emitters (EventBus) obscure stack traces and make control flows hard to trace for developers debugging issues linearly.
* **Decision**: Perform explicit, direct service calls across modules via Controller orchestration, rather than utilizing decoupled event messages.
* **Consequences**: Clear, traceable, and easily debugged code. If the application scales to microservices, these direct orchestration points will serve as the transition points to event brokers.

---

## 7. Coding Standards

* **No God Files**: Files should remain concise. Use these limits as targets:
  * Controllers: max 400 lines.
  * Services: max 500 lines.
  * React Components: max 400 lines (split sub-elements when exceeded).
* **Validators over DTOs**: JavaScript is dynamically typed. Rather than creating empty DTO classes, use Joi or Zod validators to enforce schema rules at the entry boundary.
* **Projections**: Never load full database objects unless writing them. Always use `.select('name phone')` and `.lean()` for performance.
* **Clean Code**: Business logic lives in the Service layer. Controllers only handle HTTP statuses, and Routes only declare paths and middleware chains.

---

## 8. Naming Conventions

* **Files**:
  * Backend layer files: `{module}.{layer}.js` (e.g., `student.service.js`, `student.routes.js`).
  * Frontend components: `PascalCase.jsx` (e.g., `StudentTable.jsx`).
  * Frontend hooks: `use{HookName}.js` (e.g., `useStudents.js`).
* **Folders**:
  * Module folders: lowercase singular (e.g., `student/`, `course/`).
  * Component folders: PascalCase (e.g., `StudentDetailModal/`).
* **Variables & Functions**:
  * JavaScript uses `camelCase` for variable and function names.
  * Methods must start with a verb (e.g., `getStudents`, `calculateTuition`).
  * Constants use `UPPER_SNAKE_CASE` (e.g., `DEFAULT_PAGE_LIMIT`).

---

## 9. Module Boundaries

Every module must maintain a strict API interface:
* **Private Code**: Controllers, services, and schemas within a module directory are private to that module.
* **Public Interface**: External modules must only interact via standard API calls or direct public methods exposed in the module's main `service.js`. Direct imports of internal files (like schemas or validators) from another module are strictly prohibited.
* **Database Isolation**: A module must never query or modify collections owned by another module directly (e.g., `teacherService` must not perform `Student.update()`; it must call `studentService.update()`).

---

## 10. Scalability Review (10x Target Scale)

We design the architecture to support **10x the current scale** (10,000+ students, 100+ branches, and millions of real-time events) with the following optimizations:

```text
SCALABILITY STRATEGIES:
  ├── Database   → Lean queries, projections, compound indexes, archive old chat records
  ├── Network    → PM2 cluster mode, stateless controllers, CDN for media uploads
  ├── Real-time  → Redis Adapter for Socket.io horizontal load balancing
  └── Tasks      → BullMQ queues with Redis for asynchronous job processing
```

1. **Database Indexes**: Compound indexes are configured for all high-volume queries (e.g., `{ studentId: 1, createdAt: -1 }` on `attendance`).
2. **Cursor Pagination**: Large feeds (chat messages, activity logs) must use cursor-based pagination (`cursor=abc123`) instead of offsets (`skip(10000)`) to avoid performance degradation.
3. **Queue Processing**: All slow IO tasks (sending transactional emails, push notifications, generating invoice PDFs) are offloaded to BullMQ background workers running on separate threads.
4. **Stateless Operations**: Session states are handled via JWT tokens and database stores, allowing the Node.js backend to scale horizontally in PM2 cluster mode behind a load balancer.

---

**APPROVED BY:**
*Chief Software Architect*
*DASHBOARDTHANGTINHOC*
