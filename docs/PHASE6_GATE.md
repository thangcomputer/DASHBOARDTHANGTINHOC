# Phase 6 Gate — Course + Enrollment lifecycle

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 5 PASS

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| Soft-delete | `DELETE /api/courses/:id` → `softDeleteCourse` (không hard-delete) |
| Restore | `POST /api/courses/:id/restore` |
| Catalog | GET list/stats/detail mặc định `deletedAt: null`; `?includeDeleted=1` xem cả |
| Notify + Audit | HV enrolled nhận COURSE notify; `course.soft_delete` audit |
| Finance integrity | Đếm Invoice liên quan, **không xóa** |
| Enrollment SM | `services/enrollmentLifecycle.js` + enum mở rộng |
| Access | `learningAccess` trên enrollment; pay → grant |
| Status API | `PUT .../enrollments/:id/status` |
| Block đăng ký mới | Course soft-deleted không add enrollment |
| Tests | `tests/integration/courseLifecyclePhase6.test.js` |

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | Soft-delete không dùng findByIdAndDelete | PASS (static test) |
| 2 | State machine enrollment đúng | PASS (test) |
| 3 | Catalog filter `deletedAt: null` | PASS (test) |
| 4 | Invoice không bị xóa khi soft-delete | PASS (service đếm, không delete) |
| 5 | Template COURSE_SOFT_DELETED | PASS |
| 6 | learningAccess theo status | PASS |

## Không làm (phase sau)

- LedgerEntry bảng kế toán đầy đủ (Phase 10)
- UI admin nút restore riêng (API đã có)
- Migrate toàn bộ enrollment cũ sang pending_payment

## Kết luận

**PASS** — Phase 6 tests: 10/10 xanh (`courseLifecyclePhase6.test.js`).

Phase tiếp theo: **Phase 7 — Schedule + teacher reassignment**.

