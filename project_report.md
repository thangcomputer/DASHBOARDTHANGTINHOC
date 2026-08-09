# Báo cáo Cấu trúc Dự án & Luồng hoạt động - DASHBOARDTHANGTINHOC

Tài liệu này cung cấp cái nhìn tổng quan về kiến trúc phần mềm, danh sách thư mục/tệp tin, và luồng hoạt động nghiệp vụ chính của hệ thống quản lý học viên **Thắng Tin Học**.

---

## 1. Công nghệ sử dụng (Tech Stack)

Hệ thống được xây dựng trên mô hình **Fullstack Javascript** hiện đại:
*   **Backend**: Node.js, Express.js (REST API & Socket.io)
*   **Frontend**: React (Vite, TailwindCSS, Lucide Icons, Recharts)
*   **Database**: MongoDB (sử dụng thư viện Mongoose để quản lý Schema)
*   **Caching & Queue**: Redis (kết hợp BullMQ xử lý tác vụ nền)
*   **Quản lý tiến trình**: PM2 (`ecosystem.config.cjs`)
*   **Môi trường chạy**: Hỗ trợ Docker & Deploy lên VPS qua SSH Script.

---

## 2. Bản đồ Thư mục & Tệp tin (Project Tree)

Dưới đây là sơ đồ tổ chức thư mục của dự án và chức năng của từng phần:

```text
DASHBOARDTHANGTINHOC (Thư mục gốc - Backend)
├── server.js               # Khởi chạy Express server, kết nối DB, định tuyến API & Socket.io
├── worker.js               # Khởi chạy các background jobs (BullMQ) như gửi Email, kiểm tra lịch
├── package.json            # Quản lý thư viện cài đặt & Script chạy lệnh Backend
├── ecosystem.config.cjs    # Cấu hình PM2 chạy daemons trên môi trường production
├── .env.example            # Tệp ví dụ cấu hình biến môi trường
│
├── config/                 # Cấu hình hệ thống (Database, Redis, Mailer, Logger)
├── constants/              # Chứa các hằng số hệ thống (Quyền hạn - PERMISSIONS, Vai trò - ROLES)
├── controllers/            # Xử lý logic nghiệp vụ tách biệt từ Routes (MVC Pattern)
│   ├── branchController.js     # Quản lý Chi nhánh/Cơ sở
│   └── settingsController.js   # Quản lý Cài đặt hệ thống
├── middleware/             # Các bộ lọc trung gian (Xác thực Auth, phân quyền, upload file)
├── models/                 # Chức năng định nghĩa các bảng dữ liệu trong MongoDB (Mongoose Schemas)
│   ├── Student.js              # Hồ sơ học viên & các khóa học đăng ký (enrollments)
│   ├── Teacher.js              # Thông tin giảng viên & lịch dạy
│   ├── Course.js               # Danh mục khóa học
│   ├── Branch.js               # Danh mục chi nhánh/cơ sở
│   └── ...
├── routes/                 # Định nghĩa các cổng API đầu cuối (Endpoints)
│   ├── authRoutes.js           # Đăng nhập, đăng xuất, đổi mật khẩu, OTP
│   ├── studentRoutes.js        # API CRUD học viên, thêm khóa học, thanh toán, hủy khóa
│   ├── branchRoutes.js         # API Quản lý chi nhánh
│   └── ...
├── services/               # Các tầng dịch vụ xử lý logic độc lập (Gửi mail, BI, Quản lý Tenant)
├── shared/                 # Middleware và logic dùng chung cho các module
├── tests/                  # Bộ mã nguồn phục vụ kiểm thử tự động (Integration Tests)
├── uploads/                # Thư mục chứa tài nguyên tĩnh do người dùng tải lên (Avatar, hóa đơn)
│
└── client/                 # Thư mục Frontend (React + Vite)
    ├── vite.config.js      # Cấu hình Vite, Proxy chuyển tiếp API tới port 5000 khi dev
    ├── package.json        # Thư viện Frontend (React, Socket.io-client, TailwindCSS)
    ├── index.html          # File HTML gốc của ứng dụng
    └── src/                # Mã nguồn React
        ├── main.jsx        # Điểm khởi đầu của ứng dụng React
        ├── App.jsx         # Cấu hình định tuyến (Routing) chính của Client
        ├── index.css       # File định nghĩa Style chính (Tailwind CSS)
        ├── components/     # Chứa các giao diện (Dashboard, Chat, Quản lý tài chính, Lịch học)
        ├── context/        # Quản lý State toàn cục (SocketContext, BranchContext, AuthContext)
        ├── services/       # File `api.js` giao tiếp API với Backend
        └── utils/          # Các helper xử lý chuỗi, định dạng tiền, phát âm thanh báo động
```

