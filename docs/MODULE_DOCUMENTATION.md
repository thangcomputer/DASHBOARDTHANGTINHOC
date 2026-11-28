# Module

Mỗi dòng là module đang phục vụ người dùng. Cột route là file trong `routes/` mà `server.js` mount. Bản cùng tên trong `modules/` không được coi là bản đang chạy trừ khi route thật `require` nó.

| Module | Route đang chạy | Model chính | Web | Mobile |
| --- | --- | --- | --- | --- |
| Đăng nhập | `authRoutes.js` | `Teacher`, `Student`, `RegisteredDevice`, `AuthSession` | `api.js` `authAPI` | `apiClient.ts` |
| Học viên | `studentRoutes.js` | `Student` | admin/student components | `studentApi.ts` |
| Giáo viên, nhân sự | `teacherRoutes.js`, `staffRoutes.js`, `employeeRoutes.js` | `Teacher`, `Employee` | admin tabs | `teacherApi.ts` |
| Khóa học | `courseRoutes.js` | `Course` | catalog, admin | course APIs |
| Lịch | `scheduleRoutes.js` | `Schedule` | `ScheduleContext` | lịch trong app |
| Bài tập | `assignmentRoutes.js` | `Assignment`, `Submission` | admin/teacher/student | `assignmentApi.ts` |
| Quiz, thi, chứng chỉ | `quizRoutes.js`, `examResultRoutes.js`, `evaluationRoutes.js`, `certPrepRoutes.js`, `proctorRoutes.js` | `LessonQuiz`, `ExamResult`, `CertPrep*` | exam room, cert prep | `studentQuizApi.ts`, `certPrepApi.ts` |
| Luyện tập, XP | `dailyPracticeRoutes.js`, `lessonPracticeRoutes.js`, `lmsProgressRoutes.js` | `DailyPractice*`, `Lesson*`, `LmsXpGrant` | `dailyPracticeApi.js` | `dailyPracticeApi.ts` |
| Thanh toán, gói | `subscriptionRoutes.js`, `webhookRoutes.js`, `invoiceRoutes.js`, `financeRoutes.js`, `transactionRoutes.js` | `PaymentSession`, `Invoice`, `LedgerEntry` | subscription screens | `subscriptionApi.ts` |
| Tin nhắn | `messageRoutes.js`, `callRoutes.js` | `Message`, `CallHistory` | `SocketContext`, inbox | `messageApi.ts`, `socketService.ts` |
| Thông báo | `notificationRoutes.js` | `Notification` | notification center | cùng API |
| Tệp | `fileRoutes.js` | `FileAsset` | upload trong `api.js` | picker + `apiClient` |
| Cài đặt | `settingsRoutes.js` | `SystemSettings` | `SystemSettingsTab` | `webSettingsApi.ts` |
| DewSkill | `dewskillClassRoutes.js`, `dewskillStudentRoutes.js`, `aiSupportRoutes.js` | `DewskillClass`, `AiSupportSession` | AI center | `aiSupportApi.ts` |

## Sửa một chức năng

1. Tìm prefix trong `server.js`.
2. Mở file `routes/` tương ứng, giữ nguyên thứ tự middleware.
3. Đổi quy tắc trong `services/` nếu nhiều route dùng chung.
4. Đổi field thì sửa `models/` và chỗ web/mobile đọc field đó cùng lúc.
5. Chạy test unit liên quan và build client nếu đụng `client/src`.

## Phụ thuộc dễ gãy

- `studentRoutes.js` gọi tài chính, chứng chỉ, ghi danh và thiết bị.
- `authRoutes.js` gọi thiết bị, phiên, cài đặt và MFA.
- `settingsCache.js` được nhiều route đọc. Tạo settings phải upsert `_key: main`, không `create` song song.
- Đổi tên event socket phải sửa cả `server.js`, `SocketContext.jsx` và `socketService.ts`.
