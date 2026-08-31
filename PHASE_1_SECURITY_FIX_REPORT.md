# PHASE 1 SECURITY FIX REPORT

Ngày hoàn tất source: 31/08/2026  
Phạm vi: SEC-001, SEC-002, SEC-003, SEC-006, FUN-002, phần nộp bài trực tiếp của SEC-018 và vô hiệu hóa Google OAuth.

## 1. Tóm tắt thay đổi

- Backend là nguồn duy nhất cấp đề, chấm trắc nghiệm và quyết định điểm/trạng thái.
- Student/Teacher candidate chỉ nhận đúng tập câu hỏi của signed attempt sau khi answer key được loại đệ quy.
- Full question bank chỉ dành cho admin/staff có đúng permission quản lý đào tạo.
- Teacher không được tự ghi kết quả qua profile hoặc `/api/exam-results`.
- Exam/quiz submission dùng conditional atomic update; request lặp không tạo kết quả hoặc notification thứ hai.
- Client có in-flight ref, trạng thái `submitting` và nút bị disable ngay khi bắt đầu gửi.
- Google OAuth trả `410 Gone` dạng JSON, không redirect. Email liên hệ và Zalo OAuth được giữ nguyên.
- Schema chỉ thêm field attempt optional/default `null`; không migration và không sửa dữ liệu thật.

## 2. File Giai đoạn 1

Backend và model:

- `services/examAttemptService.js` (mới)
- `services/examAttemptStore.js` (mới)
- `services/quizAccess.js`
- `routes/settingsRoutes.js`
- `routes/studentRoutes.js`
- `routes/teacherRoutes.js`
- `routes/examResultRoutes.js`
- `routes/quizRoutes.js`
- `routes/authRoutes.js`
- `models/Student.js`
- `models/Teacher.js`
- `utils/teacherExamFields.js` (mới)
- `utils/googleOAuthDisabled.js` (mới)

Frontend:

- `client/src/services/api.js`
- `client/src/components/StudentTest.jsx`
- `client/src/components/TeacherTest.jsx`
- `client/src/context/useDataTraining.js`

Test và tài liệu:

- `tests/unit/exam_attempt_security.test.js` (mới)
- `tests/unit/exam_attempt_store.test.js` (mới)
- `tests/unit/teacher_exam_fields.test.js` (mới)
- `tests/unit/google_oauth_disabled.test.js` (mới)
- `tests/unit/quiz_access.test.js`
- `FULL_WEBSITE_AUDIT_REPORT.md`
- `PHASE_1_SECURITY_FIX_REPORT.md` (mới)

Các file đang có thay đổi khác trong working tree nhưng không thuộc danh sách trên không phải phạm vi Giai đoạn 1 và không bị hoàn tác.

## 3. API contract trước và sau

### Student exam config

Trước:

- `GET /api/settings/student-exam-config` trả toàn bộ `studentQuestions`, gồm answer key, cho tài khoản đã đăng nhập.

Sau:

- Student hợp lệ nhận metadata cấu hình và `questionDelivery: "server_attempt"`; `studentQuestions` rỗng.
- Admin/staff có `MANAGE_STUDENT_TRAINING` nhận management bank đầy đủ.
- Teacher, role khác và staff thiếu permission nhận `403`.
- `GET/PUT /api/settings` tổng quát cũng loại `studentExamBankRawData` nếu caller thiếu permission.

### Student attempt

Endpoint mới:

- `POST /api/students/:id/exam-attempt`
- Request: `{ "subjectId": "<subject>" }`
- Response: `attemptId`, `attemptToken`, `questions`, `questionCount`, `expiresAt`, `durationSeconds`, metadata essay.
- Chỉ student-self; server kiểm tra unlock và điều kiện số buổi bằng rule hiện có.
- `questions` không chứa answer/correct/correctAnswer/correctAnswers/isCorrect/explanation hoặc secret lồng nhau.

Nộp bài:

