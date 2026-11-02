# Mobile Release Test Matrix

Record device/model, OS version, build ID, tester, date, and result for each manual test. Current status is **NOT RUN** unless noted.

| Area | Test | Expected result | Status |
|---|---|---|---|
| Auth | Student login with valid credentials | Authenticated Student session; token stored securely on native | NOT RUN |
| Auth | Teacher login with valid credentials | Authenticated Teacher session; teacher APIs remain server-authorized | NOT RUN |
| Auth | Invalid credentials | Clear, non-technical error; no session saved | NOT RUN |
| Auth | Locked/suspended account | Access denied and session removed; no live socket remains | NOT RUN |
| Auth | Expired access token | Single-flight refresh succeeds or session is cleared once; no refresh loop | NOT RUN |
| Auth | Revoke session / change password | Revoked session cannot continue API or socket activity | NOT RUN |
| Auth | Logout while online | Backend logout attempted, SecureStore cleared, socket disconnected | NOT RUN |
| Student | Dashboard/home | Real account data; loading, empty, retry/error states render correctly | NOT RUN |
| Student | Schedule | API-backed schedule and week navigation match the web account | NOT RUN |
| Student | Learning and lessons | Entitlements and progress match backend; no fabricated access | NOT RUN |
| Student | Assignments | Submit text/file; verify upload and server receipt | NOT RUN |
| Student | Materials | Empty and populated API states; protected downloads require auth | NOT RUN |
| Student | Notifications | Unread count matches backend; read/dismiss updates persist | NOT RUN |
| Student | Profile | Missing API fields do not fabricate courses or progress | PASS (static regression) |
| Teacher | Dashboard and schedule | Teacher-only data and permissions enforced by backend | NOT RUN |
| Teacher | Students | Only assigned/authorized students can be opened or updated | NOT RUN |
| Teacher | Quizzes | Create, delete, import/export workbook; malformed and oversized files rejected | NOT RUN |
| Teacher | Notifications | Unread count and notification navigation match backend | NOT RUN |
| Teacher | Profile | Edit profile and change password; revoked sessions stop working | NOT RUN |
| Chat | Text message | Sent/received/read state stays synchronized across web and mobile | NOT RUN |
| Chat | Image and file | Permission appears only after user action; upload/download works securely | NOT RUN |
| Chat | Sticker/reply/reaction | Existing message interactions remain functional | NOT RUN |
| Chat | Report message/user | Requires moderation API and workflow (`BACKEND API REQUIRED`) | BLOCKED |
| Chat | Block/unblock user | Requires server-enforced block policy and API (`BACKEND API REQUIRED`) | BLOCKED |
| Chat | Offline/reconnect | No duplicate messages; unread/read state reconciles after reconnect | NOT RUN |
| Network | Wi-Fi, mobile data, and no Internet | Loading terminates, actionable friendly error appears, retry works | NOT RUN |
| Network | Backend timeout/server unavailable | Request is bounded; no raw server exception shown | PASS (static/type check only) |
| Push | Permission prompt | Appears only after selecting “Bật thông báo trên thiết bị” | PASS (static regression) |
| Push | Foreground/background/terminated delivery | Correct sound, no sensitive message text, and tap routes correctly | BLOCKED (EAS/FCM/APNs not configured) |
| Push | Logout/revoked session | Device token is removed or no longer targets the session | NOT RUN |
| Device | Android small/large screens | No clipped controls; keyboard and navigation safe areas work | NOT RUN |
| Device | iPhone small/large screens | No clipped controls; keyboard, notch, and safe areas work | NOT RUN |
| Device | Screen reader and large text | Controls labeled, focus order understandable, touch targets usable | NOT RUN |
| Android | API 36+, 64-bit, 16 KB page size | Install and run release AAB on compliant target device | BLOCKED (AAB not built) |
| iOS | Production archive and privacy report | Archive validates and privacy manifest matches SDK behavior | BLOCKED (archive not built) |

Automated checks currently run for this audit: targeted push/sound/navigation tests; mobile TypeScript check; Expo Doctor; npm production dependency audit. They do not replace the device tests above.
