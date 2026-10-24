# MOBILE_APP_ANALYSIS

**Mục đích:** phân tích khả năng bổ sung app native Android/iOS chạy song song với website Thắng Tin Học, dùng chung backend/API/database hiện tại.

**Phạm vi và an toàn:** đây là rà soát tĩnh source code. Không chạy migration, không truy cập/sửa database hay `.env`, không cài package, không thay đổi API/auth, không tạo project mobile và không chỉnh sửa source. File báo cáo này được tạo theo yêu cầu. Không thực hiện commit/push.

> Báo cáo tập trung vào mã nguồn được tìm thấy trong workspace. Những nội dung request/response được mô tả ở mức chức năng nếu không trích nguyên schema của từng handler; cần đối chiếu handler trước khi tích hợp từng API. Tài liệu OpenAPI trong repo chỉ bao phủ một phần route thực tế.

## Tóm tắt điều hành

Có thể xây dựng app mobile riêng và để web tiếp tục hoạt động, cùng dùng API, Socket.IO và MongoDB hiện tại. App không nên thay thế website hoặc dùng lại nguyên UI web.

Ba vấn đề cần xử lý/kiểm chứng trước khi phát hành:

1. **Phiên đăng nhập hiện có thiết kế một phiên cho mỗi tài khoản.** Login cập nhật `refreshToken` và `tokenVersion`; token cũ có thể bị vô hiệu. Chưa thể mặc định một tài khoản hoạt động đồng thời trên web và mobile.
2. **Request ghi dữ liệu cần CSRF cookie + header.** App native phải tương thích cách xác thực hiện tại; bearer token đơn thuần chưa đủ cho các mutation dưới `/api`.
3. **Giám sát thi dựa nhiều vào Browser API.** Camera có thể tích hợp native nhưng cần viết lại lớp truy cập thiết bị; phát hiện khuôn mặt, screen capture, fullscreen và phát hiện app/tab rời màn hình cần POC trên iOS/Android thật.

**Đề xuất:** ưu tiên MVP cho STUDENT và TEACHER (lịch, thông báo, chat, tài liệu và các luồng đọc/tra cứu); giữ quản trị phức tạp trên web. Tạm giữ thi có giám sát trên web cho đến khi POC xác nhận đáp ứng được yêu cầu trên thiết bị thật.

## 1. Kiến trúc hiện tại

| Thành phần | Công nghệ / cấu trúc |
|---|---|
| Frontend web | React 19, Vite 8, JavaScript/JSX, React Router, Tailwind CSS; có SWR, Socket.IO client và thư viện PDF/Excel. |
| Backend | Node.js, Express 5, Socket.IO; server entry point `server.js`. |
| Database | MongoDB qua Mongoose; các schema theo miền nghiệp vụ nằm trong `models/`. |
| Cache / queue / phân tán | Redis là tùy chọn; được dùng cho các phần như blacklist, cache, queue, presence và Socket.IO adapter tùy cấu hình. Một số phần fallback memory/inline. |
| Frontend structure | `client/src/App.jsx` khai báo routes; các miền chính gồm `components/`, `context/`, `hooks/`, `services/`, `utils/`, `constants/`. |
| Backend structure | `routes/` định nghĩa HTTP endpoints; `middleware/` xử lý auth, CSRF, rate limit, scope và permission gates; `services/` chứa nghiệp vụ; `models/` chứa schema. |

Backend mount 38 route modules dưới `/api`. Route thực tế được mount trong `server.js` và định nghĩa trong `routes/`. `docs/openapi.yaml` chỉ ghi một phần API, không phải danh mục đầy đủ.

### Cây kiến trúc rút gọn

```text
Website React/Vite ──┐
                     ├── Express API + Socket.IO ── MongoDB/Mongoose
App React Native ────┘
                              └── Redis tùy cấu hình
```

Các điểm tham chiếu:

- `README.md`, `package.json`, `client/package.json`
- `server.js`, `config/db.js`, `config/redis.js`, `config/socketIoAdapter.js`
- `client/src/App.jsx`, `client/src/services/api.js`, `client/src/context/SocketContext.jsx`
- `routes/`, `middleware/`, `services/`, `models/`

## 2. Roles và chức năng

`TEACHER TEST` không phải role độc lập trong schema. Đây là tài khoản `role: teacher` ở trạng thái onboarding/thi, dựa trên `testStatus`, attempt và các trạng thái hồ sơ giáo viên.

| Role | Chức năng chính | Frontend tiêu biểu | API chính | Realtime | Mobile cần không? | Ghi chú |
|---|---|---|---|---|---|---|
| STUDENT | Tổng quan, hồ sơ, lịch học, tài liệu/bài tập, video khóa học, phòng thi, ôn chứng chỉ, luyện tập, đánh giá giáo viên, feed/tin tức, inbox, thông báo, học phí/thanh toán theo luồng. | `StudentDashboard.jsx`, `StudentTest.jsx`, student components, `AppSidebar.jsx` | `/api/students`, `/schedules`, `/notifications`, `/messages`, `/assignments`, `/quizzes`, `/training-lms`, `/lesson-practice`, `/cert-prep`, `/proctor`, `/exam-results` | Chat, presence, notification, lịch/điểm danh, assignment, quiz, trạng thái thi. | **MVP ưu tiên** | Kiểm tra phạm vi theo user/enrollment/branch; không dựa vào UI để bảo vệ dữ liệu. |
| TEACHER | Tổng quan, lịch dạy, học viên được phân công, điểm danh, giao/chấm bài, quiz/test, đào tạo, tài liệu, tài chính cá nhân, inbox, feed/tin tức, thông báo, hồ sơ. | `TeacherDashboard.jsx`, `TeacherTest.jsx`, `TeacherTrainingLMS.jsx`, `AppSidebar.jsx` | `/api/teachers`, `/students`, `/schedules`, `/assignments`, `/quizzes`, `/training-lms`, `/transactions`, `/messages`, `/exam-results` | Chat/presence, notification, cập nhật lịch/điểm danh, bài tập và dữ liệu. | **MVP ưu tiên** | Giữ quyền sở hữu học viên và branch scope của backend. |
| TEACHER TEST | Thi đầu vào/onboarding, camera, làm bài, submit/forfeit, tải bài thực hành và xem trạng thái. | `TeacherTest.jsx`; route `/teacher/test` trong `App.jsx` | `/api/teachers/:id/exam-attempt`, `/submit`, `/forfeit`, `/api/teachers/upload-practical`, một số route giáo viên/admin | Vi phạm thi và cập nhật trạng thái theo luồng. | **Không ưu tiên; POC nếu bắt buộc** | Vẫn là role `teacher`, không phải role riêng. |
| ADMIN | Quản lý học viên/giáo viên/lịch/thi/đào tạo/tài chính/nhân sự/chi nhánh, file, báo cáo, cấu hình, workflow, tenant, backup, logs. | `AdminDashboard.jsx`, `AppSidebar.jsx`, admin tabs | Phần lớn `/api/*`; giới hạn bằng role, permission và branch scope. | Presence, notification, chat, refresh dữ liệu, trạng thái thi. | **Không thuộc MVP** | Nên tiếp tục dùng web cho nghiệp vụ quản trị rộng. |
| ADMIN STAFF | Nhóm chức năng được cấp theo permission: hỗ trợ, học viên, giáo viên, lịch, tài chính, đào tạo, HR, tin tức, logs, v.v. | Admin UI có permission guards và ẩn/hiện menu | Các namespace `/api/*` tương ứng quyền được cấp | Realtime theo rooms/role/branch. | **Không thuộc MVP** | Model vận chuyển role `admin`/`staff`, kết hợp `adminRole`: `SUPER_ADMIN`, `HIGH_ADMIN`, `STAFF`, `SUPPORT`. |

