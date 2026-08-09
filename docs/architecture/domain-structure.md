# Target Domain Structure

## 1. Overview
This document outlines the target folder structure for DASHBOARDTHANGTINHOC, transitioning from a technical-layer architecture (`routes/`, `controllers/`, `services/`) to a Domain-Driven Modular architecture (`modules/<domain>/`).

## 2. Target Folder Strategy
The application will pivot to feature-based organization. Every business domain will become a self-contained module exposing its own routes, controllers, services, and models.

### Proposed Directory Layout
```text
DASHBOARDTHANGTINHOC/
├── bootstrap/                   # Global startup, DB connections, Express setup
├── client/                      # Frontend SPA
├── config/                      # Environment variables
├── docs/                        # Architecture documentation
├── shared/                      # Domain-agnostic infrastructure
│   ├── context/                 # Tenant, Policy, and Request Context
│   ├── errors/                  # Custom Error Classes
│   ├── logger/                  # Audit and System Loggers
│   ├── middleware/              # Global Middleware (RBAC, Rate Limits)
│   └── utils/                   # Pure helper functions
├── modules/                     # **NEW DOMAIN MODULES**
│   ├── auth/                    # Identity, Authentication, JWT, Tokens
│   ├── student/                 # Student profile, CRM, Groups
│   ├── teacher/                 # Teacher profile, Assignments, KPI
│   ├── course/                  # Curriculum, Lessons, Teaching Guides
│   ├── enrollment/              # Class assignment, Registrations
│   ├── attendance/              # Scheduling, Time-tracking, Attendance
│   ├── exam/                    # Quizzes, Results, Proctoring
│   ├── certificate/             # Diploma generation and validation
│   ├── finance/                 # Invoices, Ledger, Revenue, Payroll
│   ├── payment/                 # Webhooks (SePay), Payment Sessions
│   ├── notification/            # Email, SMS, Zalo, In-app Messages, Chat
│   ├── cms/                     # Blogs, Feeds, Banners, Files
│   ├── ai/                      # OpenAI integrations, Auto-grading
│   ├── branch/                  # Branch Management
│   ├── tenant/                  # Tenant configurations
│   └── report/                  # Analytics, Monitoring, System Logs
└── tests/                       # Global Integration Tests
```

## 3. Internal Module Anatomy
Each domain within the `modules/` folder will adhere to a strict internal structure to guarantee predictability.

```text
modules/finance/
├── finance.routes.js            # API Endpoint definitions
├── finance.controller.js        # Request/Response orchestration
├── finance.service.js           # Core business logic
├── finance.validation.js        # Joi/Zod payload schemas
├── models/                      # Domain-specific schemas
│   ├── Invoice.js
│   ├── Transaction.js
│   └── LedgerEntry.js
├── events/                      # Pub/Sub Event Listeners/Emitters
│   └── invoicePaid.listener.js
└── __tests__/                   # Domain-specific Unit Tests
```

## 4. Module Boundaries & Communication Rules
1. **Encapsulation**: Controllers, Routes, and Data Models are **private** to the module. They must not be imported by other domains.
2. **Synchronous Communication**: If `finance` needs `student` data, `finance.service.js` must call `StudentService.getStudentById()`. It must never run `StudentModel.findById()`.
3. **Asynchronous Communication**: Long-running or side-effect operations (e.g., sending an email after payment) must occur via Domain Events located in the `events/` folder, utilizing the central `shared/queue/` or an `EventEmitter`.
4. **Global Registry**: The `bootstrap/app.js` (or similar) will automatically discover and mount `*.routes.js` files from the `modules/` directory onto the Express router.

## 5. Conclusion
This target structure provides extremely high cohesion. If a developer needs to modify Invoice logic, 100% of the related files will be collocated within `modules/finance/`. It lays the exact foundation required for a future migration to microservices, should traffic scale to that point.
