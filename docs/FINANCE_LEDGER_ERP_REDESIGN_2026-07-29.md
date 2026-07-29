# Thiết kế lại Module Tài chính — Ledger Accounting (ERP)

**Ngày:** 2026-07-29  
**Vai trò:** Senior ERP Financial Architect · Kế toán trưởng · Senior Fullstack  
**Phạm vi:** Database · API · Dashboard · Report · Invoice · Transaction · Refund · Revenue · Teacher Salary  
**Nguyên tắc:** Append-only Ledger = Source of Truth. Không sửa/xóa giao dịch đã posted. Không cập nhật trực tiếp “doanh thu” hay “số dư” làm SoT.

---

## 0. Kết luận điều hành

| Hạng mục | Đánh giá |
|----------|----------|
| Module Tài chính hiện tại đạt chuẩn ERP Ledger? | **Không** |
| Có thể Production với số liệu đối soát 100%? | **Không** |
| Hướng bắt buộc | **Ledger-first**: mọi KPI/Dashboard/Report/Export đọc từ `LedgerEntry` (mở rộng type), Student/Enrollment chỉ là **projection cache** |

Hệ thống đang vận hành **nhiều sổ song song**:

1. `Student.paid` / `paidAmount` / `enrollments[].paid|price|refundedAmount` → KPI BI / Analytics / một phần UI  
2. `LedgerEntry` (`payment|refund|adjustment`) → policy SoT nhưng **chưa nuôi Dashboard**  
3. `Invoice` → chứng từ thu, không giảm khi hoàn  
4. `Transaction` (lương GV) → ngoài ledger học phí  

→ UI “Đã thanh toán / Đã hoàn / Học phí đang theo” dễ nhầm vì **không cùng một định nghĩa kế toán**.

---

## 1. Các công thức hiện tại (AS-IS)

### 1.1 Doanh thu (Dashboard / BI / Analytics)

```
Revenue_KPI ≈ Σ enrollment.price  WHERE enrollment.paid === true
              (không trừ refund; không loại cancelled nếu vẫn paid=true)
```

Nguồn: `services/revenueAggregate.js`.

### 1.2 Doanh thu Ledger (đã có helper, chưa gắn UI chính)

```
Revenue_Gross_Ledger = Σ LedgerEntry.amount WHERE type=payment AND status=posted
Revenue_Refund_Ledger = Σ LedgerEntry.amount WHERE type=refund AND status=posted
Revenue_Net_Ledger    = Gross − Refund
```

Nguồn: `services/ledgerService.js` → `sumFinancialRevenue`.  
**Adjustments** có enum nhưng **không vào net**, hầu như không có writer nghiệp vụ.

### 1.3 Học viên — UI gần đây

| Nhãn UI | Cách tính gần đúng hiện tại | Vấn đề |
|---------|------------------------------|--------|
| Số tiền đã thanh toán | Σ Invoice thu (hoặc enrollment paid) | Gộp “đã nộp” với “học phí đăng ký” |
| Học phí đang theo | Σ price khóa **active** | Đúng hướng “còn hiệu lực” nhưng dễ hiểu thành doanh thu |
| Đã hoàn | Σ refundedAmount / ledger refund | Lệch khi DTO `courses` bỏ `refundedAmount` |
| Trạng thái đóng phí | paidCount / activeCount | Không phản ánh sổ cái |

### 1.4 Admin Finance tab

```
Net_UI = (active paid prices + cancelled original prices) − |refund rows|
```

Phụ thuộc DTO enrollment; dễ lệch Ledger.

### 1.5 Lương GV

```
Chi lương = Transaction (pending/confirmed) × Schedule.is_paid_to_teacher
```

**Không** nằm trong `LedgerEntry` → không có P&L thống nhất.

### 1.6 Lợi nhuận

**Không có** trong code.

---

## 2. Các công thức nên sửa (TO-BE — chuẩn ERP)

### 2.1 Định nghĩa tài khoản nghiệp vụ (logical)

Mọi dòng tiền = 1 dòng Ledger (không âm số dư trực tiếp):

