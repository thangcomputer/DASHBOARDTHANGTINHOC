# QA Enterprise LIVE Re-run

**Started:** 2026-07-29T07:05:57.328Z
**Finished:** 2026-07-29T07:05:57.654Z
**API:** http://127.0.0.1:5000 · **FE:** http://localhost:5173
**Runtime stack:** MongoDB + Express + React/Vite + Socket.IO (Redis: disabled)

## Summary

- Live suite cases: **20 PASS / 13 FAIL** (total 33)
- Group scripts (cùng session): G1 25/25 · G2 22/22 · G3 13/13 · G4–8 19/19
- Integration: **93 PASS / 5 FAIL** (98)
- Critical FAIL: 5 · High FAIL: 6
- **Sẵn sàng Deploy VPS:** KHÔNG

# System

**Verdict:** FAIL (pass=3 fail=1)

## SYS-01 — Backend healthz
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: PASS
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `status=200 db=up redis=disabled queue=inline`

## SYS-02 — Redis connected
- Result: **FAIL**
- UI: N/A (API/DB evidence)
- API: FAIL
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `redis=disabled`
- Severity: High
- Impact: Multi-instance cache/socket/queue hạn chế
- Fix: Cấu hình REDIS_URL trên staging/prod

## SYS-03 — Frontend Vite
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: PASS
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `status=200`

## STACK-01 — Stack brief vs runtime
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: N/A
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `MongoDB connected; prisma/=0; redis=disabled`

---

# Seed

**Verdict:** PASS (pass=3 fail=0)

## SEED-01 — 3 chi nhánh CN1/CN2/CN3
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: N/A
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `n=3 codes=CN1,CN2,CN3`

## SEED-02 — Roles Super/Admin/Staff/Teacher
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: N/A
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `{"super":1,"admin":3,"staff":3,"teacher":6}`

## SEED-03 — 30 HV QA + ≥2 khóa
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: N/A
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `students=30 multiEnroll=30 courses=6`

---

# Authentication

**Verdict:** FAIL (pass=1 fail=1)

## AUTH-CONC-01 — Concurrent JWT /auth/me (43)
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: PASS
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `ok=43 fail=0 avgMs=1 wall=60ms`

## AUTH-LOGIN-01 — Password login Super Admin (no captcha)
- Result: **FAIL**
- UI: N/A (API/DB evidence)
- API: FAIL
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `status=403 msg=Tài khoản này thuộc nhóm Nhân Viên/Quản Trị. Vui lòng đăng nhập qua Cổng nội bộ (Admin).`
- Severity: High
- Impact: Smoke scripts không login được; automation cần CAPTCHA_BYPASS test-only
- Fix: CAPTCHA_BYPASS=1 chỉ NODE_ENV=test; hoặc trả captchaId+hint trong test

---

# Multi Branch

**Verdict:** PASS (pass=1 fail=0)

## BRANCH-01 — Staff CN1 không thấy HV CN2/CN3
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: PASS
- Database: N/A
- Socket: N/A
- Permission: PASS
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `status=200 total=10 leaked=0`

---

# RBAC

**Verdict:** PASS (pass=2 fail=0)

## RBAC-01 — Admin CN1 không pay HV CN2
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: PASS
- Database: N/A
- Socket: N/A
- Permission: PASS
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `status=403 msg=Không có quyền thao tác học viên chi nhánh khác`

## RBAC-02 — Super Admin list students
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: PASS
- Database: N/A
- Socket: N/A
- Permission: PASS
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `status=200`

---

# Course

**Verdict:** FAIL (pass=0 fail=1)

## COURSE-01 — DELETE course = soft-delete (không hard delete)
- Result: **FAIL**
- UI: N/A (API/DB evidence)
- API: FAIL
- Database: courses
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `api=200 exists=false deletedAt=null status=GONE`
- Severity: Critical
- Impact: Hard delete — mất lịch sử catalog; rủi ro báo cáo/enrollment orphan
- Fix: Đổi findByIdAndDelete → status=archived + deletedAt; filter catalog

