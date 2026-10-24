# Thắng Tin Học Mobile — UI Phase 1

## Mục tiêu và phạm vi

Đây là ứng dụng React Native độc lập dùng Expo, phục vụ thử nghiệm giao diện cho hai vai trò Student và Teacher. Website hiện tại tiếp tục hoạt động riêng; giai đoạn này chỉ triển khai UI, điều hướng và dữ liệu giả lập.

- **Backend/API:** chưa kết nối.
- **Authentication thật:** chưa kết nối; màn đăng nhập chỉ cho chọn vai trò demo.
- **Database, Socket.IO, push notification, thanh toán và thi thật:** không sử dụng.
- **Website/backend hiện có:** không được chỉnh sửa như một phần của UI Phase 1.

## Công nghệ

- Expo SDK `~58.0.19`
- React Native `0.88.0`, React `19.3.0`, TypeScript `~6.0.3`
- React Navigation native stack và bottom tabs
- `lucide-react-native` cho biểu tượng
- `react-native-safe-area-context` cho vùng an toàn
- Có thể chạy Expo Web để xem nhanh giao diện; ứng dụng vẫn là một project riêng trong `thang-tin-hoc-mobile/`.

## Màn hình và điều hướng

- **Đăng nhập demo:** chọn Student/Teacher, kiểm tra trường nhập và vào ứng dụng với tài khoản giả lập.
- **Trang chủ:** lịch kế tiếp, tiến độ khóa học, bài tập, thông báo và quick actions theo role.
- **Student stack:** lịch/chi tiết/xác nhận local, bài tập/nộp local, tài liệu/phần mềm, video khóa học/bài học placeholder, kết quả tiến độ, đánh giá, feed, tin tức/chi tiết, trung tâm, học phí, hồ sơ.
- **Teacher stack:** lịch tạo/sửa/hủy local, học viên/search/filter/detail, điểm danh local, tạo/chấm bài tập, quản lý quiz mock, đào tạo/tài liệu, phần mềm, tài chính, feed, tin tức/chi tiết, trung tâm, hồ sơ.
- **Thông báo:** danh sách, bộ lọc all/unread/read và trạng thái đọc local.
- **Tin nhắn và hội thoại:** inbox/search/thread; reply/reaction/pin/recall và tên tệp mẫu chỉ thay đổi local.
- **Thi/chứng chỉ:** được ghi nhận trong inventory nhưng hiện WEB-ONLY TẠM THỜI.
- Mọi màn mới vẫn chỉ dùng mock; không mở/tải file, không phát video thật, không lưu dữ liệu server.

Bottom tabs được cấu hình theo role: Student thấy trang chủ, lịch học, tin nhắn, thông báo và cá nhân; Teacher thấy trang chủ, lịch dạy, học viên, tin nhắn và cá nhân. Một số màn hình chi tiết mở từ stack.

# WEB → MOBILE FUNCTION PARITY

**Nguồn chuẩn:** source web hiện có, đối chiếu trực tiếp `client/src/components/AppSidebar.jsx`, `client/src/App.jsx`, `client/src/components/StudentDashboard.jsx`, `client/src/components/TeacherDashboard.jsx` và các tab Student/Teacher tương ứng. Bảng dưới đây là kiểm kê chức năng/route ở mức UI; không khẳng định API hoặc nghiệp vụ mobile đã hoạt động.

**Student runtime audit:** kiểm tra các trang Student trên local web và cập nhật hierarchy/nội dung overview mobile được ghi tại [`MOBILE_STUDENT_WEB_RUNTIME_AUDIT.md`](./MOBILE_STUDENT_WEB_RUNTIME_AUDIT.md). Các thao tác web chỉ đọc; không lưu ghi chú, bài tập, tin nhắn, đánh giá, hồ sơ hay thanh toán.

**Ý nghĩa trạng thái**

- **ĐÃ CÓ:** có màn hình và luồng UI mock tương ứng ở phạm vi đã nêu; không đồng nghĩa nghiệp vụ/backend đã tích hợp.
- **CHƯA ĐỦ:** có UI tương ứng nhưng thiếu một phần chức năng, trạng thái hoặc hành vi của web.
- **THIẾU:** chức năng web chưa có màn hình tương ứng trong mobile.
- **WEB-ONLY TẠM THỜI:** chức năng vẫn được ghi nhận nhưng chưa làm trên mobile do phụ thuộc thi/camera hoặc cần thiết kế/POC riêng.

