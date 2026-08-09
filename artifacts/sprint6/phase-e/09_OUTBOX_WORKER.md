# 09. OUTBOX WORKER
- Logic: Polling every 5s for `status: PENDING`. Dispatches to EventBus.