| Type | Ý nghĩa | Dấu khi báo cáo |
|------|---------|-----------------|
| `PAYMENT` | Thu học phí / nhận tiền | + |
| `REFUND` | Hoàn tiền HV | − (doanh thu) |
| `SALARY` | Chi lương GV | − (chi phí) |
| `BONUS` | Thưởng | − (chi phí) |
| `EXPENSE` | Chi vận hành | − (chi phí) |
| `DISCOUNT` | Giảm giá ghi nhận (nếu tách khỏi giá catalog) | − hoặc metadata trên PAYMENT |
| `COUPON` | Áp mã giảm | tương tự DISCOUNT |
| `ADJUSTMENT` | Điều chỉnh có kiểm soát (void/reverse kèm `reversesEntryId`) | ± |

> **Khuyến nghị lưu `amount ≥ 0` + `type`** (như hiện tại) hoặc thêm `signedAmount` derived — không sửa dòng cũ.

### 2.2 Học viên (Student Finance Card) — đúng brief

```
Tổng học phí đã đăng ký (Registered Fee)
  = Σ enrollment.price   (mọi khóa từng đăng ký, kể cả đã hủy)
  // HOẶC: Σ catalog fee tại thời điểm đăng ký (snapshot trên enrollment)

Đã thanh toán (Cash In)
  = Σ Ledger PAYMENT (studentId)   [status=posted]

Đã hoàn tiền (Cash Out Refund)
  = Σ Ledger REFUND (studentId)

Giá trị khóa còn hiệu lực / Đang sử dụng (Active Course Value)
  = Σ enrollment.price WHERE status ∈ {active, completed, paused, pending_payment}
  // cancelled/refunded không tính

Doanh thu thuần gắn HV (Net collected)
  = PAYMENT − REFUND

Số dư / Còn phải đóng (Outstanding)
  = max(0, Registered_Fee_còn_hiệu_lực − (PAYMENT − REFUND)_phân_bổ
  // Khuyến nghị đơn giản giai đoạn 1:
  Outstanding = max(0, Active_Course_Value − Net_collected_allocated_to_active)
  // Giai đoạn 2: phân bổ FIFO theo enrollmentId trên từng Ledger line
```

**Ví dụ chuẩn (Excel 1.499.000 + PPT 749.000; hủy Excel hoàn đủ):**

| Chỉ tiêu | Giá trị |
|----------|---------|
| Tổng học phí đã đăng ký | **2.248.000** |
| Đã thanh toán | **2.248.000** |
| Đã hoàn tiền | **1.499.000** |
| Đang sử dụng (khóa còn hiệu lực) | **749.000** |
| Doanh thu thuần | **749.000** |
| Còn phải đóng | **0** |

### 2.3 Dashboard Admin (P&L)

```
Doanh thu gộp     = Σ PAYMENT
Hoàn tiền         = Σ REFUND
Doanh thu thuần   = PAYMENT − REFUND
Chi phí           = Σ SALARY + BONUS + EXPENSE (+ ADJUSTMENT chi)
Lợi nhuận         = Doanh thu thuần − Chi phí
```

**Cấm:** “Doanh thu = tiền đã thu trên Student.paid”.

### 2.4 Lịch sử = sổ cái (không gộp)

Mỗi dòng Ledger một dòng UI:

```
29/07  Thanh toán   +1.499.000   Excel
29/07  Thanh toán   +749.000     PowerPoint
30/07  Hoàn tiền    −1.499.000   Excel
```

Invoice (`HD…`) gắn `invoiceId` trên PAYMENT; REFUND có mã riêng (`R-…` hoặc `CN…` credit note) — **không xóa HĐ gốc**.

### 2.5 Trạng thái từng khóa

| Khóa | Giá | Thanh toán | Hoàn | Trạng thái khóa |
|------|-----|------------|------|-----------------|
| Excel | 1.499.000 | Đã thanh toán | Đã hoàn 1.499.000 | Đã hủy |
| PowerPoint | 749.000 | Đã thanh toán | 0 | Đang học |

