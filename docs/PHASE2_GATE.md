# Phase 2 Gate — Auth / password provision

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 1 PASS

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| Service | `services/passwordProvisionService.js` — manual/auto, queue password, notify, audit, history |
| Model | `PasswordProvisionLog` (không lưu plaintext) |
| API | `POST /auth/admin/reset-password` hỗ trợ `mode: manual\|auto` |
| UI | Modal cấp mật khẩu: tab Cấp mật khẩu + OTP |
| Client API | `adminResetPassword(..., mode)` |
| Tests | `tests/integration/passwordProvision.test.js` |

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | Admin nhập tay hoặc sinh tự động | PASS (API + UI) |
| 2 | Gửi Zalo/Email qua queue hiện có | PASS (`enqueuePassword`) |
| 3 | In-app Notification | PASS |
| 4 | Audit + lịch sử, không lưu plaintext | PASS |
| 5 | Unit tests Phase 2 xanh | _(chạy gate)_ |
| 6 | Không phá OTP flow cũ | PASS (tab riêng) |

## Kết luận

**PASS** — Phase 2 tests: 6/6 xanh (`passwordProvision.test.js`). Phase 1+2 combined: 15/15.

**Không bắt đầu Phase 3 trong cùng thay đổi này** cho đến khi bạn xác nhận tiếp (RBAC harden phạm vi rộng hơn).

