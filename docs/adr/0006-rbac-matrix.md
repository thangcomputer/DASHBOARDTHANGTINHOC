# ADR 0006 — RBAC matrix (Phase 3)

- **Status:** Accepted
- **Date:** 2026-07-29

## Decision

Giữ model hiện có: `Teacher.adminRole` (`SUPER_ADMIN` | `STAFF`) + `permissions[]` + `branchFilter`.

| Role | Scope | Quyền |
|------|-------|--------|
| Super Admin (`adminRole=SUPER_ADMIN` hoặc id=`admin`) | global | Tất cả permission |
| Staff / Branch admin | branch | Chỉ perm được cấp; deny-by-default |
| Teacher | own (+ HV assigned) | Không admin API |
| Student | own | Không admin API |

### Cấp mật khẩu / OTP (siết Phase 3)

| Đối tượng | Permission bắt buộc | Branch |
|-----------|---------------------|--------|
| Học viên | `manage_students` | Staff chỉ cùng `branchId` |
| Giảng viên | `view_teachers` | Staff chỉ cùng `branchId` |

Nguồn: `constants/rbacMatrix.js`, middleware `rbacGuards.js` + `targetBranchGuard.js`.

## Non-goals Phase 3

- Không đổi giá trị key `PERMISSIONS` đã lưu DB.
- Không rewrite toàn bộ route sang policy engine mới.
- Multi-tenant sâu = Phase sau (đã có Tenant wrapper).
