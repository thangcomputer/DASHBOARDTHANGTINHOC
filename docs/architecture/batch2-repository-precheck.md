# Sprint 4.2 Batch 2 — Core Domain Repository Precheck

## 1. Domain Inventory and Scope
The Core Domains for Batch 2 are:
1. **Student** (`modules/student`)
2. **Teacher** (`modules/teacher`)
3. **Course** (`modules/course`)
4. **Enrollment** (`modules/enrollment`)
5. **Attendance** (`modules/attendance`)

## 2. Dependency Graph and Cross-Domain Entanglements

### **Student Domain** (`studentRoutes.js`)
- **Own Models**: `Student`, `Group`
- **Cross-Domain Model Imports**:
  - `Teacher` (from Teacher Domain)
  - `TeacherAssignmentSegment` (from Teacher Domain)
  - `Schedule` (from Attendance Domain)
- **Risk Level**: High. The Controller directly imports Mongoose models from other domains to handle enrollment and scheduling logic.

### **Teacher Domain** (`teacherRoutes.js`, `employeeRoutes.js`)
- **Own Models**: `Teacher`, `TeacherAssignmentSegment`
- **Cross-Domain Model Imports**:
  - `Schedule` (from Attendance Domain)
  - `Transaction` (from Finance/Transaction Domain)
  - `Evaluation` (from Exam Domain)
- **Risk Level**: High. Direct entanglement with Attendance and Exam data.

### **Course Domain** (`courseRoutes.js`)
- **Own Models**: `Course`, `Assignment`, `Submission`, `TeachingGuide`, `TrainingCourse`, `TrainingLesson`, `TrainingProgress`
- **Cross-Domain Model Imports**:
  - `Student` (from Student Domain)
- **Risk Level**: Medium. Mainly queries Student records for enrollment counts.

### **Enrollment Domain** (`enrollmentService.js`)
- **Own Models**: (Virtual/Embedded in Student)
- **Cross-Domain Model Imports**:
  - `Course` (from Course Domain)
  - `Teacher` (from Teacher Domain)
- **Risk Level**: Medium. As a service, it contains significant business logic but violates the Service -> Model rule by directly querying Mongoose models.

### **Attendance Domain** (`scheduleRoutes.js`)
- **Own Models**: `Schedule`, `ScheduleHistory`
- **Cross-Domain Model Imports**:
  - `Student` (from Student Domain)
  - `Teacher` (from Teacher Domain)
- **Risk Level**: High. Attendance is heavily coupled with Teacher and Student data.

---

## 3. Architecture Violations Identified
1. **Controller -> Mongoose Model**: Almost all routes (`studentRoutes.js`, `courseRoutes.js`, etc.) query Mongoose directly.
2. **Controller -> Cross-Domain Model**: Controllers bypass boundaries by importing other domain's models directly.
3. **Fat Controllers**: Controllers contain complex filtering (e.g., regex searches, pagination logic) that should be abstracted into Repositories / Query Objects.

---

## 4. Proposed Design Solutions

### 4.1 Base Repository
We will introduce `shared/repositories/BaseRepository.js` providing:
- `findById(id)`
- `findOne(query)`
- `findMany(query, options)`
- `findPaginated(query, page, limit)`
- `create(data)`
- `update(id, data)`
- `delete(id)`
- `count(query)`

### 4.2 Query Objects (Design Only)
We will introduce Query Object patterns (e.g., `StudentQuery.activeInBranch(branchId)`) conceptually within the Repository method implementations (e.g., `studentRepository.findActiveByBranch(branchId)`), hiding raw Mongoose `$or` and regex constructs.

### 4.3 Transaction Readiness (Design Only)
No `session.startTransaction()` will be implemented yet. The repositories will be designed to accept an optional `options = { session: null }` parameter in all mutating methods. This paves the way for a future `UnitOfWork` pattern without breaking current logic.

### 4.4 Resolving Cross-Domain Model Imports
- **Rule**: Repositories MUST NEVER import Models from another domain.
- **Rule**: Controllers MUST NEVER import Repositories from another domain (Wait, if a controller needs data, it should call its own Service, which then calls the other domain's Service).
- **Execution Plan**: For this structural refactor, we will replace `Student.findOne()` in `courseRoutes.js` with `studentRepository.findOne()`. While ideally it should go through `studentService`, the ARB instruction says "Do NOT modify business behaviour" and strictly focuses on Repository abstraction. Where possible, we will route cross-domain queries through the target domain's Repository interface instead of the Mongoose Model.
