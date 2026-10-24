# Mobile Web UI/UX Final Audit

**Audit date:** 2026-10-24
**Scope:** Existing Expo app, Student and active Teacher UI only.
**Conclusion:** `MOBILE UI/UX PARITY NOT READY`

## Status rules

- `UI/UX Parity` reports visible content, screen reachability, controls, states and local UI flow against the current web source. Backend availability does not determine this status.
- `Backend Status` is recorded separately. All in-scope screens are `MOCK ONLY / NOT CONNECTED`.
- `PARTIAL` means an actual web UI/content/flow comparison or verification remains incomplete. It does not mean “the backend is not connected.”
- `WEB-ONLY` preserves the web function in the inventory without implementing a native attempt or operational mobile flow.

## Evidence and limits

- Web source inventory and earlier safe local-web inspections are recorded in `MOBILE_WEB_MASTER_PARITY.md`, `MOBILE_STUDENT_WEB_RUNTIME_AUDIT.md`, and `MOBILE_TEACHER_WEB_PARITY_UI.md`.
- Current per-screen status and remaining gaps for S01–S24 / T01–T31 are summarized in [`MOBILE_PARITY_SCREEN_MATRIX.md`](./MOBILE_PARITY_SCREEN_MATRIX.md): 1 ALIGNED, 52 PARTIAL, 0 MISSING and 2 WEB-ONLY.
- Expo Web was started from the existing mobile project. Demo login was used (no supplied account credential was entered).
- Current-run smoke covered Teacher Home, Teacher Schedule navigation, Student Home, Student Schedule, selecting a schedule item, and opening—but not submitting—the Student note modal.
- This continuation additionally signed into the mobile preview with its prefilled demo credentials and opened Teacher Home, Schedule and Feed. The Feed composer and existing post rendered; no post was submitted. The Schedule screen displayed the weekly learner/day grid and teaching diary.
- A document/body width check on the Teacher Schedule screen matched the viewport at 320, 360, 375, 390, 412, 430 and 768 CSS px. This does not cover nested horizontal content, clipping, or every screen.
- The Student evaluation screen now has separate private-center and public-teacher tabs, source-derived rating labels/options, half-course eligibility messaging, and local-only submission validation. Expo Web smoke opened the public form, displayed the eligible 8/12 fixture and four source criteria, and showed a local-only submitted state with a derived star score. No server request was intended or made.
- Student Evaluation document/body width matched the viewport at 320, 360, 375, 390, 412, 430 and 768 CSS px. This does not verify internal clipping or visual parity.
- Student schedule diary now exposes date-range and attendance/cancellation filters and shows available session status, score and note fields. The change was typechecked but not separately browser-verified here.
- Notification list controls include local refresh, mark-all-read, category filters, hide/read actions, mock destination routing and page navigation at 20 items/page. A development-only 25-item Teacher fixture verified page 1/2, unread filtering and the screen at 320/360/375/390/412/430/768 CSS px with no measured horizontal overflow. Full destination parity was not verified against every web notification payload.
- Teacher quiz authoring smoke rendered the source-aligned AI count/difficulty and Excel import/template/export control labels. These controls only show a local demo notice and do not call AI or process files.
- Current web source review confirmed the Teacher makeup attendance request dialog and its one-hour overdue/pending states. Development-only attendance fixtures now exercise both timing branches. The overdue flow was runtime-tested through session details, the one-hour notice, responsibility text, cancel/close and local demo submission; no real message was sent.
- Student evaluation fixtures now cover below-threshold (4/12), eligible (8/12), existing rating and course-ended lock. The browser verified the 4/12 block, hydrated 4.5-star existing rating and criteria edit form, and the no-submit locked state after course end.
- Student Profile now contains the hero KPIs, personal fields, learning summary/course progress, tuition/payment status and video-order empty state. It rendered at 320/360/375/390/412/430/768 CSS px with no measured horizontal overflow; exact screenshot parity and persisted account/payment data remain unverified.
- Direct screenshot comparison was not performed in this run. Prior notes record limited Teacher finance reference comparison; other screen-by-screen screenshot parity is not established.
- No destructive or account-changing web operation was performed. No post, real message, attendance, profile update, export, or payment was submitted.

## STUDENT

