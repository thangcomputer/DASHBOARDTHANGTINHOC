# Web → Mobile UI/UX Parity Checklist

This checklist is based on current web source inventory and the existing Expo screens. `PARTIAL` means a screen/route exists but full visual or functional UI parity has not been demonstrated. It does not claim backend parity.

## Shared app and navigation

| Requirement | Status | Notes |
|---|---|---|
| Preserve existing Expo project and React Native structure | [x] | Existing `thang-tin-hoc-mobile/` retained. |
| Keep role-specific five-tab navigation | [x] | Student: Home/Schedule/Messages/Notifications/Profile; Teacher: Home/Schedule/Students/Messages/Profile. |
| Keep other features accessible through stack, quick actions or role menu | [x] | Routes/screens exist; do not treat presence alone as full parity. |
| Keep Admin/Admin Staff out of current mobile scope | [x] | Inventory only; `WEB-ONLY CURRENT SCOPE`. |
| No real API/auth/database/Redis/Socket.IO/push/payment | [x] | Mock-only boundary. |
| No native exam, camera, proctor, real file upload/download | [x] | Student exams and Teacher onboarding test remain web-only. |
| No unsupported sample values presented as real KPIs | [ ] | Audit mock fixtures/screens before parity sign-off; missing values must remain `—`. |
| No mobile-only business module or invented workflow | [x] | Current prototype scope is based on web functions; local demo interactions are not server operations. |

## Student screen checklist

| Screen | Web route/reference | Required UI/flow | Status | Remaining parity work |
|---|---|---|---|---|
| Home / Overview | `/student`, StudentOverviewTab | Enrollment/course selector, progress, next class, unread messages, pending work/resources | `PARTIAL` | Runtime-tested; web-aligned class/KPI/task/material/grade sections implemented in mobile. Account data remains synthetic; exact enrollment metrics and in-progress state are not synchronized. |
| Inbox / Conversation | `/student/inbox`, Inbox | Search, conversation state, messages and supported chat actions | `PARTIAL` | Real data/realtime intentionally off; compare row fields, status and action set with current web source. |
| Course/video learning | `/student/lesson-practice/*`, StudentTrainingLMS | Catalog, course/unit/lesson structure, progress and access states | `PARTIAL` | No playback/progress sync; keep native screen as mock and avoid implying real completion. |
| Schedule | `/student#schedule`, StudentScheduleTab/View | Course filter, weekly schedule, diary filters, session detail and notes | `PARTIAL` | Added monthly KPI cards, week navigation, horizontally scrollable course/day grid, course filter, session detail, local note modal, diary date/status filters and available score/note fields. Re-test and screenshot comparison remain open. |
| Assignments | `/student#materials-assignments` | Assignment list, due date, submission state and detail | `PARTIAL` | No actual file selection/upload/submit or server feedback. |
| Materials/software | `/student#materials-files`, `#materials-software` | File/resource type, course association and open actions | `PARTIAL` | No real download/open; source data remains mock. |
| Grades/exam scores | `/student#exam-scores` | Score, status, history and related course context | `PARTIAL` | Official scores/history are not connected. |
| Exams/certification | `/student/exam`, `/student/cert-prep/*` | Exam category, filter/status and attempt flows | `WEB-ONLY` | Keep inventoried, but no exam/camera/proctor/attempt implementation. |
| Lesson practice | `/student/lesson-practice/*` | Catalog filters, course/unit/lesson progress | `PARTIAL` | No actual purchase/enrollment or progress persistence. |
| Evaluations | `/student#evaluation` | Private/public feedback and milestone eligibility | `PARTIAL` | Separate tabs, source-derived criteria and half-course eligibility are represented; verify visual parity and course-end lock/edit behavior. Submit remains local. |
| Feed/news/center | `/student/feed`, `/student/news*`, `/student/center-info` | Source-aligned labels, content, list/detail and sections | `PARTIAL` | Mock content and actions are not synchronized. |
| Profile/tuition | `/student#profile`, TuitionPaymentModal | Current profile fields, course/payment status and supported actions | `PARTIAL` | No profile update or payment service. |
| Notifications | `/student/notifications` | Read/unread, category, timestamp, detail and destination | `PARTIAL` | Local refresh/read-all/hide/category/detail and category-based navigation added; compare payload-specific destinations. No push. |

## Teacher screen checklist

