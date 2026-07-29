# AUDIT TOÀN BỘ LUỒNG TÀI CHÍNH — QUANLYCMS

**Ngày:** 2026-07-29  
**Vai trò:** Senior Software Architect · Backend · Financial System Auditor  
**Phạm vi:** Payment · Refund · Ledger · Invoice · CreditNote · Enrollment · Student · BI · API · Race · DB · Frontend · Security  
**Nguyên tắc audit:** LedgerEntry = Source of Truth duy nhất. Không giả định code đúng.  
**Hành động:** **CHỈ ĐỌC CODE — không sửa.**

---

## 0. Kết luận điều hành

| Câu hỏi | Trả lời |
|---------|---------|
| Ledger đã là SoT trên **mọi** đường ghi tiền? | **Không** — nhiều path ghi Student/Invoice trước, Ledger best-effort |
| BI headline (net/refund/profit) đọc Ledger? | **Có** (`biService`, `/finance/summary`, analytics `/revenue`) |
| Dashboard admin (`/students/stats`) đọc Ledger? | **Không** — vẫn `sumPaidRevenue` (enrollment) |
| Có Mongo transaction trên finance? | **Không** — zero `startSession` / `withTransaction` trong repo |
| Idempotency key còn `Date.now()`? | **Không** (đã sửa P0) — nhưng một số key vẫn yếu |
| Production-ready đối soát từng đồng? | **Không** |

**Điểm vỡ SoT lớn nhất:** *mutate cache → tạo Invoice → try settlePayment/postRefund catch nuốt lỗi* → UI “đã thu/đã hoàn” trong khi sổ cái thiếu dòng.

---

# PHẦN A — CHI TIẾT TỪNG BUG

---

## CRITICAL

### C1 — Admin Pay: ghi Student/Invoice trước Ledger; lỗi Ledger bị nuốt

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Critical |
| **Vị trí** | `routes/studentRoutes.js` · `PUT /:id/pay` · ~1147–1196 |
| **Business Rule bị vi phạm** | Ledger SoT; thứ tự bắt buộc Invoice → Ledger → cập nhật cache |
| **Root Cause** | `student.paid=true` + `save()` → tạo Invoice → `settlePayment` trong `try/catch` chỉ `logger.warn` |
| **Hậu quả** | Học viên “đã thanh toán”, có HĐ, **không có PAYMENT** → BI thiếu doanh thu; hoàn sau lệch |
| **Cách tái hiện** | 1) Làm `LedgerEntry.create` fail tạm (unique/DB). 2) `PUT /api/students/:id/pay`. 3) Response 200, `paid=true`. 4) Query Ledger theo studentId → 0 payment |
| **Hướng sửa** | Atomic claim `paid:false→true` → Ledger trước (hoặc cùng Mongo txn) → chỉ commit cache khi Ledger OK; fail 5xx nếu Ledger fail |

**Cùng pattern Critical tại:**

| Handler | File · khoảng dòng |
|---------|-------------------|
| POST create HV paid | `studentRoutes.js` ~663–690 |
| POST thêm enrollment + thu | ~1697–1730 |
| PUT enrollment pay | ~1836–1880 |

---

### C2 — Student Refund: clear cache trước Ledger; lỗi Ledger bị nuốt

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Critical |
| **Vị trí** | `routes/studentRoutes.js` · `PUT /:id/refund` · ~1278–1320 |
| **Business Rule bị vi phạm** | Refund phải sinh Ledger REFUND (+ CreditNote); cache chỉ sau SoT |
| **Root Cause** | Update `paid`/`paidAmount`/enrollment → `save()` → `postRefund` catch nuốt |
| **Hậu quả** | HV đã “hoàn” trên UI/cache, **không REFUND trên sổ** → Net/BI **cao giả**; CreditNote không tạo |
| **Cách tái hiện** | 1) HV đã thu. 2) Phá `postEntry`. 3) `PUT .../refund`. 4) Student `paid=false`, Ledger chỉ còn PAYMENT |
| **Hướng sửa** | `postRefund` trước; chỉ update cache khi `created`; fail request nếu Ledger fail; CN trong cùng outbox |

---

