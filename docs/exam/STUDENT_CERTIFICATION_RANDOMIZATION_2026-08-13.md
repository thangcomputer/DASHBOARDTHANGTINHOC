# Student certification exam randomization

**Date:** 2026-08-13  
**Scope:** Học viên thi chứng nhận môn (`StudentTest`) — xáo câu hỏi + đáp án một lần / attempt.

## Before

- MC questions taken from Question Bank in fixed order via `getStudentMcQuestionsForExam`.
- Options A/B/C/D kept in bank order.
- `answer` / `correct` index fixed to bank layout.
- Re-render / remount rebuilt the same ordered list from bank (`useMemo`).
- No exam-instance persistence for shuffled presentation.

## After

- On **START** (or resume), create an **exam instance**:
  1. Fisher–Yates shuffle question order
  2. Per-question Fisher–Yates shuffle of options
  3. Remap `answer` index to the shuffled options
- Shuffle runs **once per attempt**, not on render / Next / answer / timer.
- Question Bank objects and DB documents are **not** mutated.
- Same attempt survives reload via `sessionStorage` (`cert_exam_attempt:{studentId}:{subjectId}`).
- Admin Question Bank panels and teacher flows unchanged (`getStudentMcQuestionsForExam` still filter-only).

## Files changed

| File | Change |
|------|--------|
| `client/src/utils/studentCertificationExam.js` | **NEW** — shuffle, remap, attempt resolve/load/save |
| `client/src/components/StudentTest.jsx` | Wire start/resume + persist; no shuffle in JSX |
| `tests/unit/student_certification_exam.test.js` | **NEW** — A–H coverage |
| `docs/exam/STUDENT_CERTIFICATION_RANDOMIZATION_2026-08-13.md` | This report |

## Tests

Command: `node --test tests/unit/student_certification_exam.test.js`

| Case | Result |
|------|--------|
| A Question shuffle (ids/count/no dup) | PASS |
| B/C Option shuffle + answer remap | PASS |
| D Multiple questions independent | PASS |
| E Grading regression | PASS |
| F No mutation | PASS |
| G Reload stability | PASS |
| H Malformed options no throw | PASS |

Also: `npm run build --prefix client` → PASS.

## Scope checklist

| Item | Status |
|------|--------|
| Application code changed | YES |
| Database schema changed | NO |
| Question Bank data changed | NO |
| Production DB writes | 0 |
| Auth | UNCHANGED |
| RBAC | UNCHANGED |
| Messaging | UNCHANGED |
| Finance | UNCHANGED |
| Enrollment | UNCHANGED |
| Scheduling | UNCHANGED |
| Attendance | UNCHANGED |
| Teacher exam / Admin bank UI | UNCHANGED |

## Current client-side answer exposure status

**Already present before this change:** certification MC payload on the client includes correct answer indices (`correct` → mapped to `answer`). Grading is client-side (`answers[i] === questions[i].answer`).

This task **does not** introduce a new security model. Session storage of the exam instance includes remapped `answer` fields (same exposure class as in-memory state). Full server-side attempt + server grading is **out of scope**.

## Residual / out of scope

- No server-side exam attempt document; stability is `sessionStorage` (tab-scoped). New browser tab = new attempt key space / empty session → new shuffle.
- Hard refresh is still discouraged by existing F5 trap (fail exam); resume path covers accidental remount within the same tab session.
- Teacher certification / lesson quiz modules not randomized here.
- Client-side correct-answer exposure unchanged (architecture debt).

## Final verdict

**PASS WITH CONDITIONS**

Conditions: attempt stability is FE `sessionStorage` only; answer indices remain on the client as before.
