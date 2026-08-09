# API Security Review
## Authentication & Authorization
- Robustly handled via AuthMiddleware.

## Validation
- Joi-based validation prevents mass assignment and injection.

## Rate Limiting & Replay Attacks
- Global and route-specific limits in place.
- Idempotency layer prevents replay attacks.

## Mass Assignment & Injection
- Prevented by strict DTO layers stripping unknown fields.

## Object Exposure & Sensitive Responses
- EventLogger anonymizes PII.
- Passwords never returned.

## HTTP Headers & CORS & CSRF
- Helmet restricts frames, enables HSTS.
- CSRF middleware fully functional.
