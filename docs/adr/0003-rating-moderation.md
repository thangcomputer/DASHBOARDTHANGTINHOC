# ADR 0003 — Teacher rating moderation

- **Status:** Accepted
- **Date:** 2026-07-29

## Context

Học viên đánh giá GV sau khi học. Cần quyết định public ngay hay duyệt trước. Hiện `Evaluation` có `teacher_rating` nhưng **chưa có** moderation status / public flag.

## Decision

**Moderated-by-default (chuẩn enterprise cho đào tạo thương mại).**

| Status | Ý nghĩa | Public? |
|--------|---------|---------|
| `pending` | Mới gửi | Không |
| `approved` | Admin/Staff có perm đã duyệt | Có |
| `rejected` | Từ chối (ẩn, có lý do nội bộ) | Không |
| `hidden` | Đã duyệt rồi bị ẩn sau | Không |

### Rules

1. Chỉ submit khi enrollment `completed` (hoặc milestone được cấu hình) và trong **rating window** (mặc định 30 ngày sau completed).
2. Một cặp `(studentId, teacherId, enrollmentId)` tối đa **1** rating hiệu lực (update pending được phép trước khi duyệt).
3. Public API / trang GV chỉ aggregate `approved`.
4. Notify GV khi rating **approved** (không notify lúc pending — giảm áp lực).
5. Branch có thể tắt moderation (`ratings.requireModeration = false`) → auto-approve; **default = true**.

### Reward dependency

Reward (%) chỉ đếm rating `approved` + `minSample` (ADR roadmap Reward). Không đếm pending/rejected.

## Consequences

- Mở rộng `Evaluation` hoặc model `TeacherRating` với `status`, `moderatedBy`, `moderatedAt`, `enrollmentId`, `stars` (1–5).
- UI Admin: hàng đợi duyệt rating.

## Non-goals (Phase 0–1)

- Chưa implement UI Reward.
- Chưa public widget bên ngoài hệ thống (landing).