- `POST /api/students/:id/exam-attempt/submit`
- Request được tin cậy: `attemptToken`, danh sách `{questionId, selected}`.
- Các field `score`, `total`, `percentage`, `passed`, `status`, `correct` nếu client gửi kèm không được dùng để chấm.
- Response chỉ trả kết quả tổng hợp do server tính; không trả đáp án đúng.
- Request lặp cùng attempt trả kết quả đã lưu với `idempotent: true`, hoặc `409` nếu attempt đã bị thay thế/không hợp lệ.

Forfeit:

- `POST /api/students/:id/exam-attempt/forfeit`
- Signed token hết hạn vẫn có thể dùng để forfeit đúng active attempt; attempt khác không bị ảnh hưởng.

### Teacher exam config và attempt

Sau:

- `GET /api/settings/teacher-exam-config`: teacher chỉ nhận metadata và `questionDelivery: "server_attempt"`; student/role khác và staff thiếu `MANAGE_TRAINING` nhận `403`; manager đúng quyền nhận bank.
- `POST /api/teachers/:id/exam-attempt`: teacher-self nhận assigned answer-free set.
- `POST /api/teachers/:id/exam-attempt/submit`: server chấm tổng và từng section.
- `POST /api/teachers/:id/exam-attempt/forfeit`: server chốt fail theo active attempt.
- `POST /api/teachers/:id/submit-practical`: chỉ nhận `fileUrl`, yêu cầu trắc nghiệm đã đạt và dùng conditional update.
- `POST /api/teachers/:id/practical-forfeit`: server chốt trạng thái thực hành fail.

### Generic result/profile mutation

Sau:

- `PUT /api/teachers/:id`: payload có field exam-controlled bị từ chối rõ ràng; teacher nhận `403`, admin/staff phải dùng endpoint chuyên biệt và nhận `400` nếu gửi nhầm vào profile route.
- `POST/PUT /api/exam-results`: role teacher luôn bị `403`; caller quản trị vẫn phải qua permission/branch/subject guard hiện có.

### Quiz submission

Sau:

- `POST /api/quizzes/:id/submit` claim submission bằng atomic conditional update.
- Hai request đồng thời chỉ một request append. Request còn lại đọc kết quả đã có và không phát notification/progress update lần hai.
- Quy tắc deadline/time-limit riêng của SEC-017 không thuộc Giai đoạn 1 và chưa được thay đổi.

### Google OAuth

Sau:

- `GET /api/auth/google` -> HTTP `410`, JSON code `GOOGLE_OAUTH_DISABLED`.
- `GET /api/auth/google/callback` -> HTTP `410`, cùng contract.
- Không redirect, không khởi tạo Google Passport strategy.
- Zalo OAuth và các field `email`, `googleId` cũ trong database không bị xóa hoặc migrate.

## 4. Cách server chấm điểm

1. Server chuẩn hóa question bank và tạo ID ổn định nếu câu hỏi cũ chưa có ID.
2. Server lọc đúng môn/section, loại câu essay khỏi phần trắc nghiệm và tạo thứ tự xác định theo `attemptId`.
3. Token HMAC gắn `kind`, `userId`, `attemptId`, `subjectIds`, danh sách question ID, fingerprint bank và hạn dùng.
4. Khi submit, server xác minh chữ ký, owner, hạn dùng và fingerprint.
5. Server từ chối ID ngoài đề, ID trùng, thiếu/thừa câu hoặc selected index không hợp lệ.
6. Server tải answer key từ bank phía server, tính `correct`, `total`, `percentage` và `passed`.
7. Student dùng ngưỡng 50% hiện hành. Teacher dùng 80% tổng và tối thiểu 50% cho từng section.
8. Server lưu kết quả bằng conditional atomic update chỉ khi đúng active attempt.
9. Response không chứa answer key.

Nếu bank thay đổi giữa lúc cấp đề và nộp bài, fingerprint không khớp và server fail-closed. Đây là lựa chọn bảo mật; cần QA quy trình chỉnh bank khi đang có kỳ thi.

## 5. Field client/teacher không được tự ghi

Nhóm field bị khóa gồm:

