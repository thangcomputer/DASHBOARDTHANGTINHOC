# QA Báo cáo — Nhóm 2: Admin ↔ Học viên

**Ngày:** 2026-07-28 · Local API · Script `scripts/_qa_group2_admin_student.cjs`  
**Commit:** chưa (theo yêu cầu kiểm tra toàn bộ rồi commit sau)

## Kết quả

| Metric | Giá trị |
|--------|---------|
| PASS | 18 |
| FAIL | 3 (email / SMS / notification onboard — High/Medium) |
| SKIP | 1 |
| Critical FAIL còn mở | **0** (đã vá trong session) |
| Hoàn thành (excl SKIP) | **85.7%** |

## Critical đã bắt & vá

| ID | Bug | Fix |
|----|-----|-----|
| G2-01 | Response create HV lộ field `password` (hash) | Xóa password/refreshToken khỏi JSON |
| G2-02 | Không sinh `studentCode` | Auto `HV` + timestamp khi tạo |
| G2-14 | `PUT /pay` → 500 `next is not a function` | `Invoice` pre-save bỏ `next` (Mongoose async) |
| G2-18 | Khóa `suspended` vẫn login được | `login/public` chặn student suspended + `$inc tokenVersion` khi khóa |

## FAIL còn lại (product gap)

- **G2-03** Không email welcome HV  
- **G2-04** Không SMS  
- **G2-05** Không notification in-app cho HV khi tạo  

## PASS nổi bật

Tạo HV → login → khóa học/học phí/công nợ → lịch → LMS settings → gán GV → GV thấy HV → Admin sửa → thanh toán + hóa đơn → enrollment khóa 2 → chặn finance IDOR → khóa tài khoản revoke session.

JSON: `docs/QA_GROUP2_ADMIN_STUDENT.json`
