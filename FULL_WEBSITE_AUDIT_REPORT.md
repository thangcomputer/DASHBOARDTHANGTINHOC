# FULL WEBSITE AUDIT REPORT

Ngày kiểm tra: 30/08/2026  
Phạm vi: toàn bộ repository `DASHBOARDTHANGTINHOC`, ưu tiên đường chạy thật `server.js -> routes/*`.  
Phương pháp: đọc source, đối chiếu route/middleware đang mount, chạy lint/test/build/audit an toàn và một số HTTP GET/HEAD không ghi dữ liệu. Không sửa source, cấu hình hoặc database; không cài/cập nhật package; không dùng `--fix`.

> Lưu ý an toàn: `npm test` thực tế đã nạp `.env`, kết nối MongoDB và một test CQRS tạo bản ghi thử rồi chạy đoạn cleanup. Test đó báo thành công nhưng trạng thái database sau cleanup chưa được kiểm tra trực tiếp vì quy định cấm truy vấn/xóa dữ liệu. Không có thao tác cleanup bổ sung nào được thực hiện. Log test còn in trường `tempPassword`; giá trị đã được che trong báo cáo.

## Cập nhật Giai đoạn 1 – Bảo mật và toàn vẹn kỳ thi (31/08/2026)

- Trạng thái chung: SEC-001, SEC-002, SEC-003, SEC-006, FUN-002 và phần double-submit/race trực tiếp của SEC-018 đã được sửa ở backend và frontend; vẫn cần kiểm thử route/end-to-end trên môi trường QA tách biệt.
- Google OAuth đã bị vô hiệu hóa fail-closed: `/api/auth/google` và `/api/auth/google/callback` trả JSON `410`, không redirect. Email hồ sơ/liên hệ được giữ nguyên. Zalo OAuth không bị thay đổi và cần xác nhận nghiệp vụ riêng.
- Backend nay cấp attempt có chữ ký, chỉ gửi tập câu hỏi đã giao sau khi loại answer key đệ quy, chấm điểm phía server, kiểm tra ownership/unlock/số buổi và dùng conditional atomic update để chống ghi hai lần.
- Ngân hàng đề đầy đủ chỉ trả cho admin/staff có đúng permission quản lý đào tạo. Response `GET/PUT /api/settings` tổng quát cũng loại từng bank khi caller thiếu permission tương ứng.
- Giáo viên không còn được tự ghi field kết quả qua `PUT /api/teachers/:id` hoặc tạo/sửa `/api/exam-results`; phần trắc nghiệm dùng endpoint chấm phía server, phần thực hành dùng endpoint chuyên biệt.
- Thay đổi schema chỉ bổ sung metadata attempt dạng optional/default `null`; không xóa field cũ, không migration và không thay đổi dữ liệu thật.
- Kiểm tra an toàn đã chạy: 15/15 unit/contract tests không kết nối database đạt; syntax các module backend đã sửa đạt; production frontend build đạt. Các module backend mới lint đạt. Lint giới hạn các file lớn vẫn không đạt do lỗi có sẵn (backend routes: 88 errors/28 warnings trong tập lệnh đã chạy; frontend: 52 errors/8 warnings), không dùng `--fix` và không sửa ngoài phạm vi.
- Chưa chạy: full `npm test`, integration test route, test browser/E2E và concurrency trên MongoDB thật vì chưa có `TEST_DATABASE_URI` disposable được xác nhận.
- File chính: `services/examAttemptService.js`, `services/examAttemptStore.js`, `routes/settingsRoutes.js`, `routes/studentRoutes.js`, `routes/teacherRoutes.js`, `routes/examResultRoutes.js`, `routes/quizRoutes.js`, `routes/authRoutes.js`, `models/Student.js`, `models/Teacher.js`, `client/src/components/StudentTest.jsx`, `client/src/components/TeacherTest.jsx`, `client/src/context/useDataTraining.js`, `client/src/services/api.js` và các unit test Giai đoạn 1.

## 1. Tổng quan hệ thống

### 1.1 Công nghệ và kiến trúc

- Runtime: Node.js yêu cầu `>=20`; máy kiểm tra dùng Node `v24.18.0`, npm `11.16.0`. CI và Docker dùng Node 22.
- Backend: Express `5.2.1`, CommonJS; entry point thật là `server.js`; worker riêng `worker.js`.
- Frontend: React `19.2.x`, React Router `7.14.x`, Vite `8.0.x`, Tailwind CSS `3.4.x`.
- Database: MongoDB, Mongoose `9.4.1`.
- Realtime: Socket.IO `4.8.3`; xác thực socket bằng JWT.
- Redis: tùy chọn ở development, bắt buộc theo validation production; dùng cho blacklist, cache, presence, Socket.IO adapter và BullMQ.
- Queue: BullMQ; fallback chạy inline khi không có Redis.
- AI: Gemini/OpenAI-compatible qua `@google/genai` và `AI_*`/`GEMINI_*`.
- Thanh toán: SePay webhook và phiên thanh toán/QR ngân hàng.
- File: filesystem local `uploads/`; cấu hình S3 tồn tại nhưng đường lưu file hiện tại chưa chứng minh đã dùng S3.
- Email/Zalo OA: kênh liên hệ/gửi OTP, mật khẩu, hóa đơn. Email không phải phương thức đăng nhập được khuyến nghị.
- Deploy: Docker/Docker Compose, Nginx, GitHub Actions. Có `/healthz`, graceful shutdown, cron backup/purge.

Kiến trúc đang trong quá trình strangler/CQRS. `routes/*`, `middleware/*`, `services/*`, `models/*` là đường LIVE. Phần lớn `modules/**/routes/*` và `shared/middleware/authenticate.js` chưa được mount; không được coi là hàng rào bảo mật. Ba bridge CQRS có thể được gọi từ route LIVE khi bật cờ: tạo học viên, giáo viên và hóa đơn.

### 1.2 Phương thức đăng nhập thực tế

- Cổng học viên/giáo viên: số điện thoại hoặc số Zalo + mật khẩu; tài khoản do hệ thống/quản trị viên cấp.
- Cổng nội bộ: literal username `admin` cho Super Admin hoặc số điện thoại tài khoản admin/staff + mật khẩu; có CAPTCHA và MFA cho luồng phù hợp.
- Quên mật khẩu: theo số điện thoại, không phải đăng nhập email.
- Email là thông tin liên hệ/hồ sơ; không đề xuất xóa trường email và không đề xuất đăng nhập bằng email.
- Google OAuth không còn là bề mặt đăng nhập: hai route Google vẫn được mount để tương thích nhưng trả `410` JSON và không redirect. Zalo OAuth chưa bị thay đổi trong Giai đoạn 1 và cần xác nhận nghiệp vụ trước khi quyết định.

Token:

- Access JWT và refresh JWT trả trong JSON; frontend lưu cả hai trong `localStorage`.
- Refresh token của Student/Teacher lưu trong DB; có rotation, reuse detection, `tokenVersion` và blacklist.
- HTTP, Socket.IO và upload đều dùng `jwt.verify`; không xác nhận lỗi “decode nhưng không verify” cho xác thực.
- `jwt.decode` không verify chỉ xuất hiện trong khóa định danh rate limit, gây lỗi SEC-014 chứ không phải bypass đăng nhập.
- Session cookie `qcms.sid` dùng cho Passport/OAuth; CSRF dùng double-submit cookie/header.

### 1.3 Middleware toàn cục

Thứ tự chính trong `server.js`: compression -> `/uploads` auth/static -> Helmet -> CORS allowlist -> cookie parser -> CSRF cho `/api` -> session -> logging/request context -> body limits -> Mongo key sanitize -> HPP -> system log -> API rate limit -> route -> 404/error handler.

### 1.4 Route đang hoạt động

Mọi dòng “Đang hoạt động” dưới đây được mount tại `server.js:885-921`. CSRF và API rate limit áp dụng toàn cục cho `/api`; bảng chỉ ghi middleware bổ sung chính. Các endpoint cùng cơ chế được gộp bằng dấu `|` để bảng có thể kiểm tra được mà không lặp hàng trăm dòng tương tự.