Menu student/teacher/admin nằm trong `client/src/components/AppSidebar.jsx`. Permission catalog được mirror giữa `constants/permissions.js` và `client/src/constants/permissions.js`. Backend phải tiếp tục là nơi quyết định authorization.

## 3. Danh mục API hiện tại

### Quy ước đọc bảng

- Prefix `/api` đã được gắn vào mỗi namespace trong `server.js`.
- Bảng liệt kê toàn bộ khai báo `router.get/post/put/patch/delete` được rà soát trong 38 route modules. Endpoint có thể có middleware, guard hoặc điều kiện quyền khác nhau theo action.
- `Auth/Role` dưới đây mô tả ở mức nhóm. Cần đọc handler cụ thể trước khi app gọi endpoint, đặc biệt endpoint admin, branch-scoped và endpoint có side effects.
- Payload/response không có một DTO thống nhất cho toàn hệ thống. Nhiều endpoint trả JSON `{ success, data, message }`, nhưng có endpoint dùng shape khác, pagination, file nhị phân, CSV/PDF hoặc response riêng. Request/response dưới đây vì thế mô tả theo chức năng, không thay thế schema handler.

### Auth và endpoint hạ tầng

| Method | Endpoint | Chức năng | Authentication / Role | Request / Response tóm tắt | Mobile |
|---|---|---|---|---|---|
| GET | `/api/auth/csrf-token` | Cấp CSRF token | Public | Response có `success`, `csrfToken`; đồng thời đặt cookie | Có, cần giữ cookie và gửi header CSRF |
| GET | `/api/auth/captcha` | Tạo CAPTCHA | Public + rate limit | Trả cid, SVG và ở môi trường không production có thể có answer hint | Có nếu login flow yêu cầu |
| POST | `/api/auth/refresh` | Xoay refresh token | Refresh token trong JSON body | Trả access/refresh token mới hoặc lỗi phiên | Có, lưu token an toàn |
| POST | `/api/auth/check-role` | Kiểm tra định dạng phone, không tiết lộ account | Public + rate limit | Phone/identifier; trả success/data null nếu hợp lệ | Có nếu cần |
| GET | `/api/auth/google`, `/google/callback`, `/zalo`, `/zalo/callback` | OAuth endpoints | Hiện bị disable | Phản hồi disabled | Không dùng trong trạng thái hiện tại |
| POST | `/api/auth/login`, `/login/public`, `/login/internal` | Đăng nhập | Public + rate limit; flow tách public/internal | Phone/identifier, password, role, fingerprint/captcha theo flow; trả user và JWT | Có, nhưng phải giải quyết CSRF/device session |
| POST | `/api/auth/mfa/verify` | Xác minh MFA | Challenge/login + rate limit | MFA challenge/code; trả kết quả auth theo flow | Có nếu role cần MFA |
| POST | `/api/auth/mfa/setup`, `/mfa/enable`, `/mfa/disable` | Quản lý MFA | Bearer JWT; quyền tài khoản | JSON theo thao tác | Chưa ưu tiên |
| GET | `/api/auth/mfa/status` | Xem trạng thái MFA | Bearer JWT | JSON status | Tùy nhu cầu |
| POST | `/api/auth/logout` | Thu hồi phiên/token | Token trong header/body; handler xử lý logout | Có thể gửi access/refresh; trả success/message | Có, cần đồng bộ lưu trữ |
| POST | `/api/auth/register-teacher` | Đăng ký giáo viên | Public + rate limit | Dữ liệu đăng ký; JSON kết quả | Chưa ưu tiên |
| POST | `/api/auth/change-password` | Đổi mật khẩu | Bearer JWT | JSON dữ liệu đổi mật khẩu | Có thể hỗ trợ sau |
| POST | `/api/auth/welcome-celebration/seen`, `/course-celebration/seen` | Ghi nhận đã xem sự kiện | Bearer JWT | JSON | Không ưu tiên |
| GET | `/api/auth/me` | Lấy user hiện tại | Bearer JWT | Trả thông tin user | Có |
| POST | `/api/auth/avatar` | Upload avatar | Bearer JWT + multipart | File upload; JSON metadata | Có, cần native picker |
| POST | `/api/auth/forgot-password/request`, `/forgot-password/verify`, `/reset-password-request` | Quên/khôi phục mật khẩu | Public + rate limit/OTP | Phone/OTP/thông tin xác minh; JSON kết quả | Có thể dùng cùng flow nếu UX phù hợp |
| POST | `/api/auth/admin/generate-otp`, `/admin/reset-password` | Admin hỗ trợ reset | Bearer JWT + admin permission | JSON | Không thuộc MVP |
| PUT | `/api/auth/admin/profile` | Cập nhật profile admin | Bearer JWT + quyền | JSON profile | Không thuộc MVP |
| GET | `/healthz`, `/`, `/__phase10/stats` | Health/root/internal stats | Tùy endpoint; stats nội bộ | JSON | Không phải nghiệp vụ app |

### Nghiệp vụ chính: học viên, giáo viên, lịch, thi, file và realtime

