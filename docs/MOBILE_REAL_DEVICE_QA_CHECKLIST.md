# Checklist Kiểm Thử Thiết Bị Thật Mobile (Android & iPhone) — AI DewSkill Pilot

> **Lưu ý quan trọng:** Việc kiểm tra TypeScript (`tsc --noEmit`) và đóng gói Metro/Hermes bundle (`npx expo export`) mới xác minh ở tầng mã nguồn & đóng gói. **BẮT BUỘC** thực hiện checklist dưới đây trực tiếp trên **tối thiểu 1 máy Android thật** và **1 máy iPhone (iOS) thật** trước khi mời học viên Mobile vào đợt Pilot.

---

## 1. Chuẩn bị môi trường kiểm thử trên máy thật

1. **Ứng dụng & kết nối API Staging (`http://192.168.1.30:5055` hoặc HTTPS Staging Tunnel):**
   - Mở `thang-tin-hoc-mobile` qua **Expo Go**, **Development Build** (`eas build --profile development`), hoặc **Internal Preview Build** (`eas build --profile preview`).
   - File `thang-tin-hoc-mobile/.env` đã trỏ `EXPO_PUBLIC_MOBILE_API_BASE_URL=http://192.168.1.30:5055` (TUYỆT ĐỐI không dùng `localhost` hay `127.0.0.1` trên điện thoại thật; nếu điện thoại khác mạng Wi-Fi LAN, dùng URL HTTPS reverse proxy / tunnel trỏ vào cổng Staging `5055`).
   - Mở thử `http://192.168.1.30:5055/healthz` trên trình duyệt của chính chiếc điện thoại test trước khi mở app để bảo đảm mạng Wi-Fi/Firewall thông suốt (`{"ok":true}`).
2. **Tài khoản kiểm thử Staging (dữ liệu giả lập — 0 PII học viên thật):**
   - **Tài khoản Học viên Canary (được bật RAG):** SĐT `0900000104` / mật khẩu `StagingPilot@2026!Only` (ID `690000000000000000000104`).
   - **Tài khoản Giảng viên Canary (được bật RAG + kiểm tra phân quyền dữ liệu GV):** SĐT `0900000102` / mật khẩu `StagingPilot@2026!Only` (ID `690000000000000000000102`).
   - **Tài khoản Học viên đối chứng ngoài Canary (Legacy):** SĐT `0900000105` / mật khẩu `StagingPilot@2026!Only` (ID `690000000000000000000105`).
   - **Tài khoản Học viên bị giới hạn quyền (`FreePortal` chưa mở khóa):** SĐT `0900000106` / mật khẩu `StagingPilot@2026!Only` (ID `690000000000000000000106`).
   - *Lưu ý thiết bị cố định & phiên đăng nhập:* Mỗi tài khoản hỗ trợ tối đa **2 thiết bị cố định** (1 máy Android + 1 máy iPhone); khi đăng nhập thiết bị thứ 2 trên cùng SĐT, phiên trên thiết bị thứ 1 sẽ tự đăng xuất theo chính sách bảo mật 1 phiên hoạt động. Kiểm tra dashboard Admin bằng tài khoản `0900000101` (Web).
3. **Thiết bị tối thiểu cần test:**
   - **Android thật:** Tối thiểu 1 máy màn hình nhỏ/trung bình (`width ≤ 375dp`, Android 11+).
   - **iPhone / iOS thật:** Tối thiểu 1 máy iPhone (màn hình chuẩn `375pt` như iPhone SE/mini/13 trở lên, iOS 16+).

---

## 2. Bảng tổng hợp trạng thái 11 bài kiểm thử (`M01`–`M11`)

