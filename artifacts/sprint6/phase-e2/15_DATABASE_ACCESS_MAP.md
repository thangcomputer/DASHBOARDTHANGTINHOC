# 15_DATABASE_ACCESS_MAP

## Objective
Map the structural separation of concerns regarding Database Access for the `Student` domain during the CQRS migration.

## Evidence

### Write Path (CQRS Migrated)
- **Entrypoint**: `POST /api/students` -> `CQRSStudentController.create`
- **Data Access Layer**: `modules/student/repositories/StudentRepository.js`
- **Mechanism**: The Command Handler delegates explicitly to the decoupled `StudentRepository` interface. It does NOT interact with Mongoose models directly in the handler. The Repository encapsulates the Mongoose `ClientSession` propagation.
- **Transaction Guarantee**: Exclusively requires `MongoDB Replica Set` functionality to ensure multi-document atomicity (`Student`, `Invoice`, `LedgerEntry`, `OutboxEvent`).

### Read Path (Legacy Preserved)
- **Entrypoint**: `GET /api/students`, `GET /api/students/:id`, etc.
- **Data Access Layer**: `routes/studentRoutes.js` (legacy callbacks)
- **Mechanism**: Direct interaction with `const Student = require('../models/Student')` using `Student.find()`, `Student.aggregate()`, and `Student.findById()`.
- **Justification**: This aligns strictly with the CQRS philosophy (Command Query Responsibility Segregation). The Write path operates on strict Aggregate boundaries and ACID transactions, while the Read path bypasses the domain logic for raw read performance and projection flexibility.

## Verdict
[VERIFIED]
The system correctly demonstrates a strict divergence of database access mechanisms: the Write path uses strict Repository-driven encapsulated mutations, while the Read path maintains direct fast-path model querying.
