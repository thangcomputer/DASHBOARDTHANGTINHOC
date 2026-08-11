# POST-REFUND STUDENT DETAIL UX

**Date:** 2026-08-11  
**Mode:** REPORT ONLY — không sửa runtime, không rewrite Ledger/Invoice, không Messaging, không C4  
**Component:** [`client/src/components/StudentDetailModal.jsx`](../../client/src/components/StudentDetailModal.jsx)  
**List lock (tham chiếu):** [`client/src/components/admin/tabs/AdminStudentsTab.jsx`](../../client/src/components/admin/tabs/AdminStudentsTab.jsx) `isStudentRowLocked`

---

## 1. Case evidence (UI)

Học viên **HỌC VIÊN TEST 22** / `# HV22621567`:

| Field | Value |
|-------|--------|
| Khóa | khóa học test |
| Trạng thái khóa | **ĐÃ HỦY · HOÀN 4.000.000đ** |
| Lý do | Admin hoàn học phí · 11/8/2026 |
| Header badge | **Chưa đóng phí** (sai) |
| Trạng thái đào tạo | **Đang học** (sai) |
| Tài chính — Đã thanh toán | 0đ |
| Tài chính — Đã hoàn | 4.000.000đ |
| Tài chính — Net | 0đ |
| Sổ cái Mã HĐ (dòng hoàn) | `cancel:6a7aa55d…:6a7aa55d…` (sai display) |
| Tab Bài tập / Sửa thông tin | Vẫn mở / thao tác được (sai) |

```text
Sau hoàn khóa cuối:
  → số liệu ledger (đã hoàn / net) có vẻ đúng
  → badge + trạng thái học + Mã HĐ + quyền tab: lệch UX
```

---

## 2. Mong đợi vận hành

| Bề mặt | Mong đợi |
|--------|----------|
| Header badge | «Đã hoàn» / «Đã hủy khóa» — **không** «Chưa đóng phí» |
| Trạng thái đào tạo | Không còn học / đã hủy (không «Đang học») |
| Mã HĐ dòng hoàn | Display hợp lệ (`HOÀN-####` hoặc `—`) — **không** raw `cancel:…` |
| Bài tập / Sửa thông tin / thao tác học | **Khóa** khi không còn enrollment active |
| Thêm khóa mới | Mở lại các chức năng học / sửa theo khóa active |

---

## 3. Root cause

### 3.1 Badge «Chưa đóng phí»

[`StudentDetailModal.jsx`](../../client/src/components/StudentDetailModal.jsx) ~617–619, 876–878:

```text
headerPaid =
  enrollmentCount > 0
    ? (paidCount >= enrollmentCount)
    : !!student.paid

→ 0 khóa active + student.paid = false sau hoàn
→ headerPaid = false
→ UI: "Chưa đóng phí"
```

List HV đã có `isStudentRowLocked` (không còn active, chỉ cancelled/refunded) — **Detail không áp dụng cùng rule** cho badge.

### 3.2 «Đang học» dù khóa đã hủy

`statusLabel` (~542–546) lấy từ `activeEnrollment`. Khi không còn enrollment active đúng nghĩa, fallback `student.status` hoặc nhánh còn coi trạng thái như đang học — không map «chỉ còn khóa đã hủy/hoàn» → «Không còn học».

### 3.3 Mã HĐ `cancel:…`

Cancel/refund ledger ghi:

```text
sourceRef = cancel:${studentId}:${enrollmentId}
```

FINANCE-UI-01: display `maHoaDon || sourceRef`.  
`isValidInvoiceDisplayCode` **không** loại `cancel:…` → raw sourceRef hiện cột Mã HĐ thay vì fallback `HOÀN-####`.

### 3.4 Tab Bài tập / Sửa thông tin không khóa

Tabs (`assignments`, `edit`, …) không gate theo `activeEnrollments.length === 0`.  
Chỉ danh sách HV (`isStudentRowLocked`) khóa thao tác row — **Detail vẫn cho can thiệp**.

```text
CODE-LEVEL presentation / permission UX: YES
LEDGER AMOUNTS (paid/refund/net): likely OK for this case
DATA rewrite needed: NO
```

---

## 4. Flow

```text
Cancel + refund last enrollment
        │
        ├─► Ledger refund (sourceRef cancel:…)     → số hoàn OK
        ├─► Enrollment status = cancelled          → badge khóa «ĐÃ HỦY» OK
        ├─► headerPaid fallback student.paid=false → «Chưa đóng phí» ✗
        ├─► resolveInvoiceDisplayCode(sourceRef)   → cancel:… ✗
        └─► Detail tabs không lock                 → vẫn sửa/bài tập ✗
```

---

## 5. Evidence matrix

| Check | Result | Evidence |
|-------|--------|----------|
| Ledger đã hoàn / net 0 | PASS (UI) | Finance cards |
| Enrollment «ĐÃ HỦY · HOÀN» | PASS | Overview course card |
| Header ≠ «Chưa đóng phí» sau hoàn | **FAIL** | headerPaid logic |
| Mã HĐ hoàn ≠ raw cancel: | **FAIL** | isValidInvoiceDisplayCode accepts cancel: |
| Lock Bài tập / Sửa TT khi 0 active | **FAIL** | no gate on tabs |
| List row lock khi chỉ cancelled | PASS (list) | isStudentRowLocked — Detail thiếu |
| Messaging / C4 / Invoice rewrite | N/A | Out of scope |

---

## 6. Recommended fix (CHƯA IMPLEMENT)

1. **Badge header:** nếu không còn enrollment active:
   - có `refundedAmount` / ledger refund → «Đã hoàn» (hoặc «Đã hủy khóa»)
   - không còn active và không nợ → không hiện «Chưa đóng phí»
2. **Trạng thái đào tạo:** khi `activeEnrollments.length === 0` → «Không còn học» / «Đã hủy» — không «Đang học».
3. **Mã HĐ display:** coi `sourceRef` bắt đầu `cancel:` (và tương tự không phải `HD…`) là **không hợp lệ** cho cột Mã HĐ → dùng fallback display `HOÀN-####` (display-only).
4. **Lock tabs:** khi không còn enrollment active — disable / read-only `assignments`, `edit` (và thao tác học tương tự); **Tài chính / Tổng quan** vẫn xem được lịch sử.
5. **Unlock:** khi Admin thêm enrollment mới (active) → mở lại chức năng.
6. **Không** đổi `postRefund` sourceRef DB; **không** rewrite Ledger/Invoice; **không** Messaging; **không** C4.

---

## 7. Absolute non-actions (phase này)

```text
Application runtime changed: NO
Database changed: NO
Invoice / Ledger rewritten: NO
Messaging changed: NO
C4 started: NO
```

---

## 8. Verdict

```text
POST-REFUND DETAIL — badge fee status: FAIL
POST-REFUND DETAIL — training status: FAIL
POST-REFUND DETAIL — cancel Mã HĐ display: FAIL
POST-REFUND DETAIL — lock study/edit tabs: FAIL
LEDGER SUMMARY AMOUNTS: PASS (for observed case)

NEXT: Owner approve UI-only fix on StudentDetailModal
STOP — report only
```
