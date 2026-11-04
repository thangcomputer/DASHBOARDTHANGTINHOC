# MOBILE AUTH MULTI-DEVICE — PHASE 1 HARDENING

**Kết luận:** Hardening code-path đã hoàn tất ở mức có thể kiểm thử cô lập; **chưa đủ điều kiện staging/production** vì MongoDB integration và Socket.IO multi-instance chưa được xác minh. Feature flag vẫn OFF.

## 1. Phạm vi và giới hạn an toàn

- Không kết nối MongoDB hoặc Redis đang chạy trên máy vì chưa xác minh đó là test instance độc lập.
- Không dùng tài khoản/dữ liệu production; không chạy migration, deploy, commit hoặc push.
- Không bật `MOBILE_MULTI_SESSION_AUTH`; không sửa CSRF middleware, schema Student/Teacher, exam, camera, hay UI web.
- Giữ nguyên thay đổi có sẵn của người dùng tại `client/src/components/FloatingMessenger.jsx`.

## 2. Tình trạng môi trường kiểm thử

| Thành phần | Kết quả |
|---|---|
| MongoDB test được khai báo | `.env.test.example` chỉ định `127.0.0.1:27019/dashboardthangtinhoc_phase15_test`. |
| MongoDB test listener | **Không có** listener trên port `27019`; không có executable `mongod` tìm thấy qua PATH để khởi tạo instance cô lập. |
| MongoDB port `27017` | Có listener nhưng không xác định được instance/database thuộc test hay runtime; **không kết nối**. |
| Redis port `6379` | Có listener nhưng không xác định được instance test hay runtime; **không kết nối**. |
| Mongo integration test | Đã bổ sung test được guard chặt theo database test, loopback host và port khác `27017`; **NOT RUN** do test Mongo chưa sẵn sàng. |

## 3. Phát hiện và xử lý

| Severity | Phát hiện trước hardening | Xử lý / trạng thái |
|---|---|---|
| HIGH | `revokeAllSessions()` chưa được nối với đổi/reset mật khẩu, khóa tài khoản, suspend/inactive hoặc xóa user; socket mobile đang mở có thể tiếp tục hoạt động. | Đã nối thu hồi session và ngắt room `session:<sid>` cho các security event Student/Teacher được hỗ trợ. Thất bại sau khi thay đổi tài khoản được trả `503 MOBILE_SESSION_REVOCATION_FAILED`, không báo thành công giả. |
| HIGH | Lockout Teacher sau số lần đăng nhập sai không thu hồi session mobile đang hoạt động. | Đã nối sự kiện khóa do đăng nhập sai vào các luồng đăng nhập Teacher web/mobile hiện có; chỉ phát sinh revoke khi sắp chạm ngưỡng lock và feature flag bật. |
| HIGH | Hành vi Mongo thực tế — unique/index, casting, ownership và CAS đồng thời — chưa được xác minh. | Đã thêm [Mongo integration test](./tests/integration/mobile_auth_session_mongo.test.js), nhưng chưa chạy. Không tuyên bố Mongo/index đã PASS. |
| HIGH | `disconnectSockets(true)` qua các instance phụ thuộc Redis adapter hoạt động; khi adapter fallback sang memory, disconnect có thể chỉ tới process hiện tại. | Chưa có Redis test instance; **chưa xác minh multi-instance**. Session đã revoke vẫn bị từ chối ở request/handshake mới. |
| MEDIUM | Presence hiện có mô hình một socket/user, chưa tổng hợp trạng thái đa thiết bị. | Giữ nguyên presence web; mobile không ghi đè presence web. Mobile-only online và tổng hợp đa thiết bị vẫn là giới hạn đã biết. |
| MEDIUM | Nếu response refresh bị mất sau khi CAS thành công, lần retry dùng token cũ sẽ bị từ chối. | Chưa đổi giao thức; ứng dụng mobile cần single-flight refresh. Có thể phải đăng nhập lại nếu mất response sau rotation. |

## 4. Code được harden

