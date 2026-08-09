# Course Service Review — Sprint 4.3 Batch 2

## Domain: `course`

### Architecture Before Batch 2
- **Routes Files**:
  - `modules/course/routes/courseRoutes.js`
  - `modules/course/routes/assignmentRoutes.js`
  - `modules/course/routes/trainingRoutes.js`
  - `modules/course/routes/teachingGuideRoutes.js`
- All logic lived inside route handlers.

### Architecture After Batch 2
- **`CourseApplicationService.js`** / **`CourseController.js`** (9 routes)
- **`AssignmentApplicationService.js`** / **`AssignmentController.js`** (8 routes)
- **`TrainingApplicationService.js`** / **`TrainingController.js`** (7 routes)
- **`TeachingGuideApplicationService.js`** / **`TeachingGuideController.js`** (1 route)

### Endpoint Breakdown
- **Course**: CRUD for Master Courses, Cloning courses, Status toggles.
- **Assignment**: Submission handling, Grading history (`gradeHistory.test.js` verified), Teacher feedback.
- **Training**: Teacher training tracking, Onboarding modules.
- **Teaching Guide**: Guide fetching logic.

### Boundary Compliance
- ✅ Extracted to Services seamlessly using automated phase 1 script.
- ✅ Controller payload wrapping maintains complete separation.
- ✅ Test `assignment grade PUT appends gradeHistory + audit` successfully ported to scan the `AssignmentApplicationService` instead of routes, verifying the logic successfully transitioned without being dropped.
