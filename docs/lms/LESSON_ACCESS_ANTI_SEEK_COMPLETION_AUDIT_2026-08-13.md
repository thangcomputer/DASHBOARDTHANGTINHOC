# LMS Lesson Access / Anti-Seek / Completion — Audit & Report

**Date:** 2026-08-13  
**Mode:** PHASE 0 AUDIT → implement module-by-module  
**Live mount:** `server.js` → `app.use('/api/training-lms', routes/trainingRoutes.js)`  
**Not live:** `modules/course/routes/trainingRoutes.js` (twin — out of hot path)

---

## PHASE 0 — Current architecture (pre-fix)

### Data storage (no dedicated Lesson mongoose for Course Builder LMS)

| Store | Path | Notes |
|-------|------|--------|
| Teacher courses | `SystemSettings.trainingRawData.videos[]` | chapters → lessons |
| Student courses | `SystemSettings.studentTrainingRawData.videos[]` | same shape |
| Progress SoT | `TrainingProgress` | `status`, `watchedSeconds`, `lastWatchedAt` |
| Lesson fields (before) | `antiSeek`, `duration`, `videoUrl` | **no** `allowEarlyAccess` |

### Bugs found

| # | Bug | Root cause |
|---|-----|------------|
| B1 | `antiSeek: false` → complete without 2/3 | BE `if (antiSeekOn)` gated 2/3 |
| B2 | FE auto-complete when antiSeek off | `if (!antiSeekEnabled) onEligibilityReached` |
| B3 | FE video-ended skipped 2/3 when antiSeek off | `if (antiOn && …)` |
| B4 | No early-open lesson | field missing |
| B5 | Unlock = sequential only | no `allowEarlyAccess` |
| B6 | Admin wording tied seek to completion | single checkbox text |
| B7 | `requiredWatchSeconds: 0` when antiSeek off | list API |
| B8 | Error code `ANTI_SEEK_PROGRESS_REQUIRED` | coupled completion to seek |

---

## Target SoT (3 independent laws) — IMPLEMENTED

| Law | Field / rule | Does NOT control |
|-----|--------------|------------------|
| **ACCESS** | `allowEarlyAccess` + prerequisite `completed` | seek, 2/3 |
| **SEEK** | `antiSeek` | access, complete |
| **COMPLETION** | `watchedSeconds >= ceil(duration*2/3)` **always** | — |

Defaults (backward compatible):

- `allowEarlyAccess` missing → `false`
- `antiSeek` missing → `true` (unchanged)

---

## Implementation log

### Files changed

| File | Change |
|------|--------|
| `utils/lessonLearningPolicy.js` | **NEW** — ACCESS + COMPLETION resolvers |
| `utils/antiSeekPolicy.js` | unchanged core; still SEEK + duration math |
| `client/src/utils/antiSeekPolicy.js` | FE twin + `evaluateCompletionRequirement`, dual error codes |
| `routes/trainingRoutes.js` | lessons list via `resolveLessonLearningState`; complete always 2/3; early-access skips prev; save-watch ACCESS gate |
| `client/src/components/AdminCourseBuilder.jsx` | 2 independent settings + clear wording |
| `client/src/components/StudentTrainingLMS.jsx` | completion ≠ seek; badges; sidebar states; height |
| `client/src/components/TeacherTrainingLMS.jsx` | same rules as student |
| `tests/unit/lesson_learning_policy.test.js` | **NEW** CASE 1–4 + FE/Admin source asserts |
| `tests/unit/anti_seek_policy.test.js` | updated route source assert |
| `docs/lms/LESSON_ACCESS_ANTI_SEEK_COMPLETION_AUDIT_2026-08-13.md` | this report |

### API changed

