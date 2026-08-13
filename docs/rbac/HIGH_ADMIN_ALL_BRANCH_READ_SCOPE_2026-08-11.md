# HIGH_ADMIN — cho phép `?branch_id=all` chỉ trong read của 5 module

Date: 2026-08-11

## Root cause

1. **Frontend** — `HIGH_ADMIN` bị chặn không cho chọn “Tất cả chi nhánh”, đồng thời một số request GET/read trong 5 module lại **omit** `branch_id` khi `selectedBranchId === 'all'`.
2. **Backend** — `middleware/auth.js:branchFilter` với `HIGH_ADMIN` không xử lý đúng trường hợp `branch_id=all` cho scope read; thay vào đó nó fallback về branch của tài khoản (`user.branchId`) → dẫn tới không “all-branch” trong tenant.

## Phạm vi (bắt buộc)

Chỉ mở rộng khi đồng thời thỏa:

1. **Role**: `HIGH_ADMIN`
2. **Request**: `GET` (read)
3. **Query**: `?branch_id=all`
4. **Module (allowlist READ)**:
   - Tổng quan (Overview)
   - Nhân sự & Lương (HR & Payroll)
   - Giảng viên (Teachers)
   - Học viên (Students)
   - Tài chính (Finance)
   - **Báo cáo doanh thu (Analytics)** — `/api/analytics/*` (HIGH xem ops/Ledger giống Super khi `branch_id=all`)

Ngoài điều kiện trên: **fail-closed** (không bypass `branchFilter`).

## Backend

`middleware/auth.js`:

- Khi `HIGH_ADMIN` và `req.method === 'GET'` và `req.query.branch_id === 'all'`:
  - Nếu request thuộc allowlist URL cho 5 module thì set:
    - `req.branchFilter = {}`
  - Sau đó vẫn áp dụng `tenant scope` qua `applyTenantScopeIfAny(req)` (tenant isolation preserved).
- Endpoint ngoài allowlist:
  - Không set `{}` → vẫn dùng fallback fail-closed như trước.

## Frontend

1. Cho phép `HIGH_ADMIN` chọn “Tất cả chi nhánh”:
   - `client/src/context/BranchContext.jsx`
   - `client/src/components/BranchFilterDropdown.jsx`
2. Với 5 module được phê duyệt, khi `selectedBranchId === 'all'`:
   - Các request GET/read gửi **rõ** `branch_id=all` (không omit).
   - Các request trong Finance gửi thêm `branch_id` song song `branchId` để backend `branchFilter` phân biệt `all` vs “không truyền”.

## Tests

- Mở rộng test cho `middleware/auth.js:branchFilter`:
  - `HIGH_ADMIN + GET + branch_id=all` → `req.branchFilter={}` trên allowlisted read path
  - `HIGH_ADMIN + GET + branch_id=all` trên path ngoài allowlist → fail-closed
  - `HIGH_ADMIN + POST + branch_id=all` → không áp dụng all-branch read

## Files changed

- `client/src/context/BranchContext.jsx`
- `client/src/components/BranchFilterDropdown.jsx`
- `client/src/components/EmployeeManagementTab.jsx`
- `client/src/components/admin/hooks/useAdminDashboardState.jsx`
- `client/src/components/admin/hooks/useAdminTeachers.jsx`
- `client/src/services/api.js`
- `middleware/auth.js` — allowlist gồm `analytics` (HIGH báo cáo doanh thu = Super khi `branch_id=all`)
- `client/src/components/RevenueAnalyticsTab.jsx` — HIGH dùng UI đa chi nhánh như Super
- `tests/integration/wave_repair_authz.test.js`
- `docs/rbac/HIGH_ADMIN_ALL_BRANCH_READ_SCOPE_2026-08-11.md`

## Database writes

0 (chỉ thay đổi scope READ/GET của branchFilter; không động chạm POST/PUT/PATCH/DELETE).

