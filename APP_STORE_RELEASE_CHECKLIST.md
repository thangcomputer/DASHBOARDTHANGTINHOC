# 04. APP STORE & GOOGLE PLAY RELEASE CHECKLIST

Tài liệu rà soát điều kiện phát hành cho **Apple App Store (iOS)** và **Google Play (Android)** đối với ứng dụng **Thắng Tin Học** (`vn.thangcomputer.thangtinhoc.mobile`).

---

## 1. Bảng Checklist Tuân thủ Kỹ thuật & Chính sách

| Hạng mục | Apple App Store | Google Play | Trạng thái hiện tại | Hành động xác minh / Thao tác thủ công bắt buộc |
|---|---|---|---|---|
| **Bundle ID / Package Name** | `vn.thangcomputer.thangtinhoc.mobile` | `vn.thangcomputer.thangtinhoc.mobile` | **PASS** (Cấu hình đồng nhất trong `app.json`) | Không thay đổi identifier khi tạo app trên App Store Connect / Play Console. |
| **Versioning & Auto-increment** | `version: 1.0.0`, `eas.json` `autoIncrement: true` | `app-bundle` + `autoIncrement: true` | **PARTIAL** | Chạy `eas build --platform all --profile production` để xác minh `buildNumber` / `versionCode` được EAS gán đúng. |
| **Target API & 16 KB Page Size (Android)** | N/A | Bắt buộc nhắm mục tiêu API 36 (Android 16) theo mốc 31/08/2026 & hỗ trợ page size 16 KB | **BLOCKED / NOT TESTED** | Xuất bản `.aab` từ Expo SDK 58 (`eas build -p android --profile production`) và kiểm tra `targetSdkVersion` + native `.so` alignment trên Play Console / APK Analyzer. |
| **Privacy Manifest (`PrivacyInfo.xcprivacy`)** | Bắt buộc cho API nhạy cảm (`UserDefaults`/SecureStore/File timestamp) trên Xcode Archive | N/A | **NOT TESTED** | Sau `eas build -p ios`, kiểm tra log Archive của Xcode/EAS đảm bảo không có cảnh báo thiếu `PrivacyInfo.xcprivacy`. |
| **Xóa tài khoản (In-app & Web URL)** | Bắt buộc **xóa ngay trong app** (Guideline 5.1.1(v)) | Bắt buộc xóa trong app **và URL xóa trên Web** (Data Safety) | **PARTIAL** (Code xong; URL Web `/delete-account` gắn vào app) | Deploy Backend bản mới lên HTTPS (`https://thangtinhoc.vn`), xác nhận `https://thangtinhoc.vn/delete-account` mở được công khai; dán URL này vào Play Console Data Safety. |
| **Privacy Policy & Terms of Service** | Bắt buộc trong metadata & trong app | Bắt buộc trong Store Listing & trong app | **PARTIAL** (`routes/publicPolicyRoutes.js` + `ProfileScreen` đã sẵn sàng) | Xác nhận `https://thangtinhoc.vn/privacy-policy` và `https://thangtinhoc.vn/terms-of-service` phản hồi HTTP 200 qua HTTPS; khai báo lên App Store Connect & Play Console. |
| **UGC Chat Safety (Report & Block)** | Bắt buộc báo cáo nội dung + chặn người dùng + cơ chế duyệt (Guideline 1.2) | Bắt buộc kiểm duyệt & báo cáo nội dung UGC | **PASS (In-code)** | Kiểm tra admin nhận được thông báo khi user mobile bấm **Báo cáo vi phạm**; test **Chặn người dùng** trên server staging. |
| **Thanh toán & Sản phẩm số** | Cấm link/QR thanh toán ngoài cho nội dung số (Guideline 3.1.1); cho phép **Reader/Companion** + **Restore Purchases** hoặc Apple IAP | Bắt buộc Play Billing cho nội dung số bán trong app | **PARTIAL / BLOCKED** | Hiện app bật an toàn chế độ **Companion + Restore Purchases** trên iOS/Android native (đã gỡ VietQR & câu hướng dẫn website ở `TuitionScreen`). Khi mở bán trực tiếp trong app cần nạp secrets bên dưới & gắn IAP SDK. |
| **Đăng nhập Xét duyệt (App Review Account)** | Bắt buộc cung cấp tài khoản demo còn hạn cho **Học viên** & **Giảng viên** (hoặc nút demo không phá DB thật) | Bắt buộc cung cấp **App Access** credentials cho Play Reviewer | **BLOCKED (Thủ công)** | Tạo sẵn 1 tài khoản Học viên (có sẵn khóa video + lịch học + bài tập mẫu) và 1 tài khoản Giảng viên trên môi trường production/review; điền vào **App Review Information**. |
| **Push Notifications (APNs & FCM)** | Cần APNs Auth Key (`.p8`) trên EAS | Cần Firebase Service Account / `google-services.json` trên EAS | **BLOCKED (Thủ công)** | Chạy `eas credentials`, upload APNs key + `google-services.json`, sau đó test thực tế 8 sự kiện trên 2 máy thật (Foreground, Background, Killed). |
| **Deep Link Verification (Universal / App Links)** | Cần file `/.well-known/apple-app-site-association` trên domain | Cần file `/.well-known/assetlinks.json` trên domain | **BLOCKED (Domain)** | Cấu hình 2 tệp xác minh tên miền chứa App ID (TeamID.bundleId) & SHA-256 certificate fingerprint trên reverse proxy của `thangtinhoc.vn` và `thangtinhoc.edu.vn`. |
| **Expo Package Consistency** | `expo-doctor` | `expo-doctor` | **PARTIAL** | Chạy `npx expo install --check` trong `thang-tin-hoc-mobile` để khớp 13 gói patch/minor của SDK 58; kiểm tra `react-native-webrtc` trên New Architecture. |
| **Store Assets & Screenshots** | Icon 1024×1024 (không alpha), Screenshots iPhone 6.9"/6.5" & iPad | Icon 512×512, Feature Graphic 1024×500, Screenshots Phone/Tablet | **BLOCKED (Thủ công)** | Kiểm tra `assets/icon.png` không có kênh trong suốt (Apple từ chối alpha channel trên App Icon); chụp màn hình thật từ Simulator/máy thật cho cả Học viên & Giảng viên. |