### C3 — SePay PaymentSession: đánh dấu paid không ghi Ledger/Invoice

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Critical |
| **Vị trí** | `routes/webhookRoutes.js` · nhánh session · ~221–241 |
| **Business Rule bị vi phạm** | Mọi tiền vào = Ledger PAYMENT |
| **Root Cause** | `PaymentSession` `pending→paid` atomic; emit `tuition:paid`; **không** gọi `settlePayment` / Invoice / Student |
| **Hậu quả** | Tiền ngân hàng đã nhận, sổ cái = 0 cho đến khi form đăng ký tạo HV (nếu fail → orphan cash) |
| **Cách tái hiện** | 1) Tạo QR session. 2) Webhook khớp `ref`+amount. 3) Session `paid`. 4) Ledger/Invoice trống |
| **Hướng sửa** | Claim session → settle Ledger với key `payment:sepay:session:{sessionId}` (+ holding invoice hoặc link student sau) |

---

### C4 — POST Invoice thủ công: set `paid=true` không Ledger / không `paidAmount`

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Critical |
| **Vị trí** | `routes/invoiceRoutes.js` · `POST /` · ~103–132 |
| **Business Rule bị vi phạm** | Invoice là chứng từ, không phải SoT; không được cấp paid không qua Ledger |
| **Root Cause** | Tạo Invoice → nếu `!student.paid` thì `paid:true` — không `settlePayment`, không `paidAmount` |
| **Hậu quả** | HĐ orphan (không Ledger); HV “đã TT”; enrollment KPI / stats phình |
| **Cách tái hiện** | `POST /api/invoices` với HV chưa thu → `paid=true`, Ledger rỗng |
| **Hướng sửa** | Bắt buộc `settlePayment` hoặc cấm side-effect `paid` trên create invoice |

---

## HIGH

### H1 — Race Admin Pay (check-then-act, không atomic)

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | High |
| **Vị trí** | `studentRoutes.js` `PUT /:id/pay` ~1147–1170; enrollment pay ~1832–1854 |
| **Business Rule** | Idempotent admin pay; không double PAYMENT |
| **Root Cause** | `if (student.paid) return 409` rồi mutate — không `findOneAndUpdate({paid:false})` |
| **Hậu quả** | Double-click / 2 tab → 2 Invoice + 2 PAYMENT (key khác vì `maHoaDon` khác) |
| **Tái hiện** | 2 request song song `PUT .../pay` HV unpaid |
| **Hướng sửa** | Atomic claim; một `idempotencyKey` ổn định theo `studentId` lần thu đầu |

---

### H2 — Race Admin Pay × SePay student webhook

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | High |
| **Vị trí** | `studentRoutes.js` pay + `webhookRoutes.js` ~265–314 |
| **Business Rule** | Không double PAYMENT admin+gateway |
| **Root Cause** | Admin non-atomic; SePay atomic claim student; hai path key khác nhau |
| **Hậu quả** | Double doanh thu Ledger |
| **Tái hiện** | Admin pay và webhook khớp cùng lúc trên HV unpaid |
| **Hướng sửa** | Shared claim resource; key thống nhất theo student lần settle đầu |

---

### H3 — Cancel enrollment + refundAmount chỉ cần `manage_students`

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | High |
| **Vị trí** | `studentRoutes.js` `DELETE .../enrollments/:id` ~1901; UI `StudentDetailModal.jsx` cancel modal |
| **Business Rule** | Refund thuộc quyền finance |
| **Root Cause** | Guard `MANAGE_STUDENTS`; body `refundAmount` → `postRefund` |
| **Hậu quả** | Staff không `manage_finance` vẫn hoàn tiền |
| **Tái hiện** | Token staff chỉ `manage_students`, hủy khóa + refundAmount > 0 |
| **Hướng sửa** | Khi `refundAmount > 0` yêu cầu `MANAGE_FINANCE` |

---

### H4 — `/api/students/stats` doanh thu từ Enrollment, không Ledger

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | High |
| **Vị trí** | `studentRoutes.js` `GET /stats` ~274–320 · `revenueAggregate.sumPaidRevenue` |
| **Business Rule** | BI/report = Σ PAYMENT − REFUND từ Ledger |
| **Root Cause** | Comment + gọi enrollment aggregate |
| **Hậu quả** | Dashboard admin ≠ BI/Finance sau refund/cancel |
| **Tái hiện** | Thu rồi hoàn → Ledger net giảm; `/students/stats` totalRevenue vẫn cao |
| **Hướng sửa** | Đổi sang `sumFinancialRevenue` |

