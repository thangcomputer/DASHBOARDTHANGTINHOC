# Teacher Mobile UI — Web Parity and Responsive QA

**Updated:** 2026-10-24
**Scope:** Teacher UI in the existing Expo project only. The five Teacher tabs and current project structure remain in place.

For the current audit's separate **UI/UX Parity** and **Backend Status** columns, see [`MOBILE_WEB_UI_UX_FINAL_AUDIT.md`](./MOBILE_WEB_UI_UX_FINAL_AUDIT.md). Backend disconnection is not itself a UI parity gap.

## Scope and implementation status

- Retained the existing Expo/React Native project, navigation, mock services, and Student flows.
- Kept the Teacher bottom navigation to **Tổng quan**, **Lịch dạy**, **Học viên**, **Hộp thư**, and **Hồ sơ**. Other Teacher destinations remain available through Home quick actions and the role-based function menu.
- Authentication, API/backend, database, Redis, Socket.IO, push, payment, real file upload/download, and native exam/camera/proctoring remain **OFF**.
- Teacher-created posts, quizzes, profile edits, chat actions, and finance controls operate only on local demo state or display a demo notice.
- No website/backend files or dependency versions were changed.

## WEB → MOBILE FUNCTION PARITY

| Screen | Web reference | Mobile status | Visual parity | Functional UI parity | Remaining difference |
|---|---|---|---|---|---|
| Tổng quan | `/teacher`, `TeacherDashboard.jsx`, `teacher/TeacherOverviewTab.jsx` | **PARTIAL** | PARTIAL — web source reviewed; no responsive reference screenshots were available for direct comparison | PARTIAL — greeting, immediate actions, monthly KPI cards, schedule, assigned learners, and grading section are present | Unsupported metrics remain `—`; values and actions are fixtures/local demo state. |
| Lịch dạy | `/teacher#schedule`, `teacher/TeacherScheduleTab.jsx`, `TeacherWeeklySlotGrid.jsx`, `TeacherTeachingLog.jsx` | **PARTIAL** | PARTIAL — mobile has the seven-day learner-by-date grid, scrollable schedule and diary; slot selection is a native modal rather than an inline web dropdown | PARTIAL — weekly navigation, roster filters, learner search/sorting, 90-minute time choices, conflict guards, all/day/week/month/pending/cancelled diary filters, schedule-backed attendance, and overdue makeup request demo modal; overdue modal was runtime-tested with a local fixture | Mock records remain local. The makeup request is demo-only and does not send a real message. Screenshot comparison remains incomplete. The monthly calendar is feature-flagged off in current web source. |
| Học viên | `/teacher#students`, `teacher/TeacherStudentsTab.jsx` | **PARTIAL** | PARTIAL — compact responsive rows; no screenshot comparison | PARTIAL — search, status filters, avatar, course, chat action and learner details | Last access has no fixture and displays `—`; web data and full actions are not connected. |
| Hộp thư | `/teacher/inbox`, `Inbox.jsx` | **PARTIAL** | PARTIAL — mobile role badge, availability and row layout; no inbox screenshot comparison | PARTIAL — search, Teacher categories and local group creation with selected demo participants | Conversations, online state and read counts are fixtures; no Socket.IO or live read state. |
| Chi tiết hội thoại | `Inbox.jsx` conversation view | **PARTIAL** | PARTIAL — mobile chat layout, not screenshot-compared | PARTIAL — local send, reply, reaction, sticker, attachment placeholder, recall, pin and message status | No actual file transfer, persistence, realtime updates or server delivery/read receipts. |
| Bảng tin | `/teacher/feed`, `FeedBoard` | **PARTIAL** | PARTIAL — native-style single-column composer and posts; no reference image comparison | PARTIAL — composer, audience choice, image placeholder, post, reaction and comments are mock-only | Image selection/upload and post persistence are not implemented. |
| Bài tập về nhà (nộp file) | `/teacher#assignments`, `TeacherAssignmentsView.jsx` | **PARTIAL** | PARTIAL — responsive homework list/cards; no screenshot comparison | PARTIAL — mock create now represents course, all/selected learner targeting, deadline validation, submission detail and local grading | No attachment selection/upload, delivery, server persistence or real learner enrollment. |
| Bài thi Trắc nghiệm | `/teacher#quizzes`, `TeacherQuizManager.jsx` | **PARTIAL** | PARTIAL — quiz cards and metrics use mobile layout; no screenshot comparison | PARTIAL — mock authoring represents course, all/selected learner targeting, start/deadline, time limit and multiple questions; AI count/difficulty and Excel import/template/export controls are represented by non-operational demo actions | No real assignment/enrollment; student count is based on mock learners or `—`. AI generation, Excel file processing, API and Socket.IO remain off. |
| Khóa đào tạo | `/teacher#training`, `TeacherTrainingLMS.jsx` | **PARTIAL** | PARTIAL — course banner/card adapted for mobile; no screenshot comparison | PARTIAL — course, process, materials and software tabs; course progress, lessons and local expand action | LMS progress and content are mock fixtures; no real media playback or learning-state sync. |
| Tài chính | `/teacher/finance`, `TeacherFinanceAndTraining.jsx` | **PARTIAL** | PARTIAL — web summary/report hierarchy and vertical monthly bar chart adapted; compared against supplied finance screenshot | PARTIAL — received/pending/session summaries, history filters and grouped PDF/CSV summary/detail controls are shown | Totals are demo fixtures, not the signed-in web account data; export controls do not generate/download files. |
| Tin tức | `/teacher/news`, `NewsPage.jsx` | **PARTIAL** | PARTIAL — list/grid options and article cards; no screenshot comparison | PARTIAL — search, topic, sort, time filter, list/grid toggle, detail, views and date are available | Mock source has no author/thumbnail data; those fields display `—`. |
| Thông tin Trung tâm | `/teacher/center-info`, `CenterInfoPage` | **PARTIAL** | PARTIAL — banner, dropdown and source-backed section names; no screenshot comparison | PARTIAL — overview, source-provided fields and section selection are displayed | Intro, founded year, mission, vision, values and contact data are empty in the available mock and display `—`. |
| Hồ sơ | `/teacher#profile`, `teacher/TeacherProfileTab.jsx` | **PARTIAL** | PARTIAL — navy/red hero and source-aligned fields; no screenshot comparison | PARTIAL — profile fields and local edit form are available; password changes remain on website | Unavailable profile values/status display `—`; edits do not persist to the server. |
| Thông báo | `/teacher/notifications`, `NotificationCenterPage` | **PARTIAL** | PARTIAL — notification list and status/category filters; no screenshot comparison | PARTIAL — read/unread, category, timestamps, detail, mark-read, mock related-action affordance and page controls (20/page); 25-item fixture verified on pages 1 and 2 | Notification contents and actions are local fixtures; push service, synchronized read state and live destination behavior are not connected. |
| Bài kiểm tra đầu vào | `/teacher/test`, `TeacherTest.jsx` | **WEB-ONLY** | WEB-ONLY TẠM THỜI | WEB-ONLY TẠM THỜI — the menu marks this as website-only | No mobile attempt, camera, screen capture or proctoring. |

