# Anti-Seek End-to-End Audit & Fix

**Date:** 2026-08-13

## 1. Root cause

1. Student `handleVideoEnded` used `if (false)` → seek-to-end could complete without 2/3 watch time.
2. Backend `POST /complete-lesson` always accepted client claims.
3. HV/GV could override Admin via `localStorage` / teacher UI toggle.
4. YouTube `controls: 1` allowed free seek; no snap-back to max watched position.
5. Naming “chống tua” was progress-gate only, not seek-lock.

## 2. Existing behavior (before)

| Surface | Behavior |
|---------|----------|
| Admin Course Builder | Persists `lesson.antiSeek` into training raw settings |
| GET lessons | Spreads lesson fields including `antiSeek` |
| Student | localStorage kill-switches; dead `if (false)` on ended |
| Teacher | local toggle + `teacher_anti_seek` |
| complete-lesson | Blind upsert `completed` |

## 3–5. After fix

**SoT:** `lesson.antiSeek !== false` → ENABLED (`utils/antiSeekPolicy.js` + FE twin).

| Role | Seek | Complete |
|------|------|----------|
| Student / Teacher ON | Snap-back if `currentTime > maxPos + 1.25s` | FE gate + server `TrainingProgress.watchedSeconds` ≥ ceil(2/3 duration) |
| Student / Teacher OFF | Free seek | Normal complete |

localStorage overrides **removed** from decision path.

## 6. LocalStorage

| Key | Status |
|-----|--------|
| `student_anti_seek_disabled` | No longer read by LMS |
| `admin_anti_seek_disabled` | No longer read by LMS |
| `teacher_anti_seek` | No longer read by LMS |
| Teacher “Tắt chống tua” button | Removed |

## 7. Files changed

- `utils/antiSeekPolicy.js` **(new)**
- `client/src/utils/antiSeekPolicy.js` **(new)**
- `routes/trainingRoutes.js` — complete + save-watch clamp
- `client/src/components/StudentTrainingLMS.jsx`
- `client/src/components/TeacherTrainingLMS.jsx`
- `client/src/components/admin/tabs/AdminStudentTrainingTab.jsx` — dead state removed
- `tests/unit/anti_seek_policy.test.js`
- `docs/learning/ANTI_SEEK_END_TO_END_AUDIT_2026-08-13.md`

## 8. Policy SoT

`isLessonAntiSeekEnabled(lesson)` ≡ `lesson?.antiSeek !== false`

## 9. Completion enforcement

- Server uses **stored** `watchedSeconds` (plus ≤15s catch-up), not client full duration claim.
- `save-watch-progress` clamps growth by elapsed wall time since `lastWatchedAt`.
- HTTP **422** + `code: ANTI_SEEK_PROGRESS_REQUIRED` when under threshold.
- Idempotent if already `completed`.

## 10. Test matrix

| Case | Result |
|------|--------|
| Policy SoT true/false/undefined | PASS (unit) |
| 2/3 requiredSeconds | PASS |
| findLessonInCourse | PASS |
| clamp inflate | PASS |
| Route source assertion | PASS |
| FE no localStorage override | PASS |

Command: `node --test tests/unit/anti_seek_policy.test.js`

## 11. Residual risks

- **BACKEND ENFORCEMENT = PARTIAL** against sophisticated cheats: client can still inflate progress slowly via repeated `save-watch-progress` within elapsed-time caps (not DRM).
- Lesson `duration` missing/0 → server requires `watchedSeconds >= 1` only (cannot compute 2/3). FE still uses YouTube `getDuration()` for UI gate.
- YouTube native timeline still visible; seek beyond maxPos is **snap-back**, not disabled control.
- `modules/course` twin routes not live-mounted — not updated.
- Screen recording / multi-device not in scope.

## 12. Out of scope

Auth, JWT, RBAC, Messaging, Finance/Ledger/SePay, C4, DB migrations.

## Verdict

**PASS WITH CONDITIONS** (server progress-gated; not absolute anti-cheat).