---

### H5 — BI byCourse + trend.revenue vẫn enrollment

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | High |
| **Vị trí** | `services/biService.js` ~51–171 · `listPaidItems` / `revenueByCourse` |
| **Business Rule** | KPI và chart cùng SoT Ledger |
| **Root Cause** | KPI strip Ledger; chart vẫn enrollment `price` (không trừ refund) |
| **Hậu quả** | Card net ≠ biểu đồ / xếp hạng khóa |
| **Tái hiện** | Hoàn 1 khóa → KPI net xuống; bar khóa vẫn full price |
| **Hướng sửa** | Aggregate Ledger theo `courseName` + `postedAt` |

---

### H6 — Analytics `/enrollment` gọi “revenue” từ enrollment

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | High |
| **Vị trí** | `routes/analyticsRoutes.js` `/enrollment` ~152–191 · UI RevenueAnalyticsTab |
| **Hậu quả** | Cùng màn hình conflict với `/analytics/revenue` (Ledger) |
| **Hướng sửa** | Đổi nhãn ops-only hoặc chuyển sang Ledger |

---

### H7 — Lương GV: Transaction trước, Ledger salary nuốt lỗi

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | High |
| **Vị trí** | `teacherRoutes.js` pay-flexible ~952–967, pay-all ~1080–1094; `transactionRoutes.js` confirm ~243–259 |
| **Business Rule** | Chi lương → Ledger SALARY → Profit |
| **Root Cause** | `Transaction.create` confirmed → `postSalary` catch log |
| **Hậu quả** | Có phiếu chi, **không SALARY** → Profit **ảo cao** |
| **Tái hiện** | Phá `postSalary`; pay-all 200; `finance/summary.costs` không tăng |
| **Hướng sửa** | Fail-closed hoặc rollback Transaction; outbox retry |

---

### H8 — Cancel Transaction không void SALARY Ledger

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | High |
| **Vị trí** | `transactionRoutes.js` `PUT /:id/cancel` ~284–296 |
| **Hậu quả** | Hủy phiếu sau confirm → costs Ledger còn → Profit thấp giả |
| **Hướng sửa** | Void/reversal Ledger khi cancel confirmed |

---

### H9 — Enrollment pay / cancel thiếu `branchFilter` / `assertStudentBranchAccess`

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | High |
| **Vị trí** | `studentRoutes.js` ~1816, ~1901 |
| **Hậu quả** | Staff chi nhánh A có thể thu/hoàn HV chi nhánh B (nếu có permission string) |
| **Hướng sửa** | Gắn cùng guard như `/:id/pay` và `/:id/refund` |

---

### H10 — CreditNote fail sau REFUND thành công chỉ warn

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | High |
| **Vị trí** | `services/ledgerService.js` `postRefund` ~211–224 · `issueCreditNoteForRefund` |
| **Business Rule** | Refund > 0 → CreditNote |
| **Hậu quả** | Có REFUND, thiếu CN |
| **Hướng sửa** | Outbox / retry; hoặc fail refund nếu CN bắt buộc |

---

### H11 — GET full-detail backfill Invoice side-effect (không Ledger)

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | High |
| **Vị trí** | `studentRoutes.js` full-detail ~409–451 |
| **Hậu quả** | Đọc GET tạo Invoice orphan khi cache paid thiếu HĐ |
| **Hướng sửa** | GET read-only; heal bằng job reconcile |

---

### H12 — PUT student generic có thể set `paid` không qua pay API

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | High |
| **Vị trí** | `studentRoutes.js` `PUT /:id` ~869–925 |
| **Hậu quả** | Bypass Ledger settle |
| **Hướng sửa** | Strip field tài chính khỏi generic PUT |

---

## MEDIUM

### M1 — Không có MongoDB multi-document transaction trên mọi finance path

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Medium (nền tảng Critical khi kết hợp C1–C2) |
| **Vị trí** | Toàn repo — grep `startSession` / `withTransaction` = **0** |
| **Hậu quả** | Không atomic Invoice+Ledger+Student |
| **Hướng sửa** | Transaction hoặc transactional outbox |

---

### M2 — Cancel: soft-cancel trước; nếu Ledger refund fail → khóa đã hủy, tiền chưa hoàn trên sổ

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Medium |
| **Vị trí** | `studentRoutes.js` DELETE enrollment ~1965–2013 |
| **Hậu quả** | Trạng thái khóa ≠ sổ tiền |
| **Hướng sửa** | Ledger refund trước khi commit cancel (nếu refund>0), hoặc saga bù |

