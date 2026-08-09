# Public API Review

## 1. Overview
This document evaluates the boundaries exposed by each module. In a true Domain-Driven Design (DDD) system, external modules should only interact with a given domain via its explicit Public API (`index.js`).

## 2. Public API Status
**Current State**: 100% of the 28 domains have an empty `index.js` placeholder. No Public API interface exists.

## 3. Boundary Violations Detected

### 3.1 Leaking Internals (Encapsulation Failure)
Modules are currently completely unencapsulated.
- Example: The `analytics` module requires `modules/course/models/Course.js` directly. It bypassed the conceptual boundary of the `course` domain to read its internal database structure.
- **Why this is bad**: If the `course` domain decides to rename a field or switch from MongoDB to PostgreSQL, the `analytics` domain will catastrophically fail.

### 3.2 Bypassing Services (Direct DB Access)
Controllers and Routes frequently bypass internal services and communicate directly with Mongoose Models.
- Example: `studentRoutes.js` calls `Student.find({})` directly rather than invoking `StudentService.listStudents()`.
- **Why this is bad**: Business logic validation (e.g., checking if a student is active before returning them) cannot be globally enforced if routes query the database directly.

### 3.3 Missing Repository Layer
There is zero insulation between the application and the database driver (Mongoose).
- `mongoose.model` operations (`.find`, `.aggregate`, `.updateOne`) are scattered across 70+ files.
- **Why this is bad**: It makes unit testing almost impossible without standing up a live MongoDB instance or using complex Mocking libraries.

## 4. Remediation Path (Sprint 4.2)
1. **Define the Public API**: Populate `index.js` in every module to export ONLY the Service interfaces and DTOs that other domains are permitted to use.
2. **Hide Models**: Mongoose models must be removed from `module.exports` to prevent cross-domain importing.
3. **Route Refactoring**: Move all database querying out of Express Route handlers into `repositories/`.
