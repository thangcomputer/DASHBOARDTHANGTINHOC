# MOBILE AUTH MULTI-DEVICE — PHASE 1 IMPLEMENTATION

**Trạng thái:** Đã thêm nền tảng code additive; chưa production-ready, chưa bật flag, chưa kết nối database để kiểm thử, chưa deploy.  
**Ngày thực hiện:** 2026-10-24  
**Scope:** Student/Teacher mobile session; web legacy tiếp tục dùng flow cũ.

> Trạng thái hardening và các kiểm thử mới nhất được ghi tại [MOBILE_AUTH_PHASE1_HARDENING.md](./MOBILE_AUTH_PHASE1_HARDENING.md). Tài liệu này giữ snapshot của Phase 1 ban đầu.

## 1. Git baseline trước thay đổi

`git status --short --untracked-files=all` trước khi sửa:

```text
 M client/src/components/FloatingMessenger.jsx
?? MOBILE_APP_ANALYSIS.md
?? MOBILE_AUTH_MULTI_DEVICE_PLAN.md
```

- `FloatingMessenger.jsx` đã được người dùng sửa trước; giữ nguyên, không sửa/hoàn nguyên.
- Hai báo cáo trên đã tồn tại dưới dạng untracked trước khi bắt đầu phase này; giữ nguyên.
- Không commit, push, deploy, reset hoặc checkout.

## 2. File đã thay đổi

- `.env.example` — thêm `MOBILE_MULTI_SESSION_AUTH=false`; không sửa `.env` hay secret.
- `middleware/auth.js` — kiểm tra session cho access token có `sid`; token legacy không `sid` giữ đường validation cũ.
- `middleware/socketAuth.js` — xác minh `sid`, session và trạng thái account khi Socket.IO handshake; token legacy giữ kiểm tra version cũ.
- `routes/authRoutes.js` — thêm mobile login, dual-path refresh, logout/revoke theo session và API xem/thu hồi session.
- `server.js` — join room `session:<sid>`; session socket không ghi đè presence record web theo mô hình presence một socket/user hiện tại.

## 3. File mới

- `config/mobileMultiSessionAuth.js` — feature flag; chỉ giá trị `true` không phân biệt hoa/thường mới bật.
- `models/AuthSession.js` — schema và index khai báo cho collection riêng.
- `services/mobileAuthSessionService.js` — thao tác tạo, đọc, validate, rotate, revoke, revoke-all, liệt kê và touch session.
- `tests/unit/mobile_auth_session_service.test.js` — kiểm tra service với model giả lập, không database.
- `tests/unit/mobile_auth_session_routes.test.js` — kiểm tra flag OFF và từ chối admin/staff.
- `MOBILE_AUTH_PHASE1_IMPLEMENTATION.md` — báo cáo này.

## 4. AuthSession schema và index

Schema thêm collection `authsessions`, không thêm mảng session vào `Student`/`Teacher`.

| Trường | Nội dung |
|---|---|
| `sessionId` | UUID ngẫu nhiên, required và unique. |
| `userId`, `role` | User owner; role chỉ `student` hoặc `teacher`. |
| `clientType`, `platform` | `mobile`; platform chỉ `android`/`ios`. Metadata không cấp quyền. |
| `deviceLabel`, `appVersion`, `userAgent` | Metadata giới hạn độ dài ở login; không dùng cho authorization. |
| `createdAt`, `lastUsedAt`, `absoluteExpiresAt` | Thời điểm tạo, refresh gần nhất và mốc hết hạn tuyệt đối của session. |
| `revokedAt`, `revocationReason` | Trạng thái/nguồn thu hồi. |
| `refreshFamilyId` | ID ngẫu nhiên của refresh family. |
| `currentRefreshJtiHash` | SHA-256 của `jti`; không lưu raw refresh token. |

Index khai báo:

- Unique index trên `sessionId`.
- Compound index `{ userId, role, revokedAt, lastUsedAt }`.
- TTL index trên `absoluteExpiresAt`, chỉ dùng dọn record hết hạn; kiểm tra expiry vẫn được thực hiện khi validate/rotate.

Không kết nối MongoDB, tạo collection/index hay chạy migration trong task. Index thực tế chưa được xác minh; cần kiểm tra/vận hành index ở staging trước khi bật flag.

## 5. Token claims và backward compatibility

