# Sổ Tay Vận Hành Pilot AI DewSkill & Quy Trình Rollback (7–14 Ngày)

Tài liệu kỹ thuật dành cho **Admin (`SUPER_ADMIN` / `HIGH_ADMIN`)** và **DevOps On-Call** trước và trong giai đoạn chạy thử nghiệm có kiểm soát.

---

## 1. Kiến trúc cô lập Staging vs Production

| Thành phần | Staging (Thử nghiệm) | Production (Vận hành thật) |
|---|---|---|
| **MongoDB URI** | `dashboardthangtinhoc_staging` (user `dewskill_staging_app` chỉ có quyền `readWrite` trên DB Staging) | Database Production riêng biệt (tài khoản ứng dụng riêng) |
| **Mongo Guard** | `ENFORCE_STAGING_DB_ISOLATION=1` (chặn ghi vào DB Production bằng `config/stagingDatabaseGuard.js`) | `NODE_ENV=production` |
| **Redis Server** | **Redis 7.4 Alpine** (`docker-compose.staging.yml`, AOF `appendonly yes`, cổng `6380`, DB `/1`) | **Redis 7.x** riêng biệt (DB `/0`), không dùng bản Windows `3.0.504` |
| **Redis Namespace** | `REDIS_KEY_PREFIX=cms:staging:` (`bull-cms-staging`, `cms:staging:socket.io`) | `REDIS_KEY_PREFIX=cms:prod:` (`bull-cms-prod`, `cms:prod:socket.io`) |
| **Dữ liệu thử nghiệm** | Chỉ tài khoản giả lập từ `scripts/setup-staging-db.cjs --seed` (0 PII học viên thật) | Chỉ bật theo danh sách User ID Canary đã được phê duyệt |

### Lệnh khởi tạo Staging an toàn
```bash
# 1. Tạo DB Staging với tài khoản giả lập (tuyệt đối không chạm DB Production)
node scripts/setup-staging-db.cjs --seed
node scripts/setup-staging-db.cjs --verify

# 2. In lệnh tạo user MongoDB tối thiểu quyền (chạy trên máy chủ có bật --auth)
node scripts/setup-staging-db.cjs --print-least-privilege-script

# 3. Chạy cụm Staging Docker (MongoDB 7 + Redis 7.4 AOF + API Staging cổng 5055)
cp .env.staging.example .env.staging
docker compose -f docker-compose.staging.yml --env-file .env.staging up -d --build
```

---

## 2. Cấu hình Canary & Nguyên tắc khóa an toàn Production

- **KHÔNG BAO GIỜ** đặt `AI_KNOWLEDGE_RAG_ALLOW_ALL_PRODUCTION=1` trong giai đoạn Pilot.
- Chỉ bật RAG cho danh sách User ID cụ thể đã được Admin duyệt:
  ```env
  ENABLE_REDIS=true
  REDIS_URL=redis://<redis-7-host>:6379/0
  REDIS_KEY_PREFIX=cms:prod:
  AI_KNOWLEDGE_RAG_ENABLED=1
  AI_KNOWLEDGE_RAG_CANARY_USER_IDS=<userId1>,<userId2>,<userId3>,...
  AI_KNOWLEDGE_RAG_ALLOW_ROLE_EXPANSION=0
  AI_KNOWLEDGE_RAG_ALLOW_ALL_PRODUCTION=0
  AI_QUICK_ASK_TELEMETRY_LOG=1
  ```
- **Lưu ý phân biệt dữ liệu thật vs benchmark:** Mọi script kiểm thử tự động phải gắn header `X-Traffic-Source: benchmark` (hoặc `AI_QUICK_ASK_PERSIST_STATS=0`) để tuyệt đối không trộn vào thống kê người dùng thật (`pilot`) trong 7–14 ngày.

---

## 3. Giám sát hằng ngày (7–14 ngày, tối thiểu 200 câu hỏi người dùng thật)

Truy cập **Trang Quản trị → Giám sát hệ thống (`MonitoringPage`) → Mục "Giám sát Pilot AI DewSkill (RAG Canary)"** hoặc gọi API Admin:
- `GET /api/ai-support/admin/rag-metrics?days=14`
- `GET /api/ai-support/admin/rag-feedback?reviewStatus=pending_admin_review`
- `PATCH /api/ai-support/admin/rag-feedback/:id` (duyệt xem / bỏ qua góp ý — không bao giờ tự nạp vào kho tri thức)

### Các chỉ số bắt buộc theo dõi mỗi ngày
1. Số lượng người dùng thực (`uniqueRealUsersCount`) và tổng lượt hỏi thực tế (`pilotRequests`, loại trừ benchmark).
2. Tỷ lệ `Hữu ích` / `Chưa chính xác` và danh sách góp ý về phiên bản MOS (2016 / 2019 / 365).
3. Độ trễ tách riêng 4 luồng (`P50 / P95 / P99`): **RAG Cold**, **RAG Warm (Redis)**, **Legacy**, **Guard**.
4. Lỗi Gemini API (`429`, `500`, `503`, `timeout`, `network`) và lỗi giao diện client Web/Android/iOS (`clientErrors`).
5. Cache hit rate, trạng thái `activeBackend === "redis"`, `silentFallbackToRam === false`.
6. Tổng token và chi phí ước tính thực tế (USD).
7. Số câu hỏi không tìm thấy nguồn (`noSourceFoundCount`) và sự cố phân quyền/bảo mật (`securityEvents`).

---

## 4. Ngưỡng cảnh báo & Quy trình Rollback khẩn cấp

