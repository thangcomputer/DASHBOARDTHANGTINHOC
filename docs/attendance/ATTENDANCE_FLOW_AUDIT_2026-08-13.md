# ATTENDANCE FLOW AUDIT

Date: 2026-08-13  
Phase: ATTENDANCE-FLOW-STRICT-02  
Status: AUDIT COMPLETE — partial implementation allowed; Correction BLOCKED

## 1. Current flow (evidence)

Attendance is **not** a first-class document.

Teacher mark path:
1. FE `useDataSchedule.markAttendance` (`client/src/context/useDataSchedule.js`)
2. `PUT /api/schedules/:id` `{ status: 'completed' }` **or** `POST /api/schedules` with `status: 'completed'`
3. `PUT /api/students/:id` grades + session counters

Schedule statuses (`models/Schedule.js`): `scheduled | completed | cancelled | no_show` only.

No Attendance model. No CorrectionRequest model. Grades lack `scheduleId`.

## 2. SoT today

| Concern | SoT |
|---------|-----|
| Buổi học / thời gian / GV–HV | `Schedule` |
| Đã điểm danh? | `Schedule.status === 'completed'` |
| Cooldown 12h | List enrichment from completed Schedule `createdAt` |
| Progress / cap xếp lịch | `services/schedulingValidation.js` (scheduled+completed counts) |
| Learning access | `enrollment.status === 'active'` |

## 3. Gaps vs desired

| Desired | Exists? |
|---------|---------|
| Schedule-bound attendance | Partial (PUT schedule) |
| IN_PROGRESS / ATTENDANCE_PENDING statuses | No (UI-derived only) |
| LATE_ATTENDANCE + grace | **No** |
| ATTENDANCE_WINDOW_EXPIRED | **No** |
| Correction request + Admin approve | **No** — STOP (RBAC/model) |
| Server time window | **No** (popup uses client `now`) |
| Popup closable without attending | **No** (no Đóng on check-in modal) |
| Multi-pending queue | **No** |
| Session/daily student limits | **Yes** (schedulingValidation) |
| TDZ student PUT enrollment | **Fixed** (`populated`) |

## 4. STOP / BLOCKED

1. **Correction request** — no model, no approval workflow, would need RBAC/permission → **BLOCKED** per §29/§35.
2. **Attendance entity with scheduleId on grades** — schema change → out of scope unless reuse `Schedule.note` only.
3. Full Schedule enum expansion (`IN_PROGRESS`, `CORRECTION_REQUIRED`) → schema migration risk → avoid; derive window state in service.

## 5. Safe minimal patch (allowed)

1. `services/attendanceWindow.js` — server-side REGULAR / LATE / EXPIRED from schedule date+endTime + `ATTENDANCE_LATE_GRACE_MINUTES`.
2. Enforce on `PUT /schedules/:id` when → `completed` (and completed create if applicable).
3. LATE requires `lateReason` (store in `Schedule.note`).
4. FE `getAttendanceAction` + popup wording + **Đóng** + single-schedule queue.
5. Tests for window + regression TDZ/session limits.

## 6. Production DB writes

Audit: **0**.