## STUDENT

| Web Function | Web Route/Source | Mobile Screen | Status | Notes |
|---|---|---|---|---|
| Tổng quan học viên | `/student`, `StudentDashboard.jsx`, `student/StudentOverviewTab.jsx` | Home | CHƯA ĐỦ | Bám lời chào, lịch gần nhất, giảng viên, KPI buổi/điểm/tiến độ, việc cần làm và thông báo; nội dung vẫn là mock, chưa có summary theo enrollment thật. |
| Hộp thư | `/student/inbox`, `App.jsx`, `Inbox` | Messages / Conversation | CHƯA ĐỦ | Có inbox/search, phân loại hội thoại và chat local, reply/reaction/pin/recall; unread, tệp và realtime không đồng bộ với web. |
| Video khóa học / luyện tập bài học | `/student/lesson-practice/*`, `StudentDashboard.jsx`, `StudentMaterialsTab.jsx`, `StudentTrainingLMS.jsx` | StudentLearning / LearningLesson | CHƯA ĐỦ | Có lọc khóa đã đăng ký/tự học video, course → units → lessons, progress và placeholder bài học; không phát media, không có LMS gate/tiến độ server. |
| Lịch học, ghi chú và xác nhận buổi học | `/student#schedule`, `student/StudentScheduleTab.jsx`, `StudentScheduleView.jsx`, `StudentAttendanceConfirmModal.jsx` | Schedule | CHƯA ĐỦ | Có KPI buổi, lọc lịch, chi tiết/xác nhận local và nhật ký mock từ buổi đã học; chưa có dữ liệu enrollment, ghi chú/đánh giá và trạng thái web đầy đủ. |
| Bài tập và tài nguyên khóa học | `/student#materials-files`, `/student#materials-software`, `/student#materials-assignments`, `student/StudentMaterialsTab.jsx` | Assignments / Materials / SoftwareLinks | CHƯA ĐỦ | Có danh sách bài tập, hạn/trạng thái, mô tả, đánh dấu nộp local; Tài liệu học tập có tab tài liệu/video và đường mở bài tập, trắc nghiệm, đánh giá, phần mềm. Không upload/download hoặc đồng bộ submission. |
| Điểm, kết quả thi và lịch sử học tập | `/student#exam-scores`, `StudentOverviewTab.jsx`, `StudentMaterialsTab.jsx` | Grades / StudentExam | CHƯA ĐỦ | Kết quả khóa học/bài học và đường xem điểm thi được thể hiện; điểm chính thức, lịch sử và báo cáo đầy đủ vẫn trên web. |
| Phòng thi, quiz, chứng chỉ và lượt thi | `/student/exam`, `/student/exam/:subjectId`, `/student/cert-prep/*`, `StudentTest.jsx`, `StudentExamRoom.jsx`, `StudentQuizExamRoom.jsx`, `CertPrepStudentPlayer.jsx` | StudentExam (menu) | WEB-ONLY TẠM THỜI | Inventory và menu được giữ; MOS/IC3, thi chứng nhận và điểm chính thức hướng về website. Chỉ có một câu hỏi quiz local minh họa; không có attempt, camera, proctor, fullscreen hoặc nộp kết quả. |
| Bảng tin | `/student/feed`, `App.jsx`, `FeedBoard` | Feed | CHƯA ĐỦ | Có bài đăng/comment/reaction mock; thiếu feed data, media, quyền/luồng tương tác đầy đủ. |
| Tin tức và bài viết | `/student/news`, `/student/news/:slug`, `App.jsx`, `NewsPage` | News / NewsDetail | CHƯA ĐỦ | Có tìm kiếm, danh sách và chi tiết mock; không tải nội dung/đính kèm từ web. |
| Đánh giá giảng viên | `/student#evaluation`, `student/StudentEvaluationTab.jsx`, `StudentEvaluationView.jsx` | Evaluations | CHƯA ĐỦ | Có form private/public, tiêu chí web, ngưỡng nửa khóa, trạng thái đánh giá có sẵn để sửa và khóa sau khi kết thúc khóa; các nhánh đã được kiểm tra với fixture 4/12, existing rating và course-ended. Lưu vẫn local, không gửi thật. |
| Liên hệ Trung tâm | `/student/center-info`, `App.jsx`, `CenterInfoPage` | CenterInfo | CHƯA ĐỦ | Có màn hình các mục tổng quan/nhân sự/chi nhánh/dịch vụ/địa điểm thi/chứng chỉ; content nguồn và điều hướng chi tiết chưa tích hợp. |
| Hồ sơ, tóm tắt học tập, học phí/thanh toán và cập nhật thông tin | `/student#profile`, `student/StudentProfileTab.jsx`, `StudentProfileUpdateModal.jsx`, `TuitionPaymentModal.jsx` | Profile / Tuition | CHƯA ĐỦ | Profile có hero KPI, thông tin cá nhân, tóm tắt/tiến độ khóa học, tình trạng học phí và trạng thái rỗng đơn hàng video; kiểm tra responsive 320–768 px không thấy tràn ngang. Thanh toán và cập nhật server không kết nối. |
| Thông báo | `/student/notifications`, `App.jsx`, `NotificationCenterPage` | Notifications | CHƯA ĐỦ | Có lọc tất cả/chưa đọc/đã đọc, chi tiết, đọc hết và trạng thái local; QA fixture 25 mục đã kiểm tra phân trang 20/page. Đích nghiệp vụ/push và trạng thái web chưa đồng bộ. |
| Đăng xuất | `AppSidebar.jsx`, luồng session web | Profile / demo sign-out | CHƯA ĐỦ | Chỉ kết thúc phiên demo cục bộ; không phải logout auth thật. |