- Mobile access/refresh JWT có `sid`, `jti` và `aud: "mobile"`.
- Refresh JTI được hash để lưu trạng thái hiện tại theo session.
- Token có `sid` đi qua session validation; token không có `sid` vẫn dùng validation legacy.
- `tokenVersion` không bị tăng bởi mobile login. Session token bỏ qua so sánh version toàn user để web login legacy không làm mobile session khác bị vô hiệu.
- Session JWT vẫn phải khớp user/role trong AuthSession; HTTP tiếp tục kiểm tra user tồn tại, account lock/status và cập nhật permission theo DB.
- Không sửa schema `Student`/`Teacher`; không thay access/refresh JWT config TTL.
- Mobile session có mốc hết hạn tuyệt đối dựa trên expiry refresh token được cấp lúc login; refresh rotation không kéo dài mốc tuyệt đối.

## 6. Login và response

Endpoint mới: `POST /api/auth/login/mobile`.

- Flag OFF: trả `404 MOBILE_SESSION_AUTH_DISABLED`.
- Chỉ nhận role Student/Teacher và platform Android/iOS. `clientType` không được tin từ body; route tự xác định client là mobile.
- Dùng account/password/status/enrollment checks tương ứng public login; không dùng `deviceFingerprint`, không tăng `tokenVersion`, không ghi/xóa legacy refresh token hoặc fingerprint.
- Trả response envelope tương tự public login; chỉ thêm `data.sessionId`.
- Admin/Staff bị từ chối; hardcoded Super Admin không được đưa vào session store.
- CSRF hiện tại vẫn áp dụng do route không được miễn trong middleware `/api`.

Website không được chuyển sang session model mới và route login web hiện có không được chỉnh.

## 7. Refresh rotation

`POST /api/auth/refresh` phân luồng theo claim `sid` đã ký và xác minh:

- Không có `sid`: giữ nguyên legacy refresh behavior.
- Có `sid`: kiểm tra `aud`, role, JTI, feature flag và trạng thái session; atomic `updateOne` compare-and-swap theo session/user/role/current JTI hash/expiry/revoked state.
- Chỉ một refresh cạnh tranh có thể đổi JTI hiện tại. Refresh cũ bị blacklist sau khi CAS thành công.
- Duplicate/replay bị từ chối, không ghi đè session state và không revoke nhầm session đang dùng. Để tránh race ở client, mobile cần single-flight refresh. Nếu response đầu tiên bị mất sau CAS, client có thể phải đăng nhập lại; idempotent recovery chưa được triển khai.
- Không log raw refresh token.

## 8. Logout, revoke và session API

- Logout token có `sid`: revoke đúng session, không xóa legacy `Student/Teacher.refreshToken` hoặc fingerprint; ngắt socket trong room session nếu `io` sẵn sàng.
- Logout token legacy: giữ semantics hiện tại trong phase này.
- `GET /api/auth/sessions`: trả metadata của các session thuộc chính user; không trả JTI hash, refresh family hoặc token.
- `DELETE /api/auth/sessions/:sessionId`: update có điều kiện đồng thời theo `sessionId`, `userId`, `role` và trạng thái chưa revoke; user khác nhận 404 và không thể thu hồi session đó.
- `revokeAllSessions()` đã có trong service để dùng sau này; chưa expose API và chưa gắn vào password/reset/lock/MFA flows.

## 9. Socket.IO và presence

- Session Socket.IO handshake xác thực `sid`/session/account; gắn `socket.sessionId`; server join `session:<sid>` và giữ nguyên user/role/branch/group rooms.
- Logout hoặc DELETE session gọi `disconnectSockets(true)` trên room session. Redis adapter hiện hỗ trợ room operations liên instance khi hoạt động; nếu adapter fallback sang memory, disconnect chỉ đáng tin trong cùng process.
- Không refactor toàn Socket.IO.
- Presence store hiện biểu diễn một socket/user. Session socket không upsert đè record web để mobile connect/disconnect không xóa presence web. Hệ quả: presence hiện chưa phản ánh mobile-only session; hiển thị online tổng hợp nhiều thiết bị được tách sub-phase do cần thay đổi có kiểm thử riêng.
- `revokeAllSessions()` chưa ngắt socket tất cả session; cần wiring cùng distributed disconnect trước khi dùng cho security event.

## 10. CSRF, business API và exam

- Không sửa `middleware/csrf.js`, không skip auth/mobile, không dùng User-Agent để phân loại.
- Không đổi API nghiệp vụ Student/Teacher.
- Không sửa exam attempt, camera, proctor, screen capture, fullscreen, exam lock hay exam schema.
- Mobile login/session API không cung cấp quyền để start exam; các exam routes hiện tại không được thay đổi.

