# Báo cáo đồng bộ Mobile và Web

## Phạm vi

- Vai trò trong ứng dụng mobile: học viên và giảng viên.
- Không đưa quản trị viên vào ứng dụng mobile.
- Bài thi/chứng nhận có giám sát và kiểm tra đầu vào/onboarding giảng viên tiếp tục thực hiện trên website.
- Giao diện mobile dùng bố cục native thích ứng màn hình nhỏ; mục tiêu là đồng bộ luồng, nội dung, trạng thái và API, không sao chép bố cục desktop theo pixel.

## Kết luận hiện tại

**Trạng thái tổng thể: PARTIAL.** Mobile đã có các màn hình cho phần lớn luồng học viên/giảng viên, nhưng chưa đồng bộ đầy đủ giao diện, nghiệp vụ và nguồn dữ liệu với Web. Đợt rà soát giảng viên nối quản lý quiz, danh sách học viên được phân công, cập nhật ghi chú/điểm/link lớp, tiến độ đào tạo và lịch sử giao dịch vào API thật. Chưa xác minh runtime trên backend staging hoặc Android/iOS.

| Nhóm chức năng | Trạng thái UI so với Web | Nguồn dữ liệu mobile hiện tại | Ghi chú |
|---|---|---|---|
| Đăng nhập và phiên | PARTIAL | API thật | Đăng nhập học viên/giảng viên, lưu token bằng SecureStore, refresh một lần đồng thời, logout/revoke phiên và đổi mật khẩu. Chưa xác minh trên backend đang chạy. |
| Tổng quan học viên/giảng viên | PARTIAL | API thật + MOCK preview | Dashboard học viên đã đồng bộ thứ tự/chủ đề chính, bốn thẻ việc cần làm, panel tài liệu và nhật ký theo Web; hồ sơ, bài tập, quiz và hoạt động đánh giá tải qua API thật. Preview dùng fixture; một số KPI/tổng hợp vẫn cần đối chiếu thêm với Web. Tổng đã nhận trên dashboard giảng viên lấy từ API tài chính; các KPI khác và dữ liệu tổng hợp chưa khớp hoàn toàn với Web. |
| Lịch học/lịch dạy | PARTIAL | API thật | Đọc `/api/schedules` theo bearer token; tuần có lọc trạng thái/khóa học, tìm tên, sắp xếp giờ theo từng ngày và chạm ô để xếp/sửa lịch. Lịch tháng có chọn ngày và giữ thao tác điểm danh/sửa/hủy; nút điểm danh bị khóa trước 15 phút kể từ giờ bắt đầu, nút hủy chỉ hiện trong cửa sổ điểm danh; nhật ký dùng cùng điều kiện. Nhật ký hỗ trợ lọc ngày/tuần/tháng và trạng thái. Xếp lịch dùng `POST /api/schedules`, sửa dùng `PUT /api/schedules/:scheduleId`, điểm danh dùng `PUT /api/schedules/:scheduleId` với trạng thái `completed`, hủy có lý do dùng `PATCH /api/schedules/:scheduleId/cancel`; phản hồi điểm danh học viên dùng `POST /api/schedules/:scheduleId/student-confirm`. Socket.IO và tải lại khi mở màn hình đồng bộ thay đổi lịch. Ghi chú học viên được tách khỏi ghi chú lịch. Đã kiểm tra khớp endpoint/handler bằng test tích hợp và xác nhận API local phản hồi (401 khi không có phiên); chưa chạy thao tác ghi với phiên đăng nhập hoặc kiểm thử API staging/thiết bị. |
| Thông báo | PARTIAL | API thật + MOCK preview | Đọc danh sách theo phân trang máy chủ (`page`/`limit`), dùng metadata `unread` để hiển thị thao tác đọc tất cả và chống lặp theo ID. Chuông có badge đọc từ `/api/notifications/count`, được làm mới khi mở màn hình/quay lại ứng dụng, khi Socket.IO nhận `RECEIVE_NOTIFICATION`/`new-notification`, và sau thao tác đọc/ẩn; hỗ trợ kéo xuống để tải lại. Thông báo bài tập, lịch, trắc nghiệm và tin nhắn điều hướng tới đúng nội dung theo ID; bài trắc nghiệm được đưa lên đầu danh sách và làm nổi bật, không tự khởi động bộ đếm giờ. Chi tiết hỏi đáp LMS, đánh giá dành cho giảng viên và một số luồng thi tiếp tục mở trên Web. Preview/QA vẫn dùng fixture, không gọi API thật. Chưa xác minh runtime Android/iOS hoặc staging. |
| Tin nhắn/hộp thư | PARTIAL | API thật + MOCK preview | Hộp thư/tin nhắn chữ và sticker đồng bộ qua API; Socket.IO xác thực bằng access token cập nhật hội thoại, hiện diện, nhóm mới và trạng thái kết nối. Hỗ trợ tạo/liệt kê nhóm cho giảng viên, gửi ảnh/tệp qua bộ chọn native và tải lên API (tối đa 50 MB), xem ảnh/liên kết tệp. Polling chậm là phương án dự phòng; preview vẫn dùng fixture. Thao tác thu hồi/ghim/reaction, trạng thái chưa đọc nhóm và một số quản lý thành viên chưa đồng bộ đầy đủ. |
| Hồ sơ, khóa học và học phí học viên | PARTIAL | API thật + MOCK | Hồ sơ và enrollment đọc từ API; học viên có thể cập nhật email, Zalo, địa chỉ, giới tính và đổi mật khẩu qua API. Tên/SĐT đăng nhập cần Admin hỗ trợ. Học phí theo enrollment và đơn hàng video đọc riêng; trạng thái thanh toán tổng thể đọc từ `/api/webhooks/payment-status/:studentId`, không phải lịch sử hóa đơn hay khoản đã phân bổ theo khóa. Thanh toán/xác nhận giao dịch vẫn thực hiện trên Web. |
| Bài tập học viên/giảng viên | PARTIAL | API thật | Học viên tải bài, chọn tệp native hoặc nhập URL để nộp; tệp được tải lên `/api/assignments/upload`, sau đó liên kết được gửi qua API nộp bài. Giảng viên xem roster, giao bài cho cả lớp/học viên (tạo từng bài theo từng học viên), mở liên kết bài nộp và chấm điểm qua API. Mobile và Web tải lại danh sách theo focus/Socket.IO khi bài tập, bài nộp hoặc điểm thay đổi. |
| Học viên được phân công (giảng viên) | PARTIAL | API thật + MOCK preview | Danh sách phân trang, tìm theo tên/SĐT/Zalo/khóa học, lọc trạng thái, avatar và hiện diện Socket.IO; hồ sơ mobile chia tab Tổng quan, Điểm danh, Kết quả và Cập nhật. Hồ sơ chi tiết đọc lịch sử buổi học/kết quả thi từ `GET /api/students/:id/full-detail`; điểm, ghi chú và link lớp lưu theo khóa qua `PUT /api/students/:id`; đánh trượt học viên được mở khóa qua `PUT /api/students/:id/lock-exam`. Tải lại khi mở màn hình và nhận sự kiện học viên/lịch. Quản lý lịch bù và chỉnh sửa lịch đầy đủ vẫn tiếp tục trên Web. |
| Quiz giảng viên | PARTIAL | API thật + MOCK preview | Tải, tạo, xóa, sinh câu hỏi AI và xem bài nộp/kết quả qua API; hỗ trợ giao theo khóa/cả lớp hoặc chọn học viên. AI yêu cầu tên bài làm prompt, có thể bổ sung chủ đề; thời lượng giới hạn 1–180 phút. Nhập Excel, tải mẫu và xuất ngân hàng câu hỏi hoạt động trên mobile; câu hỏi chỉ được lưu/chia sẻ sau khi tạo bài qua API. Socket.IO `quiz:changed` và `quiz:submitted` đồng bộ danh sách/kết quả giữa mobile và Web. Chế độ preview chỉ dùng fixture và chặn ghi dữ liệu thật; chưa kiểm thử API staging. |
| Bài học và Video khóa học | PARTIAL | API thật + MOCK preview | Tab Video khóa học và mục “Bài học” dùng chung catalog `/api/lesson-practice/my/subjects`, bộ lọc/nhóm khóa, thẻ khóa học, tiến độ, môn/buổi học và chi tiết video/nội dung. Các thao tác nội dung bài học dùng API lesson-practice; preview vẫn dùng dữ liệu mẫu. Phần giải thích loại khóa hiện khi rê chuột trên Web preview hoặc bấm nút thông tin trên mobile; video mở bằng trình phát ngoài ứng dụng. Checkout native và một số hành vi player/anti-seek vẫn thuộc Web. |
| Tài liệu, kết quả học tập | PARTIAL | API thật + MOCK preview | Tài liệu/phần mềm lấy theo vai trò từ training data API; tệp/link có URL được mở trực tiếp. Nhật ký điểm ghép bài tập đã chấm, quiz đã nộp và `data.examResults` từ `/api/students/:id/full-detail`; điểm thi giữ số câu trắc nghiệm và điểm tự luận theo dữ liệu gốc. Backend không lọc `examResults` theo `type`, nên mobile gọi chúng là “Kết quả kiểm tra”, không khẳng định tất cả là kỳ thi/chứng chỉ chính thức. Thi/chứng chỉ có giám sát vẫn ở Web. |
| Đánh giá | PARTIAL | API thật + MOCK preview | Tải đánh giá riêng theo học viên, đánh giá đã có của giảng viên, điều kiện đủ nửa khóa và khóa cuối khóa; gửi/sửa phản hồi Trung tâm và đánh giá giảng viên qua API. Preview dùng fixture; chưa có kiểm thử backend staging. |
| Bảng tin | PARTIAL | API thật + MOCK preview | Đọc/đăng/sửa/xóa bài, reaction và bình luận qua API; ảnh đính kèm được tải lên API trước khi đăng. Preview tiếp tục dùng fixture. |
| Tin tức và chi tiết | PARTIAL | API thật + MOCK preview | Đọc tin theo vai trò, chi tiết và tệp đính kèm từ Blog API; chưa đồng bộ đầy đủ hình ảnh thumbnail/HTML phong phú. Preview tiếp tục dùng fixture. |
| Thông tin Trung tâm | PARTIAL | API thật + MOCK preview | Đọc tổng quan và các mục đã công bố từ `/api/center-info`; mục chưa xuất bản báo trạng thái lỗi/rỗng rõ ràng. |
| Hồ sơ giảng viên | PARTIAL | API thật | Đọc hồ sơ qua `/api/teachers/:id`; giảng viên có thể cập nhật email, Zalo, tuổi, địa chỉ, giới thiệu, giọng và thông tin ngân hàng bằng endpoint tự sửa. Thông tin chuyên môn/trạng thái do trung tâm quản lý. |
| Đào tạo giảng viên | PARTIAL | API thật + MOCK preview | Khóa học và tiến độ lấy từ `/api/training-lms/teacher/overview`; bài học hỗ trợ phát video YouTube, Vimeo và tệp video trực tiếp trong ứng dụng, lưu thời gian xem định kỳ và xác nhận hoàn thành qua API. Backend kiểm tra khóa/bài học, quyền chuyên môn, thời lượng xem và thứ tự bài. Liên kết video không hỗ trợ phát nội bộ vẫn mở ngoài ứng dụng và không ghi nhận tiến độ. Danh sách phần mềm lấy từ training data API theo vai trò; chưa kiểm thử Android/iOS hoặc staging. |
| Tài chính giảng viên | PARTIAL | API thật + MOCK preview | Hiển thị tổng buổi, số tiền đã/chưa nhận, lương/buổi, lịch sử giao dịch và chi tiết phân bổ theo học viên; xuất Excel theo tháng gồm học viên, khóa học, ngày dạy, số buổi, tiền/buổi, tổng từng học viên và tổng toàn bộ. Làm mới khi mở màn hình hoặc nhận sự kiện tài chính realtime. |
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
- `POST /api/schedules`, `PUT /api/schedules/:scheduleId`
- `PATCH /api/schedules/:scheduleId/cancel`, `POST /api/schedules/:scheduleId/student-confirm`
- `GET /api/notifications`
- `GET /api/notifications/count`
- `PUT /api/notifications/mark-read`
- `DELETE /api/notifications/:id`
- `GET /api/students/:id/full-detail` (hồ sơ học viên của chính tài khoản)
- `GET /api/webhooks/payment-status/:studentId` (trạng thái thanh toán tổng thể của học viên)
- `GET /api/training-lms/video-purchases`
- `GET /api/assignments/student/:studentId/course/:courseId`
- `GET /api/assignments/course/:courseId` (danh sách giao bài và bài nộp dành cho giảng viên)
- `GET /api/students?page=1&limit=250` (roster học viên được phân công)
- `POST /api/assignments`
- `POST /api/assignments/upload`
- `PUT /api/assignments/submissions/:submissionId/grade`
- `POST /api/assignments/:id/submit` (gửi bài làm sau khi tệp native được tải lên API)
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
- `GET /api/transactions/teacher/:teacherId`
- `GET /api/training-lms/teacher/overview`
- `GET /api/quizzes/teacher`
- `POST /api/quizzes/create`
- `POST /api/quizzes/generate-ai`
- `DELETE /api/quizzes/:id`
- Socket.IO `quiz:changed` (đồng bộ khi tạo/xóa quiz), `quiz:submitted` (tải lại kết quả)
- `PUT /api/students/:id` (cập nhật ghi chú, điểm trung bình hoặc link vào lớp theo `courseName`)
- `PUT /api/students/:id/lock-exam` (giảng viên phụ trách khóa phòng thi học viên đã được mở)
- Socket.IO `quiz:submitted` (tải lại danh sách kết quả quiz)

