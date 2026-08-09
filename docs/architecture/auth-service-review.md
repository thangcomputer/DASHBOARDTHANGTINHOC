# Auth Service Review — Sprint 4.3 Batch 1

## 1. Domain: `auth`

### Before
- **File**: `modules/auth/authRoutes.js` (1,825 lines)
- All business logic lived inside Express route handler callbacks.
- Direct calls to Mongoose models `Teacher` and `Student`.
- Business helpers (`generateTokens`, `checkDeviceConflict`, `safeEqualRefresh`, `issueAdminMfaChallenge`, `issueUserMfaChallenge`) were file-scoped functions with no separation from the HTTP layer.

### After
- **`modules/auth/services/AuthApplicationService.js`** — Contains all business logic extracted verbatim from route handlers. Helper functions remain intact.
- **`modules/auth/controllers/AuthController.js`** — Thin orchestration layer. Each method:
  1. Maps `req` into a plain `data` object.
  2. Calls the corresponding service method.
  3. Maps the service result back to `res`.
- **`modules/auth/authRoutes.js`** — Reduced to routing declarations and middleware chains only.

### Endpoints Migrated (27 routes)
| Method | Path | Service Method |
|--------|------|----------------|
| GET | /csrf-token | getCsrfToken |
| GET | /captcha | getCaptcha |
| POST | /refresh | refreshToken |
| POST | /check-role | checkRole |
| GET | /google | googleAuth |
| GET | /google/callback | googleCallback |
| GET | /zalo | zaloAuth |
| GET | /zalo/callback | zaloCallback |
| POST | /login | login |
| POST | /login/public | loginPublic |
| POST | /login/internal | loginInternal |
| POST | /mfa/verify | mfaVerify |
| POST | /mfa/setup | mfaSetup |
| POST | /mfa/enable | mfaEnable |
| POST | /mfa/disable | mfaDisable |
| GET | /mfa/status | mfaStatus |
| POST | /logout | logout |
| POST | /register-teacher | registerTeacher |
| POST | /change-password | changePassword |
| GET | /me | getMe |
| POST | /avatar | updateAvatar |
| POST | /forgot-password/request | forgotPasswordRequest |
| POST | /forgot-password/verify | forgotPasswordVerify |
| POST | /admin/generate-otp | adminGenerateOtp |
| POST | /reset-password-request | resetPasswordRequest |
| POST | /admin/reset-password | adminResetPassword |
| PUT | /admin/profile | adminUpdateProfile |

## 2. Boundary Compliance
- ✅ Controller does NOT call repositories directly.
- ✅ Controller does NOT call Mongoose.
- ✅ All `req`/`res` parsing remains in the Controller.
- ✅ All business decisions remain in the Service.
- ✅ All existing error messages, status codes, RBAC, and audit behavior preserved.