| Method | Endpoint | File xử lý | Middleware chính | Role được phép | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| GET | `/healthz`, `/` | `server.js` | public | Public | Đang hoạt động |
| GET | `/__phase10/stats` | `server.js` | loopback + env flag | Nội bộ | Chỉ dùng nội bộ |
| GET | `/internal/rbac/runtime-evidence` | `internalRbacRoutes.js` | loopback/token tùy cấu hình | Nội bộ | Chỉ dùng nội bộ |
| GET | `/uploads/*` | `server.js`, `uploadsAuth.js` | public-prefix hoặc JWT bất kỳ | Public/Auth | Đang hoạt động |
| GET | `/api/auth/csrf-token|captcha|zalo|zalo/callback` | `authRoutes.js` | limiter/policy shadow/Passport/state | Public/OAuth | Đang hoạt động |
| GET | `/api/auth/google|google/callback` | `authRoutes.js`, `googleOAuthDisabled.js` | fail-closed handler | Public | Trả 410, không redirect |
| POST | `/api/auth/login|login/public|login/internal|refresh|check-role|mfa/verify` | `authRoutes.js` | specialized limiters; CAPTCHA internal | Public | Đang hoạt động |
| POST/GET | `/api/auth/mfa/setup|enable|disable|status` | `authRoutes.js` | `authMiddleware` | Admin/Staff | Đang hoạt động |
| POST | `/api/auth/logout|register-teacher|change-password|forgot-password/request|forgot-password/verify` | `authRoutes.js` | limiter/auth tùy route | Public/Auth | Đang hoạt động |
| POST/PUT | `/api/auth/admin/generate-otp|admin/reset-password|admin/profile` | `authRoutes.js` | auth + role checks trong handler | Admin/Staff | Đang hoạt động |
| GET | `/api/auth/me` | `authRoutes.js` | auth | Auth | Đang hoạt động |
| GET | `/api/students|stats|:id|:id/full-detail` | `studentRoutes.js` | auth, branch, permission/ownership | Admin/Staff/Teacher/Student-self | Đang hoạt động |
| POST | `/api/students|import|reserve-code|purge-cancelled` | `studentRoutes.js` | auth, branch, `MANAGE_STUDENTS` | Admin/Staff | Đang hoạt động |
| PUT/PATCH | `/api/students/:id|:id/exam-progress|:id/price|:id/pay|:id/refund` | `studentRoutes.js` | auth, branch, field/permission checks | Theo route | Đang hoạt động |
| PUT | `/api/students/:id/unlock-exam|lock-exam|assign-teacher|pay-teacher` | `studentRoutes.js` | auth, branch, permission không đồng nhất | Admin/Staff/Teacher tùy route | Đang hoạt động |
| POST/PUT/DELETE | `/api/students/:id/enrollments*` | `studentRoutes.js` | auth, branch, manage students/finance | Admin/Staff | Đang hoạt động |
| POST/DELETE | `/api/students/:id/reset-devices|lock-account|unlock-account|reset-today-attendance|reset-history|:id` | `studentRoutes.js` | auth, branch, `MANAGE_STUDENTS` | Admin/Staff | Đang hoạt động |
| POST/GET/PUT/DELETE | `/api/teachers`, `/api/teachers/:id`, `/stats/summary`, `/:id/public-card` | `teacherRoutes.js` | auth, branch, `teacherRouteGuard` | Theo ownership/permission | Đang hoạt động |
| PUT | `/api/teachers/:id/score|approve|reject` | `teacherRoutes.js` | auth, branch, write guard | Admin/Staff có quyền | Đang hoạt động |
| POST | `/api/teachers/:id/submit-practical`, `/upload-practical` | `teacherRoutes.js` | auth, teacher guard, upload | Teacher | Đang hoạt động |
| GET/PUT | `/api/teachers/:id/finance*` | `teacherRoutes.js` | auth, self/manage-finance | Teacher-self/Admin | Đang hoạt động |
| GET/POST/PUT/PATCH/DELETE | `/api/schedules/*` | `scheduleRoutes.js` | `schedulesGuard`; branch/permission thiếu ở vài write | Auth theo handler | Đang hoạt động |
| GET/POST/PUT/PATCH/DELETE | `/api/messages/*`, `/groups/*`, `/upload`, `/broadcast` | `messageRoutes.js` | `messagesGuard`; membership theo handler | Auth | Đang hoạt động |
| GET/POST/PUT/DELETE | `/api/courses/*` | `courseRoutes.js` | read/write guard, internal token khi write | Public/Auth/Admin | Đang hoạt động |
| GET/POST/PUT/DELETE | `/api/assignments/*`, `/submit`, `/grade`, `/upload` | `assignmentRoutes.js` | `assignmentsGuard`, upload | Auth theo ownership | Đang hoạt động |
| GET/POST/DELETE | `/api/quizzes/teacher|student|create|generate-ai|:id|:id/submit|admin/all` | `quizRoutes.js` | auth + `quizzesGuard` | Teacher/Student/Admin | Đang hoạt động |
| GET/POST | `/api/evaluations/*` | `evaluationRoutes.js` | evaluation guard; create thiếu scope non-student | Auth | Đang hoạt động |
| GET/POST/PUT/DELETE | `/api/exam-results/*` | `examResultRoutes.js` | `examGuard` + handler ownership | Auth theo loại kết quả | Đang hoạt động |
| POST/GET | `/api/proctor/events|events/me|events/:userId` | `proctorRoutes.js` | auth + proctor guard | Auth/Admin | Đang hoạt động |
| GET/POST/PUT/DELETE | `/api/cert-prep/*` | `certPrepRoutes.js` | student ownership hoặc `MANAGE_CERT_PREP` | Student/Admin/Staff | Đang hoạt động |
| GET/POST/PUT/DELETE | `/api/invoices/*` | `invoiceRoutes.js` | auth, branch, `MANAGE_FINANCE` | Admin/Staff | Đang hoạt động |
| GET/POST/PUT/DELETE | `/api/transactions/*` | `transactionRoutes.js` | auth, branch, finance; teacher-self calculate | Admin/Staff/Teacher | Đang hoạt động |
| GET/POST/PATCH | `/api/finance/*` | `financeRoutes.js` | read/manage guard | Admin/Staff có quyền | Đang hoạt động |
| POST/GET | `/api/webhooks/payment-session|create-session|payment-status*` | `webhookRoutes.js` | auth | Auth | Đang hoạt động |
| POST | `/api/webhooks/sepay` | `webhookRoutes.js` | signature/API key; CSRF skip | SePay | Đang hoạt động |
| GET | `/api/settings/bank|payment|web` | `settingsRoutes.js` | public read | Public | Đang hoạt động |
| GET | `/api/settings/student-exam-config|teacher-exam-config` | `settingsRoutes.js` | auth + permission/role matrix | Candidate-self hoặc Admin/Staff đúng quyền | Đang hoạt động; candidate không nhận bank |
| POST | `/api/students/:id/exam-attempt|exam-attempt/submit|exam-attempt/forfeit` | `studentRoutes.js` | auth + branch + student-self + attempt token | Student-self | Đang hoạt động; chấm server-side |
| POST | `/api/teachers/:id/exam-attempt|exam-attempt/submit|exam-attempt/forfeit` | `teacherRoutes.js` | auth + teacher-self guard + attempt token | Teacher-self | Đang hoạt động; chấm server-side |
| GET/POST/PUT/DELETE | `/api/settings/*` còn lại | `settingsRoutes.js` | settings guard/permission tùy route | Admin/Staff/Auth | Đang hoạt động |
| GET/POST/PUT/DELETE | `/api/staff/*` | `staffRoutes.js` | auth + manage staff | Admin/Staff có quyền | Đang hoạt động |
| GET/POST/PUT/DELETE | `/api/branches/*` | `branchRoutes.js` | admin guard | Admin | Đang hoạt động |
| GET/POST/PUT/DELETE | `/api/employees/*` | `employeeRoutes.js` | HR guard | Admin/Staff có quyền | Đang hoạt động |
| GET | `/api/analytics/revenue|enrollment|branches` | `analyticsRoutes.js` | analytics/finance guard | Admin/Staff có quyền | Đang hoạt động |
| GET | `/api/bi/overview|export` | `biRoutes.js` | BI guard | Admin/Staff có quyền | Đang hoạt động |
| GET/POST/DELETE | `/api/notifications/*` | `notificationRoutes.js` | notification guard | Auth/Admin broadcast | Đang hoạt động |
| GET/POST/DELETE | `/api/files/*` | `fileRoutes.js` | files guard + upload | Auth/Admin | Đang hoạt động |
| GET/POST/DELETE | `/api/backups/*` | `backupRoutes.js` | Super Admin guard | Super Admin | Đang hoạt động |
| GET/POST | `/api/monitoring/health|metrics|overview|metrics/reset` | `monitoringRoutes.js` | Super Admin guard | Super Admin | Đang hoạt động |
| GET/POST | `/api/ai/status|quiz|notification-draft|summarize|complete` | `aiRoutes.js` | admin guard + sensitive limiter | Admin | Đang hoạt động |
| GET/POST | `/api/ai-support/*` | `aiSupportRoutes.js` | auth; support checks trong handler | Student/Teacher/Support | Đang hoạt động |
| GET/POST/PUT | `/api/workflows/*` | `workflowRoutes.js` | admin guard | Admin | Đang hoạt động |
| GET/POST/PUT/DELETE | `/api/builder/*` | `builderRoutes.js` | public published forms; admin manage | Public/Admin | Đang hoạt động |
| GET/POST/PUT/DELETE | `/api/tenants/*` | `tenantRoutes.js` | Super Admin guard | Super Admin | Đang hoạt động |
| GET/POST/PATCH/DELETE | `/api/feed/*` | `feedRoutes.js` | auth + owner/admin checks | Auth | Đang hoạt động |
| GET | `/api/blog/*` | `blogRoutes.js` | public read | Public | Đang hoạt động |
| POST/PUT/DELETE | `/api/blog/*` | `blogRoutes.js` | blog manage guard | Admin/Staff có quyền | Đang hoạt động |
| GET/POST/PUT/DELETE | `/api/center-info/*` | `centerInfoRoutes.js` | public read/admin manage | Public/Admin | Đang hoạt động |
| GET | `/api/training` | `teachingGuideRoutes.js` | auth-only | Auth | Đang hoạt động |
| GET/POST/PUT/DELETE | `/api/training-lms/*` | `trainingRoutes.js` | LMS guard, specialty/admin progress | Auth theo action | Đang hoạt động |
| GET/POST/DELETE | `/api/system-logs/*` | `systemLogRoutes.js` | admin guard | Admin | Đang hoạt động |
| * | `modules/**/routes/*` | `modules/*` | Enterprise/CQRS middleware | N/A | Không được mount |
| * | `modules/support/support.routes.js` | module support | Enterprise auth | N/A | Không được mount |

