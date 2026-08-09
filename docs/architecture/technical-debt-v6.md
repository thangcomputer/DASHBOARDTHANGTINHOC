# Technical Debt (v6) - Observability focus
## Identified Debt
- Missing unified context propagation (requires `AsyncLocalStorage`).
- Existing legacy `console.log` statements scattered across legacy utilities.
- Lack of formalized Prometheus Exporter hooks in the `CommandBus`.
