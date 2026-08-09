# Mongo Transaction Readiness
## Repository Review
- **Single-document**: `UserRepository.updateProfile`, `ClassRepository.addStudent`.
- **Multi-document (Requires Native Mongo Transactions)**: 
  - `PaymentRepository.confirm` (Updates Invoice, Updates Tuition, Updates Student Status).
  - `EnrollmentRepository.register` (Creates Student, Creates Enrollment).
- **Eventual Consistency**: Push Notifications, Activity Audit Logging (safe to emit via EventBus post-commit).
