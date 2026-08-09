# Security Inventory
## Authentication Mechanisms
- JWT-based stateless authentication.
- AuthMiddleware ensures validity.

## Authorization (RBAC)
- Role-based checking via `userHasPermission`.
- Enforces hierarchical privileges.

## JWT Lifecycle
- Short-lived Access Tokens, Long-lived Refresh Tokens.
- Redis-based (or in-memory) blacklisting for revocation.

## Password Policies
- bcrypt hashed, minimum length enforced.

## Session Handling
- Stateless REST, managed entirely by JWT.

## Secrets Usage
- Abstracted via `SecretManager`.
- Defaults to environment variables with external vault readiness.

## API Security
- Helmet, CORS, RateLimiter, HPP protection.
- CSRF protection via matching tokens in cookies/headers.

## File Upload Security
- Magic byte validation to prevent spoofing.
- Restricted mime types.

## WebSocket Security
- Validated handshake.

## Internal CQRS Security
- Command handlers implicitly assume pre-authorized input from controllers.

## EventBus Security
- Internal process boundary only.

## Infrastructure Security
- Multi-stage Docker, non-root user.

## Production Security
- Proxy timeouts, DDOS mitigations, strict reverse proxy routing.
