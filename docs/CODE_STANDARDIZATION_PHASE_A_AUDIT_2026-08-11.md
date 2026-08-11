# PHASE A COMPLETE — READ ONLY AUDIT  
## Chuẩn hóa mã HV / GV / NV / KH / LH

**Date:** 2026-08-11  
**Mode:** READ ONLY — không sửa application code, DB, migration, Messaging, Auth/RBAC, Payment runtime  
**Next:** STOP — await owner approval trước PHASE B (Design)

---

## PHASE A COMPLETE

```
Application code changed: NO

Student code: FAIL (exists nhưng legacy/inconsistent)
Teacher code: FAIL (field không tồn tại)
Employee code: FAIL (field không tồn tại)
Course code: FAIL (không có courseCode; chỉ có slug)
Class code: N/A (không có entity Class độc lập)

Concurrency: FAIL (timestamp / countDocuments — không atomic counter)
Multiple courses per student: PASS (Enrollment trên Student — 1 studentCode / nhiều khóa)
Teacher assignment independence: PASS (chỉ ObjectId — không suy luận từ mã)
Payment: PASS design session-first; FAIL risk (studentCode format lệch + non-unique)
Invoice: PASS (hocVien = ObjectId; maHoaDon riêng)
Payroll: PASS (employeeId = ObjectId; không employeeCode)
Tenant: UNCHANGED
Branch: UNCHANGED (branchCode ≠ business person code)
RBAC/Auth: UNCHANGED
Messaging: UNCHANGED (không phụ thuộc studentCode/teacherCode)
Socket.IO: UNCHANGED
Regression: N/A (audit only)

Files changed: docs only (báo cáo này)
Tests: none run (read-only)
```

---

## 1. Hệ thống hiện đang tạo mã như thế nào

### 1.1 Học viên (`Student.studentCode`)

| Nguồn | Format | Ghi chú |
|-------|--------|---------|
| `AddStudentModal.jsx` | `TTH` + 5 số cuối `Date.now()` | Client; chỉ gắn payload khi QR success |
| `studentRoutes.js` create | `HV` + 8 số từ `Date.now()` | Nếu client không gửi / rỗng |
| `AddEnrollmentModal.jsx` | `TTH` + đuôi `_id` | Chỉ nội dung CK — **không** ghi `student.studentCode` |
| `RegistrationForm.jsx` | `{branch?}{TÊN8} Nop hoc phi` | **Không** persist `studentCode` |
| `TuitionPaymentModal.jsx` | stored code hoặc đuôi `_id` / `HV001` | Fallback display/QR |

Index: `Student.studentCode` — **sparse, không unique** (`models/Student.js`).

**Gap:** Cash / “Lưu chưa thanh toán” thường bỏ `studentCode` → server gán `HV…` trong khi QR đã hiện `TTH…`.

### 1.2 Giảng viên

- **Không có** `teacherCode` trên `models/Teacher.js`.
- Không generator `GV…`.
- Identity: Mongo `_id`; phone unique.

### 1.3 Nhân viên

- **Không có** `employeeCode` trên `models/Employee.js`.
- Payroll: `PayrollLog.employeeId` = ObjectId + snapshot name.
- VietQR: ghi chú tự do (`Luong {name}`).

### 1.4 Khóa học

- **Không có** `courseCode`.
- Có `Course.slug` (unique, từ name) — không phải `KH000001`.

### 1.5 Lớp học

- **Không có** entity Class / `classCode`.
- “Lớp” = enrollment + schedule + `Teacher.assignedClasses` (string tự do).

### 1.6 Atomic counter

- **Không có** collection `counters` / `$inc` sequence cho business code.
- Invoice `maHoaDon` / CreditNote dùng count/retry — **không** dùng cho HV/GV/NV.

---

## 2. Format legacy

| Format | Entity | Trạng thái |
|--------|--------|------------|
| `TTH#####` | Student (client QR) | Legacy / đang dùng |
| `HV########` (timestamp) | Student (server) | Legacy / đang dùng |
| Name slug trong CK | Registration | Không phải studentCode |
| `_id` slice | Tuition fallback | Không canonical |
| `Course.slug` | Course | Không phải KH… |
| Role badges `HV`/`GV` trong UI Messaging | Display label | **Không** phải business code |

---

## 3. Duplicate / missing (schema-level; chưa scan live DB)

| Check | Kết quả audit code |
|-------|-------------------|
| Unique constraint studentCode | **Thiếu** → duplicate có thể xảy ra |
| Missing studentCode | Nhiều HV có `''` hoặc chỉ được gán lúc create |
| teacherCode / employeeCode / courseCode | **Missing 100%** (field không tồn tại) |
| Live DB duplicate scan | **Chưa chạy** (PHASE A không đụng DB) |

**Nếu PHASE B/C:** bắt buộc audit Mongo trước unique index: `missing | duplicate | invalid | legacy`. Duplicate → STOP, không auto-merge.

---

## 4. Frontend vs backend generators

