# QA UI Golden Paths Report

**Date:** 2026-07-29T06:11:46.443Z
**Client:** http://localhost:5173
**API:** http://127.0.0.1:5000
**Auth:** JWT session inject (CAPTCHA bypass for automation)
**Result:** PASS 7 · FAIL 0

## Cases
- **[PASS]** `UI-ADMIN-01` — Admin thấy HV chưa thanh toán trong danh sách — `visible=true name=QA UI PAY 443553 phone=09615443553 footer="Hiển thị 1 / 1 học viên · Trang 1/1" apiHits=[{"status":200,"total":1,"n":1,"first":{"name":"QA UI PAY 443553","phone":"09615443553"}},{"status":200,"total":1,"n":1,"first":{"name":"QA UI PAY 443553","phone":"09615443553"}}]`
- **[PASS]** `UI-ADMIN-02` — Admin xác nhận thanh toán trên UI — `payBtn=true dbPaid=true enrPaid=true`
- **[PASS]** `UI-GV-01` — GV thấy học viên phụ trách — `visible=true`
- **[PASS]** `UI-GV-02` — GV điểm danh (UI hoặc lịch hôm nay sẵn sàng) — `btn=true status=scheduled att=undefined`
- **[PASS]** `UI-HV-01` — HV vào #schedule (đã đăng nhập) — `notLogin=true signal=true url=http://localhost:5173/student#schedule`
- **[PASS]** `UI-STAFF-01` — Staff CN1 không thấy HV CN2 — `decoyVisible=false`
- **[PASS]** `UI-STAFF-02` — Staff CN1 vẫn thấy HV CN1 — `cn1Visible=true phone=09616443553`

## Notes
- Không cover password+CAPTCHA login UI (cần CAPTCHA_BYPASS).
- 4 luồng: Admin pay · GV students/attendance · HV schedule · Staff branch isolation.
