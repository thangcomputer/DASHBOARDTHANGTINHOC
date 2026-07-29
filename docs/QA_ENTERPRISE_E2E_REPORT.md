# QA Enterprise E2E Report — QUANLYCMS

**Ngày:** 2026-07-29T05:38:44.811Z
**Môi trường:** Local API `http://127.0.0.1:5000`
**Stack thực tế:** MongoDB + Mongoose + Express + React/Vite (+ Redis optional, Socket.IO).
**Lưu ý brief:** PostgreSQL/Prisma/Firebase trong yêu cầu là hướng đích / kênh — **không** phải runtime đã kiểm tra đầy đủ.
**Phạm vi:** Seed 3CN + roles + 30HV (≥2 khóa) + API smoke + concurrent JWT. **Không Pass toàn hệ thống** khi còn NOT RUN.
**Quy tắc:** Không sửa product code trong vòng QA này.

## Seed summary
```json
{
  "branches": 3,
  "superAdmin": 1,
  "admins": 3,
  "staff": 3,
  "teachers": 6,
  "students": 30,
  "courses": 6,
  "password": "Test@123456",
  "note": "QA_ENTERPRISE_2026"
}
```

## Kết quả case: PASS 15 · FAIL 11 · WARN 0
**Production readiness (ước lượng, conservative): 52%**

> Module chỉ được gắn **PASS** khi mọi case của module Pass **và** không còn gap nghiệp vụ bắt buộc. Các module còn FAIL/NOT RUN → **FAIL / PARTIAL**.

## Theo module

# System

**Verdict: ❌ Fail / Partial**
- Pass: 1 · Fail: 1 · Warn: 0
- **[PASS]** `SYS-01` — Healthz — `200 redis=disabled queue=inline`
- **[FAIL]** `SYS-02` — Redis for multi-instance — `disabled`
  - Severity: High
  - API: GET /healthz
  - Root cause: REDIS_URL chưa cấu hình trên môi trường local
  - Fix: Bật Redis trên staging/prod trước go-live

------------------------------------------------

# Authentication

**Verdict: ❌ Fail / Partial**
- Pass: 1 · Fail: 1 · Warn: 0
- **[PASS]** `AUTH-CONC-01` — Concurrent JWT /auth/me (42 actors) — `ok=42 fail=0 avgMs=40 wall=54ms`
- **[FAIL]** `AUTH-CONC-02` — Concurrent password+CAPTCHA login (42 users) — `CAPTCHA SVG one-shot — suite không đọc được đáp án → chưa chạy password login đồng thời`
  - Severity: Medium
  - API: POST /api/auth/login/public|internal
  - Root cause: CAPTCHA không có bypass test hook
  - Fix: CAPTCHA_BYPASS chỉ khi NODE_ENV=test

------------------------------------------------

# Multi Branch

**Verdict: ⚠️ Partial (smoke only — chưa đủ luồng nghiệp vụ)**
- Pass: 1 · Fail: 0 · Warn: 0
- **[PASS]** `BRANCH-01` — Staff CN1 không thấy HV CN2 — `status=200 total=10 leaked=0`

------------------------------------------------

# RBAC

**Verdict: ⚠️ Partial (smoke only — chưa đủ luồng nghiệp vụ)**
- Pass: 1 · Fail: 0 · Warn: 0
- **[PASS]** `RBAC-01` — Admin CN1 (có finance) bị chặn pay HV CN2 theo branch — `status=403 msg=Không có quyền thao tác học viên chi nhánh khác`

------------------------------------------------

# Course

**Verdict: ⚠️ Partial (smoke only — chưa đủ luồng nghiệp vụ)**
- Pass: 1 · Fail: 0 · Warn: 0
- **[PASS]** `COURSE-01` — DELETE course = soft-delete — `api=200 deletedAt=Wed Jul 29 2026 12:38:44 GMT+0700 (Giờ Đông Dương)`

------------------------------------------------

# Payment

**Verdict: ❌ Fail / Partial**
- Pass: 1 · Fail: 1 · Warn: 0
- **[PASS]** `PAY-01` — Admin xác nhận thanh toán — `status=200 paid=true msg=Đã xác nhận thanh toán 2.500.000đ`
- **[FAIL]** `PAY-REF-01` — Refund partial + full + revenue/invoice — `NOT RUN trong suite lần này`
  - Severity: Critical
  - API: -
  - Root cause: Phạm vi API/seed chưa cover luồng này
  - Fix: Bổ sung automation + chạy lại regression

------------------------------------------------

# Attendance

**Verdict: ⚠️ Partial (smoke only — chưa đủ luồng nghiệp vụ)**
- Pass: 1 · Fail: 0 · Warn: 0
- **[PASS]** `ATT-01` — GV điểm danh present — `api=200 status=completed att=present`

