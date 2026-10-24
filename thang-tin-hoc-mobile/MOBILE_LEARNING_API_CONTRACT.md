# MOBILE LEARNING API CONTRACT

## Status
- Default: feature flag off (`EXPO_PUBLIC_MOBILE_LEARNING_API=false`)
- Real API path: enabled only when the flag is set to `true`
- Current implementation keeps mock behavior as the safe default, while the real route target remains isolated behind the feature flag

## Source of truth used
- `routes/trainingRoutes.js`
- `models/TrainingCourse.js`
- `models/TrainingLesson.js`
- `models/TrainingProgress.js`
- `client/src/components/student/StudentTrainingLMS.jsx`

## Course / catalog
- Endpoint: `GET /api/training-lms/courses`
- Method: `GET`
- Auth: required via `lmsGuard('lms_courses')`
- Response example:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "course-id",
        "title": "Khóa học Word nâng cao",
        "subject": "Word",
        "description": "Tổng quan khóa học",
        "software": "Word",
        "isActive": true,
        "price": 0,
        "chapters": []
      }
    ]
  }
  ```

## Course structure / lessons
- Endpoint: `GET /api/training-lms/courses/:id/lessons`
- Method: `GET`
- Auth: required via `lmsGuard('lms_lessons')`
- Response fields observed in backend:
  - `_id` / `id`
  - `title`
  - `chapterTitle`
  - `duration`
  - `videoUrl` / `url` / `youtubeUrl` / `link`
  - `watchedSeconds`
  - `isCompleted`
  - `isUnlocked`
  - `canAccess`
  - `requiredSeconds`
  - `paywallLocked`
  - `contentLocked`
- Behavior: locked lessons are filtered via access policy and paywall checks; the route intentionally hides video URLs if access is denied.

## Lesson detail
- The public list endpoint is the authoritative source for lesson fields. The backend does not expose a separate public detail endpoint for the student learning flow in this route family.
- The mobile app should only render fields returned by the backend and should not assume additional content beyond the list payload.

## Progress
- Endpoint: `GET /api/training-lms/progress/me`
- Method: `GET`
- Auth: required via `lmsGuard('lms_progress_me')`
- Real semantics: returns per-lesson progress state for the authenticated student, including completion and watched durations.

## Completion / watch progress mutations
- Endpoint: `POST /api/training-lms/save-watch-progress`
- Endpoint: `POST /api/training-lms/complete-lesson`
- Method: `POST`
- Auth: required via `lmsGuard('lms_save_watch')` and `lmsGuard('lms_complete_lesson')`
- Fields passed by client include `courseId`, `lessonId`, `watchedSeconds`, and `videoDuration`.
- Default behavior: these endpoints are not called when the feature flag is off.

## Security
- All learning routes go through the LMS guard chain: auth + policy + cutover gate.
- Student scoping is enforced by `req.user.role` and by course ownership / paywall checks when a course has a price.
- Locked / paywalled lessons are not treated as accessible by mobile code. If the server says locked, the app must not bypass it.

## Mobile integration rule
- The mobile app must not invent lesson content fields.
- It should map backend response values conservatively into the screen models.
- If the backend returns empty data, the UI should show an empty state instead of mock fallback content.

## Out-of-scope
- Exam / certification routes remain web-only.
- Teacher training, assignments, chat, finance, payment, and quiz attempt flows remain outside this learning integration.
