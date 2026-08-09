# Retry Strategy
## Policies
- **Linear Retry**: For DB lock timeouts (e.g., 3 retries at 100ms intervals).
- **Exponential Backoff**: For external API integrations (Zalo, Email, Payment Gateway). 
  - Ex: 1s, 2s, 4s, 8s, 16s.
- **Circuit Breaker**: For 3rd-party dependencies. If >50% errors in 10s, trip breaker for 30s.
- **Max Retries**: Default 5.
- **Dead Letter Queue (DLQ)**: Hard failures logged to `FailedJobs` collection.
