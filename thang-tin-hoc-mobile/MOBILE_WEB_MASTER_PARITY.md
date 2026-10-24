# Mobile ↔ Web Master Parity Inventory

## Mục tiêu và nguyên tắc

Website hiện tại là nguồn chuẩn cho chức năng, nội dung, quyền, trạng thái và luồng thao tác. Mobile có thể tối ưu bố cục cho điện thoại nhưng không tự mở rộng nghiệp vụ.

- Project mobile hiện tại (`thang-tin-hoc-mobile/`) được giữ nguyên.
- Mobile phase hiện tại tập trung Student và Teacher.
- Admin/Admin Staff được kiểm kê nhưng đánh dấu `WEB-ONLY CURRENT SCOPE`.
- Mobile chỉ dùng UI, navigation và mock local. Không kết nối API/auth thật, database, Redis, Socket.IO, push, thanh toán, upload/download thật, camera/proctor hoặc thi thật.
- Những số liệu không có nguồn mock xác minh phải hiển thị `—` hoặc trạng thái trống phù hợp.
- Các trạng thái bên dưới mô tả mức UI/luồng local, không phải đồng bộ backend.
- Bảng đánh giá mới nhất tách riêng `UI/UX Parity` và `Backend Status` xem tại [`MOBILE_WEB_UI_UX_FINAL_AUDIT.md`](./MOBILE_WEB_UI_UX_FINAL_AUDIT.md).

## Trạng thái

Trong các bảng inventory, `Status` chỉ là **UI/UX Parity**; backend được theo dõi riêng. Mất API, đăng nhập thật, đồng bộ dữ liệu hoặc persistence **không tự làm giảm UI/UX status**. Chỉ đánh `PARTIAL` khi thiếu nội dung, control, trạng thái, đường đi hoặc luồng UI thuộc source web. Với toàn bộ mobile phase hiện tại, `Backend Status` là `MOCK ONLY / NOT CONNECTED`.

| Status | Ý nghĩa |
|---|---|
| `ALIGNED` | Nội dung và luồng UI tương ứng với web đã được rà; giới hạn mock không làm thiếu phần UI được yêu cầu. |
| `PARTIAL` | Có màn/đường đi nhưng còn thiếu một phần nội dung, hành động, trạng thái hoặc chỉ là local mock. |
| `MISSING` | Web có chức năng nhưng hiện chưa có màn/đường truy cập mobile tương ứng. |
| `WEB-ONLY` | Chức năng vẫn được inventory; chưa triển khai mobile trong phạm vi hiện tại (ví dụ thi/camera, hoặc Admin/Staff). |

## Vai trò, điều kiện truy cập và navigation trên web

| Web identity / state | Web behavior | Mobile scope |
|---|---|---|
| `student` | Student dashboard yêu cầu session hợp lệ và quyền học tập/enrollment phù hợp; menu học tập có thể bị ẩn nếu enrollment không hợp lệ. Admin preview có thể bypass enrollment gate. | Student UI có trong app dưới dạng demo role; chưa xác thực enrollment hoặc quyền thật. `PARTIAL`. |
| `teacher` active | Dashboard, schedule, students, assignments, training, finance, inbox, news/feed, center info, profile. | Mobile Teacher UI có tab chính và các stack/menu screens mock. `PARTIAL`. |
| `teacher` pending/locked | Vẫn là role `teacher`; guard đưa về `/teacher/test` và khóa các mục dashboard thông thường. | Teacher onboarding/test, camera và attempt chưa có trên mobile. `WEB-ONLY`. Không tính đây là role riêng. |
| `admin` | Dùng shared Admin dashboard; Super Admin có quyền rộng, còn các role/quyền khác được lọc theo permission. | `WEB-ONLY CURRENT SCOPE`. |
| `staff` / Admin Staff | Session role mapping và permission-filtered shared Admin dashboard; không phải một dashboard/module tree độc lập. | `WEB-ONLY CURRENT SCOPE`. |

## STUDENT

Source inventory: `client/src/App.jsx`, `AppSidebar.jsx`, `StudentDashboard.jsx`, Student dashboard tabs, LMS, exam/cert-prep/lesson-practice, inbox, notification, feed, news và center-info components.

