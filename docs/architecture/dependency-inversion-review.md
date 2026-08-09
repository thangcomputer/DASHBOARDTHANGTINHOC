# Dependency Inversion Review

## 1. Overview
The goal of Sprint 4.3 is to solidify Dependency Inversion across the application.

## 2. Target State
- `Controller` depends ONLY on `Application Service`.
- `Application Service` depends ONLY on `Repository Interfaces` (via `RepositoryRegistry` or direct imports for now).
- `Controller` MUST NOT import `Mongoose`, `Models`, or `Repositories`.
- Cross-domain calls must be performed Service-to-Service, NOT Service-to-Repository.

## 3. Current Analysis
- Currently, many `Routes` act as `Controllers` and orchestrate multiple `Repositories`.
- **Violations to resolve**: Direct `repository.findMany()` calls inside route handlers.