- `revokeAllSessions()` chỉ chấp nhận role `student` hoặc `teacher`, trả số lượng revoke cùng các `sessionId` để xử lý socket room.
- `revokeMobileSessionsForUser()` được feature-flag gate; khi flag OFF không truy cập session store và không thay đổi legacy behavior.
- Security event gọi revoke sau khi thay đổi dữ liệu tài khoản. Nếu revoke không hoàn tất, API trả lỗi rõ ràng nêu thay đổi tài khoản đã lưu nhưng phiên mobile có thể chưa bị thu hồi.
- Các luồng được nối:
  - Đổi mật khẩu và Admin reset mật khẩu.
  - Student bị chuyển sang inactive/suspended, khóa tài khoản hoặc xóa.
  - Teacher bị chuyển sang inactive/suspended, suspend, tự động lockout hoặc xóa.
- Không gọi revoke với vai trò Admin/Staff; mobile session hiện chỉ cho phép Student/Teacher.
- Presence, legacy refresh token/cookie, CSRF, exam và API contract web không được refactor trong hardening này.

## 5. CSRF, auth và Socket.IO

- Mobile routes vẫn nằm dưới `/api` và không được miễn CSRF; `middleware/csrf.js` không thay đổi.
- Regression CSRF đã chạy: thiếu token trả `403 CSRF_INVALID`; cookie/header hợp lệ được chấp nhận; webhook prefix tiếp tục được skip như hiện tại.
- Mobile token có session tiếp tục phải qua session validation ở HTTP/socket handshake. Revoke session ngăn request/handshake mới.
- Thu hồi chủ động socket dựa trên room `session:<sid>`. Chưa xác minh khả năng fan-out giữa nhiều instance khi Redis adapter unavailable/fallback.
- Presence một socket/user chưa được mở rộng; đây là giới hạn UX, không phải trạng thái bảo đảm online đầy đủ cho mobile.

## 6. Kiểm thử

| Kiểm thử | Trạng thái | Ghi chú |
|---|---|---|
| Session service, ownership, expiry, CAS fake model | PASS — 6 tests | Không dùng MongoDB. |
| Session security helper: flag OFF, disconnect rooms, lỗi revoke | PASS — 3 tests | Fake service/Socket.IO. |
| Mobile auth route: flag OFF, chặn Admin/Staff, từ chối token khi OFF | PASS — 3 tests | Dùng `--test-force-exit` vì module auth có timer nền không unref. |
| CSRF regression | PASS — 3 tests | Express test server cục bộ, không database. |
| Presence/null-payload regression | PASS — 6 tests | Kiểm tra source/UI helper hiện hành. |
| JavaScript syntax checks | PASS | Các route, service và Mongo integration test mới. |
| ESLint cho service/test mới | PASS | Chạy `eslint --no-ignore` cho các file mới liên quan. |
| ESLint cho toàn bộ route lớn đã chạm | Có lỗi baseline | Có nhiều diagnostic ở các phần route khác; kiểm tra diagnostic tập trung không thấy lỗi tại các đoạn hardening đã thêm. |
| Mongo persistence/index/CAS integration | NOT RUN | Không có Mongo test listener an toàn được xác nhận. |
| Redis/Socket.IO multi-instance | NOT RUN | Không có Redis test instance được xác nhận. |
| Web + mobile trên staging; exam end-to-end | NOT RUN | Chưa có mobile client/staging test. |

## 7. Readiness gates

**Chưa production-ready. Không bật feature flag dựa trên báo cáo này.**

Trước staging cần:

1. Cấp một MongoDB test instance cô lập và xác minh URI/port/database; không dùng listener `27017` hiện chưa xác định.
2. Chạy `tests/integration/mobile_auth_session_mongo.test.js` trên test database; xác minh unique/compound/TTL index, owner scoping và concurrent CAS.
3. Cấp Redis test instance độc lập rồi kiểm tra revoke/disconnect khi Socket.IO chạy nhiều instance; xác nhận hành vi fallback.
4. Chạy staging regression cho password change/reset, account lock/suspend/delete, CSRF và web login/refresh/logout legacy.
5. Kiểm thử song song web và Android/iOS; giữ exam trên web cho tới khi POC thiết bị thật và yêu cầu nghiệp vụ được duyệt.
6. Chỉ sau các bước trên mới đề xuất bật flag trong staging; production cần phê duyệt và kế hoạch rollback riêng.
