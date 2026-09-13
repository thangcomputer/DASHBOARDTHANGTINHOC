# Báo cáo audit toàn hệ thống LMS Thắng Tin Học

Ngày audit: 2026-09-13  
Phạm vi: source hiện có trong workspace, không thay đổi schema/database production và không refactor hàng loạt.

## 1. Kết luận điều hành

Đây là hệ thống monolith Node.js/Express + React/Vite, dùng MongoDB/Mongoose, có thêm Socket.IO, Redis/BullMQ và nhiều module nghiệp vụ. Hệ thống đã có các lớp bảo vệ đáng kể (JWT blacklist/token version, CSRF, rate limit, helmet, mongo sanitize, HPP, branch scope, policy shadow/cutover), nhưng vẫn có technical debt lớn do route quá lớn, dữ liệu cấu hình dạng `Mixed`, hai thế hệ certification/analytics chạy song song và một số luồng client autosave có thể cạnh tranh.

**Đánh giá production:** Chưa nên coi là production-ready tuyệt đối. Các luồng đăng nhập, thi và phân quyền cần regression/integration test với dữ liệu staging trước release. Riêng lỗi người dùng không thấy file đề đã xác minh là lỗi liên kết dữ liệu/race/cache/trạng thái phiên; bản sửa hiện tại đã được kiểm tra syntax, build và unit test nhưng vẫn cần E2E sạch với một phiên thi mới.

## 2. Inventory và kiến trúc thực tế

- Backend: Node.js CommonJS, Express 5, Mongoose 9, MongoDB.
- Frontend: React 19, Vite, React Router 7, Context hooks, SWR được khai báo.
- Auth: access/refresh JWT, blacklist, token version, session cookie, CSRF và device conflict.
- Upload: Multer, local `uploads/`; production có nhánh S3 nhưng cần cấu hình đầy đủ.
- Realtime: Socket.IO; queue/cache: Redis/BullMQ.
- Logging: Pino/Pino HTTP.
- Test: Node test/unit/integration, smoke script, Playwright/Puppeteer scripts.
- Database: MongoDB; schema LMS chính gồm Student, Teacher, Course/Training, Progress, Quiz/Assignment, ExamResult, Certificate/cert-prep, Finance/Ledger/Invoice và SystemSettings.

### Luồng chính

```text
React pages/components
  -> client/src/services/api.js / context hooks
  -> Express routes (/api/*)
  -> middleware auth + branch scope + permission/policy
  -> route handler và một phần service
  -> Mongoose models / service aggregation
  -> MongoDB
```

Luồng file đề tự luận legacy:

```text
AdminQuestionBankPanel
 -> POST /api/settings/upload-training-file
 -> PUT /api/settings/student-exam-config
 -> SystemSettings.studentExamFilesRaw hoặc essay attachment
 -> GET /api/settings/student-exam-config
 -> useDataTraining
 -> StudentTest / getStudentPracticeFilesForSubject
```

Luồng BI/revenue:

```text
BiDashboard/Revenue UI
 -> /api/bi hoặc /api/analytics
 -> branchFilter + policy/cutover gate
 -> biService/ledgerService
 -> Ledger/Student/Branch
 -> KPI, time series, CSV
```

## 3. Điểm tốt nên giữ nguyên

- `middleware/auth.js`: kiểm tra JWT, blacklist, token version và trạng thái tài khoản; student exam routes có kiểm tra ownership rõ ràng.
- `config/validateEnv.js`: fail-fast cho secret production, Redis, SMTP, payment webhook và storage.
- `server.js`: có CSRF, Helmet, CORS allow-list, request size limit, mongo sanitize, HPP, structured logging và bảo vệ `/uploads`.
- Exam attempt service/unit tests: có atomic claim, chống resume tab mới, chống forged result, kiểm tra answer ownership và idempotent forfeit.
- Analytics đã phân biệt nguồn tài chính Ledger với số liệu enrollment, có timezone Việt Nam trong helper.
- Settings route đã chuyển cập nhật file theo từng key `studentExamFilesRaw.<subject>` để request autosave môn này không xóa file môn khác.

## 4. Findings đã xác minh