| Web function | Web route/source | Mobile screen / route | Status | UI and functional gap |
|---|---|---|---|---|
| Tổng quan, enrollment/course switcher, tiến độ, lớp sắp tới, tin nhắn/bài tập cần xử lý | `/student`; `StudentOverviewTab.jsx` | Home | `PARTIAL` | Runtime đối chiếu các section lớp học, 4 KPI, quiz/bài tập/lịch/tin nhắn, tài liệu, nhật ký/điểm; mobile đã bám thứ tự/nhãn cơ bản. Mock vẫn synthetic, không phản ánh enrollment hoặc trạng thái tài khoản thật. |
| Hộp thư và hội thoại | `/student/inbox`; shared `Inbox` | Messages, Conversation | `PARTIAL` | Search/thread và thao tác local có; unread/read receipts, file transfer và realtime chưa đồng bộ. |
| Video khóa học và LMS | `/student/lesson-practice/*`; `StudentTrainingLMS.jsx` | StudentLearning, LearningLesson | `PARTIAL` | Có catalog/unit/lesson/progress mock; chưa phát media hoặc áp dụng access/progress gates từ web. |
| Lịch học, lọc khóa, ghi chú buổi học | `/student#schedule`; `StudentScheduleTab.jsx`, `StudentScheduleView.jsx` | Schedule | `PARTIAL` | Mobile có KPI tháng, điều hướng tuần, lưới ngày/khóa, lọc khóa, chi tiết buổi, nhật ký với lọc ngày/tuần/tháng/trạng thái, điểm/ghi chú nếu mock có và modal ghi chú local. Cần so ảnh và xác minh mọi nguồn field; backend mock-only được theo dõi riêng. |
| Bài tập và submission | `/student#materials-assignments`; `StudentMaterialsTab.jsx` | Assignments | `PARTIAL` | Có danh sách/hạn/trạng thái và tương tác mock; không chọn/upload file, nộp thật hoặc nhận feedback server. |
| Tài liệu, video, phần mềm | `/student#materials-files`, `/student#materials-software`; `StudentMaterialsTab.jsx` | Materials, SoftwareLinks | `PARTIAL` | Có danh sách local và điều hướng; không tải/mở file hoặc phần mềm thật. |
| Điểm, kết quả và lịch sử học | `/student#exam-scores`; `StudentOverviewTab.jsx`, `StudentMaterialsTab.jsx` | Grades, StudentExam | `PARTIAL` | Có UI/đường xem mock; thiếu điểm chính thức, lịch sử và báo cáo theo web. |
| Phòng thi, quiz, MOS/IC3, chứng chỉ | `/student/exam`, `/student/exam/:subjectId`, `/student/cert-prep/*` | StudentExam (thông tin/inventory) | `WEB-ONLY` cho attempt | Giữ các nhóm chức năng trong inventory và chỉ dẫn thực hiện trên website; không có native/mock attempt, camera, proctoring, fullscreen hoặc gửi kết quả. |
| Luyện tập bài học | `/student/lesson-practice`, `/subjects/:subjectId`, `/units/:unitId` | StudentLearning, LearningLesson | `PARTIAL` | Có mock course/lesson; thiếu tiến độ, điều kiện enroll/purchase và kết quả thật. |
| Bảng tin | `/student/feed`; `FeedBoard` | Feed | `PARTIAL` | Post/comment/reaction local; không đồng bộ quyền, ảnh hoặc nội dung thật. |
| Tin tức, bài viết | `/student/news`, `/student/news/:slug`; `NewsPage` | News, NewsDetail | `PARTIAL` | Search/list/detail mock; nội dung và trạng thái bài viết không lấy từ web. |
| Đánh giá Trung tâm/giảng viên | `/student#evaluation`; `StudentEvaluationView`, `MilestoneEvaluationModal`, `useDataRatings.js` | Evaluations | `PARTIAL` | Hai tab riêng tư/công khai, tiêu chí và điều kiện đạt một nửa số buổi được phản ánh; khóa chỉnh sửa cuối khóa và so sánh hình ảnh vẫn cần xác minh. Gửi phản hồi chỉ local. |
| Hồ sơ, cập nhật thông tin | `/student#profile`; `StudentProfileTab`, `StudentProfileUpdateModal` | Profile | `PARTIAL` | Có profile/edit local; không lưu server hoặc xác minh dữ liệu tài khoản. |
| Học phí/thanh toán | Profile flow; `TuitionPaymentModal` | Tuition | `PARTIAL` | Có UI trạng thái demo; không tính tiền, tạo giao dịch hoặc thanh toán thật. |
| Liên hệ/thông tin Trung tâm | `/student/center-info`; `CenterInfoPage` | CenterInfo | `PARTIAL` | Có section/điều hướng mock; dữ liệu chi tiết chưa đồng bộ source runtime. |
| Thông báo | `/student/notifications`; `NotificationCenterPage` | Notifications | `PARTIAL` | Có filter/read-all/hide/detail/refresh và điều hướng mock theo category; cần đối chiếu destination từng payload. Không có backend/push. |
| Đăng xuất | Sidebar/session flow | Profile/demo sign-out | `PARTIAL` | Chỉ kết thúc demo session; không phải logout auth thật. |

