# Báo cáo đồng bộ Mobile và Web

## Phạm vi

- Vai trò trong ứng dụng mobile: học viên và giảng viên.
- Không đưa quản trị viên vào ứng dụng mobile.
- Bài thi/chứng nhận có giám sát và kiểm tra đầu vào/onboarding giảng viên tiếp tục thực hiện trên website.
- Giao diện mobile dùng bố cục native thích ứng màn hình nhỏ; mục tiêu là đồng bộ luồng, nội dung, trạng thái và API, không sao chép bố cục desktop theo pixel.

## Kết luận hiện tại

**Trạng thái tổng thể: PARTIAL.** Mobile đã có các màn hình cho phần lớn luồng học viên/giảng viên, nhưng chưa đồng bộ đầy đủ giao diện, nghiệp vụ và nguồn dữ liệu với Web. Bản cập nhật đã đưa đăng nhập, quản lý phiên, lịch, thông báo, hồ sơ học viên, đơn hàng video và một phần bài tập vào API thật; các luồng còn lại cần tiếp tục tích hợp theo từng nhóm chức năng.

| Nhóm chức năng | Trạng thái UI so với Web | Nguồn dữ liệu mobile hiện tại | Ghi chú |
|---|---|---|---|
| Đăng nhập và phiên | PARTIAL | API thật | Đăng nhập học viên/giảng viên, lưu token bằng SecureStore, refresh một lần đồng thời, logout/revoke phiên và đổi mật khẩu. Chưa xác minh trên backend đang chạy. |
| Tổng quan học viên/giảng viên | PARTIAL | API thật + MOCK | Dashboard học viên đã đồng bộ thứ tự/chủ đề chính, bốn thẻ việc cần làm, panel tài liệu và nhật ký theo Web; dữ liệu học tập/trắc nghiệm vẫn còn một phần là mock. Tổng đã nhận trên dashboard giảng viên lấy từ API tài chính; các KPI khác và dữ liệu tổng hợp chưa khớp hoàn toàn với Web. |
| Lịch học/lịch dạy | PARTIAL | API thật | Đọc `/api/schedules` theo quyền của bearer token; không lấy ID/token từ biến môi trường và không fallback im lặng sang dữ liệu mẫu. Các thao tác lịch/điểm danh cần đối chiếu thêm. |
| Thông báo | PARTIAL | API thật | Đọc danh sách, đánh dấu đã đọc và ẩn thông báo qua REST API. Phân trang hiện tải tối đa 100 bản ghi mỗi lần. |
| Tin nhắn/hộp thư | PARTIAL | API thật + MOCK preview | Hộp thư/tin nhắn chữ và sticker đồng bộ qua API; Socket.IO xác thực bằng access token cập nhật hội thoại, hiện diện, nhóm mới và trạng thái kết nối. Hỗ trợ tạo/liệt kê nhóm cho giảng viên, gửi ảnh/tệp qua bộ chọn native và tải lên API (tối đa 50 MB), xem ảnh/liên kết tệp. Polling chậm là phương án dự phòng; preview vẫn dùng fixture. Thao tác thu hồi/ghim/reaction, trạng thái chưa đọc nhóm và một số quản lý thành viên chưa đồng bộ đầy đủ. |
| Hồ sơ, khóa học và học phí học viên | PARTIAL | API thật + MOCK | Hồ sơ, enrollment, đơn hàng video và học phí đọc từ API. Thông tin mobile chỉ xem; cập nhật hồ sơ/thanh toán tiếp tục trên Web, không còn nút lưu hoặc xác nhận giao dịch giả. |
| Bài tập học viên/giảng viên | PARTIAL | API thật | Học viên tải bài và nộp URL; giảng viên xem roster, giao bài cho cả lớp/học viên (tạo từng bài theo từng học viên), mở liên kết bài nộp và chấm điểm qua API. Chưa hỗ trợ upload file native. |
| Bài học và Video khóa học | PARTIAL | API thật + MOCK preview | Tab Video khóa học dùng catalog `/api/lesson-practice/my/subjects`, bộ lọc/nhóm khóa, thẻ khóa học, tiến độ, môn/buổi học và chi tiết video/nội dung. Phần giải thích loại khóa hiện khi rê chuột trên Web preview hoặc bấm nút thông tin trên mobile. Preview vẫn dùng dữ liệu mẫu; video mở bằng trình phát ngoài ứng dụng. Chưa có luồng checkout native, player/anti-seek như Web hoặc đồng bộ tiến độ sau khi xem. |
| Tài liệu, kết quả học tập | PARTIAL | API thật + MOCK preview | Tài liệu/phần mềm lấy theo vai trò từ training data API; tệp/link có URL được mở trực tiếp. Điểm bài tập đã chấm lấy từ API bài tập. Điểm quiz/thi chính thức chưa đồng bộ; thi/chứng chỉ có giám sát vẫn ở Web. |
| Đánh giá | PARTIAL | API thật + MOCK preview | Tải đánh giá riêng theo học viên, đánh giá đã có của giảng viên, điều kiện đủ nửa khóa và khóa cuối khóa; gửi/sửa phản hồi Trung tâm và đánh giá giảng viên qua API. Preview dùng fixture; chưa có kiểm thử backend staging. |
| Bảng tin | PARTIAL | API thật + MOCK preview | Đọc/đăng/sửa/xóa bài, reaction và bình luận qua API; ảnh chưa upload được. Preview tiếp tục dùng fixture. |
| Tin tức và chi tiết | PARTIAL | API thật + MOCK preview | Đọc tin theo vai trò, chi tiết và tệp đính kèm từ Blog API; chưa đồng bộ đầy đủ hình ảnh thumbnail/HTML phong phú. Preview tiếp tục dùng fixture. |
| Thông tin Trung tâm | PARTIAL | API thật + MOCK preview | Đọc tổng quan và các mục đã công bố từ `/api/center-info`; mục chưa xuất bản báo trạng thái lỗi/rỗng rõ ràng. |
| Hồ sơ giảng viên | PARTIAL | API thật | Đọc hồ sơ qua `/api/teachers/:id`; giảng viên có thể cập nhật email, Zalo, tuổi, địa chỉ, giới thiệu, giọng và thông tin ngân hàng bằng endpoint tự sửa. Thông tin chuyên môn/trạng thái do trung tâm quản lý. |
| Đào tạo giảng viên | PARTIAL | API thật + MOCK | Khóa đào tạo, tiến độ, bài học, tài liệu và thông báo đọc từ `/api/training-lms/teacher/overview`; danh sách phần mềm lấy từ training data API theo vai trò và mở liên kết thật. Một số thao tác học tập vẫn chưa đồng bộ đầy đủ. |
| Tài chính giảng viên | PARTIAL | API thật | Hiển thị tổng buổi, số tiền đã/chưa nhận, lương/buổi và các buổi dạy còn chờ từ API tự xem. Lịch sử giao dịch đã nhận và xuất báo cáo chưa có API mobile. |
| Thi/chứng nhận và onboarding giám sát | WEB-ONLY | Web | Giữ ngoài phạm vi native theo yêu cầu; mobile không giả lập bài thi hoặc luồng giám sát. |
| Admin/staff | OUT OF SCOPE | Không có màn hình mobile | Giữ chức năng quản trị trên Web. |