| Mã | Hạng mục kiểm thử | Tài khoản sử dụng | Android (Máy thật) | iPhone / iOS (Máy thật) | Vị trí ghi lỗi & Ảnh chụp màn hình |
|---|---|---| :---: | :---: |---|
| **M01** | Đăng nhập tài khoản Canary & kiểm tra đối chứng | `0900000104` / `0900000105` / `0900000106` | `[ ] Đạt` / `[ ] Không đạt` | `[ ] Đạt` / `[ ] Không đạt` | `Lỗi: ______` / `Ảnh: M01_...png` |
| **M02** | Mở popup AI DewSkill từ nút AI trên đầu màn hình | `0900000104` | `[ ] Đạt` / `[ ] Không đạt` | `[ ] Đạt` / `[ ] Không đạt` | `Lỗi: ______` / `Ảnh: M02_...png` |
| **M03** | Gửi câu hỏi & nhận phản hồi RAG đúng giáo trình MOS 2016/2019/365 | `0900000104` | `[ ] Đạt` / `[ ] Không đạt` | `[ ] Đạt` / `[ ] Không đạt` | `Lỗi: ______` / `Ảnh: M03_...png` |
| **M04** | Hiển thị bảng Markdown & công thức Excel | `0900000104` | `[ ] Đạt` / `[ ] Không đạt` | `[ ] Đạt` / `[ ] Không đạt` | `Lỗi: ______` / `Ảnh: M04_...png` |
| **M05** | Cuộn ngang bảng dài & cuộn dọc hội thoại | `0900000104` | `[ ] Đạt` / `[ ] Không đạt` | `[ ] Đạt` / `[ ] Không đạt` | `Lỗi: ______` / `Ảnh: M05_...png` |
| **M06** | Bàn phím ảo (Soft Keyboard) không che ô nhập / nút Gửi | `0900000104` | `[ ] Đạt` / `[ ] Không đạt` | `[ ] Đạt` / `[ ] Không đạt` | `Lỗi: ______` / `Ảnh: M06_...png` |
| **M07** | Nút phản hồi `Hữu ích` & chống gửi trùng | `0900000104` | `[ ] Đạt` / `[ ] Không đạt` | `[ ] Đạt` / `[ ] Không đạt` | `Lỗi: ______` / `Ảnh: M07_...png` |
| **M08** | Nút phản hồi `Chưa chính xác`, nhập lý do & xác nhận `pending_admin_review` | `0900000104` | `[ ] Đạt` / `[ ] Không đạt` | `[ ] Đạt` / `[ ] Không đạt` | `Lỗi: ______` / `Ảnh: M08_...png` |
| **M09** | Mất mạng / Chế độ máy bay & nút `Thử lại` | `0900000104` | `[ ] Đạt` / `[ ] Không đạt` | `[ ] Đạt` / `[ ] Không đạt` | `Lỗi: ______` / `Ảnh: M09_...png` |
| **M10** | Đóng popup AI DewSkill bằng nút `X`, chạm nền tối & nút Back | `0900000104` | `[ ] Đạt` / `[ ] Không đạt` | `[ ] Đạt` / `[ ] Không đạt` | `Lỗi: ______` / `Ảnh: M10_...png` |
| **M11** | Kiểm tra bố cục màn hình nhỏ (`360px–375px`), tăng cỡ chữ & phân quyền GV/Đối chứng/Khóa | `0900000102` / `0900000105` / `0900000106` | `[ ] Đạt` / `[ ] Không đạt` | `[ ] Đạt` / `[ ] Không đạt` | `Lỗi: ______` / `Ảnh: M11_...png` |

---

## 3. Chi tiết từng bài kiểm thử thao tác thật (`M01`–`M11`)

### M01 – Đăng nhập Staging bằng tài khoản Canary, Đối chứng và Tài khoản bị giới hạn quyền
- **Mục tiêu kiểm thử:** Xác nhận ứng dụng Mobile kết nối đúng API Staging (`192.168.1.30:5055` hoặc HTTPS Staging), đăng nhập đa phiên hoạt động ổn định và tôn trọng trạng thái giới hạn quyền `FreePortal`.
- **Tài khoản Staging cần sử dụng:** `0900000104` (Canary HV), `0900000105` (Đối chứng Legacy), `0900000106` (FreePortal khóa). Mật khẩu chung: `StagingPilot@2026!Only`.
- **Các bước thao tác:**
  1. Mở app trên điện thoại thật, kiểm tra kết nối Staging `/healthz`.
  2. Thử đăng nhập tài khoản `0900000106` → kiểm tra giao diện bị giới hạn quyền LMS/AI. Đăng xuất.
  3. Đăng nhập tài khoản `0900000105` → vào màn hình chính bình thường, sau đó đăng xuất.
  4. Đăng nhập tài khoản Canary `0900000104` → giữ phiên để chạy `M02`–`M10`.
