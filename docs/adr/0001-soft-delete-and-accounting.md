# ADR 0001 — Soft delete khóa học & Accounting

- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Product + Architecture (QUANLYCMS)

## Context

Admin cần “xóa” khóa học khỏi catalog vận hành, nhưng hệ thống đã có học viên, lịch, thanh toán, hóa đơn. Soft delete sai cách sẽ làm lệch báo cáo tài chính.

## Decision

### 1. Soft delete Course (không hard delete)

Khi Admin xóa khóa học:

| Field | Ý nghĩa |
|-------|---------|
| `deletedAt` | Timestamp soft delete (null = còn hiệu lực catalog) |
| `deletedBy` | User id người xóa |
| `deleteReason` | Lý do (optional, max 500) |
| `status` | Chuyển `archived` (hoặc giữ + filter `deletedAt`) |

**Hành vi:**

- Catalog / đăng ký mới: **ẩn** course đã soft-delete.
- Enrollment / Schedule / Exam / Invoice / Payment đã phát sinh: **giữ nguyên**, vẫn đọc được lịch sử.
- Học viên đang active trên course: nhận Notification + ghi Audit.
- **Cấm** cascade xóa enrollment, payment, schedule, invoice.

### 2. Accounting — Ledger bất biến (chuẩn)

**Nguồn sự thật tài chính** = các bản ghi tiền đã chốt (`Invoice`, payment/SePay events, và sau này `LedgerEntry` append-only).

| Tình huống | Được phép | Không được phép |
|------------|-----------|-----------------|
| Soft-delete course | Ẩn khỏi KPI vận hành “khóa đang bán” | Xóa / sửa số tiền đã settled |
| Báo cáo tài chính | Σ từ ledger / payment settled | Σ từ `Course.price × count` hiện tại |
| Hoàn tiền | Tạo **reversal** / refund record mới | Xóa payment gốc |
| Điều chỉnh | Entry đối ứng + audit | UPDATE số tiền dòng cũ |

**Operational revenue (dashboard bán hàng):** có thể loại course `deletedAt != null` khỏi “đang mở bán”.

**Financial revenue (kế toán):** **không** giảm vì soft-delete; chỉ giảm khi có refund/reversal có chứng từ.

### 3. Deferred vs recognized (hướng đích)

- Thanh toán thành công → ghi nhận tiền vào; revenue recognition theo policy branch (ngay hoặc theo buổi) — chi tiết implement ở Phase Finance.
- Soft-delete **không** tự động unearn toàn bộ học phí đã thu.

## Consequences

- Phase DB phải thêm `deletedAt` / `deletedBy` / `deleteReason` trên `Course`.
- API `DELETE /courses/:id` = soft delete + event + notify + audit.
- Test bắt buộc: soft-delete không làm mất Invoice/Payment; financial report trước/sau khớp (trừ khi có reversal).

## Non-goals (Phase 0)

- Chưa bắt buộc tách bảng `LedgerEntry` ngay trong Phase 0–1 nếu Invoice/Payment đã đủ để không xóa tiền; Ledger chuẩn hóa ở Phase Finance.
- Không hard-delete vật lý kể cả Super Admin (trừ script ops có phê duyệt ngoài app).
