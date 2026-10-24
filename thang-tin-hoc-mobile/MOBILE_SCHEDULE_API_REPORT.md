# MOBILE SCHEDULE API REPORT

## Implementation status

- Branch: `feature/mobile-schedule-api`
- Base commit: `15ef9f76da12f994ae1ee5ac56f651402ed9fbe0`
- Scope: mobile schedule integration for real Student/Teacher schedule routes only
- Default mode: `EXPO_PUBLIC_MOBILE_SCHEDULE_API=false`
- Real mode: enabled only when the feature flag is explicitly set to `true`

## Contracts

### Student endpoints

- `GET /api/schedules?studentId=<studentId>`
- `GET /api/schedules/:scheduleId` (when a detail fetch is needed)

### Teacher endpoints

- `GET /api/schedules?teacherId=<teacherId>`
- `GET /api/schedules/:scheduleId` (when a detail fetch is needed)

### Supported field mapping

- `_id` -> `id`
- `course` -> `title`, `subject`, `courseName`
- `date` -> localized date + `YYYY-MM-DD` derived value
- `startTime` + `endTime` -> `time`
- `teacherName` / `studentName` -> `person`
- `linkHoc` -> `meetingUrl` / `location`
- `status` / `studentConfirmStatus` -> mapped `ScheduleItem.status` and `attendanceStatus`

## Connected functions

- `scheduleService.list(role)` in [src/services/mockService.ts](./src/services/mockService.ts)
- Real backend fetch guarded by `EXPO_PUBLIC_MOBILE_SCHEDULE_API`
- Real rows are normalized through a dedicated mapper before entering the existing mobile UI contract

## Still mock / not connected

- Teacher monthly calendar remains outside the current mobile scope
- Makeup attendance remains not connected unless the backend exposes a real route in the current web flow
- Most other business modules remain mock-only, per the phase constraints

## Timezone policy

- Scheduled dates are normalized using JavaScript `Date` parsing rather than string slicing
- The app uses ISO-aware backend values when present and only derives local display strings from parsed dates
- Unknown or null values render as `—` instead of fabricated values

## Validation

- `npm run typecheck`: PASS
- `npx expo install --check`: PASS
- `npx expo export --platform web`: PASS
- `git diff --check`: PASS
- `npm run test:auth`: not defined in the current mobile package; auth regression was not re-run here
- `npm run test:profile`: not defined in the current mobile package; profile regression was not re-run here

## Native status

- Native Android/iOS schedule QA: `NOT RUN`
- Real device/emulator is still required before any native schedule certification is valid

## Security notes

- No tokens, CSRF headers, or private student objects are logged
- The feature flag keeps mock mode as the default-safe path
- Real mode uses the existing authenticated request flow and does not invent a new backend contract

## Readiness

- Mobile schedule API implementation: `READY`
- Expo Web schedule API smoke: `PASS`
- Native schedule QA: `NOT RUN`
- Production ready: `NO`
