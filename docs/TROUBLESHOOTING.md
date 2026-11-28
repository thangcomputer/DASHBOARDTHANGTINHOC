# Xử lý sự cố

## API không lên

`config/validateEnv.js` dừng process khi thiếu `JWT_SECRET`, `JWT_REFRESH_SECRET`, hoặc `MONGODB_URI`. Hai secret phải khác nhau. Production còn cần `CLIENT_URL`.

Log là Pino, mức `LOG_LEVEL`. Lỗi request có mã trên JSON `message` và đôi khi `code`.

## 401 ngay sau login

Đăng nhập mới tăng `tokenVersion` và thu hồi phiên cũ. Token lấy trước đó trả `SESSION_REVOKED`. Dùng token của lần login cuối.

Admin và staff không dùng `POST /api/auth/login` của học viên. Route đó trả 401 cho các role đó.

## 403 thiết bị

`DEVICE_NOT_REGISTERED_LIMIT_REACHED`: đã đủ hai thiết bị. `DEVICE_PROOF_INVALID`: sai secret. Không xóa `RegisteredDevice` để "thử cho vào". Admin dùng revoke hoặc reset.

## 500 khi mở cài đặt hoặc danh sách

`SystemSettings` chỉ có một `_key: main`. Tạo mới phải upsert. `services/settingsCache.js` đã bỏ `create` song song.

## CSRF 403

Client phải gọi `/api/auth/csrf-token` trước request ghi. Thiếu header `X-CSRF-Token` thì mutation bị từ chối. GET không cần.

## Test đụng nhầm database

Nếu script không in `dbName: thang_tin_hoc_test` và `runtimeStudentCountUnchanged: true`, dừng. Đừng chạy tiếp. Guard nằm ở `tests/setup/testDatabaseGuard.js`.

## Web gọi sai host

Dev: bỏ `VITE_API_URL` để dùng proxy Vite, hoặc trỏ đúng `http://localhost:5000`. Production: origin phải khớp `CLIENT_URL` và CORS.

## Socket không có tin

Kiểm tra token lúc `io({ auth })`. Kiểm tra tên sự kiện ở cả `SocketContext.jsx` và chỗ emit. Nhiều instance mà không có Redis thì mỗi process một phòng.
