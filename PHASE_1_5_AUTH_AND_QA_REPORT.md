# Báo cáo Giai đoạn 1.5 — Phone Auth và QA

Ngày kiểm chứng: 31/08/2026

## 1. Kết luận

Trạng thái tổng thể: **CHƯA ĐẠT route integration**.

Phần code, fail-closed test gate, unit/contract tests và frontend build đã hoàn
thành. Route integration không được chạy vì Docker Desktop Linux Engine trả
HTTP 500 ở `_ping`; theo nguyên tắc an toàn, runner đã dừng và không dùng
`MONGODB_URI`/database của website làm phương án thay thế.

Không commit, push, deploy, migration, seed hoặc cleanup database thật.

## 2. Thay đổi xác thực

- Student, Teacher, Staff, Admin và Super Admin chỉ đăng nhập bằng số điện thoại
  Việt Nam + mật khẩu.
- Canonical form là `0[35789]xxxxxxxx`; input `+84...`, khoảng trắng, dấu chấm,
  gạch ngang và ngoặc hợp lệ được chuẩn hóa có kiểm soát.
- Resolver chỉ query field `phone` trong `Student` và `Teacher`; không fallback
  sang email, Zalo hoặc username.
- Không có hoặc có nhiều hơn một account khớp phone đều trả
  `INVALID_CREDENTIALS`; duplicate cross-role không được tự gộp.
- Super Admin dùng `MASTER_ADMIN_PHONE`; production fail-fast nếu thiếu/sai.
  JWT identity `id: "admin"` được giữ để tương thích refresh/MFA/profile.
- `/check-role` không trả account existence/role. Forgot-password trả response
  chung và không trả tên, phone account, mật khẩu mới hay alias plaintext.
- Email, `zalo`, `googleId`, `zaloId` vẫn được giữ làm dữ liệu liên hệ/hồ sơ.
- Account mới/cập nhật qua student, teacher và staff routes lưu phone canonical
  và kiểm tra uniqueness cross-role; không sửa dữ liệu legacy hàng loạt.

## 3. OAuth và frontend

Bốn route sau trả JSON HTTP 410, không redirect hoặc tạo OAuth cookie/session:

- `GET /api/auth/google`
- `GET /api/auth/google/callback`
- `GET /api/auth/zalo`
- `GET /api/auth/zalo/callback`

Google/Zalo strategy, redirect, token exchange và auto-create account đã bị gỡ
khỏi LIVE auth route. Passport initialization không còn được mount trong
`server.js`; `modules/auth/authRoutes.js` cũ vẫn unmounted.

Hai form public/internal chỉ hiển thị “Số điện thoại”, dùng `type="tel"` và gửi
field `phone`. CAPTCHA, MFA và liên hệ Zalo Admin vẫn được giữ.

## 4. Test database fail-closed

`tests/setup/testDatabaseGuard.js` bắt buộc:

- `NODE_ENV=test`;
- `TEST_DATABASE_URI`, không fallback;
- database bắt đầu `test_` hoặc kết thúc `_test`;
- URI khác `MONGODB_URI`;
- host trùng runtime cần `ALLOW_TEST_DB_HOST_MATCH=true`;
- drop/cleanup cần `ALLOW_TEST_DB_RESET=true`.

`server.js` không load `.env` khi test, dùng port riêng, chờ kết nối test DB và
không khởi động outbox worker, queue init, backup/file-retention cron. Compose
test bind Mongo 7 vào `127.0.0.1:27019` và không dùng persistent volume.

Harness tại `tests/helpers/phase15LiveHarness.js` seed/drop chỉ sau guard, spawn
đúng `server.js`, quản lý CSRF cookie/header và teardown process/database.

## 5. Ma trận route đã viết

`tests/integration/phase15_exam_auth_routes.test.js` bao phủ:

- phone login Student/Teacher/Staff/Admin/Master Admin, `0`–`+84`, refresh;
- từ chối email, Zalo-only, literal `admin`, sai portal, phone sai và duplicate;
- generic `/check-role`/forgot-password; CAPTCHA; MFA challenge;
- bốn OAuth route 410/no redirect/no cookie;
- student/teacher exam-bank role matrix và recursive no-secret DTO;
- attempt ownership, malformed answers, server grading, forged score và retry
  idempotent cho student/teacher;
