# Analytics Period / SoT Consistency Fix

**Date:** 2026-08-13

## Bug

Khi đổi bộ lọc ngày (vd. Hôm nay), tab **Theo chi nhánh** lệch số:

| Widget | Nguồn trước fix | Period |
|--------|-----------------|--------|
| Donut tỷ lệ | `GET /analytics/revenue` → `byBranch` | Theo kỳ (Ledger) |
| Bảng “Chi tiết từng chi nhánh” | `GET /analytics/branches` | **All-time** |

→ KPI “Hôm nay” ~2.9M trong khi Online hiện ~70M (tổng tích lũy).

Tab **Học viên đăng ký** dùng enrollment ops nhưng nhãn “Doanh thu” khiến hiểu nhầm là Ledger.

## Audit (evidence)

### Backend

| Endpoint | SoT | Period |
|----------|-----|--------|
| `GET /api/analytics/revenue` | Ledger | `period` / start–end |
| `GET /api/analytics/enrollment` | Enrollment ops (`createdAt`) | Cùng `period` |
| `GET /api/analytics/branches` | Ledger all-time | **Không nhận period** |

### Frontend (`RevenueAnalyticsTab.jsx`)

- Fetch song song revenue + enrollment + (superadmin) `/branches` **không** truyền `period`.
- Tab branches: donut = `data.byBranch`, bảng = `branchOverview` (all-time).

## Fixed

1. **Tab Chi nhánh:** donut + bảng đều dùng `data.byBranch` (Ledger + cùng kỳ).
2. **Bỏ fetch** `/api/analytics/branches` khỏi trang báo cáo doanh thu theo kỳ.
3. **Enrich** `branchName` / `branchCode` trên `byBranch` (revenue + enrollment).
4. **Tab Đăng ký:** nhãn ops rõ; cột tiền = “Học phí enrollment”; banner SoT.
5. KPI all-time vẫn hiển thị nhưng gắn nhãn “toàn thời gian (cố ý)”.
6. `/analytics/branches` thêm `period: 'all-time'` + note (API vẫn dùng chỗ khác nếu cần).

## Files

- `client/src/components/RevenueAnalyticsTab.jsx`
- `routes/analyticsRoutes.js`
- `tests/unit/analytics_revenue_sot.test.js`
- `docs/analytics/ANALYTICS_PERIOD_CONSISTENCY_2026-08-13.md`

## Tests

```bash
node --test tests/unit/analytics_revenue_sot.test.js
```

## Safety

| Item | Status |
|------|--------|
| Ledger / Invoice rewrite | NO |
| Payment flow | UNCHANGED |
| RBAC / Auth / Messaging / C4 | UNCHANGED |
| DB migration | NO |
| Production writes | 0 |

## Residual

- Enrollment `totalFee` vẫn có thể ≠ Ledger KPI trong cùng kỳ (khác SoT) — đúng by design.
- `/analytics/branches` vẫn all-time; không dùng trong báo cáo theo kỳ này.

## Verdict

**PASS** (sau deploy + smoke: đổi “Hôm nay” → bảng chi nhánh khớp KPI period)
