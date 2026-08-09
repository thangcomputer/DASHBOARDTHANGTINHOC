# Runtime Dependency Review

## 1. Overview
Following the static dependency analysis, a secondary review was conducted on all asynchronous, background, and runtime execution contexts. The purpose was to verify that detached processes (which may lack standard HTTP request cycles) do not implicitly or explicitly depend on the deprecated legacy authorization layers.

## 2. Component Review Matrix

| Runtime Component | Dependency Status | Validation Note |
|---|---|---|
| **BullMQ / Redis Workers** | CLEAN | Workers (Email, OTP, Welcome) evaluate payload data (`userId`, `role`) passed directly into the queue. They do not invoke authorization middleware. |
| **Cron Jobs** | CLEAN | Scheduled tasks run with elevated system context. No legacy `isAdmin` guards are imported or executed. |
| **Socket.IO** | CLEAN | WebSocket handshakes authenticate via JWT directly and extract `roleCode`. No legacy permission wrappers are used for real-time event broadcasting. |
| **Webhook Handlers** | CLEAN | External callbacks (e.g., SePay, Zalo) bypass RBAC and use HMAC/Secret signature verification. |
| **Background Services** (Exam/AI) | CLEAN | The AI and Exam result processing pipelines evaluate business rules inside the Service Layer, completely decoupled from route guards. |

## 3. Analysis Findings
- **No Implicit Imports**: None of the runtime scripts or worker processors import `shared/middleware/authMiddleware.js` for the purpose of invoking `checkPermission`, `isAdmin`, or `isTeacher`.
- **Identity vs. Authorization**: Where runtime processes need to evaluate access (e.g., determining if a Socket.io user can join an admin room), they inspect the standardized JWT payload (`roleCode`, `branchId`) established during authentication, rather than relying on legacy middleware wrappers.

## 4. Conclusion
All runtime components operate fully independently of the legacy authorization infrastructure. Removing the legacy files will have **zero** impact on background jobs, queues, crons, or sockets.