---

# Payment

**Verdict:** FAIL (pass=2 fail=3)

## PAY-01 — Admin xác nhận thanh toán
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: PASS
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `status=200 paid=true paidAmount=2500000 msg=Đã xác nhận thanh toán 2.500.000đ ledgerPaymentRows=null`

## PAY-02 — Ledger payment entry sau settle
- Result: **FAIL**
- UI: N/A (API/DB evidence)
- API: N/A
- Database: ledgerentries
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `ledgerPaymentRows=null`
- Severity: Critical
- Impact: Doanh thu tài chính chưa SoT qua ledger — báo cáo dễ lệch student.paid
- Fix: Gọi ledgerService.settlePayment trong route pay

## PAY-REF-01 — Hoàn tiền 50% (partial)
- Result: **FAIL**
- UI: N/A (API/DB evidence)
- API: FAIL
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `status=200 paid=false paidAmount=0 msg=Đã hoàn/hủy thanh toán 2.500.000đ`
- Severity: Critical
- Impact: Không hỗ trợ hoàn một phần — finance/ERP lệch yêu cầu
- Fix: Nhận body.amount; giảm paidAmount; post ledger refund; giữ invoice

## PAY-REF-02 — Hoàn tiền 100% + giữ invoice
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: PASS
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `status=200 paid=false invBefore=0 invAfter=0 ledgerRefund=null msg=Đã hoàn/hủy thanh toán 2.500.000đ`

## PAY-REF-03 — Ledger refund entry
- Result: **FAIL**
- UI: N/A (API/DB evidence)
- API: N/A
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `ledgerRefund=null`
- Severity: Critical
- Impact: 
- Fix: Gọi ledgerService.recordRefund trong route refund

---

# Schedule

**Verdict:** FAIL (pass=1 fail=1)

## REASSIGN-01 — Ownership completed GV A (seed ≥8)
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: N/A
- Database: schedules
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `{"6a6991e23dc72df1ba35b4e2":9}`

## REASSIGN-E2E-01 — Đổi GV A→B giữ tiến độ + lịch completed A
- Result: **FAIL**
- UI: N/A (API/DB evidence)
- API: FAIL
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `put=400 completedSessions=8 histA=9`
- Severity: Critical
- Impact: 
- Fix: 

---

# Attendance

**Verdict:** FAIL (pass=0 fail=1)

## ATT-01 — Tạo buổi + điểm danh present
- Result: **FAIL**
- UI: N/A (API/DB evidence)
- API: FAIL
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `status=400 msg=Học viên này đã được điểm danh. Vui lòng thử lại sau 10.5 tiếng. id=`
- Severity: High
- Impact: 
- Fix: 

---

# Exam

**Verdict:** FAIL (pass=0 fail=1)

## EXAM-01 — Unlock exam
- Result: **FAIL**
- UI: N/A (API/DB evidence)
- API: FAIL
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `status=500 studentExamUnlocked=true enr=true`
- Severity: High
- Impact: 
- Fix: 

---

# Notification

**Verdict:** FAIL (pass=1 fail=2)

## NOTIF-01 — HV list notifications
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: PASS
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: PASS
- Audit: N/A
- Performance: N/A
- Actual: `status=200 n=6`

## NOTIF-02 — Zalo OA env
- Result: **FAIL**
- UI: N/A (API/DB evidence)
- API: N/A
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: FAIL
- Audit: N/A
- Performance: N/A
- Actual: `missing`
- Severity: Medium
- Impact: 
- Fix: 

## NOTIF-03 — SMTP env
- Result: **FAIL**
- UI: N/A (API/DB evidence)
- API: N/A
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: FAIL
- Audit: N/A
- Performance: N/A
- Actual: `missing`
- Severity: Medium
- Impact: 
- Fix: 

---

# Socket

**Verdict:** PASS (pass=1 fail=0)

