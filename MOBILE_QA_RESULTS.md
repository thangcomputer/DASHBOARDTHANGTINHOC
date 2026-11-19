# 03. MOBILE QA RESULTS — Kết quả Kiểm thử Phát hành (Bằng chứng thực tế)

**Ngày chạy kiểm thử:** 19/11/2026  
**Môi trường kiểm thử:** Windows Workstation (`Node.js`), mã nguồn `thang-tin-hoc-mobile` (Expo SDK `58.0.22` / React Native `0.88.1` / TypeScript `~6.0.3`), Backend Express + Mongoose models.

> **Nguyên tắc phân loại trung thực:**  
> - **PASS:** Đã chạy lệnh kiểm thử thực tế sau chỉnh sửa cuối cùng và đạt 100%.  
> - **PARTIAL:** Đạt kiểm thử tĩnh/unit/integration trong môi trường cục bộ, nhưng chưa chạy kiểm thử end-to-end trên cụm Mongo/Redis sống hoặc máy thật.  
> - **NOT TESTED:** Chưa có thiết bị vật lý iOS/Android hoặc Release binary để đo thực tế.  
> - **BLOCKED:** Bị chặn bởi việc thiếu tài khoản Apple Developer / Google Play Console / EAS Build / khóa bí mật dịch vụ bên thứ ba.

---

## 1. Bảng kết quả thực thi kiểm thử tự động (Observed Test Runs)

| Bộ kiểm thử | Lệnh thực thi | Kết quả quan sát | Thời gian | Trạng thái |
|---|---|---|---|---|
| Mobile TypeScript Check | `npm --prefix thang-tin-hoc-mobile run typecheck` (`tsc --noEmit`) | Exit code `0` (0 lỗi biên dịch) | ~14s | **PASS** |
| Mobile Unit & Integration Suite | `node --test tests/integration/mobile_*.test.js tests/unit/mobile_*.test.js` | **76 tests**: **74 pass**, **0 fail**, **2 skipped** (2 bài test Docker Mongo `27019` + Redis `6382` trong `mobile_auth_session_mongo.test.js` / `mobile_auth_backend.test.js`) | 805.9ms | **PASS** (trừ 2 test yêu cầu Docker service) |
| Release Compliance Integration Suite (mới) | Nằm trong lần chạy trên: `tests/integration/mobile_release_compliance.test.js` | **5/5 tests pass**: self-delete + CSP/CSRF legal routes; `fflate` `.xlsx` round-trip (không còn `xlsx`); 8 nhóm push + dedup + preferences + `revokeScheduleReminders` + `notification:read-sync`; Chat report/block + chặn gửi 2 chiều; Billing 6 nhóm sản phẩm + fail-closed + chế độ Companion | <200ms | **PASS** |
| Backend Security & Core Regression Suite | `node --test tests/unit/scheduling_validation.test.js tests/unit/sepay_webhook_auth.test.js tests/unit/uploads_auth_certification.test.js tests/unit/google_oauth_disabled.test.js tests/unit/oauth_disabled.test.js` | **20/20 tests pass**, 0 fail | 371.8ms | **PASS** |
| Backend JS Syntax Verification | `node -c` trên toàn bộ 10 file backend chỉnh sửa/tạo mới | `ALL_SYNTAX_OK` (exit code `0`) | <1s | **PASS** |
| Mobile Production Security Audit | `npm --prefix thang-tin-hoc-mobile audit --omit=dev` | **0 High / 0 Critical**, 8 Moderate (chỉ nằm trong `@expo/cli`, `@expo/config`, `node-forge`, `glob`, `minimatch` lúc build/CLI) | ~18s | **PASS** (không còn High/Critical runtime CVE từ `xlsx`) |
| Backend Production Security Audit | `npm audit --omit=dev` (thư mục gốc server) | 13 High CVEs (`mongoose`, `nodemailer`, `puppeteer`/`basic-ftp`/`extract-zip`/`zod`, `xlsx` backend) | ~6s | **PARTIAL / OPEN** (Chưa nằm trong phạm vi nâng cấp gói backend kỳ này) |
| Expo Project Health Check | `npx --yes expo-doctor` trong `thang-tin-hoc-mobile` | **19/20 checks pass**, 1 warning/fail ở mục đồng bộ patch/minor SDK 58 (`react-native-safe-area-context` `5.10.1` vs `~5.11.1`, 12 gói Expo patch cập nhật nhẹ) | ~15s | **PARTIAL** |

---

## 2. Ma trận Kiểm thử Phát hành (Giai đoạn 7)

