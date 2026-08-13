# ATTENDANCE STATE MACHINE FIX

Date: 2026-08-13  
Phase: Attendance state machine + teacher late + admin make-up  
Status: **REVIEW / PARTIAL PASS** (unit evidence; no production writes)

## Production DB writes

**0**

## 1. Root cause

- UI mapped every non-completed/cancelled schedule → **Sắp tới** (StudentDetailModal).
- Teacher grace was **120m**; product chốt **60m**.
- Completing schedule did **not** always sync enrollment via recount SoT.
- Auto popup forced attendance UX after end / on load.
- No idempotent admin overdue notification + deep link.

## 2. State machine (derived; DB status unchanged)

| State | Condition | Teacher | Admin |
|-------|-----------|---------|-------|
| UPCOMING | now < start | no | no |
| IN_PROGRESS | start ≤ now ≤ end | yes | yes |
| PENDING_ATTENDANCE | end < now ≤ end+60m | yes | yes |
| OVERDUE_ATTENDANCE | now > end+60m & scheduled | no | **makeup yes** |
| COMPLETED | status=completed | no | no |
| CANCELLED | cancelled/no_show | no | no |

Constant: `ATTENDANCE_GRACE_MINUTES = 60` (`ATTENDANCE_LATE_GRACE_MINUTES` / `ATTENDANCE_GRACE_MINUTES` env).

## 3. Backend API

- `PUT /api/schedules/:id` `{ status: 'completed' }` → `services/attendanceService.completeScheduleAttendance`
  - Atomic `scheduled → completed`
  - `applyEnrollmentStats` recount
  - Teacher window enforced
  - Admin overdue → note `[ADMIN_MAKEUP] …`, meta `attendanceMethod: admin_makeup`
- GET teacher schedules: fire-and-forget `maybeNotifyOverdueAttendance` (dedupe `payload.dedupeKey = attendance-overdue:${scheduleId}`)

## 4. Notification

- Title: GV chưa điểm danh buổi học  
- Link: `/admin#students?studentId=&tab=attendance&scheduleId=`  
- AdminDashboard deep-opens StudentDetailModal + attendance tab + highlight row

## 5. Frontend

- `attendanceAction.js` / `scheduleTime.js` / StudentDetailModal status + **Điểm danh bù**
- TeacherDashboard: **no auto popup** on load
- Calendar labels for pending/overdue

## 6. Idempotency / concurrency

- `findOneAndUpdate({ status: 'scheduled' })` — second call → `ATTENDANCE_ALREADY_COMPLETED`
- Progress = recount completed schedules (not blind +=1)
- Residual: no multi-doc transaction; documented

## 7. Tests

```
node --test tests/unit/attendance_window.test.js \
  tests/unit/attendance_prompt_cooldown.test.js \
  tests/unit/attendance_tdz_status.test.js \
  tests/unit/scheduling_validation.test.js
→ 23 PASS / 0 FAIL
```

## 8. Files changed

- `services/attendanceWindow.js`
- `services/attendanceService.js` (new)
- `routes/scheduleRoutes.js`
- `client/src/utils/attendanceAction.js`
- `client/src/utils/attendancePrompt.js`
- `client/src/utils/scheduleTime.js`
- `client/src/components/StudentDetailModal.jsx`
- `client/src/components/AdminDashboard.jsx`
- `client/src/components/admin/hooks/useAdminDashboardState.jsx`
- `client/src/components/TeacherDashboard.jsx`
- `client/src/components/teacher/TeacherMonthlyCalendar.jsx`
- `tests/unit/attendance_window.test.js`
- `tests/unit/attendance_prompt_cooldown.test.js`
- `docs/attendance/ATTENDANCE_STATE_MACHINE_FIX_2026-08-13.md`

## 9. Files untouched

Auth, JWT, RBAC matrix, Messaging, Finance, Ledger, Refund, SePay, C4, Branch architecture, schedulingValidation rules.

## 10. Remaining risks

1. FE `markAttendance` still optimistically PUTs student counters — server recount should win on sync; prefer schedule-complete only.
2. Overdue notify only triggered when teacher schedule list is fetched (not a cron).
3. No full concurrent integration test against Mongo.
4. `reminderSent` reused as soft skip flag for overdue notify (was unused/cron-commented).

## Acceptance (evidence)

| AC | Result |
|----|--------|
| [1]–[4] state machine | PASS unit |
| [5] admin makeup + progress | PASS code path (applyEnrollmentStats) |
| [6] no double complete | PASS atomic update |
| [7] cancelled | PASS unit |
| [8]–[10] scheduling | PASS prior tests |
| [12] no force popup overdue | PASS FE |
| [13] TDZ | PASS prior test |
| Notification E2E | REVIEW (needs live admin session) |