Trạng thái thanh toán/hoàn **derive từ Ledger theo `enrollmentId`**, không chỉ flag boolean.

---

## 3. Các bảng cần chỉnh (Database)

### 3.1 Mở rộng `LedgerEntry` (bảng SoT)

| Thay đổi | Chi tiết |
|----------|----------|
| `type` enum | Thêm: `salary`, `bonus`, `expense`, `discount`, `coupon` (giữ `payment`, `refund`, `adjustment`) |
| Bắt buộc nghiệp vụ | `branchId`, `postedAt`, `idempotencyKey` ổn định (**cấm `Date.now()`**) |
| Liên kết | `enrollmentId`, `invoiceId`, `teacherId` (cho salary/bonus), `reversesEntryId` |
| Audit | `postedBy`, `postedByRole`, `ip`, `userAgent` (đã có một phần) |
| Không hard-delete | Chỉ `status: void` + dòng đảo |

### 3.2 `Invoice`

| Thay đổi | Chi tiết |
|----------|----------|
| Giữ nguyên | Chứng từ thu — không xóa khi hoàn |
| Thêm | `branchId`, `enrollmentId`, `ledgerEntryId`, `status: issued\|void` |
| Credit note | Model mới `CreditNote` **hoặc** Invoice type=`credit` liên kết HĐ gốc |

### 3.3 `Transaction` (lương GV) — giai đoạn chuyển tiếp

| Option A (khuyến nghị) | Mỗi phiếu lương confirmed → **post Ledger `salary`**; `Transaction` = voucher UI |
| Option B | Migrate hẳn vào Ledger, deprecate `Transaction` |

**Cấm** `DELETE` Transaction đã confirmed trên Production.

### 3.4 `Student` / `Enrollment` — demote thành cache

| Field | Vai trò mới |
|-------|-------------|
| `paid`, `paidAmount` | **Derived** từ Ledger (hoặc bỏ dần khỏi KPI) |
| `enrollments[].price` | Snapshot học phí đăng ký |
| `enrollments[].status` | Trạng thái khóa (active/cancelled/…) |
| `enrollments[].refundedAmount` | Cache Σ REFUND theo enrollment — **không** SoT |
| `enrollments[].paid` | Cache “đã có PAYMENT đủ” — không SoT |

Mọi thay đổi tiền: **post Ledger trước** (hoặc atomic session), rồi sync cache.

### 3.5 Bảng đối soát (mới — khuyến nghị)

`FinanceDailySnapshot` (optional): pre-aggregate theo ngày/chi nhánh từ Ledger để BI nhanh — **rebuild được** từ Ledger, không SoT độc lập.

---

## 4. Các API cần chỉnh

| API | Việc phải làm |
|-----|----------------|
| `POST /students` (paid) | Đã tạo Invoice+PAYMENT — chuẩn hóa idempotency; sync cache từ Ledger |
| `PUT /students/:id/pay` | Atomic claim; PAYMENT; cấm chỉ set `paid=true` |
| `PUT .../enrollments/:id/pay` | PAYMENT gắn `enrollmentId` |
| `PUT /students/:id/refund` | Chỉ `postRefund`; cập nhật cache; **idempotency ổn định** |
| `DELETE .../enrollments/:id` | Soft-cancel + REFUND nếu có; clear/derive paid từ Ledger; **không** để `paid=true` làm KPI phình |
| `POST /invoices` | Bắt buộc kèm PAYMENT hoặc cấm set `paid` đơn độc |
| Webhook SePay | PAYMENT + sync enrollment; session-only path phải settle đủ |
| **Mới** `GET /api/finance/ledger` | Sổ cái filter student/branch/from/to/type |
| **Mới** `GET /api/finance/summary` | Gross / Refund / Net / Cost / Profit từ Ledger |
| **Mới** `GET /api/finance/students/:id` | Card HV đúng 5 chỉ tiêu TO-BE |
| Teacher pay confirm | Post `salary` vào Ledger |
| Invoice stats / Export | Net = PAYMENT−REFUND; không `Σ hocPhi` thuần |
| BI `/overview` | Thay `sumPaidRevenue` bằng `sumFinancialRevenue` (+ cost) |
| Analytics revenue | Cùng service Ledger |
| Reconciliation job | Cron: Ledger vs Invoice vs cache; alert lệch ≥ 1đ |