Teacher makeup attendance request UI is represented locally; its overdue branch was exercised with a development fixture through detail, responsibility notice and local demo submit. Other Teacher destinations are reachable, but remain **PARTIAL** because server-backed workflows and most screenshot comparisons are not available; reachability does not imply business-flow parity.

The row-by-row Student/Teacher audit, including explicit web-only entries and unverified states, is in [`MOBILE_PARITY_SCREEN_MATRIX.md`](./MOBILE_PARITY_SCREEN_MATRIX.md). Teacher makeup-request UI remains a local-only demo modal; no real request/message is sent.

## Actual local web Teacher runtime audit

Authenticated to the local web app with the supplied Teacher test account and inspected it at desktop and narrow responsive widths. Navigation, empty states, filters, and non-destructive dialogs were exercised. I did not submit posts, send messages, alter profile/account/bank data, change attendance, mark/hide notifications, delete records, export reports, or save schedules.

The login page first used the Student role and returned an authentication error; selecting the Teacher role then opened `/teacher`. The live app emitted intermittent 502/503 resource failures. In particular, the assignments route remained on “Đang tải lớp / khóa học…” and its homework/quiz data workflows could not be exercised end-to-end. Results below distinguish observed web UI behavior from source-informed behavior and do not imply all server operations succeeded.