| Location | Sinh mã? | Authority? |
|----------|----------|------------|
| `AddStudentModal` | Có (`TTH`+time) | **Sai** — client authoritative khi QR |
| `AddEnrollmentModal` | Có (CK only) | Không persist |
| `RegistrationForm` | Không mã ổn định | Session-only |
| `studentRoutes` create | Có (`HV`+time) | Server nhưng timestamp |
| Teacher / Employee / Course create | Không business seq | — |
| `codeGeneratorService` | **Không tồn tại** | — |

---

## 5. Đối soát học phí (SePay)

| Cơ chế | Chi tiết |
|--------|----------|
| Primary | `PaymentSession.ref` + amount (±1) — `webhookRoutes.js` |
| Fallback | Extract tokens từ CK → `Student.studentCode` + unpaid + amount ≈ price — `utils/sepayMatch.js` |
| Invoice | `hocVien` = ObjectId; `maHoaDon` = `HD…` — **không** dùng để match CK |
| Rủi ro | TTH lưu ≠ HV trong DB; extractor rộng `[a-z0-9]{5,16}`; code non-unique → ambiguity |

**Khuyến nghị (chỉ ghi nhận):** giữ session-first; fallback studentCode fail-closed khi nhiều match. Không rewrite payment history trong migration.

---

## 6. Quan hệ Student–Teacher

```
student.teacherId          → ObjectId
enrollments[].teacherId    → ObjectId
TeacherAssignmentSegment   → studentId + teacherId ObjectIds
studentMatchesTeacher()    → so sánh string ObjectId
```

**Không** dùng `studentCode` / teacher business code.  
**Không** tìm thấy logic `HV → GV` / `replace('HV','GV')` / map số thứ tự.

---

## 7. Một HV nhiều khóa / nhiều GV

```
Student (1 document, 1 studentCode nếu có)
  enrollments[]:
    courseId / courseName
    teacherId / teacherName   ← có thể khác nhau theo khóa
    price, paid, sessions...
```

- Thêm khóa: `POST /students/:id/enrollments`
- Gán GV: `PUT .../assign-teacher` với `teacherId` + `enrollmentId`
- **PASS** nguyên tắc “1 studentCode / nhiều enrollment” về mặt kiến trúc quan hệ (dù mã chưa canonical).

---

## 8. Suy luận GV từ mã HV?

**Không có.** PASS assignment independence.

---

## 9. Messaging dependency

| Check | Result |
|-------|--------|
| `studentCode` in messaging policy/pairing/DM | **Không** |
| Pairing Student↔Teacher | ObjectId ownership |
| UI badge `HV`/`GV` | Label role only |
| Conversation IDs | Không dựa business code |

```
MESSAGING DEPENDENCY FOUND: NONE (for business codes)
```

→ Không sửa Messaging. Chỉ ghi nhận.

Socket.IO / RBAC / JWT / tenant / branch authorization: **không** dựa `studentCode`/`teacherCode`/`employeeCode`.

---

## 10. Đề xuất migration an toàn (chỉ đề xuất — chưa làm)

### Nguyên tắc

1. **Không** đổi `_id`, enrollment, assignment, ledger, payroll history.
2. Server-only generator + Mongo **counters** atomic `$inc`.
3. Canonical: `HV000001`, `GV000001`, `NV000001`, `KH000001` (Course); **không** tạo `LH…` nếu không có Class entity.
4. Backfill missing/legacy studentCode → `HV######` tuần tự; giữ map legacy→canonical cho payment rematch nếu cần (compatibility layer).
5. Unique index **sau** audit DB + zero duplicates.
6. Frontend bỏ `TTH`+`Date.now`; QR/CK dùng mã server trả về.
7. Payment: ưu tiên `PaymentSession.ref`; fallback code fail-closed.
8. Teacher/Employee: thêm field + generate on create; không đụng Messaging.

### Phụ thuộc cần approval trước PHASE C

- Format pad width (6 digits?).
- Có backfill live DB ngay hay chỉ create-path mới?
- Compatibility: giữ match cả `TTH*` legacy bao lâu?
- Course: migrate `slug` → thêm `courseCode` song song hay chỉ mã mới?

---

## Known risks (STOP triggers nếu PHASE C không xử lý)

| Risk | Severity |
|------|----------|
| TTH vs HV lệch QR/DB | High — payment rematch |
| studentCode non-unique | High — wrong student match |
| Client-generated authoritative code | High — concurrency |
| Không atomic counter | High — race |
| Broad sepay extractor | Medium |
| Missing GV/NV/KH codes | Medium — product goal |
| Live DB chưa scan duplicate | **Blocker** trước unique index |

---

## Files referenced (read-only)

- `models/Student.js`, `models/Teacher.js`, `models/Employee.js`, `models/Course.js`
- `routes/studentRoutes.js`, `routes/webhookRoutes.js`, `routes/employeeRoutes.js`
- `utils/sepayMatch.js`, `modules/payment/services/PaymentApplicationService.js`
- `client/.../AddStudentModal.jsx`, `AddEnrollmentModal.jsx`, `RegistrationForm.jsx`, `TuitionPaymentModal.jsx`
- `docs/STUDENT_FEE_CODE_AUDIT_2026-08-11.md` (prior fee-code report)

---

## Next

```
STOP — await approval
```

**Không chuyển PHASE B (Design) hoặc PHASE C (Implementation) cho đến khi owner approve báo cáo PHASE A này.**
