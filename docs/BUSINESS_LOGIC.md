# Nghiệp vụ

Các luồng dưới đây mô tả code đang chạy. Chi tiết XP và tiền nằm ở [GAMIFICATION_LOGIC.md](GAMIFICATION_LOGIC.md) và [PAYMENT_LOGIC.md](PAYMENT_LOGIC.md).

## Đăng nhập

Người dùng gửi số điện thoại và mật khẩu. Server tìm `Student` hoặc `Teacher`, so hash, kiểm tra khóa tạm và trạng thái. Học viên và giáo viên đi qua kiểm tra thiết bị. Token mới tăng `tokenVersion`. Đăng nhập web mới thu hồi phiên mobile và phiên web cũ của cùng tài khoản (`SESSION_REVOKED` nếu dùng token cũ).

## Học viên và lớp

Admin hoặc nhân sự tạo học viên trong `studentRoutes.js`. Học viên có `course`, `price`, và mảng `enrollments` (khóa, giáo viên, số buổi, học phí). Giáo viên xem danh sách bị lọc theo học viên được gán. Đã đo: giáo viên 1 chỉ thấy 4 học viên mình phụ trách trên dữ liệu test.

## Khóa học và bài học

`Course` là catalog. Bài video và luyện nằm ở `LessonSubject` → `LessonUnit` → `LessonItem`. Lộ trình hằng ngày dùng `DailyPracticeTopic`, `DailyPracticeUnit`, `DailyPracticeQuestion`.

## Lịch

`Schedule` gắn giáo viên, học viên, ngày, giờ bắt đầu, giờ kết thúc, trạng thái. Điểm danh có `studentConfirmStatus` riêng. Giờ nghiệp vụ theo lịch Việt Nam ở các helper `utils/vnTimezone.js` và chuỗi ngày `YYYY-MM-DD` của luyện tập.

## Bài tập và thi

Giáo viên hoặc admin tạo `Assignment` với hạn nộp. Học viên tạo `Submission`. Phòng thi và chứng chỉ có attempt, khóa thi và proctor event. Không nới validation để test cho qua.

## Tin nhắn

`buildConversationId` tạo một id ổn định cho cặp vai trò. Tin lưu ở `Message` (`isRead`). Socket phát tin realtime. API và socket phải cùng id hội thoại. Chưa đo trên UI trong đợt bàn giao này.

## Thông báo

`Notification` có `type`, `receivers`, `read_by`. Người dùng đánh dấu đã đọc bằng API thông báo. Không xóa bản ghi chung khi một người ẩn thông báo.

## Thanh toán và XP

Xem hai file chuyên biệt. Công thức XP nằm trong `services/dailyPracticeRules.js`. Không đặt mức XP mới trong UI.