---

## 5. Các Dashboard / UI cần chỉnh

### 5.1 Student Detail — Tab Tài chính

Thay cụm nhãn hiện tại bằng:

1. **Tổng học phí đã đăng ký**  
2. **Đã thanh toán**  
3. **Đã hoàn tiền** (đỏ)  
4. **Đang sử dụng** (khóa còn hiệu lực)  
5. **Còn phải đóng** / **Số dư**  

Bảng dưới = **sổ cái** (PAYMENT +, REFUND −), không gộp; mỗi khóa block trạng thái riêng.

### 5.2 Admin — Doanh thu học phí

Tách KPI:

- Doanh thu gộp  
- Hoàn tiền (đỏ)  
- Doanh thu thuần  
- (Super Admin) Chi phí lương + Lợi nhuận  

### 5.3 BI Dashboard

- Bỏ “Doanh thu kỳ = enrollment.paid × price”  
- Hoàn = **VND từ Ledger REFUND**, không đếm dòng QA  
- Thêm Chi phí / Lợi nhuận khi có SALARY trên Ledger  
- Cache key version bump mỗi lần đổi công thức  

### 5.4 Export Excel / PDF / Biểu đồ

Cùng `GET /api/finance/summary` + ledger lines — **một nguồn**.

---

## 6. Bug tài chính (thiết kế & vận hành)

### Critical (lỗi thiết kế SoT)

| ID | Bug |
|----|-----|
| D1 | KPI doanh thu đọc Student enrollment, không đọc Ledger |
| D2 | Cancel enrollment giữ `paid=true` → revenue KPI không giảm dù đã REFUND |
| D3 | Partial refund giảm `paidAmount` nhưng không giảm KPI enrollment price |
| D4 | Mutate `paidAmount`/`paid` rồi mới ghi Ledger; lỗi Ledger bị nuốt → lệch sổ |
| D5 | Idempotency REFUND/cancel dùng `Date.now()` → hoàn trùng |

### High

| ID | Bug |
|----|-----|
| H1 | Manual Invoice có thể `paid=true` không có Ledger |
| H2 | SePay PaymentSession paid thiếu Ledger/Invoice |
| H3 | Hard-delete Invoice / Transaction |
| H4 | Lương GV ngoài Ledger → không có P&L |
| H5 | Invoice không `branchId` → filter chi nhánh sai |
| H6 | DTO `courses` từng thiếu `refundedAmount` → UI hoàn = 0đ |

### Medium / Low

| ID | Bug |
|----|-----|
| M1 | Adjustment không vào net; không có API void chuẩn |
| M2 | GET full-detail backfill Invoice (side-effect đọc) |
| M3 | Fake % tăng trưởng trên Finance card |
| M4 | BI “Hoàn” từng đếm ledger test → số ảo |
| L1 | `void` status không dùng |
| L2 | Không có credit note |

---

## 7. Checklist đối soát trước Production

### 7.1 Đối soát công thức (1đ cũng fail)

Trên cùng `branchId` + `[from, to]`:

```
Dashboard Gross     ==  Σ Ledger PAYMENT posted
Dashboard Refund    ==  Σ Ledger REFUND posted
Dashboard Net       ==  Gross − Refund
Report / CSV / PDF  ==  Dashboard Net
API /finance/summary == Dashboard
Student card Net    ==  Σ PAYMENT(student) − Σ REFUND(student)
```

### 7.2 Kịch bản bắt buộc (E2E)

