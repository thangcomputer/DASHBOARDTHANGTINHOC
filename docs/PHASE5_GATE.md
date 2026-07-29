# Phase 5 Gate — Notification platform

**Ngày:** 2026-07-29  
**Tiên quyết:** Phase 4 PASS

## Đã làm

| Hạng mục | Chi tiết |
|----------|----------|
| Templates | `constants/notificationTemplates.js` |
| Deep links | `constants/deepLinks.js` |
| Delivery tracking | `models/NotificationDelivery.js` |
| Notification fields | `templateCode`, `eventId`, `idempotencyKey`, `priority`, `expiresAt`, `archived_by` |
| Service | `NotificationService.send` + `sendFromTemplate` + idempotent + multi-channel track |
| Queue | `enqueueNotifyText` / `notify-text` job |
| Digest | `services/notificationDigest.js` + cron 06:00 VN (`CLASS_DIGEST_CRON`) |
| Center | archive API `PUT /notifications/:id/archive` |
| Tests | `tests/integration/notificationPhase5.test.js` |

## Definition of Done

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | Template render + deep link | PASS (test) |
| 2 | Idempotency key ổn định | PASS (test) |
| 3 | Delivery model + schema Phase 5 | PASS (test) |
| 4 | Archive export + route | PASS |
| 5 | Digest 1/HV/ngày (helper + cron) | PASS |
| 6 | enqueueNotifyText có sẵn | PASS (test) |
| 7 | Tương thích `NotificationService.send` cũ | PASS (API giữ nguyên) |

## Không làm (phase sau)

- Migrate mọi call site sang `sendFromTemplate`
- FCM đầy đủ
- Preference / quiet hours UI
- DLQ worker UI (failed → dead sau N lần — schema đã có status `dead`)

## Kết luận

**PASS** — Phase 5 tests: 11/11 xanh (`notificationPhase5.test.js`) + notificationCenter regression 4/4 (tổng 15/15).

Phase tiếp theo: **Phase 6 — Course + Enrollment lifecycle**.

