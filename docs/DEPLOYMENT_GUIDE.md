# Triển khai

Hướng dẫn đầy đủ và bảng biến môi trường: [README gốc](../README.md).

## Docker

```bash
cp .env.example .env
docker compose up -d
```

API lắng nghe cổng `PORT` (mặc định 5000). Đặt reverse proxy phía trước. `TRUST_PROXY=1` khi có proxy.

## PM2

Process API chạy `server.js`. Worker, nếu bật outbox, chạy `worker.js` và trên API đặt `RUN_OUTBOX_WORKER=0` để không xử lý trùng.

## Trước khi đưa lên

- `JWT_SECRET` và `JWT_REFRESH_SECRET` khác nhau, production dài ít nhất 32 ký tự.
- `CLIENT_URL` đúng origin web.
- `MONGODB_URI` trỏ database vận hành, không trỏ `thang_tin_hoc_test`.
- `NODE_ENV=production`.
- Build web: `cd client && npm run build`, phục vụ `client/dist` theo cách host hiện tại.
- Mobile: bản EAS/store dùng `EXPO_PUBLIC_MOBILE_API_BASE_URL` của production.

## Không làm lúc deploy

Không chạy `scripts/reset-and-seed-test-db.js` với URI vận hành. Script từ chối nếu tên database không phải `thang_tin_hoc_test`, nhưng đừng đổi điều kiện đó để "chạy cho tiện".
