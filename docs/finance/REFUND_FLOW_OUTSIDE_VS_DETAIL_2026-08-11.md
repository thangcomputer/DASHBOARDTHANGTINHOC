# REFUND FLOW AUDIT — Outside List vs Student Detail

**Date:** 2026-08-11  
**Mode:** REPORT ONLY — zero application / DB / payment / Messaging writes  
**Auditor:** source-trace only

---

## 1. Executive Summary

Hai cửa UI **Hoàn học phí (Admin Students List)** và **Hủy khóa (Student Detail)** gọi **cùng** API live:

```text
DELETE /api/students/:id/enrollments/:enrollmentId
```

mount từ [`routes/studentRoutes.js`](../../routes/studentRoutes.js) qua [`server.js`](../../server.js) L886.

Khi hủy **enrollment active cuối cùng**, live sync gán:

```text
student.course = ''
```

trong khi `Student.course` là `required` → `student.save()` fail với:

```text
Student validation failed: course: Tên khóa học là bắt buộc
```

Đây khớp toast lỗi ngoài danh sách (UI evidence).

**CRITICAL:** `postRefund()` chạy **trước** `student.save()`. Không có MongoDB transaction / rollback. Ledger có thể đã ghi hoàn trong khi hồ sơ Student/Enrollment chưa soft-cancel thành công. Retry được bảo vệ **một phần** bởi `idempotencyKey` unique trên Ledger — không double-post cùng key, nhưng có **CONSISTENCY RISK** (sổ cái vs hồ sơ).

Bản [`modules/student/routes/studentRoutes.js`](../../modules/student/routes/studentRoutes.js) dùng `student.course = '(Đã hủy)'` — **không** phải runtime path.

**Runtime fix trong phase này: NOT IMPLEMENTED.**

---

## 2. Evidence Boundary

| Source | Used |
|--------|------|
| `client/src/components/admin/tabs/AdminStudentsTab.jsx` | YES |
| `client/src/components/StudentDetailModal.jsx` | YES |
| `client/src/services/api.js` | YES |
| `server.js` mount | YES |
| `routes/studentRoutes.js` DELETE enrollment | YES |
| `models/Student.js` | YES |
| `services/ledgerService.js` `postRefund` / `postEntry` | YES |
| `models/LedgerEntry.js` unique idempotencyKey | YES |
| `modules/student/routes/studentRoutes.js` sync (non-live) | YES (compare only) |
| Live Mongo read for NGUYỄN VĂN LAN | **NOT EXECUTED** |
| Real DELETE / refund API call | **NOT EXECUTED** |

UI screenshots (list toast + Detail finance LAN) = **operator-provided**, not re-verified against DB in this audit.

---

## 3. Frontend Entry Points

### A. Admin Students List — [`AdminStudentsTab.jsx`](../../client/src/components/admin/tabs/AdminStudentsTab.jsx)

```text
getRefundableEnrollment(student)
  → paid active enrollment (primary ưu tiên)
openRefundModal(student, enr)
  → if !enrId || enrId === 'main'
       → toast: "Không xác định được khóa để hoàn. Mở hồ sơ chi tiết…"
       → return (không mở modal)
  → else setRefundModal({ student, enr, enrId, reason:'', refundAmount:max, … })
handleConfirmRefund
  → api.students.deleteEnrollment(sid, enrId, {
       cancelReason: reason || 'Admin hoàn học phí',
       refundAmount: Number(refundAmount) || 0,
     })
```

- Success: toast + đóng modal + `refreshStudentList`
- Fail: toast `res.message` (validation message từ server hiện ở đây)

### B. Student Detail — [`StudentDetailModal.jsx`](../../client/src/components/StudentDetailModal.jsx)

```text
handleDeleteEnrollment → cancelEnrModal (reason, refundAmount)
handleConfirmCancelEnrollment
  → api.students.deleteEnrollment(sid, enrId, {
       cancelReason: reason || 'Admin hủy khóa',
       refundAmount: Number(refundAmount) || 0,
     })
```

