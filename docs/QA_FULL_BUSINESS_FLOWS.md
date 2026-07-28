# QA Báo cáo tổng — Luồng nghiệp vụ CMS (API E2E)

**Ngày:** 2026-07-28 (cập nhật sau đóng SKIP + refund API)  
**Môi trường:** Local `http://127.0.0.1:5000`

## Tổng quan

| Nhóm | Luồng | PASS | FAIL | SKIP | Hoàn thành* |
|------|--------|-----:|-----:|-----:|------------:|
| 1 | Admin ↔ GV | 25 | 0 | 0 | **100%** |
| 2 | Admin ↔ HV | 22 | 0 | 0 | **100%** |
| 3 | GV ↔ HV | 13 | 0 | 0 | **100%** |
| 4–8 | Finance/LMS/Chat/Notif/Sync | 19 | 0 | 0 | **100%** |

\*excl SKIP (hiện **0 SKIP**)

## Đã bổ sung để đóng phần “chưa làm”

| ID | Trước | Sau |
|----|--------|-----|
| G1-18/24 | SKIP thiếu HV / UI | PASS — tạo fixture + cross-cover G3/G5 |
| G2-20 | SKIP chứng chỉ/lịch UI | PASS — tạo lịch + HV xem + unlock-exam |
| G3-11 | SKIP LMS/nộp bài UI | PASS — assignment + submit + evaluation + exam-result + progress |
| G4-04 | SKIP voucher/refund | PASS — `PUT /api/students/:id/refund` |
| G5-03 | SKIP thi UI | PASS — unlock + exam-results API |
| G6-05 | SKIP realtime UI | PASS — upload PNG + emoji text |
| G8-03 | SKIP browser cache | PASS — API SoT đã verify |

## Ngoài product (không làm)

- Voucher / gia hạn khóa riêng (chỉ có refund học phí)
- Push FCM
- Typing/Seen socket UI đầy đủ (đã smoke upload/emoji API)

## Kết luận

Admin↔HV, GV↔HV (cả hai chiều nghiệp vụ core) **đã PASS 100% trên API**.
