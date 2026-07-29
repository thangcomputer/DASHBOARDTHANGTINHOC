# Báo cáo Rà soát Module Tài chính (Finance Audit)

**Ngày:** 2026-07-29  
**Phạm vi:** Finance · Revenue · Payment · Refund · Teacher Salary · Student Payment · Dashboard · Statistics · Report · Audit Log · Transaction · Invoice  
**Phương pháp:** Đọc mã nguồn (read-only), đối chiếu luồng ghi sổ / aggregate / UI — **không sửa code trong lần audit này**.  
**Kết luận tổng:** **Module Tài chính CHƯA đạt yêu cầu Production.** Có lệch có hệ thống giữa Ledger (sổ đúng hướng) và Dashboard/BI/Analytics (cộng theo `enrollment.paid` + `price`, không trừ hoàn / không loại cancelled).

---

## 0. Kiến trúc sổ sách hiện tại (tóm tắt)

Hệ thống đang vận hành **nhiều sổ song song**, không có một Source of Truth duy nhất cho KPI:

| Sổ | Model / API | Dùng cho |
|----|-------------|----------|
| A. Student flags | `Student.paid`, `paidAmount`, `enrollments[].paid/price/status` | Dashboard, BI, Analytics (`revenueAggregate`) |
| B. Ledger | `LedgerEntry` (payment / refund / adjustment) | Một phần refund UI, reconciliation helper |
| C. Invoice | `Invoice.hocPhi` | Hóa đơn, tab Tài chính chi tiết HV (ưu tiên) |
| D. Teacher Transaction | `Transaction` (lương GV) | Chi lương — **không** nằm trong Ledger học phí |

Policy trong `services/ledgerService.js` tuyên bố SoT = Ledger, nhưng KPI thực tế dùng `services/revenueAggregate.js` (Student).

```
Money IN:  Admin / Enrollment pay / SePay(HV) → Student + Invoice + Ledger(payment)
           SePay(PaymentSession)             → Session only (thiếu Ledger/Invoice)
Money OUT: Refund / Cancel enrollment        → Student flags + Ledger(refund)
           Teacher pay                       → Transaction + Schedule flags
KPI:       sumPaidRevenue(Student)  ≠  sumFinancialRevenue(Ledger).net
Profit:    chưa có công thức trong code
```

---

## 1. Toàn bộ luồng tiền vào

| Trường hợp | Hành vi hiện tại | Đánh giá |
|------------|------------------|----------|
| HV thanh toán khóa (admin pay) | Set `paid`/`paidAmount`, tạo Invoice, `settlePayment` | OK nếu ledger thành công |
| Nhiều khóa | `+= price` theo enrollment + ledger từng lần | OK về ý tưởng |
| Thanh toán thành công nhiều lần | SePay có claim atomic `paid:false→true`; admin pay **không** atomic | Rủi ro race (High) |
| Thất bại / chờ / hủy | Session pending không cộng Ledger | OK cho session |
| Chuyển khoản / QR SePay → HV đã có | Cộng Student + Invoice + Ledger | OK |
| QR → PaymentSession | Chỉ `session.status=paid` — **không** Student/Invoice/Ledger | **Critical gap** |
| Manual `POST /invoices` | Có thể set `paid=true` **không** `paidAmount`/Ledger | **High** |

---

## 2. Toàn bộ luồng tiền ra

| Trường hợp | Hành vi | Đánh giá |
|------------|---------|----------|
| Hoàn 100% / 50% (`PUT /students/:id/refund`) | Giảm `paidAmount`; `postRefund`; giữ Invoice | Ledger OK; **KPI enrollment vẫn full price** nếu `paid` còn true |
| Hủy khóa + hoàn | Soft-cancel + `postRefund`; **không clear `enr.paid`** | Ledger OK; **BI vẫn cộng** |
| Hoàn nhiều lần | Idempotency key có `Date.now()` | **Critical** — retry có thể cộng refund trùng |
| Trả lương / thưởng GV | `Transaction` riêng | Chi phí tách đúng hướng, nhưng **hard-delete được**, không vào Ledger học phí |
| Chi phí vận hành | Không thấy module OPEX chung trong Ledger | Chưa có |

