# Phase 7 Gate — Schedule + Teacher reassignment

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 6 PASS

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| Service | `services/teacherReassignmentService.js` |
| Segment history | `models/TeacherAssignmentSegment.js` |
| API | `PUT /api/students/:id/assign-teacher` → gọi reassign service |
| Future schedules | Chỉ cập nhật `status=scheduled` sang GV mới |
| Completed ownership | Giữ `teacherId` trên buổi đã dạy (payroll split) |
| Progress | `completedSessions` / `remainingSessions` không bị reset (assert) |
| Audit + History | `teacher.reassign` + `ScheduleHistory.TEACHER_REASSIGNED` |
| Notify | GV mới + HV |
| Tests | `tests/integration/teacherReassignPhase7.test.js` (case 8/12) |

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | Split 8 GV-A / 12 GV-B trên completed | PASS (test) |
| 2 | Scheduled không tính payroll | PASS (test) |
| 3 | Progress không reset | PASS (test) |
| 4 | assign-teacher dùng reassignTeacher | PASS (static) |
| 5 | Segment model + TEACHER_REASSIGNED enum | PASS |

## Không làm (Phase 13 payroll chi lương)

- Tự động tạo Transaction từ split
- UI timeline segment đầy đủ

## Kết luận

**PASS** — Phase 7 tests: 8/8 xanh (`teacherReassignPhase7.test.js`).

Phase tiếp theo: **Phase 8 — Attendance**.

