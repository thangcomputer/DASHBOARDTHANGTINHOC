# Education Core Event Review
## Overview
Every command in the `Teacher`, `Course`, `Enrollment`, and `Attendance` domains natively fires a corresponding `Completed` DomainEvent (e.g., `TeacherPost_rootCompleted`, `CoursePut_idCompleted`).
## Architecture
These events bypass RabbitMQ/Kafka per instructions, relying on the native Node.js Event Loop via the central `EventBus`.