---

### M3 — Hủy hoàn 0 không giảm `student.paidAmount` cache

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Medium |
| **Vị trí** | Cancel path + UI default `refundAmount: 0` |
| **Hậu quả** | `paidAmount` phình so với “đang dùng”; không ảnh hưởng Ledger net (đúng giữ tiền) nhưng cache lệch |
| **Hướng sửa** | Recompute `paidAmount` từ Ledger định kỳ / sau cancel |

---

### M4 — Partial refund không chỉnh enrollment `paid`/`price`

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Medium |
| **Vị trí** | `PUT /:id/refund` partial ~1278–1282 |
| **Hậu quả** | Chart enrollment vẫn full price; Ledger đúng |
| **Hướng sửa** | UI enrollment đọc Ledger allocation |

---

### M5 — Student Finance Card `paidCashIn` = active enrollment paid, không phải Σ Ledger PAYMENT

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Medium |
| **Vị trí** | `ledgerService.getStudentFinanceCard` ~444–473 |
| **Business Rule** | “Đã thanh toán” brief = Σ PAYMENT |
| **Hậu quả** | Card lệch lịch sử sổ cái sau partial / multi-pay / hủy giữ tiền |
| **Hướng sửa** | Tách nhãn: Cash-in Ledger vs “Đã thu khóa đang dùng” |

---

### M6 — Discount/Coupon/Adjustment không vào Net/Profit

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Medium |
| **Vị trí** | `sumFinancialRevenue` ~269–291 |
| **Hậu quả** | Net không phản ánh giảm giá |
| **Hướng sửa** | `net = payments − refunds − discount − coupon ± adjustment` |

---

### M7 — SePay thiếu `gatewayTxnId` → mất lớp unique webhook event

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Medium |
| **Vị trí** | `webhookRoutes.js` ~176–205 |
| **Hậu quả** | Phụ thuộc claim student/session; edge replay |
| **Hướng sửa** | Bắt buộc txn id hoặc hash content+amount+time unique |

---

### M8 — `maHoaDon` / `maChungTu` bằng `countDocuments()` — race duplicate

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Medium |
| **Vị trí** | `invoiceRoutes.js` ~113–115; webhook; CreditNote pre-save |
| **Hậu quả** | 409 / CN null dưới concurrency |
| **Hướng sửa** | Counter atomic / sequence collection |

---

### M9 — BI cache 90s không invalidate khi `revenue:updated`

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Medium |
| **Vị trí** | `biService.js` cache wrap |
| **Hậu quả** | BI stale đến 90s |
| **Hướng sửa** | `delByPrefix('bi:overview')` trên write |

---

### M10 — AdminFinanceTab: strip Ledger + debt/listed enrollment (dual-read)

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Medium |
| **Vị trí** | `AdminFinanceTab.jsx` |
| **Hậu quả** | Net đúng Ledger; công nợ có thể lệch |
| **Hướng sửa** | Outstanding từ API finance |

---

### M11 — Frontend stale SWR key `admin_finance` vs `admin_finance_v2`

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Medium |
| **Vị trí** | `useAdminDashboardState.jsx` |
| **Hậu quả** | List HV finance không refresh đồng bộ sau socket |
| **Hướng sửa** | Một key / mutate prefix |

---

### M12 — voidLedgerEntry không atomic (void rồi mới reversal)

| Mục | Nội dung |
|-----|----------|
| **Mức độ** | Medium |
| **Vị trí** | `ledgerService.js` void path |
| **Hậu quả** | Crash giữa chừng: void thiếu dòng đảo (audit kém; net payment vẫn OK vì void loại khỏi sum) |

---

## LOW

### L1 — PaymentSession TTL 24h xóa session đã paid

| **Vị trí** | `models/PaymentSession.js` | **Hậu quả** | Mất audit session-only |

### L2 — `settlePayment` amount ≤ 0 silent no-op

| **Vị trí** | `ledgerService.js` | **Hậu quả** | Caller tưởng đã settle |

### L3 — Invoice stats cộng cả HĐ void

| **Vị trí** | `invoiceRoutes.js` `/stats` | **Hậu quả** | KPI invoice (không phải Ledger) lệch |