| Method | Endpoint | Chức năng | Authentication / Role | Request / Response tóm tắt | Mobile |
|---|---|---|---|---|---|
| GET, POST, PUT, PATCH, DELETE | `/api/students`, `/api/students/:id`, `/api/students/:id/*` | Đọc/quản trị học viên, enrollment, học phí, quyền thi, attendance/history/device | Bearer JWT; student/teacher/admin/staff theo action, branch/ownership guard | JSON; lọc/pagination; mutation JSON; một số import/file | Phần đọc student self-service có; admin CRUD web |
| POST | `/api/students/import`, `/reserve-code`, `/purge-cancelled` | Import/quản trị dữ liệu học viên | JWT + permission admin | Multipart/JSON tùy route | Web |
| POST | `/api/students/:id/exam-attempt`, `/exam-attempt/submit`, `/exam-attempt/forfeit`, `/exam-attempt/abandon` | Tạo/nộp/hủy/bỏ attempt học viên | JWT, user ownership/role guard | JSON attempt/answers/token; response kết quả/trạng thái | Có API; mobile exam cần POC |
| PUT | `/api/students/:id/exam-progress` | Cập nhật tiến trình thi | JWT + domain guard | JSON progress | POC/giữ web |
| PUT/PATCH/POST/DELETE | `/api/students/:id/*` | Cập nhật giá, trả/refund, khóa/mở thi, enrollment, teacher assignment, reset history/device/account/attendance | JWT + permission/branch scope | JSON; có side effects tới học viên/tài chính/thi | Web/admin |
| GET, POST, PUT, PATCH, DELETE | `/api/teachers`, `/api/teachers/:id/*` | Danh sách/profile giáo viên, phê duyệt, điểm, trạng thái, thực hành, tài chính | JWT; role/permission/branch scope | JSON; upload thực hành multipart | Một số chức năng teacher self-service |
| POST | `/api/teachers/:id/exam-attempt`, `/exam-attempt/submit`, `/exam-attempt/forfeit` | Attempt thi giáo viên | JWT + owner/domain guard | JSON attempt/submission | POC nếu thi mobile |
| POST | `/api/teachers/upload-practical`, `/api/teachers/:id/submit-practical` | Upload bài thực hành | JWT + role/ownership | Multipart | Có thể giai đoạn 2 |
| GET, POST, PUT, PATCH, DELETE | `/api/schedules`, `/api/schedules/:scheduleId`, `/api/schedules/*` | Xem/tạo/sửa/hủy lịch, xác nhận học viên, tranh chấp, lịch sử | JWT; role, branch scope, assigned teacher/student | Query cho lọc; JSON mutation; trả schedule/status | **MVP** |
| GET, POST, PUT, PATCH, DELETE | `/api/assignments/*` | Bài tập, upload, submit, grade | JWT; student/teacher/admin tùy action và ownership | Multipart upload; JSON assignment/submission/grade | MVP đọc/nộp thường; grading giai đoạn 2 |
| GET, POST, DELETE | `/api/quizzes/*` | Quiz giáo viên/student/admin, tạo, lấy đề, submit, tạo câu hỏi AI | JWT; role/assignment/ownership | JSON quiz/question/answer; submit trả điểm/trạng thái | Giai đoạn 2; thi giám sát POC |
| GET, POST, PUT, DELETE | `/api/exam-results/*` | Đọc/tạo/sửa/xóa kết quả thi | JWT; student self, teacher scope hoặc admin permission | JSON; list có pagination và tổng số | Student có thể xem |
| POST, GET | `/api/proctor/events`, `/api/proctor/events/me`, `/api/proctor/events/:userId` | Gửi/đọc audit sự kiện giám sát | JWT; user self hoặc admin theo route | `events` là mảng JSON; không nhận video/frame | Có thể gửi event native sau POC |
| POST, GET, DELETE | `/api/files/upload`, `/api/files`, `/api/files/categories`, `/api/files/stats`, `/api/files/purge-expired`, `/api/files/:id` | Registry, upload và quản trị file | JWT + file permission/owner | Multipart `file`; JSON metadata/list; delete JSON | Có cho file người học |
| GET | `/uploads/*` | Đọc static file | Public cho một số prefix; bearer hoặc query token cho file bảo vệ | Trả nội dung file, inline/attachment tùy query/đuôi file | Có, cần token/file handling native |
| GET, POST, PUT, PATCH, DELETE | `/api/messages/*` | Contacts, conversation, sync/search, chat, read/pin/reaction/recall, group, upload, broadcast | JWT; conversation policy; broadcast admin/staff | JSON; upload multipart; response message/list/pagination | **MVP** |
| GET, POST, PUT, DELETE | `/api/notifications/*` | Danh sách, unread/count, đánh dấu đọc, dismiss/tạo | JWT; admin/staff permission cho broadcast/management | JSON notification/count | **MVP** |

### LMS, nội dung, nghiệp vụ quản trị và tích hợp

| Method | Endpoint group | Chức năng | Authentication / Role | Request/response | Mobile |
|---|---|---|---|---|---|
| GET, POST, PUT, PATCH, DELETE | `/api/training-lms/*` | Courses, video purchases, lessons, progress, QA, reviews, teacher/admin progress | JWT; student/teacher/admin theo action | JSON; một số upload/file | Student video giai đoạn 2 |
| GET, POST, PUT, PATCH, DELETE | `/api/lesson-practice/*` | Subject/unit/item, progress, video/practice, checkout | JWT; student self hoặc admin | JSON, multipart backup/upload ở route riêng | Giai đoạn 2 |
| GET, POST, PUT, PATCH, DELETE | `/api/cert-prep/*` | Catalog, sessions, tests/questions, answers, access/enrollment mappings, import/export | JWT; student/admin theo action | JSON, multipart prompt/answer/import, export file | Giai đoạn 2; thi cần POC |
| GET, POST, PUT, PATCH, DELETE | `/api/feed/*` | Feed, upload, like/react/comment | JWT; người xem/role/branch và quyền quản lý | JSON; upload multipart | Có thể giai đoạn 2 |
| GET, POST, PUT, PATCH, DELETE | `/api/blog/*` | Topics/posts, publish/hide/manage/upload | Read có thể rộng; mutation cần permission | JSON; multipart files | Student đọc có thể giai đoạn 2; quản trị web |
| GET, POST, PUT, DELETE | `/api/center-info/*` | Nội dung trung tâm và quản lý/upload | Public/read; mutation permission admin | JSON; multipart image | Có thể dùng chức năng đọc |
| GET, POST, PUT, PATCH, DELETE | `/api/courses/*` | Course catalog/admin CRUD/pricing/restore/seed | JWT + admin permission theo mutation | JSON | Đọc khóa học nếu MVP yêu cầu |
| GET, POST, PUT, DELETE | `/api/evaluations/*` | Đánh giá student/teacher/admin | JWT; ownership/permission | JSON | Student đánh giá có thể giai đoạn 2 |
| GET, POST, PUT, PATCH, DELETE | `/api/invoices/*`, `/api/transactions/*`, `/api/finance/*` | Hóa đơn, giao dịch, ledger, thanh toán, reconcile | JWT + admin/teacher permission; webhook riêng | JSON, PDF, CSV | Student chỉ xem thông tin cần thiết; admin web |
| GET, POST, PUT, PATCH, DELETE | `/api/settings/*` | Cấu hình trung tâm, thi, banners, uploads, reset data | JWT + admin/system permission | JSON, multipart, destructive admin operations | Web |
| GET, POST, PUT, DELETE | `/api/branches/*`, `/api/staff/*`, `/api/employees/*`, `/api/tenants/*` | Chi nhánh, phân quyền, HR/payroll, tenant | JWT + permission/Super Admin/branch scope | JSON | Web |
| GET, POST, PUT, DELETE | `/api/analytics/*`, `/api/bi/*`, `/api/monitoring/*`, `/api/system-logs/*`, `/api/backups/*` | Analytics, BI/export, monitoring, logs, backup | Admin permission; một số Super Admin-only | JSON, CSV, archive download | Web |
| GET, POST, PUT, DELETE | `/api/ai/*`, `/api/ai-support/*` | AI content, support sessions/queue/replies | JWT; role/support permissions | JSON; realtime support events | Chọn lọc giai đoạn 2 |
| GET, POST, PUT, DELETE | `/api/workflows/*`, `/api/builder/*` | Workflow, forms/reports/run/export | JWT + system permission | JSON, CSV/export | Web |
| GET | `/api/training/*` | Teaching guides | JWT/permission theo route | JSON | Có thể giai đoạn 2 |
| POST, GET | `/api/webhooks/*` | Payment sessions/status và SePay callback | Public/session theo endpoint; SePay xác thực chữ ký | JSON provider payload/status | Không phải API client mobile chính |
| GET | `/api/internal-rbac/runtime-evidence` | Nội bộ RBAC evidence | Internal guard | JSON | Không dùng trên app |

