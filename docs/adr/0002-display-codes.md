# ADR 0002 — Display codes (mã định danh hiển thị)

- **Status:** Accepted
- **Date:** 2026-07-29

## Context

Cần mã dễ đọc cho HV / GV / Admin / Staff theo chi nhánh và mã enrollment theo khóa. Hiện có `Student.studentCode` (QR/CK) nhưng chưa chuẩn hóa prefix/role/branch.

## Decision

### 1. Primary key ≠ display code

| Khái niệm | Lưu trữ | Dùng để |
|-----------|---------|---------|
| Primary key | Mongo `ObjectId` | Quan hệ DB, API internal |
| Display code | String unique theo scope | UI, Zalo, Excel, hỗ trợ |
| Enrollment code | String trên enrollment | Phân biệt khóa trên cùng HV |

**Cấm** dùng `HV001-CN1` làm FK trong schema.

### 2. Cấu trúc chuẩn

```
{ROLE}{SEQ}-{BRANCH}[ -{COURSE_SLUG} ]
```

| Role prefix | Đối tượng | Ví dụ |
|-------------|-----------|--------|
| `HV` | Học viên (identity) | `HV001-CN1` |
| `GV` | Giảng viên | `GV001-CN1` |
| `AD` | Branch Admin / account admin CN | `AD001-CN1` |
| `ST` | Staff | `ST001-CN1` |

- `SEQ`: số tăng dần **theo (role, branch)**, zero-pad 3+ chữ số.
- `BRANCH`: `Branch.code` đã có (vd. `CN1`, `CS1`) — dùng đúng code đang lưu trong DB, không invent song song.
- Giảng viên dạy nhiều CN: **một Teacher profile có thể có nhiều display code** (mỗi membership/branch một mã) **hoặc** một mã primary + membership; Phase DB chốt: **một `displayCode` per (personType, branchId)**.

### 3. Enrollment suffix (không đổi identity)

Học viên gốc: `HV001-CN1`

Mỗi enrollment:

```
HV001-CN1-{COURSE_TOKEN}
```

Ví dụ: `HV001-CN1-EXCELMOS`, `HV001-CN1-THVPCB`

- `COURSE_TOKEN`: từ slug/name course, uppercase, chỉ `[A-Z0-9]`, max 16, unique trong student.
- Lưu tại `enrollments[].enrollmentCode`.
- Identity `displayCode` / `studentCode` **không** bị thay khi thêm khóa.

### 4. Tương thích ngược

- `Student.studentCode` hiện tại: nếu đúng pattern thì map = `displayCode`; nếu trống/lệch → backfill Phase 1.
- Payment QR tiếp tục dùng `studentCode` / display code identity (không bắt buộc suffix course trên nội dung CK trừ khi product yêu cầu sau).

## Consequences

- Cần counter collection hoặc atomic `findOneAndUpdate` trên `BranchCodeCounter`.
- Unique index: `(branchId, displayCode)` cho Student/Teacher/Staff profiles.
- Unique sparse: `enrollments.enrollmentCode` per student document.

## Non-goals

- Không đổi `_id` Mongo hiện có.
- Không yêu cầu human-readable ID trên mọi bảng phụ (Schedule vẫn ObjectId).
