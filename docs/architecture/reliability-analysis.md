# Reliability Analysis
## Operations requiring strict guarantees
- **Atomic**: Payment Confirmations, Refund Processing (must succeed or fail as a unit).
- **Retryable**: External webhook deliveries (SePay), Email/Zalo notifications, BullMQ queue jobs.
- **Idempotent**: Payment webhooks (to prevent double-crediting), Registration (to prevent duplicate accounts on network timeout).