### Danh sách route method/path đã quét

Dưới đây là các khai báo HTTP route tìm thấy, tính theo prefix namespace. Tất cả namespace ở dưới được mount dưới `/api`, trừ health/root/internal route đã nêu riêng. Nếu route có `:id`/wildcard thì đó là parameter/path segment.

```text
ai:
  GET /status; POST /quiz; POST /notification-draft; POST /summarize; POST /complete
ai-support:
  GET /status; POST /open; POST /escalate; POST /reset; POST /clear-history;
  GET /queue; GET /thread/:conversationId; POST /claim; POST /resolve; POST /reply
analytics:
  GET /revenue; GET /enrollment; GET /branches
assignments:
  POST /upload; GET /course/:courseId; GET /student/:studentId/course/:courseId;
  POST /; PUT /:id; DELETE /:id; POST /:id/submit; PUT /submissions/:submissionId/grade
auth:
  GET /csrf-token; GET /captcha; POST /refresh; POST /check-role;
  GET /google; GET /google/callback; GET /zalo; GET /zalo/callback;
  POST /login; POST /login/public; POST /login/internal; POST /mfa/verify;
  POST /mfa/setup; POST /mfa/enable; POST /mfa/disable; GET /mfa/status;
  POST /logout; POST /register-teacher; POST /change-password;
  POST /welcome-celebration/seen; POST /course-celebration/seen; GET /me;
  POST /avatar; POST /forgot-password/request; POST /forgot-password/verify;
  POST /admin/generate-otp; POST /reset-password-request; POST /admin/reset-password;
  PUT /admin/profile
backups:
  GET /stats; GET /; POST /; GET /:id/download; DELETE /:id
bi:
  GET /overview; GET /export
blog:
  GET /topics; GET /posts; GET /posts/:slugOrId; GET /manage/posts;
  GET /manage/posts/:id; POST /manage/posts; PUT /manage/posts/:id;
  POST /manage/posts/:id/publish; POST /manage/posts/:id/hide;
  DELETE /manage/posts/:id; POST /manage/topics; PUT /manage/topics/:id;
  DELETE /manage/topics/:id; POST /manage/upload
branches:
  GET /; GET /all; POST /; PUT /:id; DELETE /:id
builder:
  GET /forms; GET /forms/:idOrSlug; POST /forms; PUT /forms/:id; DELETE /forms/:id;
  POST /forms/:idOrSlug/submit; POST /forms/:idOrSlug/submit-auth;
  GET /forms/:id/submissions; GET /forms/:id/submissions/export;
  GET /reports/sources; GET /reports; POST /reports; PUT /reports/:id;
  DELETE /reports/:id; GET /reports/:id/run; GET /reports/:id/export
center-info:
  GET /; GET /manage/overview; PUT /manage/overview; GET /manage/items;
  POST /manage/items; PUT /manage/items/:id; DELETE /manage/items/:id;
  POST /manage/items/reorder; POST /manage/upload
cert-prep:
  POST /upload; GET /my-catalog; POST /sessions; GET /sessions/:id;
  POST /sessions/:id/pause; GET /sessions/:id/result; GET /tests/:id/attempts;
  PATCH /sessions/:id; POST /sessions/:id/submit; POST /sessions/:id/answer-file;
  DELETE /sessions/:id; GET /courses; POST /courses; GET /courses/:id/levels;
  GET /courses/:id/questions/export; POST /courses/:id/questions/import;
  POST /courses/:id/levels; PUT /courses/:id; DELETE /courses/:id;
  GET /levels/:id/tests; POST /levels/:id/tests; PUT /levels/:id; DELETE /levels/:id;
  GET /tests/:id/questions; GET /tests/:id/prompt; POST /tests/:id/prompt;
  DELETE /tests/:id/prompt; POST /tests/:id/questions; DELETE /tests/:id/questions;
  PUT /tests/:id; DELETE /tests/:id; PATCH /questions/reorder; PUT /questions/:id;
  DELETE /questions/:id; GET /students; GET /access; GET /enrollment-mappings;
  POST /enrollment-mappings; PATCH /enrollment-mappings/:id;
  DELETE /enrollment-mappings/:id; POST /enrollment-mappings/sync;
  POST /access; DELETE /access/:id
courses:
  GET /stats/summary; GET /; GET /:id; POST /; PUT /:id; PATCH /:id/price;
  DELETE /:id; POST /:id/restore; POST /seed
employees:
  GET /; GET /stats; POST /; PUT /:id; DELETE /:id; POST /:id/pay; GET /payroll
evaluations:
  GET /admin; GET /teacher/:teacherId; GET /mine; POST /; POST /:id/read
exam-results:
  GET /; POST /; PUT /:id; DELETE /:id
feed:
  POST /upload; GET /; POST /; PUT /:id; DELETE /:id; POST /:id/like;
  POST /:id/react; POST /:id/comments; DELETE /:id/comments/:commentId
files:
  POST /upload; GET /stats; GET /categories; GET /; POST /purge-expired; DELETE /:id
finance:
  GET /summary; GET /ledger; GET /students/:id; POST /students/:id/heal-orphans;
  POST /ledger/:id/void; POST /discount; GET /reconcile; POST /snapshots/rebuild;
  POST /students/:id/sync-cache
internal-rbac:
  GET /runtime-evidence
invoices:
  GET /; GET /stats; GET /:id; POST /; GET /:id/pdf; POST /:id/pdf/queue;
  POST /:id/email; DELETE /:id
lesson-practice:
  GET /backup/export; POST /backup/import; GET /subjects; GET /courses;
  POST /subjects; POST /subjects/seed-defaults; PATCH /subjects/:id;
  DELETE /subjects/:id; GET /subjects/:id/units; POST /subjects/:id/units;
  PATCH /units/:id; DELETE /units/:id; GET /units/:id/items; POST /units/:id/items;
  PATCH /items/:id; DELETE /items/:id; GET /progress; POST /upload;
  GET /my/subjects; POST /my/courses/:id/checkout;
  GET /my/course-purchase-sessions/:sessionId;
  POST /my/course-purchase-sessions/:sessionId/simulate-paid;
  GET /my/subjects/:id/units; GET /my/units/:id;
  POST /my/units/:id/sections/:section; POST /my/units/:id/reset-practice;
  POST /my/items/:id/confirm
messages:
  GET /contacts; GET /conversations/:userId; POST /purge-orphans;
  GET /search/:userId; GET /hidden; GET /:conversationId; GET /sync/:userId;
  POST /upload; POST /; POST /hide/:conversationId; PUT /read/:conversationId;
  PUT /:conversationId/pin; PATCH /:messageId/reaction; PATCH /:messageId/recall;
  PATCH /:messageId/soft-delete; POST /groups; GET /groups/user/:userId;
  POST /groups/:groupId/leave; POST /groups/:groupId/members;
  DELETE /groups/:groupId; GET /unread/:userId; POST /broadcast
monitoring:
  GET /health; GET /metrics; GET /overview; POST /metrics/reset
notifications:
  GET /; GET /count; GET /unread; PUT /mark-read; DELETE /:id; POST /
proctor:
  POST /events; GET /events/me; GET /events/:userId
quizzes:
  GET /teacher; POST /create; POST /generate-ai; DELETE /:id;
  GET /student; GET /:id; POST /:id/submit; GET /admin/all
schedules:
  GET /; GET /stats; GET /teacher/:teacherId; GET /pending-confirm;
  GET /disputes; GET /student/:studentId; POST /; PUT /:scheduleId;
  DELETE /:scheduleId; POST /:scheduleId/student-confirm;
  POST /:scheduleId/resolve-dispute; PATCH /:scheduleId/cancel;
  GET /history/:teacherId; GET /:scheduleId
settings:
  GET /bank; GET /; PUT /; POST /upload-popup-image; POST /upload-student-banner;
  POST /upload-teacher-banner; POST /upload-invoice-signature; GET /popup;
  GET /payment; GET /web; PUT /web; GET /training-data; PUT /training-data;
  GET /student-training-data; PUT /student-training-data; GET /student-exam-config;
  GET /teacher-exam-config; PUT /teacher-exam-config; GET /exam-subjects;
  PUT /exam-admin-group-label; POST /exam-subjects; PUT /exam-subjects/:id;
  DELETE /exam-subjects/:id; PUT /student-exam-config; POST /upload-training-file;
  POST /upload-exam-warning-sound; POST /upload-logo; POST /upload-favicon;
  POST /upload-invoice-logo; POST /reset-data
staff:
  GET /; POST /; PUT /:id; DELETE /:id
students:
  GET /; GET /stats; GET /:id; GET /:id/full-detail; POST /import;
  POST /reserve-code; POST /; PUT /:id; POST /:id/exam-attempt;
  POST /:id/exam-attempt/submit; POST /:id/exam-attempt/forfeit;
  POST /:id/exam-attempt/abandon; PUT /:id/exam-progress; PATCH /:id/price;
  PUT /:id/pay; PUT /:id/refund; PUT /:id/unlock-exam; PUT /:id/lock-exam;
  POST /:id/enrollments; PUT /:id/enrollments/:enrollmentId/settings;
  PUT /:id/enrollments/:enrollmentId/pay; DELETE /:id/enrollments/:enrollmentId;
  PUT /:id/assign-teacher; POST /purge-cancelled; DELETE /:id;
  POST /:id/reset-devices; POST /:id/lock-account; POST /:id/unlock-account;
  POST /:id/reset-today-attendance; POST /:id/reset-history; PUT /:id/pay-teacher
teachers:
  POST /upload-practical; POST /:id/exam-attempt; POST /:id/exam-attempt/submit;
  POST /:id/exam-attempt/forfeit; POST /; GET /; GET /stats/summary;
  GET /:id/public-card; GET /:id; PUT /:id; PUT /:id/score; PUT /:id/approve;
  PUT /:id/grant-exam-access; PUT /:id/review-practical; PUT /:id/manual-activate;
  PUT /:id/suspend; PUT /:id/reactivate; POST /:id/submit-practical;
  POST /:id/practical-forfeit; PUT /:id/reject; DELETE /:id;
  GET /:id/finance; GET /:id/finance/pending; PUT /:id/finance/pay-flexible;
  PUT /:id/finance/pay-all
teaching-guides:
  GET /
tenants:
  GET /; GET /meta/branches; GET /:id/stats; GET /:id; POST /; PUT /:id;
  POST /:id/branches
training-lms:
  GET /courses; POST /video-courses/:id/checkout;
  GET /video-purchases/session/:sessionId; GET /video-purchases;
  GET /courses/:id/lessons; POST /complete-lesson; GET /progress/me;
  GET /teacher/overview; POST /save-watch-progress;
  GET /admin/progress/:courseId; GET /qa; POST /qa; POST /qa/:id/answer;
  POST /qa/:id/reply; GET /reviews; POST /reviews
transactions:
  GET /; GET /stats; GET /teacher/:teacherId; POST /calculate; POST /;
  PUT /:id/confirm; PUT /:id/cancel; DELETE /:id
webhooks:
  POST /payment-session; POST /create-session; POST /cancel-session;
  GET /payment-session/:id; GET /payment-status; POST /sepay;
  GET /payment-status/:studentId
workflows:
  GET /definitions; GET /; POST /sync; GET /:id; POST /; POST /:id/advance
```

