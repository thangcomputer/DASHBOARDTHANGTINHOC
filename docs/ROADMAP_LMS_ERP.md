# Roadmap LMS / ERP Multi-Branch (Business track)

**Khác** roadmap hardening đã Done (`ROADMAP_REVIEW.md`). Track này triển khai nghiệp vụ đã chốt trong `docs/adr/`.

**Luật:** Mỗi phase → implement → **gate test PASS** → mới sang phase sau. Không nhảy cóc.

| Phase | Tên | ADR liên quan | Tiên quyết |
|------:|-----|---------------|------------|
| 0 | Architecture freeze (ADR) | 0001–0005 | — | **PASS** |
| 1 | Database foundation | 0001,0002,0005 | Phase 0 PASS | **PASS** |
| 2 | Auth / password provision | 0005 | Phase 1 | **PASS** |
| 3 | RBAC harden | 0006 | Phase 2 | **PASS** |
| 4 | Branch isolation verify | — | Phase 3 | **PASS** |
| 5 | Notification platform | 0005 | Phase 1–2 | **PASS** |
| 6 | Course + Enrollment lifecycle | 0001,0004 | Phase 4–5 | **PASS** |
| 7 | Schedule + teacher reassign | 0004 | Phase 6 | **PASS** |
| 8 | Attendance | 0004 | Phase 7 | **PASS** |
| 9 | Exam | 0004 | Phase 6+5 | **PASS** |
| 10 | Finance / ledger policy | 0001 | Phase 6+5 | **PASS** |
| 11 | Rating moderation | 0003 | Phase 6 | **PASS** |
| 12 | Reward | 0003 | Phase 11+10 | **PASS** |
| 13 | Session payroll | 0004 | Phase 7+10 | **PASS** |
| 14 | Dashboard split KPI | 0001 | 1–13 ổn | **PASS** |
| 15 | Multi-tenant deepen / optional PG | 0007 | Sau khi branch cứng | **PASS** |

Chi tiết mục tiêu / DoD / test từng phase: xem phân tích kiến trúc (chat) + cập nhật gate file mỗi phase (`docs/PHASE{N}_GATE.md`).
