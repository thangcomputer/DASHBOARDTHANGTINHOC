# Quy ước code

Bám style đang có. Không đổi tên hàng loạt cho khớp một quyển style khác.

## Tên file

| Loại | Cách đang dùng | Ví dụ |
| --- | --- | --- |
| Component React | PascalCase `.jsx` | `SystemSettingsTab.jsx` |
| Hook | `use` + Pascal phần sau | `useInactivityTimer.js` |
| Route | camelCase + `Routes.js` | `studentRoutes.js` |
| Service server | camelCase | `registeredDeviceService.js` |
| API web | cụm theo nghiệp vụ, gọi `apiFetch` | `dailyPracticeApi.js`, `subscriptionApi.js` |
| API mobile | `*Api.ts` | `studentApi.ts` |
| Model | PascalCase | `Student.js` |
| Hằng | UPPER_SNAKE trong file rules | `FREE_PORTAL_DAILY_XP` |

Client HTTP duy nhất của web là `apiFetch`. Của mobile là `mobileApiRequest`. Hàm `authAPI`, `studentAPI` là nhóm method, không phải axios instance mới.

## Hàm

Một hàm làm một việc người đọc gọi tên là hiểu. Giữ tên nghiệp vụ (`claimLoginDevice`, `grantWelcomeXp`) thay vì `handle` hoặc `process`.

Route đọc request, gọi service, trả status. Service không nhận `req` nếu không cần. Model không quyết định học viên nào được xem danh sách.

## Phụ thuộc

- Web không import file trong `routes/` hay `models/`.
- Mobile không import `client/`.
- `routes/` không render JSX.
- Không `require` vòng giữa hai service. Nếu cần, đưa hàm dùng chung xuống `utils/`.

## Thứ không thêm

Abstraction bọc `apiFetch` chỉ để đổi tên thành `studentService` trong khi `studentAPI` đã có. Cache TTL cho điểm, tin, hoặc số dư. Retry POST. `console.log` token hoặc mật khẩu.
