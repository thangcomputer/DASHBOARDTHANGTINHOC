# QA Báo cáo — Nhóm 1: Admin ↔ Giảng viên

**Ngày:** 2026-07-28  
**Môi trường:** Local API `http://127.0.0.1:5000` (Mongo local)  
**Phương pháp:** E2E API thực tế (tạo GV throwaway, login public, mutate, khóa, cleanup) — script `scripts/_qa_group1_admin_teacher.cjs`  
**Không có:** Browser UI automation (không MCP browser trong session) — các bước menu/UI realtime ghi chú riêng.

## Kết quả tổng

| Metric | Giá trị |
|--------|---------|
| PASS | 21 |
| FAIL | 2 (High/Medium — thiếu email & notification onboard) |
| SKIP | 2 (cần HV trong DB / thuộc Nhóm 3–5) |
| Critical FAIL còn mở | **0** (G1-20 đã vá) |
| Tỷ lệ hoàn thành (excl SKIP) | **~91%** |

## Quy tắc dừng

Đã dừng tại Critical G1-20 → **đã sửa code** → chạy lại → PASS → được phép chuẩn bị Nhóm 2 sau khi user xác nhận.

---

## Chi tiết test case

### G1-00 Health — PASS
- API `GET /healthz` → 200

### G1-01 Admin tạo GV — PASS (Critical)
- `POST /api/teachers` → 201, không lộ password

### G1-02 Email khi tạo GV — FAIL (High)
- **Thực tế:** Không enqueue email / không gửi credential  
- **File:** `routes/teacherRoutes.js`  
- **Đề xuất:** Sau `Teacher.create`, gọi queue email welcome (phone/password tạm) nếu có `email`

### G1-03 Thông báo in-app khi tạo GV — FAIL (Medium)
- **Thực tế:** Chỉ `io.emit('teacher:new')` phía admin  
- **Đề xuất:** `NotificationService.send` tới teacherId

### G1-04 Login khi inactive — PASS
- 403 đúng thiết kế (default `status: inactive`)

### G1-05 Admin kích hoạt — PASS

### G1-06 Login sau active — PASS

### G1-07 Profile self — PASS

### G1-08 Không list all teachers — PASS (403)

### G1-09 List students — PASS (200, rỗng nếu chưa gán)

### G1-10 Lịch scoped self — PASS (IDOR fix)

### G1-11 Không dump transactions — PASS

### G1-12 Không xem analytics — PASS

### G1-13 Self-edit bio — PASS

### G1-14 Không escalate điểm thi — PASS

### G1-15 Admin thấy bio mới — PASS

### G1-16 Admin sửa → GV GET thấy — PASS (API sync; socket UI chưa verify browser)

### G1-17 Training settings GET — PASS

### G1-18 Tạo lịch spoof/unassigned — SKIP (local không có HV)

### G1-19 Admin khóa suspended — PASS

### G1-20 JWT cũ sau khóa — **FAIL → FIXED → PASS**
- **Bug:** Token cũ vẫn `200`  
- **Fix:** `middleware/auth.js` chặn `suspended`/`inactive`; `teacherRoutes` `$inc tokenVersion` + clear refreshToken + `auth:forceLogout`; client `FATAL_AUTH_CODES` thêm `ACCOUNT_DISABLED`

### G1-21 Login sau suspended — PASS

### G1-22 Không leo quyền admin — PASS (401)

### G1-23 Cleanup delete — PASS

### G1-24 Upload/điểm danh/bài thi — SKIP → Nhóm 3/5

---

## Chức năng trong checklist user — mapping

| Checklist | Kết quả |
|-----------|---------|
| Admin tạo GV | PASS |
| GV nhận tài khoản (DB) | PASS |
| Email | FAIL (thiếu) |
| Thông báo | FAIL (thiếu) |
| Đăng nhập | PASS (sau active) |
| Đúng quyền | PASS |
| Dashboard/profile API | PASS |
| Menu UI | Chưa browser — SKIP UI |
| Lớp/HV được phân công | PASS empty / SKIP sâu |
| Lịch | PASS scoped |
| Bài giảng LMS | PASS settings read |
| Upload tài liệu | SKIP → nhóm sau |
| Điểm danh / nhập điểm / tạo bài KT / tạo buổi | SKIP cần HV |
| Sửa thông tin 2 chiều | PASS API |
| Admin khóa → logout API | PASS sau fix |
| Cache/token cũ | PASS sau fix |

---

## Việc cần làm trước Nhóm 2

1. **Deploy** fix G1-20 (`auth.js` + `teacherRoutes` + `api.js`) lên VPS  
2. (Tuỳ chọn) Vá G1-02/G1-03 welcome email + notification  
3. Seed ≥1 HV trên local nếu muốn mở G1-18 trước khi sang Nhóm 2  

**Chưa chuyển Nhóm 2** cho đến khi bạn xác nhận deploy + tiếp tục.