---

## 3. Luồng Hoạt động Nghiệp vụ Chính (Core Workflows)

### 3.1. Luồng Xác thực & Bảo mật (Authentication Flow)
1.  **Đăng nhập**: Người dùng điền thông tin đăng nhập. Backend sinh **Access Token** (JWT lưu ngắn hạn) và **Refresh Token** (JWT lưu dài hạn trong DB).
2.  **Bảo vệ API**: Mọi API mutated (POST, PUT, DELETE) đều được bảo vệ bằng cơ chế **CSRF** (sử dụng token ngẫu nhiên gửi qua Header) và kiểm tra quyền (`checkPermission`) trước khi xử lý.
3.  **Hết hạn phiên**: Khi Access Token hết hạn (401), Frontend tự động gửi Refresh Token tới `/api/auth/refresh` lấy cặp token mới mà không bắt người dùng đăng nhập lại (Silent Refresh).

### 3.2. Luồng Phân cấp Chi nhánh (Multi-branch / Multi-tenant)
Hệ thống hỗ trợ quản lý phân quyền theo chi nhánh rất chặt chẽ:
*   **SUPER_ADMIN (Master)**: Có quyền tối cao, nhìn thấy và quản lý được học viên/giảng viên của toàn bộ các chi nhánh, tùy chọn lọc chi nhánh thông qua thanh menu (`BranchContext.jsx`).
*   **STAFF (Nhân viên cơ sở)**: Chỉ xem và quản lý được học viên thuộc chi nhánh mà mình được phân công (`staffBranchId` bị khóa cứng tại Backend).
*   **TEACHER & STUDENT**: Bị giới hạn thông tin dạy và học theo lớp/khóa học đăng ký.

### 3.3. Luồng Quản lý Khóa học & Học phí của Học viên
Hệ thống sử dụng cơ chế **Lịch sử đăng ký (Enrollments)** để quản lý đa khóa học:
1.  **Đăng ký khóa**: Khi học viên đăng ký, một bản ghi mới được đẩy vào mảng `enrollments` của học viên đó bao gồm: tên khóa, giá tiền, số buổi học mặc định (12 buổi).
2.  **Đóng học phí**: Nhân viên xác nhận đóng học phí thông qua API thanh toán. Trạng thái chuyển thành `paid: true`. Hệ thống ghi nhận doanh thu vào Sổ cái (Ledger) dựa trên mã QR và nội dung chuyển khoản tự động.
3.  **Phân công giảng viên**: Sau khi đóng tiền, học viên được gán với một giảng viên dạy kèm khóa học đó.
4.  **Hủy khóa & Hoàn tiền (Refund)**: 
    *   Khi học viên rút lui, admin chọn "Hủy & hoàn tiền".
    *   Hệ thống kiểm tra quyền Tài chính (`MANAGE_FINANCE`), ghi nhận khoản tiền hoàn vào Sổ cái.
    *   Cập nhật trạng thái khóa học trong `enrollments` thành `status: 'cancelled'`, chuyển `paid: false`.
    *   Cập nhật thông tin chung của học viên (nếu là khóa cuối cùng bị hủy thì đặt lại trạng thái chung thành `(Đã hủy)` để tránh lỗi trống dữ liệu).

### 3.4. Luồng Chat & Thông báo Thời gian thực (Real-time Message Flow)
1.  Frontend kết nối với Backend thông qua **Socket.io** (`SocketContext.jsx`).
2.  Khi có tin nhắn mới hoặc thông báo (ví dụ học viên nộp bài, giáo viên báo cáo số buổi dạy):
    *   Backend nhận sự kiện gửi tin từ Client, lưu vào MongoDB.
    *   Backend phát (emit) sự kiện tới người nhận thông qua Socket Channel.
    *   Frontend của người nhận lắng nghe sự kiện, tự phát âm thanh cảnh báo (`sound.js`) và đẩy thông báo popup thời gian thực mà không cần tải lại trang.

### 3.5. Luồng Tác vụ nền (Background Cron Jobs)
Sử dụng **BullMQ + Redis** hoặc **node-cron** chạy độc lập với Express server:
*   Định kỳ (hằng ngày/hằng giờ) kiểm tra lịch học của học viên.
*   Tự động gửi email thông báo nhắc nhở đóng học phí hoặc cảnh báo số buổi học sắp hết (`remainingSessions <= 2`).
*   Quét dọn các tài khoản ảo hoặc dữ liệu tạm cũ trong hệ thống.
