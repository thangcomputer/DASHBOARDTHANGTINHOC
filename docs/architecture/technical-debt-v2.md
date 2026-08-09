# Technical Debt Review v2

## 1. Overview
This document categorizes the remaining technical debt within the platform following the conclusion of Sprint 4.1.

## 2. Debt Categorization

### 2.1 Critical Debt (Must Fix Immediately - Sprint 4.2)
- **Direct Database Coupling**: Cross-domain Mongoose Model imports. Modules querying other modules' tables directly bypasses security, validation, and domain invariants.
- **Fat Controllers & Routes**: Business logic residing inside Express HTTP route definitions makes unit testing impossible and prevents internal service reuse.

### 2.2 High Debt (Must Fix - Sprint 4.3)
- **Synchronous Transaction Boundaries**: Processes like Enrollment, Billing, and Notifications execute synchronously in a single HTTP request thread. If the Zalo API times out, the student's enrollment rolls back. This requires an Event Bus.
- **Missing Repository Layer**: The system is hard-coupled to MongoDB.

### 2.3 Medium Debt
- **Missing Data Transfer Objects (DTOs)**: Internal services return raw Mongoose JSON objects, leaking database fields (like `__v` or internal ObjectIds) to consuming modules and the frontend.
- **Leaky Global Configurations**: Settings and environment variables are read directly via `process.env` scattered throughout the codebase rather than injected via a centralized config module.

### 2.4 Low Debt
- **Legacy Job Queues**: The BullMQ implementation for OTPs and welcome emails in `services/queue/` is functional but architecturally isolated from the new `modules/` structure.

### 2.5 Future Enhancements
- **CQRS (Command Query Responsibility Segregation)**: Read-heavy operations (like the Analytics Dashboard) should not query the primary Write database. They should read from flattened projections updated via Domain Events.
- **GraphQL / BFF (Backend for Frontend)**: The current REST API returns massive nested JSON payloads. A BFF layer would reduce network latency for mobile clients.