Đặt `EXPO_PUBLIC_MOBILE_API_BASE_URL` là origin của backend, không kèm `/api`. Android emulator thường dùng `http://10.0.2.2:8081`; iOS simulator thường dùng `http://localhost:8081`; thiết bị thật cần URL LAN hoặc HTTPS truy cập được từ thiết bị.

**Lưu ý triển khai:** backend đặt `MOBILE_MULTI_SESSION_AUTH=false` mặc định. Khi cờ tắt, đăng nhập mobile trả `MOBILE_SESSION_AUTH_DISABLED`. Không tự bật cờ này; chỉ bật sau khi hoàn tất kiểm tra staging, MongoDB/Redis và xác nhận cấu hình bảo mật.

## Việc còn lại để đạt parity

1. Hoàn thiện luồng video khóa học với player native, ghi nhận tiến độ sau khi xem và checkout; tiếp tục đồng bộ dashboard và hồ sơ giảng viên.
2. Xác minh quyền và trạng thái điểm, học phí và nghiệp vụ trên backend staging; kết quả `examResults` từ full-detail chưa được chứng nhận là chỉ chứa kỳ thi chính thức.
3. Hoàn thiện các thao tác tin nhắn còn thiếu (thu hồi/ghim/reaction, trạng thái chưa đọc nhóm) và xác minh Socket.IO/mobile session trên staging.
4. Hoàn thiện ảnh bảng tin, LMS giảng viên (phát video/ghi nhận tiến độ) và lịch sử tài chính.
5. Đối chiếu các hành động chi tiết giảng viên còn thiếu với Web, rồi kiểm tra trên Android/iOS và API staging.

