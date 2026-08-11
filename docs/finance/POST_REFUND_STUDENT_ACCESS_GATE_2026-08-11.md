# POST-REFUND STUDENT ACCESS GATE

**Date:** 2026-08-11  
**Mode:** FE implementation + backend **audit-report only**  
**SoT:** `enrollment.status === 'active'` via `hasLearningAccessEnrollment`  
**Out of scope:** Messaging rewrite, Auth/RBAC redesign, C4, migration, `postRefund` / Ledger / `sourceRef` DB writes, xóa student/enrollment

---

## 1. Summary

Sau khi học viên **không còn enrollment `active`** (ví dụ hoàn khóa cuối):

| Bề mặt | Hành vi |
|--------|---------|
| Login / account | **Vẫn mở** — không khóa tài khoản |
| Inbox / feed / news / notifications / hồ sơ | **Vẫn mở** |
| Learning dashboard (`/student` trừ `#profile`) | **BLOCK** → `StudentNoActiveCoursePage` |
| Phòng thi (`/student/exam*`) | **BLOCK** |
| Đăng ký khóa mới | CTA trên NoActiveCourse → `/dangkykhoahoc` |
| Reactivation | Có ≥1 enrollment `active` mới → **ALLOW** lại toàn learning shell |
| Admin Student Detail | Badge / status / Mã HĐ display + lock tab Bài tập & Sửa |

---

## 2. Source of truth

File: [`client/src/utils/enrollments.js`](../../client/src/utils/enrollments.js)

```js
getLearningAccessEnrollments(student) =
  getClientEnrollments(student).filter(e => status === 'active')

hasLearningAccessEnrollment(student) =
  getLearningAccessEnrollments(student).length > 0
```

| Status | Learning access |
|--------|-----------------|
| `active` (≥1) | ALLOW |
| `completed` only | BLOCK |
| `cancelled` / `refunded` only | BLOCK |
| mix: 1 `active` + N cancelled | ALLOW |
| empty | BLOCK |

**Không** dùng `student.course` / `student.paid` / `student.status` làm SoT.  
**Khác** `getActiveClientEnrollments` (vẫn gồm `completed`).

---

## 3. Files changed

| File | Change |
|------|--------|
| `client/src/utils/enrollments.js` | `getLearningAccessEnrollments` + `hasLearningAccessEnrollment` |
| `client/src/components/student/StudentNoActiveCoursePage.jsx` | Copy «không có khóa đang học» + CTA đăng ký / hồ sơ |
| `client/src/components/student/StudentLearningAccessGate.jsx` | Gate; `#profile` bypass |
| `client/src/App.jsx` | Wrap `/student`, `/student/exam`, `/student/exam/:subjectId` |
| `client/src/components/AppSidebar.jsx` | Ẩn mục learning khi 0 active; giữ feed/news/inbox/profile |
| `client/src/components/StudentDetailModal.jsx` | Badge Đã hoàn/Đã hủy; status «Không còn học»; reject `cancel:` Mã HĐ → `HOÀN-####`; lock assignments/edit |
| `tests/unit/learning_access_enrollment.test.js` | Helper matrix + static route/sidebar checks |

---

## 4. Routes matrix

| Route | Gate learning? |
|-------|----------------|
| `/student` (overview / schedule / materials / evaluation) | **YES** |
| `/student#profile` | **NO** (hash allowlist) |
| `/student/exam`, `/student/exam/:subjectId` | **YES** |
| `/student/inbox` | **NO** |
| `/student/feed`, `/student/news` | **NO** |
| `/student/notifications` | **NO** |
| `/dangkykhoahoc` | **NO** (re-enroll) |

---

## 5. Admin Detail sync (post-refund UX)

Khi `hasLearningAccessEnrollment === false`:

- Badge: «Đã hoàn» (có tín hiệu hoàn) / «Đã hủy khóa» — **không** «Chưa đóng phí» từ `student.paid`
- `statusLabel`: «Không còn học»
- `sourceRef` bắt đầu `cancel:` → **invalid** display → fallback `HOÀN-####`
- Tabs **Bài tập** / **Sửa thông tin** disabled; Tổng quan + Tài chính vẫn xem

Không đổi Ledger / Invoice DB / `postRefund`.

---

## 6. Backend learning APIs — AUDIT ONLY (phase này không RBAC)

| API area | Enrollment `active` check? | Status |
|----------|----------------------------|--------|
| `routes/quizRoutes.js` `GET /student` | Lấy courses từ enrollments **không** filter `status === 'active'` | **REPORT** — FE gate only |
| `routes/assignmentRoutes.js` student GET/submit | Auth + ownership; **không** gate theo active enrollment | **REPORT** |
| `routes/studentRoutes.js` schedules by student | Auth; **không** active-enrollment gate riêng cho learning | **REPORT** |

Phase này: **không** mở rộng RBAC / middleware enrollment trên backend (theo prompt §12). FE gate là lớp chính.

---

## 7. Reactivation

1. Admin / tự đăng ký → tạo enrollment mới `status: 'active'`
2. DataContext refresh `students`
3. `hasLearningAccessEnrollment` → true
4. Gate + sidebar learning items mở lại

---

## 8. Zero-write / safety

- Không refund thật / không prod DB write trong phase này
- Không sửa Messaging / Socket / JWT
- Không C4 / business-code migration
- Display-only cho Mã HĐ (`cancel:` → `HOÀN-####`)

---

## 9. Tests

```bash
node --test tests/unit/learning_access_enrollment.test.js
```

Cover: active / cancelled / completed / multi-course / empty + static App/sidebar/helper presence.

---

## 10. Final status

| Item | Status |
|------|--------|
| Helper SoT `status === 'active'` | **DONE** |
| Student learning gate + NoActiveCourse page | **DONE** |
| Sidebar hide learning items | **DONE** |
| Profile / inbox / feed / news ungated | **DONE** |
| Admin Detail badge / status / Mã HĐ / tab lock | **DONE** |
| Backend enrollment RBAC | **REPORT only** (not in this phase) |
| Messaging / Ledger / postRefund | **UNTOUCHED** |
| Overall | **COMPLETE (FE)** |