| Hạng mục kiểm thử | Tình trạng | Bằng chứng & Ghi chú chi tiết |
|---|---|---|
| **Unit test** (Logic lịch, auth session, billing, excel `fflate`, push formatter) | **PASS** | 100% logic thuần chạy qua `node --test` đạt kết quả mong đợi. |
| **Integration test** (Cấu trúc navigation, socket sync, chat report/block, deep links) | **PARTIAL** | 74 tests pass (2 tests cần Docker `docker-compose.mobile-auth-test.yml` Mongo/Redis bỏ qua do môi trường không khởi chạy container Docker). |
| **API test trên Server Live (MongoDB + Redis)** | **NOT TESTED** | Kiểm tra syntax (`node -c`), service logic và middleware mounting thành công; chưa chạy E2E HTTP call vào server đang nối MongoDB thật sau các endpoint mới (`/api/auth/delete-account`, `/api/messages/report`, `/api/messages/block`, `/api/mobile-billing/*`, `/api/mobile-push-tokens/preferences`). |
| **Permission test (Camera, Photos, Micro, Biometrics, Push)** | **PARTIAL** | Audit xác nhận mọi lời gọi xin quyền đều gắn theo thao tác người dùng (không xin tự động lúc mở app); chưa bấm chấp nhận/từ chối trực tiếp trên OS thật iOS/Android. |
| **Notification test (Foreground / Background / Terminated / APNs / FCM)** | **BLOCKED** | Backend push builder (8 nhóm sự kiện), preference filter, deduplication & socket revocation đều **PASS**. Gửi thực tế qua Expo Push -> APNs/FCM đến thiết bị bị chặn vì chưa có EAS build & APNs `.p8` / FCM service credentials. |
| **Payment Sandbox test (Apple StoreKit / Google Play Billing)** | **BLOCKED** | Server verification architecture (`mobileBillingService.js`, `MobileBillingTransaction`), idempotency, restore purchases & refund webhook hoàn thiện; **BLOCKED** ở bước gọi App Store Server API / Play Developer API thật do chưa có Developer Accounts & Product SKUs. |
| **Security test** | **PASS / PARTIAL** | Đã gỡ `xlsx` khỏi Mobile (0 High CVE), bắt buộc re-auth khi xóa tài khoản, fail-closed billing verifier & webhook secret checking, nonce CSP + CSRF cho trang web xóa tài khoản. Backend gốc cần nâng cấp `mongoose`/`nodemailer` trong đợt bảo trì server tiếp theo. |
| **UI/E2E trên nhiều kích thước màn hình (nhỏ/lớn, tai thỏ, bàn phím)** | **NOT TESTED** | Chưa chạy trên iPhone SE / Android màn hình nhỏ / iPad Simulator trong phiên làm việc Windows hiện tại. |
| **Kiểm thử bản Release (`production` AAB / IPA) & Cold Start / FPS / RAM** | **NOT TESTED / BLOCKED** | Chưa chạy `eas build --profile production` (yêu cầu đăng nhập EAS & Apple/Google credentials). |
| **Kiểm thử tài khoản Học viên / Giảng viên / Admin & Review Flow** | **NOT TESTED** | Chưa có staging URL công khai và tài khoản reviewer chuyên biệt được cấp phát để test end-to-end. |
| **Deep Link & Restore Purchases trên thiết bị thật** | **PARTIAL** | Cấu trúc `linking.ts`, `app.json` (`scheme`, `associatedDomains`, `intentFilters`) và endpoint `/api/mobile-billing/restore` đã hoàn chỉnh; **chưa test** bấm link từ Zalo/Trình duyệt trên máy thật. |

---

## 3. Các lỗi còn tồn tại / Việc cần xử lý tiếp trước ngày nộp Store

1. **Expo Doctor (Minor/Patch mismatch):** Chạy `npx expo install --check` bên trong `thang-tin-hoc-mobile` trước khi tạo bản build EAS Production.
2. **File Lock (`package-lock.json`):** Chạy `npm --prefix thang-tin-hoc-mobile install --package-lock-only` để đồng bộ triệt để `package-lock.json` sau khi đã gỡ `"xlsx"` khỏi `package.json`.
3. **Màn hình danh sách dài trên Mobile:** Cần profile FPS trên thiết bị Release Android tầm trung cho `CourseVideosScreen.tsx` & `FeatureScreens.tsx`; nếu xuất hiện rớt khung hình khi danh sách khóa học/bài tập > 50 mục thì chuyển đổi `ScrollView + map` sang `FlatList` tối ưu (`windowSize`, `removeClippedSubviews`).
4. **Cấu hình Splash Screen tường minh:** Bổ sung block `"splash"` hoặc plugin `"expo-splash-screen"` vào `thang-tin-hoc-mobile/app.json` trỏ đến `./assets/splash-icon.png` đang có sẵn trong repo.
