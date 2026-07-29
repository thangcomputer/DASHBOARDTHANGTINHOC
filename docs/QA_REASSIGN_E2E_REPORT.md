# QA Reassign Teacher E2E Report

**Date:** 2026-07-29T05:52:08.935Z
**API:** http://127.0.0.1:5000
**Scenario:** 8 completed (GV A) + 12 scheduled → reassign GV B
**Result:** PASS 8 · FAIL 0

- **[PASS]** `REA-01` — Assign-teacher API success — `status=200 msg=Đã gán giảng viên thành công meta={"completedSessionsAtSwitch":8,"futureSchedulesUpdated":12,"completedSplit":{"6a6991e23dc72df1ba35b4e2":8},"progressPreserved":true}`
- **[PASS]** `REA-02` — Completed stay with GV A (=8) — `completedA=8 split={"6a6991e23dc72df1ba35b4e2":8}`
- **[PASS]** `REA-03` — Future schedules moved to GV B (=12) — `futureB=12 futureA=0`
- **[PASS]** `REA-04` — Enrollment teacherId = GV B — `teacherId=6a6991e23dc72df1ba35b4e3 top=6a6991e23dc72df1ba35b4e3`
- **[PASS]** `REA-05` — Progress preserved (completed/remaining) — `completed=8 remaining=12`
- **[PASS]** `REA-06` — Grades preserved — `grades=1`
- **[PASS]** `REA-07` — Assignment still exists — `id=6a699508386d9038d2634b38 title=QA Reassign BT 1785304328882`
- **[PASS]** `REA-08` — API meta.progressPreserved — `true`
