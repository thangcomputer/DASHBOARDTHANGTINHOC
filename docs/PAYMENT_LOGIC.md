# Thanh toán

## Luồng

Học viên chọn gói hoặc khóa. Server tạo `PaymentSession` (`pending`) với `sessionId`, `ref`, `amount`. Client hiện QR từ cấu hình ngân hàng (`BANK_ID`, `ACCOUNT_NO`, `ACCOUNT_NAME`). SePay gọi webhook. Server đối soát số tiền và nội dung, rồi mới chuyển `paid` và ghi sổ (`LedgerEntry`, hóa đơn, hoặc cộng XP nếu `kind` là `daily_practice_xp`).

`kind` được phép: `tuition`, `video_course`, `course_purchase`, `dewskill_class`, `admin_enrollment`, `subscription_renewal`, `daily_practice_xp`, `ai_package`.

## Không được làm

- Không tự xác nhận `paid` từ client.
- Không gọi SePay bằng khóa thật trong test.
- `PaymentSession.createdAt` có TTL 24 giờ. Đừng dựa vào session cũ để đối soát sau một ngày.
- Đổi giá khóa sửa `Course.price` và chỗ tính `utils/coursePricing.js`, rồi mới sửa nhãn UI.

## Test

Database test có thể chứa một `PaymentSession` `paid` do script seed ghi thẳng. Đó là dữ liệu giả, không phải giao dịch ngân hàng. Database runtime không được seed bằng script đó.

Route: `subscriptionRoutes.js`, `webhookRoutes.js`, `invoiceRoutes.js`, `financeRoutes.js`. Web: `client/src/services/subscriptionApi.js`. Mobile: `subscriptionApi.ts`.
