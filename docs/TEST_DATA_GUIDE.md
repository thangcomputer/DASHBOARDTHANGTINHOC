# Hướng dẫn dữ liệu test

## Database

| Database | Vai trò |
| --- | --- |
| `dashboardthangtinhoc` trên `127.0.0.1:27018` | Dữ liệu đang dùng của máy này (`MONGODB_URI`). Không reset, không seed. |
| `thang_tin_hoc_test` trên cùng host, khác tên | Database test. Được phép xóa document và seed lại. |

Script từ chối chạy nếu `NODE_ENV` khác `test`, nếu tên database không đúng `thang_tin_hoc_test`, hoặc nếu URI test trùng URI runtime. Không gọi `dropDatabase`.

```powershell
$env:NODE_ENV='test'
$env:TEST_DATABASE_URI='mongodb://127.0.0.1:27018/thang_tin_hoc_test?replicaSet=rs0'
$env:ALLOW_TEST_DB_RESET='true'
$env:ALLOW_TEST_DB_HOST_MATCH='true'
node scripts/reset-and-seed-test-db.js
```

`ALLOW_TEST_DB_HOST_MATCH` chỉ được bật vì hai database nằm trên cùng Mongo local nhưng khác tên. Script đếm số học viên của database runtime trước và sau, và dừng nếu số đó đổi.

## Tài khoản

Mật khẩu chung: `Test@12345`

| Vai trò | Điện thoại | Email |
| --- | --- | --- |
| Admin (`SUPER_ADMIN`) | 0900000001 | admin.test@thang-tin-hoc.test |
| Giáo viên 1–3 | 0901000001 … 0901000003 | teacherN.test@thang-tin-hoc.test |
| Học viên 1–10 | 0902000001 … 0902000010 | studentN.test@thang-tin-hoc.test |

Học viên gắn khóa `Tin học văn phòng test` hoặc `Lập trình test`, và giáo viên theo vòng 1, 2, 3. Giáo viên 1 có 4 học viên.

Đã seed thêm: 1 môn và 1 bài học, 2 lịch (sắp học và đã hoàn thành), 1 bài tập, 2 tin nhắn, 1 thông báo, 1 hồ sơ XP dùng hằng `FREE_PORTAL_DAILY_XP` hiện có, 1 phiên thanh toán `paid` giả lập (không gọi cổng thanh toán).

Học viên 1 đã đăng ký đúng 2 thiết bị. Thiết bị thứ ba bị `DEVICE_NOT_REGISTERED_LIMIT_REACHED`. Đăng nhập lại thiết bị 1 vẫn còn slot 1. Không có lệnh nào xóa thiết bị khi đăng xuất.

Manifest: `tests/fixtures/test-seed-manifest.json`.