## TEACHER

Source inventory: `client/src/App.jsx`, `AppSidebar.jsx`, `TeacherDashboard.jsx`, Teacher overview/schedule/students/assignments/quiz/training/finance/profile, `Inbox`, `FeedBoard`, `NewsPage`, `NotificationCenterPage`, `CenterInfoPage`, `TeacherTest`.

| Web function | Web route/source | Mobile screen / route | Status | UI and functional gap |
|---|---|---|---|---|
| Tổng quan, KPI, lịch hôm nay, đánh giá/thông báo | `/teacher`; `TeacherOverviewTab.jsx` | Home | `PARTIAL` | Các section chính và quick actions có; fixture không đại diện account web, số liệu thiếu nguồn để `—`. |
| Hộp thư, nhóm, hội thoại | `/teacher/inbox`; `Inbox` | Messages, Conversation | `PARTIAL` | Search/filter/thread và một số thao tác local có; thiếu realtime, dữ liệu hội thoại và các action đầy đủ như web. |
| Lịch dạy, lịch tuần/calendar, tạo/sửa/hủy | `/teacher#schedule`; `TeacherScheduleTab`, `TeacherScheduleModal`, `TeacherMonthlyCalendar`, `TeacherWeeklySlotGrid` | Schedule | `PARTIAL` | Mobile có lưới tuần và nhật ký lọc; Teacher Schedule document/body khớp viewport trong kiểm tra 7 widths. Attendance/makeup source flow, screenshot và nested overflow chưa xác minh. Monthly calendar đang tắt bằng feature flag trên web hiện tại. |
| Điểm danh, xác nhận và makeup attendance | Schedule/dashboard prompts | Attendance, Schedule | `PARTIAL` | Có trạng thái demo; thiếu check-in window, lý do, xác nhận hoàn thành và request/approval flow trên web. |
| Quản lý học viên được phân công | `/teacher#students`; `TeacherStudentsTab` | Students | `PARTIAL` | Search/status/list/detail/chat có; last access không có mock nên `—`, thiếu enrollment và các cập nhật liên kết/điểm/ghi chú web. |
| Bài tập về nhà: tạo, gán học viên, deadline, submissions, chấm | `/teacher#assignments`; `TeacherAssignmentsView` | Assignments | `PARTIAL` | Mock create/list/grading có; không upload/giao thật, không dùng danh sách học viên/enrollment của web. |
| Quiz: tạo, đối tượng, câu hỏi, kết quả, lặp/xóa | `/teacher#assignments` (tab quiz); `TeacherQuizManager` | TeacherQuizzes | `PARTIAL` | Một phần authoring/results local; AI generation, Excel import/export, dữ liệu server và enrollment chưa có. |
| Khóa đào tạo/LMS | `/teacher#training`; `TeacherTrainingLMS` | TeacherTraining | `PARTIAL` | Tabs khóa học/quy trình/tài liệu/phần mềm có; progress và lesson fixtures, không playback/sync LMS. |
| Tài liệu/link phần mềm | `/teacher#training` hoặc software-links; training/software components | TeacherTraining, SoftwareLinks | `PARTIAL` | Có list/tabs; không tải file/mở liên kết thật hoặc theo quyền/data web. |
| Tài chính, lịch sử, filter, export | `/teacher/finance`; `TeacherFinanceAndTraining` | TeacherFinance | `PARTIAL` | Có summary/chart/history/filter và nút export mock; không có account data, file export thật hoặc giao dịch. |
| Tin tức, search/filter/sort/list/grid/detail/editor theo quyền | `/teacher/news`, `/teacher/news/:slug`; `NewsPage` | News, NewsDetail | `PARTIAL` | List/detail/search mock có; thiếu quyền biên tập đầy đủ, author/thumbnail có thể `—`, chưa có pagination/status/editor flow đầy đủ. |
| Bảng tin: compose, visibility, ảnh, comment/reply/reaction, edit/delete | `/teacher/feed`; `FeedBoard` | Feed | `PARTIAL` | Compose/post/comment/reaction local có; không upload ảnh, load-more hay đồng bộ nội dung/quyền web. |
| Thông tin Trung tâm | `/teacher/center-info`; `CenterInfoPage` | CenterInfo | `PARTIAL` | Section/banner/selector có; source-backed fields thiếu fixture thì `—`, không có nội dung runtime. |
| Hồ sơ, thông tin cá nhân và ngân hàng | `/teacher#profile`; `TeacherProfileTab` | Profile | `PARTIAL` | Profile/edit local có; một số field/bank/status và password flow chưa khớp đầy đủ; không lưu server. |
| Thông báo | `/teacher/notifications`; `NotificationCenterPage` | Notifications | `PARTIAL` | Có read/category/detail/hide/refresh/read-all và điều hướng mock; payload-specific destination, pagination và semantics vẫn cần đối chiếu. Không có đồng bộ. |
| Bài kiểm tra đầu vào/onboarding | `/teacher/test`; `TeacherTest` | No native test screen | `WEB-ONLY` | Chỉ dành Teacher pending/locked; yêu cầu camera, bài thi, upload và trạng thái khóa. Không phải quiz do Teacher tạo. |

