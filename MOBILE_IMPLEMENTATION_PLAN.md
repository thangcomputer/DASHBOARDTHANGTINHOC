# 02. MOBILE IMPLEMENTATION PLAN — Phương án sửa & Kiến trúc Phát hành

Tài liệu mô tả kiến trúc triển khai và thứ tự thay đổi đã thực hiện (hoàn toàn tương thích ngược với Web App, MongoDB, Express API và Socket.IO hiện có) cùng lộ trình các bước cần hoàn tất khi có tài khoản nhà phát triển.

---

## Phần A: Các thay đổi kỹ thuật đã triển khai trong mã nguồn (Phase 1 → Phase 6)

### 1. Sửa lỗi hồi quy & Ổn định cấu trúc điều hướng / Lịch học
- **[thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx)**:
  - Khôi phục cấu trúc khai báo `const items = isTeacher ? [...] : [];` trong `PersistentTabBar`, đăng ký listener đồng bộ sự kiện `SCHEDULE_REMINDER_REVOKED` (xóa thông báo nhắc cục bộ đã đặt) và `NOTIFICATION_READ_SYNC` (cập nhật badge chưa đọc).
- **[routes/scheduleRoutes.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/routes/scheduleRoutes.js)**:
  - Dùng `notifyScheduleConversation(req, ...)` an toàn trong xử lý nền và gọi `revokeScheduleReminders` khi lịch học được dời giờ hoặc hủy.

### 2. Chính sách công khai & Tự xóa tài khoản (Apple 5.1.1(v) & Google Play User Data)
- **[routes/publicPolicyRoutes.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/routes/publicPolicyRoutes.js)** (gắn vào `server.js` tại `/`):
  - `GET /privacy-policy`: Trang chính sách quyền riêng tư tiếng Việt (có CSP nonce).
  - `GET /terms-of-service`: Trang điều khoản sử dụng tiếng Việt.
  - `GET /delete-account` & `POST /api/public/account-deletion-request`: Trang hướng dẫn + biểu mẫu yêu cầu xóa tài khoản từ trình duyệt (dành cho người đã gỡ app) với double-submit CSRF cookie + rate limiter.
- **[routes/authRoutes.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/routes/authRoutes.js)**:
  - `POST /api/auth/delete-account`: Xác thực `authMiddleware`, giới hạn `student` và `teacher`, bắt buộc xác thực lại mật khẩu (hoặc cụm `XOA TAI KHOAN` đối với tài khoản MXH không có mật khẩu), thu hồi toàn bộ `UserDeviceSession` & `MobilePushToken`, blacklist JWT hiện tại, gọi `purgeStudentSideEffects` / `purgeTeacherSideEffects`, giữ nguyên `Invoice` / `LedgerEntry` / `Transaction` kế toán và ghi `AuditLog` (`ACCOUNT_SELF_DELETED`).
- **Mobile**:
  - [thang-tin-hoc-mobile/src/services/mockService.ts](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/thang-tin-hoc-mobile/src/services/mockService.ts): `authService.deleteAccount(password, reason, confirmText)`.
  - [thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx): Gắn URL mặc định cho Quyền riêng tư / Điều khoản / Yêu cầu xóa Web trong `ProfileScreen`, thêm nút & hộp thoại `DeleteAccountModal`.

### 3. Loại bỏ thư viện `xlsx` (High CVE) bằng `fflate`
- **[thang-tin-hoc-mobile/src/services/teacherQuizExcel.ts](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/thang-tin-hoc-mobile/src/services/teacherQuizExcel.ts)**:
  - Viết lại hoàn toàn bộ đọc/ghi `.xlsx` chuẩn OOXML dùng `fflate` (`unzipSync` có kiểm soát dung lượng chống zip bomb <= 15MB, `zipSync`, `sharedStrings.xml`, `inlineStr`), giữ nguyên chữ ký hàm `parseTeacherQuizQuestionsExcel` và `createTeacherQuizQuestionWorkbook`.
- **[thang-tin-hoc-mobile/package.json](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/thang-tin-hoc-mobile/package.json)**: Đã xóa `"xlsx": "^0.18.5"`.

### 4. Hệ thống Push Notification Thống nhất (8 nhóm sự kiện)
- **[models/MobilePushToken.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/models/MobilePushToken.js)** & **[routes/mobilePushTokenRoutes.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/routes/mobilePushTokenRoutes.js)**:
  - Thêm schema `preferences` đồng bộ giữa các thiết bị của cùng user và endpoints `GET /api/mobile-push-tokens/preferences`, `PUT /api/mobile-push-tokens/preferences` (bật/tắt 7 nhóm loại + chọn mốc `[1440, 60, 15]` phút).
- **[services/mobilePushService.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/services/mobilePushService.js)** & **[server.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/server.js)**:
  - Hỗ trợ đầy đủ 8 nhóm sự kiện: Nhắc lịch 24h/60m/15m, Bắt đầu buổi học, Đổi/hủy lịch, Tin nhắn, Cuộc gọi đến/nhỡ, Thông báo Quản trị viên, Bài tập & Điểm số, Học phí & Khóa học.
  - Bổ sung chống gửi trùng (`DEDUP_CACHE`), tự động vô hiệu hóa token `DeviceNotRegistered`, gán `deepLink` (`thangtinhoc://...`) & `badge`, và `revokeScheduleReminders`.
  - Cron `server.js` quét trước +2 ngày để kích hoạt nhắc lịch 24h, 60m, 15m không trùng lặp.