### Quyền thực hiện Rollback
- **Người được phép thực hiện:** Chỉ **`SUPER_ADMIN`**, **`HIGH_ADMIN`** và **DevOps On-Call** có quyền sửa biến môi trường / restart tiến trình API. Giảng viên, Nhân viên, Học viên không có quyền truy cập endpoint quản trị RAG (`HTTP 403`).

### Ngưỡng kích hoạt Rollback ngay lập tức (`critical`)
1. `silentFallbackToRam === true` kéo dài trên Production/Staging.
2. Tỷ lệ lỗi Gemini API `≥ 5%` (với `≥ 3` lỗi liên tiếp) hoặc xuất hiện lỗi 500 hệ thống diện rộng.
3. Phát hiện bất kỳ sự cố rò rỉ tài liệu nội bộ, rò rỉ PII hoặc sai phân quyền `freePortal`/Admin.
4. Tỷ lệ phản hồi `Chưa chính xác > 20%` (với `≥ 10` lượt đánh giá) hoặc lỗi hiển thị nghiêm trọng trên Web/Mobile.

### Quy trình Rollback tức thì (< 30 giây, không mất dữ liệu LMS)
1. Đặt biến môi trường trên máy chủ API:
   ```env
   AI_KNOWLEDGE_RAG_ENABLED=0
   ```
2. Reload / restart dịch vụ API (`pm2 reload` hoặc `docker compose restart api`).
3. Xác minh qua `GET /api/ai-support/admin/rag-metrics`: `ragConfig.flagValue === "0"`, `ragConfig.globalEnabled === false`. Toàn bộ yêu cầu Quick Ask lập tức quay về luồng AI cũ mà vẫn giữ nguyên lớp bảo vệ phạm vi Tin học văn phòng.

---

## 5. Checklist Phê Duyệt Bắt Đầu Pilot Production Giới Hạn

- [ ] MongoDB Staging tách độc lập (`dashboardthangtinhoc_staging`) và Production đã backup trước khi bật Canary.
- [ ] Redis `7.x` chạy thật với AOF (`appendonly yes`), `activeBackend === "redis"`, `silentFallbackToRam === false`, tách namespace `cms:prod:` / `cms:staging:`.
- [ ] `AI_KNOWLEDGE_RAG_ALLOW_ALL_PRODUCTION=0`, `AI_KNOWLEDGE_RAG_ALLOW_ROLE_EXPANSION=0`, danh sách `AI_KNOWLEDGE_RAG_CANARY_USER_IDS` chỉ gồm các tài khoản được phê duyệt.
- [ ] Kho tri thức `ai-knowledge/index/knowledgeIndex.json` đúng phiên bản mới nhất (`publishedToStudents: false`), thư mục `ai-knowledge/` chặn HTTP `404`.
- [ ] Đã kiểm thử thực tế trên Web Desktop, Mobile Web và **thiết bị Android + iOS thật** (bản build đã sửa `ui.tsx`).
- [ ] Admin đã xác nhận quyền truy cập dashboard giám sát và nắm rõ thao tác rollback `AI_KNOWLEDGE_RAG_ENABLED=0`.
- [ ] **Có phê duyệt chính thức bằng văn bản/xác nhận của Quản trị viên hệ thống trước khi bật cờ trên Production.**

---

## 6. Biểu mẫu Theo dõi Pilot 7–14 Ngày (Daily Pilot Tracking Form)

> **Quy tắc ghi nhận:** Số liệu lấy từ `GET /api/ai-support/admin/rag-metrics?days=14` — **chỉ ghi nhận lưu lượng người dùng thật (`pilot`)**, tuyệt đối không cộng lưu lượng `X-Traffic-Source: benchmark`.

| Ngày | Số User Thật (`uniqueRealUsersCount`) | Lượt Hỏi Pilot (`pilotRequests`) | Lượt Benchmark (Loại trừ) | RAG Cold P95 (`≤ 3000ms`) | Cache Hit Rate (%) | Lỗi Hệ thống (`< 1%`) | Phản hồi `Chưa chính xác` (`< 5%`) | Sự cố PII / RBAC (`= 0`) | Trạng thái (`Ổn định` / `Cảnh báo` / `Rollback`) | Người theo dõi |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| Ngày 1 | | | | | | | | | | |
| Ngày 2 | | | | | | | | | | |
| Ngày 3 | | | | | | | | | | |
| Ngày 4 | | | | | | | | | | |
| Ngày 5 | | | | | | | | | | |
| Ngày 6 | | | | | | | | | | |
| Ngày 7 | | | | | | | | | | |
| Ngày 8–10 | | | | | | | | | | |
| Ngày 11–14 | | | | | | | | | | |

### Cổng điều kiện mở rộng Production sau Pilot (`promotionGate`)
- [ ] Thời gian chạy thực tế đạt **7–14 ngày** (`pilotDuration7to14Days === 'met'`).
- [ ] Tổng lượt hỏi thật đạt **≥ 200 câu** (`observedRequests >= 200`, không tính benchmark).
- [ ] **RAG Cold P95 ≤ 3.000 ms**, tỷ lệ lỗi `< 1%`, phản hồi `Chưa chính xác < 5%`.
- [ ] `activeBackend === 'redis'`, `silentFallbackToRam === false`, **0 sự cố PII / RBAC / lỗi UI Mobile thật**.
- [ ] **Chữ ký phê duyệt mở rộng của Admin:** `____________________` | **Ngày:** `____/____/2026`
