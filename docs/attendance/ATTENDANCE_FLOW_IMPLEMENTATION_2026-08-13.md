# ATTENDANCE FLOW IMPLEMENTATION

Date: 2026-08-13  
Phase: ATTENDANCE-FLOW-STRICT-02  
Status: **REVIEW / PARTIAL** — Correction Request BLOCKED

## Production DB writes

**0**

## What shipped (minimal)

### Backend
- `services/attendanceWindow.js` — server-clock window: `IN_PROGRESS` / `LATE` / `WINDOW_EXPIRED`
- Grace default: `ATTENDANCE_LATE_GRACE_MINUTES` (env) or **120**
- `PUT /api/schedules/:id` → `completed` (teacher): enforces window; LATE requires `lateReason`; stores `[LATE] …` in `Schedule.note`
- Duplicate complete → `409 ATTENDANCE_ALREADY_COMPLETED`
- `POST /api/schedules` with `status=completed` (teacher): same window rules
- Admin/Staff may still complete after grace (manual stand-in until Correction model/RBAC)

### Frontend
- `client/src/utils/attendanceAction.js` — `getAttendanceAction` shared resolver
- `attendancePrompt.js` — modes: `checkin` | `late` | `expired`
- Teacher popup: correct wording, late reason, **Đóng / ESC / backdrop**, queue count, no “Điểm danh ngay” after grace
- `markAttendance(..., lateReason)` passes reason to schedule update
- No-show after end → `status: no_show` (cancel API blocked past dates)

### Already in place (prior phase)
- Session cap + 1 ca/ngày + overlap: `services/schedulingValidation.js`
- Teacher multi-student isolation for session/daily limits
- TDZ fix on student PUT enrollment path

## BLOCKED / not shipped

| Item | Reason |
|------|--------|
| CorrectionRequest create/approve | No model; would need new RBAC (§29/§35 STOP) |
| Dedicated Attendance document | Grades lack `scheduleId`; schema migration avoided |
| Full Schedule enum state machine | Avoid migration; window derived in service |
| Teacher self-serve correction after grace | UI button informs Admin path only |

## Files changed

- `docs/attendance/ATTENDANCE_FLOW_AUDIT_2026-08-13.md`
- `docs/attendance/ATTENDANCE_FLOW_IMPLEMENTATION_2026-08-13.md`
- `services/attendanceWindow.js` (new)
- `routes/scheduleRoutes.js`
- `client/src/utils/attendanceAction.js` (new)
- `client/src/utils/attendancePrompt.js`
- `client/src/context/useDataSchedule.js`
- `client/src/components/TeacherDashboard.jsx`
- `tests/unit/attendance_window.test.js` (new)
- `tests/unit/attendance_prompt_cooldown.test.js` (updated)

## Files not changed

Auth, JWT, RBAC matrix, Messaging, Finance, Ledger, Refund, SePay, C4, Branch architecture, Attendance module rewrite.

## Tests (evidence)

```
node --test tests/unit/attendance_window.test.js \
  tests/unit/attendance_prompt_cooldown.test.js \
  tests/unit/attendance_tdz_status.test.js \
  tests/unit/scheduling_validation.test.js \
  tests/unit/scheduling_limits_client.test.js
→ 33 PASS / 0 FAIL
```

## Acceptance map

| AC | Result |
|----|--------|
| AC-01..04 session/daily/overlap/multi-HV | PASS (schedulingValidation tests) |
| AC-05..06 teacher ownership | PASS (existing schedule PUT teacher check) |
| AC-07..09 window / late / expired | PASS (attendance_window unit) |
| AC-10..11 correction | **BLOCKED** |
| AC-12..14 duplicate / completed | PASS (ALREADY_COMPLETED + window) |
| AC-15 enrollment cancelled | Partial — student PUT path; schedule complete does not re-check enrollment status in this patch |
| AC-16..18 popup wording / closable / queue | PASS (FE) |
| AC-19 server time | PASS (assert uses schedule from DB + Date.now) |
| AC-20 no Auth/Finance/… | PASS |

## Remaining risks

1. Correction after grace still needs Admin/Staff manual `PUT completed`.
2. `markAttendance` can still `POST` create completed if no scheduleId match — teachers are window-gated, but prefer always passing scheduleId.
3. Enrollment `active` not re-asserted on schedule complete in this patch.
4. 12h cooldown still keyed off completed schedule `createdAt` (create path) — known prior SoT; not removed (scope conflict report only).
5. FE grace clock can drift vs server — server still enforces.

## Out of scope

Correction architecture, RBAC, Attendance entity migration, Finance/Messaging/Auth.