### L4 — BI `studentsUnpaid` alias = `refundCount`

| **Vị trí** | `biService.js` | **Hậu quả** | Nhãn KPI gây hiểu nhầm |

### L5 — BI ACL yếu hơn finance (`admin`/`staff` role vs permission)

| **Vị trí** | `biRoutes.js` | **Hậu quả** | Staff xem BI không cần `view_branch_revenue` |

### L6 — Notify dùng `student.price` không phải amount thực thu

| **Vị trí** | pay notify paths | **Hậu quả** | Thông báo sai số |

### L7 — Refund idempotency key gắn `oldPaidAmount`

| **Vị trí** | `PUT /:id/refund` key | **Hậu quả** | Re-pay rồi hoàn cùng số có thể no-op idempotent sai ngữ cảnh |

---

# PHẦN B — TÓM TẮT THEO YÊU CẦU

### 1. Bug Critical

1. **C1** Pay/create/enroll: cache+Invoice trước Ledger, nuốt lỗi  
2. **C2** Refund student: clear cache trước Ledger, nuốt lỗi  
3. **C3** SePay PaymentSession paid không Ledger  
4. **C4** POST Invoice thủ công set paid không Ledger  

### 2. Bug High

H1 Race admin pay · H2 Admin×SePay · H3 Cancel+refund ACL · H4 `/students/stats` enrollment · H5 BI chart enrollment · H6 Analytics enrollment “revenue” · H7 Salary Ledger nuốt lỗi · H8 Cancel tx không void salary · H9 Branch ACL enrollment pay/cancel · H10 CreditNote fail soft · H11 GET backfill Invoice · H12 PUT student set paid  

### 3. Logic đang đúng

- `LedgerEntry` unique `idempotencyKey`; append-only + soft `void`  
- `sumFinancialRevenue`: net = PAYMENT − REFUND; costs = salary+bonus+expense  
- BI overview / `/finance/summary` / analytics `/revenue` headline dùng Ledger  
- Refund **không xóa** Invoice  
- `postRefund` cố gắng tạo CreditNote khi REFUND created  
- Idempotency keys pay/refund/cancel/sepay **không** còn `Date.now()`  
- SePay student claim atomic `paid:false→true`  
- PaymentSession claim atomic pending→paid  
- Cancel: `enr.paid=false`; chặn hủy khóa active cuối  
- Invoice DELETE mặc định void; hard-delete gated flag  
- Teacher pay Super Admin; pay/refund routes (không qua cancel) cần `manage_finance`  
- Local E2E `scripts/_qa_local_finance_revenue_flow.cjs` đã PASS happy-path thu / hoàn / hủy 0  

### 4. Logic nên refactor

1. **Write path chuẩn:** claim → Ledger → Invoice/CN → sync cache (fail-closed)  
2. **Một SoT read path:** mọi dashboard/export chỉ `sumFinancialRevenue` / ledger lines  
3. **PaymentSession** gộp vào cùng pipeline settle  
4. **Salary:** Transaction chỉ là voucher UI; Ledger salary bắt buộc  
5. **Tách nhãn UI:** Cash-in Ledger vs “đã thu khóa đang dùng” vs Net  
6. **Outbox + reconcile job** thay try/catch nuốt lỗi  

### 5. Nguy cơ mất dữ liệu

- Hard wipe settings (`LedgerEntry.deleteMany`) khi `FINANCE_ALLOW_HARD_DELETE`  
- PaymentSession TTL xóa bằng chứng session  
- Hard-delete Invoice/Transaction nếu bật flag  
- Ledger fail sau khi đã clear refund cache → mất dấu hoàn trên sổ (tiền thực đã “đánh dấu hoàn” trên UI)  

### 6. Nguy cơ sai báo cáo tài chính

- `/students/stats`, BI byCourse/trend, analytics `/enrollment`  
- AdminFinanceTab debt/listed enrollment  
- Student card `paidCashIn` enrollment-based  
- Salary thiếu Ledger → Profit cao  
- PaymentSession cash invisible trên BI  
- Manual invoice paid không Ledger nhưng stats enrollment có thể đếm  

### 7. Nguy cơ race condition

- Double admin pay / enrollment pay  
- Admin pay × SePay  
- Double-click UI không disable  
- `countDocuments` sinh mã HĐ/CN  
- Concurrent void + reverse  

