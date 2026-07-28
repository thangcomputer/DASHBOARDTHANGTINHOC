# QA Báo cáo — Nhóm 1: Admin ↔ Giảng viên

**Ngày:** 2026-07-28  
**Môi trường:** Local API `http://127.0.0.1:5000`  
**Script:** `scripts/_qa_group1_admin_teacher.cjs`

## Kết quả tổng

| Metric | Giá trị |
|--------|---------|
| PASS | 23 |
| FAIL | 0 |
| SKIP | 2 |
| Critical | 0 |
| Hoàn thành (excl SKIP) | **100%** |

## Onboard (đã vá)

| ID | Kết quả |
|----|---------|
| G1-02 Email/Zalo welcome | PASS (`welcomeQueued`) |
| G1-03 Notification in-app | PASS (`welcomeNotified`) |

## PASS nổi bật

Tạo GV → kích hoạt → phân công → khóa revoke JWT → staff/role checks → cleanup.

JSON: `docs/QA_GROUP1_ADMIN_TEACHER.json`
