# Kiểm thử

## Lệnh

```bash
npm test
npm run lint
cd client && npm run lint && npm run build
cd thang-tin-hoc-mobile && npx tsc --noEmit
```

`npm test` chạy `node tests/run.js`. Bộ unit không cần Mongo. Bộ integration cần `TEST_DATABASE_URI` và guard trong `tests/setup/testDatabaseGuard.js`.

Guard từ chối nếu tên database không bắt đầu bằng `test_` hoặc kết thúc bằng `_test`, và từ chối nếu URI trùng `MONGODB_URI`. Cùng host với database vận hành thì cần `ALLOW_TEST_DB_HOST_MATCH=true`. Reset cần `ALLOW_TEST_DB_RESET=true`.

## Database test

```bash
node scripts/reset-and-seed-test-db.js
```

Script chỉ xóa document trong `thang_tin_hoc_test`, seed tài khoản giả, và đếm học viên trên URI runtime trước sau để chắc không ghi nhầm. Mật khẩu seed ghi trong `tests/fixtures/test-seed-manifest.json`. Không commit file đó nếu máy chia sẻ.

Không chạy `tests/seed_test_accounts.js` trên URI vận hành.

## Đã đo trong đợt gần nhất

- Unit trước đợt gộp GET: 746 pass.
- Hợp đồng `wave66`, `phase89`, `phase711`: 60 pass, 1 skip vì thiếu env deploy.
- `client/tests/inflight_get.test.js`: 3 pass.
- Build client thành công.
- `tsc --noEmit` mobile thành công.
- API test trên `thang_tin_hoc_test`: login giáo viên và học viên, `GET /api/students` 401/403/200, thiết bị thứ ba bị từ chối.
- Chưa chạy Expo UI và chưa duyệt toàn bộ 620 handler trên browser.

Chi tiết: [REGRESSION_TEST_REPORT.md](REGRESSION_TEST_REPORT.md), [API_TEST_REPORT.md](API_TEST_REPORT.md), [FULL_SYSTEM_TEST_REPORT.md](FULL_SYSTEM_TEST_REPORT.md).