## 11. Password và account security

| Security event | Legacy hiện tại theo source đã rà | Session mới đề xuất | Triển khai phase này? |
|---|---|---|---|
| Đổi password | `change-password` đang xem không bump tokenVersion/xóa refresh token. | Revoke mọi mobile session sau khi đổi thành công. | Không; cần phase và regression riêng. |
| Admin reset password | Tăng tokenVersion và xóa legacy refresh token. | Revoke mọi mobile session, đồng thời giữ nguyên legacy web policy đã duyệt. | Không. |
| Account lock | HTTP auth kiểm tra trạng thái lock; socket đã kết nối không tự bị ngắt chỉ bởi lần kiểm tra handshake mới. | Revoke session và ngắt socket; kiểm tra lại ở request/handshake. | Không. |
| Account suspend/inactive | HTTP auth từ chối; socket session mới bị từ chối khi handshake. | Revoke session và ngắt socket đang mở. | Không. |
| Account delete | HTTP auth từ chối nếu user không còn; session record/socket cũ cần cleanup/revoke. | Revoke session trước/sau xóa theo lifecycle được duyệt. | Không. |
| MFA reset | MFA hiện dành cho tài khoản nội bộ; Admin/Staff mobile bị cấm. | Nếu scope admin được mở sau này, revoke session sau reset. | Không. |
| Revoke all | Chưa có session API legacy. | Service revoke các session active theo user/role. | Chỉ triển khai service; chưa API/wiring/socket fan-out. |

Đây là rủi ro còn lại: do không đổi security flows trong phase này, mobile session không tự bị revoke tức thời khi password/reset/lock/suspend/delete xảy ra; HTTP account guard vẫn bảo vệ một số request, nhưng Socket hiện hữu cần xử lý riêng.

## 12. Database impact

- Model khai báo collection `authsessions` và ba index nêu trên.
- Không sửa dữ liệu, schema Student/Teacher, không chạy migration, không kết nối staging/production hoặc gọi `createIndexes()`.
- Khi feature được sử dụng, Mongo/Mongoose có thể tạo collection/index theo cấu hình runtime; điều này chưa kiểm chứng trong môi trường deployed.
- Trước khi bật flag: xác nhận `autoIndex`/index provisioning, tạo index có kế hoạch vận hành và test staging. Không bật production theo báo cáo này.

## 13. Feature flag

`MOBILE_MULTI_SESSION_AUTH=false` trong `.env.example`; runtime mặc định OFF khi biến vắng mặt.

- Chưa sửa `.env` hoặc `client/.env.production`.
- OFF: mobile login route trả 404; legacy JWT không `sid` tiếp tục flow cũ.
- Session token `sid` bị từ chối khi flag OFF; logout đã ký với `sid` vẫn có thể revoke phiên đó.
- Không có yêu cầu bật flag ở staging/production; chưa bật ở bất kỳ môi trường nào trong task.

## 14. Test và validation

Không dùng tài khoản production, không chạy integration test cần MongoDB và không ghi database.

| Test/kiểm tra | PASS | FAIL | NOT RUN | Ghi chú |
|---|:---:|:---:|:---:|---|
| Mobile session service + concurrent CAS | ✓ |  |  | Fake model cô lập; xác nhận một winner, session Android không đổi session iOS. |
| Validate owner/role/revoked/expired | ✓ |  |  | Fake model; không phải Mongo integration. |
| Revoke/list sessions, không lộ security material | ✓ |  |  | Fake model. |
| Feature OFF, từ chối Admin/Staff mobile | ✓ |  |  | Express route test; không truy vấn user database. |
| Legacy `authMiddleware` regression | ✓ |  |  | Test hiện có, hardcoded admin, missing/invalid/expired/blacklisted. |
| CSRF regression | ✓ |  |  | Test hiện có: token thiếu, cookie/header match, webhook skip. |
| Presence socket guard regression | ✓ |  |  | Test hiện có. |
| Tổng test đã chạy | **19** | **0** |  | `node --test --test-force-exit ...`; 19 passed. |
| ESLint file JS thay đổi | ✓ |  |  | 0 errors; 4 warnings ở các đoạn `server.js` khác với phần mới. |
| VS Code Problems | ✓ |  |  | Không có diagnostic mới ở các file đã kiểm tra. |
| `git diff --check` | ✓ |  |  | Không có lỗi whitespace. |
| Mongo-backed mobile login/refresh/logout/session API |  |  | ✓ | Không có DB test an toàn được xác nhận; không chạy theo yêu cầu. |
| Socket.IO Redis multi-instance revoke |  |  | ✓ | Chưa chạy Redis/socket integration. |
| Student/Teacher real DB login, MFA, permissions/branch |  |  | ✓ | Không dùng dữ liệu production; cần staging/test DB cô lập. |
| Web + Android + iOS cùng hoạt động; exam web giữ nguyên |  |  | ✓ | Chưa có mobile client và chưa chạy end-to-end. |