| Endpoint | Behavior |
|----------|----------|
| `GET /courses/:id/lessons` | `isUnlocked`/`canAccess` respects `allowEarlyAccess`; always returns `requiredSeconds`; exposes `allowEarlyAccess`, `prerequisiteCompleted`, `completionEligible` |
| `POST /complete-lesson` | Always 2/3 via `evaluateCompletionRequirement`; code `LESSON_COMPLETION_REQUIREMENT_NOT_MET`; prev-lesson skipped only if `allowEarlyAccess` |
| `POST /save-watch-progress` | Rejects if lesson not accessible |

### UI changed

- Admin: **Chống tua** + **Mở bài sớm** with correct help text (tua tự do ≠ bỏ 2/3)
- Student/Teacher player: badges “Chống tua đang bật” / “Tua tự do” + completion %
- Sidebar: Chưa thể học / Có thể học sớm / Đang học / Đã hoàn thành
- Player height: `48dvh` / `54dvh` / max `660px`

### Tests

```text
node --test tests/unit/anti_seek_policy.test.js tests/unit/lesson_learning_policy.test.js
→ 21/21 PASS
```

Coverage includes:

1. Lesson 1 always open  
2. Lesson 2 locked without prev complete  
3. Lesson 2 open after prev complete  
4. allowEarlyAccess opens early  
5. allowEarlyAccess does not mark completion eligible without 2/3  
6–8. CASE matrix antiSeek × allowEarlyAccess  
9–10. watched &lt; / ≥ 2/3  
11. Route does not antiSeek-gate completion  
12. FE no immediate complete when antiSeek off  
13. Admin persists both fields (source assert)

### Security / abuse notes

- Server ignores any client `completed: true` (field unused)
- Watch progress clamped by wall-clock elapsed (`clampWatchProgressIncrease`)
- Locked lesson: no `videoUrl` in list; save-watch + complete fail-closed without access
- Residual: slow inflate via repeated save within elapsed cap (same as prior — not DRM)

### Regression

- No DB migration (JSON lesson field additive)
- No RBAC / finance / messaging / Q&A changes
- `modules/course` twin still legacy (not live-mounted)

### Remaining risks

1. Admin duration `0` + YT not loaded → fail-closed require ≥1s (may feel strict until duration resolves)
2. Slow progress inflate within elapsed clamp still possible
3. Manual E2E on VPS still needed after deploy
4. Old FE clients expecting `ANTI_SEEK_PROGRESS_REQUIRED` — FE accepts both codes via `isCompletionRequirementCode`

---

## Phase checklist

| Phase | Status |
|-------|--------|
| 0 Audit | PASS |
| 1 Progress/completion SoT | PASS |
| 2 Backend completion always 2/3 | PASS |
| 3 Backend ACCESS + early access | PASS |
| 4 antiSeek player = seek only | PASS |
| 5 allowEarlyAccess | PASS |
| 6 Student UI | PASS |
| 7 Teacher UI | PASS |
| 8 Admin Course Builder | PASS |
| 9 Progress/unlock sync | PASS (server list + FE refresh on reject) |
| 10 Video height | PASS |
| 11 Regression/security unit tests | PASS (21/21) |
| 12 Documentation | PASS |

---

## STATUS

**PASS WITH CONDITIONS**

Conditions:

- Manual browser E2E (CASE 1–4) on local/VPS not executed in this session
- Absolute anti-cheat / DRM out of scope
- Deploy + Admin re-save courses to set `allowEarlyAccess` where needed

Acceptance mapping:

1. ACCESS ≠ SEEK — yes  
2. SEEK ≠ COMPLETION — yes  
3. allowEarlyAccess only access — yes  
4. antiSeek only seek — yes  
5. All lessons ≥ 2/3 to complete — yes (server)  
6. Server SoT completion — yes  
7. No complete via client `completed:true` — yes  
8. Next unlock by completion/early rules — yes  
9–10. Early + antiSeek — yes  
11. Student = Teacher rules — yes  
12. Admin 2 settings — yes  
13. Reload uses server progress — yes (TrainingProgress)  
14. Out-of-scope modules untouched — yes  
15. Unit tests PASS — yes  