### 1.5 Luồng nghiệp vụ chính

Quản trị học viên/giáo viên/nhân viên/chi nhánh; xếp lịch và điểm danh; học phí, hóa đơn, ledger và SePay; bài tập, quiz, thi chứng chỉ, thi giáo viên; LMS/training; chat/inbox/feed/blog; file/backup; AI; notification và realtime. Các lỗi toàn vẹn thi trong SEC-001/002/003/006 đã được sửa ở Giai đoạn 1 và đang chờ kiểm thử route/E2E trên QA.

## 2. Kết quả chạy kiểm tra

| Hạng mục | Lệnh | Exit code | Kết quả | Ghi chú |
| --- | --- | ---: | --- | --- |
| Runtime | `node --version; npm --version` | 0 | Có kết quả | Node 24.18.0, npm 11.16.0 |
| Backend lint | `npm run lint` | 1 | Không đạt | 1.131 vấn đề: 597 errors, 534 warnings |
| Frontend lint | `cd client; npm run lint` | 1 | Không đạt | 626 vấn đề: 553 errors, 73 warnings |
| Backend test | `npm test` | 1 | Không đạt | 1.966 tests, 55 suites, 1.940 pass, 26 fail, 0 skip |
| Frontend test | Không có script | N/A | Chưa chạy được | `client/package.json` không có `test` |
| Production build | `cd client; npm run build` | 0 | Đạt build | 2.283 modules; sinh `client/dist`; bundle lớn |
| Dependency tree root | `npm ls --depth=0` | 0 | Cây cài đặt hợp lệ | Version cài có thể cao hơn manifest trong cùng semver |
| Dependency tree client | `cd client; npm ls --depth=0` | 0 | Cây cài đặt hợp lệ | Không có missing peer trực tiếp |
| Audit toàn bộ root | `npm audit --json` | 1 | Không đạt | 23 package advisory: 15 high, 7 moderate, 1 low |
| Audit production root | `npm audit --omit=dev --json` | 1 | Không đạt | 22 advisory: 14 high, 7 moderate, 1 low |
| Audit toàn bộ client | `cd client; npm audit --json` | 1 | Không đạt | 13 advisory: 10 high, 2 moderate, 1 low |
| Audit production client | `cd client; npm audit --omit=dev --json` | 1 | Không đạt | 7 advisory: 5 high, 2 moderate |
| Runtime health | `curl http://localhost:5000/healthz` | 0 | 200 healthy | DB up; Redis disabled; queue inline |
| API 404 | GET route ngẫu nhiên | 0 | HTTP 404 đúng | Backend trả JSON 404 |
| OAuth mount | HEAD Google/Zalo | 0 | HTTP 302 | Hai bề mặt OAuth đang truy cập được |
| Package không dùng | Đối chiếu import source | N/A | Có phát hiện | Root `html2canvas`, `socket.io-client`, `puppeteer`, `node-ssh` không thuộc runtime server chính |
| Deprecated warning | Các lệnh npm | 0/1 theo lệnh | Có cảnh báo | npm config `devdir` không còn được hỗ trợ ở major kế tiếp |

Chi tiết test runner:

- Runner chính là built-in `node:test` qua `node --test`.
- `tests/api/attendance_repository_bridge.test.js` dùng `describe/it/expect/beforeEach` kiểu Jest nhưng không import từ `node:test`; lỗi `describe is not defined`.
- `tests/api/teacher_cqrs_migration.test.js` còn yêu cầu `supertest`; package và fixture `tests/fixtures/tokenGenerator` không tồn tại.
- 10 file `shared/**/__tests__` dùng Jest globals nhưng không nằm trong discovery của `tests/run.js`; Jest không có trong dependency.
- Một số `tests/api/*.test.js` chỉ gọi hàm async, catch rồi log, không rethrow/assert, có thể false-green.
- `tests/run.js` exit 0 nếu không tìm thấy test.
- `production.yml` gọi `npm run test:unit` nhưng script không tồn tại.
- `node.yml` backend chạy full test không khai báo Mongo/JWT trong job đó; smoke job mới có Mongo/JWT.
- Frontend CI không chạy test.
- Test đã chạm database thật theo `.env`; đây là lỗi cách ly test/QA, không được xem là kiểm tra an toàn cho lần sau.

## 3. Bảng tổng hợp lỗi

