# Saga Readiness
## Workflow Identification
1. **Student Registration Saga**: 
   - Step 1: Create User (Compensate: Delete User).
   - Step 2: Create Enrollment (Compensate: Delete Enrollment).
   - Step 3: Send Welcome Email (No compensation needed).
2. **Payment Processing Saga**:
   - Step 1: Mark Invoice Paid.
   - Step 2: Update Student Balance.
   - Step 3: Trigger Course Access.
   - *Rollback Strategy*: Reverse balance, revert invoice status, revoke access.
