# Cryptography Review
## JWT
- HS256 signed. Strong secrets required by `validateEnv`.

## Password Hashing
- bcrypt used by default.

## Secrets & Encryption
- Abstracted. No custom crypto logic.

## Random Generators
- Node crypto module used for idempotency keys and CSRF tokens.

## Key Rotation
- `SecretManager` ready to support external provider rotations.
