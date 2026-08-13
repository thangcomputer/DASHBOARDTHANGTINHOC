# Learning SoT — Module 0–10 status (2026-08-13)

Order locked: Progress/complete → Sequential lock → Anti-seek FE → Anti-seek BE → Duration sync → Teacher → (later) Q&A → Notification → Player UI polish → Regression.

## Done in this pass

| Module | Status | Notes |
|--------|--------|--------|
| 0 Audit | Done | SoT = `TrainingProgress` + `status=completed` + server `isUnlocked` |
| 1 Progress/complete | Done | FE flush `save-watch-progress` then `complete-lesson` with `videoDuration` |
| 2 Sequential lock | Done | BE `PREVIOUS_LESSON_REQUIRED`; list redact video URL when locked; FE tooltip |
| 3 Anti-seek FE | Done | Clamp seek until threshold; free seek after; complete still server-gated |
| 4 Anti-seek BE | Done | Fail-closed `ANTI_SEEK_PROGRESS_REQUIRED` + elapsed clamp |
| 5 Duration sync | Done | `resolveEffectiveDuration(admin, YouTube)` shared FE/BE |
| 6 Teacher LMS | Done | Same learning path restrictions; Course Builder unchanged |
| 7 Q&A | Deferred | Still localStorage — do not start until learning SoT verified |
| 8 Notification | Deferred | After Q&A API |
| 9 Player height | Done | `+40px` Student + Teacher |
| 10 Regression | Pending | Manual E2E on VPS after deploy |

## SoT rules (do not regress)

1. Next lesson unlocks only when **server** marks previous `completed`.
2. UI “Đủ điều kiện” ≠ unlock next lesson.
3. `antiSeek` from Admin lesson config only (no localStorage override).
4. FE and BE thresholds use the same `resolveEffectiveDuration`.
5. Locked lessons must not expose `videoUrl` in lessons list API.

## Residual risk

- Slow inflate via repeated `save-watch-progress` still possible within elapsed clamp — acceptable Phase-1; harden later if needed.
- Q&A remains client-only until Modules 7–8.