| Mã lỗi | Mức độ | Trạng thái xác minh | Nhóm | File/vị trí | Mô tả | Chặn production |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-001 | Nghiêm trọng | Đã sửa – chờ kiểm thử môi trường QA | Exam/BAC | `settingsRoutes.js`; `examAttemptService.js`; `studentRoutes.js` | Candidate chỉ nhận tập câu hỏi answer-free do server cấp | Không còn chặn sau khi QA đạt |
| SEC-002 | Nghiêm trọng | Đã sửa – chờ kiểm thử môi trường QA | Exam logic | `studentRoutes.js`; `examAttemptService.js`; `StudentTest.jsx` | Server xác thực attempt và tự chấm; bỏ qua kết quả client giả mạo | Không còn chặn sau khi QA đạt |
| SEC-003 | Cao | Đã sửa – chờ kiểm thử môi trường QA | Exam/BAC | `settingsRoutes.js`; `teacherRoutes.js`; `TeacherTest.jsx` | Bank giáo viên đầy đủ chỉ dành cho caller có permission | Không còn chặn sau khi QA đạt |
| SEC-006 | Nghiêm trọng | Đã sửa – chờ kiểm thử môi trường QA | Exam/BAC | `teacherRoutes.js`; `examResultRoutes.js`; `teacherExamFields.js` | Khóa self-write kết quả và chuyển chấm trắc nghiệm về server | Không còn chặn sau khi QA đạt |
| SEC-007 | Cao | Đã xác nhận | Attendance/BAC | `studentRoutes.js:1182-1276` | Giáo viên sửa số buổi/trạng thái học viên cùng chi nhánh, thiếu ownership | Có |
| SEC-008 | Cao | Đã xác nhận | Attendance logic | `scheduleRoutes.js:1175-1265` | Buổi completed vẫn sửa/cancel qua PUT generic | Có |
| SEC-009 | Cao | Đã xác nhận | Branch/BAC | `scheduleRoutes.js` write routes | Staff sửa/xóa lịch chéo chi nhánh, thiếu permission | Có |
| SEC-010 | Cao | Đã xác nhận | Rating/BAC | `evaluationRoutes.js:136-226` | Teacher/staff giả đánh giá và rating học viên | Có |
| SEC-011 | Cao | Đã xác nhận | Upload/IDOR | `uploadsAuth.js:29-49` | File private chỉ kiểm tra “JWT bất kỳ”, không ownership | Có |
| SEC-012 | Cao | Đã xác nhận | Authentication | `tempPassword.js`; create/import routes | Mật khẩu mặc định dự đoán được, không bắt đổi lần đầu | Có |
| SEC-013 | Trung bình | Đã xác nhận | Token | `client/src/services/api.js:389-414` | Access/refresh token trong localStorage và token query URL | Có |
| SEC-014 | Trung bình | Đã xác nhận | Rate limit | `apiRateLimit.js:24-49` | JWT unsigned có thể giả identity/quota rate limit | Có |
| SEC-015 | Trung bình | Đã xác nhận | Upload | upload handlers | Hầu hết upload không kiểm magic byte | Có |
| SEC-016 | Cao | Đã xác nhận | Dependency | root/client `xlsx` | `xlsx@0.18.5` có advisory high, không có fix npm | Có |
| SEC-017 | Cao | Đã xác nhận | Quiz logic | `quizRoutes.js:273-324` | Submit không enforce deadline/status/time limit | Có |
| SEC-018 | Trung bình | Đã sửa phần nộp bài – chờ kiểm thử môi trường QA | Race | `examAttemptStore.js`; `quizAccess.js`; exam/quiz routes | Conditional atomic update bảo đảm một writer cho mỗi attempt/submission | Không |
| CFG-001 | Trung bình | Đã sửa Google – chờ kiểm thử môi trường QA | Attack surface | `authRoutes.js`; `googleOAuthDisabled.js` | Google OAuth trả 410; Zalo giữ nguyên chờ xác nhận nghiệp vụ | Không còn chặn đối với Google |
| RBAC-001 | Cao | Đã xác nhận | Frontend RBAC | `permissions.js:70-84`; `App.jsx` | UI grant mọi quyền cho role admin; deep-link thiếu guard | Không, nếu backend kín |
| FUN-001 | Cao | Đã xác nhận | Sync | `useDataSync.js:116-117` | Exam result background sync đọc sai shape response | Không |
| FUN-002 | Cao | Đã sửa – chờ kiểm thử môi trường QA | Exam UX | `StudentTest.jsx`; `TeacherTest.jsx`; `StudentQuizExamRoom.jsx` | Có state/ref disable click kép; backend vẫn chống request đồng thời | Không còn chặn sau khi QA đạt |
| FUN-003 | Trung bình | Đã xác nhận | Session | `SocketContext.jsx:361-372` | SYSTEM_RESET không xóa đủ role/token keys | Không |
| TEST-001 | Cao | Đã xác nhận | Test | `tests/run.js`, `tests/api`, `shared/__tests__` | Test runner trộn hệ, 26 fail và false-green paths | Có |
| TEST-002 | Cao | Đã xác nhận | Test isolation | `tests/api/student_cqrs_migration.test.js` | Test suite kết nối DB `.env` và tạo/xóa dữ liệu | Có |
| CI-001 | Cao | Đã xác nhận | CI | `.github/workflows/*.yml` | Workflow gọi script thiếu; backend env sai; client không test | Có |
| CODE-001 | Cao | Đã xác nhận | Quality | ESLint outputs | 1.150 lỗi lint tổng cộng | Có |
| DEP-001 | Cao | Đã xác nhận | Dependency | npm audit | 22 backend-prod, 7 frontend-prod advisory | Có |
| PERF-001 | Trung bình | Đã xác nhận | Bundle | Vite build output | JS 493/528/425 KB và CSS 284 KB chưa gzip | Không |
| PERF-002 | Trung bình | Đã xác nhận | API | `studentRoutes.js:342` | Limit danh sách học viên tối đa 5.000 | Không |
| PERF-003 | Trung bình | Đã xác nhận | Frontend | god components/DataContext | DOM/render/context quá lớn, không virtualization | Không |
| A11Y-001 | Trung bình | Đã xác nhận | Accessibility | `index.html`; public pages | Skip link không có target trên public routes; SecurityGuard chặn phím | Không |
| SEO-001 | Thấp | Đã xác nhận | SEO | `index.html`, `robots.txt` | Toàn SPA noindex/disallow; public registration cũng bị chặn | Không nếu LMS nội bộ |
| UI-001 | Thấp | Đã xác nhận | UI | `App.jsx`, public assets | Catch-all về login, thiếu trang 404; favicon mặc định thiếu | Không |
| CODE-002 | Trung bình | Đã xác nhận | Maintainability | `modules/*`, components | Duplicate/dead modules và component 1.500-3.200 dòng | Không |

## 4. Chi tiết từng lỗi

### [SEC-001] Lộ đáp án thi chứng chỉ học viên — Đã sửa – chờ kiểm thử môi trường QA

- Mức độ/trạng thái/nhóm: Nghiêm trọng; Đã xác nhận; Broken Access Control/Exam integrity.
- File/dòng: `routes/settingsRoutes.js:498-529`; `StudentTest.jsx:424-433,641-644`.
- Endpoint/role: `GET /api/settings/student-exam-config`; mọi tài khoản auth, gồm Student.
- Điều kiện: có token hợp lệ. Payload raw chứa answer/correct tương đương trước khi thi.
- Bằng chứng: route trả `studentExamBankRawData`; client dùng `questions[i].answer` để chấm.
- Request minh họa: `GET /api/settings/student-exam-config` với `Authorization: Bearer <redacted>`.
- Tái hiện: đăng nhập học viên -> gọi endpoint -> tìm `studentQuestions[*].answer`.
- Nguyên nhân/hậu quả: dùng cùng DTO admin và student; lộ toàn ngân hàng, phá toàn vẹn kỳ thi.
- Đã sửa: `examAttemptService.js` tạo bản sao DTO answer-free đệ quy, không mutate bank; `studentRoutes.js` chỉ cấp đúng tập câu hỏi trong signed attempt; `settingsRoutes.js` chỉ trả bank đầy đủ khi có `MANAGE_STUDENT_TRAINING`.
- Kiểm tra: unit test xác nhận loại answer key lồng nhau, không mutate nguồn và ma trận quyền logic. Chưa có route integration test với đủ tài khoản QA.

### [SEC-002] Client tự chấm và gửi điểm/trạng thái thi học viên — Đã sửa – chờ kiểm thử môi trường QA

- Mức độ/trạng thái/nhóm: Nghiêm trọng; Đã xác nhận; Business logic.
- File/dòng: `StudentTest.jsx:641-677`; `studentRoutes.js:1638-1668`; `services/examProgressService.js:12-18,80-119,191-201`.
- Endpoint/role: `PUT /api/students/:ownId/exam-progress`; Student-self.
- Điều kiện: môn được unlock/đang thi. Server nhận `changes.tracNghiem.score/total` và `status`.
- Request: `{"subjectId":"word","changes":{"tracNghiem":{"score":1,"total":1},"status":"dat"}}`.
- Tái hiện: thay payload bằng điểm đạt; quan sát server lưu mà không nhận/chấm answers.
- Nguyên nhân/hậu quả: server chỉ clamp số, không chấm và không kiểm threshold/gate đầy đủ; học viên tự chuyển “đạt”.
- Đã sửa: client chỉ gửi `attemptToken` và `{questionId, selected}`; server xác minh ownership, subject, unlock/số buổi, fingerprint bank, tập ID, duplicate/missing/extra answer rồi tự tính điểm/ngưỡng/trạng thái.
- Tương thích: metadata attempt optional được thêm vào `Student.examProgress`; không migration, không xóa lịch sử cũ. Cần QA dữ liệu legacy và resume/retry trên nhiều tab.
- Kiểm tra: forged score/status/total không ảnh hưởng kết quả; ID ngoài đề, ID trùng, thiếu câu và cross-user token bị từ chối; đáp án và ngưỡng được chấm phía server.