- **[routes/notificationRoutes.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/routes/notificationRoutes.js)** & **[thang-tin-hoc-mobile/src/services/socketService.ts](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/thang-tin-hoc-mobile/src/services/socketService.ts)**:
  - Bổ sung `PUT /api/notifications/read-all`, `PUT /api/notifications/:id/read` và phát sự kiện `notification:read-sync` kèm tổng số `unread` giúp Web và Mobile đồng bộ badge theo thời gian thực.
- **[thang-tin-hoc-mobile/src/services/mobilePushNotifications.ts](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/thang-tin-hoc-mobile/src/services/mobilePushNotifications.ts)** & **[FeatureScreens.tsx](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx)**:
  - Thêm `NotificationPreferencesModal` trong `ProfileScreen` để bật/tắt từng loại thông báo và mốc 24h / 60m / 15m.

### 5. Nhắn tin & An toàn UGC (Report / Block)
- **[models/ChatReport.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/models/ChatReport.js)** & **[models/UserBlock.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/models/UserBlock.js)**.
- **[services/directMessageService.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/services/directMessageService.js)**: Chặn gửi tin nhắn 1-1 ở tầng canonical (cả HTTP & Socket.IO) nếu có bản ghi `UserBlock` giữa hai phía (`MESSAGING_USER_BLOCKED`).
- **[routes/messageRoutes.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/routes/messageRoutes.js)**, **[messageApi.ts](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/thang-tin-hoc-mobile/src/services/messageApi.ts)** & **[MessageScreens.tsx](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/thang-tin-hoc-mobile/src/screens/MessageScreens.tsx)**:
  - Endpoints `/api/messages/report`, `/blocks`, `/block`, `/block/:blockedUserId` (đặt trước `/:conversationId`) và nút **Báo cáo vi phạm**, **Chặn / Bỏ chặn người dùng này** ngay trong menu tin nhắn & popup thông tin hội thoại.

### 6. Kiến trúc Thanh toán Mobile Billing (Apple IAP / Google Play Billing Ready + Reader/Companion Safe)
- **[models/MobileBillingTransaction.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/models/MobileBillingTransaction.js)**: Index duy nhất `{ platform, storeTransactionId }` chống cộng tiền/XP nhiều lần.
- **[services/mobileBillingService.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/services/mobileBillingService.js)** & **[routes/mobileBillingRoutes.js](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/routes/mobileBillingRoutes.js)**:
  - `GET /api/mobile-billing/catalog`: phân loại 6 nhóm sản phẩm và trạng thái cấu hình secrets.
  - `POST /api/mobile-billing/verify`: fail-closed (`412 STORE_CREDENTIALS_MISSING`) nếu chưa có API secrets cửa hàng; khi có xác minh hợp lệ sẽ cấp quyền đồng bộ (`VideoCoursePurchase`, `DailyPracticeProfile`, `Subscription`).
  - `POST /api/mobile-billing/restore`: khôi phục các khóa học và trạng thái thuê bao cho học viên.
  - `POST /api/mobile-billing/webhook`: xử lý hoàn tiền (`REFUND`) / thu hồi (`REVOKE`) có kiểm tra `x-billing-webhook-secret` và hoàn trả XP/khóa học tương ứng.
- **[CoursePaymentModal.tsx](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/thang-tin-hoc-mobile/src/components/CoursePaymentModal.tsx)**, **[ParityScreens.tsx](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/thang-tin-hoc-mobile/src/screens/ParityScreens.tsx)** (`TuitionScreen`), **[FeatureScreens.tsx](file:///d:/web/WEB%20T%E1%BB%94NG%20H%E1%BB%A2P/DASHBOARDTHANGTINHOC-fresh/thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx)** (`ProfileScreen`):
  - Giữ VietQR SePay cho bản Web; tự động chuyển về chế độ Companion + nút **Khôi phục giao dịch mua** trên native iOS/Android khi chưa bật Native Store IAP.

---

## Phần B: Lộ trình hoàn tất phía vận hành (khi chủ dự án cung cấp tài khoản/khóa dịch vụ)
1. Chạy `npm --prefix thang-tin-hoc-mobile install --package-lock-only` trên môi trường mạng có npm registry để cập nhật sạch `package-lock.json` sau khi gỡ `xlsx`.
2. Cấu hình `APPLE_IAP_*`, `GOOGLE_PLAY_*`, `MOBILE_BILLING_WEBHOOK_SECRET`, EAS credentials (APNs `.p8` & FCM `google-services.json`).
3. Bổ sung gói SDK native Store (ví dụ `react-native-iap` hoặc `expo-iap` tương thích Expo SDK 58 + Config Plugin) kết nối tới `POST /api/mobile-billing/verify` khi quyết định bán trực tiếp trên iOS/Android, bật `EXPO_PUBLIC_NATIVE_IAP_ENABLED=true`.
4. Chạy `eas build --platform all --profile production` và hoàn tất kiểm thử trên thiết bị vật lý (xem chi tiết tại `04. APP_STORE_RELEASE_CHECKLIST.md`).
