# Tổng quan dự án

LMS Thắng Tin Học là hệ thống vận hành trung tâm: quản lý học viên, giáo viên, khóa học, lịch, bài tập, phòng thi, luyện tập hằng ngày, XP, thanh toán, tin nhắn và thông báo. Có ba bề mặt dùng chung một API.

## Người dùng

| Vai trò | Việc chính |
| --- | --- |
| Admin / staff | Học viên, giáo viên, tài chính, cài đặt, phân quyền |
| Giáo viên | Lịch dạy, học viên được gán, bài tập, điểm |
| Học viên | Vào học, video, luyện tập, bài tập, tin nhắn, gói XP |

Admin nội bộ nằm trên model `Teacher` với `role` là `admin` hoặc `staff` và `adminRole` (`SUPER_ADMIN`, `HIGH_ADMIN`, `STAFF`, `SUPPORT`). Không có collection User riêng cho mọi vai trò.

## Công nghệ

- API: Node.js, Express 5, Mongoose, Socket.IO, Pino. Entry `server.js`. Job nền `worker.js`.
- Web: React 19, Vite, Tailwind, SWR ở một số context admin.
- Mobile: Expo / React Native, TypeScript.
- Dữ liệu: MongoDB. Redis dùng khi có `REDIS_URL` (adapter socket, hàng đợi). Không có Redis thì socket và presence chạy trong bộ nhớ của process.

## Module đang phục vụ người dùng

Đăng nhập, thiết bị, học viên, giáo viên, khóa học, lịch, bài tập, quiz và chứng chỉ, luyện tập và XP, thanh toán và gói, tin nhắn, thông báo, tệp, cài đặt, DewSkill (lớp, học viên, AI hỗ trợ).

## Tích hợp

SePay (webhook, không gọi khi seed test), Zalo OA, SMTP, Google OAuth (có cờ tắt), push mobile. Biến môi trường nằm trong README gốc. Không ghi secret vào tài liệu này.
