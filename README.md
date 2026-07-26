# QUANLYCMS

Full-stack CMS cho trung tâm đào tạo: **Express 5 + MongoDB + Socket.io**, frontend **React (Vite) + Tailwind**.

> **Đội kỹ thuật:** [docs/TECHNICAL.md](docs/TECHNICAL.md) · [ERD](docs/ERD.md) · [OpenAPI](docs/openapi.yaml) · [Final review](docs/ROADMAP_REVIEW.md)

## Cấu trúc thư mục

- `server.js` — API và Socket.io
- `routes/`, `models/`, `middleware/`, `services/`, `config/` — backend
- `client/` — ứng dụng React (`npm run dev` trong `client/`)
- `tests/` — test runner (Node `--test`); xem `tests/integration/`
- `scripts/` — helper script một lần (seed, migrate, debug); chạy bằng `node scripts/<name>.js`
- `Dockerfile`, `docker-compose.yml` — chạy bằng container
- `.github/workflows/node.yml` — CI (lint + test + build client)

## Yêu cầu

- **Node.js 22 LTS** (khớp với `Dockerfile` / `.nvmrc`)
- **MongoDB 6/7** (URI kết nối)
- *(Tuỳ chọn)* **Redis** — phân tán token blacklist khi chạy nhiều instance

## Cài đặt nhanh

```bash
cp .env.example .env

# Sinh secret ngẫu nhiên (chạy 2 lần, paste vào .env)
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# Backend
npm install
npm run dev

# Frontend
cd client
npm install
npm run dev
```

Frontend (tuỳ chọn `client/.env`):

```env
VITE_API_URL=http://localhost:5000
```

Khi không đặt `VITE_API_URL`, dev mode dùng proxy `/api` → backend (xem `client/vite.config.js`).

## Biến môi trường (backend)

Bắt buộc — `validateEnv` sẽ chặn khởi động nếu thiếu/yếu.

| Biến | Mô tả | Ghi chú |
|------|-------|--------|
| `JWT_SECRET` | Ký access token | dev ≥ 16 ký tự, prod ≥ 32 ký tự |
| `JWT_REFRESH_SECRET` | Ký refresh token | **Phải khác** `JWT_SECRET` |
| `MONGODB_URI` | Chuỗi kết nối MongoDB | |
| `CLIENT_URL` | URL frontend | **Bắt buộc** khi `NODE_ENV=production` |

Tuỳ chọn:

| Biến | Mặc định | Mô tả |
|------|-----------|--------|
| `PORT` | `5000` | Cổng HTTP |
| `NODE_ENV` | `development` | `production` bật CSP và cookie `Secure` |
| `JWT_EXPIRES_IN` | `8h` | TTL access token |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | TTL refresh token |
| `JSON_BODY_LIMIT` | `1mb` | Giới hạn body JSON (file lớn dùng Multer) |
| `TRUST_PROXY` | `1` | Đặt `0` nếu chạy trực tiếp không qua reverse proxy |
| `COOKIE_SECRET` | = `JWT_SECRET` | Ký cookie OAuth state |
| `LOG_LEVEL` | `info` | Mức log của pino (`trace` … `fatal`) |
| `REDIS_URL` | — | Blacklist + query cache + BullMQ; không đặt = memory/inline |
| `ZALO_OA_TOKEN` / `ZALO_OA_REFRESH_TOKEN` | — | Gửi OTP/mật khẩu qua Zalo OA (queue) |
| `SMTP_HOST` / `SMTP_FROM` (+ user/pass) | — | Gửi email OTP/mật khẩu/hóa đơn PDF (queue) |
| `SESSION_ENCRYPTION_KEY` | — | Mã hoá session ở MongoDB (chỉ dùng khi prod + có Mongo store) |
| `RATE_LIMIT_API_MAX` | `400` | Trần request/15 phút/IP cho `/api/*` (trừ `/api/auth`, `/api/webhooks`) |
| `RATE_LIMIT_LOGIN_MAX` | `25` | `/api/auth/login*` |
| `RATE_LIMIT_CAPTCHA_MAX` | `120` | `/api/auth/captcha` |
| `RATE_LIMIT_REFRESH_MAX` | `200` | `/api/auth/refresh` |
| `RATE_LIMIT_SENSITIVE_MAX` | `20` | Đăng ký GV / quên MK |
| `RATE_LIMIT_CHECK_ROLE_MAX` | `60` | Kiểm tra role |

OAuth & tích hợp:

| Biến | Mô tả |
|------|--------|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google OAuth |
| `ZALO_APP_ID`, `ZALO_APP_SECRET`, `ZALO_CALLBACK_URL` | Zalo OAuth (state qua signed cookie) |
| `SEPAY_API_KEY`, `SEPAY_SECRET_KEY` | Webhook SePay |
| `BANK_ID`, `ACCOUNT_NO`, `ACCOUNT_NAME` | Hiển thị QR thanh toán |

## Chạy production

### Docker Compose

```bash
cp .env.example .env  # sinh JWT_SECRET / JWT_REFRESH_SECRET đúng độ dài
docker compose up -d
```

`docker-compose.yml` đã kèm Mongo + API. Trỏ Nginx/Cloudflare về `:5000`.

### PM2 / systemd

```bash
NODE_ENV=production node server.js
# hoặc:
pm2 start server.js --name quanlycms --env production
```

