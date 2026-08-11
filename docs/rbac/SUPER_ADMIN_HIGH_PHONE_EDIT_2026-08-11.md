# SUPER_ADMIN — sửa SĐT mọi tài khoản nội bộ

Date: 2026-08-11

## Root cause

Super Admin không sửa được SĐT (kể cả Admin cấp cao) do:

1. **Frontend** — `StaffManagementTab.jsx`: `readOnly={isEdit}` khóa SĐT khi edit **mọi** tài khoản staff.
2. **Backend** — `PUT /api/staff/:id` không ghi `phone` vào `updates`.

Không phải RBAC chặn riêng HIGH_ADMIN; SUPER đã được sửa name/permissions/status.

## Phạm vi

**SUPER_ADMIN / root (`id=admin`)** có thể đổi SĐT khi edit **mọi tài khoản nội bộ** trong modal HR:

| Loại tài khoản | SUPER sửa SĐT |
| --- | --- |
| HIGH_ADMIN | Có |
| SUPPORT | Có |
| STAFF | Có |
| SUPER_ADMIN (root) | Có (chỉ root) |
| Non-SUPER actor | Không (SĐT vẫn read-only khi edit) |

Không mở bypass finance/ledger/messaging/student gate.

## Backend

`routes/staffRoutes.js` — PUT `/:id`:

- `phone` từ body, chỉ khi `actorIsSuperAdmin(req)`
- Unique: `Teacher.findOne({ phone, _id: { $ne: id } })` → 409

## Frontend

`StaffManagementTab.jsx`:

- `readOnly={isEdit && !(isSuperAdmin || isRootSuperAdmin)}`
- Hint: Super Admin có thể đổi SĐT đăng nhập cho mọi tài khoản nội bộ

## Tests

`tests/unit/super_admin_high_phone_edit.test.js`

## Files changed

- `client/src/components/StaffManagementTab.jsx`
- `routes/staffRoutes.js`
- `docs/rbac/SUPER_ADMIN_HIGH_PHONE_EDIT_2026-08-11.md`
- `tests/unit/super_admin_high_phone_edit.test.js`

## Database writes

0 trong tests; production chỉ khi Super lưu PUT staff.
