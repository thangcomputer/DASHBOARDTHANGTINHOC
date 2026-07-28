# QA Báo cáo — Nhóm 3: Giảng viên ↔ Học viên

**Ngày:** 2026-07-28 · Script `scripts/_qa_group3_teacher_student.cjs`

| Metric | Giá trị |
|--------|---------|
| PASS | 12 |
| FAIL | 0 |
| SKIP | 1 (LMS video/nộp bài UI) |
| Critical | 0 |
| Hoàn thành (excl SKIP) | **100%** |

## PASS nổi bật

Tạo lịch → HV thấy → hủy → điểm danh → nhập điểm → contacts/conversations chat → chặn spoof teacherId → chặn upload training admin.

## Ghi chú

- G3-08 trước FAIL do sai path `GET /conversations`; đúng: `GET /contacts` + `GET /conversations/:userId`.

JSON: `docs/QA_GROUP3_TEACHER_STUDENT.json`