| ID | Mức độ | Module | File/vị trí | Vấn đề và ảnh hưởng | Khuyến nghị |
|---|---|---|---|---|---|
| LMS-001 | 🟠 HIGH | Certification legacy | [routes/settingsRoutes.js](../routes/settingsRoutes.js), `studentExamFilesRaw` | Trước bản sửa, autosave cấu hình gửi payload cũ/rỗng có thể ghi đè mapping file vừa upload; file vật lý còn nhưng API học viên không có đề. Đây là nguyên nhân trực tiếp của lỗi “admin đã tải nhưng học viên không thấy”. | Giữ cập nhật nguyên tử theo subject, thêm integration test upload → autosave khác môn → GET học viên → download; bổ sung cleanup/quan sát orphan file. |
| LMS-002 | 🟠 HIGH | Exam state | [routes/studentRoutes.js](../routes/studentRoutes.js): 1765–2069 | Trạng thái `closed`, `forfeited` và reload được xử lý như state machine. UX hiện tại có thể báo “Môn thi đã được chốt” hoặc làm mất phiên trước khi tab tự luận xuất hiện; người dùng dễ nhầm là thiếu file. | Hiển thị trạng thái/điều kiện mở tab rõ ở UI; E2E test phiên mới, submit trắc nghiệm, mở tự luận, reload và forfeit. Không tự động nới state machine nếu chưa xác định chính sách thi. |
| LMS-003 | 🟠 HIGH | Runtime/local operations | [scripts/run-local.ps1](../scripts/run-local.ps1), [server.js](../server.js) | Có thể chạy đồng thời `node --watch` và `node server.js`; process cũ giữ port làm kiểm tra chạy trên code cũ, dẫn tới kết luận sai về cache/mapping. | Script phải in PID/version/commit đang phục vụ; smoke test kiểm tra `/healthz` và marker build; chỉ cho phép một backend local trên port. |
| LMS-004 | 🟡 MEDIUM | Maintainability | [routes/studentRoutes.js](../routes/studentRoutes.js), [client/src/components/StudentDetailModal.jsx](../client/src/components/StudentDetailModal.jsx), [client/src/components/Inbox.jsx](../client/src/components/Inbox.jsx) | Nhiều file vượt 160 KB, route student vượt 180 KB, chứa nhiều trách nhiệm và nhiều truy vấn. Rủi ro regression, khó review và khó test tăng cao. | Tách theo bounded context (student profile, enrollment, exam attempt, finance); giữ API endpoint hiện tại, di chuyển handler sang service theo từng đợt. |
| LMS-005 | 🟡 MEDIUM | Data model | [models/SystemSettings.js](../models/SystemSettings.js) | `studentExamBankRawData`, `studentExamFilesRaw`, thời lượng và flags dùng `Mixed`; thiếu schema/validation/index ở cấp field, dễ ghi sai alias hoặc payload không đồng nhất. | Tạo DTO/schema validation và canonical subject enum; migration chỉ sau khi có backward-compatible reader và kiểm kê dữ liệu production. |
| LMS-006 | 🟡 MEDIUM | Architecture | `modules/*/repositories/*`, [server.js](../server.js) | Có nhiều repository/CQRS interface còn `throw new Error('Not implemented')`; một số module mới tồn tại nhưng route live vẫn dùng handler legacy. Nếu developer tưởng module đã hoạt động sẽ dễ sửa nhầm tầng. | Gắn trạng thái rõ `experimental/unmounted`, thêm architecture map; chỉ migrate từng module khi có parity test và feature flag. |
| LMS-007 | 🟡 MEDIUM | API consistency | [routes/analyticsRoutes.js](../routes/analyticsRoutes.js), [routes/biRoutes.js](../routes/biRoutes.js) | Có hai surface BI/analytics và hai nguồn metric. Revenue đã chỉ định Ledger làm source of truth, nhưng enrollment/student paid vẫn là logic khác; nguy cơ cùng tên KPI cho kết quả khác nhau. | Lập metric contract (định nghĩa, timezone, source, filter), snapshot test đối chiếu API/UI/database; không đổi response cũ đột ngột. |
| LMS-008 | 🟡 MEDIUM | Upload/storage | [server.js](../server.js), [routes/settingsRoutes.js](../routes/settingsRoutes.js) | File local và metadata MongoDB không có transaction chung; upload thành công nhưng PUT thất bại tạo orphan, ngược lại metadata mất file tạo broken link. MIME/extension filter vẫn phân tán theo route. | Dùng FileAsset/storage abstraction, checksum và trạng thái pending/active; job dọn orphan có dry-run; kiểm tra MIME bằng nội dung khi upload nhạy cảm. |
| LMS-009 | 🟡 MEDIUM | Production sessions | [server.js](../server.js) | Production cố dùng connect-mongo nhưng catch lỗi sẽ fallback MemoryStore. Khi nhiều instance/restart, session mất hoặc không chia sẻ; đây là degradation nguy hiểm nếu cookie session đang được dùng. | Production phải fail-fast nếu session store bắt buộc nhưng không khởi tạo được; kiểm tra health/readiness báo store mode. |
| LMS-010 | 🔵 LOW | Technical debt | `modules/*/repositories/*`, `docs/codes/PHASE_C1_PRODUCTION_AUDIT.md` | Có skeleton/repository chưa triển khai và tài liệu ghi rõ counter chưa implement. Không phải lỗi runtime nếu không mount, nhưng tạo dead surface và làm audit/reference khó. | Đánh dấu rõ hoặc xóa sau khi kiểm tra toàn bộ import; không xóa trong vòng audit này. |

