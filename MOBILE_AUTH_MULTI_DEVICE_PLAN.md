# Kế hoạch Authentication đa thiết bị cho Web và Mobile

> **Trạng thái:** Phân tích và đề xuất, chưa được phê duyệt để triển khai.  
> **Phạm vi:** Cho phép website hiện tại và ứng dụng React Native chạy song song, đồng thời thiết kế vòng đời phiên an toàn.  
> **Ràng buộc:** Báo cáo này không thay đổi source, API, authentication, database, cấu hình, `.env`, hay hệ thống production. Không cài package, chạy migration, commit, push hoặc deploy.

## 1. Tóm tắt điều hành

Website hiện dùng JWT bearer, refresh token rotation và một số cơ chế single-session gắn trực tiếp trên từng document `Student`/`Teacher`. Một tài khoản có một `refreshToken`, một `deviceFingerprint` và `tokenVersion`; đăng nhập mới ở các luồng chính tăng `tokenVersion`. Đây không phải mô hình phiên độc lập theo từng thiết bị.

Vì vậy, nếu app chỉ gọi login/refresh hiện tại như một client khác, phiên web và mobile có thể làm vô hiệu refresh/access token của nhau hoặc gây xung đột thiết bị. Logout hiện tại cũng xóa refresh token dùng chung của tài khoản, không phải chỉ phiên gọi logout. Muốn hỗ trợ chạy song song đáng tin cậy cần thiết kế session theo từng client/thiết bị và giữ tương thích với luồng web.

**Khuyến nghị:** bổ sung session store bền vững, mỗi phiên có định danh riêng; refresh rotation và thu hồi theo phiên; giữ quyền/role/branch scope phía backend; giữ nguyên envelope response hiện tại cho web; triển khai additive và có feature flag. Không mở thi trên mobile trong đợt auth đầu tiên. Xem xét tách xử lý Socket.IO theo session để logout/revoke có hiệu lực cả với kết nối đang mở.

**Chưa đủ bằng chứng để khẳng định:** toàn bộ các hành vi đăng nhập nhiều thiết bị dưới đây đã được kiểm thử trên production. Kết luận dựa trên source hiện tại, không thực hiện đăng nhập thật hoặc truy cập dữ liệu production.

## 2. Tài liệu và source đã đối chiếu

- Báo cáo kiến trúc trước: `MOBILE_APP_ANALYSIS.md`.
- Authentication/backend: `routes/authRoutes.js`, `middleware/auth.js`, `middleware/socketAuth.js`, `middleware/csrf.js`, `middleware/tokenBlacklist.js`.
- User schema: `models/Student.js`, `models/Teacher.js`.
- Presence/Socket.IO: `config/presenceStore.js`, `server.js`, `client/src/context/SocketContext.jsx`.
- Web client auth: `client/src/services/api.js`, `client/src/App.jsx`, `client/src/components/LoginPage.jsx`, `client/src/components/AdminLoginPage.jsx`, `client/src/utils/deviceFingerprint.js`.
- Thi: `routes/studentRoutes.js`, `routes/teacherRoutes.js`, `services/examAttemptService.js`, `services/examAttemptStore.js`, `client/src/components/StudentTest.jsx`.

## 3. Xác minh hiện trạng

### 3.1 Login theo luồng

| Luồng | Quan sát từ source | Tác động khi dùng thêm mobile |
|---|---|---|
| `/api/auth/login/public` | Dành cho student/teacher; nhận phone, password, role, `deviceFingerprint`, `force`; kiểm tra trạng thái/điều kiện truy cập; gọi kiểm tra xung đột thiết bị; tăng `tokenVersion`; lưu một refresh JWT vào user document. | Login mới có thể làm token trước đó lệch version; refresh token mới ghi đè token được lưu trước. |
| `/api/auth/login` legacy | Cũng xác thực student/teacher; kiểm tra fingerprint/xung đột; tăng `tokenVersion`; lưu một refresh token. | Cùng ràng buộc single-session như public login. |
| `/api/auth/login/internal` | Dành cho admin/staff, CAPTCHA; DB admin/staff có kiểm tra fingerprint; có thể yêu cầu MFA; `completeInternalLogin` tăng version và ghi một refresh token. | Phiên DB admin/staff mới có thể vô hiệu phiên cũ. |
| Super Admin cấu hình qua `MASTER_ADMIN_PHONE` | Sinh JWT với ID `admin`, không lưu refresh token trong user document và không kiểm tra token version trong auth middleware; MFA có thể áp dụng theo `SystemSettings`. | Là ngoại lệ stateless; không thể áp dụng session revoke theo DB hiện tại giống user thường. Không khuyến nghị đưa admin cứng vào mobile MVP. |
| `/api/auth/mfa/verify` | Tạo token sau khi OTP hợp lệ; DB admin/staff đi qua `completeInternalLogin`; admin cứng đi qua `issueAdminTokens`. | Chính sách multi-device phải áp dụng nhất quán sau bước MFA, không coi MFA challenge là một session đã xác thực. |

