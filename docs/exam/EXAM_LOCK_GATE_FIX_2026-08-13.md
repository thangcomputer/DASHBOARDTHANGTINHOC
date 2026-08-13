# Exam lock gate fix (exit → cannot re-enter / score)

**Date:** 2026-08-13

## Problem

Student could exit mid-exam (admin notified as locked/failed) then re-enter and still take/score the exam.

## Root causes addressed

1. `StudentTest` did not gate START on `lockUntil` / `khong_dat`.
2. Exam room `canRetry` allowed "Thi lại" for any `khong_dat` without active countdown.
3. Exit paths inconsistently cleared session attempt / applied lock.
4. Score updates stayed optimistic even when API rejected (e.g. score already locked).

## After

- `canEnterCertificationExam` / `isExamProgressLocked` in `examSubjects.js`
- `khong_dat` = locked until admin resets to `chua_thi` (no self-retry)
- `beginOrResumeExam` refuses locked subjects + clears attempt
- Exam room shows "Đã rớt — chờ admin mở khóa"
- `applyFailAndLock` on all fail/exit paths; clears certification attempt
- Score writes use `revertOnFail: true`

## Files

- `client/src/utils/examSubjects.js`
- `client/src/components/StudentExamRoom.jsx`
- `client/src/components/StudentTest.jsx`
- `tests/unit/exam_lock_gate.test.js`
- `docs/exam/EXAM_LOCK_GATE_FIX_2026-08-13.md`

## Tests

`node --test tests/unit/exam_lock_gate.test.js`

## Scope

Auth/RBAC/Finance/Attendance: unchanged. DB schema: unchanged.