- `testScore`, `testStatus`, `testMcCorrect`, `testMcTotal`
- `passed`
- `practicalStatus`, `practicalSubmitted`, `practicalFileUrl`, `practicalScore`
- `examAttemptId`, `examAttemptStatus`, `examAttemptStartedAt`, `examAttemptSubmittedAt`
- `approvalStatus`, `approved`, `approvedAt`, `approvedBy`
- `status`, vì có thể kích hoạt tài khoản giáo viên qua profile update

Student-self không còn được gửi điểm/trạng thái trắc nghiệm qua `PUT /api/students/:id/exam-progress`. Route này chỉ nhận phần thực hành sau khi server đã chấm trắc nghiệm đạt.

## 6. Cơ chế chống nộp hai lần

- Client: `submittingRef.current` được set trước state update để chặn click thứ hai trong cùng render frame; nút và input liên quan bị disable.
- Student exam: atomic claim yêu cầu đúng `subjectId + attemptId + attemptStatus: active`.
- Teacher exam: atomic claim yêu cầu đúng `examAttemptId + examAttemptStatus: active`.
- Quiz: atomic query yêu cầu chưa có submission của student trước khi `$push`.
- Request thắng ghi kết quả và phát realtime/notification.
- Request thua chỉ trả persisted result idempotent hoặc `409`; không ghi lần hai.
- Việc bắt đầu attempt cũng dùng conditional atomic update để hai request khởi tạo đồng thời hội tụ vào một attempt.

## 7. Kết quả kiểm tra

Đạt:

- 15/15 unit/contract tests bằng `node:test`; không kết nối database.
- DTO loại secret đệ quy và không mutate bank.
- Ma trận access logic cho management/candidate bank.
- Forged `score/status/total` không thay đổi kết quả server.
- Outside/duplicate/missing question ID và cross-user token bị từ chối.
- Ngưỡng tổng/từng section được tính phía server.
- Mock concurrency cho student attempt, teacher attempt và quiz chỉ cho một writer.
- Teacher exam-controlled field detection.
- Google disabled handler trả 410 và không redirect.
- `node --check` trên các module backend Giai đoạn 1 đạt.
- `cd client; npm run build` đạt, Vite transform 2.282 modules.

Lint giới hạn file:

- Không dùng `--fix`.
- Backend command không đạt: 88 errors/28 warnings. Các `no-undef` nằm ở các đoạn realtime/finance/attendance có sẵn ngoài hunk Giai đoạn 1 trong `studentRoutes.js`; các file route lớn cũng có warning cũ. Service/util Giai đoạn 1 không có lỗi syntax.
- Frontend command không đạt: 52 errors/8 warnings, chủ yếu React Hooks/Compiler diagnostics có sẵn trong `StudentTest.jsx`, `TeacherTest.jsx`, `useDataTraining.js` và hai lỗi cũ ở `api.js`.
- Không tuyên bố repository lint sạch.

## 8. Test chưa chạy

- Không chạy full `npm test` vì suite hiện nạp `.env`, kết nối MongoDB và có test tạo/xóa dữ liệu.
- Không chạy integration test route do chưa có `TEST_DATABASE_URI` disposable được xác nhận.
- Không chạy browser/E2E, QA role matrix, multi-tab, refresh/resume, network retry và proctor timeout.
- Không chạy MongoDB stress/concurrency thật; unit concurrency hiện dùng model mock.
- Không chạy HTTP smoke Google route trên server đang kết nối môi trường thật.

## 9. Rủi ro tương thích và QA bắt buộc