Chưa có kết quả chạy native Android/iOS hoặc kiểm thử end-to-end với backend thật trong thay đổi này. TypeScript check chỉ xác minh biên dịch, không xác nhận kết nối máy chủ hay parity runtime.

## Rà soát phía giảng viên — 02/11/2026

| Screen / function | API thật đang dùng | Mobile status |
|---|---|---|
| Đăng nhập / phiên | `POST /api/auth/login/mobile`, `POST /api/auth/refresh`, `POST /api/auth/logout`; token và `sessionId` được lưu qua API client, request gửi bearer token và refresh khi nhận 401. Socket.IO xác thực bằng access token. | CONNECTED trong source; chưa xác minh staging/native. |
| Tổng quan | Ghép dữ liệu lịch, bài tập, danh sách học viên, tin nhắn, giao dịch và đánh giá từ các service hiện có; không có endpoint dashboard riêng. | PARTIAL — API thật, một số KPI được tính ở mobile; preview QA dùng fixture. |
| Lịch dạy / điểm danh | `GET /api/schedules?limit=500`; `POST /api/schedules`, `PUT /api/schedules/:scheduleId`, `PATCH /api/schedules/:scheduleId/cancel`. Backend giới hạn dữ liệu theo giảng viên đăng nhập. | CONNECTED trong source; các thao tác ghi chưa kiểm tra trên staging. |
| Học viên / chi tiết | `GET /api/students?page=1&limit=250` (lấy tiếp các trang), `GET /api/students/:id/full-detail`, `PUT /api/students/:id`, `PUT /api/students/:id/lock-exam`. | CONNECTED trong source; preview QA dùng fixture. |
| Hộp thư / hội thoại | `GET /api/messages/contacts`, `/conversations/:userId`, `/groups/user/:userId`, `GET /api/messages/:conversationId`, `POST /api/messages`, `PUT /api/messages/read/:conversationId`; Socket.IO cho tin nhắn, typing, presence, read acknowledgement và nhóm. | CONNECTED trong source; một số chức năng chat nâng cao còn PARTIAL theo bảng trên. |
| Hồ sơ / đổi mật khẩu | `GET` và `PUT /api/teachers/:id`, `POST /api/auth/change-password`; cập nhật avatar qua API upload hiện có. | CONNECTED trong source; chưa xác minh thao tác ghi trên staging/native. |
| Giao diện giảng viên | Đã kiểm tra luồng dashboard, lịch, hồ sơ, hộp thư/hội thoại và quản lý học viên ở Expo Web QA. Không phát hiện tràn chiều ngang toàn trang ở hộp thư/hội thoại tại 320, 360, 375, 390, 412, 430 px; các màn khác được xem tại 320 px. Form hồ sơ giảng viên chuyển các hàng nhập thành một cột dưới 380 px; form đổi mật khẩu có vùng cuộn. | PARTIAL — chưa kiểm tra thiết bị Android/iOS, bàn phím native hoặc so ảnh đầy đủ với Web. |

