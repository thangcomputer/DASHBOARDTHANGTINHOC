# QUANLYCMS — Tài liệu kỹ thuật

Tài liệu này dành cho đội kỹ thuật bảo trì lâu dài. Phần cài đặt nhanh và biến môi trường xem [README.md](../README.md).

**Production:** `https://dashboard.giasutinhoc24h.com`  
**Stack:** Express 5 + MongoDB + Socket.io (backend) · React 19 + Vite + Tailwind (frontend)

---

## Mục lục

1. [Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [Khởi động & luồng request](#3-khởi-động--luồng-request)
4. [Định tuyến Frontend](#4-định-tuyến-frontend)
5. [Vai trò & phân quyền](#5-vai-trò--phân-quyền)
6. [Xác thực & bảo mật](#6-xác-thực--bảo-mật)
7. [Map API Backend](#7-map-api-backend)
8. [Models MongoDB](#8-models-mongodb)
9. [Luồng nghiệp vụ chính](#9-luồng-nghiệp-vụ-chính)
10. [State management (React Context)](#10-state-management-react-context)
11. [Socket.io — sự kiện realtime](#11-socketio--sự-kiện-realtime)
12. [Bảng tra cứu: sửa lỗi vào file nào](#12-bảng-tra-cứu-sửa-lỗi-vào-file-nào)
13. [Chạy local & deploy VPS](#13-chạy-local--deploy-vps)
14. [Quy ước code & lưu ý vận hành](#14-quy-ước-code--lưu-ý-vận-hành)
15. [Tài liệu liên quan](#15-tài-liệu-liên-quan)

---

## 1. Kiến trúc tổng quan

```
┌──────────────────────────────────────────────────────────────────┐
│  TRÌNH DUYỆT                                                      │
│  React (Vite)  :5173 dev  |  client/dist static khi production   │
│                                                                   │
│  App.jsx → Providers → Components                                │
│  api.js  →  HTTP /api/*  +  Socket.io (JWT trong handshake)      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│  NODE.JS / EXPRESS  :5000                                         │
│  server.js → middleware → routes/*.js → models/*.js               │
│  Socket.io (cùng process với HTTP server)                        │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│  MongoDB (Mongoose)     │  Redis (tuỳ chọn — blacklist/cache/BullMQ) │
└──────────────────────────────────────────────────────────────────┘
```

Services layer (`services/`): notification, file, backup, monitoring, AI, BI, workflow, form/report, tenant, queue.

**Dev:** Vite proxy `/api` → `http://localhost:5000` (`client/vite.config.js`).  
**Prod:** Apache/Nginx serve `client/dist`, reverse proxy `/api` và WebSocket về Node (PM2).

---

## 2. Cấu trúc thư mục

```
QUANLYCMS/
├── server.js                 # Entry backend: Express, Socket.io, mount routes
├── config/
│   ├── db.js                 # Kết nối MongoDB
│   ├── redis.js              # Redis (optional)
│   ├── logger.js             # Pino logger
│   └── ensureIndexes.js      # Index MongoDB
├── middleware/
│   ├── auth.js               # JWT, isAdmin, isTeacher, isStudent
│   ├── tokenBlacklist.js     # Blacklist access token (memory / Redis)
│   ├── branchFilter.js       # Lọc dữ liệu theo chi nhánh (fail-closed)
│   ├── rateLimit.js          # Rate limit auth & API
│   ├── masterAdmin.js        # Super Admin only
│   └── systemLogger.js       # Ghi audit log
├── routes/                   # Một file ≈ một module API (xem mục 7)
├── models/                   # Mongoose schemas (xem mục 8)
├── utils/                    # Helper server (chat, escapeRegex, retention…)
├── services/                 # Logic nghiệp vụ tách khỏi route (nếu có)
├── scripts/                  # Helper một lần (seed, test, run-local)
├── tests/                    # Node --test
├── client/
│   ├── src/
│   │   ├── App.jsx           # Routing, Guard, bọc Providers
│   │   ├── main.jsx          # React root + BrowserRouter + SWR
│   │   ├── components/       # UI theo màn hình / tab
│   │   ├── context/          # State global (DataContext là trung tâm)
│   │   ├── services/api.js   # HTTP client, token, refresh
│   │   ├── constants/        # permissions, teacherStatus
│   │   ├── lib/              # entityMaps, messagingRoles
│   │   └── utils/            # validators, export PDF, sound…
│   └── vite.config.js
└── docs/
    └── TECHNICAL.md          # File này
```

---

## 3. Khởi động & luồng request

### 3.1 Frontend bootstrap

```
main.jsx
  └── BrowserRouter
        └── App.jsx
              ├── SocketProvider        # Kết nối socket, truyền JWT
              ├── ModalProvider         # Popup toàn cục
              ├── SecurityGuard         # Chống copy / devtools (tuỳ cấu hình)
              ├── DataProvider          # STATE TRUNG TÂM
              ├── BranchProvider        # Lọc chi nhánh (Super Admin)
              └── AppRoutes             # Route theo role + Guard
```

**Quy tắc:** Hầu hết màn hình đọc/ghi qua `DataContext`. Một số form lớn (`RegistrationForm`, `AdminDashboard`) gọi thêm trực tiếp `api.js`.

### 3.2 Backend middleware chain (rút gọn)

```
Request
  → helmet, cors, compression
  → session (Mongo MemoryStore hoặc connect-mongo)
  → passport
  → systemLogger
  → apiRateLimitUnlessAuth  (/api/*)
  → route handler
      → authMiddleware (JWT + blacklist + tokenVersion)
      → branchFilter (nếu áp dụng)
      → business logic → MongoDB
      → (tuỳ chỗ) io.emit(...) cho realtime
```

### 3.3 Luồng API điển hình

```
Component → DataContext.fn() → api.js (apiFetch)
  → POST/GET /api/... + Bearer token
  → routes/*.js → Model → MongoDB
  → JSON response → DataContext cập nhật state local
  → (optional) Socket event → UI refresh
```

---

## 4. Định tuyến Frontend

Định nghĩa trong `client/src/App.jsx`.

| URL | Role | Component | Ghi chú |
|-----|------|-----------|---------|
| `/`, `/login` | Công khai | `LoginPage.jsx` | HV/GV đăng nhập SĐT |
| `/admin/login` | Công khai | `AdminLoginPage.jsx` | Admin + captcha |
| `/dangkykhoahoc` | Công khai | `RegistrationForm.jsx` | Đăng ký khóa + QR |
| `/pay/:sessionId` | Công khai | `PublicPaymentPage.jsx` | Trang thanh toán |
| `/admin`, `/admin#tab` | admin, staff | `AdminDashboard.jsx` | Tab = `location.hash` |
| `/admin/inbox` | admin, staff | `Inbox.jsx` | Chat |
| `/teacher`, `/teacher#tab` | teacher | `TeacherDashboard.jsx` | |
| `/teacher/test` | teacher (pending) | `TeacherTest.jsx` | Bài thi GV |
| `/teacher/finance` | teacher | `TeacherFinanceAndTraining.jsx` | |
| `/teacher/inbox` | teacher | `Inbox.jsx` | |
| `/student`, `/student#tab` | student | `StudentDashboard.jsx` | |
| `/student/exam` | student | `StudentExamRoom.jsx` | Chọn môn thi |
| `/student/exam/:subjectId` | student | `StudentTest.jsx` | Fullscreen, chống gian lận |
| `/student/inbox` | student | `Inbox.jsx` | |

**Menu sidebar:** `client/src/components/AppSidebar.jsx` — `MENU_CONFIG` theo role, kiểm tra `hasPermission()`.

**Sau đăng nhập:** `App.jsx` redirect `{ admin: '/admin', staff: '/admin', teacher: '/teacher', student: '/student' }`.

---

## 5. Vai trò & phân quyền

### 5.1 Bốn loại tài khoản

| Role | Mô tả | Dashboard |
|------|-------|-----------|
| `admin` | Super Admin (`id === 'admin'`) | `/admin` — full quyền |
| `staff` | Nhân viên chi nhánh, `adminRole: STAFF` | `/admin` — theo `permissions[]` |
| `teacher` | Giảng viên | `/teacher` |
| `student` | Học viên | `/student` |

### 5.2 Mã quyền Staff

File: `client/src/constants/permissions.js` (key **không đổi** sau khi lưu DB).

| Key | Tab / chức năng UI |
|-----|-------------------|
| `manage_students` | Học viên |
| `view_teachers` | Giảng viên (read-only) |
| `manage_schedule` | Lịch dạy |
| `manage_finance` | Tài chính |
| `view_branch_revenue` | Báo cáo doanh thu (read-only) |
| `manage_training` | Đào tạo GV |
| `manage_student_training` | Đào tạo HV |
| `manage_hr` | Nhân sự & Lương |
| `system_settings` | Cài đặt hệ thống |
| `view_logs` | Nhật ký hệ thống |
| `view_evaluations` | Đánh giá nội bộ |
| `manage_staff` | Phân quyền NV (Super Admin) |

Kiểm tra FE: `hasPermission(session, PERMISSIONS.XXX)`.

### 5.3 Trạng thái Giảng viên

Helper: `client/src/constants/teacherStatus.js`  
Schema: `models/Teacher.js` — field `status`

```
inactive  → Mới tạo, "Chưa cấp quyền", KHÔNG đăng nhập được
    ↓ Admin: "Cấp truy cập thi"
pending   → Được login, làm bài test + nộp thực hành
    ↓ Admin: "Cấp quyền giảng dạy"
active    → Giảng dạy bình thường
locked    → Trượt thi / bị khóa — có thể cấp thi lại
```

API liên quan: `routes/teacherRoutes.js` — `POST /`, `PATCH /:id`, `POST /:id/approve`.

**Lưu ý:** DB có thể lưu `Pending` / `pending` lẫn lộn — luôn dùng helper `normalizeTeacherStatus()`, `isTeacherActive()`, `isTeacherPending()` thay vì so sánh chuỗi thô.

---

## 6. Xác thực & bảo mật

### 6.1 JWT

| Thành phần | File |
|------------|------|
| Login, refresh, logout | `routes/authRoutes.js` |
| Verify token mỗi request | `middleware/auth.js` |
| Blacklist khi logout | `middleware/tokenBlacklist.js` |
| Lưu token FE | `client/src/services/api.js` — `{role}_access_token`, `{role}_refresh_token`, `{role}_user` |

Cơ chế:

- Access token TTL: `JWT_EXPIRES_IN` (mặc định 8h)
- Refresh token rotation + reuse detection
- `tokenVersion` trên Student/Teacher — login mới vô hiệu phiên cũ
- Socket.io: JWT trong `socket.handshake.auth.token` (`server.js`)

### 6.2 Middleware role

| Middleware | Cho phép |
|------------|----------|
| `authMiddleware` | Mọi user đã login |
| `isAdmin` | `admin`, `staff` |
| `isTeacher` | `teacher`, `admin` |
| `isStudent` | `student` |
| `masterAdmin` | Super Admin only |

### 6.3 Chi nhánh

`middleware/branchFilter.js` — Staff chỉ thấy dữ liệu chi nhánh mình. Lỗi filter → **500**, không leak dữ liệu chéo chi nhánh.

---

## 7. Map API Backend

Mount trong `server.js` (khoảng dòng 500+):

| Prefix | File | Chức năng |
|--------|------|-----------|
| `/api/auth` | `authRoutes.js` | Login, captcha, refresh, OAuth Google/Zalo |
| `/api/students` | `studentRoutes.js` | CRUD HV, gán GV, khóa thi |
| `/api/teachers` | `teacherRoutes.js` | CRUD GV, duyệt, thực hành, lương |
| `/api/schedules` | `scheduleRoutes.js` | Lịch học / lịch dạy |
| `/api/messages` | `messageRoutes.js` | Chat, upload, nhóm |
| `/api/courses` | `courseRoutes.js` | Khóa học, giá |
| `/api/invoices` | `invoiceRoutes.js` | Hóa đơn |
| `/api/transactions` | `transactionRoutes.js` | Thu/chi |
| `/api/webhooks` | `webhookRoutes.js` | Sepay, payment session, polling |
| `/api/settings` | `settingsRoutes.js` | Cấu hình web, ngân hàng |
| `/api/branches` | `branchRoutes.js` | Chi nhánh |
| `/api/staff` | `staffRoutes.js` | Nhân viên nội bộ |
| `/api/employees` | `employeeRoutes.js` | HR & payroll |
| `/api/training-lms` | `trainingRoutes.js` | LMS (bài học, tiến độ) |
| `/api/training` | `teachingGuideRoutes.js` | Hướng dẫn giảng dạy |
| `/api/exam-results` | `examResultRoutes.js` | Kết quả thi |
| `/api/evaluations` | `evaluationRoutes.js` | Đánh giá nội bộ |
| `/api/analytics` | `analyticsRoutes.js` | Báo cáo doanh thu |
| `/api/system-logs` | `systemLogRoutes.js` | Audit log |
| `/api/notifications` | `notificationRoutes.js` | Notification center |
| `/api/assignments` | `assignmentRoutes.js` | Bài tập |
| `/api/files` | `fileRoutes.js` | File center (registry FileAsset) |
| `/api/backups` | `backupRoutes.js` | Backup Mongo (Super Admin) |
| `/api/monitoring` | `monitoringRoutes.js` | Health/metrics/alerts |
| `/api/ai` | `aiRoutes.js` | AI Center |
| `/api/bi` | `biRoutes.js` | BI KPI dashboard |
| `/api/workflows` | `workflowRoutes.js` | Workflow duyệt |
| `/api/builder` | `builderRoutes.js` | Form & Report builder |
| `/api/tenants` | `tenantRoutes.js` | Multi-tenant (Super Admin) |
| `/healthz` | `server.js` | Health check (DB/Redis/queue/memory) |

OpenAPI chi tiết: [openapi.yaml](./openapi.yaml). ERD: [ERD.md](./ERD.md).

---

## 8. Models MongoDB

| Model | Mục đích chính |
|-------|----------------|
| `Student.js` | HV: khóa, GV, học phí, `paid`, chi nhánh, `tokenVersion` |
| `Teacher.js` | GV: `status`, điểm test, file thực hành, lương |
| `Schedule.js` | Buổi học trên lịch |
| `Message.js` | Tin nhắn chat |
| `Course.js` | Danh mục khóa + giá |
| `Branch.js` | Chi nhánh (CS1, CS2…) — `tenantId` |
| `Tenant.js` | Tổ chức multi-tenant |
| `FileAsset.js` | Registry file upload |
| `BackupJob.js` | Lịch sử backup |
| `WorkflowInstance.js` | Instance workflow |
| `FormDefinition.js` / `FormSubmission.js` | Form builder |
| `ReportDefinition.js` | Report builder |
| `Transaction.js` | Giao dịch thu/chi |
| `PaymentSession.js` | Phiên QR thanh toán Sepay |
| `Invoice.js` | Hóa đơn |
| `ExamResult.js` | Kết quả thi |
| `TrainingCourse`, `TrainingLesson`, `TrainingProgress` | LMS |
| `Employee.js`, `PayrollLog.js` | Nhân sự |
| `SystemSettings.js` | Cấu hình hệ thống |
| `SystemLog.js` | Nhật ký thao tác |
| `Notification.js` | Thông báo in-app |

---

## 9. Luồng nghiệp vụ chính

### 9.1 Đăng nhập

```
LoginPage / AdminLoginPage
  → POST /api/auth/login (hoặc variant public/internal)
  → JWT → localStorage
  → App.jsx handleLogin → navigate dashboard
  → SocketProvider kết nối với token
```

### 9.2 Đăng ký khóa học + thanh toán QR

```
RegistrationForm.jsx
  1. Nhập HV + chọn khóa (GET /api/courses)
  2. Tạo payment session → hiển thị VietQR
  3. Polling GET /api/webhooks/payment-session/:id
  4. Khi paid → DataContext.addStudent() → POST /api/students
```

Giá hiển thị/thu: dùng **effective price** (sau giảm giá), không hardcode `COURSES[0]`.

### 9.3 Admin thêm học viên

```
AdminDashboard → AddStudentModal
  → DataContext.addStudent() hoặc flow QR tương tự RegistrationForm
```

### 9.4 Duyệt giảng viên

```
AdminDashboard #teachers
  inactive → grantPending() → status pending
  GV: TeacherTest.jsx (thi) + nộp file thực hành
  pending + đủ điều kiện → approveTeacher() → POST /api/teachers/:id/approve → active
```

### 9.5 Chat / Inbox

```
Inbox.jsx
  → GET/POST /api/messages
  → conversationId: buildConversationId() (FE: DataContext / BE: utils/chatConversationId.js)
  → Role chat: lib/messagingRoles.js (client) + utils/messagingRoles.js (server)
  → Socket: message:send / message:receive
```

Quy tắc conversation: staff/admin chat HV tách thread theo `senderId` admin cụ thể (xem comment trong `DataContext.jsx` hàm `buildConversationId`).

### 9.6 Thi học viên

```
/student/exam → StudentExamRoom.jsx
/student/exam/:subjectId → StudentTest.jsx (fullscreen)
  → examResultRoutes.js
  → Socket exam:violation (ghi nhận gian lận, không loop emit exam:locked)
```

### 9.7 Lịch học

```
TeacherDashboard / StudentDashboard (#schedule)
  → scheduleRoutes.js
  → state trong DataContext (schedules)
```

---

## 10. State management (React Context)

| Context | File | Vai trò |
|---------|------|---------|
| **DataContext** | `context/DataContext.jsx` | **Trung tâm** — students, teachers, schedules, messages, CRUD |
| SocketContext | `context/SocketContext.jsx` | Kết nối realtime, online |
| BranchContext | `context/BranchContext.jsx` | Chi nhánh đang chọn |
| MessagesContext | `context/MessagesContext.jsx` | Cache chat, SWR |
| StudentsContext / TeachersContext / … | `context/*.jsx` | Tách module (refactor dần) |

**Debug “danh sách không cập nhật”:** kiểm tra theo thứ tự — API response → `DataContext` setState → socket listener có chạy không.

### Component lớn (monolith — cần cẩn thận khi sửa)

| Component | Dòng ước lượng | Nội dung |
|-----------|----------------|----------|
| `AdminDashboard.jsx` | ~5000+ | Tất cả tab admin, modal HV/GV |
| `DataContext.jsx` | ~2200+ | Toàn bộ state & API helpers |
| `TeacherDashboard.jsx` | lớn | GV dashboard |
| `StudentDashboard.jsx` | lớn | HV dashboard |
| `Inbox.jsx` | lớn | Chat đa role |

---

## 11. Socket.io — sự kiện realtime

Định nghĩa server: `server.js` (phần `io.on('connection')`).

| Sự kiện (client → server) | Mô tả |
|---------------------------|-------|
| `register` | Đăng ký online (userId/role từ JWT, không tin client) |
| `message:send` | Gửi tin (có persist DB) |
| `message:read` | Đánh dấu đã đọc |
| `typing:start` / `typing:stop` | Đang gõ |
| `exam:violation` | Gian lận khi thi |
| `teacher:join` / `student:join` / `admin:join` | Join room theo role |
| `group:join` | Join room nhóm chat |

| Sự kiện (server → client) | Mô tả |
|---------------------------|-------|
| `users:online` | Danh sách online |
| `users:lastSeen` | Last seen khi disconnect |
| `message:receive` / `message:sent` | Tin nhắn mới |
| `message:read_ack` | Xác nhận đã đọc |

**Rooms:** `userId`, `GLOBAL`, `ALL_TEACHER`, `ALL_STAFF`, `branch_*`.

Client lắng nghe: `SocketContext.jsx` + `DataContext.jsx`.

---

## 12. Bảng tra cứu: sửa lỗi vào file nào

| Triệu chứng | Kiểm tra / sửa |
|-------------|----------------|
| Crash `null.id` / `undefined.id` | `DataContext.jsx`, `AdminDashboard.jsx`, `AppSidebar.jsx` — guard mảng/object |
| GV không login được | `Teacher.status` trong DB; `authRoutes.js` chặn `inactive` |
| Staff không thấy menu | `session.permissions` + `AppSidebar.jsx` + `permissions.js` |
| Chat không gửi / sai thread | `messageRoutes.js`, `messagingRoles.js`, `buildConversationId` |
| QR sai số tiền | `RegistrationForm.jsx` — `effectivePrice` |
| Thanh toán không nhận | `webhookRoutes.js`, Sepay env, polling payment-session |
| Token hết hạn liên tục | `api.js` refresh flow; `tokenBlacklist.js` |
| Dữ liệu lẫn chi nhánh | `branchFilter.js`, `branchId` trên document |
| File JS lỗi syntax trên VPS | Encoding UTF-16 (xem mục 14) |
| Màu UI không đồng nhất | `tailwind.config.js` → `brand.*`; class `.btn-primary` trong `index.css` |
| Captcha admin fail | `authRoutes.js` captcha endpoint, rate limit |
| Upload ảnh chat lỗi | `messageRoutes.js` + Multer config trong `server.js` |
| Thi HV bị khóa oan | `StudentTest.jsx` + socket `exam:violation` (tránh loop) |

### File theo tính năng

| Tính năng | Frontend | Backend |
|-----------|----------|---------|
| Đăng nhập | `LoginPage.jsx`, `AdminLoginPage.jsx` | `authRoutes.js` |
| Đăng ký công khai | `RegistrationForm.jsx` | `studentRoutes.js`, `webhookRoutes.js` |
| Quản lý HV/GV | `AdminDashboard.jsx` | `studentRoutes.js`, `teacherRoutes.js` |
| Chat | `Inbox.jsx`, `MessagesContext.jsx` | `messageRoutes.js`, `server.js` socket |
| Cài đặt | `SystemSettingsTab.jsx`, `WebSettingsTab.jsx` | `settingsRoutes.js` |
| Phân quyền NV | `StaffManagementTab.jsx` | `staffRoutes.js` |
| HR & Lương | tab `#hr` trong Admin | `employeeRoutes.js` |
| Báo cáo DT | `RevenueAnalyticsTab.jsx` | `analyticsRoutes.js` |
| LMS | `TeacherTrainingLMS.jsx`, `StudentTrainingLMS.jsx` | `trainingRoutes.js` |
| Validate SĐT/email | `utils/validators.js` | (tuỳ route) |

---

## 13. Chạy local & deploy VPS

### 13.1 Local (Windows)

```powershell
cd QUANLYCMS
cp .env.example .env   # điền JWT_SECRET, MONGODB_URI

npm install --legacy-peer-deps
npm run dev            # backend :5000

cd client
npm install --legacy-peer-deps
npm run dev            # frontend :5173
```

Hoặc: `.\scripts\run-local.ps1` (mở 2 cửa sổ PowerShell).

### 13.2 Build production

```bash
cd client && npm run build && cd ..
NODE_ENV=production node server.js
# hoặc: pm2 restart quanlycms
```

### 13.3 Deploy VPS (quy trình chuẩn)

```bash
cd /www/wwwroot/quanlycms   # đường dẫn thực tế trên server
git pull origin main
cd client && npm install --legacy-peer-deps && npm run build && cd ..
pm2 restart all
```

Sau deploy: hard refresh (`Ctrl+Shift+R`) hoặc Incognito để tránh cache `dist/` cũ.

### 13.4 Healthcheck

```
GET /healthz → 200 nếu MongoDB connected, 503 nếu không
```

---

## 14. Quy ước code & lưu ý vận hành

### 14.1 API client

- Mọi HTTP qua `client/src/services/api.js`
- Token theo role prefix: `admin_access_token`, `teacher_access_token`, …
- `apiFetch` tự refresh khi 401 + `TOKEN_EXPIRED`

### 14.2 Entity ID

MongoDB dùng `_id`; FE thường map sang `id` qua `lib/entityMaps.js`. Khi debug, kiểm tra cả hai.

### 14.3 Design tokens (UI)

- Màu thương hiệu: `tailwind.config.js` → `colors.brand` (`navy`, `zalo`, `shell`)
- Class dùng chung: `.btn-primary`, `.btn-primary-blue`, `.input-field` trong `index.css`
- Nhiều component vẫn dùng hex Tailwind trực tiếp — ưu tiên chuyển dần sang `brand-*` khi sửa file đó

### 14.4 Encoding file (Windows)

Một số file `.js`/`.jsx` trên Windows có thể bị lưu **UTF-16 LE** (byte `FF FE` đầu file) → Node/Vite báo lỗi trên Linux.

- Kiểm tra: `Format-Hex -Path file.js -Count 4` — chuẩn UTF-8 không BOM bắt đầu `2F 2A` (`/*`) hoặc `69 6D` (`import`)
- Sửa: ghi lại file UTF-8 no BOM (Node script hoặc VS Code “Save with Encoding”)

File từng gặp vấn đề: `client/src/lib/messagingRoles.js`.

### 14.5 Secrets — không commit

- `.env`, credentials VPS
- Script deploy có mật khẩu hardcode (ví dụ `rebuild_frontend.cjs` nếu có)

### 14.6 Redis (multi-instance)

Khi chạy nhiều process Node, đặt `REDIS_URL` để token blacklist đồng bộ giữa các instance.

### 14.7 Test

```bash
npm test                    # toàn bộ tests/
npm run test:integration    # tests/integration/
```

Tài khoản test (môi trường dev đã seed):

| Role | Login | Password |
|------|-------|----------|
| Super Admin | `admin` | `admin123` |
| Staff / Teacher / Student | `0920000010` / `0910000010` / `0900000010` | `Test@123` |

---

## Cập nhật tài liệu

Khi thêm module mới:

1. Mount route trong `server.js` + mục 7 file này
2. Thêm model vào mục 8 (nếu có collection mới)
3. Thêm route FE trong `App.jsx` + mục 4
4. Cập nhật `AppSidebar.jsx` nếu có menu admin
5. Ghi luồng nghiệp vụ vào mục 9 nếu phức tạp

---

*Tài liệu bảo trì bởi đội kỹ thuật QUANLYCMS. Câu hỏi vận hành nhanh: xem [README.md](../README.md).*
