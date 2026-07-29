# Checklist tiến độ — tiền / dữ liệu / quyền / UX realtime

**Cập nhật:** 2026-07-29

## 1. Làm ngay — chặn lỗi tiền / dữ liệu / quyền

| Mục | Trạng thái | Bằng chứng |
|-----|------------|------------|
| Redis staging (→ prod) | **DONE** | VPS `healthz` `redis=up` `queue=bullmq`; script `qa_fix_redis_url_staging.cjs` |
| E2E Refund partial + full | **DONE** | `docs/QA_REFUND_E2E_REPORT.md` — 9/9 PASS |
| E2E đổi GV A→B (8/12) | **DONE** | `docs/QA_REASSIGN_E2E_REPORT.md` — 8/8 PASS |
| Checklist `assertStudentBranchAccess` mọi mutation student/finance | **DONE (session này)** | Wire thiếu: enrollments/pay/settings/assign-teacher/reset-*; invoice POST branch guard; test `studentBranchMutationGuard.test.js` |

> Local Redis vẫn có thể `disabled` — chỉ staging/prod bắt buộc up.

## 2. Làm tiếp — UX / realtime

| Mục | Trạng thái | Bằng chứng |
|-----|------------|------------|
| Playwright 4 luồng vàng | **DONE** | `docs/QA_UI_GOLDEN_PATHS_REPORT.md` — 7/7 PASS |
| Socket reconnect matrix | **DONE** | `docs/QA_SOCKET_MATRIX_REPORT.md` |
| Socket lịch / điểm danh / BT → HV + no duplicate | **DONE (session này)** | `scripts/qa_socket_business_e2e.cjs` → `docs/QA_SOCKET_BUSINESS_REPORT.md` |
| Lịch sử điểm 80→90→95 + audit | **DONE** | `docs/QA_GRADE_HISTORY_REPORT.md` — 9/9 PASS |

## 3. Rồi mới scale

| Mục | Trạng thái | Ghi chú |
|-----|------------|---------|
| CAPTCHA_BYPASS chỉ `NODE_ENV=test` | **DONE (code)** | Concurrent public 36/36 PASS; internal cần server chạy `NODE_ENV=test CAPTCHA_BYPASS=1` |
| Zalo / SMTP / Firebase gửi thử staging | **CHƯA** | Thiếu env credentials — cấu hình tay rồi smoke |
| Gate mỗi fix: `*Phase*.test.js` + `qa_enterprise_seed_e2e.cjs` | **Đang giữ** | Chạy regression sau mỗi batch |

## Lệnh regression nhanh

```bash
node --test tests/integration/*Phase*.test.js tests/integration/studentBranchMutationGuard.test.js tests/integration/gradeHistory.test.js tests/integration/captchaBypass.test.js
node scripts/qa_refund_e2e.cjs
node scripts/qa_reassign_e2e.cjs
node scripts/qa_grade_history_e2e.cjs
node scripts/qa_socket_matrix.cjs
node scripts/qa_socket_business_e2e.cjs
node scripts/qa_ui_golden_paths.cjs
```