------------------------------------------------

# Schedule

**Verdict: ❌ Fail / Partial**
- Pass: 1 · Fail: 1 · Warn: 0
- **[PASS]** `REASSIGN-01` — Ownership completed GV A ≥ 8 — `{"6a6991e23dc72df1ba35b4e2":9}`
- **[FAIL]** `REASSIGN-E2E-01` — Đổi GV A→B full E2E (8/12 + HV giữ lịch/điểm/BT) — `NOT RUN trong suite lần này`
  - Severity: Critical
  - API: -
  - Root cause: Phạm vi API/seed chưa cover luồng này
  - Fix: Bổ sung automation + chạy lại regression

------------------------------------------------

# Exam

**Verdict: ⚠️ Partial (smoke only — chưa đủ luồng nghiệp vụ)**
- Pass: 1 · Fail: 0 · Warn: 0
- **[PASS]** `EXAM-01` — Unlock exam — `status=200 unlocked=true`

------------------------------------------------

# Rating

**Verdict: ⚠️ Partial (smoke only — chưa đủ luồng nghiệp vụ)**
- Pass: 1 · Fail: 0 · Warn: 0
- **[PASS]** `RATING-01` — pending rating không public — `false`

------------------------------------------------

# Dashboard

**Verdict: ⚠️ Partial (smoke only — chưa đủ luồng nghiệp vụ)**
- Pass: 1 · Fail: 0 · Warn: 0
- **[PASS]** `DASH-01` — KPI operational ≠ financial — `status=200 separated=true`

------------------------------------------------

# Notification

**Verdict: ❌ Fail / Partial**
- Pass: 1 · Fail: 3 · Warn: 0
- **[PASS]** `NOTIF-01` — HV list notifications — `status=200`
- **[FAIL]** `NOTIF-02` — Zalo OA env — `missing`
  - Severity: Medium
  - API: -
  - Root cause: Env missing trên local
  - Fix: Cấu hình ZALO_OA_ACCESS_TOKEN
- **[FAIL]** `NOTIF-03` — SMTP env — `missing`
  - Severity: Medium
  - API: -
  - Root cause: Env missing trên local
  - Fix: Cấu hình SMTP_*
- **[FAIL]** `FIREBASE-01` — Firebase push device thật — `NOT RUN trong suite lần này`
  - Severity: Medium
  - API: -
  - Root cause: Phạm vi API/seed chưa cover luồng này
  - Fix: Bổ sung automation + chạy lại regression

------------------------------------------------

# Assignment

**Verdict: ❌ Fail / Partial**
- Pass: 1 · Fail: 1 · Warn: 0
- **[PASS]** `ASG-01` — GV tạo bài tập — `status=200 msg=`
- **[FAIL]** `GRADE-HIST-01` — Grade history 80→90→95 old/new/user/time — `NOT RUN trong suite lần này`
  - Severity: High
  - API: -
  - Root cause: Phạm vi API/seed chưa cover luồng này
  - Fix: Bổ sung automation + chạy lại regression

------------------------------------------------

# Audit Log

**Verdict: ⚠️ Partial (smoke only — chưa đủ luồng nghiệp vụ)**
- Pass: 1 · Fail: 0 · Warn: 0
- **[PASS]** `AUDIT-01` — Có audit critical actions — `count=12`

------------------------------------------------

# UI E2E

**Verdict: ❌ Fail / Partial**
- Pass: 0 · Fail: 1 · Warn: 0
- **[FAIL]** `UI-01` — Playwright toàn bộ màn Admin/Staff/GV/HV — `NOT RUN trong suite lần này`
  - Severity: High
  - API: -
  - Root cause: Phạm vi API/seed chưa cover luồng này
  - Fix: Bổ sung automation + chạy lại regression

------------------------------------------------

# Socket

**Verdict: ❌ Fail / Partial**
- Pass: 0 · Fail: 1 · Warn: 0
- **[FAIL]** `SOCK-01` — Realtime reconnect/offline/duplicate event — `NOT RUN trong suite lần này`
  - Severity: High
  - API: -
  - Root cause: Phạm vi API/seed chưa cover luồng này
  - Fix: Bổ sung automation + chạy lại regression

------------------------------------------------

# Performance

**Verdict: ❌ Fail / Partial**
- Pass: 0 · Fail: 1 · Warn: 0
- **[FAIL]** `PERF-01` — Đo CPU/RAM/DB query dưới 42 user concurrent write — `NOT RUN trong suite lần này`
  - Severity: Medium
  - API: -
  - Root cause: Phạm vi API/seed chưa cover luồng này
  - Fix: Bổ sung automation + chạy lại regression

------------------------------------------------

