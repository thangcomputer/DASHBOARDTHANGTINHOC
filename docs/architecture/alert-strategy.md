# Alert Strategy
## Triggers
- **P1 (Critical)**: Mongo Down, Redis Down, Error Rate > 5% for 5 mins. Page engineer.
- **P2 (High)**: CPU > 90%, Memory > 85%, High Command Latency. Slack notification.
- **P3 (Warning)**: Cache Miss Ratio Spike, Slow Queries. Daily digest.