- **Kết quả mong đợi:** Cả `0900000104` và `0900000105` đăng nhập thành công, các tab LMS hiển thị bình thường; tài khoản `0900000106` bị khóa quyền truy cập AI/các mục trả phí (`FREE_PORTAL_LOCKED`).
- **Kết quả:** Android: `[ ] Đạt` `[ ] Không đạt` | iPhone / iOS: `[ ] Đạt` `[ ] Không đạt`
- **Vị trí ghi lỗi & Ảnh chụp màn hình:** `Mô tả lỗi: ___________________ | File ảnh: ___________________`

### M02 – Mở popup/sheet AI DewSkill mà không phá vỡ bố cục LMS
- **Mục tiêu kiểm thử:** Xác minh nút **AI** trên thanh tiêu đề mở đúng giao diện tìm kiếm AI hợp nhất, giữ nguyên danh sách đi tới nhanh và gợi ý câu hỏi.
- **Tài khoản Staging cần sử dụng:** `0900000104` (Học viên Canary).
- **Các bước thao tác:**
  1. Tại màn hình chính học viên, chạm nút **AI** ở thanh tiêu đề trên cùng.
  2. Quan sát hiệu ứng mở popup/sheet, thanh tìm nhanh, các chip gợi ý câu hỏi và ô nhập câu hỏi phía dưới.
- **Kết quả mong đợi:** Popup `DewSkill AI` mở mượt trong `< 300ms`, không giật màn hình, không che mất nút đóng `X`, giữ nguyên cấu trúc giao diện hiện tại.
- **Kết quả:** Android: `[ ] Đạt` `[ ] Không đạt` | iPhone / iOS: `[ ] Đạt` `[ ] Không đạt`
- **Vị trí ghi lỗi & Ảnh chụp màn hình:** `Mô tả lỗi: ___________________ | File ảnh: ___________________`

### M03 – Gửi câu hỏi Tin học văn phòng & kiểm tra RAG đúng giáo trình MOS 2016/2019/365
- **Mục tiêu kiểm thử:** Xác nhận câu trả lời trên máy thật bám sát giáo trình nội bộ (phân biệt Office 2016 vs 365, có nguồn trích dẫn) và vẫn giữ bộ lọc ngoài phạm vi.
- **Tài khoản Staging cần sử dụng:** `0900000104` (Học viên Canary).
- **Các bước thao tác:**
  1. Gửi câu hỏi 1: *"Trong MOS Excel 2016 (77-727) có dùng được XLOOKUP không? Thay bằng hàm nào?"*.
  2. Quan sát trạng thái *"DewSkill AI đang suy nghĩ..."* cho đến khi nhận câu trả lời.
  3. Gửi câu hỏi 2: *"Cách tạo Mục lục tự động Table of Contents trong Word và chèn Slide Master trong PowerPoint"*.
  4. Gửi câu hỏi ngoài phạm vi: *"Tư vấn tình yêu giúp mình"* hoặc *"Cách nấu phở bò"*.
- **Kết quả mong đợi:** Câu 1 trả lời **KHÔNG có `XLOOKUP` trong Excel 2016**, gợi ý `VLOOKUP` / `INDEX+MATCH` và trích nguồn giáo trình Excel 2016; Câu 2 hướng dẫn chuẩn theo giáo trình Word/PowerPoint; Câu ngoài phạm vi bị từ chối lịch sự ngay lập tức.
- **Kết quả:** Android: `[ ] Đạt` `[ ] Không đạt` | iPhone / iOS: `[ ] Đạt` `[ ] Không đạt`
- **Vị trí ghi lỗi & Ảnh chụp màn hình:** `Mô tả lỗi: ___________________ | File ảnh: ___________________`

