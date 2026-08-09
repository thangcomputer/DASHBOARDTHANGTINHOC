# Architecture Review: Reliability
## Executive Summary
- **Transaction Strategy**: Native MongoDB multi-document transactions using Mongoose sessions.
- **Outbox/Inbox Strategy**: Polling-based MongoDB outbox via BullMQ to guarantee At-Least-Once delivery.
- **Saga Readiness**: Workflows are well-defined but require a Saga Orchestrator abstraction.
- **Retry Policy**: Exponential backoff integrated natively into BullMQ processors.
- **Idempotency**: Redis-backed middleware for mutation endpoints.
- **Consistency Model**: Eventual Consistency strictly enforced between aggregates.
