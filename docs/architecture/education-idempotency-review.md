# Education Domains Idempotency Review
## Overview
While CQRS establishes a unified pipeline, it also exposes vulnerabilities to duplicate commands, particularly during retries.
## Recommendations (For Future Implementation)
- **Enrollment Commands**: `EnrollmentPost_rootCommand` must require an `Idempotency-Key` to prevent users from accidentally clicking "Enroll" twice and generating dual invoices.
- **Attendance Commands**: `AttendancePost_rootCommand` (Check-in) is naturally idempotent if the payload keys on `studentId + date`, but an explicit `Idempotency-Key` header ensures network retry safety.
*(No implementation made per instructions)*.