### M04 – Hiển thị bảng Markdown và công thức Excel bằng font monospace
- **Mục tiêu kiểm thử:** Kiểm tra thành phần hiển thị Markdown (bảng, cột, viền ô, công thức `=VLOOKUP(...)`, code inline) không bị vỡ hoặc hiện ký tự thô `|---|---|`.
- **Tài khoản Staging cần sử dụng:** `0900000104` (Học viên Canary).
- **Các bước thao tác:**
  1. Gửi câu hỏi: *"So sánh hàm VLOOKUP và XLOOKUP bằng bảng ngắn gọn kèm ví dụ công thức"*.
  2. Kiểm tra phần bảng kẻ ô, tiêu đề cột, hàng xen kẽ và thẻ công thức.
- **Kết quả mong đợi:** Bảng Markdown hiển thị rõ ràng với tiêu đề nổi bật, hàng xen kẽ, căn lề chuẩn; công thức Excel dùng đúng font monospace dễ đọc.
- **Kết quả:** Android: `[ ] Đạt` `[ ] Không đạt` | iPhone / iOS: `[ ] Đạt` `[ ] Không đạt`
- **Vị trí ghi lỗi & Ảnh chụp màn hình:** `Mô tả lỗi: ___________________ | File ảnh: ___________________`

### M05 – Cuộn ngang bảng Markdown dài & cuộn dọc danh sách hội thoại
- **Mục tiêu kiểm thử:** Đảm bảo cử chỉ vuốt ngang (`ScrollView horizontal`) trên bảng/khối công thức không xung đột với cuộn dọc danh sách tin nhắn.
- **Tài khoản Staging cần sử dụng:** `0900000104` (Học viên Canary).
- **Các bước thao tác:**
  1. Trên bảng trả lời ở `M04`, đặt ngón tay vuốt sang trái/phải ngay trên vùng bảng.
  2. Gửi thêm 2 câu hỏi ngắn để tạo danh sách dài hơn 1 màn hình rồi vuốt lên/xuống toàn danh sách.
- **Kết quả mong đợi:** Bảng cuộn ngang mượt để đọc hết các cột không bị cắt chữ; toàn khung hội thoại cuộn dọc mượt không khựng hay kẹt cảm ứng.
- **Kết quả:** Android: `[ ] Đạt` `[ ] Không đạt` | iPhone / iOS: `[ ] Đạt` `[ ] Không đạt`
- **Vị trí ghi lỗi & Ảnh chụp màn hình:** `Mô tả lỗi: ___________________ | File ảnh: ___________________`

### M06 – Kiểm tra bàn phím ảo (Soft Keyboard) không che ô nhập hoặc nút Gửi
- **Mục tiêu kiểm thử:** Xác nhận `KeyboardAvoidingView` (`height` trên Android, `padding` trên iOS) đẩy ô nhập câu hỏi và ô nhập lý do `Chưa chính xác` lên đúng vị trí nhìn thấy được.
- **Tài khoản Staging cần sử dụng:** `0900000104` (Học viên Canary).
- **Các bước thao tác:**
  1. Chạm vào ô nhập câu hỏi cuối popup → gõ thử 2 dòng văn bản khi bàn phím ảo đang mở.
  2. Chạm nút `Chưa chính xác` → chạm vào ô nhập lý do → kiểm tra nút `Gửi` và `Hủy` khi bàn phím ảo đang bật.
- **Kết quả mong đợi:** Toàn bộ ô nhập và nút bấm (`Gửi` / `Hủy`) nằm hoàn toàn phía trên bàn phím ảo trên cả Android lẫn iPhone (kể cả máy có thanh điều hướng cử chỉ / Dynamic Island / notch).
- **Kết quả:** Android: `[ ] Đạt` `[ ] Không đạt` | iPhone / iOS: `[ ] Đạt` `[ ] Không đạt`
- **Vị trí ghi lỗi & Ảnh chụp màn hình:** `Mô tả lỗi: ___________________ | File ảnh: ___________________`