- teacher profile/ExamResult tampering và practical URL contract;
- quiz concurrent submit, atomic result và server-side score.

Ma trận này **chưa tạo bằng chứng PASS** vì Docker health gate không đạt.

## 6. Kết quả lệnh thực tế

- `npm run test:phase15:unit`: **21/21 pass**.
- Focused `validateEnv` + staff phone edit: **17/17 pass**.
- Full unit runner: **283 tests, 279 pass, 4 fail**. Bốn lỗi nằm ngoài hunk
  Phase 1.5: avatar static wiring, cert-prep session timeout, teacher modal
  permission wiring và learning-access gate static contract.
- Backend auth/phone lint giới hạn: **pass**.
- Frontend auth lint giới hạn: **pass**.
- Lint route lớn có lỗi cũ: `studentRoutes.js` còn 88 `no-undef` ở các đoạn
  realtime/finance/attendance ngoài hunk phone.
- `node --check` các file backend/harness chính: **pass**.
- `cd client; npm run build`: **pass**, 2.282 modules transformed.
- `git diff --check`: **pass**.
- OAuth/fallback search trong LIVE `routes/authRoutes.js`: không còn Passport,
  Zalo token exchange, email/Zalo lookup hoặc literal-admin branch.
- `docker compose -p dashboard-phase15 -f docker-compose.test.yml up -d --wait`:
  **fail**, Docker engine `_ping` trả HTTP 500.
- `npm run test:phase15:integration` khi chưa có test env: **blocked exit 2**
  với thông báo bắt buộc `NODE_ENV=test`; không kết nối database.

## 7. Biến deployment

Production bắt buộc cấu hình:

- `MASTER_ADMIN_PHONE` — số Việt Nam hợp lệ, không hardcode;
- `MASTER_ADMIN_PASSWORD` hoặc `SystemSettings.adminPasswordHash`;
- các JWT/Redis/SMTP/SePay variables đã có trong validator.

Google/Zalo OAuth variables không còn là deployment dependency. Zalo OA/contact
variables vẫn có thể tồn tại cho notification và hỗ trợ.

## 8. Rủi ro còn lại

- Dữ liệu legacy có phone format ngoài tập variants hoặc phone trùng cross-role
  sẽ không đăng nhập; cần inventory read-only trước khi lập migration riêng.
- Không được tự động merge hoặc sửa duplicate trong Giai đoạn 1.5.
- Reset mật khẩu hiện vẫn dựa vào quy trình OTP/admin hiện hữu; default-password
  policy rộng hơn thuộc SEC-012/Giai đoạn 2.
- Bốn full-unit failure và repository lint debt chưa được sửa trong phạm vi này.
- Route integration, expiry/fingerprint thực DB và Mongo race evidence vẫn chờ
  Docker disposable hoạt động.

## 9. Cách chạy lại gate

1. Sửa Docker Desktop cho đến khi Linux Engine healthcheck hoạt động.
2. Chạy Compose theo `docs/PHASE_1_5_TESTING.md`.
3. Export biến từ `.env.test.example`, xác nhận URI port 27019 và DB `_test`.
4. Chạy `npm run test:phase15:integration`.
5. Chạy `docker compose -p dashboard-phase15 -f docker-compose.test.yml down -v`.
6. Chỉ đổi trạng thái báo cáo sang **ĐẠT** khi toàn bộ route matrix pass.

## 10. Rollback theo hunk

Rollback riêng từng nhóm: test guard/Compose/runner; phone utility/resolver;
auth contract/Super Admin env; OAuth 410/Passport removal; frontend labels;
integration tests. Không restore nguyên file lớn và không dùng reset/clean vì
working tree chứa thay đổi người dùng từ trước.

Rollback phone-only hoặc OAuth 410 sẽ mở lại bề mặt xác thực cũ; chỉ thực hiện
khi đã có bản thay thế an toàn.
