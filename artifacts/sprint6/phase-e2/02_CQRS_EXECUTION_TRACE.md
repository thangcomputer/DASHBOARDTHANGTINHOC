# 02_CQRS_EXECUTION_TRACE

## Objective
Trace the actual runtime path from the entry point to MongoDB persistence.

## Hops

### HOP 1: Server to Route
- **File**: `server.js`
- **Caller**: `app.use('/api/students', studentRoutes)`
- **Callee**: `routes/studentRoutes.js`
- **Evidence**: `server.js` line 717
- **Status**: [VERIFIED]

### HOP 2: Route to CQRS Controller
- **File**: `routes/studentRoutes.js`
- **Caller**: `router.post('/')`
- **Callee**: `CQRSStudentController.create()`
- **Evidence**: `routes/studentRoutes.js` line 570
- **Status**: [VERIFIED]

### HOP 3: CQRS Controller to Orchestrator
- **File**: `modules/student/controllers/CQRSStudentController.js`
- **Caller**: `CQRSStudentController.create()`
- **Callee**: `StudentApplicationOrchestrator.createStudentWithInvoice()`
- **Evidence**: `CQRSStudentController.js` line 24
- **Status**: [VERIFIED]

### HOP 4: Orchestrator to CommandBus
- **File**: `modules/student/services/StudentApplicationOrchestrator.js`
- **Caller**: `StudentApplicationOrchestrator.createStudentWithInvoice()`
- **Callee**: `CommandBus.dispatch(studentCommand)`
- **Evidence**: `StudentApplicationOrchestrator.js` line 27
- **Status**: [VERIFIED]

### HOP 5: CommandBus to CreateStudentHandler
- **File**: `shared/cqrs/CommandBus.js`
- **Caller**: `CommandBus.dispatch()`
- **Callee**: `CreateStudentHandler.execute()`
- **Evidence**: `CommandBus.js` line 37
- **Status**: [VERIFIED]

### HOP 6: CreateStudentHandler to StudentAggregate
- **File**: `modules/student/commands/CreateStudentHandler.js`
- **Caller**: `CreateStudentHandler.execute()`
- **Callee**: `StudentAggregate.create()`
- **Evidence**: `CreateStudentHandler.js` line 22
- **Status**: [VERIFIED]

### HOP 7: CreateStudentHandler to StudentRepository
- **File**: `modules/student/commands/CreateStudentHandler.js`
- **Caller**: `CreateStudentHandler.execute()`
- **Callee**: `StudentRepository.save()`
- **Evidence**: `CreateStudentHandler.js` line 28
- **Status**: [VERIFIED]

### HOP 8: StudentRepository to MongoDB
- **File**: `modules/student/repositories/StudentRepository.js`
- **Caller**: `StudentRepository.save()`
- **Callee**: `studentDoc.save({ session })` (Mongoose)
- **Evidence**: `StudentRepository.js` line 15
- **Status**: [VERIFIED]
