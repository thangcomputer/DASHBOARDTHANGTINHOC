# ADR 0004 — Glossary & state machines

- **Status:** Accepted
- **Date:** 2026-07-29

## Glossary (thuật ngữ bắt buộc dùng thống nhất)

| Thuật ngữ | Nghĩa | Không nhầm với |
|-----------|-------|----------------|
| **User / Account** | Tài khoản đăng nhập | Student profile |
| **Student** | Hồ sơ học viên | Enrollment |
| **Enrollment** | Hợp đồng học 1 khóa trên 1 HV tại 1 branch | Course catalog |
| **Course** | Sản phẩm đào tạo (catalog) | Lớp / buổi học |
| **ScheduleSession** | Một buổi học cụ thể | Toàn khóa |
| **AccessGrant** | Quyền học/thi trên enrollment | Thanh toán |
| **Payment / Invoice** | Chứng từ tiền | KPI “doanh thu khóa đang bán” |
| **Display code** | Mã hiển thị | `_id` |
| **Branch** | Chi nhánh | Tenant |
| **Tenant** | Tổ chức bao branch (đã có model, dùng nhẹ) | Branch |
| **Soft delete** | Ẩn vận hành + giữ lịch sử | Hard delete / xóa tiền |

## State machines

### Course

```
draft → published → archived
                 ↘ soft_deleted (deletedAt set; có thể từ published/archived)
```

- `soft_deleted` không quay lại `published` trừ restore có audit (`deletedAt = null`).

### Enrollment

```
pending_payment → active → paused ⇄ active
                       → completed
                       → cancelled
                       → refunded
```

- Map tương thích hiện tại: `active | completed | paused` giữ nguyên; thêm `pending_payment | cancelled | refunded` khi đụng code (Phase Course/Enrollment), không breaking ngay Phase 1.

### ScheduleSession (logic)

```
scheduled → rescheduled → scheduled
         → cancelled
         → completed (đã dạy / điểm danh xong)
```

- Đổi GV: **không** xóa session đã `completed`; session tương lai đổi `teacherId` + ghi `TeacherAssignmentSegment`.

### Payment

```
pending → settled → (refunded partial/full via reversal)
       → failed / expired
```

### Exam attempt

```
locked → unlocked → in_progress → submitted → graded → pass | fail
                                              ↘ void | violation
```

### Rating

```
pending → approved | rejected
approved → hidden (optional)
```

### Teacher reassignment (payroll)

- Session `completed` giữ `teacherId` gốc (người đã dạy).
- Session chưa dạy: gán GV mới.
- Lương = Σ session completed theo `teacherId` sở hữu buổi.
- Progress HV (`completedSessions`) **không reset** khi đổi GV.

## Consequences

- Mọi PR nghiệp vụ phải reference state machine này; transition trái phép = bug.
- Audit log `action` namespaced theo entity: `course.soft_delete`, `enrollment.complete`, …
