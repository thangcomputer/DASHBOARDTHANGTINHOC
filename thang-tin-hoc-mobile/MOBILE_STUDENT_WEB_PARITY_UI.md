# Student Web → Mobile UI Parity

## Phạm vi

Đây là bản kiểm kê UI/UX lịch sử, không phản ánh các tích hợp API đã được thêm sau đó. Trạng thái API hiện tại được theo dõi trong [`MOBILE_WEB_API_PARITY_REPORT.md`](./MOBILE_WEB_API_PARITY_REPORT.md). Các nội dung bên dưới chỉ mô tả trạng thái khi kiểm kê.

**Ghi chú cập nhật:** các nhận định lịch sử trong bảng không phải trạng thái hiện tại. Source hiện đã có API cập nhật hồ sơ/đổi mật khẩu, kết quả kiểm tra từ `full-detail`, trạng thái thanh toán tổng thể, và form hồ sơ xếp số điện thoại theo cột trên màn hình hẹp. Xem báo cáo API hiện tại ở trên; các mục chưa xác minh staging/native vẫn được ghi rõ tại đó.

## Nguồn web đã đối chiếu

- `client/src/components/student/StudentOverviewTab.jsx`
- `client/src/components/student/StudentScheduleView.jsx`
- `client/src/components/student/StudentWeeklyScheduleGrid.jsx`
- `client/src/components/student/StudentMaterialsView.jsx`
- `client/src/components/student/StudentQuizList.jsx`
- `client/src/components/student/StudentEvaluationView.jsx`
- `client/src/components/student/StudentProfileTab.jsx`
- `client/src/components/student/lessonPractice/LessonPracticeCatalogPage.jsx`
- `client/src/components/NewsPage.jsx`
- `client/src/components/Inbox.jsx`
- Student routes and screen selection in `client/src/App.jsx` and `client/src/components/StudentDashboard.jsx`

## Student screen parity

| Web function | Mobile screen | Status | Notes |
|---|---|---|---|
| Tổng quan học viên | Home | CHƯA ĐỦ | Bám lời chào, buổi học gần nhất, giảng viên, KPI, việc cần làm, thông báo và lối tắt. Số liệu đều là mock; thiếu dữ liệu enrollment runtime. |
| Hộp thư | Messages / Conversation | CHƯA ĐỦ | Có tìm kiếm, phân loại, hội thoại, bubble và thao tác local. Không có realtime/read state/file thật hoặc đồng bộ web. |
| Khóa đã đăng ký, tự học video, bài học | StudentLearning / LearningLesson | CHƯA ĐỦ | Có bộ lọc, khóa, units, lessons, tiến độ và lesson placeholder; chưa có phát video, LMS gate hay tiến độ server. |
| Lịch học, lịch tuần, nhật ký học | Schedule | CHƯA ĐỦ | Có KPI buổi, bộ lọc tuần/ngày, card buổi học, detail, xác nhận local và nhật ký mock. Chưa phản ánh ghi chú, đánh giá buổi học và trạng thái từ web. |
| Tài liệu, video, bài tập, quiz, đánh giá | Materials / Assignments / StudentExam / Evaluations | CHƯA ĐỦ | Tài liệu và video có mock list; các category còn lại điều hướng tới màn tương ứng. File, nộp bài và feedback không gửi đi. |
| Điểm/kết quả học tập | Grades / StudentExam | CHƯA ĐỦ | Có tiến độ bài học; điểm thi chính thức, lịch sử thi và báo cáo vẫn trên web. |
| Thi/chứng chỉ/MOS/IC3 | StudentExam (menu) | WEB-ONLY TẠM THỜI | Có inventory/menu và thông báo tiếp tục trên website. Không có attempt, camera, proctoring, screen capture, fullscreen hoặc kết quả chính thức trên mobile. |
| Bảng tin | Feed | CHƯA ĐỦ | Bài viết, reaction và bình luận đồng bộ API; upload ảnh chưa hỗ trợ. |
| Tin tức/chi tiết | News / NewsDetail | CHƯA ĐỦ | Danh sách, chi tiết và liên kết tệp đọc từ Blog API; nội dung HTML phong phú và thumbnail chưa được hiển thị đầy đủ. |
| Đánh giá giảng viên | Evaluations | CHƯA ĐỦ | Đọc điều kiện, phản hồi riêng đã gửi, đánh giá công khai đã có và khóa cuối khóa từ API; gửi/sửa phản hồi và đánh giá qua API. |
| Thông tin Trung tâm | CenterInfo | CHƯA ĐỦ | Tổng quan và các mục đã xuất bản đọc từ API; bố cục chi tiết/đa phương tiện chưa đầy đủ. |
| Hồ sơ/cập nhật/học phí | Profile / Tuition | CHƯA ĐỦ | Profile đã bổ sung KPI, thông tin cá nhân, tóm tắt học tập/tiến độ khóa, tình trạng học phí và trạng thái rỗng đơn hàng video; QA responsive không thấy tràn ngang ở 320–768 px. Dữ liệu thanh toán/đơn hàng và cập nhật chính thức không kết nối; screenshot parity chưa xác nhận. |
| Thông báo | Notifications | CHƯA ĐỦ | Có loại, lọc, chi tiết, đọc/ẩn local, điều hướng mock và phân trang 20 mục. QA fixture 25 mục đã kiểm tra Trang 1/2 và responsive 320–768 px; trạng thái/đích thực tế không đồng bộ. |

