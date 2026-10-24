# Mobile Auth Backend Validation

> **Scope distinction:** The original environment and test-results sections below record the historical run on the dirty `feature/mobile-native-qa` source worktree. The isolated clean-branch rerun for the checkpoint is recorded separately under “Clean worktree checkpoint”; only that rerun validates the isolated branch.

## Kết luận

**BACKEND MOBILE AUTH READY FOR CLIENT POC**

Readiness này chỉ áp dụng cho backend mobile multi-session auth trong môi trường test cô lập. Không có Mobile client nào được nối API, và đây không phải xác nhận production readiness.

## Out-of-scope precheck

`npm run test:phase15:unit`: **27/28 PASS**; một test phụ thuộc exam bank trả `EXAM_BANK_UNAVAILABLE` (503). Không chạy lại hoặc sửa exam bank/backend/test này vì nằm ngoài scope.

## Environment và an toàn

| Hạng mục | Kết quả |
| --- | --- |
| Branch | `feature/mobile-native-qa` |
| Test MongoDB | `mongo:7`, bind loopback `127.0.0.1:27019`, database riêng `dashboardthangtinhoc_mobile_auth_test` |
| Test Redis | `redis:7-alpine`, bind loopback `127.0.0.1:6382` |
| Test Compose | `docker-compose.mobile-auth-test.yml`; chỉ khởi động hai service test chuyên biệt |
| Test database guard | `NODE_ENV=test`; URI test tường minh; không truyền `MONGODB_URI`; không dùng reset database |
| Feature flag | Mặc định `false` trong `.env.example` và `.env.test.example`; chỉ bật bên trong process test khi kiểm tra mobile path |
| Redis 6379 | Không kết nối, gửi lệnh, dừng hoặc thay đổi |
| Redis 6381 | Không kết nối, gửi lệnh, dừng hoặc thay đổi |
| MongoDB 27017 | Không kết nối, truy vấn, dừng hoặc thay đổi |
| Cleanup | Hai container/network test đã dừng sau kiểm thử; Mongo test volume được giữ nguyên, không xóa |

## Test results

| Nhóm | Kết quả | Bằng chứng |
| --- | --- | --- |
| Mobile-auth unit tests | **12/12 PASS** | Flag OFF, role boundary, session security/service, owner scoping, expiry và CAS với fake model |
| MongoDB session integration | **1/1 PASS** | Unique/compound/TTL indexes, duplicate session ID bị từ chối, owner validation, expiry, refresh CAS một winner, revoke |
| HTTP/Socket.IO backend integration | **11/11 PASS** | Express auth routes/middleware trên MongoDB và Redis thật; Student/Teacher, multi-session, refresh/logout/revoke, CSRF, legacy web và hai Socket.IO instances |
| Redis blacklist | **PASS** | Redis thật trả PONG; refresh token rotation được ghi/đọc qua Redis; không dựa vào memory fallback |
| Redis Socket.IO adapter | **PASS** | Hai Socket.IO server dùng Redis adapter; revoke từ server API ngắt đúng socket ở instance kia, session khác vẫn kết nối |
| ESLint mục tiêu | **PASS** | Các test mobile-auth liên quan |
| `git diff --check` | **PASS** | Không phát hiện whitespace error |

### Ma trận yêu cầu

