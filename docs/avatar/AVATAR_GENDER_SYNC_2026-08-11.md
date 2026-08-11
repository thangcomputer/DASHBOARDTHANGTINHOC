# AVATAR_GENDER_SYNC — 2026-08-11

Phase: **AVATAR-GENDER-SYNC-1**  
Mode: Implementation + Test + Report  
Scope: Avatar / Gender consistency only

---

## 1. Root cause

1. **Login / `/me` thiếu `gender`** (và login student thiếu `avatar`) → session/localStorage không có giới tính sau đăng nhập.
2. **Sidebar / EditableAvatar / Profile** gọi `resolveAvatarUrl` **không truyền `gender`** → fallback sai so với Admin list (đã có `gender={s.gender}`).
3. **`DEFAULT_AVATARS` trỏ PNG** (`student_male.png`, `staff_female.png`, …) **không tồn tại** trong `client/public/avatars/` (chỉ có SVG role trung tính) → 404.
4. **`Avatar` onError** fallback `DEFAULT_AVATARS[role]` với **`staff` = `staff_female.png`** → nguy cơ “nam → nữ”.
5. Logic cũ `isFemale ? female : male` **biến unknown thành male**.

---

## 2. Files audited

- `client/src/utils/defaultAvatars.js`
- `client/src/components/admin/shared/Avatar.jsx`
- `client/src/components/EditableAvatar.jsx`
- `client/src/components/AppSidebar.jsx`
- `client/src/components/student/StudentProfileTab.jsx`
- `client/src/components/teacher/TeacherProfileTab.jsx`
- `client/src/components/teacher/TeacherStudentCard.jsx`
- `client/src/components/teacher/TeacherStudentsTab.jsx`
- `client/src/components/teacher/TeacherOverviewTab.jsx`
- `client/src/components/admin/tabs/AdminStudentsTab.jsx` (đã truyền gender — giữ)
- `client/src/components/admin/tabs/AdminTeachersTab.jsx`
- `client/src/components/StudentDetailModal.jsx` (đã truyền gender — giữ)
- `client/src/components/FloatingMessenger.jsx` / `Inbox.jsx` / `StaffManagementTab.jsx` / `FeedBoard.jsx`
- `client/src/context/useDataMessaging.js` / `FloatingMessengerContext.jsx`
- `services/messagingContactsService.js` (CONTACT_SELECT đã có `gender`)
- `routes/authRoutes.js`
- `models/Student.js` / `models/Teacher.js`
- `client/public/avatars/*`

---

## 3. Files changed

| File | Change |
|------|--------|
| `client/src/utils/defaultAvatars.js` | `normalizeGender`, remap SVG assets, unknown ≠ male |
| `client/src/components/admin/shared/Avatar.jsx` | onError gender-aware (2-step) |
| `client/src/components/EditableAvatar.jsx` | prop `gender` |
| `client/src/components/AppSidebar.jsx` | truyền `session.gender` |
| `client/src/components/student/StudentProfileTab.jsx` | truyền gender |
| `client/src/components/teacher/TeacherProfileTab.jsx` | truyền gender |
| `client/src/components/teacher/TeacherStudentCard.jsx` | truyền gender |
| `client/src/components/teacher/TeacherStudentsTab.jsx` | truyền gender |
| `client/src/components/teacher/TeacherOverviewTab.jsx` | truyền gender |
| `client/src/components/admin/tabs/AdminTeachersTab.jsx` | truyền gender |
| `routes/authRoutes.js` | login + `/me` + public login + internal + root admin: `avatar` + `gender` |
| `tests/unit/avatar_gender_sync.test.js` | new |
| `docs/avatar/AVATAR_GENDER_SYNC_2026-08-11.md` | this report |

---

## 4. Avatar flow trước

```
DB.gender → (Admin list OK)
         ↘ login/me (thiếu gender) → session → Sidebar/Profile (không gender)
              → resolveAvatarUrl → *_male.png / staff_female.png (404)
              → onError → DEFAULT_AVATARS.staff = female
```

---

## 5. Avatar flow sau

```
DB.gender (raw)
  → login /me (avatar + gender raw, backward compatible)
  → session/localStorage
  → UI truyền gender vào EditableAvatar / Avatar / resolveAvatarUrl
  → isRealAvatar? → upload URL
  → else normalizeGender(male|female|unknown) + role → SVG role trung tính (file có thật)
  → onError → resolveAvatarUrl(avatar='') gender-aware → role SVG
```