Một số route đặc biệt có thể không được liệt kê như business API ở trên: `server.js` khai báo `/healthz`, `/`, và route stats theo cờ môi trường; static downloads được mount dưới `/uploads`. Chức năng cụ thể và quyền của từng route phải lấy từ middleware/handler, không suy ra chỉ từ tên path.

## 4. Authentication và authorization

### Cơ chế hiện tại

1. **Login:** đăng nhập bằng phone/password; có legacy `/login`, public `/login/public` cho student/teacher và internal `/login/internal`. Login trả user, `accessToken`, `refreshToken`, `expiresIn`.
2. **JWT:** access dùng `JWT_SECRET`, refresh dùng `JWT_REFRESH_SECRET`; refresh token được xoay vòng và kiểm tra reuse. Thời hạn mặc định theo README là 8 giờ cho access, 30 ngày cho refresh.
3. **API:** `middleware/auth.js` yêu cầu `Authorization: Bearer ...`; kiểm tra blacklist, JWT, user trong DB, token version và trạng thái tài khoản.
4. **Socket.IO:** `middleware/socketAuth.js` lấy token từ `socket.handshake.auth.token`, kiểm tra blacklist và token version.
5. **Cookie/session:** Express session với cookie `qcms.sid` được mount toàn cục; cookie này khác JWT bearer auth của API.
6. **CSRF:** `middleware/csrf.js` áp double-submit cookie `csrf_token` + header `X-CSRF-Token` cho các request thay đổi dữ liệu dưới `/api`, trừ đường dẫn được skip.
7. **Web storage:** frontend dựa vào `localStorage`/`sessionStorage` để lưu token/user, trạng thái và dữ liệu phiên. Đây không phải nơi lưu phù hợp cho credential native nếu không có lớp bảo mật tương ứng.
8. **Device/single-session:** login có `deviceFingerprint`; lưu refresh token và tăng `tokenVersion` trên user document. Login mới có thể làm phiên cũ vô hiệu; kiểm tra conflict dựa thêm vào trạng thái online/socket.
9. **MFA:** có các endpoint quản lý và xác minh MFA.
10. **OAuth:** route Google/Zalo hiện dùng hàm disable; không nên giả định OAuth đang hoạt động chỉ vì có dependency/cấu hình trong repo.