| Kiểm tra | Trạng thái | Ghi chú |
| --- | --- | --- |
| Flag OFF và legacy Web | **PASS** | Mobile login bị tắt; Web login/refresh/logout vẫn hoạt động và access token legacy không có `sid` vẫn qua auth |
| Student mobile login | **PASS** | Hai lần đăng nhập tạo hai session riêng; cả hai token đều hợp lệ |
| Teacher active login | **PASS** | Token role vẫn là `teacher` |
| Teacher pending/locked | **PASS — theo behavior hiện tại** | Pending được phép login theo cùng rule của legacy public login; locked bị chặn 403 |
| Admin/Staff mobile login | **PASS** | Bị chặn với `MOBILE_ROLE_NOT_ALLOWED` |
| Claims `sid`, `jti`, `aud=mobile` | **PASS** | Đã kiểm tra access/refresh claims; không ghi token ra report |
| Hai thiết bị cùng user | **PASS** | Login thiết bị B không làm mất hiệu lực session A |
| Refresh độc lập và race/replay | **PASS** | Hai refresh đồng thời cùng token có đúng một response thành công; token cũ bị từ chối; session còn lại refresh độc lập |
| Logout session hiện tại | **PASS** | Access/refresh và socket của A bị từ chối/ngắt; B vẫn dùng được |
| Session list/revoke | **PASS** | Chỉ trả session của owner; revoke một session không ảnh hưởng session gọi API; user khác không thể list/revoke |
| Session expiry | **PASS** | Mongo-backed validation/rotation từ chối session quá hạn; API list biểu diễn trạng thái `expired` |
| CSRF | **PASS** | POST thiếu double-submit cookie/header nhận 403 `CSRF_INVALID`; flow cookie + header hợp lệ hoạt động |
| Security-event revoke | **PASS — helper** | Helper revoke trên Mongo thật và ngắt session room qua Redis adapter; không chạy riêng từng route đổi mật khẩu/lock/suspend |
| Redis unavailable/memory fallback | **NOT RUN** | Không dùng fallback để tuyên bố Redis integration PASS |
| Presence đa thiết bị | **KNOWN LIMITATION** | Mobile socket hiện không ghi vào presence store một-socket/user; không có trạng thái online tổng hợp cho mobile-only. Không mở rộng scope vì đây không phải auth POC gate. |
| Revoke all other sessions API | **NOT APPLICABLE** | Không có API này; không tự thêm |

## Thay đổi trong lượt validation

- Cô lập cấu hình test Redis khỏi port bị cấm: chuyển sang `6382` (đã preflight không có listener; `6383` được kiểm tra dự phòng).
- Đổi test database sang `dashboardthangtinhoc_mobile_auth_test`; giữ Mongo trên port test `27019`.
- Bổ sung integration test dùng auth route/middleware thật với MongoDB/Redis test, gồm hai Socket.IO instances.
- Bổ sung assertion real-Mongo cho expiry.
- Tạo [MOBILE_AUTH_INTEGRATION_CONTRACT.md](./MOBILE_AUTH_INTEGRATION_CONTRACT.md) dựa trên source và test đã chạy.

Không sửa Mobile UI/client, exam bank, backend auth runtime/routes, production database, hoặc production Redis. Không commit/push vì worktree có sẵn nhiều thay đổi ngoài phạm vi; các thay đổi có sẵn được giữ nguyên.

## Còn ngoài xác nhận

- Không chạy full production `server.js` cùng toàn bộ hệ thống phụ thuộc; HTTP integration mount trực tiếp auth routes và middleware thật trong Express test app cô lập.
- Không chạy riêng từng route security-event như password reset/suspend/delete; helper/session revocation và distributed socket disconnect đã được chạy với service thật.
- Chưa kiểm tra Redis-down fallback; không được xem kết quả này là fallback verification.
- Mobile client POC vẫn cần tự lấy CSRF token, giữ token an toàn và single-flight refresh. Không có client/API wiring trong lượt này.

## Clean worktree checkpoint (2026-10-24)

- Branch: `feature/mobile-auth-backend-validation`
- Base: `6d4b182ef79fc22891effcac2fe05239e04db926`
- Worktree: `DASHBOARDTHANGTINHOC-auth-clean`
- Test dependencies were reused from the source worktree via `NODE_PATH`; no dependency manifest or lockfile was changed.
- All integration tests ran against the dedicated loopback MongoDB `127.0.0.1:27019` and Redis `127.0.0.1:6382` services. Production/default ports were not contacted.
- `node --test --test-force-exit` was used because importing the legacy route module leaves open handles after its tests complete; the runner reported all tests complete before exiting.

| Gate | Clean-worktree result |
| --- | --- |
| Mobile-auth unit tests | **12/12 PASS** |
| MongoDB session integration | **1/1 PASS** |
| HTTP/Socket.IO backend integration | **11/11 PASS** |
| Focused ESLint on mobile-auth implementation files | **PASS** |
| ESLint regression check on modified existing files | **No new diagnostics**; `routes/studentRoutes.js` retains 88 baseline errors present at `HEAD`, while `routes/teacherRoutes.js` and `server.js` counts are unchanged |
| `node --check routes/teacherRoutes.js` | **PASS** |
| `git diff --check` | **PASS** |
| Targeted secret scan | **No matches** |

This clean-branch validation does not run the Phase15 exam suite and does not change the out-of-scope result: **27/28 PASS; one exam-bank-dependent test returned `EXAM_BANK_UNAVAILABLE` (503)**.
