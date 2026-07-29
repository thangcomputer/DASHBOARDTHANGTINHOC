# Phase 9 Gate — Exam

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 6 + 5 PASS (Attendance Phase 8 trước theo roadmap tuần tự)

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| State machine | `services/examLifecycleService.js` — ADR `locked→…→pass\|fail\|void\|violation` |
| Legacy map | `chua_thi/dang_thi/dat/khong_dat` ↔ canonical; lưu tương thích UI |
| Progress | `examProgressService` enforce SM + `attemptStatus` |
| Unlock API | `PUT .../unlock-exam` → `unlockStudentExam` + audit `exam.unlock` |
| Lock / violation | `PUT .../lock-exam` → `lockStudentExam` + `exam.violation`/`exam.lock` |
| Proctor path | `exam_terminate` hoặc `hard_violation` + `detail.autoLock` → lock violation |
| Notify + deep link | Templates `EXAM_UNLOCKED/LOCKED/VIOLATION/RESULT`; `STUDENT_EXAM_SUBJECT` |
| Schema | `attemptStatus`, `violationReason`, `voidReason`, `voidedAt` |
| Tests | `tests/integration/examPhase9.test.js` |

## Mapping trạng thái

| Canonical | Lưu `status` (UI) | Ghi chú |
|-----------|-------------------|---------|
| locked / unlocked | chua_thi | phụ thuộc `studentExamUnlocked` |
| in_progress | dang_thi | |
| submitted | submitted | nộp TH khi đang thi |
| pass / graded | dat | |
| fail | khong_dat | |
| violation / void | violation / void | Phase 9 |

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | SM không nhảy cóc (locked→pass fail) | PASS (test) |
| 2 | unlocked→in_progress→pass | PASS (test) |
| 3 | violation path + retake → unlocked | PASS (test) |
| 4 | unlock/lock dùng lifecycle | PASS (static) |
| 5 | Proctor → lockStudentExam wired | PASS (static) |
| 6 | Deep link + templates | PASS (test) |

## Không làm (phase sau / UI)

- Tách collection `ExamAttempt` riêng (vẫn embed `examProgress`)
- Sửa toàn bộ UI hiển thị `submitted/void/violation`
- Auto-lock mọi `hard_violation` (chỉ terminate / autoLock)

## Kết luận

**PASS** — Phase 9 tests xanh (`examPhase9.test.js`).

Phase tiếp theo: **Phase 10 — Finance / ledger**.
