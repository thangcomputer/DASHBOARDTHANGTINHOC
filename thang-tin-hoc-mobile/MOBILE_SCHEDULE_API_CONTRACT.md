# MOBILE SCHEDULE API CONTRACT

## Scope

This mobile schedule integration is limited to the real backend schedule endpoints already used by the web app. It does not invent new endpoints or connect unrelated business modules.

## Feature flag

- `EXPO_PUBLIC_MOBILE_SCHEDULE_API=false` by default
- When enabled, the mobile app calls the real schedule API instead of the mock schedule list
- When disabled, the app keeps the existing mock schedule data flow unchanged

## Real backend contract

### Student schedule list

- Method: `GET`
- URL: `/api/schedules?studentId=<studentId>`
- Auth: authenticated user session
- Response shape:
  ```json
  {
    "success": true,
    "count": 1,
    "total": 1,
    "page": 1,
    "limit": 200,
    "data": [
      {
        "_id": "64b...",
        "teacherId": { "_id": "...", "name": "Nguyễn Văn A", "phone": "..." },
        "studentId": { "_id": "...", "name": "Trần Thị B", "course": "...", "phone": "...", "zalo": "..." },
        "date": "2026-10-23T00:00:00.000Z",
        "startTime": "19:00",
        "endTime": "20:30",
        "course": "Word nâng cao",
        "linkHoc": "https://meet.google.com/xyz",
        "status": "scheduled",
        "studentConfirmStatus": "pending",
        "note": "",
        "studentNote": "",
        "teacherName": "Nguyễn Văn A",
        "studentName": "Trần Thị B",
        "branchId": "...",
        "createdAt": "2026-10-23T10:00:00.000Z",
        "updatedAt": "2026-10-23T10:00:00.000Z"
      }
    ]
  }
  ```

### Teacher schedule list

- Method: `GET`
- URL: `/api/schedules?teacherId=<teacherId>`
- Auth: authenticated teacher session
- Response is the same shape as the student list, scoped to the teacher's own timetable

### Schedule detail

- Method: `GET`
- URL: `/api/schedules/:scheduleId`
- Used when the app needs a single session detail beyond the list payload

### Optional mutating actions supported by the current backend

- `POST /api/schedules` — create a new schedule
- `PUT /api/schedules/:scheduleId` — update a schedule
- `DELETE /api/schedules/:scheduleId` — delete a schedule
- `POST /api/schedules/:scheduleId/student-confirm` — student accepts/confirms the session
- `PATCH /api/schedules/:scheduleId/cancel` — cancel an existing schedule, where supported by the route layer

## Verified field mapping for mobile UI

The mobile app maps the backend schedule rows to the existing `ScheduleItem` shape:

- `id` = `_id` or `id`
- `title` = `course`
- `subject` = `course`
- `person` = `teacherName` for students or `studentName` for teachers
- `date` = ISO-local YYYY-MM-DD derived from `date`
- `dateLabel` = localized calendar date string
- `time` = `startTime – endTime`
- `location` = `linkHoc` or `location` fallback
- `status` = `completed` / `cancelled` / `no_show` / `scheduled` => `completed` / `cancelled` / `upcoming`
- `attendanceStatus` = derived from `studentConfirmStatus` and session `status`
- `note` = `note || studentNote`
- `meetingUrl` = `linkHoc`
- `teacherName` / `studentName` = populated from nested or top-level fields

## Important constraints

- Only the real `/api/schedules` route family is used
- No mock schedule data is created in real mode
- No other business APIs are connected in this phase
- Empty real backend results are treated as an empty-state schedule, not as synthetic items

## Current status

- Auth: not used for this mobile scope in this branch beyond the existing mock login flow
- Schedule real mode: implemented behind the feature flag; mock remains the default safe path
- Native QA remains blocked until a real Android/iOS device or emulator is available