| Web Function | Web Route / Source | Mobile Screen | UI/UX Parity (visual / functional) | Backend Status | Remaining UI Gap |
|---|---|---|---|---|---|
| Overview, course/progress, next class, tasks, resources and learning log | `/student`; `StudentOverviewTab.jsx` | Home | `PARTIAL` (visual unverified / sections present) | MOCK ONLY / NOT CONNECTED | Verify every web section, state and ordering against current responsive screenshots; fixture values are demo-only. |
| Schedule, course filter, weekly view, detail, diary filters and note | `/student#schedule`; `StudentScheduleTab.jsx`, `StudentScheduleView.jsx` | Schedule | `PARTIAL` (weekly grid, course filter, detail and local note tested; diary filters/status/score/note now represented but not re-tested) | MOCK ONLY / NOT CONNECTED | Verify diary fields/actions and compare screenshots; no actual note or schedule persistence. |
| Homework list, detail and submission UI | `/student#materials-assignments`; `StudentMaterialsTab.jsx` | Assignments | `PARTIAL` (visual unverified / list and local detail flow present) | MOCK ONLY / NOT CONNECTED | Verify all web filters, submission states, feedback fields and source labels; no real upload/submit. |
| Learning materials and videos | `/student#materials-files`; `StudentMaterialsTab.jsx` | Materials | `PARTIAL` (visual and full control comparison not established) | MOCK ONLY / NOT CONNECTED | Verify all source-specific categories, course associations, empty states and detail actions. |
| Software links | `/student#materials-software`; `StudentMaterialsTab.jsx` | SoftwareLinks | `PARTIAL` (visual comparison not established) | MOCK ONLY / NOT CONNECTED | Verify web fields, eligibility and link actions; external launch remains unavailable. |
| Course / lesson practice catalog | `/student/lesson-practice*`; `StudentTrainingLMS.jsx` | StudentLearning, LearningLesson | `PARTIAL` (catalog and lesson routes exist) | MOCK ONLY / NOT CONNECTED | Verify all web locks, enrollment gates, progress states and lesson details; no media playback/progress persistence. |
| Assigned quiz list / exam, certification and official results | `/student/exam*`, `/student/cert-prep*` | StudentExam | `WEB-ONLY` for attempt / `PARTIAL` for informational inventory | MOCK ONLY / NOT CONNECTED | Actual attempt, native exam, camera/proctor, result submission and official score remain on web. Mobile no longer starts a local quiz attempt. |
| Grades and learning history | `/student#exam-scores`; `StudentOverviewTab.jsx`, `StudentMaterialsTab.jsx` | Grades, Home | `PARTIAL` (visual comparison not established) | MOCK ONLY / NOT CONNECTED | Verify web history fields, filters and empty/populated states. |
| Inbox and conversation | `/student/inbox`; shared `Inbox` | Messages, Conversation | `PARTIAL` (screens/actions exist; full source comparison not established) | MOCK ONLY / NOT CONNECTED | Verify all web filters, unread/presence states and supported message actions; realtime/read receipts/file transfer not connected. |
| Evaluation and milestone eligibility | `/student#evaluation`; `StudentEvaluationView`, `MilestoneEvaluationModal`, `useDataRatings.js` | Evaluations | `PARTIAL` (4/12 blocked; existing 4.5-star rating/criteria hydrated and editable; course-ended lock verified; visual comparison incomplete) | MOCK ONLY / NOT CONNECTED | Eligibility/rating remains fixture data; local feedback is not submitted to web. |
| Feed | `/student/feed`; `FeedBoard` | Feed | `PARTIAL` (visual/permission comparison not established) | MOCK ONLY / NOT CONNECTED | Verify source post states, author/privacy, image, comment and action set. |
| News and article detail | `/student/news*`; `NewsPage` | News, NewsDetail | `PARTIAL` (visual comparison not established) | MOCK ONLY / NOT CONNECTED | Verify all article metadata, filters and detail fields. |
| Profile, personal information and tuition | `/student#profile`; `StudentProfileTab`, `TuitionPaymentModal` | Profile, Tuition | `PARTIAL` (hero KPIs, personal fields, learning/course progress, tuition status and video-order empty state rendered; no measured horizontal overflow at 320/360/375/390/412/430/768 px; screenshot comparison incomplete) | MOCK ONLY / NOT CONNECTED | Payment/order history and official profile write are not connected; missing source values remain `—`. |
| Center information | `/student/center-info`; `CenterInfoPage` | CenterInfo | `PARTIAL` (visual comparison not established) | MOCK ONLY / NOT CONNECTED | Confirm the current source's sections/content and represent unavailable fields as `—` or an empty state. |
| Notifications | `/student/notifications`; `NotificationCenterPage` | Notifications | `PARTIAL` (local read/hide/category/refresh controls and category-based routes represented; 25-item fixture reached pages 1/2 and no measured horizontal overflow at 320–768 px) | MOCK ONLY / NOT CONNECTED | Verify web payload-specific destinations and source action states. |

