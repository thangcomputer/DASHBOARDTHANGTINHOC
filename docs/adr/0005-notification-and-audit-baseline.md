# ADR 0005 — Notification & Audit baseline

- **Status:** Accepted
- **Date:** 2026-07-29

## Notification

### Đã có

- `Notification` model + `NotificationService` + Socket; một phần FCM/Zalo/Email qua queue.

### Quyết định chuẩn hóa (implement dần từ Phase Notification)

1. Mọi side-effect thông báo đi qua **Notification Service** (không `io.emit` rải rác trong route khi thêm mới).
2. Mỗi loại có **template code** + **deepLink** (vd. `/student/schedule?session=...`).
3. Delivery tracking theo channel: `queued | sent | failed | skipped`.
4. **Idempotency:** `eventId + userId + type` (tránh double notify khi retry payment).
5. Reminder lịch 24h: **1 digest / user / ngày** (hoặc 1 popup tổng hợp), không N popup/N lớp trừ khi user bật.
6. Không gửi Zalo cho mọi micro-event; Zalo ưu tiên: mật khẩu, thanh toán, thi, hủy lịch quan trọng.
7. **Cấm** đưa mật khẩu vào payload lưu DB notification nếu có thể gửi one-time qua kênh riêng; nếu bắt buộc gửi mật khẩu lần đầu → không lưu body đầy đủ trong audit.

## Audit

### Đã có

- `SystemLog` (auth/action/device) — giữ cho ops/security trail.

### Quyết định

1. Bổ sung **AuditLog nghiệp vụ** (hoặc mở rộng SystemLog có schema đủ) với: `action`, `entityType`, `entityId`, `oldValue`, `newValue`, `actorUserId`, `actorRole`, `branchId`, `ip`, `userAgent`, refs mềm (course/student/teacher).
2. **Append-only** — API không cho sửa/xóa audit.
3. **Redact:** password, token, OTP, secret.
4. Critical mutations bắt buộc audit: course delete, password provision, payment settle, teacher reassign, grade edit, exam unlock, attendance edit, rating moderate, reward payout.
5. Retention: giữ hot ≥ 12 tháng; archive policy Ops (Phase Optimization).

## Consequences

- Phase 1: tạo model `AuditLog` (và optionally `DomainOutbox`) mà chưa bắt mọi route migrate ngay.
- Phase Notification: template registry + deep link map.
- Không phá `SystemLog` hiện tại; song song rồi hợp nhất đọc UI sau.
