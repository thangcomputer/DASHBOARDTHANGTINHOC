# QA Báo cáo tổng — Luồng nghiệp vụ CMS (API E2E)

**Ngày:** 2026-07-28 (cập nhật sau welcome onboard)  
**Môi trường:** Local `http://127.0.0.1:5000`  
**Phạm vi:** Nhóm 1→8  
**Browser UI:** realtime/typing/seen/cert UI = SKIP  

---

## Tổng quan

| Nhóm | PASS | FAIL | SKIP | Critical mở | Hoàn thành* |
|------|-----:|-----:|-----:|:-----------:|------------:|
| 1 Admin↔GV | 23 | 0 | 2 | 0 | 100% |
| 2 Admin↔HV | 21 | 0 | 1 | 0 | 100% |
| 3 GV↔HV | 12 | 0 | 1 | 0 | 100% |
| 4–8 Finance/LMS/Chat/Notif/Sync | 15 | 0 | 4 | 0 | 100% |

\*excl SKIP

---

## Đã vá trong đợt “phần còn lại” (welcome)

| ID | Nội dung | Fix |
|----|----------|-----|
| G1-02/03 | Email + notif tạo GV | `sendAccountWelcome` + queue `welcome` |
| G2-03/05 | Email + notif tạo HV |同上 |
| G2-04 | SMS | Zalo OA qua welcome queue (không SMS gateway riêng) |
| G3-08 | False FAIL path | Đúng `contacts` + `conversations/:userId` |
| G7-02 | Channels | Welcome + OTP + password + invoice |

**Code:** `services/accountWelcome.js`, `services/queue/processors.js` (`welcome`), `jobQueue.enqueueWelcome`, wire `teacherRoutes` / `studentRoutes`.

---

## Còn ngoài scope / SKIP

| ID | Ghi chú |
|----|---------|
| G4-04 | Không có voucher/refund/renew API |
| G5-03, G6-05, G8-03 | Cần browser + fixture LMS/exam |
| Push FCM | Chưa có |
| SMS gateway | Ngoài product — dùng Zalo OA |

---

## Artefacts

- Scripts: `scripts/_qa_group1_*.cjs` … `_qa_groups_4_to_8.cjs`
- Reports: `docs/QA_GROUP*.md/json`, file này

---

## Kết luận

Luồng core Admin↔GV↔HV + onboard welcome (queue email/Zalo + in-app) **PASS trên API**.  
Chưa commit đợt welcome này — báo khi bạn muốn commit (chưa deploy trừ khi yêu cầu).