### [SEC-003] Ngân hàng thi giáo viên lộ cho mọi role — Đã sửa – chờ kiểm thử môi trường QA

- Mức độ/trạng thái/nhóm: Cao; Đã xác nhận; Broken Access Control.
- File/dòng: `settingsRoutes.js:588-618`; `settingsCutoverGate.js:61-64`; `TeacherTest.jsx:433-440`.
- Endpoint/role: `GET /api/settings/teacher-exam-config`; Student/Teacher/Staff/Admin.
- Điều kiện/request: token bất kỳ; `GET` endpoint trên.
- Tái hiện: dùng student token, kiểm tra đáp án trong response.
- Nguyên nhân/hậu quả: action `auth_only`; lộ ngân hàng và hỗ trợ khai thác SEC-006.
- Đã sửa: bank quản trị chỉ trả cho admin/staff có `MANAGE_TRAINING`; student bị 403; teacher nhận tập câu hỏi answer-free qua `/api/teachers/:id/exam-attempt`. Cache bank cũ trên trình duyệt bị loại khỏi candidate context/localStorage.
- Kiểm tra: unit test ma trận role và DTO; chưa chạy ma trận HTTP với tài khoản QA thật.

### [SEC-006] Giáo viên tự sửa điểm và trạng thái thi — Đã sửa – chờ kiểm thử môi trường QA

- Mức độ/trạng thái/nhóm: Nghiêm trọng; Đã xác nhận; Authorization/Mass assignment.
- File/dòng: `teacherRoutes.js:514-592`; `TeacherTest.jsx:890-920`; `examResultRoutes.js:110-220`; `examResultDto.js:5-30`.
- Endpoint/role: `PUT /api/teachers/:ownId`, `POST/PUT /api/exam-results`; Teacher-self.
- Điều kiện: token giáo viên; allowlist self gồm `testScore`, `testStatus`, counts, practical status, account status.
- Request: `{"testScore":100,"testStatus":"passed","testMcCorrect":100,"testMcTotal":100,"status":"Pending"}`.
- Tái hiện: gửi PUT own ID hoặc tạo ExamResult own ID với `passed:true`.
- Nguyên nhân/hậu quả: kết quả client-authoritative và có hai đường ghi; bypass onboarding/duyệt.
- Đã sửa: `PUT /api/teachers/:id` từ chối rõ payload có field exam-controlled; `/api/exam-results` từ chối mọi mutation của role teacher; trắc nghiệm chấm qua signed attempt; nộp thực hành dùng conditional atomic update.
- Kiểm tra: unit test danh sách field cấm; syntax backend đạt. Chưa chạy route integration cho staff có/không permission và audit history trên QA.

### [SEC-007] Giáo viên sửa số buổi/trạng thái của học viên không đúng ownership

- Mức độ/trạng thái/nhóm: Cao; Đã xác nhận; Broken Access Control/Attendance.
- File/dòng: `studentRoutes.js:1182-1276`; `studentBranchGuard.js:7-25`.
- Endpoint/role: `PUT /api/students/:id`; Teacher.
- Điều kiện: teacher qua branch guard; guard chỉ kiểm branch khi có `req.userBranchId`, không kiểm `studentMatchesTeacher`; nếu không branch thì pass.
- Request: `{"completedSessions":12,"remainingSessions":0,"status":"active","courseName":"<course>"}`.
- Tái hiện: teacher A dùng ID học viên của teacher B cùng branch; sửa trường allowlist.
- Nguyên nhân/hậu quả: allowlist cho teacher chứa completed/remaining/status; ownership thiếu; số buổi có thể lệch khỏi Schedule/payroll/unlock.
- Khắc phục: bắt buộc ownership + enrollment ownership; số buổi chỉ derived từ attendance, không ghi generic.
- Test lại: teacher khác cùng branch và teacher thiếu branch đều 403; completedSessions chỉ đổi qua attendance transaction.

### [SEC-008] Buổi đã hoàn thành vẫn có thể bị sửa/hủy

- Mức độ/trạng thái/nhóm: Cao; Đã xác nhận; State machine.
- File/dòng: `scheduleRoutes.js:1005-1008,1175-1265,1750-1752`.
- Endpoint/role: `PUT /api/schedules/:id`; owning Teacher và Admin/Staff.
- Điều kiện: lịch đã `completed`; generic PUT chỉ chặn một trường hợp gửi lại completed.
- Request: `{"status":"cancelled","date":"2099-01-01","startTime":"00:00"}`.
- Hậu quả: attendance, student progress, unlock, payroll/ledger không được reverse đồng bộ.
- Khắc phục: terminal-state guard chung; reversal workflow có transaction/audit.
- Test lại: mọi mutation generic trên completed bị 409; reversal có quyền và bù trừ đầy đủ.

### [SEC-009] Staff ghi lịch chéo chi nhánh và thiếu permission

- Mức độ/trạng thái/nhóm: Cao; Đã xác nhận; Branch isolation.
- File: `scheduleRoutes.js:695-713,974-1008,1445-1455,1732-1745`.
- Endpoint: create/update/delete/cancel schedules; Staff bất kỳ.
- Bằng chứng: thiếu `branchFilter`, thiếu `MANAGE_SCHEDULE`; cutover legacy pass-through.
- Request: `DELETE /api/schedules/<other-branch-id>` với staff branch A.
- Khắc phục: permission + resolve branch từ DB, không tin body; branch fail-closed.
- Test lại: ma trận Staff branch A/B cho mọi write.

### [SEC-010] Teacher/staff giả đánh giá và rating

- Mức độ/trạng thái/nhóm: Cao; Đã xác nhận; Broken Access Control.
- File/dòng: `evaluationRoutes.js:136-226`.
- Endpoint/role: `POST /api/evaluations`; non-student auth không bị ownership check.
- Request: `{"studentId":"<victim>","targetTeacherId":"<target>","type":"teacher_rating","criteria":{"stars":5},"finalizeCourseEnd":true}`.
- Hậu quả: rating công khai sai, bypass mốc đánh giá/course end.
- Khắc phục: chỉ Student-self tạo rating; staff/admin cần workflow sửa riêng và audit.
- Test lại: teacher/staff spoof IDs bị 403; duplicate/milestone enforced server-side.

### [SEC-011] IDOR trên file private theo URL đã biết

- Mức độ/trạng thái/nhóm: Cao; Đã xác nhận; Upload authorization.
- File/dòng: `server.js:98-121`; `uploadsAuth.js:29-49`.
- Endpoint/role: `/uploads/<path>`; JWT hợp lệ bất kỳ.
- Điều kiện: biết URL file messages/assignments/practical/training.
- Request: unrelated student GET victim path.
- Hậu quả: lộ file giữa user/branch.
- Khắc phục: download endpoint theo FileAsset ID, ownership/membership/branch; static private không truy cập trực tiếp.
- Test lại: unrelated token 403, owner/group member 200; URL guess không đủ.

### [SEC-012] Mật khẩu mặc định là dữ liệu liên hệ dự đoán được

- Mức độ/trạng thái/nhóm: Cao; Đã xác nhận; Authentication.
- File: `tempPassword.js:16-23`; `studentRoutes.js:802-825,884-893`; `teacherRoutes.js:172-188`.
- Endpoint: provisioning và `/api/auth/login/public`.
- Điều kiện: biết số điện thoại/Zalo; tài khoản chưa đổi mật khẩu.
- Bằng chứng: default password lấy phone/Zalo, `isFirstLogin:false`.
- Hậu quả: account takeover.
- Khắc phục: mật khẩu ngẫu nhiên một lần, hết hạn, bắt đổi; không dùng email login.
- Test lại: phone-as-password thất bại; first login buộc rotate; rate limit/lockout hoạt động.