Frontend web lấy CSRF token trước login, gửi cookie credentials và `X-CSRF-Token`. Login student/teacher gửi fingerprint ngẫu nhiên duy trì trong `localStorage`; đây là ID phía client, không phải chứng minh phần cứng đáng tin cậy.

### 3.2 Access token, refresh và version

- Access token mặc định 8 giờ và refresh token mặc định 30 ngày theo `generateTokens`/cấu hình hiện tại.
- Refresh JWT được gửi trong JSON body tới `/api/auth/refresh`. Với student/teacher và DB admin/staff, server so sánh nguyên refresh token với một trường `refreshToken` trên user document, blacklist token cũ rồi cấp và lưu token mới.
- Refresh token mismatch/reuse ở luồng DB hiện có thể xóa trường refresh token và tăng `tokenVersion` thêm 1000, khiến token version cũ không còn hợp lệ.
- Web client lưu access/refresh token và user trong `localStorage`; refresh song song được gom qua một promise trong cùng runtime/tab. Cơ chế này không phải khóa liên tab/thiết bị.
- Access middleware kiểm tra blacklist, chữ ký, user tồn tại, `tokenVersion` và một số trạng thái account. Socket middleware kiểm tra blacklist và version lúc handshake.
- `GET /api/auth/me` có kiểm tra version theo điều kiện token version thấp hơn DB; đây không nên là lớp kiểm tra duy nhất vì HTTP auth middleware đã có so sánh riêng.
- `change-password` cập nhật password nhưng source đang xem không tăng `tokenVersion` hoặc xóa refresh token. `admin/reset-password` có tăng version và xóa refresh token. Hai hành vi hiện không đồng nhất.
- Refresh rotation không được thực hiện nguyên tử theo session riêng; việc so sánh/ghi một trường token dùng chung tạo rủi ro race giữa các refresh đồng thời và các thiết bị.

### 3.3 Logout và thu hồi hiện tại

- `/api/auth/logout` có thể nhận access token và refresh token. Token được blacklist theo token cụ thể; nếu identity của refresh/access được xác minh, server xóa `refreshToken` và `deviceFingerprint` khỏi document student/teacher hoặc teacher admin/staff tương ứng.
- Việc xóa trường refresh là cấp tài khoản, không ràng buộc giá trị refresh token gửi lên phải là token hiện đang lưu. Do đó, mô hình hiện tại không thể biểu diễn “logout đúng thiết bị” một cách độc lập.
- Logout hardcoded admin bỏ qua xóa DB vì không có bản ghi session user; token gửi lên vẫn có thể blacklist.
- Web client cố gọi logout nhưng vẫn xóa token local khi request lỗi/offline. Tác động cần lưu ý: local state có thể bị xóa trong khi server chưa nhận yêu cầu revoke.
- Không thấy API quản lý danh sách phiên/thiết bị đăng nhập cho người dùng trong các luồng đã kiểm tra.

### 3.4 CSRF và session cookie

- `server.js` mount `csrfProtection` trên toàn bộ `/api` trước router. Các POST/PUT/PATCH/DELETE bị yêu cầu double-submit cookie `csrf_token` và header `X-CSRF-Token`, ngoại trừ webhook, healthz và endpoint cấp CSRF token.
- Cookie hiện là `sameSite: lax`, `path: /`, `httpOnly: false`, `secure` trong production, hạn 24 giờ; không đặt domain rõ ràng.
- Website chủ động lấy token qua `/api/auth/csrf-token`, gửi cookie credentials và header cho login, refresh và logout.
- `express-session` với cookie `qcms.sid` có tồn tại toàn cục, nhưng API auth được quan sát đang dựa vào JWT bearer; không được nhầm session cookie này với session multi-device JWT.
- Native networking không được giả định tự động lưu/gửi cookie giống trình duyệt. Không nên bỏ CSRF toàn cục hoặc nới CSRF cho `/auth` để “làm cho mobile chạy”. Cần POC cookie jar + header trên iOS/Android hoặc được duyệt một cơ chế native riêng có threat model tương đương.

### 3.5 Blacklist và sự kiện realtime

- `tokenBlacklist` dùng Redis nếu sẵn sàng, nếu không dùng `Map` trong process. Dữ liệu blacklist nằm trong Map sẽ mất khi process khởi động lại; khả năng chia sẻ/revoke liên instance phụ thuộc Redis availability.
- Socket token được kiểm tra lúc kết nối. Các handler socket nhận dạng user từ `socket.user`; trong luồng đã đối chiếu chưa thấy kiểm tra blacklist/session version lại trên từng event hay tự disconnect socket khi HTTP logout/revoke.
- Presence hiện có một record theo role/user, lưu socketId mới nhất. Socket cũ không xóa record mới nhờ so khớp socketId; nhưng khi socket mới nhất disconnect, record có thể bị xóa dù socket cũ vẫn kết nối. Đây là presence “một socket gần nhất”, không phải danh sách thiết bị/phiên.
- Rooms theo user/role/branch có thể gửi event đến nhiều socket cùng người dùng; khi có multi-device, cần kiểm tra sự kiện, room và broadcast có chủ ý fan-out tới tất cả phiên hay chỉ phiên hiện tại.
- Đăng nhập/revoke HTTP không đồng nghĩa Socket.IO connection đang mở đã bị ngắt ngay.

