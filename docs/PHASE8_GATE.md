# Phase 8 Gate — Attendance

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 7 PASS

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| Schema | `Schedule.attendanceStatus` (`present\|absent\|late\|excused`) + `attendanceMarkedAt/By/Note` |
| Service | `services/attendanceService.js` — mark/correct, map → `completed`/`no_show`, missed notify |
| API | `POST /api/schedules/:scheduleId/attendance` |
| Compat | PUT schedule `status=completed\|no_show` đồng bộ attendance nếu chưa có |
| Audit | `attendance.mark` / `attendance.correct` / `attendance.reset` |
| Notify HV | Điểm danh + sửa điểm danh |
| Cron | `notifyMissedAttendance` (mặc định phút 15 mỗi giờ; tắt `ATTENDANCE_MISS_CRON=0`) |
| Reset legacy | `reset-today-attendance` ghi audit `attendance.reset` |
| Tests | `tests/integration/attendancePhase8.test.js` |

## Mapping nghiệp vụ

| attendanceStatus | Schedule.status | Payable (payroll) |
|------------------|-----------------|-------------------|
| present | completed | yes |
| late | completed | yes |
| absent | no_show | no |
| excused | no_show | no |

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | present/late → completed + payable | PASS (test) |
| 2 | absent/excused → no_show | PASS (test) |
| 3 | Sửa điểm danh (correction) được phép | PASS (test) |
| 4 | API attendance + service wired | PASS (static) |
| 5 | Cron thiếu điểm danh | PASS (static) |
| 6 | Schema fields | PASS (test) |

## Không làm (phase sau)

- UI đầy đủ 4 trạng thái trên mọi client (có thể vẫn dùng completed/no_show)
- Session payroll chi lương (Phase 13)
- Soft-reset thay vì deleteMany trên reset-today (legacy grades)

## Kết luận

**PASS** — Phase 8 tests xanh (`attendancePhase8.test.js`).

Phase tiếp theo: **Phase 9 — Exam**.