### [SEC-013] Token dài hạn trong localStorage và URL

- Mức độ/trạng thái/nhóm: Trung bình; Đã xác nhận; Session.
- File/dòng: `api.js:202-209,389-414`; `uploadsAuth.js:33-36`.
- Role: mọi user.
- Bằng chứng: cả refresh/access token lưu localStorage; protected media có `?access_token=`.
- Hậu quả: XSS/extension/history/log/referrer có thể lấy token.
- Khắc phục: refresh token HttpOnly Secure SameSite; access token memory; signed short-lived media URL hoặc authenticated fetch.
- Rủi ro/test: thay đổi auth toàn frontend/socket; kiểm refresh rotation, multi-tab, logout và file previews.

### [SEC-014] Bypass quota rate limit bằng JWT không ký

- Mức độ/trạng thái/nhóm: Trung bình; Đã xác nhận; DoS protection.
- File/dòng: `apiRateLimit.js:24-49`.
- Điều kiện: production; gửi Bearer syntactically valid với ID luân phiên.
- Bằng chứng: `jwt.decode` dùng làm key và quota “authenticated” trước verify.
- Hậu quả: tăng/né quota; không phải auth bypass.
- Khắc phục: chỉ dùng `req.user` sau verify hoặc IP cho pre-auth; không tin token chưa verify.
- Test lại: unsigned/invalid JWT vẫn quota anonymous cùng IP.

### [SEC-015] Upload thiếu kiểm tra magic byte

- Mức độ/trạng thái/nhóm: Trung bình; Đã xác nhận; File upload.
- File: `fileService.js:93-120`, `assignmentRoutes.js:78-91`, `settingsRoutes.js`; `uploadSniff.js` chỉ được dùng rõ ở message upload.
- Điều kiện: actor có quyền upload; spoof MIME/extension.
- Hậu quả: malware/polyglot hosting; active-content tùy context.
- Khắc phục: sniff bytes, re-encode ảnh, deny SVG/HTML, quarantine/AV, Content-Disposition phù hợp.
- Test lại: MIME giả, SVG script, HTML đổi đuôi, ZIP bomb, oversize.

### [SEC-016/DEP-001] Dependency production có advisory

- Mức độ/trạng thái: Cao; Đã xác nhận bởi npm audit ngày 30/08/2026.
- Root production: 22 advisory; client production: 7. Trực tiếp đáng chú ý: `xlsx`, `dompurify`, `react-router-dom`; transitive gồm `ws/socket.io-parser`, axios/puppeteer chain.
- `xlsx@0.18.5`: prototype pollution và ReDoS; npm báo không có fix trong registry.
- Điều kiện/hậu quả: phụ thuộc package và đường input; XLSX import có thể nhận workbook crafted.
- Khắc phục: đánh giá version/vendor thay thế, pin lockfile, không chạy auto-fix; ưu tiên `xlsx` và web-facing packages.
- Test lại: audit report sạch theo risk accepted; regression import/export/router/socket.

### [SEC-017] Quiz cho phép nộp sau deadline/đóng đề/quá thời gian

- Mức độ/trạng thái/nhóm: Cao; Đã xác nhận; Quiz state machine.
- File/dòng: `quizRoutes.js:203-211,273-324`.
- Endpoint/role: `POST /api/quizzes/:id/submit`; assigned Student.
- Bằng chứng: submit kiểm `notYetOpen`, không kiểm `expired`, `status === active` hoặc trusted start timestamp.
- Request: submit vào quiz expired/closed.
- Hậu quả: làm offline không giới hạn và nộp muộn.
- Khắc phục: server attempt record/start time/deadline/status; reject atomically.
- Test lại: before-open, expired, closed, timeout đều 403/409.

### [SEC-018/FUN-002] Race và double submit bài thi/quiz — Đã sửa phần nộp bài, chờ kiểm thử môi trường QA

- Mức độ/trạng thái: Trung bình backend; Cao ở client exam; Có khả năng xảy ra/Đã xác nhận theo source.
- File: `quizRoutes.js:266-346`; `LessonQuiz.js`; `StudentTest.jsx:641-684,1455-1461`.
- Bằng chứng: check existing rồi push/save không atomic, model không unique per student; StudentTest không submitting ref/disabled.
- Tái hiện: hai request đồng thời/click kép dưới slow network.
- Hậu quả: duplicate/VersionError/notification trùng hoặc progress overwrite.
- Đã sửa: StudentTest/TeacherTest/StudentQuizExamRoom dùng ref in-flight và disable nút; exam submit claim active attempt bằng conditional `findOneAndUpdate`; quiz submit dùng atomic conditional push. Request lặp nhận kết quả idempotent hoặc `409` mà không ghi/thông báo lần hai.
- Kiểm tra: unit mock concurrency chứng minh chỉ một writer cho student attempt, teacher attempt và quiz submission. Chưa stress test trên MongoDB QA.

### [CFG-001] Google OAuth không dùng vẫn hoạt động — Đã sửa – chờ kiểm thử môi trường QA

- Mức độ/trạng thái: Trung bình; Đã xác nhận source và HTTP 302.
- File: `authRoutes.js`, `utils/googleOAuthDisabled.js`.
- Đã sửa: `/api/auth/google` và `/api/auth/google/callback` trả `410` JSON, không khởi tạo Passport strategy và không redirect; email hồ sơ/liên hệ giữ nguyên.
- Kiểm tra: unit test handler xác nhận status/body và không gọi redirect.
- Rủi ro còn lại: chưa HTTP smoke test trên server QA. Zalo OAuth không thay đổi trong Giai đoạn 1 và cần xác nhận nghiệp vụ riêng.

### [RBAC-001] Frontend permission khác backend

- Mức độ/trạng thái: Cao; Đã xác nhận source; backend có thể vẫn từ chối.
- File/dòng: `client/src/constants/permissions.js:70-84`; `App.jsx:284-365`.
- Bằng chứng: `session.role === 'admin'` được mọi permission; `/admin`, notifications, center-info thiếu `PermissionGuard`.
- Hậu quả: lộ UI/deep-link, request thừa, gây hiểu nhầm quyền; không tự nó chứng minh backend bypass.
- Khắc phục: dùng `adminRole`/permissions thống nhất; route guard đầy đủ.
- Test lại: SUPPORT/HIGH_ADMIN thiếu quyền không thấy/không mở route; API vẫn 403.

### [FUN-001] Background sync không cập nhật exam results

- Mức độ/trạng thái: Cao; Đã xác nhận.
- File/dòng: `useDataSync.js:116-117`; `api.js:1440-1448`.
- Bằng chứng: code chỉ set khi response là Array, nhưng API trả `{success,data}`.
- Tái hiện: thay kết quả thi ở tab khác/socket refresh; UI cũ tới khi remount.
- Khắc phục: đọc `response.data` theo contract; test reducer/sync.
- Rủi ro: tránh nhầm Axios response với payload wrapper.

### [FUN-003] SYSTEM_RESET để lại token/session role

- Mức độ/trạng thái: Trung bình; Đã xác nhận.
- File/dòng: `SocketContext.jsx:361-372`.
- Bằng chứng: chỉ xóa generic token và ba user key; bỏ `staff_user`, `*_access_token`, `*_refresh_token`.
- Hậu quả: reload có thể attach stale bearer.
- Khắc phục: gọi helper `clearTokens/clearOtherRoleSessions` duy nhất.
- Test lại: reset ở cả bốn role, reload không còn auth.

### [TEST-001/TEST-002/CI-001] Hệ thống kiểm thử không đáng tin và không cách ly DB

- Mức độ/trạng thái: Cao; Đã xác nhận bằng source và runtime.
- File: `tests/run.js`, `tests/api/*`, `shared/**/__tests__`, workflows.
- Bằng chứng: 26 fail; Jest globals dưới node:test; thiếu supertest/fixture; orphan Jest config; empty suite exit 0; test scripts nuốt lỗi; test kết nối DB `.env`; workflow gọi script thiếu.
- Hậu quả: CI đỏ hoặc false-green; test có thể ghi dữ liệu.
- Khắc phục: tách unit/integration/e2e, DB test riêng bắt buộc, runner duy nhất, fail nếu 0 tests, không log password.
- Test lại: CI clean-room Node 22; Mongo test disposable; verify cleanup; frontend test job.