## 4. Hành vi đa thiết bị có thể suy ra

| Case | Kết quả theo source hiện tại | Mức chắc chắn |
|---|---|---|
| Student đăng nhập web rồi login mobile bằng endpoint public | Login mobile có thể xung đột fingerprint; nếu được cho qua thì tăng `tokenVersion` và ghi đè refresh token. Token web cũ có thể không còn được chấp nhận; refresh web cũ không còn là token hiện tại. | Được chứng minh từ handler, nhưng chưa chạy kiểm thử trên môi trường thật. |
| Teacher đăng nhập trên web và thiết bị khác | Cùng cơ chế fingerprint/version/refresh một trường; teacher có device fingerprint hiện tại. | Được chứng minh từ handler. |
| Teacher test / teacher thường | Không thấy role `TEACHER TEST` riêng trong token role model đã kiểm tra; các luồng thực tế dùng teacher và trạng thái/thuộc tính test. | Xác nhận trong luồng auth đã xem; cần đối chiếu policy nghiệp vụ nếu tên role ở hệ thống khác. |
| DB Admin/Staff login từ thiết bị khác | Dùng `checkDeviceConflict` và `completeInternalLogin`, có thể yêu cầu force ticket/MFA; login hoàn tất tăng version và ghi refresh dùng chung. | Được chứng minh từ handler. |
| Hardcoded Super Admin login nhiều lần | Không dùng DB refresh field/tokenVersion như tài khoản DB; các JWT riêng có thể cùng tồn tại đến expiry/trừ khi token tương ứng bị blacklist. | Được chứng minh từ helpers/auth middleware đã xem. |
| Logout một thiết bị khi user có refresh hiện tại trên thiết bị khác | Server xóa refresh token dùng chung theo user, có thể làm hỏng khả năng refresh của thiết bị còn lại; không có session ID để giới hạn revoke. | Được chứng minh từ logout handler. |
| Đổi mật khẩu bằng `/change-password` | Handler đang xem không tăng version hoặc xóa refresh; không đủ cơ sở để kết luận các phiên khác lập tức bị revoke. | Được chứng minh trong handler; cần kiểm tra các luồng đổi/reset mật khẩu khác riêng. |
| HTTP token bị revoke trong lúc Socket đã kết nối | Handshake có kiểm tra; không thấy kiểm tra liên tục/disconnect chủ động trong source đã đối chiếu. Kết nối đã mở có thể tiếp tục nhận/gửi event đến khi disconnect/reconnect hoặc có guard riêng. | Chưa xác minh mọi handler/socket middleware; ghi nhận là rủi ro cần test. |
| Mở cùng một bài thi trên Web và Mobile | Student attempt lưu trên dữ liệu student/subject và quyết định dựa vào `liveAttemptId`; source có thể forfeit attempt khi live id khác, reload hoặc mở tab mới. Không được coi account multi-device là cho phép chạy cùng một exam attempt song song. | Được chứng minh với endpoint start student; các bài thi khác cần rà soát riêng. |

## 5. Mục tiêu thiết kế và ranh giới tương thích

### Mục tiêu

1. Website hiện tại tiếp tục hoạt động với response shape, route, role và storage behavior được kiểm soát.
2. Student/teacher có thể đồng thời sử dụng web và mobile mà không ghi đè refresh token của nhau.
3. Mỗi thiết bị/client có session độc lập: refresh, logout, revoke, expiry, last-used và metadata.
4. Revoke một session không xóa hoặc vô hiệu phiên khác; revoke-all có chủ đích.
5. Giữ các policy hiện có: account status, role, adminRole, permissions, branch, ownership, MFA và anti-abuse.
6. Token/refresh replay, race, offline, multi-instance, socket và exam đều được kiểm thử.

### Ngoài phạm vi đợt đầu

- Không thay frontend web bằng React Native.
- Không bật admin/staff trên mobile MVP.
- Không đưa giám sát camera/screen hoặc bài thi có stakes lên mobile trước POC.
- Không thay đổi nghiệp vụ phân quyền, branch scope, API business response hoặc schema exam.
- Không bỏ MFA, CSRF hoặc blacklist chỉ để tương thích native.

## 6. Kiến trúc session đề xuất

### 6.1 Mô hình dữ liệu

