# STUDENT DETAIL — Lệch luồng Mã HĐ / studentCode

**Date:** 2026-08-11  
**Mode:** REPORT ONLY — không sửa runtime, không rewrite Invoice/Ledger, không đụng Messaging, không chạy C4  
**Component:** [`client/src/components/StudentDetailModal.jsx`](../../client/src/components/StudentDetailModal.jsx)  
**Ledger settle:** [`services/ledgerService.js`](../../services/ledgerService.js)

---

## 1. Case evidence (UI)

Học viên quan sát trên dashboard:

| Field | Value |
|-------|--------|
| Họ tên | THÍ SINH TEST |
| SĐT | `2233445566` |
| Chi nhánh | Hệ thống |
| Khóa | KHÓA HỌC IC3 (CHÍNH) |
| Trạng thái học phí | Đã thanh toán |
| Học phí | 1.899.000đ |
| Đăng ký | 11/8/2026 |
| Giảng viên | Chưa gán / Chưa phân công GV |
| Hợp đồng enrollment (tab Khóa học) | **Mã HĐ: `HD2608-0026`** |
| Sổ cái (tab Tài chính) | **Mã HĐ: `HĐ-0001`** |
| Header / Tài chính | **Không hiển thị `studentCode` (HV######)** |

```text
CÙNG một học viên + CÙNG khoản thanh toán IC3 1.899.000đ
  → tab Khóa học: HD2608-0026
  → tab Tài chính: HĐ-0001
```

→ Luồng hiển thị **không thống nhất**. Vận hành mong đợi: **một mã hóa đơn xuyên suốt** mọi tab.

---

## 2. Flow hiện tại vs flow mong đợi

### Hiện tại

```text
Invoice.maHoaDon = HD2608-0026
        │
        ├─► Tab Khóa học  → đọc Invoice.maHoaDon     → HD2608-0026  ✓
        │
        └─► LedgerEntry.sourceRef = HD2608-0026
                    │
                    ▼
              Tab Tài chính map ledger lines
                    │
                    │  đọc line.maHoaDon (không có trên LedgerEntry)
                    ▼
              Fallback synthetic              → HĐ-0001  ✗
```

### Mong đợi

```text
Invoice.maHoaDon = HD2608-0026
        │
        ├─► Tab Khóa học  → HD2608-0026
        └─► Tab Tài chính → HD2608-0026  (từ sourceRef / invoiceId join)

Header / profile → hiện studentCode = HV###### (nếu đã có trên Student)
```

---

## 3. Root cause

### 3.1 Tab Khóa học — đúng mã hệ thống

[`StudentDetailModal.jsx`](../../client/src/components/StudentDetailModal.jsx) (~1077–1091):

- Match `data.invoices` theo tên khóa + số tiền.
- Render `inv.maHoaDon` (canonical invoice number, dạng `HDYYMM-####`).

### 3.2 Tab Tài chính — synthetic UI code

Cùng file (~661–676), khi ưu tiên `ledgerCard.lines`:

```text
code = line.maHoaDon
if (!code || code === '—' || code === 'HĐ')
  → code = `HĐ-${pad4(hdCounter)}`   // HĐ-0001, HĐ-0002, ...
```

[`settlePayment`](../../services/ledgerService.js) (~104–107) ghi:

```text
invoiceId: invoice._id
sourceRef: invoice.maHoaDon   // ví dụ HD2608-0026
```

Ledger API **không** expose field `maHoaDon` trên từng line. UI không map `sourceRef` → cột Mã HĐ → luôn rơi vào fallback **`HĐ-0001`**.

### 3.3 Không phải hai hóa đơn DB khác nhau

| Layer | Kết luận |
|-------|----------|
| **PRODUCTION/DATA (invoice)** | Một mã thật `HD2608-####` trên `Invoice.maHoaDon` |
| **UI Tài chính** | Nhãn **synthetic** `HĐ-####`, không phải `maHoaDon` mới trong Mongo |

```text
CODE-LEVEL display bug: YES
DATA rewrite needed: NO
```

### 3.4 Gap `studentCode` trên Student Detail

- C2: server sinh `studentCode` = `HV######`; QR/create đã dùng.
- `StudentDetailModal` **không** render `student.studentCode` trên header / tab Tài chính.
- Business code chuẩn hóa **chưa xuất hiện** trên màn hình chi tiết HV mà vận hành đang xem.

---

## 4. Evidence matrix

| Check | Result | Evidence |
|-------|--------|----------|
| Enrollment Mã HĐ = Invoice.maHoaDon | PASS (display path) | StudentDetailModal match invoices |
| Finance Mã HĐ = Invoice.maHoaDon | **FAIL** | Fallback `HĐ-0001` khi thiếu `line.maHoaDon` |
| Ledger.sourceRef holds real code | PASS (design) | settlePayment `sourceRef \|\| invoice.maHoaDon` |
| studentCode on detail UI | **FAIL / MISSING** | No reference in StudentDetailModal |
| Financial history rewrite | NO | Report only |
| Messaging impact | NONE | Out of scope |

---

## 5. Recommended fix (CHƯA IMPLEMENT)

1. **Finance map:** khi dựng dòng ledger, set  
   `code = line.maHoaDon || line.sourceRef`  
   (hoặc join `invoiceId` → `Invoice.maHoaDon`).
2. **Chỉ dùng** fallback `HĐ-####` khi cả `maHoaDon` và `sourceRef` đều trống.
3. **Header detail:** hiển thị `student.studentCode` (HV######) cạnh SĐT / tên — display only; không đổi `_id` / FK.
4. **Không** rewrite Invoice, Ledger, Payroll, PaymentSession.ref.
5. **Không** đụng Messaging / Auth / RBAC.
6. **Không** chạy C4 / unique index / migration trong báo cáo này.

---

## 6. Absolute non-actions (phase này)

```text
Application runtime changed: NO
Database changed: NO
Invoice / Ledger / Payroll rewritten: NO
Messaging changed: NO
C4 started: NO
```

---

## 7. Verdict

```text
LUỒNG STUDENT DETAIL — MÃ HĐ: FAIL (UI inconsistency)
LUỒNG STUDENT DETAIL — studentCode visibility: FAIL (not shown)
DB INVOICE IDENTITY: likely OK (single HD######)
ROOT CAUSE: Finance tab ignores LedgerEntry.sourceRef

NEXT: Owner approve UI fix on StudentDetailModal (+ optional ledger API enrich)
STOP — report only
```
