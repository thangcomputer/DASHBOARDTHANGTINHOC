# Tài liệu bàn giao LMS Thắng Tin Học

Người mới bắt đầu ở file này, rồi đọc [HANDOVER_GUIDE.md](HANDOVER_GUIDE.md). Cách cài đặt đầy đủ và bảng biến môi trường nằm ở [README gốc](../README.md). Đừng tạo thêm một cách chạy thứ hai.

## Chạy trên máy mới

Cần Node 20 trở lên (README gốc khuyến nghị Node 22 LTS) và MongoDB.

```bash
cp .env.example .env
npm install
npm run dev
```

Cửa sổ thứ hai:

```bash
cd client
npm install
npm run dev
```

Mobile:

```bash
cd thang-tin-hoc-mobile
npm install
npx expo start
```

App mobile cần `EXPO_PUBLIC_MOBILE_API_BASE_URL`. Web dev không đặt `VITE_API_URL` thì Vite proxy `/api` về backend.

Kiểm tra:

```bash
npm test
npm run lint
cd client && npm run build
cd thang-tin-hoc-mobile && npx tsc --noEmit
```

Database test, không đụng database đang dùng: [TEST_DATA_GUIDE.md](TEST_DATA_GUIDE.md).

## Đọc theo việc cần làm

| Việc | Tài liệu |
| --- | --- |
| Hệ thống nối với nhau thế nào | [SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md) |
| Thư mục nào chứa gì | [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) |
| Sửa module nào | [MODULE_DOCUMENTATION.md](MODULE_DOCUMENTATION.md) |
| Collection và model | [DATABASE_DOCUMENTATION.md](DATABASE_DOCUMENTATION.md) |
| Endpoint | [API_DOCUMENTATION.md](API_DOCUMENTATION.md) và [API_MAPPING.md](API_MAPPING.md) |
| Đăng nhập, quyền, hai thiết bị | [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md) |
| Socket | [SOCKET_IO_DOCUMENTATION.md](SOCKET_IO_DOCUMENTATION.md) |
| Web và mobile | [WEB_MOBILE_INTEGRATION.md](WEB_MOBILE_INTEGRATION.md) |
| Nghiệp vụ | [BUSINESS_LOGIC.md](BUSINESS_LOGIC.md) |
| XP | [GAMIFICATION_LOGIC.md](GAMIFICATION_LOGIC.md) |
| Thanh toán | [PAYMENT_LOGIC.md](PAYMENT_LOGIC.md) |
| Chạy production | [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) |
| Sửa code hằng ngày | [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) |
| Test | [TESTING_GUIDE.md](TESTING_GUIDE.md) |
| Đặt tên | [CODING_STANDARDS.md](CODING_STANDARDS.md) |
| Sự cố thường gặp | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| Vì sao không chuyển sang cây `backend/src` | [PROJECT_RESTRUCTURE_REPORT.md](PROJECT_RESTRUCTURE_REPORT.md) |
| Hiện trạng kiến trúc | [PROJECT_ARCHITECTURE_AUDIT.md](PROJECT_ARCHITECTURE_AUDIT.md) |