### 8. API chưa idempotent / idempotent yếu

| API | Vấn đề |
|-----|--------|
| `PUT /students/:id/pay` | Check-then-act; key theo `maHD` → 2 HĐ = 2 key |
| `PUT .../enrollments/:id/pay` | Tương tự non-atomic claim |
| `POST /invoices` | Không idempotent; set paid side-effect |
| `POST /webhooks/sepay` session | Claim session OK nhưng không ledger key |
| `PUT /students/:id/refund` | Key theo amount+oldPaid — yếu khi re-pay |
| `PUT teachers/.../pay-*` | Có key Transaction; Ledger salary fail vẫn 200 |
| Generic `PUT /students/:id` | Không idempotent finance |

### 9. Transaction còn thiếu

- **Toàn bộ** finance writers: không Mongo session  
- Cần txn (hoặc outbox tương đương) cho:  
  - Admin/enrollment pay  
  - Refund  
  - Cancel+refund  
  - SePay settle  
  - Salary confirm  
  - CreditNote + REFUND  

### 10. Test case bắt buộc bổ sung

| # | Case |
|---|------|
| 1 | Pay khi Ledger fail → phải 5xx, `paid` vẫn false |
| 2 | Refund khi Ledger fail → cache không clear |
| 3 | Concurrent double `PUT /pay` → đúng 1 PAYMENT |
| 4 | Admin pay ∥ SePay → đúng 1 PAYMENT |
| 5 | PaymentSession webhook → có Ledger PAYMENT |
| 6 | POST invoice không được set paid không Ledger |
| 7 | Staff `manage_students` only không refund qua cancel |
| 8 | `/students/stats` net == `/finance/summary` net |
| 9 | BI byCourse sum == Ledger payments (cùng kỳ) |
| 10 | pay-all khi `postSalary` fail → không confirmed orphan |
| 11 | Cancel confirmed Transaction → void SALARY |
| 12 | CreditNote luôn tồn tại khi REFUND created |
| 13 | Branch staff không pay HV chi nhánh khác |
| 14 | Partial refund: Ledger net đúng; UI enrollment không overstate SoT |
| 15 | Replay SePay cùng gatewayTxnId → 1 lần settle |
| 16 | GET full-detail không tạo Invoice |
| 17 | Discount/coupon (khi bật) vào net theo policy mới |
| 18 | Reconcile job: delta Ledger vs Invoice vs cache = 0 |

---

# PHẦN C — MA TRẬN LUỒNG vs SoT

| Luồng | Invoice | Ledger | Cache Student/Enr | Atomic? | SoT OK? |
|-------|---------|--------|-------------------|---------|---------|
| Admin pay | Có | Best-effort sau | Trước | Không | **Không** |
| Create HV paid | Có | Best-effort | Trước | Không | **Không** |
| Enrollment pay | Có | Best-effort | Trước | Không | **Không** |
| Student refund | Giữ | Best-effort sau | Trước | Không | **Không** |
| Cancel + refund>0 | Giữ | Best-effort | Cancel trước | Không | **Một phần** |
| Cancel + refund=0 | — | Không REFUND (đúng giữ tiền) | paid=false | Không | Cache `paidAmount` lệch |
| SePay student | Có | Best-effort | Atomic claim | Claim OK | Ledger fail → **Không** |
| SePay session | Không | **Không** | Session only | Claim OK | **Không** |
| Manual Invoice | Có | **Không** | paid=true | Không | **Không** |
| Teacher salary | — | Best-effort sau Tx | Tx confirmed | Không | **Không** nếu salary fail |
| BI headline | — | Có | — | — | **Có** |
| `/students/stats` | — | **Không** | Enrollment | — | **Không** |

---

# PHẦN D — ƯU TIÊN SỬA (khi được phép code)

1. **C1–C2–C3–C4** fail-closed + session settle  
2. **H4 + H5** thống nhất SoT read  
3. **H1–H2** atomic pay  
4. **H3 + H9** ACL  
5. **H7–H8** salary fail-closed + void  
6. Mongo txn / outbox (M1)  
7. Chart/debt/card nhãn (H5, M5, M10)  

---

**Cam kết audit:** Không sửa code trong phiên này. Báo cáo dựa trên đọc source hiện tại (post P0–P4) và đối chiếu line evidence trong repo local.