Đề xuất một collection/model session riêng, ví dụ `AuthSession`, thay vì nhồi một mảng session tăng không giới hạn vào document Student/Teacher.

Các trường tối thiểu cần thiết kế và review:

| Trường | Mục đích |
|---|---|
| `sessionId` | ID ngẫu nhiên duy nhất; claim `sid` trong token. |
| `userId`, `role` | Chủ session và role đã xác thực từ DB, không tin client. |
| `clientType` | `web` hoặc `mobile`; dùng cho compatibility/policy, không phải quyền. |
| `platform`, `deviceLabel`, `appVersion`, `userAgent` | Metadata hiển thị và hỗ trợ sự cố; coi là dữ liệu do client khai báo, không phải proof. |
| `createdAt`, `lastUsedAt`, `absoluteExpiresAt`, `revokedAt`, `revocationReason` | Vòng đời và audit. Idle expiry chỉ thêm sau khi chốt yêu cầu UX. |
| `refreshFamilyId`, `currentRefreshJtiHash` | Theo dõi token hiện hành và rotation theo session. Không lưu refresh token thô. |
| `authEpoch`/security version | Gắn với version toàn tài khoản để revoke toàn bộ session sau sự kiện bảo mật. |

Chỉ mục cần được thiết kế trước migration: session ID unique; truy vấn session theo user/revocation/expiry; TTL index nếu phù hợp để dọn dữ liệu. TTL là cleanup, không thay thế kiểm tra revoked/expiry trong request. Không lưu session/revoke state chỉ trong process memory nếu cần chạy nhiều instance.

### 6.2 Token và rotation

- Access token ngắn hạn hơn hiện tại là hướng cần đánh giá; không đổi thời hạn mặc định hiện tại trước khi có quyết định, kiểm tra tương thích và kế hoạch rollout.
- Refresh token phải được xác thực bằng chữ ký, `sid`, `jti`, `aud`, role/user và state session trong DB; lưu hash/token identifier cần thiết thay vì raw bearer secret.
- Rotation phải atomic theo session: chỉ một lần có thể tiêu thụ token hiện tại; cập nhật `lastUsedAt` và hash token kế tiếp theo compare-and-swap.
- Token đã dùng lại cần revoke tối thiểu session/family tương ứng và tạo audit event; việc revoke mọi thiết bị khi reuse là policy cần chủ hệ thống phê duyệt.
- Refresh đồng thời từ cùng thiết bị cần được serialize phía client. Phải có thiết kế/test cho duplicate request và response bị mất sau khi server rotate, để không biến retry hợp lệ thành replay alarm gây logout nhầm.
- Không đưa access/refresh token vào URL, analytics, crash report, push payload hoặc log. `/uploads?...access_token=` hiện có behavior web cần được giữ trong đánh giá riêng; app không nên tự thêm token URL nếu có download API/Authorization header phù hợp.

### 6.3 Tương thích web trong rollout

Khuyến nghị rollout additive thay vì đổi nghĩa `tokenVersion` ngay:

1. Giữ nguyên API legacy và response envelope hiện tại trong giai đoạn đầu.
2. Thêm session path có điều kiện cho client đa thiết bị. Token mang `sid` đi qua validation session; token legacy không có `sid` tiếp tục được xác thực theo quy tắc legacy trong thời gian chuyển tiếp.
3. Dùng security epoch riêng hoặc thiết kế tương đương để revoke all sau đổi mật khẩu/khóa tài khoản; không dùng “login mới” làm sự kiện revoke toàn tài khoản cho session mới.
4. Bảo đảm đăng nhập mobile không ghi đè `Student/Teacher.refreshToken` hoặc `deviceFingerprint` đang phục vụ web.
5. Bảo đảm login legacy web, refresh legacy và logout web không vô tình revoke session mobile; nếu muốn thay đổi hành vi logout web, cần release riêng và regression test.
6. Nếu web cũ và mobile mới cùng được dùng, presence/device-conflict phải phân biệt session/client. Không dùng một socket mobile để giả định rằng web fingerprint cũ còn online.
7. Khi cần thống nhất toàn bộ web sessions theo session model, phải có phase chuyển riêng, feature flag và chiến lược với token đang phát hành; không âm thầm chuyển đổi giữa chừng.

### 6.4 API surface dự kiến

Đây là thiết kế cần review, không phải API đã triển khai. Ưu tiên mở rộng có tương thích các endpoint auth hiện tại; chỉ thêm route mới nếu không thể giữ contract rõ ràng.