- Success: toast + `reloadProfile`
- Fail: toast `res.message`

### C. API client — [`api.js`](../../client/src/services/api.js) ~788–794

```text
DELETE /students/${id}/enrollments/${enrollmentId}
Content-Type: application/json
body: { cancelReason, refundAmount }
```

---

## 4. Payload Comparison

| Field | Admin Students List | Student Detail | Same? |
|-------|---------------------|----------------|-------|
| studentId | `student.id \|\| student._id` | `data.student._id \|\| id \|\| studentId` | YES (same student doc id) |
| enrollmentId | `enr.enrollmentId \|\| enr.id \|\| enr._id` | `enr.enrollmentId \|\| enr._id \|\| enr.id` | YES if same enrollment |
| refundAmount | modal number (default = price) | modal number (default = price if paid) | YES shape |
| cancelReason | `reason \|\| 'Admin hoàn học phí'` | `reason \|\| 'Admin hủy khóa'` | **Default string differs** |
| endpoint | `/api/students/:id/enrollments/:enrollmentId` | same | YES |
| HTTP method | DELETE | DELETE | YES |

```text
SAME API = YES
SAME PAYLOAD = YES (shape); cancelReason default text DIFFERENT
SAME ENROLLMENT TARGET = YES when both pass real Mongo enrollment _id
```

Default reason text does **not** change validation / save path.

---

## 5. Live Backend Route

```text
server.js
  require('./routes/studentRoutes')   // L850
  app.use('/api/students', studentRoutes)  // L886

routes/studentRoutes.js
  DELETE /:id/enrollments/:enrollmentId   // ~L2263
```

**Actual order of operations (live):**

1. Auth / branch / `MANAGE_STUDENTS` / assert branch  
2. `Student.findById`  
3. Legacy hydrate enrollment if needed  
4. Find enrollment by `_id`  
5. Reject if already `cancelled`  
6. Compute `refundAmt` from body (cap ≤ price; only if was paid)  
7. If `refundAmt > 0` → require `MANAGE_FINANCE`  
8. **If `refundAmt > 0` → `postRefund(...)` FIRST**  
9. Soft-cancel enrollment fields in memory  
10. Reassign primary if needed  
11. **`syncStudentFromPrimaryEnrollment(student)`**  
12. Adjust `student.paid` / `paidAmount`  
13. **`await student.save()`**  
14. Audit + socket emit  
15. `success: true` response  

No `mongoose.startSession` / `withTransaction` observed on this path.

---

## 6. Root Cause

### Schema — [`models/Student.js`](../../models/Student.js)

```text
course: {
  type: String,
  required: [true, 'Tên khóa học là bắt buộc'],
  trim: true,
}
```

### Sync — live [`routes/studentRoutes.js`](../../routes/studentRoutes.js) ~2050–2064

```text
if (!active.length) {
  student.course = '';
  ...
}
```

### Chain (CONFIRMED from source)

```text
last active enrollment cancelled (in-memory)
        ↓
active enrollments = 0
        ↓
student.course = ''
        ↓
student.save()
        ↓
Mongoose required validation
        ↓
Student validation failed: course: Tên khóa học là bắt buộc
        ↓
HTTP 500, success:false (catch returns error.message)
```

```text
Root cause: CONFIRMED (source)
```

Toast ngoài list khớp chuỗi này khi hủy khóa cuối + `refundAmount` bất kỳ (fail ở `save`, sau `postRefund` nếu có tiền hoàn).

---

## 7. Live vs Modules Comparison

| Implementation | No active enrollment | Value assigned to `student.course` |
|----------------|----------------------|------------------------------------|
| Live `routes/studentRoutes.js` | YES | `''` (empty) |
| Modules `modules/student/routes/studentRoutes.js` | YES | `'(Đã hủy)'` |

```text
server.js uses: routes/studentRoutes.js
modules implementation: NOT mounted for /api/students
```

---

## 8. Financial Ordering

```text
postRefund
   ↓
syncStudentFromPrimaryEnrollment (course='')
   ↓
student.save → validation error
```