### Authorization hiện tại

- Roles vận chuyển: `student`, `teacher`, `admin`, `staff`.
- Admin nội bộ dùng thêm `adminRole`: `SUPER_ADMIN`, `HIGH_ADMIN`, `STAFF`, `SUPPORT`.
- Permission keys gồm `manage_students`, `manage_schedule`, `manage_finance`, `manage_messages`, `manage_training`, `manage_student_training`, `manage_cert_prep`, `manage_staff`, `manage_hr`, `manage_blog`, `system_settings`, `view_logs`, `view_evaluations`, `view_branch_revenue`, `view_teachers`, `manage_teachers`, `view_center_info`, `manage_center_info`.
- Backend có middleware `isAdmin`, `isTeacher`, `checkPermission`, `checkAnyPermission`, branch guards, domain cutover gates/policy shadow và ownership checks.
- Guard frontend/menu là UX; không thay thế kiểm tra backend.

### Mobile có thể dùng lại / cần bổ sung

| Phần | Đánh giá |
|---|---|
| Login/refresh/logout JWT hiện có | Có thể gọi lại nếu app đáp ứng payload và vòng đời hiện tại. |
| Authorization/permission backend | Dùng lại nguyên tắc; không nới quyền theo loại client. |
| CSRF | Cần tương thích cookie jar + header token. Cần kiểm tra hành vi thực tế của cookie trong native HTTP networking trước khi tích hợp. |
| Secure storage | Cần giải pháp native secure storage cho access/refresh và xóa khi logout/revoke. |
| Nhiều thiết bị | Hiện trạng không bảo đảm web và app đồng thời cho cùng tài khoản; đây là quyết định nghiệp vụ và thiết kế backend riêng nếu cần. Không sửa auth web trong báo cáo này. |
| MFA/OAuth | MFA cần kiểm tra theo policy. OAuth hiện disabled; deep link chỉ xét nếu luồng OAuth được bật có chủ đích. |

## 5. Socket.IO / realtime

Server khởi tạo Socket.IO trong `server.js`; client web tạo kết nối ở `client/src/context/SocketContext.jsx`. Server xác thực JWT và join các room user, role, branch, feed, group. Có Redis adapter tùy cấu hình.

| Nhóm | Events tiêu biểu | Source liên quan |
|---|---|---|
| Connect/presence | `register`, `users:online`, `users:lastSeen`, `disconnect` | `server.js`, `config/presenceStore.js`, `client/src/context/SocketContext.jsx` |
| Chat | `message:send`, `message:receive`, `message:sent`, `message:read`, `message:read_ack`, `typing:start`, `typing:stop`, `typing:show`, `typing:hide` | `server.js`, `routes/messageRoutes.js`, `services/directMessageService.js`, `client/src/components/Inbox.jsx` |
| Message mutation | reaction, recall, pin, group events | `server.js`, `routes/messageRoutes.js`, `SocketContext.jsx` |
| Notifications/data refresh | `RECEIVE_NOTIFICATION`, `new-notification`, `notification:removed`, `data:refresh`, `student:updated` | `services/NotificationService.js`, `services/notificationCenter.js`, `SocketContext.jsx` |
| Exam | `exam:violation`, `exam:locked`, `exam:unlock_ack` | `server.js`, `StudentTest.jsx`, `TeacherTest.jsx`, `ExamMonitor.jsx` |
| Attendance/schedule | `attendance:*`, `tuition:paid` | `server.js`, `ScheduleContext.jsx`, `useAttendanceRealtimeSync.js`, `DashboardLayout.jsx` |
| Assignment/quiz | `assignment:new`, `assignment:updated`, `assignment:deleted`, `submission:graded`, `quiz:assigned`, `quiz:submitted` | `server.js`/services/routes, `StudentDashboard.jsx`, teacher/student quiz components |
| Feed/LMS/support | `feed:new`, `feed:updated`, `lms_qa:updated`, `ai-support:*`, `course:celebration` | Feed/LMS/support services and corresponding client components |

Mobile có thể dùng Socket.IO protocol hiện tại khi app foreground. Không tìm thấy tích hợp native push registration/token FCM/APNs/Expo trong package/source đã rà soát; Socket.IO không thay thế push khi app bị hệ điều hành suspend hoặc đóng. Cần thiết kế push riêng nếu đó là yêu cầu sản phẩm.

## 6. Upload và download file

- Backend dùng Multer ở các route upload; file được lưu dưới `uploads/` và một số được đăng ký metadata trong `FileAsset` qua `services/fileService.js`.
- `/api/files/upload` nhận multipart field `file`, category qua query/body; response thành công trả metadata như id, URL, tên gốc, size, category, expiry.
- Route đặc thù có field, giới hạn và nơi lưu riêng (messages, assignments, feed, blog, cert prep, settings, center info, practical, lesson practice).
- `/uploads/*` được bảo vệ bởi `middleware/uploadsAuth.js`: bearer hoặc query access token, blacklist và asset policy; một số prefix public để nhúng hình.
- Web tải Blob và tạo object URL trong `client/src/services/api.js`; native cần file picker, download task, vùng lưu app, share/open file và xử lý quyền hệ điều hành.
- Cần kiểm thử tên file tiếng Việt, token khi tải URL bảo vệ, kích thước file, upload thất bại/mất mạng, PDF/Office/video và file bài thi.