---

## 6. Gender normalization

Helper duy nhất: `normalizeGender()` trong `client/src/utils/defaultAvatars.js`.

| Input | Output |
|-------|--------|
| male / Male / Nam / nam | `male` |
| female / Nữ / nữ / nu | `female` |
| "" / null / khác | `unknown` |

API **giữ raw** (`Nam`/`Nữ`/…) để không phá form/admin contract; FE normalize tại resolver.

---

## 7. Default avatar mapping

Assets thực tế: `admin.svg`, `staff.svg`, `teacher.svg`, `student.svg`.  
SUPPORT dùng `staff.svg` (không có `support.svg`).

Tất cả key `*_male` / `*_female` / `*_unknown` / role trần → SVG role tương ứng (trung tính).  
**Không** còn `staff` mặc định female.  
Khi có art gender-specific sau này: chỉ đổi path trong `DEFAULT_AVATARS`.

---

## 8. Login / API changes

- Main login `userData`: luôn có `avatar`, `gender`.
- `completeInternalLogin`: thêm `gender`.
- `login/public`: thêm `avatar`, `gender`.
- `issueAdminTokens` root user: `avatar: ''`, `gender: ''`.
- `GET /me`: `gender` cho DB users; root `admin` → `gender: ''` (unknown).

JWT payload **không** đổi.

---

## 9. Session changes

Không thêm store riêng. `saveSession` / merge `/me` giữ nguyên object → `gender` + `avatar` persist theo role key (`student_user`, …).

---

## 10. UI changes

Sidebar, Student/Teacher Profile, Teacher list cards, Admin Teachers list: truyền `gender`.  
Admin Students + Student Detail: giữ wiring cũ (đã đúng).

---

## 11. Messaging metadata

- `messagingContactsService` **đã** select + map `gender` — không đổi discover/permission.
- FE `resolveAvatarUrl(user)` đọc `user.gender` khi contacts/conversation đã có.
- Không đổi pairing / send matrix / socket.

---

## 12. Assets missing / fixed

| Trước (sai audit) | Sau (đã xác minh runtime) |
|-------------------|---------------------------|
| Remap sang `*.svg` vì Glob bỏ sót PNG | Khôi phục cartoon PNG trên disk |
| Silhouette SVG mọi gender | `student_male.png` / `student_female.png` / `student.png` |
| `DEFAULT_AVATARS.staff = staff_female.png` | `staff.png` / `staff_male.png` / `staff_female.png` |

**Debug note (2026-08-12):** Pre-fix log `url:"/avatars/student.svg"`. Post-fix: `out:"/avatars/student_male.png"` / `student_female.png`. Không có `onError`.

---

## 13. Test results

```
node --test tests/unit/avatar_gender_sync.test.js
→ 15/15 PASS
```

---

## 14. Regression results

```
learning_mode_branch_display + high_admin_teacher_manage_actions
→ 16/16 PASS

phase822_messaging_identity_lock (defaultAvatars STAFF-before-admin)
→ PASS

phase821 test L notifyUser ALL_STAFF
→ FAIL (pre-existing, ngoài scope avatar — REPORT ONLY)
```

---

## 15. Database writes

**0** (không migration, không updateMany).

---

## 16. Production writes

**0**.

---

## 17. Out-of-scope / REPORT ONLY

- Art pack male/female PNG riêng (chưa có) — mapping tạm trung tính theo role.
- `DataContext.updateUserAvatar` ghi `thvp_user` (có thể lệch role session) — bug cũ, không sửa trong phase này.
- Import student CSV vẫn default gender → male khi thiếu (`studentRoutes` import) — không đụng.
- Phase 821 test L `notifyUser` — unrelated.

---

## 18. Remaining risks

1. **Male/female nhìn giống nhau** trên UI cho đến khi có asset gender-specific (resolver đã sẵn key).
2. User đã upload ảnh sai giới tính vẫn hiện ảnh upload (đúng rule product).
3. Session cũ (localStorage trước deploy) thiếu `gender` đến khi reload gọi `/me` hoặc login lại.
4. Feed post author không có gender metadata → `unknown` (đúng, không đoán).