```text
FINANCIAL CONSISTENCY RISK = HIGH
```

Hậu quả khi `refundAmt > 0`:

- Ledger refund **có thể đã posted**  
- Enrollment soft-cancel **có thể chưa persist**  
- Không có compensation / void tự động khi `save` fail sau refund  

Không có Mongo transaction trên path này (**CONFIRMED** — không thấy session).

---

## 9. Double Refund / Retry Risk

Cancel path keys:

```text
sourceRef:      cancel:${student._id}:${enr._id}
idempotencyKey: refund:cancel:${student._id}:${enr._id}
```

[`postEntry`](../../services/ledgerService.js): insert; on duplicate key → return existing `{ created: false }`.  
[`LedgerEntry`](../../models/LedgerEntry.js): `idempotencyKey` **unique index**.

Retry cùng enrollment:

```text
Request #1: postRefund created=true → save FAIL
Request #2: postRefund created=false (same key) → soft-cancel again → save FAIL (cùng course='')
```

→ **Không** nhân đôi ledger cùng key.  
→ Enrollment vẫn có thể **không** cancelled sau nhiều retry.  
→ Credit note chỉ khi `created` (retry không issue CN lần 2).

```text
DOUBLE_REFUND_RISK = LOW
(idempotent same enrollment; HIGH consistency gap remains)
```

Nếu lần 2 dùng **enrollmentId khác** / key khác → risk khác — ngoài scope case hủy cùng khóa.

---

## 10. Refund Ledger Evidence (source)

`postRefund` tạo entry `type: 'refund'`, amount > 0, `sourceRef` từ caller, `enrollmentId`, `courseName`, không set `maHoaDon` trên ledger line.

Idempotency = **`idempotencyKey`**, không phải chỉ `sourceRef` (sourceRef cũng ổn định trên cancel path).

Invoice: payment invoice gốc **không** bị xóa; refund có thể tạo credit note khi `created` (`issueCreditNoteForRefund`). Không rewrite `Invoice.maHoaDon`.

---

## 11. Invoice / Ledger Consistency

| Entity | Updated during refund? | Order | Transaction protected? |
|--------|------------------------|-------|------------------------|
| Ledger | YES (if refundAmt > 0) | 1 — before save | NO (idempotent insert only) |
| Credit note / related invoice docs | YES if `created` + CN path | after ledger insert | partial (void on CN fail) |
| Enrollment (in-memory → save) | YES intended | 2 — with student.save | NO |
| Student root fields | YES intended | 2 — save | NO |
| Original payment Invoice.maHoaDon | NO rewrite | — | — |

```text
CONSISTENCY RISK: Ledger may show refund while Student/Enrollment still active if save fails
```

---

## 12. Last Enrollment Analysis

| Scenario | Active before | Active after (intended) | `student.course` after sync | Save |
|----------|--------------:|------------------------:|-----------------------------|------|
| Cancel one of many | ≥2 | ≥1 | = remaining primary `courseName` | PASS (source) |
| Cancel last | 1 | 0 | `''` (live) | **FAIL** required (source) |

---

## 13. Legacy `enrollmentId = main`

List `openRefundModal`:

```text
if (!enrId || enrId === 'main') → toast → BLOCK open modal
```

`getClientEnrollments` tạo synthetic `enrollmentId: 'main'` khi HV chỉ có root `student.course` không có mảng enrollments thật.

```text
LEGACY_MAIN_REFUND = REDIRECT_TO_DETAIL / BLOCKED on list
(Detail may soft-create legacy enrollment server-side on DELETE if course exists — see route hydrate)
```

Server DELETE: nếu `!enrollments.length && student.course` → hydrate `legacyEnrollmentFromStudent` rồi cancel theo `_id` mới — **NOT VERIFIED** end-to-end in this audit (no live call).

---

## 14. Success Case Verification

Operator UI case:

```text
NGUYỄN VĂN LAN / thvp / 3.000.000đ / HD2608-0004 / Detail finance shows refund
```

```text
SUCCESS CASE = NOT VERIFIED
```

