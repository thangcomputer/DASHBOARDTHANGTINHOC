# Cấu trúc thư mục

Cây đang chạy, không phải cây đề xuất `backend/src`. Deploy, test và PM2 import các đường dẫn này.

```text
DASHBOARDTHANGTINHOC-fresh/
├── server.js              API + Socket.IO
├── worker.js              outbox và job
├── routes/                handler HTTP đang mount
├── services/              nghiệp vụ
├── models/                schema Mongoose đang dùng
├── middleware/            auth, CSRF, rate limit, policy shadow
├── config/                db, env, logger, socket adapter
├── utils/                 helper thuần
├── constants/             quyền
├── shared/                cờ CQRS, một phần RBAC, outbox
├── modules/               bản chuyển dần, phần lớn chưa mount
├── client/                web React
├── thang-tin-hoc-mobile/  app Expo
├── tests/                 node:test
├── scripts/               seed, deploy, reset database test
├── docs/                  tài liệu
└── uploads/               file người dùng, không xóa khi dọn code
```

## Được đặt ở đâu

| Thư mục | Được đặt | Không đặt |
| --- | --- | --- |
| `routes/` | Khai báo method, middleware quyền, gọi service | Bản copy để thử kiến trúc mới |
| `services/` | Quy tắc XP, thiết bị, thanh toán, tin nhắn | JSX |
| `models/` | Field, index, hook hash mật khẩu | Query danh sách có phân quyền |
| `client/src/components/` | Màn hình và khối UI | Gọi MongoDB |
| `client/src/services/` | Hàm bọc `apiFetch` theo nghiệp vụ | Bản sao logic token |
| `thang-tin-hoc-mobile/src/screens/` | Màn hình app | URL hard-code lệch `/api` |
| `modules/` | Code đã được route thật `require` | Route mới rồi quên không mount, hoặc mount song song với `routes/` |

## Web

`client/src/App.jsx` khai báo route và `lazy()`. `client/src/services/api.js` là chỗ duy nhất gắn Bearer, CSRF và refresh. Context SWR (`StudentsContext`, `TeachersContext`, `ScheduleContext`, `FinanceContext`, `MessagesContext`) chia sẻ dữ liệu admin. Socket chỉ tạo trong `SocketContext.jsx`.

## Mobile

`src/services/apiClient.ts` là chỗ duy nhất gắn token, CSRF và header `X-Client-Platform`. Các file `*Api.ts` gọi `mobileApiRequest`. Navigation nằm trong project Expo, không dùng Expo Router làm nguồn route duy nhất. Socket nằm trong `socketService.ts`.

## File lớn

`server.js`, `routes/studentRoutes.js`, `routes/authRoutes.js`, `routes/teacherRoutes.js`, `client/src/services/api.js` gom nhiều việc. Tách chúng là việc từng endpoint, có test hợp đồng, không phải đổi tên thư mục một lần.
