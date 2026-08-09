# 01_FEATURE_FLAG_RUNTIME_PROOF

## Objective
Verify the execution path controlled by the `ENABLE_CQRS_STUDENT_CREATE` feature flag.

## Evidence

### File
`routes/studentRoutes.js`

### Route Definition
```javascript
// Line 565
router.post('/', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENTS), branchFilter], async (req, res, next) => {
```

### Feature Flag Evaluation
```javascript
// Line 567-571
    // Strangler Facade for CQRS Migration
    if (process.env.ENABLE_CQRS_STUDENT_CREATE === 'true') {
      const CQRSStudentController = require('../modules/student/controllers/CQRSStudentController');
      return await CQRSStudentController.create(req, res, next);
    }
```

### Legacy Fallback
```javascript
// Line 573-579
    // Không dùng Zalo/SĐT làm mật khẩu mặc định (dễ đoán) — random + isFirstLogin
    const plainPassword = req.body.password != null && String(req.body.password).trim() !== ''
      ? String(req.body.password).trim()
      : generateTempPassword(8);
    req.body.password = plainPassword;
    req.body.isFirstLogin = true;
```

## Verdict
[VERIFIED]
- **`ENABLE_CQRS_STUDENT_CREATE=true`**: Binds execution to `CQRSStudentController.create()` on line 570, early-returning to prevent legacy execution.
- **`ENABLE_CQRS_STUDENT_CREATE=false`**: Bypasses the condition and proceeds to line 573 to execute the legacy inline route logic.