## 7. Camera, thi và giám sát

| Phân loại | Mã hiện tại | Khả năng mobile |
|---|---|---|
| **A — logic có thể tái sử dụng** | Nghiệp vụ chọn câu hỏi, attempt, submit/forfeit, ownership, tiến trình và một số logic risk. `services/examAttemptService.js`, `examProgressService.js`, `examAttemptStore.js`. | Có thể dùng lại API và quy tắc nghiệp vụ; không đồng nghĩa tái sử dụng UI hoặc thiết bị. |
| **B — phụ thuộc browser** | `getUserMedia`, `video`, `canvas`, `ImageData`, `FaceDetector`, `document.visibilitychange`, `document.hidden`, `window.blur`, Fullscreen API, `beforeunload`, local/session storage, `getDisplayMedia`. | Không thể bê trực tiếp sang React Native; cần thay lớp browser API bằng native. |
| **C — phải viết riêng cho React Native** | Camera permission/lifecycle, app foreground/background, native navigation, file selection, secure attempt storage, native UI. | Tạo implementation riêng, xác định rõ nền tảng và quyền thiết bị. |
| **D — cần POC thiết bị thật** | Face detection chính xác, gọi đến app khác/cuộc gọi, app suspend/resume, screen capture, fullscreen/kiosk behavior, mất mạng và resume attempt, dùng web/mobile cùng lúc. | Không chốt khả năng tương đương trước khi thử trên thiết bị thật. |

Các vị trí chính:

- `client/src/components/StudentTest.jsx`: camera, attempt, violation, `beforeunload`, socket lock.
- `client/src/components/TeacherTest.jsx`: camera, attempt, visibility/tab guard, forfeit/submit.
- `client/src/components/ExamMonitor.jsx`: camera health, canvas/frame, FaceDetector nếu có, risk/visibility.
- `client/src/utils/proctor/cameraHealth.js`: `getUserMedia` và camera status.
- `client/src/utils/proctor/vision.js`, `riskEngine.js`, `eventLog.js`, `config.js`: xử lý frame/heuristic/risk/audit.
- `client/src/utils/screenCapture.js`, `ScreenCaptureButton.jsx`: `getDisplayMedia` và canvas crop; browser-dependent.
- `routes/proctorRoutes.js`: `POST /api/proctor/events` nhận batch sự kiện; ghi chú source nêu rõ không nhận video/frame.
- `routes/studentRoutes.js`, `routes/teacherRoutes.js`, `services/examAttemptService.js`: attempt lifecycle.
- `client/src/components/StudentExamRoom.jsx`, `client/src/components/student/StudentQuizExamRoom.jsx`, `client/src/components/exam/ExamClickOutsideGuard.jsx`: fullscreen/visibility và exam room behavior.

Screen capture web được triển khai qua browser `getDisplayMedia`; không được mặc định rằng iOS/Android app có API tương đương. Các cảnh báo rời tab web cũng không tương đương với app background lifecycle. Đề xuất chưa đưa thi giám sát đầy đủ vào MVP; nếu cần, làm POC camera, app lifecycle, screen capture và chống mở nhiều phiên trước.

## 8. Mobile MVP đề xuất

| Role / tính năng | Phân loại | Ghi chú |
|---|---|---|
| STUDENT: đăng nhập, refresh, profile cơ bản | **Mobile MVP** | Cần xử lý secure storage, CSRF và single-session trước. |
| STUDENT: dashboard, lịch, lịch sử/buổi học | **Mobile MVP** | Tận dụng endpoint schedule/student hiện tại. |
| STUDENT: thông báo trong app | **Mobile MVP** | Notification API + Socket foreground; push nền để giai đoạn sau. |
| STUDENT: inbox/chat | **Mobile MVP** | Tận dụng message API và Socket.IO; đảm bảo room/auth/reconnect. |
| STUDENT: tài liệu, bài tập, tải/mở file | **Mobile MVP** | Cần native file handling và token bảo vệ `/uploads`. |
| STUDENT: feed/news/center info | **Mobile giai đoạn 2** | Bắt đầu với chức năng đọc; không port CMS quản trị. |
| STUDENT: video LMS/lesson practice | **Mobile giai đoạn 2** | POC player, tiến độ, background behavior và quyền nội dung. |
| STUDENT: quiz/bài luyện tập/chứng chỉ | **Mobile giai đoạn 2** | Cần UI mobile, resume, xử lý mạng và file đính kèm. |
| STUDENT: thi giám sát camera/screen | **Cần nghiên cứu/POC** | Giữ web cho đến khi có xác nhận kỹ thuật/nghiệp vụ. |
| TEACHER: login, lịch dạy, thông báo, inbox | **Mobile MVP** | Luồng phù hợp sử dụng điện thoại. |
| TEACHER: xem học viên được giao | **Mobile MVP** | Phải giữ ownership và branch scope hiện tại. |
| TEACHER: điểm danh/xác nhận lịch | **Mobile MVP có điều kiện** | Xác minh cửa sổ thời gian, tranh chấp, retry/mất mạng. |
| TEACHER: giao/chấm bài, quiz | **Mobile giai đoạn 2** | Chọn thao tác phổ biến; UI quản lý đầy đủ có thể tiếp tục trên web. |
| TEACHER: bài thi onboarding có camera | **Tiếp tục dùng Web / POC** | Không giả định giám sát mobile tương đương. |
| ADMIN/ADMIN STAFF: CRUD, cấu hình, HR, finance, BI, backup, logs, tenant | **Tiếp tục sử dụng trên Web** | Không thuộc MVP ưu tiên student/teacher. |
| Push notification nền | **Mobile giai đoạn 2 / nghiên cứu** | Chưa thấy push provider/client registration trong source. |

## 9. Dịch vụ bên thứ ba

| Dịch vụ | Vai trò |
|---|---|
| MongoDB/Mongoose | Database chính. |
| Redis | Tùy chọn cho blacklist/cache/queue/presence/adapters và các phần phân tán. |
| Socket.IO | Realtime chat, presence, notification và cập nhật nghiệp vụ. |
| Google GenAI/Gemini | Một số tác vụ AI. |
| SMTP/Nodemailer | Email, OTP, hóa đơn theo cấu hình/queue. |
| Zalo OA | Gửi tin/OTP theo cấu hình/queue. |
| SePay | Webhook/đối soát thanh toán. |
| Puppeteer / jsPDF / html2canvas / xlsx | Sinh hoặc export PDF/Excel. |
| Google/Zalo OAuth | Các route auth hiện bị disable; dependency/config không có nghĩa là flow đang hoạt động. |
| FCM/APNs/Expo push | Không tìm thấy tích hợp push native trong source/package đã rà soát. |