## TEACHER

| Web Function | Web Route/Source | Mobile Screen | Status | Notes |
|---|---|---|---|---|
| Tổng quan giảng viên | `/teacher`, `TeacherDashboard.jsx`, `teacher/TeacherOverviewTab.jsx` | Home | CHƯA ĐỦ | Có lời chào, tác vụ nhanh, KPI, lịch, học viên và bài cần chấm; các số liệu không có mock nguồn hiển thị `—`, mọi dữ liệu hiện có vẫn là fixture. |
| Hộp thư | `/teacher/inbox`, `App.jsx`, `Inbox` | Messages / Conversation | CHƯA ĐỦ | Có search, filter Học viên/Admin/Tuyển sinh/Hỗ trợ/Nhóm, trạng thái online mock và thread local gồm reply/reaction/sticker/pin/recall; không có Socket.IO hay trạng thái thật. |
| Lịch dạy | `/teacher#schedule`, `teacher/TeacherScheduleTab.jsx`, `TeacherScheduleModal.jsx` | Schedule | CHƯA ĐỦ | Có KPI tháng, lọc trạng thái, tuần trước/sau, danh sách người học/ngày/ca/trạng thái; tạo/sửa/hủy và điểm danh vẫn local, thiếu calendar/check-in rule web. |
| Quản lý học viên | `/teacher#students`, `teacher/TeacherStudentsTab.jsx`, `TeacherStudentCard.jsx` | Students | CHƯA ĐỦ | Có search, filter, hàng danh sách gọn, avatar/khóa/chat và detail; truy cập lần cuối hiển thị `—` vì chưa có fixture, không có dữ liệu web thật. |
| Điểm danh và xác nhận buổi dạy | `TeacherDashboard.jsx`, `TeacherScheduleTab.jsx`, `TeacherStudentsTab.jsx`, modal điểm danh | Attendance | CHƯA ĐỦ | Có lựa chọn trạng thái local và link từ lịch; thiếu check-in window, lý do, xác nhận hoàn thành và đồng bộ nghiệp vụ web. |
| Giao bài tập, kiểm tra, quiz và chấm bài | `/teacher#assignments`, `/teacher#quizzes`, `/teacher#test`, `TeacherAssignmentsView.jsx`, `TeacherQuizManager.jsx` | Assignments / TeacherQuizzes | CHƯA ĐỦ | Có tab bài trắc nghiệm/bài tập nộp file, quản lý quiz, số bài nộp/điểm trung bình và thao tác tạo lại/xem/xóa mock; không upload, gán enrollment hay tạo bài thi thật. |
| Khóa đào tạo | `/teacher#training`, `TeacherTrainingLMS.jsx` | TeacherTraining | CHƯA ĐỦ | Có tab Khóa học/Quy trình/Tài liệu/Phần mềm, banner/progress/bài học và dữ liệu mock; không phát video hoặc đồng bộ LMS. |
| Tài liệu/link phần mềm | `/teacher#software-links`, `SoftwareLinksTable` | SoftwareLinks | CHƯA ĐỦ | Có danh sách phần mềm/nhóm/mô tả; không mở URL hoặc tải file thật. |
| Bảng tin | `/teacher/feed`, `App.jsx`, `FeedBoard` | Feed | CHƯA ĐỦ | Có composer, privacy selector, ảnh placeholder, post/comment/reaction local; không chọn/upload ảnh hoặc lưu bài thật. |
| Tin tức và bài viết | `/teacher/news`, `/teacher/news/:slug`, `NewsPage` | News / NewsDetail | CHƯA ĐỦ | Có search, topic, sort/time, list/grid, detail; author/thumbnail chưa có trong fixture và hiển thị `—`. |
| Tài chính giảng viên | `/teacher/finance`, `TeacherFinanceAndTraining.jsx` | TeacherFinance | CHƯA ĐỦ | Có summary, biểu đồ dạng mobile, filter lịch sử và nút PDF/CSV; số liệu là fixture, nút xuất chỉ thông báo demo. |
| Thông tin Trung tâm | `/teacher/center-info`, `App.jsx`, `CenterInfoPage` | CenterInfo | CHƯA ĐỦ | Có banner, dropdown, các mục source-backed và field overview; nhiều nội dung mock trống nên hiển thị `—`. |
| Hồ sơ giảng viên | `/teacher#profile`, `teacher/TeacherProfileTab.jsx` | Profile | CHƯA ĐỦ | Có hero, trạng thái/tag và các field email/bio/chuyên môn/địa chỉ/Zalo/khu vực giọng nói/tuổi/ngân hàng; field thiếu nguồn hiển thị `—`, form chỉ lưu local. |
| Thông báo | `/teacher/notifications`, `App.jsx`, `NotificationCenterPage` | Notifications (route ẩn trong tabs Teacher) | CHƯA ĐỦ | Màn đầy đủ mở từ chuông Home; có read/unread, filter category, timestamp, detail và related-action demo; không có push/API thật. |
| Bài thi đầu vào Teacher | `/teacher/test`, `TeacherTest.jsx` | MobileMenu | WEB-ONLY TẠM THỜI | Có mục thông báo dùng web; không triển khai attempt/camera/proctor native. |
| Đăng xuất | `AppSidebar.jsx`, luồng session web | Profile / demo sign-out | CHƯA ĐỦ | Chỉ kết thúc phiên demo cục bộ. |

