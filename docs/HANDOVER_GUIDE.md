# Bàn giao cho lập trình viên mới

Đọc theo thứ tự: [README của docs](README.md), file này, [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md), [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md). Cài đặt từng lệnh nằm ở [README gốc](../README.md).

## Muốn sửa giao diện thì vào đâu

Web: `client/src/components/`, route trang trong `client/src/App.jsx`. Mobile: `thang-tin-hoc-mobile/src/screens/` và navigator của app Expo. Đừng sửa `models/` chỉ để đổi chữ trên nút.

## Muốn sửa API thì vào đâu

Tìm prefix trong `server.js`, mở file trong `routes/`. Quy tắc dùng lại nằm trong `services/`. Web gọi qua `client/src/services/api.js` và các file `*Api.js`. Mobile gọi qua `apiClient.ts` và `*Api.ts`.

Ví dụ danh sách học viên: `routes/studentRoutes.js`. Giáo viên chỉ thấy học viên được gán. Học viên gọi cùng URL bị 403.

## Muốn thêm chức năng

Thêm handler vào route đã có, hoặc file route mới rồi `app.use` trong `server.js`. Thêm hàm gọi ở client nào cần. Giữ method và tên field nếu mobile đã phát hành đang gọi path đó.

## Muốn thêm màn

Web: component PascalCase, `lazy()` trong `App.jsx`. Mobile: screen mới, đăng ký navigator hiện có. Cả hai gọi API có sẵn, không tạo axios mới.

## Muốn đổi nghiệp vụ

Sửa `services/`. Route chỉ nhận body và trả status. Nếu quy tắc là số XP, sửa `services/dailyPracticeRules.js` và đọc [GAMIFICATION_LOGIC.md](GAMIFICATION_LOGIC.md) trước. Nếu là tiền, đọc [PAYMENT_LOGIC.md](PAYMENT_LOGIC.md) trước. Client không được tự cộng XP hay tự ghi `paid`.

## Muốn thêm collection

File mới trong `models/`. Service đọc ghi. Route. Không tạo bản thứ hai trong `modules/` khi `routes/` vẫn là bản sống.

## Muốn nối mobile với API

Đặt `EXPO_PUBLIC_MOBILE_API_BASE_URL`. Mọi request đi qua `mobileApiRequest` để còn Bearer, CSRF và `X-Client-Platform: mobile`.

## Muốn sửa Socket

Emit trong `server.js` hoặc `utils/realtimeEmit.js`. Nghe ở `client/src/context/SocketContext.jsx` và `thang-tin-hoc-mobile/src/services/socketService.ts`. Đổi tên sự kiện phải sửa cả ba.

## Muốn xem lỗi

Log Pino của process `server.js` (`LOG_LEVEL`). Response có `message` và đôi khi `code` (`DEVICE_NOT_REGISTERED_LIMIT_REACHED`, `SESSION_REVOKED`). Trình duyệt: network tab, header `Authorization` và `X-CSRF-Token`.

## Muốn chạy trên máy mới

Node 20 trở lên, MongoDB, copy `.env.example` thành `.env`, `npm install`, `npm run dev`, rồi `client` với `npm install` và `npm run dev`. Mobile: `npx expo start` trong `thang-tin-hoc-mobile`. Test: `npm test`. Database giả: [TEST_DATA_GUIDE.md](TEST_DATA_GUIDE.md).

## File không sửa cho gọn

`services/registeredDeviceService.js`, `services/dailyPracticeRules.js`, `middleware/auth.js`, bảng `app.use` trong `server.js`, `.env`. Giới hạn hai thiết bị, công thức XP, webhook SePay và tên prefix là hợp đồng với hệ thống đang chạy.

## Nghiệp vụ dễ gây lỗi dây chuyền

- Đăng nhập mới làm token cũ thành `SESSION_REVOKED`.
- Đủ hai `RegisteredDevice` thì thiết bị thứ ba bị 403. Logout không giải phóng slot.
- `SystemSettings` chỉ một document `_key: main`.
- `Student` bắt buộc `course`, `price`, và Zalo nếu không có email. `Course.price` bắt buộc.
- POST nộp bài hoặc tạo thanh toán không được retry tự động.

## Sơ đồ

Các sơ đồ khớp code nằm trong [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) (tổng thể, đăng nhập, API, học bài, giáo viên, XP, thanh toán, socket) và [DATABASE_DOCUMENTATION.md](DATABASE_DOCUMENTATION.md) (quan hệ collection).