# Regression

**Verdict: ⚠️ Partial (smoke only — chưa đủ luồng nghiệp vụ)**
- Pass: 1 · Fail: 0 · Warn: 0
- **[PASS]** `UNIT-01` — Phase integration gates — `pass=120 fail=0 exit=0`

------------------------------------------------

## 1. Danh sách toàn bộ Bug

### SYS-02 — Redis for multi-instance
- **Severity:** High · **Priority:** P1
- **Module:** System
- **Expected / Actual:** redis up / disabled
- **Root cause:** REDIS_URL chưa cấu hình trên môi trường local
- **Reproduce:** GET /healthz
- **API / UI / DB:** GET /healthz / Chưa kiểm UI (API-only) / 
- **Impact:** Cache/session/socket scale hạn chế khi multi-instance
- **Cách sửa:** Bật Redis trên staging/prod trước go-live

### AUTH-CONC-02 — Concurrent password+CAPTCHA login (42 users)
- **Severity:** Medium · **Priority:** P2
- **Module:** Authentication
- **Expected / Actual:** Automate được login thật 30HV+6GV+3Admin+3Staff / CAPTCHA SVG one-shot — suite không đọc được đáp án → chưa chạy password login đồng thời
- **Root cause:** CAPTCHA không có bypass test hook
- **Reproduce:** Cần 42 captcha answers song song
- **API / UI / DB:** POST /api/auth/login/public|internal / Login form / 
- **Impact:** Chưa verify race device-lock / refresh token trên login thật
- **Cách sửa:** CAPTCHA_BYPASS chỉ khi NODE_ENV=test

### NOTIF-02 — Zalo OA env
- **Severity:** Medium · **Priority:** P2
- **Module:** Notification
- **Expected / Actual:** token present / missing
- **Root cause:** Env missing trên local
- **Reproduce:** 
- **API / UI / DB:**  / Chưa kiểm UI (API-only) / 
- **Impact:** Không gửi Zalo ngoài in-app
- **Cách sửa:** Cấu hình ZALO_OA_ACCESS_TOKEN

### NOTIF-03 — SMTP env
- **Severity:** Medium · **Priority:** P2
- **Module:** Notification
- **Expected / Actual:** SMTP_HOST / missing
- **Root cause:** Env missing trên local
- **Reproduce:** 
- **API / UI / DB:**  / Chưa kiểm UI (API-only) / 
- **Impact:** 
- **Cách sửa:** Cấu hình SMTP_*

### UI-01 — Playwright toàn bộ màn Admin/Staff/GV/HV
- **Severity:** High · **Priority:** P1
- **Module:** UI E2E
- **Expected / Actual:** Đã kiểm tra E2E đầy đủ / NOT RUN trong suite lần này
- **Root cause:** Phạm vi API/seed chưa cover luồng này
- **Reproduce:** 
- **API / UI / DB:**  / Chưa kiểm UI (API-only) / 
- **Impact:** Không đủ bằng chứng Pass cho go-live
- **Cách sửa:** Bổ sung automation + chạy lại regression

### SOCK-01 — Realtime reconnect/offline/duplicate event
- **Severity:** High · **Priority:** P1
- **Module:** Socket
- **Expected / Actual:** Đã kiểm tra E2E đầy đủ / NOT RUN trong suite lần này
- **Root cause:** Phạm vi API/seed chưa cover luồng này
- **Reproduce:** 
- **API / UI / DB:**  / Chưa kiểm UI (API-only) / 
- **Impact:** Không đủ bằng chứng Pass cho go-live
- **Cách sửa:** Bổ sung automation + chạy lại regression

### PAY-REF-01 — Refund partial + full + revenue/invoice
- **Severity:** Critical · **Priority:** P0
- **Module:** Payment
- **Expected / Actual:** Đã kiểm tra E2E đầy đủ / NOT RUN trong suite lần này
- **Root cause:** Phạm vi API/seed chưa cover luồng này
- **Reproduce:** 
- **API / UI / DB:**  / Chưa kiểm UI (API-only) / 
- **Impact:** Không đủ bằng chứng Pass cho go-live
- **Cách sửa:** Bổ sung automation + chạy lại regression

### GRADE-HIST-01 — Grade history 80→90→95 old/new/user/time
- **Severity:** High · **Priority:** P1
- **Module:** Assignment
- **Expected / Actual:** Đã kiểm tra E2E đầy đủ / NOT RUN trong suite lần này
- **Root cause:** Phạm vi API/seed chưa cover luồng này
- **Reproduce:** 
- **API / UI / DB:**  / Chưa kiểm UI (API-only) / 
- **Impact:** Không đủ bằng chứng Pass cho go-live
- **Cách sửa:** Bổ sung automation + chạy lại regression