## Mobile đang có nhưng chưa được khớp đầy đủ với web

- `Grades` hiện thể hiện tiến độ khóa/bài học mock; không được xem là trang điểm thi/lịch sử tương đương với web.
- `Attendance` và các thao tác tạo/sửa lịch, nộp bài, chấm điểm, cập nhật hồ sơ, bình luận/reaction chỉ làm thay đổi UI local, không phải nghiệp vụ thật.
- Student `StudentExam` có thể mở câu hỏi mẫu tĩnh để kiểm tra bố cục/interaction; đây không phải bài thi và không lưu lượt thi/điểm.
- Các dòng “tài liệu mới”, “cần hỗ trợ” và card/quick actions trên Home là đường tắt/presentation cho chức năng web; không phải module mới.
- Login chọn role, số điện thoại demo và sign-out demo chỉ tồn tại để xem UI; không tương đương auth web.

Mock hiện tại có cấu trúc trường gần với web (khóa/môn, units/lessons, giảng viên, ngày/giờ, trạng thái, progress, submission/grade, evaluation milestones, feed/news, training/finance). Giá trị vẫn là synthetic, không lấy từ runtime web. Trước khi API integration phải map schema/mốc quyền từ hợp đồng dữ liệu được duyệt.

**Giới hạn phạm vi:** Admin/Staff không đưa vào mobile phase hiện tại. Bảng là inventory và gap list, không phải xác nhận các chức năng đã được triển khai.

## Mock data và nguyên tắc không kết nối mạng

Dữ liệu nằm trong `src/mocks/data.ts`; các hàm trong `src/services/mockService.ts` chỉ trả dữ liệu local kèm độ trễ giả lập. Không có base URL, HTTP client, `fetch`, Socket.IO hoặc WebSocket trong mã nguồn `src/`.

