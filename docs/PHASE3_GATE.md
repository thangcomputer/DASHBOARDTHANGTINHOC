# Phase 3 Gate — RBAC harden

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 2 PASS

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| Matrix | `constants/rbacMatrix.js` + ADR `docs/adr/0006-rbac-matrix.md` |
| Guards | `middleware/rbacGuards.js` (role + provision perm) |
| Branch IDOR | `middleware/targetBranchGuard.js` trên cấp MK / OTP |
| API | `POST /auth/admin/reset-password`, `POST /auth/admin/generate-otp` = auth → branchFilter → assertProvisionAccess → assertTargetUserBranchAccess |
| Tests | `tests/integration/rbacPhase3.test.js` |

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | Matrix Role × Permission × Scope documented | PASS |
| 2 | Teacher/Student bị chặn admin provision | PASS (test) |
| 3 | Staff thiếu perm → 403 PERMISSION_DENIED | PASS (test) |
| 4 | Staff đủ perm HV/GV đúng mapping | PASS (test) |
| 5 | Cross-branch evaluate = deny (helper) | PASS (test) |
| 5b | assertTargetUserBranchAccess IDOR | PASS (test deny/allow) |
| 6 | Không đổi key PERMISSIONS cũ | PASS |
| 7 | checkPermission regression vẫn đúng | PASS |

## Không làm (đúng scope Phase 3)

- Rewrite toàn bộ routes sang CASL/policy engine
- Phase 4 branch isolation sâu trên mọi CRUD (làm phase sau)
- UI ẩn nút theo matrix (đã có `hasPermission` FE; không đổi hàng loạt)

## Kết luận

**PASS** — Phase 3 tests: 12/12 xanh (`rbacPhase3.test.js`). Regression checkPermission + Phase 1–2 vẫn xanh trong batch 30 tests trước đó.

Phase tiếp theo theo roadmap: **Phase 4 — Branch isolation verify**.