**WEB-ONLY TẠM THỜI:** lượt thi/chứng chỉ và các luồng cần camera, chống gian lận, screen capture hoặc fullscreen. Quiz một câu hỏi trong app chỉ là fixture UI tĩnh để kiểm tra tương tác, không phải chức năng thi hoặc attempt.

## Thay đổi Student trong lượt này

- Student Home giữ thứ tự thông tin chính: lịch gần nhất, KPI học tập, việc cần làm, thông báo và quick actions. Điểm trung bình chưa có fixture sẽ hiển thị `—` thay vì giả định bằng 0.
- Bài học có bộ lọc khóa đăng ký/tự học video; card giữ cấu trúc khóa, môn/phần mềm, tiến độ, units và lessons.
- Thêm màn Phòng thi chỉ để giữ đường truy cập và ghi rõ phần chứng chỉ/điểm chính thức tiếp tục trên website; câu hỏi mẫu không lưu kết quả.
- Lịch học bổ sung KPI và khu vực nhật ký học tập, vẫn dùng fixture hiện có.
- Tài liệu học tập có lựa chọn tài liệu/video và đường điều hướng tới bài tập, trắc nghiệm, đánh giá, phần mềm.
- Thông báo có chi tiết và mark-read local.
- Đánh giá công khai hiển thị trạng thái đã gửi và điểm sao demo tính theo đúng điểm tiêu chí source web; QA thêm trạng thái đã đánh giá có thể sửa, chưa đủ điều kiện và khóa sau khi kết thúc. Trạng thái server vẫn không đồng bộ.
- Kiểm kê từng màn hình Student/Teacher, bao gồm màn thiếu và WEB-ONLY, được ghi trong [`MOBILE_PARITY_SCREEN_MATRIX.md`](./MOBILE_PARITY_SCREEN_MATRIX.md).
- Cập nhật parity table trong `MOBILE_UI_PHASE1.md`; giữ nguyên Teacher tabs và các màn Teacher hiện có.

## UI/QA issues addressed

- Student Home previously displayed a missing average grade as `0`; it now displays `—` when mock data has no grade.
- Schedule summary cards and the learning-log empty state no longer present zero/empty values while schedule data is still loading.
- The new local quiz screen was wired to its stack route and the Expo Web bundle was checked after fixing a duplicate import detected by Metro.

## Chức năng mobile-only

Không bổ sung module nghiệp vụ mới. Các thay đổi chỉ là cách trình bày mobile hoặc fixture tương tác cục bộ. Xác nhận lịch, gửi quiz mẫu, thay đổi trạng thái thông báo, nộp/chấm bài demo, comment/reaction và chỉnh sửa hồ sơ đều không lưu server và không thay đổi dữ liệu website.

## QA và giới hạn

- `npm run typecheck`: PASS.
- `npx expo install --check`: PASS — dependencies hiện tại tương thích; không đổi package.
- `git diff --check`: PASS.
- Expo Web smoke: PASS cho Student login demo, Home, danh mục khóa/bộ lọc video, quiz fixture, lịch, category video và chi tiết thông báo; không ghi nhận page/console errors trong lần smoke sau khi sửa.
- Kiểm tra không tràn ngang trên viewport 320, 375, 390, 430 và 768 px: PASS trong màn quiz fixture.
- Android native: NOT RUN (không khẳng định PASS).
- iOS native: NOT RUN (môi trường Windows).
- Bàn phím native, status/navigation bar và safe-area native: NOT RUN; Expo Web không thay thế kiểm thử thiết bị.
- Dependency audit hoặc cập nhật package không thuộc lượt parity này; không cài/nâng package.

## Backend boundary

Không thêm lời gọi HTTP/fetch tới backend, production API URL, auth token/refresh token, Socket.IO, push, payment, upload, camera hoặc exam attempt. Website, backend, database, `.env` và authentication hiện tại không bị sửa trong lượt Student UI này.

## Kết luận

Student UI có thêm parity ở nội dung và đường đi giữa các màn hình, nhưng đây vẫn là prototype mock. Chưa kết luận app sẵn sàng tích hợp backend hay production. Native Android/iOS cần kiểm tra riêng trên simulator/thiết bị trước khi nghiệm thu.