| Web area / source | Runtime result | Teacher functionality observed | Mobile application / remaining |
|---|---|---|---|
| Tổng quan — `teacher/TeacherOverviewTab.jsx` | **OPENED** | Immediate actions, monthly finance/student KPIs, assigned students, next classes and grading area. This account showed zero/no assigned data. | Mobile keeps mock-only summary and actions; no server counts are copied into fixtures. |
| Lịch dạy — `teacher/TeacherScheduleTab.jsx`, `TeacherWeeklySlotGrid.jsx` | **OPENED; empty schedule** | Runtime shows the full seven-column weekly student × weekday grid, studying/completed/all filters, learner search, A–Z/Z–A, a time sort control per date, slot dropdowns, and diary filters. The signed-in account returned no eligible students or classes, so runtime cell mutation and conflict cases were not testable. | Mobile now uses the same seven-day grid structure with horizontal scrolling; each cell opens a native slot chooser. Demo validation handles past days/elapsed slots, completed sessions and overlapping mock teacher slots; local changes are not persisted. Mobile learner fixture rows are demo data, not this web account's roster. |
| Học viên — `teacher/TeacherStudentsTab.jsx` | **OPENED; empty** | Search placeholder `Tìm họ, tên, SĐT...`, status filters (all/learning/completed/withdrawn), split learner-detail panel. No live records to select. | Existing compact mock list/filter/chat path remains; live profile details cannot be verified with empty web data. |
| Hộp thư — `Inbox.jsx` | **OPENED** | Search, all/student/Admin/recruitment/support/group filters, offline contacts, start-conversation empty state and “Tạo nhóm chat” dialog with name, member search and multi-select. Conversation UI includes message search, profile details, image/file/screen-capture controls and emoji/sticker/GIF. | Mobile now provides a local-only group dialog/name/member selection; existing mock message controls remain. No send, upload, capture, Socket.IO or durable group creation. |
| Bảng tin — `FeedBoard.jsx` | **OPENED** | Existing posts and composer; privacy menu: public, teachers/Admin only, or students/Admin only; image picker (up to six); comments/reactions. | Mobile has local composer/audience/posts. Real media, nested comments, edit/delete, pagination and realtime remain unimplemented; no post/reaction submitted during test. |
| Bài tập & trắc nghiệm — `TeacherAssignmentsView.jsx`, `teacher/TeacherQuizManager.jsx` | **BLOCKED by live data loading** | Route stayed at “Đang tải lớp / khóa học…” despite waiting; 502/503 resource failures were observed. Source inspection had already identified course/recipient/deadline/submission/grading and multi-question quiz controls. | Existing mobile forms remain demo-only and represent course/recipient/deadline and quiz timing/questions. This does not establish web runtime parity; no upload, AI, Excel, API or socket integration. |
| Đào tạo — `TeacherFinanceAndTraining.jsx` | **OPENED; empty** | Internal center-training categories: courses, processes, documents and software; current account showed zero items. | Mobile retains these existing four categories; no videos/files/admin notices were available in the live dataset to compare. |
| Tài chính — `TeacherFinanceAndTraining.jsx` | **OPENED at 490px; empty** | “Tài chính & Hoa hồng”; received/pending/sessions totals; monthly income chart; summary PDF/CSV and learner-detail PDF/CSV; transfer-history filters. Live account showed 0đ/0 sessions and no transactions. User-supplied screenshot shows the same page structure with different values; those values were not copied into generic mobile mocks. | Mobile chart/report groups now follow the responsive web structure. Existing values are still fixture-only; export buttons show a demo notice and never create/download a file. |
| Tin tức — `NewsPage.jsx` | **OPENED** | Search, grid/list toggles, topic, sort and time controls; two article cards loaded. | Existing mobile search/topic/sort/time/list-grid controls remain mock-only. |
| Thông tin Trung tâm — `CenterInfoPage` | **OPENED; content unavailable** | Sections: overview, staff, branches, social media, training services, exam locations and certificates. Page stated content was being updated. | Mobile section menu was updated to the same seven source-backed names; each section stays empty/demo instead of inventing content. |
| Hồ sơ — `teacher/TeacherProfileTab.jsx` | **OPENED** | Hero/status/specialties; password action; personal fields, bank information, separate edit controls and account status (test score, pay/session, join date). | Mobile now separates personal, payment and status sections with source-aligned field labels. Unknown fixture values stay `—`; edits/password remain local or website-only. |
| Thông báo — `NotificationCenterPage.jsx` | **OPENED** | Notification panel and full list; 4 unread / 4 total for the test account; all/unread filter; mark-read, hide and “read all” controls. No notification was changed. | Existing local notification list/filter/detail remains. Real pagination, deep links, QA response and push/realtime are not connected. |

