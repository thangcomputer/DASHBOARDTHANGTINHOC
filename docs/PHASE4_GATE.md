# Phase 4 Gate — Branch isolation verify

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 3 PASS

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| Helper | `utils/branchScope.js` — cross-branch detect, assert student/teacher, exam clause |
| Exam results | List/mutate scoped theo chi nhánh (Staff); GV không list toàn hệ thống |
| Schedule | GET teacher/student + POST/PUT/DELETE/cancel + gắn `branchId` khi tạo |
| Transactions | POST/confirm/cancel/delete + `branchFilter` + assert |
| Invoices | GET `:id` cho Staff cùng CN (trước đó gần như chỉ admin/owner) |
| Assignments | GET student/course — Staff bị chặn cross-branch |
| Evaluations | GET `/admin` filter theo studentIds chi nhánh |
| Tests | `tests/integration/branchIsolationPhase4.test.js` |

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | Helper isCrossBranch đúng | PASS (test) |
| 2 | Route critical có branchFilter | PASS (static test) |
| 3 | Staff không confirm transaction CN khác | PASS (assertBranchMatch trên route) |
| 4 | Staff không xem lịch/HV CN khác qua GET student | PASS |
| 5 | Exam list không còn “all branches” cho Staff | PASS |
| 6 | Super Admin (không userBranchId) vẫn global | PASS |

## Không làm (để phase sau)

- Thêm `branchId` vào schema Invoice/ExamResult/Assignment (đang isolate qua Student/Teacher)
- Quét 100% mọi route phụ (feed, file, AI…)
- Multi-membership UI switcher

## Penetration checklist (manual staging)

- [ ] Staff CN1 gọi `GET /api/exam-results` — không thấy HV CN2
- [ ] Staff CN1 `PUT /api/transactions/:id/confirm` của CN2 → 403 `BRANCH_SCOPE_DENIED`
- [ ] Staff CN1 `GET /api/schedules/student/:idCN2` → 403
- [ ] Super Admin vẫn xem được cả hai CN

## Kết luận

**PASS** — Phase 4 tests: 7/7 xanh (`branchIsolationPhase4.test.js`). Cùng batch RBAC Phase 3: 19/19.

Phase tiếp theo: **Phase 5 — Notification platform**.

