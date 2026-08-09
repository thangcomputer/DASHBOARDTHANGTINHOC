# Repository Inventory

## 1. Overview
This document catalogs the current state of data access across the 28 modules. A repository pattern requires decoupling all Mongoose models from Controllers and Services. The inventory below highlights the exact files and domains where Mongoose models are currently being directly imported and executed.

## 2. Model Import Discovery
Based on a global codebase scan (`grep -r 'models/' modules/`), there are **over 150 direct Model imports** scattered across the application.

### 2.1 Heavy Violators (Controllers & Routes)
Express route handlers and controllers currently execute direct database commands (e.g., `.find()`, `.aggregate()`, `.populate()`).
- **`modules/analytics/routes/analyticsRoutes.js`**: Imports `Student`, `Schedule`, `Branch`, `Course`, etc., to run massive aggregations.
- **`modules/attendance/routes/scheduleRoutes.js`**: Imports `Schedule`, `Student`, `Teacher`.
- **`modules/auth/authRoutes.js`**: Imports `Teacher`, `Student`, `SystemSettings`, `Notification`.
- **`modules/chat/routes/messageRoutes.js`**: Imports `Message`, `Group`, `Student`, `Teacher`, `SystemSettings`.
- **`modules/course/routes/*`**: Assignment, Course, TeachingGuide, and Training routes directly import 10+ models.
- **`modules/exam/routes/*`**: Evaluation, ExamResult, Proctor, and Quiz routes directly import their respective models.
- **`modules/student/routes/studentRoutes.js`**: Imports `Student`, `Tenant`, `Group`.
- **`modules/teacher/routes/teacherRoutes.js`**: Imports `Teacher`, `Branch`, `Course`.

### 2.2 Service Layer Violators
Services are intended to contain business logic, but they currently mix business logic with Mongoose queries.
- **`modules/chat/services/chatAccessService.js`**: Imports `Teacher`, `Student`.
- **`modules/cms/services/workflowService.js`**: Imports `WorkflowInstance`, `Teacher`, `Student`, `Transaction`.
- **`modules/finance/services/ledgerService.js`**: Imports `LedgerEntry`, `Invoice`, `Student`, `CreditNote`.
- **`modules/report/services/reportService.js`**: Imports `ReportDefinition`, `Course`, `Invoice`.

### 2.3 Cross-Domain Coupling Map
The inventory reveals that domains frequently import models from *other* domains.
- **CMS** → imports from **Teacher**, **Student**, **Transaction**.
- **Chat** → imports from **Student**, **Teacher**, **System**.
- **Finance** → imports from **Student**, **Invoice**.

## 3. Scope of Refactoring
To achieve complete Dependency Inversion (Controllers -> Services -> Repositories -> Models), we must:
1. Create ~30+ Repository classes.
2. Abstract Mongoose fluent APIs (e.g., `.populate()`, `.sort()`) into repository method arguments or specific repository query methods.
3. Rewrite over 150 `require()` statements.
4. Refactor the underlying logic inside those 150+ files to call `Service` or `Repository` methods instead of Mongoose directly.