- Cần kiểm tra document legacy có `examProgress`/teacher exam state cũ nhưng chưa có attempt metadata.
- Chỉnh bank trong lúc attempt đang chạy làm token bị từ chối do fingerprint đổi; cần quy trình đóng kỳ thi trước khi sửa bank.
- Cần QA thời gian hết hạn, reload gần deadline, forfeit sau deadline và lệch clock.
- Cần xác minh permission thực tế của admin/staff trong policy cutover cho hai management bank.
- Cần kiểm tra admin UI vẫn tải/lưu bank qua endpoint management mới.
- Cần kiểm tra state/UI khi server trả 400, 403, 409 và lỗi mạng; câu trả lời phải còn nguyên để retry hợp lệ.
- Dữ liệu bank từng được cache trong localStorage ở các phiên cũ; code mới xóa/che bank khi role hiện tại là candidate, nhưng cần QA logout/login chéo role trên trình duyệt dùng chung.
- Zalo OAuth còn hoạt động theo code hiện tại; cần xác nhận nghiệp vụ trước khi thay đổi.
- `modules/auth/authRoutes.js` còn implementation Google OAuth cũ nhưng không được mount bởi `server.js`; phải giữ trạng thái unmounted hoặc vô hiệu hóa trước nếu module này được đưa vào LIVE sau này.

## 10. Rollback an toàn

Không dùng `git reset --hard`, `git checkout --`, `git clean` hoặc restore toàn bộ file vì working tree có thay đổi của người dùng từ trước.

Rollback chỉ bằng patch đảo ngược đúng hunk Giai đoạn 1:

1. Sao lưu diff hiện tại và xác định owner của mọi thay đổi chồng lấn.
2. Hoàn tác riêng các endpoint `exam-attempt`, submit/forfeit và practical atomic trong student/teacher routes.
3. Hoàn tác riêng permission/DTO bank trong settings routes và API/client exam flow.
4. Hoàn tác atomic quiz claim nếu cần, không đụng các sửa quiz khác.
5. Hoàn tác handler Google 410 nếu nghiệp vụ quyết định bật lại; không thay Zalo/email.
6. Xóa đúng các file mới của Giai đoạn 1 sau khi xác nhận không được code khác dùng.
7. Có thể bỏ các field attempt optional khỏi schema vì chưa có migration; nếu QA đã tạo dữ liệu attempt, nên giữ field để tương thích thay vì xóa.
8. Chạy lại unit tests, syntax check và frontend build.

Rollback bảo mật sẽ mở lại các lỗ hổng nghiêm trọng; chỉ thực hiện trong nhánh cô lập hoặc khi có bản sửa thay thế.

## 11. Còn lại cho Giai đoạn 2

Không sửa trong lần này:

- SEC-007, SEC-008, SEC-009: attendance/schedule/branch state và ownership.
- SEC-010: rating/evaluation authorization.
- SEC-011, SEC-015: private upload authorization và magic-byte coverage.
- SEC-012, SEC-013, SEC-014: default password, token storage/query URL và rate-limit identity.
- SEC-016/DEP-001: dependency advisories.
- SEC-017: quiz deadline/status/trusted timer.
- RBAC-001, FUN-001, FUN-003.
- TEST-001, TEST-002, CI-001, CODE-001/CODE-002.
- Nhóm performance, accessibility, SEO/UI và component refactor lớn.

Không commit, push, deploy, migration, seed, cleanup hoặc thay đổi dữ liệu thật trong Giai đoạn 1.

## 12. Cập nhật kiểm chứng Giai đoạn 1.5 — 31/08/2026

- Đã thêm test DB guard, Compose Mongo 7 disposable, subprocess live harness và
  route matrix cho exam/auth.
- Unit/contract Phase 1 + phone/OAuth/test guard: 21/21 pass; frontend build và
  auth-specific lint pass.
- Google và Zalo OAuth LIVE đều trả 410; auth đã chuyển sang phone-only,
  ambiguity fail-closed và `MASTER_ADMIN_PHONE`.
- Full unit: 283 tests, 279 pass, 4 fail ngoài hunk Phase 1.5.
- Docker Desktop trả HTTP 500 ở Linux Engine `_ping`; vì vậy route integration
  chưa được chạy. Không fallback sang database website.
- Trạng thái Phase 1/1.5 vẫn là **chờ route QA / Chưa đạt** cho đến khi
  `tests/integration/phase15_exam_auth_routes.test.js` pass trên DB Docker riêng.

Chi tiết lệnh, role matrix, deployment variables và rollback:
`PHASE_1_5_AUTH_AND_QA_REPORT.md`.