The assignment/quiz form details not observable in the runtime were checked against local web source; the report explicitly marks the runtime blockage rather than treating source review as a successful interaction test.

## Navigation and reachability

- The five existing Teacher tabs are unchanged; no Drawer or hamburger was added.
- Home quick actions link to attendance, grading, inbox, and schedule actions.
- Home shortcuts and the role-based function menu expose Feed, Assignments/Quizzes, Training, Finance, News, and Center Info.
- Profile links to the role menu and Center Info. The Home notification bell opens the full Notifications screen.
- Quiz and homework screens link to one another with the requested labels; the active homework tab is indicated on the assignment list.

## UI changes made in this pass

- Refined Teacher Home copy and kept unavailable KPI values as `—`.
- Added Teacher schedule summaries, week navigation, status filters and compact lesson details; added fixture dates/learner names only to existing Teacher schedule fixtures.
- Compactened Teacher student rows and aligned search wording; missing last-access data remains `—`.
- Expanded Teacher inbox filters and added local chat sticker/status affordances while guarding them from the Student conversation UI.
- Added a Teacher-only feed composer and local post interactions; Student Feed presentation remains on its pre-existing simplified path.
- Added Teacher quiz management fields/actions, training section tabs, finance summary/history/export notices, news controls, Center Info sections and profile fields.
- Added Teacher notification category filtering and mock related-action feedback.
- Adjusted the Teacher assignment header/tab arrangement for clearer small-screen hierarchy.
- Compared Teacher flows against local web source. Added mock-only homework course/recipient/deadline fields and quiz course/recipient/timing/multi-question fields, keeping uploads, AI, Excel, API and delivery disabled.
- Tested the authenticated local Teacher web UI without submitting data. Applied the observed schedule diary/week controls, inbox group creation affordance, profile/bank/status sections, finance chart/report grouping and the source-backed Center Info categories to the mobile mock UI.
- Reworked the Teacher weekly schedule to match the web's student-by-seven-dates grid rather than a selected-day roster. Added per-date sort, A–Z/Z–A, studying/completed/all filters, week navigation, and cell-based time selection through a native modal. Slot choices are 90 minutes starting every 30 minutes from 07:00; demo checks reject past/elapsed slots, completed sessions and overlapping mock teacher schedules. Changes/removals stay in component state only.
- Removed the extra Teacher standalone class list and arbitrary create/edit fields from the schedule screen; the web's scheduling action is a slot in the weekly roster grid. The live web account had an empty eligible roster, while the mobile preview still renders explicit demo fixtures.

## QA and validation

