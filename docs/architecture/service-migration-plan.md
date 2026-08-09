# Service Extraction Migration Plan

## Batch 1
- **Domains**: Auth, Notification, System, Tenant, Branch
- **Focus**: Core infrastructure and base entity domains.

## Batch 2
- **Domains**: Student, Teacher, Course, Enrollment, Attendance
- **Focus**: Core educational operations. High complexity expected in `studentRoutes.js`.

## Batch 3
- **Domains**: Finance, Invoice, Payment, Transaction
- **Focus**: Transactional atomicity and ledger integrity.

## Batch 4
- **Domains**: Exam, Certificate, Analytics, Report, CMS, Chat, AI
- **Focus**: Peripheral and downstream analytics systems.