`.env` thực tế không có trong thư mục mobile; `.env.example` để trống `EXPO_PUBLIC_MOBILE_API_BASE_URL`. Expo Web development mặc định gọi `http://localhost:5000`; build/native cần origin backend có thể truy cập. Không bật `MOBILE_MULTI_SESSION_AUTH` trong lần rà soát này.

## Cập nhật rà soát Student hiện tại

- Ở màn Điểm số, dữ liệu điểm đã chấm từ bài tập và quiz hiện được ghép thêm với `data.examResults`. Trường `type` không được backend dùng để giới hạn truy vấn; các bản ghi được gắn nhãn trung tính “Kết quả kiểm tra”.
- Màn Học phí gọi `GET /api/webhooks/payment-status/:studentId` và hiển thị `paid`, `paidAmount`, `paidAt` dưới nhãn trạng thái tổng thể. Endpoint này không thay thế dữ liệu enrollment hoặc lịch sử hóa đơn; hóa đơn trong full-detail cũng không được hiển thị như lịch sử thanh toán ở Student Web.
- Hồ sơ Student có thể cập nhật email, số điện thoại liên hệ thứ hai, địa chỉ và giới tính; tên/SĐT đăng nhập không tự sửa được. Đổi mật khẩu dùng API xác thực hiện có.
- QA Expo Web xác nhận form hồ sơ xếp số điện thoại thành cột ở 320–412 px và hiển thị cạnh nhau từ 430 px; bàn phím native, Android/iOS và API staging chưa được xác minh.

**Xác minh lần cập nhật này:** `npm run typecheck` đạt; `npx expo export --platform web` tạo bundle thành công; `node --test tests/integration/mobile_schedule_sync.test.js` đạt 5/5; `git diff --check` không báo lỗi. QA responsive trên Expo Web được ghi ở bảng trên. Chưa chạy xác thực động với MongoDB/Redis/backend staging, thao tác API có phiên đăng nhập hoặc kiểm tra native Android/iOS.