## SOCK-01 — Socket.IO connect with student JWT
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: N/A
- Database: N/A
- Socket: PASS
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `connected`

---

# Audit

**Verdict:** PASS (pass=1 fail=0)

## AUDIT-01 — SystemLog có bản ghi 24h
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: N/A
- Database: systemlogs
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: PASS
- Performance: N/A
- Actual: `last24h=380 sampleAction=CẬP NHẬT HV`

---

# Assignment

**Verdict:** FAIL (pass=0 fail=1)

## GRADE-HIST-01 — Grade history old→new trong assignment routes
- Result: **FAIL**
- UI: N/A (API/DB evidence)
- API: N/A
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `hasGradeHistory=false hasScoreHistory=false`
- Severity: High
- Impact: Sửa điểm không lưu old/new → không đạt yêu cầu audit chấm điểm
- Fix: Append gradeHistory trên mỗi lần sửa điểm + writeAudit

---

# Dashboard

**Verdict:** PASS (pass=1 fail=0)

## DASH-01 — BI overview Super Admin
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: PASS
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `status=200`

---

# Upload

**Verdict:** PASS (pass=1 fail=0)

## UPLOAD-01 — Files stats API
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: PASS
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `status=200`

---

# Rating

**Verdict:** PASS (pass=1 fail=0)

## RATING-01 — Evaluation model / moderation field tồn tại
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: N/A
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `pendingApprox=0 probe=0`

---

# UI E2E

**Verdict:** FAIL (pass=0 fail=1)

## UI-01 — Playwright toàn bộ màn Admin/Staff/GV/HV
- Result: **FAIL**
- UI: FAIL
- API: N/A
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: N/A
- Actual: `NOT RUN full matrix trong suite này — xem docs/QA_UI_GOLDEN_PATHS_REPORT.md (7 paths PASS lần trước). Cần regression UI lại.`
- Severity: High
- Impact: Không đủ bằng chứng Pass UI toàn hệ thống cho go-live
- Fix: 

---

# Performance

**Verdict:** PASS (pass=1 fail=0)

## PERF-01 — Concurrent /auth/me latency
- Result: **PASS**
- UI: N/A (API/DB evidence)
- API: N/A
- Database: N/A
- Socket: N/A
- Permission: N/A
- Notification: N/A
- Audit: N/A
- Performance: PASS
- Actual: `actors=43 wall=60ms rssMb≈123.2`

---

## Critical bugs

- **COURSE-01** DELETE course = soft-delete (không hard delete) — api=200 exists=false deletedAt=null status=GONE
- **PAY-02** Ledger payment entry sau settle — ledgerPaymentRows=null
- **PAY-REF-01** Hoàn tiền 50% (partial) — status=200 paid=false paidAmount=0 msg=Đã hoàn/hủy thanh toán 2.500.000đ
- **PAY-REF-03** Ledger refund entry — ledgerRefund=null
- **REASSIGN-E2E-01** Đổi GV A→B giữ tiến độ + lịch completed A — put=400 completedSessions=8 histA=9

## High bugs

- **SYS-02** Redis connected — redis=disabled
- **AUTH-LOGIN-01** Password login Super Admin (no captcha) — status=403 msg=Tài khoản này thuộc nhóm Nhân Viên/Quản Trị. Vui lòng đăng nhập qua Cổng nội bộ (Admin).
- **ATT-01** Tạo buổi + điểm danh present — status=400 msg=Học viên này đã được điểm danh. Vui lòng thử lại sau 10.5 tiếng. id=
- **EXAM-01** Unlock exam — status=500 studentExamUnlocked=true enr=true
- **GRADE-HIST-01** Grade history old→new trong assignment routes — hasGradeHistory=false hasScoreHistory=false
- **UI-01** Playwright toàn bộ màn Admin/Staff/GV/HV — NOT RUN full matrix trong suite này — xem docs/QA_UI_GOLDEN_PATHS_REPORT.md (7 paths PASS lần trước). Cần regression UI lại.