### REASSIGN-E2E-01 — Đổi GV A→B full E2E (8/12 + HV giữ lịch/điểm/BT)
- **Severity:** Critical · **Priority:** P0
- **Module:** Schedule
- **Expected / Actual:** Đã kiểm tra E2E đầy đủ / NOT RUN trong suite lần này
- **Root cause:** Phạm vi API/seed chưa cover luồng này
- **Reproduce:** 
- **API / UI / DB:**  / Chưa kiểm UI (API-only) / 
- **Impact:** Không đủ bằng chứng Pass cho go-live
- **Cách sửa:** Bổ sung automation + chạy lại regression

### FIREBASE-01 — Firebase push device thật
- **Severity:** Medium · **Priority:** P2
- **Module:** Notification
- **Expected / Actual:** Đã kiểm tra E2E đầy đủ / NOT RUN trong suite lần này
- **Root cause:** Phạm vi API/seed chưa cover luồng này
- **Reproduce:** 
- **API / UI / DB:**  / Chưa kiểm UI (API-only) / 
- **Impact:** Không đủ bằng chứng Pass cho go-live
- **Cách sửa:** Bổ sung automation + chạy lại regression

### PERF-01 — Đo CPU/RAM/DB query dưới 42 user concurrent write
- **Severity:** Medium · **Priority:** P2
- **Module:** Performance
- **Expected / Actual:** Đã kiểm tra E2E đầy đủ / NOT RUN trong suite lần này
- **Root cause:** Phạm vi API/seed chưa cover luồng này
- **Reproduce:** 
- **API / UI / DB:**  / Chưa kiểm UI (API-only) / 
- **Impact:** Không đủ bằng chứng Pass cho go-live
- **Cách sửa:** Bổ sung automation + chạy lại regression

## 2. Phân loại severity
- Critical: 2
- High: 4
- Medium: 5
- Low: 0

## 3. Production readiness: **52%**
Không khuyến nghị Production cho đến khi Critical/High nghiệp vụ (refund, reassign E2E, Redis, UI/Socket) được đóng.

## 4. Chức năng còn thiếu / chưa cover
- UI E2E Playwright đầy đủ mọi role/màn
- Concurrent password+CAPTCHA login 42 users
- Firebase Push thật
- Zalo/Email send end-to-end (nếu env thiếu)
- Socket reconnect/offline/duplicate matrix
- Refund partial/full chứng từ đầy đủ
- Grade edit history collection/UI
- Đổi GV A→B full business E2E (giữ lịch/điểm/BT + payroll 8/12)
- PostgreSQL/Prisma — brief lệch; runtime hiện tại MongoDB+Mongoose
- Perf profiling CPU/RAM/query plan dưới tải write

## 5. Rủi ro nếu Production ngay
- Redis disabled → rủi ro multi-instance / cache inconsistency
- CAPTCHA + device lock chưa load-test bằng automation
- Coverage API-only → bug UI/UX và Socket có thể lọt
- Refund/grade-history/reassign E2E chưa chạy → rủi ro tài chính & lương GV
- Cross-branch IDOR phụ thuộc middleware nhất quán trên mọi route
- Phase 8–15 soft-delete/ledger mới — cần verify trên staging gần prod

## 6. Thứ tự sửa ưu tiên
1. [Critical] PAY-REF-01 — Refund partial + full + revenue/invoice
2. [Critical] REASSIGN-E2E-01 — Đổi GV A→B full E2E (8/12 + HV giữ lịch/điểm/BT)
3. [High] SYS-02 — Redis for multi-instance
4. [High] UI-01 — Playwright toàn bộ màn Admin/Staff/GV/HV
5. [High] SOCK-01 — Realtime reconnect/offline/duplicate event
6. [High] GRADE-HIST-01 — Grade history 80→90→95 old/new/user/time
7. [Medium] AUTH-CONC-02 — Concurrent password+CAPTCHA login (42 users)
8. [Medium] NOTIF-02 — Zalo OA env
9. [Medium] NOTIF-03 — SMTP env
10. [Medium] FIREBASE-01 — Firebase push device thật
11. [Medium] PERF-01 — Đo CPU/RAM/DB query dưới 42 user concurrent write

## 7. Regression rule
Sau mỗi bugfix: chạy lại module liên quan + `node --test tests/integration/*Phase*.test.js` + `node scripts/qa_enterprise_seed_e2e.cjs`.

## Credentials test (local only — đổi ngay nếu lộ)
- Password chung: `Test@123456`
- Super Admin phone: `0999000001`
- Admin CN1: `0981100001` · Staff CN1: `0982100001` · GV CN1-1: `097100001`
- HV CN1-01: `096110001` · email `qa.hv.cn1.01@test.local`