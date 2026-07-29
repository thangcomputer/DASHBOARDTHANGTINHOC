# QA Socket Business Events Report

**Date:** 2026-07-29T06:45:39.389Z
**API:** http://127.0.0.1:5000
**Result:** 5 PASS / 0 FAIL / 0 WARN

| ID | Name | Result | Actual |
|----|------|--------|--------|
| SOCK-BIZ-01 | Tạo lịch → HV nhận schedule:new | PASS | api=201 studentId=6a6991e23dc72df1ba35b4ef |
| SOCK-BIZ-01b | schedule:new không duplicate trong 800ms | PASS | count=1 |
| SOCK-BIZ-02 | Điểm danh → HV nhận attendance:updated (hoặc data:refresh) | PASS | api=200 event=true msg=Đã điểm danh |
| SOCK-BIZ-03 | Tạo BT → HV nhận assignment:new | PASS | api=200 event=true msg= |
| SOCK-BIZ-04 | Reconnect không phát lại schedule:new cũ | PASS | old=yVrKeHhEifZ6JgYRAAAD new=e78NOQwrXAJ1_WrAAAAF replay=0 |

## Notes
- `assignment:new` emit vào room `student_${id}`; client register join `userId` — WARN nếu event không tới nhưng API OK.
- Reconnect phải không replay event lịch sử.