### [CODE-001/CODE-002] Lint thất bại và code khó bảo trì

- Mức độ/trạng thái: Cao/Trung bình; Đã xác nhận.
- Bằng chứng: backend 597 error, frontend 553 error. Có hooks violations thật (`useInactivityTimer`, refs trong render), globals test sai và nhiều unused/dead code.
- God files: `Inbox.jsx` ~3.228, `StudentDetailModal.jsx` ~2.948, `api.js` ~2.430, `DashboardLayout.jsx` ~1.845, `StudentTest.jsx` ~1.502 dòng.
- Duplicate/dead: root và `modules/` auth/AI/examProgress/services; hiện route module chưa mount nên là maintenance risk, không phải runtime security boundary.
- Khắc phục: sửa lỗi behavior trước, sau đó refactor theo feature; không chạy lint fix hàng loạt.
- Test lại: lint 0 error; unit test theo module sau tách.

### [PERF-001/PERF-002/PERF-003] Bundle, API limit và render lớn

- Mức độ/trạng thái: Trung bình; Đã xác nhận từ build/source.
- Build: `index` 493,47 KB; `vendor-pdf` 527,90 KB; `vendor-xlsx` 424,85 KB; vendor 306,97 KB; React 267,50 KB; CSS 284,24 KB trước gzip.
- API: `/api/students` cho limit tới 5.000, dù đã gom aggregate tránh N+1.
- UI: không có virtualization, god components/context có fan-out render.
- Khắc phục: đo route usage, lazy feature export libs, giảm CSS, cap pagination 100-250, virtualize table, split context.
- Test lại: bundle budget, Lighthouse authenticated, API payload/latency, React Profiler.

### [A11Y-001/UI-001/SEO-001] Accessibility, 404 và SEO

- Mức độ/trạng thái: Trung bình/Thấp; Đã xác nhận source, chưa kiểm tra trực tiếp bằng trình duyệt.
- File: `index.html`, `App.jsx`, `SecurityGuard.jsx`, `robots.txt`.
- Bằng chứng: skip link chỉ có target trong DashboardLayout; public pages không có `#main-content`; production chặn context menu/F12/Ctrl+U/S; catch-all về login; `/favicon.svg` được tham chiếu nhưng không có; toàn SPA noindex và robots disallow.
- Hậu quả: keyboard/accessibility kém, không có trang 404; public registration không index.
- Khắc phục: main landmark mọi page, không chặn phím trình duyệt, NotFound route, favicon thật; quyết định SEO riêng cho LMS nội bộ và marketing/public registration.
- Test lại: axe/Lighthouse, keyboard/screen reader, mobile/tablet, crawler theo từng public/internal route.

## 5. Bảo mật

### Nghiêm trọng

- SEC-001, SEC-002 và SEC-006 đã sửa, chờ kiểm thử QA.

### Cao

- SEC-003 đã sửa, chờ kiểm thử QA. Chưa sửa: SEC-007, SEC-008, SEC-009, SEC-010, SEC-011, SEC-012, SEC-016, SEC-017.

### Trung bình

- SEC-018 (phần nộp bài) và CFG-001 (Google) đã sửa, chờ QA. Chưa sửa: SEC-013, SEC-014, SEC-015.

### Thấp

- Không tách lỗi bảo mật thấp độc lập; các vấn đề favicon/SEO/code cũ nằm nhóm vận hành/chất lượng.

### Cần kiểm tra thêm

- Kết quả thực tế của cơ chế atomic/idempotent SEC-018 dưới concurrency trên MongoDB QA.
- Magic-byte/polyglot theo từng loại file và cách Nginx phục vụ.
- Trạng thái cleanup DB sau `npm test`.
- Quyền trên các endpoint nhóm lớn chưa có test runtime với đủ tài khoản role/branch.
- `.env` production, TLS, backup restore và log tập trung không được đọc/thử để tránh lộ secret hoặc ghi dữ liệu.

### Code chưa hoạt động

- Phần lớn `modules/**/routes/*`, Enterprise auth và support module chưa mount.
- Duplicate `modules/exam/services/examProgressService.js` hiện tương đồng root; chỉ là rủi ro lệch trong tương lai.

### Các nhận định cũ không còn đúng

- Không xác nhận thiếu JWT verify, thiếu CSRF, CORS wildcard production, thiếu Helmet, generic student mass assignment, path traversal backup/static, broad NoSQL injection hoặc pre-submit answer leak ở teacher-assigned quiz.
- Teacher-assigned quiz `/api/quizzes/:id/submit` chấm server-side; lỗi client-authoritative nằm ở luồng thi chứng chỉ StudentTest.
- Google OAuth được theo dõi tại CFG-001; Zalo OAuth cần xác nhận nghiệp vụ riêng.

## 6. Hiệu năng

| Vấn đề | Bằng chứng | Tác động | Ưu tiên |
| --- | --- | --- | --- |
| Bundle JS/CSS lớn | Vite build sizes tại PERF-001 | tải/parse chậm trên mobile | P2 |
| PDF/XLSX vendor lớn | 528/425 KB | chỉ nên tải khi export/import | P2 |
| Student limit 5.000 | `studentRoutes.js:342` | response/aggregate/DOM lớn | P1 |
| Không virtualization | Không có virtual list package/usage | admin tables lag | P2 |
| God components/context | line counts + DataProvider | re-render, khó profile | P2 |
| Nhiều fetch settings web | Login/Loading/Sidebar gọi riêng | request trùng cold load | P3 |
| Redis disabled runtime | `/healthz` | blacklist/queue/cache in-memory/inline, không scale multi-instance | P1 trước production |
| Cron schedule reminder chỉ log | `server.js:1013-1054` | log đều 10 phút, chức năng nhắc chưa chạy | P3 |

Điểm tốt: route-level lazy loading, manual chunks, dynamic imports export libs, compression, aggregate cho session student và cleanup timers/socket ở nhiều nơi.

## 7. Giao diện, responsive, accessibility và SEO

Chưa kiểm tra trực tiếp trên trình duyệt có đăng nhập vì không có bộ tài khoản QA cách ly và việc dùng database hiện tại có nguy cơ thay đổi dữ liệu. Production build thành công; đánh giá dưới đây là source/build evidence.

- Login/public: skip link không có target; logo phụ thuộc cấu hình API; noindex toàn cục.
- Admin: deep-link permission không đồng nhất; bảng lớn chưa virtualize; cần kiểm mobile cho student list, detail modal, inbox.
- Student exam: mobile bị chặn có chủ đích; double submit; cần keyboard/focus test modal/proctor.
- Inbox: component ~3.200 dòng; test isolation hiện fail; cần kiểm split-pane tablet/mobile và modal focus trap.
- 404: backend có JSON 404 đúng; SPA không có NotFound, catch-all về login.
- Favicon: `/favicon.svg` thiếu, chỉ có admin variant.
- SEO: hợp lý nếu toàn bộ là LMS nội bộ. Nếu registration/blog/marketing cần public search thì robots/noindex hiện chặn tất cả; không có sitemap, canonical, OG hoặc per-route metadata.
- Timezone: một số component dùng `Asia/Ho_Chi_Minh`, một số dùng timezone máy khách; cần chuẩn hóa.
- Accessibility tốt đã thấy: `lang="vi"`, viewport, một số label/ARIA, skip link. Chưa đủ để kết luận đạt WCAG.

## 8. Chất lượng code và test

- Lint hiện là production gate blocker: 1.150 errors tổng.
- 26 test fail gồm security contract cert-prep, messaging isolation, responsive, RBAC parity, learning gate và test API sai runner.
- 10 Jest-style shared tests không chạy; Jest config là orphan.
- Frontend không có test script.
- CI có hai workflow chồng nhau; một workflow chắc chắn gọi script thiếu.
- Test suite không cách ly database và log dữ liệu nhạy cảm.
- Component/service quá lớn; error bị nuốt ở nhiều catch.
- Root production dependencies chứa package chỉ phục vụ script/client: `html2canvas`, `socket.io-client`, `puppeteer`, `node-ssh`.
- `modules/` duplicate với LIVE là nợ kỹ thuật; không được xóa trước khi xác định cờ CQRS/bridge và migration plan.
- `deployment/docker-compose.yml` gần như stub; compose root mới là cấu hình có nội dung.