---

## 3. Công thức doanh thu gộp (Gross)

**Theo kế toán mong muốn:**

```
Doanh thu gộp = Σ Payment thành công (posted)
```

**Theo code KPI (`revenueAggregate.expandPaidItemsStages`):**

```
Gross_KPI = Σ enrollments[i].price  WHERE enrollments[i].paid === true
            (không lọc status cancelled; không trừ refund)
```

**Theo Ledger (`sumFinancialRevenue`):**

```
Gross_Ledger = Σ LedgerEntry.amount WHERE type='payment' AND status='posted'
```

→ Hai công thức **không tương đương**.

---

## 4. Công thức doanh thu thuần (Net)

**Mong muốn:**

```
Doanh thu thuần = Doanh thu gộp − Σ Refund
Lợi nhuận (nếu có) = Doanh thu thuần − Chi phí (lương GV + OPEX)
```

**Ledger:**

```
net = payments − refunds   // adjustments bị bỏ qua trong net
```

**Dashboard / BI / Analytics:**

```
Không trừ refund. Không trừ lương GV. Không có profit API.
```

**StudentDetailModal (sau chỉnh UI gần đây):** ưu tiên cộng Invoice thu; hiện “Đã hoàn” riêng — gần đúng hướng hiển thị HV, **không** đồng bộ với BI.

---

## 5. Các trường hợp cộng sai

1. Hủy khóa đã thanh toán nhưng `enr.paid` vẫn `true` → BI/Analytics vẫn cộng đủ học phí.  
2. Hoàn một phần: `paidAmount` giảm, `enr.price`/`paid` giữ nguyên → KPI không giảm.  
3. PaymentSession SePay paid nhưng sau đó admin tạo HV + thu lại → rủi ro double-book.  
4. Manual invoice + pay sau → Invoice stats phình, ledger có thể chỉ 1 lần.  
5. AdminFinance (active only) vs BI (mọi `paid=true`) sau cancel → **một bên giảm, một bên không**.

---

## 6. Các trường hợp trừ sai

1. AdminFinance **ẩn** enrollment cancelled → “thu” giảm full `price` dù hoàn 0đ (trừ ảo so với cash).  
2. Full `/refund` set `paid=false` + `status:refunded` nhưng AdminFinance vẫn có thể hiện nợ giả nếu enrollment còn active-like.  
3. Ledger fail sau khi đã save Student refund → sổ cờ đã trừ, Ledger thiếu dòng hoàn.

---

## 7. Giao dịch bị cộng trùng (rủi ro)

| Điểm | Nguyên nhân |
|------|-------------|
| Refund idempotency | Key chứa `Date.now()` (`studentRoutes` refund & cancel) |
| Enrollment add paid | Key có timestamp |
| SePay không có `gatewayTxnId` | Fallback key timestamp |
| Concurrent admin pay | Không claim atomic như SePay |

---

## 8. Giao dịch bị trừ trùng (rủi ro)

- Retry hoàn với key mới → nhiều `LedgerEntry` type=refund cùng một lần hủy.  
- Cancel refund + manual `/refund` trên cùng HV nếu không khóa nguồn → có thể trừ `paidAmount` quá mức (cần đối soát runtime).

---

## 9. Giao dịch thiếu

- SePay PaymentSession → thiếu Ledger/Invoice.  
- Manual invoice → thiếu Ledger/`paidAmount`.  
- Pay thành công nhưng `postRefund`/`settlePayment` catch warn → thiếu sổ Ledger.  
- Teacher pay không vào Ledger học phí (cố ý tách) nhưng Dashboard “lợi nhuận” không tồn tại → thiếu chi phí trong P&amp;L.

---

## 10. Transaction / Ledger bất thường

- `LedgerEntry` có status `void` nhưng **không có API void/reversal**.  
- `reversesEntryId` ít khi gắn khi hoàn.  
- Teacher `Transaction` **DELETE** được → phá nguyên tắc bất biến.  
- Invoice **hard delete**.  
- GET full-detail **backfill tạo Invoice** (side-effect khi đọc).