| Endpoint hiện có/đề xuất | Ý nghĩa đa phiên | Ghi chú an toàn/tương thích |
|---|---|---|
| `POST /api/auth/login/public` | Student/teacher login, tùy chọn metadata `clientType=mobile`, platform/label; trả token/session cho client hiện tại. | Giữ field response web hiện tại; không nhận role/permission từ client làm căn cứ cấp quyền. |
| `POST /api/auth/login/internal` và `/api/auth/mfa/verify` | Internal login/MFA. | Admin/staff mobile chưa thuộc MVP; nếu xét sau phải bắt buộc MFA và policy riêng. |
| `POST /api/auth/refresh` | Legacy refresh giữ behavior tương thích; session token xử lý theo `sid`. | CSRF contract web không được vô tình đổi. Branch theo claim đã ký, không theo `clientType` body đơn lẻ. |
| `POST /api/auth/logout` | Revoke phiên gọi hiện tại theo `sid`; scope all yêu cầu lựa chọn rõ ràng/step-up. | Giữ legacy semantics cho token cũ đến khi rollout web được phê duyệt. Không xóa refresh state của session khác. |
| `GET /api/auth/sessions` (đề xuất) | Danh sách phiên của chính user: client, thiết bị, tạo lần cuối, trạng thái. | Không trả token/hash; chỉ đọc session của identity đã xác thực. |
| `DELETE /api/auth/sessions/:sessionId` (đề xuất) | Revoke một session khác do chính user sở hữu. | Kiểm tra ownership; không cho revoke session của user khác; yêu cầu CSRF ở web. |
| Revoke-all (endpoint hoặc action được duyệt) | Thu hồi toàn bộ phiên sau password/MFA/recovery hoặc lựa chọn người dùng. | Có thể cần xác thực lại password/MFA; audit rõ ràng. |

Không cần API business mới cho màn hình student/teacher chỉ vì có mobile; yêu cầu trên tập trung vào quản lý vòng đời phiên.

## 7. Authentication, authorization và chính sách role

| Role/thực thể | Chính sách đề xuất | Điều kiện |
|---|---|---|
| STUDENT | Cho phép Web + Mobile cùng đăng nhập cho chức năng thường ngày; session độc lập. | Không cho hai client cùng thao tác một exam attempt; bài thi mobile vẫn giữ ngoài MVP. Giữ account lock, enrollment/access và branch policies. |
| TEACHER | Cho phép Web + Mobile cho lịch, thông báo, inbox, học viên được giao và điểm danh đã duyệt. | Giữ ownership, branch scope và cửa sổ nghiệp vụ; bài thi onboarding/practical có camera tiếp tục trên Web/POC. |
| TEACHER TEST | Không phải role JWT riêng theo auth source đã xem; coi là teacher có status/test flow cho đến khi nghiệp vụ xác nhận khác. | Không cấp quyền mới dựa trên nhãn UI hoặc trạng thái client. |
| ADMIN / ADMIN STAFF | Không bật trên mobile MVP. | Nếu sau này mở: MFA bắt buộc, session list/revoke, audit, giới hạn tính năng và policy thiết bị riêng. |
| Hardcoded Super Admin | Không hỗ trợ multi-device native ở phase đầu. | Hiện không có DB session record; cần thiết kế chuyển đổi/revoke cho tài khoản đặc biệt trước khi cho dùng mobile. |

Role, adminRole, permission và branch được lấy/xác thực ở backend. `clientType`, app version, device label và fingerprint chỉ là metadata/policy hints; không bao giờ thay middleware permission/ownership.

### MFA

- Nội bộ admin/staff đã có TOTP challenge trong luồng login; mobile phải thực hiện bước challenge tương tự nếu được cho phép, không lưu MFA secret trong app.
- Không bật/chuyển MFA cho student/teacher chỉ vì native client tồn tại nếu chưa có quyết định nghiệp vụ.
- Với thao tác bảo mật nhạy cảm (revoke all, đổi thông tin xác thực, đăng ký thiết bị mới ở tài khoản admin), cân nhắc step-up password/MFA.

## 8. Socket.IO / presence trong mô hình mới

1. Socket handshake phải xác thực access token/session và trạng thái revoke, không chỉ JWT signature.
2. Gắn socket vào room riêng theo `sid` sau xác thực. Khi revoke session, backend cần ngắt các socket của `sid` trên mọi instance; dùng Redis adapter nếu cần distributed disconnect.
3. Phải kiểm tra trong khoảng thời gian event đang mở: socket đã revoke không được tiếp tục emit/nhận dữ liệu nhạy cảm. Disconnect chủ động là yêu cầu tối thiểu; kiểm tra trạng thái bổ sung/TTL cần được benchmark.
4. Giữ room user/role để fan-out tới nhiều thiết bị nếu event đó được chủ ý đồng bộ; phân biệt với event chỉ dành cho socket hiện tại.
5. Presence chuyển từ “một socket mới nhất” sang tập session/socket hoặc tính trạng thái tổng hợp. Disconnect một socket chỉ xóa socket đó; user offline khi không còn socket sống phù hợp.
6. Test logout mobile khi app background, reconnect bằng token revoked, đổi version, mất Redis, nhiều instance, và web/mobile cùng join message/notification/exam rooms.
7. Không coi Socket.IO là push nền. Push FCM/APNs là hạng mục sản phẩm riêng, chưa thấy integration native hiện hữu trong source đã rà.

