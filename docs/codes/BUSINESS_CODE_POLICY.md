# BUSINESS CODE POLICY

**Phase:** B — Design  
**Date:** 2026-08-11  
**Status:** DESIGN ONLY — chưa implement  
**Depends on:** [`CODE_STANDARDIZATION_PHASE_A_AUDIT_2026-08-11.md`](../CODE_STANDARDIZATION_PHASE_A_AUDIT_2026-08-11.md)

---

## 1. Mục tiêu

Chuẩn hóa mã nghiệp vụ (human / integration reference), **không** thay thế khóa quan hệ MongoDB.

| Entity | Field | Canonical format | Example |
|--------|-------|------------------|---------|
| Student | `studentCode` | `HV` + 6 digits | `HV000001` |
| Teacher | `teacherCode` | `GV` + 6 digits | `GV000001` |
| Employee | `employeeCode` | `NV` + 6 digits | `NV000001` |
| Course | `courseCode` | `KH` + 6 digits | `KH000001` |

Class / `LH…`: **không** tạo (PHASE A: không có entity Class).

---

## 2. Hard rules

1. Business code **không** phải FK. Quan hệ chỉ dùng `_id` / `studentId` / `teacherId` / `employeeId` / `courseId` / `enrollmentId`.
2. **Không** suy luận `HV000001 ↔ GV000001` hay map số thứ tự giữa namespace.
3. **Không** encode branch/tenant vào mã (`CS1-HV…` bị cấm trừ khi owner approve sau).
4. Sequence **global** per entity type (OPTION A — recommended).
5. Sinh mã **chỉ backend**; client không authoritative.
6. Không `Date.now()`, không `countDocuments()` để cấp số.
7. Unique per collection; không tái sử dụng mã đã cấp.
8. Immutable sau khi gán (không đổi mã khi rename / đổi branch).
9. Một Student = **một** `studentCode` dù N enrollment / N teacher / N course.
10. **Messaging / Socket / JWT / RBAC / Auth:** zero touch — code không vào conversationId, pairing, policy.

---

## 3. Identity layers (Course example)

| Layer | Field | Role |
|-------|-------|------|
| DB | `_id` | Primary identity / FK |
| Business | `courseCode` | Human / ops reference |
| URL | `slug` | Routing — **giữ nguyên**, không thay bằng courseCode |

Tương tự: Student/Teacher/Employee chỉ thêm business field; `_id` không đổi.

---

## 4. Counter design

Collection: `counters`

```text
{ _id: "student",  seq: <number> }
{ _id: "teacher",  seq: <number> }
{ _id: "employee", seq: <number> }
{ _id: "course",   seq: <number> }
```

API nội bộ (conceptual):

```text
CodeGeneratorService.generateStudentCode()
CodeGeneratorService.generateTeacherCode()
CodeGeneratorService.generateEmployeeCode()
CodeGeneratorService.generateCourseCode()
```

Atomic:

```text
findOneAndUpdate(
  { _id: namespaceKey },
  { $inc: { seq: 1 } },
  { upsert: true, returnDocument: "after" }
)
→ PREFIX + String(seq).padStart(6, "0")
```

Mỗi entity một counter độc lập. Seed `seq` sau migration backfill = max(canonical seq, backfill max).

---

## 5. Create flows (target)

```text
Client POST create (không gửi code)
  → Server ignore client studentCode/teacherCode/…
  → Generator atomic
  → Persist
  → Response includes generated code
  → UI / QR chỉ hiển thị code từ response
```

Ignore / strip client-supplied business codes trên create (fail-closed hoặc silent ignore — recommend **ignore + log**).

---

## 6. Multi-course / multi-teacher

```text
Student HV000001
  enrollments[]:
    { courseId → KH…, teacherId → GV… }
    { courseId → KH…, teacherId → GV… }
```

- Không tạo `HV000001-01`.
- Không tạo Student mới mỗi khóa.
- Assignment tiếp tục `PUT …/assign-teacher` với ObjectIds.

---

## 7. Tenant / branch

- Business code: **global unique**.
- Scope vận hành: `branchId` / `tenantId` / `branchCode` như hiện tại.
- Authorization không đọc business code.

---

## 8. Messaging isolation proof (design)

| Concern | Policy |
|---------|--------|
| `messagingPolicy` / pairing / DM | Không đọc/ghi business codes |
| `conversationId` | Không đổi |
| `studentMatchesTeacher` | ObjectId only |
| Badge UI `HV`/`GV` | Role label — không phải `studentCode` |

PHASE C: **không** mở các file Messaging listed trong master prompt.

---

## 9. Search / display

```text
Nguyễn Văn A
Mã HV: HV000125
```

Search: exact code + name + phone (+ email nếu có). Code không thay display name.

---

## 10. Out of scope

- Class / `LH…`
- Branch-scoped sequences
- Messaging / Socket / RBAC / JWT
- Rewriting Invoice `maHoaDon`, Ledger, Payroll history
- CQRS redesign