---

## 11. Lỗi Database / mô hình dữ liệu

| Vấn đề | Chi tiết |
|--------|----------|
| Ba sổ lệch | Student / Ledger / Invoice |
| Invoice không có `branchId` | Filter chi nhánh trên Invoice stats dễ về 0 |
| Refund không bắt buộc link Payment gốc | Có thể hoàn “mồ côi” về mặt quan hệ |
| Orphan risk | Invoice/Payment gắn `hocVien`; khi soft-cancel enrollment vẫn giữ — tốt; hard delete Invoice — xấu |
| `paidAmount` mutate trực tiếp | Vi phạm nguyên tắc “không sửa số dư — chỉ sinh bút toán” |

---

## 12. Lỗi API

| API | Vấn đề |
|-----|--------|
| `/api/students/stats`, analytics, BI overview | Dùng `sumPaidRevenue` — lệch sau refund/cancel |
| `PUT /refund`, cancel enrollment | Idempotency yếu; ledger lỗi bị nuốt |
| `DELETE .../enrollments/:id` | Thiếu branch guard |
| Invoice list/stats + branchFilter | Schema thiếu branch |
| Transactions Super Admin | Client gửi `branch_id`, server đọc `branchId` |
| Reconciliation report | Có trong ledgerService nhưng **không gắn Dashboard** |

---

## 13. Lỗi Dashboard

| Màn hình | Lệch |
|----------|------|
| BI “Doanh thu kỳ” | Gross enrollment, không net refund |
| BI “Hoàn học phí” | **Đếm số lần** refund, không phải VND |
| AdminFinanceTab | Active enrollments only; % tăng trưởng **hardcode** |
| RevenueAnalytics | Cùng aggregate; một phần series theo `createdAt` không phải `paidAt` |
| StudentDetail finance | Invoice-based (đã cải thiện UI) ≠ BI |
| Cache | SWR key `admin_finance` vs `admin_finance_v2` lệch → stale |

---

## 14. Lỗi Report / Export

- Export AdminFinance/BI chủ yếu CSV; không chứng minh = Ledger net.  
- Invoice PDF giữ hóa đơn gốc khi hoàn (đúng kế toán chứng từ) nhưng **không có credit note / hóa đơn điều chỉnh** chuẩn.  
- `tests/integration/revenueAggregate.test.js` **không** cover cancel/refund/net.  
- `docs/QA_REFUND_E2E_REPORT.md`: API refund PASS nhưng **không** assert KPI Dashboard.

---

## 15. Danh sách Bug theo mức độ

### Critical

| ID | Bug | File (tham chiếu) |
|----|-----|-------------------|
| C1 | Dashboard/BI/Analytics bỏ qua Ledger & refund — vẫn cộng `enrollment.price` khi `paid=true` | `services/revenueAggregate.js` ~44–49 |
| C2 | Cancel enrollment giữ `paid=true` → KPI không giảm dù đã hoàn | `routes/studentRoutes.js` ~1776–1816 |
| C3 | Partial refund không chỉnh `enr.price`/`paid` → KPI full tuition | `routes/studentRoutes.js` ~1114–1118 |
| C4 | Student save trước, Ledger sau; lỗi Ledger chỉ `warn` → lệch sổ | `studentRoutes` pay/refund/cancel; webhooks |
| C5 | Idempotency refund/cancel dùng `Date.now()` → hoàn trùng khi retry | `studentRoutes.js` ~1147, ~1813 |

### High

| ID | Bug |
|----|-----|
| H1 | SePay PaymentSession paid không ghi Ledger/Invoice |
| H2 | Manual Invoice có thể set paid không qua Ledger |
| H3 | Hard delete Invoice / Teacher Transaction |
| H4 | Invoice branch filter không khớp schema |
| H5 | Admin pay không atomic claim |
| H6 | SWR `admin_finance` ≠ `admin_finance_v2` |
| H7 | Transactions branch param `branch_id` vs `branchId` |

