# Transaction Boundary Analysis
## Core Business Transactions
1. **Student Registration**: Creates User, Student, and Enrollment records.
2. **Invoice Creation**: Generates Invoice, logs audit, and updates Tuition balances.
3. **Payment Confirmation**: Updates Invoice status, triggers Revenue calculation, sets Course access.
4. **Refund Processing**: Adjusts Revenue, voids Invoice, deactivates Enrollment.
5. **Grade Submission**: Updates Submission score, creates GradeHistory, updates ExamResult.
6. **Certificate Issuing**: Validates completion, creates Certificate, triggers notification.