### M07 – Kiểm tra nút đánh giá `Hữu ích` & cơ chế chống gửi trùng
- **Mục tiêu kiểm thử:** Xác nhận học viên chạm `Hữu ích` gửi phản hồi về API Staging thành công và nút tự khóa để chống spam/gửi trùng.
- **Tài khoản Staging cần sử dụng:** `0900000104` (Học viên Canary).
- **Các bước thao tác:**
  1. Dưới câu trả lời ở `M03`, chạm nút **`Hữu ích`**.
  2. Quan sát thông báo phản hồi, trạng thái đổi màu của nút và thử chạm lại lần thứ 2.
- **Kết quả mong đợi:** Hiện thông báo `"Cảm ơn bạn đã đánh giá hữu ích!"`, nút chuyển màu xanh và khóa thao tác gửi trùng khi chạm lần 2.
- **Kết quả:** Android: `[ ] Đạt` `[ ] Không đạt` | iPhone / iOS: `[ ] Đạt` `[ ] Không đạt`
- **Vị trí ghi lỗi & Ảnh chụp màn hình:** `Mô tả lỗi: ___________________ | File ảnh: ___________________`

### M08 – Kiểm tra nút `Chưa chính xác`, nhập lý do & xác nhận chờ Admin duyệt
- **Mục tiêu kiểm thử:** Xác nhận luồng góp ý lỗi AI hoạt động đầy đủ và **không tự động ghi vào kho tri thức RAG**.
- **Tài khoản Staging cần sử dụng:** `0900000104` (Canary HV để gửi) + `0900000101` (Admin trên Web Staging `/admin` để kiểm tra bản ghi).
- **Các bước thao tác:**
  1. Dưới câu trả lời ở `M04`, chạm nút **`Chưa chính xác`**.
  2. Nhập lý do ngắn: *"Kiểm thử máy thật M08 – cần ví dụ MOS 2016 rõ hơn"* → bấm **`Gửi`**.
  3. Mở dashboard Admin kiểm tra danh sách phản hồi chờ duyệt (`GET /api/ai-support/admin/rag-feedback`).
- **Kết quả mong đợi:** Mobile hiện `"Đã gửi góp ý để Admin kiểm tra!"`; trên Admin thấy bản ghi ở trạng thái `pending_admin_review` và `autoPromotedToKnowledge: false`.
- **Kết quả:** Android: `[ ] Đạt` `[ ] Không đạt` | iPhone / iOS: `[ ] Đạt` `[ ] Không đạt`
- **Vị trí ghi lỗi & Ảnh chụp màn hình:** `Mô tả lỗi: ___________________ | File ảnh: ___________________`

### M09 – Xử lý mất mạng đột ngột & nút `Thử lại`
- **Mục tiêu kiểm thử:** Xác minh app xử lý mất kết nối sạch sẽ, báo sự cố mạng dễ hiểu, ghi telemetry không PII và cho phép gửi lại bằng nút **`Thử lại`**.
- **Tài khoản Staging cần sử dụng:** `0900000104` (Học viên Canary).
- **Các bước thao tác:**
  1. Bật **Chế độ máy bay** (hoặc tắt Wi-Fi + 4G) trên điện thoại.
  2. Gửi một câu hỏi mới chưa có trong cache (VD: *"Cách dùng Conditional Formatting tô màu theo điều kiện trong Excel 2019"*).
  3. Quan sát thông báo lỗi → tắt Chế độ máy bay → chạm nút **`Thử lại`**.
- **Kết quả mong đợi:** Không treo spinner vô hạn, không văng app; hiện thông báo lỗi mạng kèm nút **`Thử lại`**; khi có mạng trở lại và chạm **`Thử lại`**, AI trả lời thành công.
- **Kết quả:** Android: `[ ] Đạt` `[ ] Không đạt` | iPhone / iOS: `[ ] Đạt` `[ ] Không đạt`
- **Vị trí ghi lỗi & Ảnh chụp màn hình:** `Mô tả lỗi: ___________________ | File ảnh: ___________________`