## 15. Mức sẵn sàng

| Trạng thái | Nội dung |
|---|---|
| **Implemented** | Model/service, feature flag, mobile login path, session-aware access/refresh/logout, session list/revoke, session-aware socket handshake/room. |
| **Tested** | Service CAS/ownership/expiry bằng fake model; flag OFF/admin-staff reject; legacy auth/CSRF/presence unit regression. |
| **Chưa test** | Mongo index/casting, login/refresh round-trip thật, revoke sockets qua Redis, staging web/mobile coexistence và exam regression end-to-end. |
| **Production-ready?** | **Chưa.** Chưa bật flag; security-event revocation, mobile presence aggregation, multi-instance integration, duplicate-refresh recovery và DB index provisioning còn cần xử lý/duyệt. |

## 16. Rủi ro còn lại

| Severity | Rủi ro |
|---|---|
| **HIGH** | Revoke-all chưa được nối với password/reset/lock/suspend/delete/MFA lifecycle; socket hiện hữu có thể tồn tại cho đến khi bị disconnect hoặc reconnect. |
| **HIGH** | Redis adapter fallback sang memory không bảo đảm disconnect session sockets ở mọi instance. |
| **HIGH** | Chưa chạy Mongo integration/index tests; không bật feature flag trước staging và xác minh schema/index. |
| **HIGH** | Presence chưa tổng hợp nhiều thiết bị; mobile socket không làm sai presence web nhưng mobile-only online chưa được phản ánh. |
| **MEDIUM** | Concurrent refresh chỉ cho một CAS winner; request trùng bị từ chối. Mobile client phải single-flight; mất response sau rotation có thể cần login lại. |
| **MEDIUM** | Absolute expiry được cố định ở thời điểm login theo refresh expiry hiện tại; cần xác nhận policy session tối đa trước khi bật cho người dùng. |
| **LOW** | Metadata device label/app version do client khai báo; chỉ phục vụ hiển thị, không dùng để cấp quyền. |

## 17. Rollback

1. Giữ `MOBILE_MULTI_SESSION_AUTH` OFF; không cần sửa/revert legacy user fields.
2. Với rollback code trước khi bật flag, không có mobile session nào được tạo qua endpoint mới.
3. Nếu đã bật ở môi trường test, tắt flag để từ chối session token mới; các session record nếu có hết hạn/được thu hồi theo kế hoạch riêng.
4. Không xóa `Student.refreshToken`, `Teacher.refreshToken`, `deviceFingerprint`, `tokenVersion`, user hoặc exam data.
5. Không xóa collection/index tự động; mọi cleanup cần phê duyệt riêng sau khi xác minh môi trường.

## 18. TODO trước khi có thể bật flag

1. Chốt liệu refresh retry cần idempotent recovery hay single-flight client là đủ.
2. Thêm security-event revoke wiring và distributed socket disconnect cho revoke-all.
3. Thiết kế/kiểm thử presence aggregate đa socket mà không đổi contract web.
4. Chạy tests với MongoDB test riêng, xác nhận unique/compound/TTL indexes và concurrency thật.
5. Chạy Socket.IO integration với Redis adapter và fallback mode.
6. Tạo test đầy đủ mobile login/refresh/logout/list/revoke cho Student/Teacher, admin denial, ownership và CSRF.
7. Xác nhận giới hạn session, absolute expiry và thông báo đăng nhập lại.
8. Thực hiện web + mobile canary ở staging; xác nhận exam web đang chạy không bị ảnh hưởng.
9. Review security, load/latency và rollback rehearsal; chỉ sau đó chủ hệ thống mới xem xét bật flag.

**Kết luận:** Phase này đã thêm code nền có flag OFF, nhưng chưa chứng minh full multi-device trên database/socket thực và chưa đủ điều kiện production. Không có deploy, migration hoặc thao tác production nào được thực hiện.
