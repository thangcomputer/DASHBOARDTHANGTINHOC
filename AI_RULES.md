# AI_RULES.md — Luật làm việc với codebase QUANLYCMS

Mọi agent/Cursor khi sửa code **phải** tuân thủ file này. Mục tiêu: tiến dần enterprise, không đập đi xây lại.

## 1. Nguyên tắc chung

1. **Lần lượt, không ồ ạt.** Một PR/session chỉ một chủ đề (bảo mật *hoặc* refactor *hoặc* feature).
2. **Không commit / push / deploy** trừ khi người dùng yêu cầu rõ.
3. **Không đổi hành vi API công khai** nếu chưa có migration/compat (giữ field cũ, thêm field mới).
4. **Ưu tiên sửa root cause**, không vá tạm nếu đã biết chỗ đúng.
5. File mới trên Windows: **UTF-8 không BOM** (tránh UTF-16 làm crash Node).

## 2. Cấu trúc thư mục chuẩn

```
server.js                 # entry, mount routes, middleware toàn cục
config/                   # env, db, redis, logger, indexes
middleware/               # auth, rate limit, branch, logger
routes/                   # HTTP handlers (mỏng dần theo thời gian)
services/                 # business logic (ưu tiên tách logic mới vào đây)
models/                   # Mongoose schemas
utils/                    # helper thuần, không phụ thuộc Express req/res
client/src/components/    # UI theo role
client/src/components/admin/tabs/   # admin tabs lazy
client/src/components/admin/shared/ # shared admin UI
client/src/context/       # React context
client/src/services/      # API client
client/src/utils/         # client helpers
docs/                     # tài liệu kỹ thuật
tests/                    # integration / e2e
```

- **Không** tạo layer mới (repository, queue, AI…) nếu chưa đến giai đoạn roadmap tương ứng và chưa được giao.
- Logic mới: ưu tiên `services/` thay vì phình `routes/*.js`.

## 3. Đặt tên

| Loại | Quy ước |
|------|---------|
| File React | `PascalCase.jsx` |
| Hook | `useXxx.js` |
| Util / service | `camelCase.js` |
| Model | `PascalCase.js` (khớp collection) |
| Route mount | `/api/<domain>` số nhiều (`/api/students`) |
| Env | `SCREAMING_SNAKE_CASE` |

## 4. Giới hạn kích thước (mục tiêu khi sửa)

- Component mới / file tách ra: **≤ 400 dòng** (cố gắng ≤ 300).
- Function mới: **≤ 50 dòng** nếu có thể tách helper.
- `AdminDashboard.jsx` / `DataContext.jsx`: **chỉ giảm**, không nhét thêm JSX/logic lớn vào shell.
- Tab admin mới: file trong `admin/tabs/`, lazy qua `AdminLazyTabShell.jsx`, state qua `AdminTabContext`.

## 5. Bảo mật (bắt buộc với mọi thay đổi auth/API)

- Secrets chỉ trong `.env` — **cấm** hardcode password, API key, SSH.
- Deploy script: dùng `VPS_HOST` / `VPS_USER` / `VPS_PASSWORD` hoặc `VPS_SSH_KEY_PATH`.
- Production: không fallback `admin123` (xem `utils/adminPassword.js`).
- Mọi route ghi dữ liệu: `authMiddleware` + kiểm tra role/branch khi cần.
- Input user vào Mongo `$regex`: dùng `utils/escapeRegex.js`.
- Upload: giới hạn mime/size, sanitize tên file.
- Log: không ghi password, token, OTP đầy đủ.

## 6. Validation, lỗi, logging

- Validate input ở biên (route/service), trả `{ success: false, message }` nhất quán.
- Lỗi bất ngờ: `logger.error` + message an toàn cho client (không stack ở prod).
- Không nuốt lỗi bằng `catch {}` trống trừ khi có lý do ghi chú.

## 7. Frontend

- API base: `services/api.js` (`API_BASE` / proxy Vite). Không hardcode domain prod trong code dev.
- Toast / modal: dùng pattern hiện có (`react-hot-toast`, `showGlobalModal`).
- Không thêm dependency nặng nếu util nhỏ đủ dùng.

## 8. Database

- Index mới: khai báo trên schema **và** `config/ensureIndexes.js` nếu cần đảm bảo lúc boot.
- Không `populate` toàn bộ document khi chỉ cần vài field.
- Migration: script trong `scripts/`, idempotent, có thể chạy lại an toàn.

## 9. Test & tài liệu

- Thay đổi auth / middleware / env validation: cập nhật hoặc thêm test trong `tests/`.
- Module API mới: cập nhật `docs/TECHNICAL.md` (map route + model nếu có).
- Không bắt buộc viết test cho mọi UI nhỏ; ưu tiên logic bảo mật và luồng tiền/đăng nhập.

## 10. Commit (khi được yêu cầu)

- Message rõ, tiếng Việt hoặc tiếng Anh nhất quán trong một commit.
- Không commit `.env`, secret, `client/dist` nếu không cần.
- Không `--no-verify` trừ khi user yêu cầu.

## 11. Roadmap — thứ tự ưu tiên (không nhảy cóc)

Chỉ làm giai đoạn sau khi nền tảng trước **ổn định và đã test**:

1. Audit / debt map (đã có AI_RULES + gap map)
2. Security hardening (JWT/refresh, CSRF double-submit, Super Admin MFA TOTP, XSS sanitize — ổn định)
3. Clean architecture (AdminDashboard/DataContext đã tách shell + domain hooks)
4. Database optimization (schema indexes + ensureIndexes lúc boot)
5. Cache (Redis query cache + blacklist — optional qua REDIS_URL; memory fallback)
6. Queue (BullMQ khi có REDIS_URL; inline fallback) — OTP/Zalo/email, PDF hóa đơn
7. Notification center (API list/count/dismiss/broadcast + trang Trung tâm thông báo)
8. File center (FileAsset registry, /api/files, admin Quản lý file, purge hết hạn)
9. Backup (export Mongo gzip, Super Admin, cron, /admin/backups — không restore ghi đè qua UI)
10. Monitoring (metrics request, health chi tiết, alerts, /admin/monitoring)
11. AI Center (OpenAI-compatible, quiz/notification/summarize, fallback khi chưa có key)
12. BI Dashboard (KPI đa chiều, so sánh kỳ, export CSV, /admin/bi — bổ sung analytics doanh thu)
13. Workflow (duyệt GV / mở khóa thi / chi lương, instance + lịch sử, /admin/workflows)
14. Form/Report builder (form động + submissions, report CSV từ nguồn hệ thống, /admin/builder)
15–16. Multi-tenant (Tenant bọc Branch, X-Tenant-Id, Super Admin switcher, /admin/tenants)
17–18. DevOps / Testing (CI lint+test+client build+smoke-api, Docker Compose, smoke scripts)
19. Docs (ERD, OpenAPI — `docs/ERD.md`, `docs/openapi.yaml`)
20. Final review (`docs/ROADMAP_REVIEW.md`)

**Cấm** bắt đầu AI Center / Multi-tenant / Workflow engine khi Phase 2–3 chưa xong phần critical.

## 12. Khi không chắc

- Đọc `docs/TECHNICAL.md` và code lân cận trước khi thêm abstraction.
- Giữ diff nhỏ, dễ revert.
- Hỏi user một câu rõ nếu quyết định sai sẽ tốn công lớn (schema breaking, deploy, xóa dữ liệu).