## TEACHER

| Web Function | Web Route / Source | Mobile Screen | UI/UX Parity (visual / functional) | Backend Status | Remaining UI Gap |
|---|---|---|---|---|---|
| Overview, actions, monthly KPI, today schedule, learners and grading | `/teacher`; `TeacherOverviewTab.jsx` | Home | `PARTIAL` (current demo rendered / source screenshot comparison incomplete) | MOCK ONLY / NOT CONNECTED | Verify exact responsive section order, labels, actions and values against current web. |
| Weekly schedule, roster, slot selection and diary | `/teacher#schedule`; `TeacherScheduleTab`, `TeacherWeeklySlotGrid` | Schedule | `PARTIAL` (weekly grid, diary and navigation rendered; document/body width matched viewport at seven requested widths) | MOCK ONLY / NOT CONNECTED | Nested overflow/visual parity and live schedule/attendance remain unverified; monthly calendar is feature-flagged off on current web. |
| Makeup attendance request | `TeacherTeachingLog.jsx`, `AttendanceMakeupRequestModal.jsx` | Attendance overdue-session modal | `PARTIAL` | MOCK ONLY / NOT CONNECTED | Development fixture verified session details, one-hour notice, responsibility text, close/cancel and local demo-submit state; no real message or approval workflow is connected. |
| Attendance, completion and makeup | Schedule and attendance flows | Attendance, Schedule | `PARTIAL` (session list/detail and local status selection rendered; overdue request branch runtime-tested) | MOCK ONLY / NOT CONNECTED | Real save/request and source approval state remain unavailable; screenshot comparison incomplete. |
| Assigned learners, filters, detail and chat action | `/teacher#students`; `TeacherStudentsTab.jsx` | Students | `PARTIAL` (compact list exists / full source comparison not run) | MOCK ONLY / NOT CONNECTED | Verify all profile fields/actions and source status options; last access stays `—` when unavailable. |
| Inbox, groups and chat | `/teacher/inbox`; shared `Inbox` | Messages, Conversation | `PARTIAL` (local actions exist / complete source action set not verified) | MOCK ONLY / NOT CONNECTED | Verify role filters, presence, unread, group and message action UI; no realtime/file transport. |
| Homework create, target, deadline, submissions and grading | `/teacher#assignments`; `TeacherAssignmentsView.jsx` | Assignments | `PARTIAL` (mock forms/actions exist / screenshot comparison incomplete) | MOCK ONLY / NOT CONNECTED | Verify every web tab, field, validation and submission state. |
| Teacher-created quizzes, results, recreate/delete | `/teacher#assignments`; `TeacherQuizManager.jsx` | TeacherQuizzes | `PARTIAL` (AI/Excel label controls rendered as local-only notices; full source comparison incomplete) | MOCK ONLY / NOT CONNECTED | No AI generation, Excel file processing, quiz dispatch or verified complete result/detail state. |
| Training courses, process, materials and software | `/teacher#training`; `TeacherTrainingLMS.jsx` | TeacherTraining | `PARTIAL` (tabs/course UI exist / screenshot comparison incomplete) | MOCK ONLY / NOT CONNECTED | Verify exact source content, course details, lesson states and interactions. |
| Finance totals, chart, filters, history and export controls | `/teacher/finance`; `TeacherFinanceAndTraining.jsx` | TeacherFinance | `PARTIAL` (limited supplied-reference comparison recorded) | MOCK ONLY / NOT CONNECTED | Verify all source fields and empty/populated states; export buttons do not create/download files. |
| News search, filters, list/grid and details | `/teacher/news*`; `NewsPage.jsx` | News, NewsDetail | `PARTIAL` (controls exist / full source comparison incomplete) | MOCK ONLY / NOT CONNECTED | Verify author, thumbnail, permissions, pagination and article states. |
| Feed composer, privacy, image, post and comments | `/teacher/feed`; `FeedBoard` | Feed | `PARTIAL` (local composer and interactions exist / visual comparison incomplete) | MOCK ONLY / NOT CONNECTED | Verify source role/privacy choices and edit/delete/reply states; image upload/load-more not connected. |
| Center information | `/teacher/center-info`; `CenterInfoPage` | CenterInfo | `PARTIAL` (section selector exists / source content comparison incomplete) | MOCK ONLY / NOT CONNECTED | Verify all current source sections and fields; do not invent unavailable copy. |
| Profile, personal/bank fields, edit and password | `/teacher#profile`; `TeacherProfileTab.jsx` | Profile | `PARTIAL` (edit UI exists / full field comparison incomplete) | MOCK ONLY / NOT CONNECTED | Verify exact source fields, status, tags and edit/password actions; no real update. |
| Notifications, filters, read/dismiss and destination | `/teacher/notifications`; `NotificationCenterPage` | Notifications | `PARTIAL` (25-item fixture verified across pages 1/2 and unread filter) | MOCK ONLY / NOT CONNECTED | Verify payload-specific web destinations; read state/push remain local. |
| Teacher onboarding test | `/teacher/test`; `TeacherTest.jsx` | No native attempt; inventory entry only | `WEB-ONLY` | MOCK ONLY / NOT CONNECTED | Keep assessment, camera and practical upload on web. The mobile menu entry is informational and no longer misroutes to quiz authoring. |

