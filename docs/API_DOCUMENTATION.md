# API

Danh sách method và path lấy từ code, không viết tay: [API_MAPPING.md](API_MAPPING.md). Ngày sinh gần nhất: 49 prefix, 620 handler trong `routes/`. File đó là nguồn đối chiếu khi thêm endpoint.

OpenAPI cũ, nếu còn, nằm ở `docs/openapi.yaml`. Khi OpenAPI và `routes/` lệch nhau, tin `routes/` và `server.js`.

## Hợp đồng chung

| Việc | Web | Mobile |
| --- | --- | --- |
| Gốc | `VITE_API_URL` + `/api`, hoặc `/api` qua proxy Vite | `EXPO_PUBLIC_MOBILE_API_BASE_URL` + `/api` |
| Hàm | `apiFetch` trong `client/src/services/api.js` | `mobileApiRequest` trong `apiClient.ts` |
| Token | `Authorization: Bearer` theo vai trò trên URL | Bearer trong SecureStore |
| CSRF | Header `X-CSRF-Token` với POST, PUT, PATCH, DELETE | Cùng header, thêm `X-Client-Platform: mobile` |
| 401 | Refresh một lần, một promise | Refresh một lần, một promise |
| GET trùng đang bay | Gộp trong `inflightGet.js` | Gộp trong `mobileApiRequest` |
| Ghi dữ liệu | Không gộp, không tự retry tạo bản ghi | Không gộp |

Response nghiệp vụ thường có `success` và `message`. Một số route thêm `data`. Không có một envelope duy nhất cho cả 620 handler. Đọc handler trước khi bịa mẫu JSON.

## Nhóm prefix

`/api/auth`, `/api/students`, `/api/teachers`, `/api/staff`, `/api/employees`, `/api/courses`, `/api/schedules`, `/api/assignments`, `/api/quizzes`, `/api/evaluations`, `/api/exam-results`, `/api/cert-prep`, `/api/lesson-practice`, `/api/daily-practice`, `/api/lms-progress`, `/api/subscription`, `/api/invoices`, `/api/finance`, `/api/transactions`, `/api/webhooks`, `/api/messages`, `/api/calls`, `/api/notifications`, `/api/files`, `/api/settings`, `/api/feed`, `/api/blog`, `/api/ai`, `/api/ai-support`, `/api/dewskill-classes`, `/api/dewskill-students`, `/api/meet-classes`, `/api/mobile-push-tokens`, `/api/mobile-billing`.

## Quyền

Middleware `authMiddleware` từ chối khi không có token (401). Route quản trị thêm `checkPermission`. Ví dụ đã đo trên database test: `GET /api/students` không token → 401, học viên → 403, giáo viên → 200 và chỉ học viên được gán.

`POST /api/auth/login` nhận `phone` hoặc `identifier`, `password`, `role`. Tài khoản `admin`/`staff` bị 401 trên cổng login này. Họ đăng nhập qua luồng admin riêng trong cùng file route.

## Thêm endpoint

Thêm vào file `routes/` đã mount, hoặc `app.use` một file mới trong `server.js`. Cập nhật hàm trong `client/src/services/` và service mobile nếu cả hai dùng. Không tạo axios instance mới.