---

## 2. Danh sách Quyền Thiết bị & Giải thích cho Apple / Google Review

| Quyền (`app.json`) | Nền tảng | Mục đích sử dụng thực tế trong app | Cách giải thích cho Reviewer |
|---|---|---|---|
| `NSFaceIDUsageDescription` / `USE_BIOMETRIC` / `USE_FINGERPRINT` | iOS & Android | Đăng nhập nhanh 1 chạm sau khi người dùng chủ động chọn lưu đăng nhập sinh trắc học | Chỉ kích hoạt khi người dùng tự nguyện bật lưu thông tin đăng nhập; dữ liệu xác thực được quản lý bởi SecureStore & Keychain/Keystore của hệ điều hành. |
| `NSMicrophoneUsageDescription` / `RECORD_AUDIO` / `MODIFY_AUDIO_SETTINGS` | iOS & Android | Gọi thoại WebRTC 1-1 trong lớp học / trao đổi học viên – giảng viên | Chỉ yêu cầu quyền khi người dùng bấm nút Gọi điện/Nghe máy; không thu âm nền. |
| `photosPermission` / `cameraPermission` (`expo-image-picker`) | iOS & Android | Đổi ảnh đại diện, chụp/chọn ảnh gửi tin nhắn học tập và nộp bài tập (`microphonePermission: false`) | Chỉ hiển thị hộp thoại xin quyền ngay tại lúc người dùng chạm nút chọn ảnh/máy ảnh. |
| `POST_NOTIFICATIONS` (Android 13+) & Push APNs (iOS) | iOS & Android | Nhắc lịch học (24h/60m/15m), tin nhắn, bài tập mới, kết quả điểm danh & thông báo hệ thống | Không xin quyền ngay lúc mở app lần đầu (`requestPermission = false`); người dùng chủ động bật trong **Hồ sơ → Bật thông báo** hoặc **Cài đặt thông báo**. |

---

## 3. Biến môi trường & Khóa dịch vụ Chủ dự án cần cấu hình trước Build Release

