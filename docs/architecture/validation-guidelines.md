# Validation Guidelines (Sprint 4.4+)

## 1. Core Principle
Validation must exist as a standalone layer separating the raw Controller input from the DTO creation.
- **Schema Separation**: Zod Schemas (`.js`) must live in the `validators/` directory, completely decoupled from the DTO classes/factory files.
- **Error Standardization**: ZodErrors must never reach the user unhandled. They must be wrapped in `ValidationException`.

## 2. Zod Configuration Standard
- `required()`: For all historically mandatory fields.
- `optional()`: For all historically optional fields.
- `passthrough()`: For the root object to prevent stripping un-typed legacy properties during the migration phase, ensuring zero regressions.

## 3. The Validation Pipeline
The Controller utilizes the Validator class to execute validation:
```javascript
// StudentValidator.js
const { z } = require('zod');
const ValidationException = require('../../../shared/errors/ValidationException');
const ValidationMetrics = require('../../../shared/metrics/ValidationMetrics');

const Schema = z.object({ ... }).passthrough();

class StudentValidator {
  static validateCreate(req) {
    const start = Date.now();
    const result = Schema.safeParse({ ...req.body, ...req.params, ...req.query });
    
    if (!result.success) {
      ValidationMetrics.logFailure('student', 'CreateStudent', Date.now() - start, result.error.errors);
      const errors = result.error.errors.map(err => ({
        field: err.path.join('.'),
        code: 'invalid_field',
        message: err.message
      }));
      throw new ValidationException('Invalid request', errors);
    }
    
    ValidationMetrics.logSuccess('student', 'CreateStudent', Date.now() - start);
    return result.data;
  }
}
```