## 9. Exam policy và chống chia sẻ tài khoản

- Multi-device cho dashboard/chat không được đồng nghĩa multi-device cho exam.
- Student attempt hiện lưu theo student/subject; endpoint start so sánh attempt đang mở với `liveAttemptId`, và trường hợp ID khác có thể dẫn tới forfeit. Logic này có thể đánh trượt khi client native dùng một local context khác.
- Giai đoạn đầu giữ bài thi có giám sát trên web, không gửi exam token hoặc attempt state qua nhiều client, không đổi exam schema.
- Trước khi xét mobile exam: đặc tả exam lease/session ID server-side, quy tắc resume/background/network loss, thứ tự thiết bị hợp lệ, submit idempotency và phục hồi sau crash; POC trên thiết bị iOS/Android thật.
- Không dùng fingerprint để chứng minh duy nhất thiết bị hay làm authorization. Chống mở nhiều phiên phải dựa vào session/attempt state phía server và policy được công bố.

## 10. Threat model ngắn

| Tài sản / đe dọa | Tình huống | Hướng kiểm soát cần có |
|---|---|---|
| Access/refresh token | Token bị trích từ thiết bị, log, backup hoặc URL. | Secure storage native, không log, access TTL ngắn theo quyết định, refresh rotation/hash, revoke session. |
| Refresh token replay | Refresh đã rotate bị dùng lại. | Atomic rotation theo sid, reuse detection, revoke đúng scope, audit và xử lý race/retry. |
| Điện thoại mất/chia sẻ | Người khác mở app hoặc dùng dữ liệu local. | OS secure storage, logout/revoke từ thiết bị khác, khóa app/biometric chỉ như lớp local tùy chọn, không thay server auth. |
| CSRF/login CSRF | Cross-site request trên browser hoặc luồng cookie không đúng. | Giữ double-submit web; kiểm thử cookie jar native; không nới CSRF toàn cục. |
| Socket stale | Kết nối tồn tại sau logout/lock/revoke. | Room theo session, disconnect distributed, kiểm thử event sau revoke. |
| Privilege escalation | Client gửi role/branch/adminRole giả. | Backend cấp và kiểm tra quyền; metadata mobile không phải permission. |
| Thiết bị giả mạo | Fingerprint bị copy/reset hoặc app khai báo label sai. | Xem fingerprint là tín hiệu UX; security dựa session/token/MFA/ownership. |
| Revoke race | Logout/revoke song song refresh hoặc nhiều request refresh. | Atomic state transitions, client single-flight, idempotency/định nghĩa lỗi và telemetry. |
| Multi-instance outage | Blacklist/presence local không đồng bộ. | Lưu session/revoke bền vững; kiểm thử fail-closed có kiểm soát; không phụ thuộc một Map cục bộ. |
| Lộ dữ liệu qua shared rooms | Event phát tới room user trên mọi thiết bị. | Kiểm tra authorization ở từng handler và phân loại event user-wide/session-specific. |

Native app không thể giữ bí mật một API key tĩnh. Không nhúng secret server-side vào app và không coi certificate pinning/device fingerprint là cơ chế thay thế xác thực.

## 11. Rủi ro ảnh hưởng website

| Mức độ | Khu vực | Vì sao ảnh hưởng web | Kiểm soát trước khi triển khai |
|---|---|---|---|
| **CRITICAL** | `tokenVersion`, login/refresh/logout semantics | Các login chính tăng version; refresh dùng một trường/user; thay nghĩa có thể logout hàng loạt, refresh fail hoặc làm session web/mobile ghi đè nhau. | Dual-path/feature flag, contract tests, tài khoản test từng role, rollout canary và rollback không phá legacy token. |
| **CRITICAL** | Response/error contract và CSRF toàn `/api` | Web parser dựa response cũ; thiếu cookie/header có thể làm login/refresh/mutation lỗi 403. | Snapshot contract và browser regression; không nới middleware toàn cục. |
| **HIGH** | Logout/revoke/password/reset | Logout hiện xóa refresh shared; đổi password thường và reset admin có hành vi version không đồng nhất. | Định nghĩa scope current/all; test token/session còn sống sau từng thao tác và chuẩn hóa chính sách có migration plan. |
| **HIGH** | Socket.IO auth, rooms, presence | Handshake không tự ngắt socket hiện có; presence chỉ lưu một socket/user; thay room có thể ảnh hưởng chat/notification/exam. | Session room, revoke disconnect, multi-socket và multi-instance regression. |
| **HIGH** | Authorization/role/branch | Thay token claims hoặc dựa vào role client có thể làm lộ dữ liệu hay chặn quyền web. | Backend source of truth, test matrix permission/ownership/branch cho mọi endpoint liên quan. |
| **HIGH** | Exam attempt | Login/session mới có thể thay version; attempt mở có thể bị forfeit khi context khác. | Không đưa exam vào auth rollout MVP; regression exam đang chạy và POC riêng. |
| **MEDIUM** | Blacklist Redis fallback | Redis/memory behavior khác nhau; restart hoặc multi-instance có thể đổi kết quả revoke. | Kiểm thử Redis unavailable/restart; xác định nguồn trạng thái bền vững. |
| **MEDIUM** | Device conflict/presence | Socket mobile có thể bị hiểu nhầm là web session online bởi logic fingerprint cũ. | Phân biệt client/session trong presence và conflict policy. |
| **LOW** | Project React Native riêng, chỉ tiêu thụ API | Không đổi web khi app chỉ dùng contract đã tồn tại. | Giữ repo/project riêng; không chia sẻ UI DOM; khóa scope không sửa backend nếu chưa duyệt. |