## 9. Những phần đang làm tốt

- Server xác minh JWT bằng `jwt.verify` ở HTTP, socket và upload.
- Có refresh rotation/reuse detection, tokenVersion, blacklist và trạng thái account.
- Có CSRF double-submit, body limit, Mongo key sanitize, HPP, Helmet, CORS allowlist và rate limiter chuyên biệt auth.
- Production env validator kiểm secret length/difference, CLIENT_URL, Redis, SMTP và SePay.
- Backend 404/error không trả stack trace production.
- Quiz giáo viên giao chấm server-side và loại correctAnswer trước lần nộp đầu.
- Student generic profile update có allowlist và chặn field thanh toán.
- Có branch checks/ownership ở nhiều read route, audit history cho sửa điểm và graceful shutdown.
- Upload message có whitelist và magic-byte helper; download ưu tiên Bearer fetch.
- Build frontend thành công; đã có lazy routes/manual chunks.
- Health check, monitoring, backup, retention, queue và realtime đều có cấu trúc vận hành.

## 10. Kế hoạch khắc phục

| Thứ tự | Mã lỗi | Mức độ | Đã xác nhận | Chặn production | Nhóm sửa chung | File dự kiến sửa | Test cần chạy |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | SEC-001, SEC-003 | Critical/High | Đã sửa, chờ QA | Tạm thời | Tách exam DTO/endpoint | settings routes/services | role HTTP matrix + no-secret payload |
| 2 | SEC-002, SEC-006 | Critical | Đã sửa, chờ QA | Tạm thời | Server-authoritative grading | exam services/routes/client | route/E2E ownership + retry |
| 3 | SEC-007,008,009 | High | Có | Có | Attendance state/branch | student/schedule routes | ownership, branch, terminal state |
| 4 | SEC-010,011 | High | Có | Có | Ownership/IDOR | evaluation/upload/file routes | cross-user/branch matrix |
| 5 | SEC-012,013,014 | High/Med | Có | Có | Auth/session/rate limit | auth/api client/middleware | first login, cookie refresh, unsigned JWT |
| 6 | SEC-015,016, DEP-001 | High/Med | Có | Có | Upload/dependency | upload services/package manifests | MIME/magic/ZIP/audit regression |
| 7 | SEC-017,018,FUN-002 | High/Med | SEC-018/FUN-002 đã sửa phần submit; SEC-017 chưa sửa | Có do SEC-017 | Quiz atomic state | quiz model/routes/StudentTest | deadline, timeout, Mongo concurrency |
| 8 | TEST-001,002,CI-001 | High | Có | Có | Test/CI isolation | tests runner/workflows | clean-room CI, disposable DB |
| 9 | CODE-001 | High | Có | Có | Sửa lint behavior | files theo diagnostics | lint root/client + tests/build |
| 10 | RBAC-001,FUN-001,003 | High/Med | Có | Không | Frontend state/RBAC | permissions/App/contexts | role UI, sync, reset session |
| 11 | PERF-001,002,003 | Medium | Có | Không | Performance | Vite/API/components | bundle budget, load/profile |
| 12 | A11Y-001,UI-001,SEO-001 | Med/Low | Có | Không | UX/a11y/SEO | layouts/routes/public assets | axe, keyboard, Lighthouse, 404 |
| 13 | CFG-001,CODE-002 | Medium | Google đã sửa, CODE-002 chưa sửa | Không/Không | Tắt surface cũ/refactor | auth mount/modules/components | HTTP 410 Google, regression full suite |

Thứ tự sửa an toàn:

1. Viết contract test fail trước cho payload đề thi, chấm điểm và ownership.
2. Tách server DTO/chấm server-side, không thay schema rộng cùng lúc.
3. Khóa state machine attendance/quiz và branch ownership.
4. Cô lập test/CI bằng database disposable trước khi chạy lại suite.
5. Sau khi security regression xanh mới chuyển token/upload/dependency và refactor UI.

## 11. Kết luận

Website **chưa đủ điều kiện đưa lên production**.

Bắt buộc kiểm thử QA trước:

- SEC-001, SEC-002, SEC-003, SEC-006, SEC-018/FUN-002 và Google CFG-001 đã sửa nhưng chưa có route/E2E trên môi trường QA tách biệt.

Bắt buộc sửa tiếp trước production:

- SEC-007/008/009/010/011/012/017: phân quyền, attendance, rating, file và mật khẩu.
- TEST-001/002, CI-001, CODE-001: test/CI/lint không đáng tin.
- DEP-001/SEC-016 và production Redis/session/upload hardening.

Có thể sửa sau khi các gate trên an toàn: bundle, virtualization, god-component refactor, 404/favicon, SEO public nếu cần.

Chưa đủ bằng chứng: khai thác race thực tế, browser responsive/WCAG, cấu hình TLS/Nginx production, backup restore, secret deployment, cleanup database sau test.

5 việc cần làm ngay sau khi duyệt:

1. Kiểm thử QA ma trận role, attempt resume/retry/timeout và submit đồng thời cho các sửa đổi Giai đoạn 1.
2. Gỡ quyền teacher tự ghi số buổi và bổ sung ownership/branch cho attendance ngoài phạm vi Giai đoạn 1.
3. Khóa upload private bằng resource authorization, đổi mật khẩu mặc định.
4. Tách test DB disposable, sửa runner/CI rồi chạy lại toàn bộ.
5. Lập kế hoạch dependency có kiểm thử, đặc biệt `xlsx`, token/session và Socket.IO chain.

Báo cáo dừng tại đây. Đã sửa source trong phạm vi Giai đoạn 1; chưa commit, push, deploy, migration hoặc chủ động thay đổi database.

## 12. Phụ lục Giai đoạn 1.5 — Phone Auth và QA (31/08/2026)

### Trạng thái

**CHƯA ĐẠT route integration**. Source/harness/unit/build đã hoàn thành nhưng
Docker Desktop Linux Engine trả HTTP 500 ở `_ping`, nên không có route-level
PASS evidence trên MongoDB disposable. Không dùng database website thay thế.

### Cập nhật phát hiện

- TEST-001/TEST-002: đã có cơ chế khắc phục trong source
  (`TEST_DATABASE_URI`, fail-closed guard, Compose loopback, reset opt-in,
  dedicated port, test mode không load `.env`/worker/cron). Chờ Docker để xác
  nhận integration.
- Auth: Student/Teacher/Staff/Admin/Super Admin dùng phone + password; chỉ query
  field `phone`, chuẩn hóa `0...`/`+84...`, duplicate fail-closed, không fallback
  email/Zalo/username.
- Super Admin: dùng `MASTER_ADMIN_PHONE`, production fail-fast; JWT `id: admin`
  được giữ tương thích.
- CFG-001: cả Google và Zalo OAuth LIVE trả 410; không redirect/session/auto-create.
- Enumeration: `/check-role` và forgot-password không trả account existence,
  role, name, phone account hoặc mật khẩu plaintext.
- Email/Zalo/Google/Zalo IDs vẫn là contact/profile data; không migration/xóa.

### Bằng chứng đã chạy

- Phase 1.5 unit/contract: 21/21 pass.
- Focused env/staff regressions: 17/17 pass.
- Full unit: 283 tests, 279 pass, 4 fail ngoài hunk Phase 1.5.
- Auth backend lint và frontend auth lint: pass.
- Frontend production build: pass (2.282 modules).
- Syntax và `git diff --check`: pass.
- Docker Compose health gate: fail do daemon HTTP 500.
- Integration runner không có test env: fail-closed exit 2, không kết nối DB.

### Điều kiện đổi sang “Đạt”

Khôi phục Docker Desktop, chạy đúng `docs/PHASE_1_5_TESTING.md`, sau đó yêu cầu
toàn bộ `tests/integration/phase15_exam_auth_routes.test.js` pass và teardown
Compose project `dashboard-phase15`. Chi tiết:
`PHASE_1_5_AUTH_AND_QA_REPORT.md`.
