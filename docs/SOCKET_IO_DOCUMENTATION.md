# Socket.IO

Socket gắn trên cùng HTTP server trong `server.js`. Không có process socket riêng.

## Kết nối

Web: `client/src/context/SocketContext.jsx`, một socket cho phiên, `auth: { token }`. Component không gọi `io()` thêm. Callback đăng ký qua ref và có hàm hủy.

Mobile: `thang-tin-hoc-mobile/src/services/socketService.ts`.

Khi không có `REDIS_URL`, adapter là bộ nhớ của process. Nhiều instance API cần Redis thì mới chia sẻ phòng.

## Việc đang làm

- Nhận và phát tin nhắn, gõ, đã đọc.
- Presence.
- Gom sự kiện làm mới dữ liệu (`schedule:*`, `assignment:*`, `student:*`, `tuition:paid`, …) trong khoảng 320ms rồi gọi callback UI.

Tên sự kiện khai báo trong `SocketContext.jsx` (`DATA_REFRESH_EVENTS`) và phía emit trong `server.js` cùng `utils/realtimeEmit.js`. Đổi tên một phía làm web hoặc mobile im lặng.

## Khi sửa

Sửa emit và listener cùng lúc. Giữ payload cũ nếu mobile bản đã phát hành còn nghe tên cũ. Đừng tạo socket trong từng component.