### Medium

| ID | Bug |
|----|-----|
| M1 | `sumFinancialRevenue` bỏ `adjustment` trong net |
| M2 | GET full-detail backfill Invoice (side effect) |
| M3 | BI cache / fake % growth |
| M4 | Cancel enrollment thiếu branch ACL |
| M5 | Teacher payout không vào P&amp;L thống nhất |
| M6 | Analytics enrollment fee theo ngày đăng ký |

### Low

| ID | Bug |
|----|-----|
| L1 | `void` ledger không dùng |
| L2 | Notify dùng `student.price` thay vì số thực thu |
| L3 | Client helper có thể cộng tuition cả canceled tùy chỗ |
| L4 | Settings có thể `Transaction.deleteMany` |

---

## 16. Đề xuất chỉnh sửa trước Production

### Nguyên tắc bắt buộc

1. **Một Source of Truth:** mọi KPI doanh thu = `LedgerEntry` posted (`payments − refunds`), có filter `branchId` + khoảng thời gian.  
2. **Append-only:** cấm hard-delete Invoice/Payment/Ledger; chỉ void bằng bút toán đảo.  
3. **Không sửa số dư trực tiếp làm SoT:** `paidAmount` chỉ là cache derived từ Ledger (hoặc bỏ dần).  
4. **Mọi thay đổi tiền = Transaction/Ledger mới** + Audit Log (actor, IP, UA, old/new, branch).

### Việc cần làm (ưu tiên)

1. **Sửa `revenueAggregate`:** loại `status==='cancelled'`; net theo Ledger hoặc trừ `refundedAmount`; partial refund giảm amount ghi nhận.  
2. **Cancel paid enrollment:** set `paid=false` **hoặc** luôn exclude cancelled khỏi aggregate; gắn `reversesEntryId`.  
3. **Idempotency ổn định:** bỏ `Date.now()` — dùng `refund:{studentId}:{enrollmentId}` / `refund:{studentId}:{amount}:{sourceRef}`.  
4. **Mongo transaction / outbox:** Student + Ledger cùng atomic; thất bại thì rollback hoặc retry queue.  
5. **PaymentSession SePay:** bắt buộc settle Student + Invoice + Ledger khi convert / khi paid.  
6. **Credit note:** khi hoàn, sinh chứng từ điều chỉnh (không xóa HĐ gốc).  
7. **Dashboard/Report/Export:** cùng một service `getRevenueSnapshot({from,to,branchId})`.  
8. **Teacher cost:** đưa payout vào báo cáo chi phí (Ledger type `expense` hoặc join Transaction confirmed).  
9. **Reconciliation job hàng ngày:** Ledger net vs Invoice vs Student cache; alert lệch ≥ 1đ.  
10. **Test bắt buộc:** hoàn 0/50/100%, cancel+re-enroll, multi-branch, double webhook, retry refund.

### Definition of Done (đạt yêu cầu)

Chỉ kết luận **“Module Tài chính đạt yêu cầu”** khi:

```
Dashboard Revenue
  = SUM(Ledger payment posted) − SUM(Ledger refund posted)
  = Report Revenue
  = API Revenue
  = đối soát DB (aggregate)
```

và không còn đường pay/refund nào mutate tiền mà thiếu Ledger + Audit.

---

## Kết luận

**Module Tài chính hiện tại KHÔNG đạt yêu cầu Production.**

Điểm mạnh: có Ledger append-oriented, Invoice được giữ khi hoàn, soft-cancel enrollment, SePay có idempotency gateway tương đối tốt.  

Điểm gãy chết: **KPI doanh thu không đọc Ledger và không net refund**; hủy khóa vẫn có thể nằm trong doanh thu; idempotency hoàn yếu; nhiều sổ lệch nhau.

---

*Báo cáo này chỉ audit — không chứa thay đổi code sửa sổ. Các commit kèm theo cùng ngày là UI/finance hiển thị HV + cho phép đăng ký lại khóa cancelled + invoice preview — chưa đóng các Critical C1–C5 ở tầng aggregate.*