| Screen | Web route/reference | Required UI/flow | Status | Remaining parity work |
|---|---|---|---|---|
| Home / Overview | `/teacher`, TeacherOverviewTab | Greeting, source labels/KPIs, today’s schedule, notices, shortcuts | `PARTIAL` | Match exact source ordering; do not invent unavailable metrics. |
| Schedule/calendar/attendance | `/teacher#schedule`, TeacherScheduleTab, TeacherTeachingLog, weekly grid | Week schedule, filters, roster, slot selection, edit/cancel, diary, attendance/makeup | `PARTIAL` | Weekly grid and six diary filters present; session-backed attendance detail/status choices open from the diary. Teacher Schedule document/body matched viewport at 320–768 px. Monthly calendar is disabled on current web; makeup flow and nested responsive/UI parity need verification. |
| Students | `/teacher#students`, TeacherStudentsTab | Search, status/enrollment filters, assigned students, profile/actions | `PARTIAL` | Missing web-linked data and editable link/grade/notes actions; absent last access stays `—`. |
| Inbox/chat | `/teacher/inbox`, Inbox | Search, roles, unread, presence, group and thread actions | `PARTIAL` | Several web conversation actions/data and live state are not implemented/synced. |
| Assignments | `/teacher#assignments`, TeacherAssignmentsView | File/homework tab, create form, course/learner target, deadline, submission/grading | `PARTIAL` | Mock flow only; attachments, delivery and real enrollment/submission are unavailable. |
| Quizzes | `/teacher#assignments`, TeacherQuizManager | Quiz tab, create, questions, audience, results, duplicate/delete | `PARTIAL` | AI/Excel and server-backed workflows are absent; no real quiz assignment. |
| Training | `/teacher#training`, TeacherTrainingLMS | Course/process/material/software tabs, lessons and progress | `PARTIAL` | No real media playback or progress synchronization. |
| Finance | `/teacher/finance`, TeacherFinanceAndTraining | Totals, chart, filters, transaction history, detail and exports | `PARTIAL` | Source values are unavailable in demo; no real download/export. |
| News | `/teacher/news*`, NewsPage | Search, topic, sort, time, grid/list, article metadata/detail, permission-sensitive edit | `PARTIAL` | Current mock does not reproduce all permission/status/pagination/editor states. |
| Feed | `/teacher/feed`, FeedBoard | Composer, role/privacy, image, post, comments/replies/reactions, edit/delete | `PARTIAL` | Image/upload and load-more/status actions absent; all interactions local. |
| Center information | `/teacher/center-info`, CenterInfoPage | Title/subtitle, section selector, banner/logo, source-backed content | `PARTIAL` | No runtime center data; unavailable content should not be fabricated. |
| Profile | `/teacher#profile`, TeacherProfileTab | Hero, status, personal fields, bank info, edit/save and password action | `PARTIAL` | Some fields/actions incomplete; changes local and password remains unconnected. |
| Notifications | `/teacher/notifications`, NotificationCenterPage | Unread, filters, categories, time, action/destination | `PARTIAL` | Local refresh/read-all/category/detail/hide and mock routing represented; verify web payload-specific action and pagination behavior. |
| Teacher onboarding test | `/teacher/test`, TeacherTest | Camera check, assessment, practical upload, result/locked states | `WEB-ONLY` | No native attempt, camera, proctoring or upload in mobile. |

## Visual and responsive QA

| Check | Status | Notes |
|---|---|---|
| Web screenshots available for every screen and compared side by side | [ ] | Existing parity docs record source review and limited supplied-reference comparisons, not complete screenshot coverage. |
| Match web naming, sections, card fields, filters, status labels and action order | [ ] | Validate per screen against current source; navigation may remain optimized for mobile. |
| 320, 360, 375, 390, 412, 430, 768 CSS px; no horizontal overflow | [ ] | Student Home passes document/body width checks at all listed widths. Repeat across Student subroutes and Teacher flows before sign-off. |
| Keyboard, safe areas, screen reader and native device behavior | [ ] | Android/iOS NOT RUN; browser preview is not a native result. |
| Unsupported metrics display `—`; empty states use source-appropriate copy | [ ] | Verify on each KPI/list/finance/profile screen. |
| No backend or website files changed | [x] | This report and UI work are mobile-only. |

## Sign-off rule

Do not label a screen `ALIGNED` only because it renders or is reachable. Use `ALIGNED` only after the source-specific visible fields and local UI controls have been compared, appropriate widths are checked, and no material screen/flow gap remains. Backend sync/native behavior are separate and remain out of scope.