## 5. Security review

Các bằng chứng tĩnh đã kiểm tra: JWT verification, blacklist, CSRF, CORS allow-list, Helmet, HPP, mongo sanitize, upload auth và route ownership. Không kết luận “an toàn tuyệt đối” chỉ từ static scan.

Các điểm cần xác minh trên staging:

1. Kiểm thử IDOR cho từng route file, exam result, progress, finance và report với student/teacher khác branch.
2. Kiểm thử upload polyglot/MIME giả, filename path traversal và tải file sau revoke token.
3. Xác minh mọi public upload prefix (`avatars`, `feed`, `blog`, `center-info`) chỉ chứa tài sản thực sự công khai.
4. Xác minh hardcoded admin không dùng mật khẩu dev/fallback trong production; production env validation phải bắt buộc secret riêng.
5. Xác minh webhook payment signature, replay/idempotency và quyền export CSV.

### Bằng chứng đã xác minh trong local test harness

- Upload certification gắn `FileAsset` với `relatedType: certification_submission` và đúng `uploadedBy`.
- Nội dung giả mạo đuôi `.docx` bị từ chối bằng magic-byte validation.
- File certification yêu cầu authentication, kiểm tra ownership và chặn token đã revoke.
- File có `expiresAt` trong quá khứ bị trả `404`, không để lộ nội dung file.
- Path traversal (`..`) không được coi là public upload path.
- Quyền đọc của admin/staff/teacher đã được kiểm tra qua HTTP integration; ownership của học viên có unit và integration regression test.
- State machine thực tế đã được kiểm tra cho submit idempotent và reload/rời phòng: lượt mở lại bị `forfeited`/`EXAM_ATTEMPT_ABANDONED`, không thể mở lại nếu chưa được admin reset.

Kết quả chuyên gia security độc lập được giữ riêng trong phiên audit; các finding bảo mật exploitable chỉ được chốt sau khi agent hoàn tất và đối chiếu line-level. Mục này **CẦN XÁC MINH**, không suy đoán thành lỗ hổng.

## 6. Frontend

### Rủi ro

- `StudentTest` và `TeacherTest` có logic thi lớn/trùng; dễ lệch state machine và điều kiện mở phần tự luận.
- Context autosave và API fetch có nhiều update path; cần debounce/cancel request và version/concurrency token ở các cấu hình quan trọng.
- Cần kiểm tra riêng loading/error/empty state cho file đề; “Chưa có đề” phải phân biệt `404 metadata`, `401 file`, `403 permission`, `409 exam state` và file broken.
- Responsive cần E2E/visual test ở mobile/tablet; static review chưa đủ để kết luận vỡ layout.

### Đã kiểm tra

Frontend production build thành công: 2.421 modules transformed. Lint toàn repo chưa được coi là baseline sạch vì có lỗi tồn tại ở các file không liên quan.

## 7. Backend/API/Database

- Route đã mount đầy đủ trên [server.js](../server.js), nhưng nhiều route handler vẫn chứa query/business logic trực tiếp.
- Ownership của student exam attempt được kiểm tra ở `studentRoutes`; cần mở rộng cùng một chuẩn sang mọi route đọc file/result/report.
- Các trường `Mixed` trong `SystemSettings` là điểm coupling chính của lỗi đề.
- Cần bổ sung index dựa trên explain plan production cho `Student.examProgress`, `branchId`, Ledger date/type/branch và các foreign-key-like fields. Chưa tạo migration vì chưa có số liệu query plan.
- Không thấy cơ sở đủ chắc để tự ý xóa column/bảng hoặc chạy migration trong vòng audit.

## 8. Date/timezone và reporting

Analytics có helper `vnTimezone` và trả timezone trong revenue response. Tuy nhiên cần test contract cho `today`, `yesterday`, tháng và khoảng tùy chỉnh tại ranh giới UTC ngày mới; static source review không thay thế được dữ liệu fixture.

Metric contract cần chốt:

- revenue net = payments - refunds từ Ledger;
- enrollment/student paid là operational metric, không thay thế financial revenue;
- branch scope phải áp dụng đồng nhất cho current/previous/all-time/time series;
- tất cả API phải ghi rõ inclusive/exclusive end date.

## 9. Code trùng, code rác và file lớn

Không liệt kê file để xóa chỉ dựa vào tên/import chưa dùng. Các khu vực cần refactor có bằng chứng kích thước/trách nhiệm:

- [routes/studentRoutes.js](../routes/studentRoutes.js): student CRUD, finance, enrollment, exam state, teacher payment.
- [client/src/components/StudentDetailModal.jsx](../client/src/components/StudentDetailModal.jsx): modal nghiệp vụ lớn.
- [client/src/components/Inbox.jsx](../client/src/components/Inbox.jsx): messaging/UI state lớn.
- [client/src/components/DashboardLayout.jsx](../client/src/components/DashboardLayout.jsx): layout/auth/navigation coupling.
- [routes/teacherRoutes.js](../routes/teacherRoutes.js), [routes/scheduleRoutes.js](../routes/scheduleRoutes.js): nhiều nghiệp vụ và query.

Ưu tiên gom helper/service cho: subject canonicalization, API error normalization, file metadata validation, exam state transitions và metric date range.

## 10. Roadmap sửa

### Giai đoạn 1 — Critical/security

1. [Đã làm một phần] Hoàn tất security line review và IDOR matrix.
2. [Đã hoàn tất] Fail-fast session store production.
3. [Đã làm một phần] E2E upload/download với revoke token, MIME/path traversal và expiry.
4. [Còn thiếu] Mở rộng HTTP matrix cho branch scope; quyền đọc certification của admin/staff/teacher đã có integration coverage.

### Giai đoạn 2 — Logic nghiệp vụ

1. [Đã làm một phần] Test state machine exam: submit idempotent và reload/rời phòng đã có integration coverage; còn thiếu timeout, forfeit chủ động và luồng MC + essay đầy đủ.
2. Chuẩn hóa file đề theo canonical subject và version.
3. Loại race autosave bằng version/ETag hoặc server-side patch contract.

### Giai đoạn 3 — Structure

1. Tách `studentRoutes` theo bounded context.
2. Đưa business logic khỏi component lớn và route handler.
3. Ghi architecture map cho legacy vs mounted modules.

### Giai đoạn 4 — Performance

1. Explain plan/index audit.
2. Giới hạn pagination/export và N+1.
3. Cache có invalidation rõ cho settings/analytics; không dùng cache để che consistency bug.

### Giai đoạn 5 — Maintainability/test

1. Contract tests cho API config/exam/report.
2. Regression suite login/RBAC/enrollment/progress/quiz/report/certificate.
3. Chốt metric catalog và runbook local/staging/production.

## 11. Những file không nên sửa hàng loạt

- [server.js](../server.js): entrypoint/middleware/order; thay đổi dễ ảnh hưởng toàn hệ thống.
- [middleware/auth.js](../middleware/auth.js): thay đổi có thể bypass hoặc khóa toàn bộ RBAC.
- [routes/studentRoutes.js](../routes/studentRoutes.js): state machine exam/finance/enrollment dùng chung.
- [models/SystemSettings.js](../models/SystemSettings.js): dữ liệu Mixed legacy; migration cần backward compatibility.
- [client/src/components/StudentTest.jsx](../client/src/components/StudentTest.jsx): UX và anti-cheat state phụ thuộc backend.

## 12. Test matrix tối thiểu trước release

| Nhóm | Test bắt buộc |
|---|---|
| Auth | login/logout/refresh, token revoke, device conflict, locked account |
| RBAC | admin/staff/teacher/student; cross-branch; direct API/URL |
| LMS | course/enrollment/progress/expiry/teacher assignment |
| Exam | start/submit/forfeit/reload/duplicate submit, MC + essay file |
| File | upload metadata atomicity, download permission, expired token, MIME/size |
| Report | Ledger reconciliation, branch filter, date boundary UTC+7, CSV |
| Reliability | two concurrent autosaves, two concurrent attempt claims, restart/session store |
| UI | desktop/tablet/mobile; empty/loading/error/401/403/404/409 states |

## 13. Chấm điểm hiện trạng

| Hạng mục | Điểm |
|---|---:|
| Cấu trúc code | 6/10 |
| Chất lượng code | 6/10 |
| Logic nghiệp vụ | 6/10 |
| Database | 6/10 |
| API | 6/10 |
| Frontend | 6/10 |
| Backend | 6/10 |
| Security | 7/10 |
| Performance | 5/10 |
| Maintainability | 5/10 |
| Scalability | 5/10 |
| Testing | 6/10 |
| **Tổng thể** | **5.9/10** |

Điểm số là đánh giá audit tĩnh + validation hiện có, không phải chứng nhận tải production.

## 14. Validation đã chạy

- `node --check` backend files liên quan: đạt.
- `git diff --check`: đạt.
- `npm.cmd run test:phase15:unit`: **28/28 đạt**.
- `Set-Location client; npm.cmd run build`: đạt, 2.421 modules transformed.
- Root `npm run build` không tồn tại; build đúng phải chạy trong `client`.
- Full integration chưa chạy vì cần `TEST_DATABASE_URI` an toàn và dữ liệu fixture riêng.