## 12. Ma trận kiểm thử bắt buộc trước rollout

Tất cả kiểm thử dưới đây là đề xuất; chưa chạy ở giai đoạn phân tích.

| Nhóm | Kịch bản tối thiểu | Kết quả mong đợi |
|---|---|---|
| Legacy web | Student/teacher/admin-staff login, `/me`, API mutation, refresh rotation, logout | Behavior và response không suy giảm so với baseline. |
| Concurrent clients | Web + mobile cùng account; hai mobile; hai browser; login lần lượt và đồng thời | Phiên được tách đúng; không ghi đè refresh; mọi policy cap/conflict rõ ràng. |
| Role/MFA | Student, teacher, teacher test status, staff permissions, MFA DB admin; hardcoded admin negative/unsupported | Chỉ role được duyệt đăng nhập; MFA trước access token; không mở admin mobile ngoài policy. |
| Refresh | Refresh hợp lệ, expired, revoked, signature sai, old token reuse, concurrent refresh, mất response sau rotate | Atomic/idempotent behavior; chỉ scope cần revoke; lỗi rõ, không trả thành công giả. |
| Logout | Logout current, logout session khác, revoke-all, logout offline, stale refresh token | Phiên đúng bị revoke; phiên còn lại đúng theo policy; UI phân biệt local clear với server revoke thất bại. |
| Password/account state | Self password change, admin reset, suspended/inactive/locked, delete user | Access, refresh, sessions và sockets bị thu hồi theo policy đã duyệt. |
| CSRF | Login/refresh/logout web thiếu hoặc sai cookie/header; native cookie jar; cross-origin | Web vẫn được bảo vệ; native không cần bypass global CSRF. |
| HTTP auth | Token thiếu/sai/expired/blacklisted/wrong aud/wrong role/version/session revoked | HTTP 401/403 đúng, không trả dữ liệu. |
| Socket | Connect, reconnect, rotate, logout, revoke sid, revoke all, account lock, Redis down, multi-instance | Socket revoked bị disconnect/chặn; các session khác và room user-wide hoạt động đúng. |
| Presence/chat | Nhiều socket cùng user; disconnect socket mới trước/cũ sau; read receipts/typing/group | Presence online đến khi socket cuối rời; không mất hoặc rò event. |
| Exam | Web attempt đang chạy khi login mobile; reload/tab mới; duplicate start; stale `liveAttemptId`; submit retry | Không tự mở hai exam; không forfeit ngoài policy; bài web đang chạy được bảo vệ. |
| Upload/download | Mobile multipart CSRF, protected upload URL/download, expired access token | Auth, ACL, filename, file size và response tương thích; token không lộ trong log/URL ngoài contract hiện có. |
| Persistence/operations | Redis unavailable, app/server restart, Mongo unavailable, TTL cleanup, clock skew | Revocation fail-safe theo policy, không phụ thuộc process-local state; lỗi quan sát được. |
| Security regression | Role spoof, userId spoof, branch spoof, sessionId của người khác, token replay | Backend từ chối; không truy cập session hoặc dữ liệu người khác. |

## 13. Kế hoạch rollout và rollback

### Trước triển khai

1. Duyệt chính sách role, session cap, logout current/all, retention, MFA và exam exclusion.
2. Chốt response/error contract, JWT claims và backward-compatible validation.
3. Dựng test fixture riêng; ghi baseline auth/Socket/CSRF của web hiện tại; không thử trên tài khoản production thật.
4. Threat model và review thiết kế session collection/index/atomic rotation.
5. Xác nhận Redis/multi-instance topology, backup/restore và audit/monitoring.

### Phased rollout