| Check | Result | Evidence / limitation |
|---|---|---|
| Teacher screens reviewed | **14 mobile routes/screens** | Home, Schedule, Students, Inbox, Conversation, Feed, Assignments, Quizzes, Training, Finance, News, Center Info, Profile and Notifications. |
| Actual local Teacher web runtime | **PARTIAL** | Login and non-destructive UI review succeeded. Assignments/quiz route was blocked by a persistent loading state and intermittent server resource errors; no mutation actions were submitted. |
| Expo Web route smoke | **PASS** | Teacher demo login succeeded. Schedule, inbox/group creation, profile and finance screens were rechecked after this update; previous route smoke covered notification bell and conversation navigation. |
| Updated mock-only flows | **PASS (Expo Web only)** | Reloaded into the Teacher demo, opened the seven-day schedule grid, changed an existing mock cell from 18:00 to 20:00 in local screen state, and opened a second learner's same-day slot to confirm overlapping choices are disabled. The modal showed 90-minute choices. Did not test clearing or submit to any service; no network/backend call was added. |
| Current continuation smoke | **PASS (Expo Web only)** | Teacher Home, Schedule and Feed rendered; the Feed was not submitted. Schedule-backed attendance listed fixture sessions, allowed a local status choice and enabled the demo-save affordance. No real write was performed. |
| Responsive width smoke | **PASS (web previews only)** | Mobile Expo finance page had no body/document horizontal overflow at 320, 360, 390, 430, 490 and 768 px. The final Teacher seven-day grid also measured no document/body overflow at 320, 360, 375, 390, 412, 430 and 768 px; the grid itself intentionally scrolls horizontally like the web timetable. Authenticated web main content had no horizontal overflow at 320, 360, 390, 430, 490 and 768 px. This is not native-device validation. |
| Visual reference comparison | **PARTIAL** | Compared the Teacher finance layout against the user-provided mobile screenshot and authenticated web rendering at 490 px. Structure aligns; the test account displayed zero balances/no transactions unlike the supplied screenshot, so those screenshot values were not copied. Other screens were not screenshot-compared. |
| Keyboard and safe area | **NOT RUN natively** | Expo Web smoke is not evidence of Android/iOS keyboard, status bar, navigation bar or home-indicator behavior. |
| Android native | **NOT RUN** | No Android device/emulator test was run. |
| iOS native | **NOT RUN** | iOS native testing is unavailable in this Windows environment. |
| TypeScript | **PASS** | `npm run typecheck` (`tsc --noEmit`). |
| Expo dependency compatibility | **PASS** | `npx expo install --check` — dependencies are up to date. |
| Diff whitespace | **PASS** | `git diff --check`. |

## Mock and integration status

- The screen data continues to come from existing mock services/fixtures and local component state.
- No production endpoint, authentication token, backend request, Socket.IO connection, push provider, real upload/download, payment action, or native exam implementation was added.
- No dependency was installed or upgraded.
- No website or backend source was changed.
- Shared screens were guarded so the new Teacher-only composer, news controls, chat sticker/status presentation, notification category controls and Center Info presentation do not redesign Student flows.

## Remaining parity work

1. Compare the remaining mobile screens against responsive Teacher screenshots; only the finance reference was available and compared in this pass.
2. Review and correct visual differences against those references; web viewport checks establish absence of page-level horizontal overflow, not full visual parity.
3. Continue confirming remaining Teacher-specific labels, filters, section order and action details against responsive web screenshots; the schedule still differs in native cell-picker presentation and the live account has no roster data for direct value comparison.
4. Verify the web's overdue attendance makeup-request modal against an eligible fixture; the current mobile attendance screen only simulates a request locally and intentionally does not send messages or mark attendance on a server.
5. Keep unavailable server-backed fields as `—`; do not replace them with invented metrics.
6. Run Android/iOS device checks for safe area, keyboard, back navigation, touch targets and native text wrapping before claiming native readiness.
7. Keep all backend/API/auth integration disabled until separately approved.

## Readiness

**TEACHER MOBILE UI STILL NEEDS PARITY WORK**

The core UI routes render and web-preview checks found no page-level horizontal overflow, but most screens remain partial mock implementations, assignments/quizzes could not be exercised in the live web runtime, screenshot comparison was limited to finance, and native device testing was not run. This is not a production-readiness or backend-integration approval.
