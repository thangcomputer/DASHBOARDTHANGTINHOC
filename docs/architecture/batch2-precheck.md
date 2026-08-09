# Batch 2 Core Domain Relocation Precheck

## 1. Overview
Sprint 4.1 Batch 2 relocates the core operational domains of the platform: `student`, `teacher`, `course`, `enrollment`, and `attendance`. Following the ARB directive, a deeper internal structure will be enforced for each domain (including `routes/`, `models/`, `services/`, `controllers/`, and empty placeholder folders).

## 2. File Verification & Target Mapping

### Domain: `student`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/studentRoutes.js` | `modules/student/routes/studentRoutes.js` | Route | `Student`, `Tenant`, `Group`, `enrollmentService` |
| `models/Student.js` | `modules/student/models/Student.js` | Model | `mongoose` |
| `models/Group.js` | `modules/student/models/Group.js` | Model | `mongoose` |

### Domain: `teacher`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/teacherRoutes.js` | `modules/teacher/routes/teacherRoutes.js` | Route | `Teacher`, `Course`, `Branch` |
| `routes/staffRoutes.js` | `modules/teacher/routes/staffRoutes.js` | Route | `Teacher`, `Branch` |
| `routes/employeeRoutes.js` | `modules/teacher/routes/employeeRoutes.js`| Route | `Employee` (from auth) |
| `models/Teacher.js` | `modules/teacher/models/Teacher.js` | Model | `mongoose` |
| `models/TeacherAssignmentSegment.js`| `modules/teacher/models/TeacherAssignmentSegment.js`| Model | `mongoose` |
| `services/teacherStarBonus.js` | `modules/teacher/services/teacherStarBonus.js`| Service | `Teacher` |

### Domain: `course`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/courseRoutes.js` | `modules/course/routes/courseRoutes.js` | Route | `Course`, `Student`, `Teacher` |
| `routes/trainingRoutes.js` | `modules/course/routes/trainingRoutes.js` | Route | `TrainingCourse`, `TrainingLesson` |
| `routes/teachingGuideRoutes.js`| `modules/course/routes/teachingGuideRoutes.js`| Route | `TeachingGuide` |
| `routes/assignmentRoutes.js` | `modules/course/routes/assignmentRoutes.js` | Route | `Assignment`, `Submission` |
| `models/Course.js` | `modules/course/models/Course.js` | Model | `mongoose` |
| `models/TrainingCourse.js` | `modules/course/models/TrainingCourse.js` | Model | `mongoose` |
| `models/TrainingLesson.js` | `modules/course/models/TrainingLesson.js` | Model | `mongoose` |
| `models/TrainingProgress.js` | `modules/course/models/TrainingProgress.js` | Model | `mongoose` |
| `models/TeachingGuide.js` | `modules/course/models/TeachingGuide.js` | Model | `mongoose` |
| `models/Assignment.js` | `modules/course/models/Assignment.js` | Model | `mongoose` |
| `models/Submission.js` | `modules/course/models/Submission.js` | Model | `mongoose` |

### Domain: `enrollment`
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `services/enrollmentService.js`| `modules/enrollment/services/enrollmentService.js`| Service | `Student`, `Course`, `Invoice` |

### Domain: `attendance` (Scheduling)
| Current Path | Target Path | Type | Dependencies/Imports |
|---|---|---|---|
| `routes/scheduleRoutes.js` | `modules/attendance/routes/scheduleRoutes.js` | Route | `Schedule`, `Teacher`, `Course` |
| `models/Schedule.js` | `modules/attendance/models/Schedule.js` | Model | `mongoose` |
| `models/ScheduleHistory.js` | `modules/attendance/models/ScheduleHistory.js`| Model | `mongoose` |

## 3. Placeholder Directory Structure
For every domain above, the following directories will be verified or created if non-existent:
- `controllers/`
- `services/`
- `repositories/`
- `routes/`
- `models/`
- `validators/`
- `dto/`
- `events/`
- `tests/`
- An empty `index.js` file at the root of the domain.

## 4. Execution Readiness
The dependencies are fully mapped. Relocation is safe to proceed under Phase 2 using the automated path-updating script.
