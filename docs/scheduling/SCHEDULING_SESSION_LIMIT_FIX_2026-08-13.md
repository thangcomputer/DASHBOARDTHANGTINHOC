# SCHEDULING SESSION LIMIT — FIX

Date: 2026-08-13  
Status: PASS WITH CONDITIONS

## 1. Exact rules enforced

| Code | Rule |
|------|------|
| `MAX_STUDENT_SESSIONS_PER_DAY = 1` | Per **studentId + date** (not teacherId) |
| Enrollment usage | Count Schedule `scheduled` + `completed` for student+course |
| Cancelled | Does **not** consume usage or daily slot |
| Enrollment status | Must be `active`; `completed` / other → reject |
| Teacher conflict | Independent; day-range + **time overlap** (create + reschedule) |

## 2. Files changed

- `docs/scheduling/SCHEDULING_SESSION_LIMIT_AUDIT_2026-08-13.md`
- `docs/scheduling/SCHEDULING_SESSION_LIMIT_FIX_2026-08-13.md`
- `services/schedulingValidation.js` **(new SoT)**
- `routes/scheduleRoutes.js` — POST create + PUT reschedule wire-in
- `client/src/utils/schedulingLimits.js` **(new UX helpers)**
- `client/src/components/teacher/TeacherScheduleModal.jsx` — progress + disable
- `tests/unit/scheduling_validation.test.js`
- `tests/unit/scheduling_limits_client.test.js`

## 3. Student-level isolation

Daily limit and enrollment cap query/filter by `studentId` (+ course for enrollment).  
Teacher A with HV1…HV6: each HV evaluated independently. HV1 at 1/1 today does **not** block HV2.

## 4. Teacher multi-student behavior

Teacher may teach many students the same day at non-overlapping times.  
Conflict only when teacher’s own slots **overlap**.

## 5. Backend SoT

`validateScheduleCreate` / `validateScheduleReschedule` load Student + Schedule from DB.  
FE progress is display-only; Postman bypass still gets `409` + stable `code`.

Error codes:
- `ENROLLMENT_COMPLETED`
- `ENROLLMENT_SESSION_LIMIT_REACHED`
- `ENROLLMENT_NOT_ACTIVE`
- `ENROLLMENT_NOT_FOUND`
- `STUDENT_DAILY_SESSION_LIMIT`
- `TEACHER_SCHEDULE_CONFLICT`

## 6. Tests

```bash
node --test tests/unit/scheduling_validation.test.js tests/unit/scheduling_limits_client.test.js
```

**14 PASS / 0 FAIL** (usage, daily isolation, cancel, reschedule exclude-self, constants).

## 7. Residual risks

1. **Race:** two concurrent creates at 11/12 may both pass count before insert (no Mongo transaction added per scope). Recommend unique partial index or transactional create in a later phase.
2. **CQRS mirror** `modules/attendance/*` not mounted; not updated — residual if remounted without this service.
3. **Timezone:** `dayRange` still uses server local `setHours` (pre-existing).
4. **Auto `enrollment.status = completed` on last attendance** not changed in this phase (unlock path may already set course completion elsewhere).

## 8. Zero-write statement

Implementation + unit tests only. Production DB writes: **0**.  
No migration. No Auth/RBAC/Messaging/Finance/C4 changes.

## 9. Final verdict

**PASS WITH CONDITIONS** — student session cap + daily limit + teacher overlap conflict enforced on live create/reschedule; race/CQRS/timezone residual documented.