### 3.1. Biến môi trường Backend (`.env` Server Production)
- `MOBILE_MULTI_SESSION_AUTH=true` (Bật luồng đăng nhập đa thiết bị chuẩn bảo mật cho mobile).
- **Khi kích hoạt Apple IAP / Google Play Billing thật** (nếu không chạy chế độ Companion):
  - `MOBILE_STORE_BILLING_MODE=sandbox` (lúc test) → `production` (khi phát hành)
  - `APPLE_IAP_ISSUER_ID=...`
  - `APPLE_IAP_KEY_ID=...`
  - `APPLE_IAP_PRIVATE_KEY=...`
  - `APPLE_BUNDLE_ID=vn.thangcomputer.thangtinhoc.mobile`
  - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=...`
  - `GOOGLE_PLAY_PACKAGE_NAME=vn.thangcomputer.thangtinhoc.mobile`
  - `MOBILE_BILLING_WEBHOOK_SECRET=...`

### 3.2. Biến môi trường Mobile (`eas.json` / `.env` Build Profile `production`)
- `EXPO_PUBLIC_MOBILE_API_BASE_URL=https://<api-domain-chinh-thuc>`
- `EXPO_PUBLIC_EAS_PROJECT_ID=63dc6f6a-3364-4638-b926-79d5484efdee`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL=https://thangtinhoc.vn/privacy-policy`
- `EXPO_PUBLIC_TERMS_OF_SERVICE_URL=https://thangtinhoc.vn/terms-of-service`
- `EXPO_PUBLIC_DELETE_ACCOUNT_URL=https://thangtinhoc.vn/delete-account`
- `EXPO_PUBLIC_SUPPORT_URL=https://thangtinhoc.vn/...` (nếu có trang hỗ trợ riêng)
- `EXPO_PUBLIC_NATIVE_IAP_ENABLED=false` (giữ `false` nếu phát hành ở chế độ Companion; chỉ bật `true` sau khi gắn SDK IAP & secrets).

---

## 4. Hướng dẫn kiểm thử TestFlight (iOS) & Internal Testing (Google Play)

1. **Chuẩn bị trước build:**
   ```bash
   cd thang-tin-hoc-mobile
   npx expo install --check
   npm install --package-lock-only
   npx eas login
   npx eas credentials
   ```
2. **Build bản kiểm thử nội bộ & Store:**
   - **Android Internal Testing (AAB):** `npx eas build --platform android --profile production`
     - Tải tệp `.aab` lên **Google Play Console → Testing → Internal testing**.
     - Thêm Gmail người kiểm thử, tải ứng dụng qua link Play Store (không cài APK ngoài để test đúng App Signing + Push + Play Billing).
   - **iOS TestFlight (IPA):** `npx eas build --platform ios --profile production`
     - Nộp bản build lên TestFlight (`npx eas submit --platform ios --latest`).
     - Mời tester nội bộ cài qua app TestFlight trên iPhone/iPad thật.
3. **Kịch bản nghiệm thu bắt buộc trên 2 máy thật trước khi bấm Submit for Review:**
   - Đăng nhập bằng **tài khoản Review Học viên** & **tài khoản Review Giảng viên** (không bật QA preview mode).
   - Thử **Push Notification** ở 3 trạng thái: Foreground, Background, Terminated — bấm thông báo phải nhảy đúng màn hình đích (Lịch học, Tin nhắn, Bài tập, Thông báo).
   - Thử **Bật/tắt từng loại thông báo** trong *Hồ sơ → Cài đặt loại thông báo* và đổi trạng thái đã đọc giữa Web & Mobile để xác nhận badge khớp 100%.
   - Thử **Chat UGC**: gửi/nhận tin, ảnh, sticker, **Báo cáo vi phạm** (Admin Web thấy thông báo), **Chặn người dùng** (người kia bị từ chối gửi tin) rồi **Bỏ chặn**.
   - Thử **Khôi phục giao dịch mua (Restore Purchases)** trên tab Học phí & Hồ sơ.
   - Thử **Tạo 1 tài khoản phụ → Xóa tài khoản vĩnh viễn** ngay trong *Hồ sơ* và xác nhận phiên bị thu hồi, không đăng nhập lại được bằng tài khoản đó.
