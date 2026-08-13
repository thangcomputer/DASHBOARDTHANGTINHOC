# SCHEDULING SESSION LIMIT — AUDIT

Date: 2026-08-13  
Status: AUDIT COMPLETE — ready for minimal patch

## 1. Current flow

Live API: `POST /api/schedules`, `PUT /api/schedules/:id` via `routes/scheduleRoutes.js` (mounted in `server.js`).

Create path (teacher/admin/staff):
1. Authz + teacher ownership
2. Require teacherId, studentId, date, startTime, course
3. Normalize endTime = start + 90m
4. Student time-overlap clash (`studentId` + day + overlap)
5. Teacher exact-slot clash (`teacherId` + exact Date + exact startTime)
6. Optional 12h cooldown if creating as `completed`
7. Create Schedule document

No student booking / bulk / clone endpoints found.

CQRS mirror `modules/attendance/*` exists but is not mounted live.

## 2. Current SoT

| Concern | Source of truth |
|---------|-----------------|
| Schedule existence / status | `Schedule` Mongo model: `scheduled \| completed \| cancelled \| no_show` |
| Progress for unlock/display | Count `Schedule` with `status: completed` (+ course filter) via `applyEnrollmentStats` |
| Denormalized counters | `Student.enrollments[].completedSessions / remainingSessions / totalSessions` written on attendance |
| Enrollment status | `active \| completed \| paused \| pending_payment \| refunded \| cancelled` |

**Gap:** CREATE does not consult enrollment `totalSessions` or count reserved (`scheduled`) sessions.

## 3. Endpoints

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/schedules` | Create |
| PUT | `/api/schedules/:scheduleId` | Reschedule date/time + status |
| PATCH | `/api/schedules/:scheduleId/cancel` | Cancel |
| DELETE | `/api/schedules/:scheduleId` | Hard delete |

## 4. Current validation

| Rule | Today |
|------|-------|
| Student time overlap | Yes — `findStudentScheduleClash` |
| Student max sessions/day | **No** (only overlap; 08:00 + 14:00 same day allowed) |
| Enrollment session cap | **No** on create |
| Enrollment must be active | **No** |
| Teacher conflict | Exact startTime only; missing on PUT reschedule |
| Teacher daily HV count limit | **None** (good — not wrongly keyed) |

## 5. Bugs / gaps

1. Can schedule when enrollment already `12/12` completed or has 12 reserved slots.
2. Student can have multiple non-overlapping sessions same day.
3. Teacher reschedule skips teacher conflict check.
4. FE schedule modal shows no progress / disable for completed enrollments.
5. Dual codepath risk (live routes vs unmounted CQRS module).

## 6. Risks

- Race: two tabs at 11/12 both create → possible 13th without atomic counter (no transaction rewrite per scope).
- Timezone: `dayRange` uses server local `setHours`; date-only ISO may shift day near midnight UTC.

## 7. Proposed minimal patch

1. Add `services/schedulingValidation.js` with constants + helpers:
   - `MAX_STUDENT_SESSIONS_PER_DAY = 1`
   - `getEnrollmentSessionUsage` (count `scheduled`+`completed` for student+course)
   - `assertEnrollmentCanSchedule`
   - `assertStudentDailyLimit`
   - `findTeacherScheduleClash` (day range + overlap)
2. Call shared validators from `POST` and `PUT` in `routes/scheduleRoutes.js`.
3. FE: progress labels + disable in `TeacherScheduleModal`; client daily count helper.
4. Unit tests for usage counting + daily limit + enrollment gate.
5. Do **not** change Auth/RBAC/Finance/C4/schema/migration.

## 8. Zero-write statement

This audit performed read-only static analysis. Production DB writes: **0**.