Đặt `TRUST_PROXY=1`, kết thúc TLS ở reverse proxy. Server hỗ trợ **graceful shutdown** trên `SIGTERM`/`SIGINT` (đóng HTTP, Mongo, Redis blacklist).

### Healthcheck

```
GET /healthz  →  200 nếu Mongo `readyState === 1`, ngược lại 503
```

Dùng cho LB / Docker `healthcheck`.

## Bảo mật đã áp dụng

- **Helmet** + CSP tối thiểu khi prod
- **CORS** whitelist; dev nới lỏng `localhost`
- **`express-mongo-sanitize`** + **`hpp`** chống NoSQL injection / param pollution
- **JWT**: blacklist (in-memory hoặc Redis qua `REDIS_URL`); **refresh token rotation** + reuse-detection
- **Query cache**: settings / branches / courses (TTL ngắn, invalidate khi ghi); fallback memory khi không có Redis
- **Job queue**: BullMQ (`cms-notify`, `cms-pdf`) khi có Redis — OTP/Zalo/email, sinh & gửi PDF hóa đơn; không Redis thì chạy inline
- **Notification Center**: `/api/notifications` (list/count/dismiss/broadcast) + trang `/admin|teacher|student/notifications`
- **File Center**: `/api/files` (upload/list/stats/delete/purge) + registry `FileAsset` + trang `/admin/files`
- **Backup**: `/api/backups` (Super Admin) — export MongoDB `.json.gz`, retention `BACKUP_KEEP`, cron 03:00; trang `/admin/backups`
- **Monitoring**: `/api/monitoring/*` (admin) — health/metrics/alerts; `/healthz` public; trang `/admin/monitoring`
- **AI Center**: `/api/ai/*` (admin) — quiz / soạn thông báo / tóm tắt / prompt; cần `AI_API_KEY` (fallback mẫu nếu chưa cấu hình); trang `/admin/ai`
- **BI**: `/api/bi/overview` + `/export` — KPI HV/GV/lịch/doanh thu/thi, cache 90s; trang `/admin/bi`
- **Workflow**: `/api/workflows` — duyệt GV / mở khóa thi / chi lương; đồng bộ domain; trang `/admin/workflows`
- **Form/Report builder**: `/api/builder/forms` + `/reports` — form động, submissions, báo cáo CSV; trang `/admin/builder`
- **Multi-tenant**: `/api/tenants` — Tenant → Branch; header `X-Tenant-Id`; trang `/admin/tenants` + switcher topbar
- **DevOps**: GitHub Actions (`lint` / `test` / `client build` / `smoke-api` + Mongo); `docker compose up`; `npm run smoke:api`
- **Token version**: increment mỗi lần login → vô hiệu phiên cũ
- **OAuth state** ký bằng cookie cho Zalo, session Passport cho Google
- **Multer**: `fileFilter` whitelist + giới hạn dung lượng + tên file sanitize
- **Rate limit**: chuyên biệt cho `/api/auth/*` + tổng cho `/api/*`
- **`branchFilter`** fail-closed (lỗi → 500, không lộ chéo chi nhánh)

## Endpoint chính

| Prefix | Mô tả |
|--------|-------|
| `/api/auth` | Login (public/internal/admin), captcha, refresh (rotation), logout, OAuth |
| `/api/students`, `/api/teachers`, `/api/staff`, `/api/employees`, `/api/branches` | CRUD nhân sự |
| `/api/courses` | Khoá học (ghi/sửa cần `system_settings`) |
| `/api/schedules`, `/api/assignments`, `/api/exam-results`, `/api/evaluations` | Học vụ |
| `/api/transactions`, `/api/invoices`, `/api/analytics` | Tài chính |
| `/api/messages`, `/api/notifications` | Real-time chat & notify |
| `/api/settings`, `/api/training`, `/api/training-lms`, `/api/teaching-guide` | Cấu hình & đào tạo |
| `/api/webhooks/sepay` | Webhook ngân hàng (HMAC / API key) |
| `/healthz` | Health check |

## Scripts hữu ích

```bash
npm start              # Production (đọc .env)
npm run dev            # Hot reload (--watch)
npm run lint           # ESLint backend
npm test               # mọi *.test.js trong tests/
npm run test:integration
npm run smoke:api      # smoke API (cần server :5000)
npm run health:wait    # chờ /healthz
npm run docker:up      # docker compose up -d --build
npm run docker:down
```

Trong `client/`:

```bash
npm run dev        # Vite
npm run build      # Build production
npm run lint
```

CI (GitHub Actions): `lint` + `test` + `client build` + `smoke-api` (Mongo service).

## Ghi chú vận hành

- Nếu chạy **nhiều instance**, đặt `REDIS_URL` để blacklist, cache và BullMQ chia sẻ giữa các node.
- Cấu hình `ZALO_OA_*` và/hoặc `SMTP_*` để queue thực sự gửi OTP/mật khẩu/hóa đơn (thiếu cấu hình thì job no-op an toàn).
- Production có MongoDB → session được lưu vào collection `sessions` (`connect-mongo`); nếu không, fallback `MemoryStore` (chỉ dev).
- Sau khi đổi secret JWT, mọi phiên hiện tại bị vô hiệu — người dùng cần đăng nhập lại.
- Docker: cần `JWT_SECRET` / `JWT_REFRESH_SECRET` trong `.env` trước `docker compose up`.
