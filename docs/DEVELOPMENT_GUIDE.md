# Làm việc hằng ngày

## Chọn tầng

| Muốn | Sửa |
| --- | --- |
| Chữ, nút, bố cục | `client/src/components/` hoặc `thang-tin-hoc-mobile/src/screens/` |
| URL, quyền HTTP | `routes/` và middleware ngay trên route |
| Quy tắc dùng nhiều route | `services/` |
| Field lưu trữ | `models/` rồi cả hai client |
| Token, CSRF, refresh | `api.js` hoặc `apiClient.ts` |
| Sự kiện realtime | `server.js` hoặc `utils/realtimeEmit.js` và context/socket client |

## Thêm màn web

1. Component trong `client/src/components/<vai trò>/`.
2. `lazy()` trong `client/src/App.jsx`.
3. Gọi API qua hàm có sẵn hoặc hàm mới bọc `apiFetch`.

## Thêm màn mobile

Screen trong `thang-tin-hoc-mobile/src/screens/`, đăng ký navigator hiện có, gọi `mobileApiRequest` qua file `*Api.ts`.

## Collection mới

1. File trong `models/`.
2. Service đọc ghi.
3. Route trong `routes/` và `app.use` nếu prefix mới.
4. Không tạo bản model thứ hai trong `modules/` trừ khi route thật đã chuyển sang file đó và test hợp đồng đã đổi.

## File không sửa cho "gọn"

- `services/registeredDeviceService.js` — chính sách hai thiết bị.
- `services/dailyPracticeRules.js` — số XP.
- `middleware/auth.js` — xác thực.
- `server.js` phần mount — đổi prefix làm gãy web và mobile.
- `.env` và khóa SePay, JWT, SMTP.

## Nhánh và commit

Làm trên nhánh riêng. Không commit `.env`. Không `git push` trừ khi được yêu cầu.
