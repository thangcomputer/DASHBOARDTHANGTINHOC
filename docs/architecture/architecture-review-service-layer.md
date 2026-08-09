# Architecture Review: Service Layer

## 1. Assessment
The current architecture is a modular monolith transitioning toward Clean Architecture. The completion of Sprint 4.2 successfully isolated the Data Access Layer (Repositories), but exposed the critical flaw in the Application Layer: **Fat Controllers**.

## 2. Architectural Blueprint for Sprint 4.3
The upcoming sprint will enforce strict Layered Architecture within each Domain Module:

1. **Presentation Layer (Controllers & Routes)**
   - Responsible for HTTP routing, auth middleware, and mapping `req.body` / `req.query` to a DTO.
   - Delegates completely to the Application Service.
   - Converts Domain Errors to HTTP Status Codes.

2. **Application Layer (Services & Use Cases)**
   - Contains pure business logic.
   - Orchestrates multiple Repositories or external Domain Services.
   - Emits Domain Events upon state changes.

3. **Data Access Layer (Repositories)**
   - Strictly handles persistence.
   - Already completed in Sprint 4.2.

## 3. Expected Outcomes
By the end of Sprint 4.3, no Controller will contain business logic (`if` statements pertaining to business rules, manual validation of domain states, etc.). All logic will reside in easily testable Application Services.