Lý do: không đọc Mongo / không gọi API trong phase này.  
Source **không** chứng minh Detail dùng API khác List. Nếu Detail từng SUCCESS khi còn ≥1 enrollment active khác, hoặc sau khi course đã hợp lệ bằng cách khác — **NOT VERIFIED**.  
`HD2608-0004` trên UI khớp pattern Invoice payment code (display); dòng hoàn UI dạng `cancel:…` khớp `sourceRef` — **consistent with source mapping**, not DB-proven for this student.

---

## 15. Recommended Fix — REPORT ONLY

### Option A — Safe state value (align modules)

```text
student.course = '(Đã hủy)'
```

- Pros: minimal; matches modules comment; unblocks save  
- Cons: display root course becomes placeholder  

### Option B — Preserve last course name

Keep last `courseName` on student root; status from enrollments only.

- Pros: UI vẫn thấy tên khóa  
- Cons: phải đảm bảo mọi list filter dùng enrollment status, không tin `student.course` = đang học  

### Option C — Reorder: save state then postRefund / or compensate

- Pros: giảm HIGH consistency risk  
- Cons: cần design kỹ (partial fail sau save, trước refund)  

### Option D — Mongo transaction

- Only if architecture adopts sessions; **currently unused** on this path  

**Suggested priority (evidence-based):**

```text
P0 = financial consistency (ledger before save without rollback)
P1 = last-enrollment validation failure (course='')
P1 = ensure cancel persists on retry after ledger idempotent hit
P2 = UI legacy main handling (already blocked + toast)
P2 = converge live sync with modules '(Đã hủy)'
```

**NOT IMPLEMENTED in this phase.**

---

## 16. Risk Matrix

| Risk | Level | Notes |
|------|-------|-------|
| List last-enrollment cancel fail | CONFIRMED | `course=''` |
| Detail vs List different API | REJECTED | same DELETE |
| Ledger without student cancel | HIGH | order of ops |
| Double refund same key | LOW | unique idempotencyKey |
| Legacy main from list | BLOCKED | toast to Detail |
| Messaging impact | NONE | untouched |
| Business code impact | NONE | untouched |

---

## 17. Out of Scope

- Runtime code changes  
- Schema / migration / indexes  
- Real refund / DELETE / webhook / SePay  
- Messaging / Auth / RBAC  
- Business Code / C4  
- Implementing Options A–D  

---

## 18. Zero-Write Proof

```text
Application code changed: NO
Database changed: NO
Student / Enrollment / Invoice / Ledger / Payroll writes: NO
Payment / Refund / Webhook executed: NO
Messaging / Conversation / Message: NO
Business Code migration: UNCHANGED
C4: NOT STARTED
Files created: docs/finance/REFUND_FLOW_OUTSIDE_VS_DETAIL_2026-08-11.md ONLY
```

---

## 19. Final Verdict

Hai cửa **cùng nghiệp vụ API**. Hành vi khác nhau chủ yếu do:

1. List chặn sớm `enrollmentId === 'main'`  
2. Khi modal mở và hủy **khóa cuối**, live sync `course=''` → validation fail (CONFIRMED)  
3. `postRefund` trước `save` → HIGH financial consistency risk nếu đã hoàn tiền  

```text
========================================
REFUND FLOW AUDIT FINAL STATUS
========================================

Application code changed: NO
Database changed: NO

Student data changed: NO
Enrollment data changed: NO
Invoice changed: NO
Ledger changed: NO
Payroll changed: NO

Payment executed: NO
Refund executed: NO
Webhook replayed: NO

Messaging changed: NO
Conversation changed: NO
Message changed: NO

Business Code migration: UNCHANGED
C4: NOT STARTED

Frontend outside refund:
AUDITED

Student Detail refund:
AUDITED

Live backend route:
AUDITED

Root cause:
CONFIRMED

Financial consistency risk:
HIGH

Double refund risk:
LOW

Recommended fix:
REPORT ONLY

Runtime fix:
NOT IMPLEMENTED

========================================
STOP
========================================
```
