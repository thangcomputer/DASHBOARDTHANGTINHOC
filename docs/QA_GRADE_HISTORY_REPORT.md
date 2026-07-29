# QA Grade History Report

**Date:** 2026-07-29T06:34:22.396Z
**API:** http://127.0.0.1:5000
**Result:** 9 PASS / 0 FAIL

| ID | Name | Result | Actual |
|----|------|--------|--------|
| GRADE-T-80 | Teacher score → 80 | PASS | status=200 msg=Đã lưu điểm 80/100 cho QA GV UI CN1 |
| GRADE-T-90 | Teacher score → 90 | PASS | status=200 msg=Đã lưu điểm 90/100 cho QA GV UI CN1 |
| GRADE-T-95 | Teacher score → 95 | PASS | status=200 msg=Đã lưu điểm 95/100 cho QA GV UI CN1 |
| GRADE-HIST-01 | Teacher scoreHistory 80→90→95 old/new/user/time | PASS | len=3 testScore=95 |
| GRADE-E-80 | Exam essayScore → 80 | PASS | status=200 |
| GRADE-E-90 | Exam essayScore → 90 | PASS | status=200 |
| GRADE-E-95 | Exam essayScore → 95 | PASS | status=200 |
| GRADE-HIST-02 | ExamResult scoreHistory 80→90→95 old/new/user/time | PASS | len=3 essayScore=95 |
| GRADE-HIST-03 | AuditLog score_change entries exist | PASS | count=6 |