## ADMIN / ADMIN STAFF — `WEB-ONLY CURRENT SCOPE`

Admin Staff không phải một feature tree độc lập. `admin` và `staff` dùng chung Admin dashboard; Admin Staff là session/permission configuration. `SUPER_ADMIN` có quyền rộng; HIGH_ADMIN/STAFF/SUPPORT phụ thuộc permission. Không đưa các màn sau vào mobile phase hiện tại.

| Web area / subfunction | Web source/route | Permission / access | Mobile status |
|---|---|---|---|
| Overview | `AdminDashboard`, dashboard hash | Có ít nhất một quyền dashboard được hỗ trợ; special-case route | `WEB-ONLY` |
| News, feed, inbox | Admin sidebar/dashboard, `/admin/inbox` | `manage_blog`, `manage_messages`; route news/feed có thêm điều kiện role/permission | `WEB-ONLY` |
| Students hub: hồ sơ, phòng thi, tài nguyên/software, lesson practice, cert prep | Admin dashboard tabs | `manage_students`; training tabs dùng `manage_student_training`; cert prep dùng `manage_cert_prep` | `WEB-ONLY` |
| Teachers hub: teacher list, training videos/guides/evaluations/resources/exam room | Admin dashboard tabs | `view_teachers`, `manage_training`, hoặc `view_evaluations` tùy tab | `WEB-ONLY` |
| Staff permissions; HR/payroll | Admin dashboard tabs | `manage_staff`; `manage_hr` | `WEB-ONLY` |
| Finance, branch revenue analytics, BI | Admin dashboard tabs | `manage_finance`; analytics/BI dùng `view_branch_revenue` | `WEB-ONLY` |
| System settings, files, AI, workflows, builders | Admin routes/dashboard | `system_settings` | `WEB-ONLY` |
| Logs and monitoring | Admin routes/dashboard | `view_logs`; HIGH_ADMIN menu có ngoại lệ hiển thị logs | `WEB-ONLY` |
| Backups and multi-tenant | Admin routes/dashboard | Super Admin only | `WEB-ONLY` |
| Center information management | Admin route | `manage_center_info`; read-only center route không yêu cầu permission tương tự | `WEB-ONLY` |
| Notifications and center-info read page | Shared Admin routes | Không có specific permission gate được xác định trong inventory | `WEB-ONLY` |

**Permission boundary:** UI menu/route checks chỉ là presentation/access flow. Không coi đây là bảo đảm authorization backend. Admin/Staff mobile không được triển khai trong phase này.

## Nguồn kiểm kê

- Web route, guard và menu inventory: `client/src/App.jsx`, `client/src/components/AppSidebar.jsx`.
- Student source: `StudentDashboard.jsx`, Student tabs, LMS, exam/cert-prep/lesson-practice components, Inbox, NotificationCenterPage, FeedBoard, NewsPage, CenterInfoPage.
- Teacher source: `TeacherDashboard.jsx`, Teacher tabs, TeacherAssignmentsView, TeacherQuizManager, TeacherTrainingLMS, TeacherFinanceAndTraining, Inbox, FeedBoard, NewsPage, NotificationCenterPage, CenterInfoPage, TeacherTest.
- Admin/Staff source: `AdminLoginPage.jsx`, `AdminDashboard.jsx`, `AdminSidebar`/shared AppSidebar, `AdminLazyTabShell.jsx`, `useAdminDashboardState.jsx`, `permissions.js`.
- Mobile route/screen inventory: `src/navigation/RootNavigator.tsx`, `src/navigation/types.ts`, `src/screens/`, `src/services/mockService.ts`.
- Inventory is source-based. It is not a claim that every web request or runtime data path was successfully exercised.