## 10. Rủi ro ảnh hưởng website khi thay đổi backend/API/database

| Mức độ | Hạng mục | Rủi ro với website hiện tại |
|---|---|---|
| **CRITICAL** | JWT/login/refresh/CSRF/tokenVersion | Thay claims, rotation, cookie/header, expiry hoặc single-session có thể logout user web hoặc làm mutation trả 401/403 hàng loạt. |
| **CRITICAL** | Schema và nghiệp vụ thi/enrollment/learning access | Thay đổi trạng thái học/thi, attempt, score hoặc quyền enrollment có thể làm hỏng bài thi đang chạy, điểm và quyền học. |
| **HIGH** | Request/response API | Đổi field, response envelope, lỗi, pagination hoặc kiểu dữ liệu có thể làm hỏng web clients đang đọc trực tiếp. |
| **HIGH** | Socket.IO event/payload/room/auth | Đổi event name, payload, token hoặc room có thể làm chat, presence, notification, attendance, assignment và exam-lock mất realtime. |
| **HIGH** | Upload/download/static `/uploads` | Đổi multipart field/category, ACL, URL, token, filename hoặc response ảnh hưởng avatar, chat, assignment, tài liệu và bài thi. |
| **HIGH** | Authorization, permission, branch scope | Thay guard có thể lộ dữ liệu hoặc khóa nhầm quyền trên web; ẩn menu không phải kiểm soát bảo mật. |
| **MEDIUM** | CORS, rate limit, body/file limits | Mobile có origin, network retry, upload profile và pattern request khác; cấu hình có thể chặn mobile hoặc tác động web. |
| **MEDIUM** | Queue/email/Zalo/SePay | Thay đổi tích hợp có thể tác động thông báo/thanh toán toàn hệ thống. |
| **LOW** | Tạo native client riêng, chỉ gọi API hiện tại | Rủi ro thấp nhất khi không đổi server contract, schema, auth hoặc deploy backend. |

Đây là phân tích rủi ro khi thay đổi, không phải khẳng định source hiện có lỗi tại các khu vực trên. Báo cáo không đề xuất sửa backend trong giai đoạn phân tích.

## 11. Kiến trúc mobile đề xuất

Tạo project React Native riêng, độc lập với `client/` hiện tại:

```text
Website React/Vite ──┐
                     ├── Backend/API + Socket.IO hiện tại ── MongoDB
React Native App ────┘
```

- Mobile là client mới; không chuyển web sang React Native, không thay website.
- Tổ chức theo feature: `auth`, `student`, `teacher`, `schedule`, `messages`, `notifications`, `files`, `learning`.
- Có API client riêng trên mobile; gọi API hiện tại, không truy cập database trực tiếp.
- Xử lý JWT/refresh trong secure storage; tương thích CSRF cookie/header.
- Có Socket.IO client riêng dùng JWT, đúng room/event và quản lý reconnect theo app lifecycle.
- UI, navigation, file picker/download/share, camera và quyền thiết bị được thiết kế/viết riêng cho native.
- Chỉ chia sẻ logic thuần đã xác minh, không chia sẻ UI React DOM/Tailwind.
- Chưa tạo project/package hay chọn Expo/dev client/native build trong bước phân tích.

## 12. Những phần có thể dùng chung / phải viết riêng

| Có thể dùng chung | Phải viết riêng cho native |
|---|---|
| Backend, MongoDB và các API hiện có. | Navigation và toàn bộ UI React Native. |
| Quy tắc nghiệp vụ server-side, role/permission, lịch, enrollment và attempt. | Secure token storage, app lifecycle và xử lý reconnect. |
| Socket.IO contract khi foreground. | Native push registration nếu cần nhận push khi app đóng/nền. |
| Một số utility JS thuần sau khi đánh giá phụ thuộc. Ví dụ danh mục/chuẩn hóa môn thi trong `client/src/utils/examSubjects.js`. | File picker/download/open/share; camera permission và lifecycle. |
| Dữ liệu và response API theo contract hiện tại. | Thay thế các browser-only behavior: DOM, canvas/video, FaceDetector, fullscreen, visibility, `beforeunload`. |

## 13. Thứ tự triển khai đề xuất

1. Chốt MVP STUDENT/TEACHER và những chức năng tiếp tục dùng web.
2. Đặc tả API cần dùng theo đúng handler: request, response, error, role, scope, pagination và file.
3. Chốt chính sách đăng nhập nhiều thiết bị; hiện trạng không mặc định hỗ trợ web và app đồng thời cho cùng tài khoản.
4. POC xác thực native: bearer token, CSRF cookie/header, refresh/logout, MFA nếu áp dụng.
5. Thiết kế wireframe/UI native cho dashboard, lịch, thông báo, inbox và tài liệu.
6. POC Socket.IO foreground, reconnect, rooms và đồng bộ event.
7. POC camera/thi trên thiết bị thật nếu mobile exam là yêu cầu.
8. Phát triển MVP độc lập, kiểm thử quyền/branch, file, mạng yếu và hoạt động song song với web.
9. Phát hành thử nội bộ; bổ sung push/LMS/quiz theo ưu tiên và kết quả kiểm thử.

## 14. Kết luận

**Khả thi:** app native Android/iOS có thể chạy song song với website và dùng chung backend/database. API hiện tại cung cấp nền tảng cho nhiều luồng học viên/giáo viên; giao diện mobile vẫn là sản phẩm mới, phải viết riêng.

**Cần quyết định trước khi code:**

1. Có cho phép cùng một tài khoản dùng web và app đồng thời không? Cơ chế hiện tại là single-session/token-versioned.
2. Thi có giám sát trên mobile có thuộc MVP không? Nếu có, phải POC camera, lifecycle, screen capture và behavior nền trên thiết bị thật.
3. MVP đầu tiên gồm chính xác những màn/chức năng nào cho STUDENT và TEACHER?

### Tệp source tham chiếu chính

- `README.md`
- `package.json`, `client/package.json`
- `server.js`
- `client/src/App.jsx`
- `client/src/services/api.js`
- `client/src/context/SocketContext.jsx`
- `client/src/components/AppSidebar.jsx`
- `client/src/components/StudentDashboard.jsx`, `TeacherDashboard.jsx`
- `client/src/components/StudentTest.jsx`, `TeacherTest.jsx`, `ExamMonitor.jsx`
- `client/src/utils/screenCapture.js`, `client/src/utils/proctor/`
- `middleware/auth.js`, `middleware/csrf.js`, `middleware/socketAuth.js`, `middleware/uploadsAuth.js`
- `routes/`, `services/`, `models/`, `constants/permissions.js`
- `docs/openapi.yaml` (chỉ tham khảo một phần API)
