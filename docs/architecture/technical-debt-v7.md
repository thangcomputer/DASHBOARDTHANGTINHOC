# Technical Debt Review v7 (Reliability)
## Remaining Debt
- External webhooks currently lack robust retry mechanisms if the 3rd party is down.
- Mongoose Operations currently do not utilize `.session()` uniformly across the codebase.
- No native Dead Letter Queue UI for operators to replay failed events.