| # | Scenario | Kỳ vọng |
|---|----------|---------|
| 1 | Thêm HV 1 khóa + tiền mặt | 1 PAYMENT + 1 Invoice HD; card Đã TT = giá |
| 2 | Thêm khóa 2 + thu | 2 PAYMENT; Tổng đăng ký = sum prices |
| 3 | Hủy khóa 1 + hoàn đủ | 1 REFUND; Đang sử dụng = giá khóa 2; Net = giá khóa 2 |
| 4 | Hủy + hoàn 0 | REFUND 0 hoặc không post; Đang sử dụng giảm; Net không trừ |
| 5 | Hoàn 50% | REFUND đúng nửa; Outstanding/Net đúng |
| 6 | Retry hoàn / double click | Không double REFUND (idempotency) |
| 7 | SePay QR thành công | Đúng 1 PAYMENT |
| 8 | SePay fail/pending | 0 PAYMENT |
| 9 | Chi lương GV | 1 SALARY; Profit = Net − Salary |
| 10 | Soft-delete course catalog | Ledger không mất |
| 11 | Multi-branch | CN1 không thấy tiền CN2 |
| 12 | Export Excel/PDF | Khớp Ledger net |

### 7.3 Migration / Cutover

1. Backfill Ledger từ Invoice + lịch sử refund/cancel đã biết.  
2. Recompute `paidAmount` / flags từ Ledger (script).  
3. Bật feature flag `FINANCE_LEDGER_SOT=true` cho BI/Finance/Student.  
4. Chạy reconciliation job 7 ngày; lệch = 0 mới tắt dual-read.  
5. Cấm API mutate tiền không qua `postEntry`.

### 7.4 Definition of Done

Chỉ kết luận **“Module Tài chính đạt yêu cầu ERP”** khi:

- Mọi tiền vào/ra đều là Ledger line append-only  
- Dashboard / Report / API / DB aggregate **khớp từng đồng**  
- Student UI dùng đúng 5 chỉ tiêu TO-BE  
- Không còn KPI nào = `enrollment.paid × price`  
- Có P&L: Net − (Salary+Bonus+Expense)  

---

## 8. Lộ trình triển khai đề xuất (không làm một commit UI)

| Phase | Việc | Ưu tiên |
|-------|------|---------|
| **P0** | Mở rộng Ledger types; sửa idempotency; cancel clear derive paid; BI/Finance đọc `sumFinancialRevenue` | **DONE** (2026-07-29) |
| **P1** | API `/finance/summary` + `/finance/ledger`; Student Finance card TO-BE; sổ cái UI | **DONE** (2026-07-29) |
| **P2** | Teacher pay → Ledger `salary`; P&L Dashboard | **DONE** (2026-07-29) |
| **P3** | Credit note; void workflow; discount/coupon events; daily snapshot; hard-delete ban | **DONE** (2026-07-29) |
| **P4** | Deprecate `paidAmount` khỏi KPI; dual-book tắt | **DONE** (2026-07-29) |

---

## 9. Ánh xạ nhãn UI (tránh nhầm lẫn)

| Nhãn cũ (gây confuse) | Nhãn mới |
|----------------------|----------|
| Số tiền đã thanh toán (mơ hồ) | **Đã thanh toán** = Σ PAYMENT |
| Học phí đang theo | **Đang sử dụng** / Giá trị khóa còn hiệu lực |
| Đã hoàn (đôi khi 0đ do DTO) | **Đã hoàn tiền** = Σ REFUND (đỏ) |
| Doanh thu thực tế (Đã thu) | **Doanh thu thuần** = PAYMENT − REFUND |
| — | **Tổng học phí đã đăng ký** (gross đăng ký, không phải cash) |

---

## Phụ lục — Trạng thái code nền (đã có sẵn để tận dụng)

- `LedgerEntry` append-oriented + `settlePayment` / `postRefund`  
- `sumFinancialRevenue` / `reconciliationReport` (chưa gắn Dashboard)  
- Soft-cancel enrollment + giữ Invoice  
- UI Finance tab đã tách dòng Hoàn (cần SoT Ledger để đúng bền vững)  

**Chưa có:** SALARY trên Ledger, P&L, Student card 5 chỉ tiêu chuẩn, API finance thống nhất, cấm mutate SoT.

---

*Tài liệu này là thiết kế + audit. Triển khai code theo phase P0→P4 cần ticket riêng và checklist §7 trước khi Production.*
