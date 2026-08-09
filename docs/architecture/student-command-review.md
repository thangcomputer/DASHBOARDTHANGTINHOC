# Student Domain Command Review

## Overview
All write operations within the `Student` domain have been successfully extracted into discrete CQRS Commands located in `modules/student/commands/`.

## Registered Commands
The following Commands have been registered and wired to the `CommandBus`:
- `Post_importCommand`
- `Post_rootCommand`
- `Put_idCommand`
- `Put_id_exam_progressCommand`
- `Patch_id_priceCommand`
- `Put_id_payCommand`
- `Put_id_refundCommand`
- `Put_id_unlock_examCommand`
- `Put_id_lock_examCommand`
- `Put_id_assign_teacherCommand`
- `Delete_idCommand`
- `Post_id_reset_today_attendanceCommand`
- `Post_id_reset_historyCommand`
- `Put_id_pay_teacherCommand`

## Boundary Enforcement
- Controllers no longer parse these requests for business logic.
- Each Command strictly encapsulates its DTO payload.
- All Commands dispatch asynchronously via `CommandBus`.
