# ATTENDANCE FIX — TDZ + COOLDOWN + STUDENT STATUS

Date: 2026-08-12  
Status: PASS WITH CONDITIONS

## 1. Root cause

1. **TDZ crash on `PUT /api/students/:id` (teacher + `courseName`):** After `doc.save()`, realtime emit used `typeof student !== 'undefined' && student` while `const student` is declared later in the same handler → Temporal Dead Zone → HTTP 400 `Cannot access 'student' before initialization` even though enrollment save succeeded.

2. **Cooldown UX mismatch:** End-of-session popup opened for any today `scheduled` past `endTime`, ignoring backend SoT `can_check_in` / `remaining_cooldown_hours` → UI asked to check in while API/frontend gate blocked with cooldown toast.

3. **Student status consistency:** Attendance sent enrollment enum (`active`/`completed`) into primary root `student.status`, which conventionally uses Vietnamese labels (`Đang học` / `Hoàn thành`).

## 2. Files changed

- `routes/studentRoutes.js` — TDZ fix + root status mapping on primary enrollment patch
- `utils/studentStatusMap.js` — `mapEnrollmentStatusToRoot`
- `client/src/context/useDataSchedule.js` — status payload: enum with `courseName`, Vietnamese without
- `client/src/utils/attendancePrompt.js` — `resolveCheckInGate`, `classifyAttendancePrompt`
- `client/src/components/TeacherDashboard.jsx` — cooldown-aware popup + dismiss set
- `tests/unit/attendance_tdz_status.test.js`
- `tests/unit/attendance_prompt_cooldown.test.js`
- `docs/attendance/ATTENDANCE_FIX_TDZ_COOLDOWN_2026-08-12.md`

## 3. TDZ fix

Attendance enrollment branch now emits:

```js
studentRealtime(io, populated, 'student:updated', populated._id);
```

No reference to later `const student`.

**PUT handler audit (attendance path):** The only pre-declaration `student` use in the teacher+`courseName` early-return branch was the fixed line. Remaining `typeof student` in the same PUT handler are **after** `const student = await Student.findByIdAndUpdate(...)` and are not TDZ for that path. Other route handlers still contain the verbose `typeof student` fallback pattern (create/finance/refund/etc.) — **out of scope**; not required for attendance.

**No additional TDZ issue found in the attendance enrollment early-return branch.**

## 4. Cooldown UX fix

- Prompt classification uses existing SoT: `can_check_in`, `remaining_cooldown_hours` (optional enrollment-scoped override).
- `scheduled` + past end + `can_check_in === true` → check-in prompt with **Điểm danh ngay**.
- `can_check_in === false` → cooldown UI (**Đã điểm danh**, remaining hours, **Đóng** only — no check-in button).
- `completed` / `cancelled` / `no_show` → no prompt.
- Dismissed schedule IDs stored in ref → no reopen loop after Đóng.

No new cooldown algorithm; no hardcoded 12h in popup helpers.

## 5. Student status fix

- Enrollment patch keeps enum: `active` | `completed` | …
- When primary: root `doc.status = mapEnrollmentStatusToRoot(safeBody.status)` → `Đang học` / `Hoàn thành`.
- Frontend: with `courseName` send enrollment enum; without send Vietnamese root labels.
- Learning access remains enrollment-based (`hasLearningAccessEnrollment` / `status === 'active'`) — **unchanged**.

## 6. Realtime behavior

Post-save emit uses fresh `populated` document (branchId / teacherId / _id available for `studentRealtime`). Protocol unchanged.

## 7. Tests

Targeted:

- `tests/unit/attendance_tdz_status.test.js` — PASS
- `tests/unit/attendance_prompt_cooldown.test.js` — PASS

Also confirmed learning-access unit suite still PASS (`hasLearningAccessEnrollment`).

## 8. Regression

`node tests/run.js unit` → **87 PASS / 1 FAIL**

Failing test (pre-existing, unrelated):

- `tests/unit/avatar_gender_sync.test.js` — `EditableAvatar + AppSidebar pass gender` (expects `gender={session?.gender}` in AppSidebar)

Attendance / enrollment / learning-access units: PASS.

## 9. Database writes

- Production DB writes: **0**
- Production attendance / student / schedule / finance writes: **0**
- No migration / seed / webhook / SePay

## 10. Out-of-scope findings

1. Many remaining `typeof student !== 'undefined' && student ? …` fallbacks across `studentRoutes.js` (create, pay, refund, assign). Safe when `student` already initialized; still fragile style. Not changed in this phase.
2. Attendance flow is still schedule-update-then-student-update without Mongo transaction. TDZ crash fixed removes the main partial-failure path; true atomicity not added (no transaction rewrite per scope).
3. Cooldown aggregate on list students uses `Schedule.createdAt` of `completed` docs — updating `scheduled → completed` may not refresh cooldown the same way as create-completed. Not changed.
4. Pre-existing avatar gender unit failure.

## 11. Remaining risks

- Orphaned state if schedule completes and a **non-TDZ** student update fails later (network) — same as before; no transaction.
- Existing DB rows with root `status: 'active'` from prior buggy writes are not migrated (by design).
- Cooldown popup can still appear for `scheduled` + cooldown (informational); user closes once; schedule may remain `scheduled` until cancelled or later successful check-in after cooldown.

## 12. Final verdict

**PASS WITH CONDITIONS** — attendance TDZ + cooldown UX + status mapping fixed and unit-tested; one unrelated unit failure remains; other `typeof student` patterns left intentionally outside attendance scope.