Đây là prototype UI, không phải luồng đăng nhập hay nghiệp vụ có thể dùng cho người dùng thật. Dữ liệu nhập ở màn hình đăng nhập không được gửi đến hệ thống.

Trong môi trường development, đặt `EXPO_PUBLIC_MOBILE_UI_QA_STATE` trước khi chạy Expo Web để xem trạng thái mock. Ngoài `loading`, `empty` và `error`, các fixture theo màn hình gồm `attendance-pending`, `attendance-overdue`, `notification-25-items`, `evaluation-not-eligible`, `evaluation-eligible`, `evaluation-existing`, `evaluation-course-ended`, `assignment-submitted`, `assignment-graded`, `grades-no-grade`, `grades-completed`, `chat-empty`, `chat-group`, `chat-unread`, `quiz-empty`, `quiz-draft`, `quiz-results`, `finance-empty`, `finance-populated`, `feed-empty`, `feed-multiple`, `news-empty` và `news-multiple`. Danh sách fixture, mục đích và trạng thái runtime QA ghi trong `MOBILE_UI_PHASE1_QA.md`. Biến chỉ mô phỏng dữ liệu local, không bật mạng, và bị bỏ qua trong production build.

## Chạy và kiểm tra

Từ thư mục `thang-tin-hoc-mobile/`:

```powershell
npm run start
npm run android
npm run ios
npm run web
npm run typecheck
```

`npm run typecheck` đã chạy thành công (`tsc --noEmit`). `npx expo install --check` báo các dependency đang tương thích với Expo SDK. Expo Web đã được mở và thử luồng Student/Teacher, các màn hiện có, gửi mock chat, states rỗng/lỗi/loading và viewport responsive 320/375/430/768 px. Chưa xác nhận giao diện trên Android/iOS simulator hoặc thiết bị thật; cần chạy Expo trên môi trường/thiết bị phù hợp để nghiệm thu bố cục, bàn phím và thao tác native.

`npm audit` báo 5 High: `expo` (dependency trực tiếp được gắn cảnh báo do CLI), `@expo/cli`, `@expo/code-signing-certificates`, `node-forge`, `zod`. Các đường phụ thuộc nằm trong Expo CLI/toolchain; audit đề xuất downgrade Expo tới `44.0.6` bằng thay đổi major, không phù hợp với Expo SDK hiện tại. Không chạy `npm audit fix`/`--force`, không đổi package; xem phân tích ở `MOBILE_UI_PHASE1_QA.md`.

## UI QA và thiết bị

Kết quả chi tiết theo screen, responsive, keyboard, safe area, audit dependency và giới hạn native được ghi trong [MOBILE_UI_PHASE1_QA.md](./MOBILE_UI_PHASE1_QA.md). Android native và iOS native hiện **NOT RUN**; Expo Web PASS không được xem là native PASS.

## Giới hạn và bước tiếp theo

1. Rà soát các phần còn **CHƯA ĐỦ** trong bảng parity với chủ sản phẩm trước khi mở rộng.
2. Chạy kiểm tra native Android/iOS trên thiết bị/simulator phù hợp trước khi xác nhận native UI.
3. Chỉ sau khi UI/parity được duyệt và backend/auth mobile sẵn sàng mới lập giai đoạn tích hợp API riêng.
4. Không đưa bài thi/camera monitoring lên mobile nếu chưa có thiết kế và POC chuyên biệt trên thiết bị thật.

Chi tiết phần UI/mock được bổ sung trong [MOBILE_UI_PARITY_COMPLETION.md](./MOBILE_UI_PARITY_COMPLETION.md), [MOBILE_TEACHER_WEB_PARITY_UI.md](./MOBILE_TEACHER_WEB_PARITY_UI.md), [MOBILE_STUDENT_WEB_PARITY_UI.md](./MOBILE_STUDENT_WEB_PARITY_UI.md) và bảng kiểm kê từng màn hình [MOBILE_PARITY_SCREEN_MATRIX.md](./MOBILE_PARITY_SCREEN_MATRIX.md). Bảng kiểm kê ghi nhận Teacher yêu cầu điểm danh bù vẫn thiếu UI; do đó chưa thể kết luận đã đạt parity.