1. **Phase 0 — quan sát:** thêm test/telemetry trong môi trường staging; chưa thay đổi hành vi production.
2. **Phase 1 — additive backend:** tạo model/session logic có feature flag; legacy path tiếp tục mặc định; chưa đổi UI web.
3. **Phase 2 — internal test:** kiểm thử student/teacher test account trên staging với app prototype; kiểm tra concurrent sessions, CSRF, Socket.IO và revoke.
4. **Phase 3 — canary mobile:** bật cho nhóm nhỏ/tài khoản thử nghiệm; giới hạn role student/teacher và chức năng không bao gồm exam.
5. **Phase 4 — mở rộng:** tăng nhóm theo số liệu lỗi login/refresh, revoke, socket reconnect và support ticket; chỉ sau khi chủ hệ thống duyệt.
6. **Phase 5 — web sessions (nếu cần):** chuyển web sang session ID riêng trong release tách biệt; không gộp âm thầm vào mobile MVP.

### Rollback

- Feature flag tắt cấp session mobile mới; không xóa collection/session data bằng thao tác rollback.
- Giữ route legacy/token validation chạy được trong giai đoạn tương thích; không tự động tăng version hoặc blacklist toàn bộ token chỉ vì rollback.
- Session mobile đang mở phải được revoke rõ ràng hoặc hết hạn theo chính sách; thông báo người dùng nếu cần đăng nhập lại.
- Nếu code session mới lỗi, dừng cấp session mới trước; tránh đổi schema user legacy hoặc xóa field `refreshToken`/`deviceFingerprint`.
- Rollback cần checklist kiểm tra login web, refresh, logout, CSRF, Socket.IO, exam và upload.

## 14. Thứ tự triển khai đề xuất sau khi được duyệt

1. Chốt policy và các quyết định còn mở ở mục 15.
2. Viết đặc tả session/token lifecycle và error contract; làm threat review trước code.
3. Thiết kế additive Mongo model/index và phương án atomic refresh rotation.
4. Thêm unit/integration tests cho auth/session; giữ nguyên tests/contract của web.
5. Triển khai feature flag và session-aware auth/refresh/logout phía backend trong staging.
6. Xử lý Socket.IO session room, revoke/disconnect và presence nhiều socket.
7. POC native secure storage, CSRF cookie jar, refresh retry và logout.
8. Canary Student/Teacher cho dashboard/chat/lịch; giữ thi và quản trị trên web.
9. Mở rộng sau khi xác nhận metrics, security review, rollback rehearsal và phê duyệt.

## 15. Quyết định cần chủ hệ thống xác nhận

Các nội dung sau chưa thể suy ra chắc chắn từ source; báo cáo đưa ra khuyến nghị để duyệt, không tự chọn thay chủ hệ thống:

1. **Role được hỗ trợ:** đề xuất Student/Teacher mobile; Admin/Staff và hardcoded Super Admin ở lại web.
2. **Concurrent sessions:** xác nhận Web + Mobile cùng một account được chạy đồng thời; có cho phép nhiều mobile hoặc nhiều browser không.
3. **Giới hạn số session:** chọn giới hạn tổng hoặc theo client; nếu đạt giới hạn thì từ chối, yêu cầu logout thiết bị cũ, hay tự revoke session ít hoạt động nhất.
4. **Logout semantics:** đề xuất logout thường chỉ revoke session hiện tại và có thao tác riêng “đăng xuất tất cả thiết bị”. Hiện tại legacy logout xóa refresh state dùng chung theo user; chọn có yêu cầu password/MFA cho revoke-all không.
5. **Thời hạn:** access TTL, refresh absolute TTL, idle TTL và retention metadata thiết bị; không thay mặc định hiện tại trước quyết định.
6. **Refresh reuse:** khi phát hiện reuse, revoke session/family hay toàn bộ account; cách xử lý duplicate/retry đồng thời.
7. **Password/security events:** password change, admin reset, account lock, MFA reset và user deletion có revoke mọi mobile session ngay hay chỉ ở lần request tiếp theo.
8. **Thi:** xác nhận thi giám sát tiếp tục Web-only; nếu đưa mobile vào, cần một POC/đặc tả exam lease riêng.
9. **CSRF native:** chấp nhận native cookie jar + double-submit hay cần một cơ chế riêng sau threat review; không bỏ CSRF middleware hiện tại.
10. **Presence/push:** xác nhận online status phản ánh tất cả socket; quyết định push nền là phạm vi riêng hay không.

## 16. Kết luận

**Có thể hỗ trợ Web và Mobile chạy song song**, nhưng auth hiện tại không phải multi-device session model: refresh token/device fingerprint được lưu đơn lẻ theo user và các login thông thường tăng token version. Mobile dùng nguyên luồng hiện tại mà không thiết kế session riêng sẽ có rủi ro gây xung đột login, refresh và logout với website.

Hướng ít rủi ro nhất là session record riêng, additive/feature-flagged, giữ nguyên contract legacy trong giai đoạn chuyển tiếp, revoke theo session, tách account-wide security revoke, và xử lý Socket.IO/presence theo nhiều session. Mọi thay đổi production cần được duyệt riêng và kiểm thử staging đầy đủ. Không có thay đổi nào được thực hiện trong bước phân tích này.