## Responsive and flow smoke

| Check | Result |
|---|---|
| Student Schedule document/body width at 320, 360, 375, 390, 412, 430, 768 px | PASS for document/body width equality in Expo Web; weekly grid itself intentionally scrolls horizontally. |
| Teacher Schedule document/body width at 320, 360, 375, 390, 412, 430, 768 px | PASS for document/body width equality in Expo Web; weekly grid itself intentionally scrolls horizontally. |
| Student Evaluation document/body width at 320, 360, 375, 390, 412, 430, 768 px | PASS for document/body width equality in Expo Web; nested clipping and visual parity not established. |
| Student Evaluation local demo submit state | PASS — inline saved state and derived stars rendered; no backend connection. |
| Teacher Quiz authoring AI/Excel labels and controls | PASS — visible in Expo Web, all remain non-operational mock notices. |
| Student schedule item detail and note modal | PASS for opening; note was not submitted. |
| Student role menu destinations for materials and exam inventory | PASS — materials opens Materials; exam view shows WEB-ONLY categories and no attempt action. |
| Student notification entry from Conversation header | PASS — opens the notification screen; no notification was marked read. |
| Teacher Schedule → Attendance session selection/status UI | PASS — schedule fixtures shown; selecting and saving a status displayed an explicit local-demo confirmation. No backend request or real write. |
| Teacher Home, Schedule and Feed preview route smoke | PASS — each screen rendered; Feed was not submitted. |
| Full Teacher flow across all secondary screens and states | NOT RUN |
| Full Student flow across all secondary screens and states | NOT RUN |
| Per-screen direct screenshot comparison | NOT RUN in this audit; do not infer visual parity from rendering. |
| Empty/loading/error/populated state sweep on every route | NOT RUN |
| Android / iOS native-device QA | NOT RUN |

## Boundary and validation

| Requirement | Result |
|---|---|
| Existing project, navigation and Student/Teacher screens retained | YES |
| Website or backend changed | NO |
| Real API/auth/database/Redis/Socket.IO/push/payment connected | NO |
| Native exam/camera/proctoring implemented | NO |
| Admin / Admin Staff added to mobile | NO |
| Student exam attempt in mobile | NO — informational WEB-ONLY inventory only |
| `npm run typecheck` | PASS |
| `npx expo install --check` | PASS — dependencies up to date; no dependency change |
| `git diff --check` | PASS |
| Overall readiness | `MOBILE UI/UX PARITY NOT READY` |

## Known routing correction in this audit

- Student role menu now routes homework, learning materials and software to their corresponding existing screens instead of sending the combined “Tài liệu & phần mềm” entry to Assignments.
- Teacher onboarding test no longer routes to Teacher quiz authoring.
- The Student exam destination retains web-only category/result information but no longer starts a mock quiz attempt.
- The Student header notification button now targets the correct stack screen from secondary routes; a hard-coded unread count was removed.

These corrections do not establish complete parity; the remaining screen comparisons and state/flow QA above are still required.