### M10 – Đóng popup AI DewSkill & khôi phục tương tác màn hình chính
- **Mục tiêu kiểm thử:** Xác minh người dùng thoát popup bằng mọi cách (nút `X`, chạm nền tối backdrop, nút/vuốt Back vật lý trên Android) không bị kẹt màn hình.
- **Tài khoản Staging cần sử dụng:** `0900000104` (Học viên Canary).
- **Các bước thao tác:**
  1. Mở popup AI → bấm nút **`X`** góc trên → xác nhận đóng và bấm thử một mục trên màn hình chính.
  2. Mở lại popup → chạm ra vùng nền tối phía ngoài (backdrop).
  3. (Trên Android) Mở lại popup → bấm/vuốt phím **Back** của hệ thống.
- **Kết quả mong đợi:** Modal đóng hoàn toàn ở cả 3 cách thao tác, màn hình LMS phía dưới cuộn và chạm bình thường.
- **Kết quả:** Android: `[ ] Đạt` `[ ] Không đạt` | iPhone / iOS: `[ ] Đạt` `[ ] Không đạt`
- **Vị trí ghi lỗi & Ảnh chụp màn hình:** `Mô tả lỗi: ___________________ | File ảnh: ___________________`

### M11 – Bố cục màn hình nhỏ (`360px–375px`), tăng cỡ chữ & kiểm tra phân quyền GV vs Đối chứng
- **Mục tiêu kiểm thử:** Kiểm tra chống tràn lề trên màn hình nhỏ (`width ≤ 375px`) khi bật cỡ chữ lớn hệ thống, đồng thời xác nhận tài khoản Đối chứng (`0900000105`) không dùng RAG và tài khoản Giảng viên (`0900000102`) dùng được đúng quyền giáo viên.
- **Tài khoản Staging cần sử dụng:** `0900000105` (Đối chứng Legacy) và `0900000102` (Giảng viên Canary).
- **Các bước thao tác:**
  1. Bật cỡ chữ lớn (**Large Text / Font Size +2 bậc**) trong Cài đặt điện thoại có màn hình ngang `360px–375px`.
  2. Đăng nhập **`0900000105`** (Đối chứng): gửi câu hỏi ngoài phạm vi *"Xe máy Vision giá bao nhiêu?"* và câu Excel *"Hàm IF trong Excel"* → kiểm tra khung chữ, 2 nút `Hữu ích` / `Chưa chính xác`.
  3. Đăng xuất, đăng nhập **`0900000102`** (Giảng viên Canary): gửi câu Word/Excel chuyên môn và kiểm tra hướng dẫn giảng viên.
- **Kết quả mong đợi:** Thanh tiêu đề, nút **AI**, bảng Markdown, 2 nút `Hữu ích` / `Chưa chính xác` không tràn mép ngang hay chồng chữ ở màn hình nhỏ + cỡ chữ lớn; tài khoản `0900000105` vẫn bị lọc ngoài phạm vi và không mở được menu Admin; tài khoản `0900000102` truy vấn bình thường với quyền giảng viên.
- **Kết quả:** Android: `[ ] Đạt` `[ ] Không đạt` | iPhone / iOS: `[ ] Đạt` `[ ] Không đạt`
- **Vị trí ghi lỗi & Ảnh chụp màn hình:** `Mô tả lỗi: ___________________ | File ảnh: ___________________`

---

## 4. Xác nhận kết quả kiểm thử thiết bị thật (QA / Admin ký duyệt)

- **Android Model & OS kiểm thử:** `_________________________` | **Người test:** `________________` | **Ngày:** `____/____/2026` | **Kết quả:** `[ ] ĐẠT` / `[ ] KHÔNG ĐẠT`
- **iPhone Model & iOS kiểm thử:** `_________________________` | **Người test:** `________________` | **Ngày:** `____/____/2026` | **Kết quả:** `[ ] ĐẠT` / `[ ] KHÔNG ĐẠT`
- **Tổng số lỗi Nghiêm trọng (Blocker/Critical):** `_____ (Bắt buộc = 0 mới được duyệt Pilot)`
- **Thư mục lưu ảnh chụp màn hình / video lỗi:** `_______________________________________________________________`
- **Ghi nhận lỗi hiển thị hoặc mạng (nếu có):** `__________________________________________________________________`
