# QA Báo cáo tổng — Luồng nghiệp vụ CMS (API E2E)

**Ngày:** 2026-07-28  
**Môi trường:** Local `http://127.0.0.1:5000`  
**Phạm vi:** Nhóm 1→8 theo checklist user (bỏ qua chức năng không có trong đề xuất / không có API)  
**Browser UI:** Không có MCP browser — realtime/typing/seen/cert UI = SKIP có ghi chú  
**Commit/Deploy:** **Chưa** (theo yêu cầu: kiểm tra toàn bộ rồi commit sau)

---

## Tổng quan

| Nhóm | PASS | FAIL | SKIP | Critical mở | Hoàn thành* |
|------|-----:|-----:|-----:|:-----------:|------------:|
| 1 Admin↔GV | 21 | 2 | 2 | 0 | 91% |
| 2 Admin↔HV | 18 | 3 | 1 | 0 | 86% |
| 3 GV↔HV | 11 | 1† | 1 | 0 | 92% |
| 4–8 Finance/LMS/Chat/Notif/Sync | 14 | 1 | 4 | 0 | 93% |

\*excl SKIP · †G3-08 false FAIL (sai path test; đúng path ở G6-02 PASS)

**Critical đã phát hiện & vá trong session (chưa commit):**

1. JWT GV còn dùng sau khóa → `auth.js` + `teacherRoutes`  
2. HV create lộ password hash + thiếu `studentCode` → `studentRoutes`  
3. `PUT /students/:id/pay` 500 (`Invoice` pre-save `next`) → `models/Invoice.js`  
4. Khóa HV `suspended` vẫn login → `authRoutes` + `studentRoutes` tokenVersion  
5. Chat thiếu `receiverName` → 500 → `messageRoutes` auto-resolve tên  

---

## FAIL còn lại (không Critical — product gap)

| ID | Mức | Nội dung |
|----|-----|----------|
| G1-02/03, G2-03/05 | High/Med | Không welcome email / notification khi tạo GV/HV |
| G2-04 | Medium | Không SMS |
| G7-02 | Medium | Email/SMS/Push chưa đủ cho mọi event nghiệp vụ |
| G4-04 | SKIP | Không có voucher/refund/renew API |
| G5-03, G6-05, G8-03 | SKIP | Cần browser + fixture LMS/exam |

---

## Artefacts

- `docs/QA_GROUP1_ADMIN_TEACHER.md` + `.json`  
- `docs/QA_GROUP2_ADMIN_STUDENT.md` + `.json`  
- `docs/QA_GROUP3_TEACHER_STUDENT.json`  
- `docs/QA_GROUPS_4_TO_8.json`  
- Scripts: `scripts/_qa_group1_*.cjs`, `_qa_group2_*.cjs`, `_qa_group3_*.cjs`, `_qa_groups_4_to_8.cjs`

---

## File đã sửa khi QA (local, chưa commit)

- `middleware/auth.js`  
- `routes/teacherRoutes.js`  
- `routes/studentRoutes.js`  
- `routes/authRoutes.js`  
- `routes/messageRoutes.js`  
- `models/Invoice.js`  
- `client/src/services/api.js` (`ACCOUNT_DISABLED`)

---

## Kết luận

Luồng core Admin↔GV↔HV (tạo tài khoản, phân công, lịch, điểm danh/điểm, thanh toán/hóa đơn, chat text, phân quyền API) **PASS trên API** sau các bản vá Critical.  
Còn thiếu: onboard email/SMS/notification, voucher/refund, và kiểm thử UI browser (thi/chứng chỉ/realtime).

**Sẵn sàng commit + deploy** khi bạn yêu cầu.
