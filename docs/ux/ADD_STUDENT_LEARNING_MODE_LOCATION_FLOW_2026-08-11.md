# ADD STUDENT — Hình thức học trước, địa điểm sau

**Date:** 2026-08-11  
**Component:** [`client/src/components/admin/shared/AddStudentModal.jsx`](../../client/src/components/admin/shared/AddStudentModal.jsx)  
**Scope:** UI-only — không đổi Branch schema, payment/QR, Messaging

---

## Flow cũ (sai thứ tự)

Super Admin, bước **2. Đăng ký khóa học**:

1. Cơ sở (chi nhánh) — mọi branch trong list  
2. Hình thức học — Tại cơ sở / Online  
3. Khóa học & học phí  

Vấn đề: chọn chi nhánh tên chứa `online` mới ép `learningMode = ONLINE`; đổi hình thức **không** lọc địa điểm → dễ chọn nhầm địa điểm online khi đang «Tại cơ sở».

## Flow mới

1. **Hình thức học** — Tại cơ sở (`OFFLINE`) / Online (`ONLINE`)  
2. **Địa điểm (chi nhánh)** — list đã lọc theo hình thức  
3. Khóa học & học phí  

### Lọc địa điểm (heuristic, không schema)

| Hình thức | Địa điểm hiển thị |
|-----------|-------------------|
| Online | Branch có tên chứa `online` (case-insensitive) |
| Tại cơ sở | Branch **không** chứa `online` |

Khi đổi hình thức: nếu `branchId` hiện tại không còn trong list lọc → chọn phần tử đầu (hoặc để trống nếu không có).

Caption dưới label địa điểm:

- Online → «Cơ sở / khu online»  
- Tại cơ sở → «Cơ sở đào tạo trực tiếp»

Staff không Super Admin: không hiện dropdown địa điểm (giữ behavior cũ — branch theo context).

---

## Non-actions

```text
Branch model / isOnline field: NO
Payment / QR / PaymentSession: NO
Messaging: NO
Student Detail finance display: NO (phase riêng)
```

## Verdict

```text
UI reorder: DONE
Branch filter by learningMode: DONE
Schema change: NO
```
