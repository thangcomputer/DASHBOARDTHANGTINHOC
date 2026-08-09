# Exam & Certificate Service Review — Sprint 4.3 Batch 3

## Domains: `exam`, `certificate`

### Architecture Before Batch 3
- Evaluation, Quiz, Proctoring, and Results contained immense logic inside route closures (`evaluationRoutes.js`, `examResultRoutes.js`, `proctorRoutes.js`, `quizRoutes.js`).
- Certificate domain contained no active route handlers to migrate.

### Architecture After Batch 3
- Handlers mapped and extracted to:
  - `EvaluationApplicationService`
  - `ExamResultApplicationService`
  - `ProctorApplicationService`
  - `QuizApplicationService`

### Boundary Compliance
- ✅ Exam logic untouched, algorithms preserved.
- ✅ Fixed `gradeHistory.test.js` regression by updating the source scan target.
- ✅ Certificate module skipped as designed.