## API và cấu hình

Mobile gọi chung backend Web qua các API:

- `GET /api/auth/csrf-token`
- `GET /api/messages/contacts`, `/api/messages/conversations/:userId`, `/api/messages/:conversationId`
- `PUT /api/messages/read/:conversationId`, `POST /api/messages`
- `POST /api/messages/upload`
- `GET /api/messages/groups/user/:userId`, `POST /api/messages/groups`
- Socket.IO events `message:receive`, `message:sent`, `users:online`, `group:new`, `group:deleted`
- `POST /api/auth/login/mobile`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `GET /api/schedules`
- `GET /api/notifications`
- `PUT /api/notifications/mark-read`
- `DELETE /api/notifications/:id`
- `GET /api/students/:id/full-detail` (hồ sơ học viên của chính tài khoản)
- `GET /api/training-lms/video-purchases`
- `GET /api/assignments/student/:studentId/course/:courseId`
- `GET /api/assignments/course/:courseId` (danh sách giao bài và bài nộp dành cho giảng viên)
- `GET /api/students?page=1&limit=250` (roster học viên được phân công)
- `POST /api/assignments`
- `PUT /api/assignments/submissions/:submissionId/grade`
- `POST /api/assignments/:id/submit` (gửi URL bài làm; upload tệp native chưa hỗ trợ)
- `GET /api/blog/posts?page=1&limit=40`, `/api/blog/posts/:id`
- `GET /api/center-info`
- `GET /api/settings/student-training-data` (tài liệu/phần mềm học viên)
- `GET /api/settings/training-data` (tài liệu/phần mềm giảng viên)
- `GET /api/evaluations/mine`
- `GET /api/evaluations/teacher/:teacherId`
- `POST /api/evaluations`
- `GET /api/lesson-practice/my/subjects`
- `GET /api/lesson-practice/my/subjects/:subjectId/units?courseId=:courseId`
- `GET /api/lesson-practice/my/units/:unitId`
- `GET /api/teachers/:id` (hồ sơ của chính giảng viên)
- `GET /api/teachers/:id/finance`
- `GET /api/teachers/:id/finance/pending`
- `GET /api/training-lms/teacher/overview`

Đặt `EXPO_PUBLIC_MOBILE_API_BASE_URL` là origin của backend, không kèm `/api`. Android emulator thường dùng `http://10.0.2.2:8081`; iOS simulator thường dùng `http://localhost:8081`; thiết bị thật cần URL LAN hoặc HTTPS truy cập được từ thiết bị.

**Lưu ý triển khai:** backend đặt `MOBILE_MULTI_SESSION_AUTH=false` mặc định. Khi cờ tắt, đăng nhập mobile trả `MOBILE_SESSION_AUTH_DISABLED`. Không tự bật cờ này; chỉ bật sau khi hoàn tất kiểm tra staging, MongoDB/Redis và xác nhận cấu hình bảo mật.

## Việc còn lại để đạt parity

1. Hoàn thiện luồng video khóa học với player native, ghi nhận tiến độ sau khi xem và checkout; tiếp tục đồng bộ dashboard và hồ sơ giảng viên.
2. Bổ sung upload tệp bài tập native, tài liệu và điểm quiz đủ phạm vi; xác minh quyền và trạng thái nghiệp vụ.
3. Hoàn thiện các thao tác tin nhắn còn thiếu (thu hồi/ghim/reaction, trạng thái chưa đọc nhóm) và xác minh Socket.IO/mobile session trên staging.
4. Hoàn thiện ảnh bảng tin, tin tức, LMS giảng viên và lịch sử tài chính.
5. Đối chiếu lại từng màn hình với Web hiện tại, rồi kiểm tra trên Android/iOS và API staging.

Chưa có kết quả chạy native Android/iOS hoặc kiểm thử end-to-end với backend thật trong thay đổi này. TypeScript check chỉ xác minh biên dịch, không xác nhận kết nối máy chủ hay parity runtime.
