# Mobile UI Phase 1 — QA, Device Test & Dependency Audit

**Phạm vi:** rà soát prototype React Native/Expo cho Student/Teacher, đối chiếu UI với source web, chỉ dùng mock. Không kết nối API/auth thật, MongoDB, Redis, Socket.IO, push, payment hoặc exam; không bật `MOBILE_MULTI_SESSION_AUTH`. Không sửa website/backend.

## 1. Screens reviewed

### Mobile prototype screens

- Login demo và chọn Student/Teacher
- Student: Home, Schedule/detail/confirm, Assignments/submission, Materials/SoftwareLinks, Notifications/filters, Messages/Conversation, Grades, Profile/edit, StudentLearning/LearningLesson, Evaluations, Feed, News/NewsDetail, CenterInfo, Tuition
- Teacher: Home, Schedule/create/edit/cancel, Students/search/filter/detail, Attendance, Assignments/create/submissions/grading, TeacherQuizzes, TeacherTraining, TeacherFinance, SoftwareLinks, Messages/Conversation, Profile/edit, Feed, News/NewsDetail, CenterInfo
- Student/Teacher bottom tabs, navigation stack, back navigation

### Web source checked for function parity

- `client/src/components/AppSidebar.jsx`: Student/Teacher menu labels and destinations
- `client/src/App.jsx`: role routes for dashboards, inbox, notifications, feed/news, center info, student exam/cert prep/lesson practice and teacher test/finance
- `client/src/components/StudentDashboard.jsx` and `student/StudentOverviewTab.jsx`
- `client/src/components/student/StudentScheduleTab.jsx`, `StudentMaterialsTab.jsx`, `StudentEvaluationTab.jsx`, `StudentProfileTab.jsx`
- `client/src/components/TeacherDashboard.jsx` and `teacher/TeacherOverviewTab.jsx`
- `client/src/components/teacher/TeacherScheduleTab.jsx`, `TeacherStudentsTab.jsx`, `TeacherProfileTab.jsx`
- `client/src/components/TeacherAssignmentsView.jsx`, `TeacherFinanceAndTraining.jsx`, `TeacherTrainingLMS.jsx`

The authoritative function-to-screen status table is in the **WEB → MOBILE FUNCTION PARITY** section of `MOBILE_UI_PHASE1.md`. Admin/Staff functions are out of mobile scope.

## 2. UI issues found and fixed

- Replaced the text-glyph back affordance with a consistent native chevron button; screens with parent navigation now have a visible back affordance.
- Made the tab bar account for bottom safe-area inset and enlarged important icon/button hit areas to at least 44 points where applicable.
- Added semantic status text for schedule status badges; attendance choices are labelled and no longer depend only on color.
- Reordered Student Home to put next class first, then course progress, pending assignment, important unread notification, and quick actions. Teacher Home now puts today's teaching schedule first, then next class/overview, students needing attention and grading queue.
- Removed the Teacher-only “new materials” promotion from Teacher Home; that card was not a Teacher web function.
- Replaced fixed “3 submissions waiting” demo text with a count derived from mock assignments. Empty assignments/students/notifications/schedule states now have explicit copy.
- Search, conversation and status controls have clearer accessibility labels. Chat scrolls to the latest message and the send control is disabled for an empty draft.
- Added a development-only mock service state switch for loading, empty and error displays; no network calls are made.
- Added mock-only lesson catalog/detail, evaluation forms, feed/news/detail, center-information sections, student tuition status, software links, teacher quiz authoring/results, training contents and finance summary.
- Added role-specific schedule and assignment actions, student enrollment filters/details, notification read filters, profile edit fields, and local conversation reply/reaction/pin/recall/sample attachment controls.
- Kept exam/certificate attempts and the teacher entry test on web with an explicit WEB-ONLY notice; no camera/proctor/native exam was added.

## 3. Android result

**Android native test: NOT RUN.**

Checked for `adb`, `emulator` and the standard local Android SDK `platform-tools/adb.exe`; none was available. No Android Studio/SDK was installed, as requested. No device or emulator was attached. Expo Web validation is not an Android result.

## 4. iOS result

**iOS native test NOT RUN.**

The environment is Windows and no iOS simulator/device was available. No unsupported tooling installation was attempted.

## 5. Expo Web result

**Expo Web: PASS (UI smoke test only).**

- Started Expo Web on `http://localhost:8081`.
- Completed Student and Teacher demo login flows and opened role-specific menus.
- Confirmed Student Learning catalog content and Teacher assignment/submission/grading detail render.
- Verified document/body width at viewport widths 320, 375, 430 and 768 CSS px; each matched the viewport width on the page tested.
- Confirmed five visible bottom tabs per role in the current prototype.
- Checked stack back navigation and role-specific menu destinations in browser accessibility snapshots.
- Expo Web is only a browser preview and does not verify native status/navigation bars, native keyboard, touch handling or device rendering.

## 6. Keyboard result

**Native keyboard: NOT RUN.**

Web preview accepted text in login and chat inputs and completed sending a chat message. That does not simulate the Android/iOS keyboard, input resize/pan behavior, native keyboard dismissal or whether a native composer stays visible. Login uses `KeyboardAvoidingView` and scrollable form; Conversation uses `KeyboardAvoidingView` and a scrollable thread, but device verification remains required.

Search inputs rendered and accepted text in the web preview. Search keyboard/IME behavior on device remains unverified.

## 7. Safe-area result

**Native safe-area: code review PASS; device visual verification NOT RUN.**

- App root wraps screens in `SafeAreaProvider`.
- Screen content uses safe-area context for the top edge.
- Login uses top and bottom safe-area edges.
- Bottom tab bar height/padding includes the safe-area bottom inset.

Native status bar, home indicator, gesture navigation and keyboard/modal interactions must still be checked on physical/simulator devices.

## 8. Responsive result

**Expo Web viewport checks: PASS; native device layouts NOT RUN.**

The Teacher Home root document did not overflow horizontally at 320, 375, 430 and 768 CSS px. Student screens were traversed at 320 px and had no observed horizontal overflow in the browser smoke run. This does not replace native small/large-device testing, font scaling or landscape testing.

## 9. Navigation result

**Expo Web: PASS for routes exercised.**

- Student tabs: Trang chủ, Lịch học, Tin nhắn, Thông báo, Cá nhân.
- Teacher tabs: Trang chủ, Lịch dạy, Học viên, Tin nhắn, Cá nhân.
- Stack destinations used by quick actions and profile resolve; back navigation returned to the prior screen.
- The current prototype includes additional stack screens (e.g. Grades, Materials, Assignments, Attendance); parity to the actual web function is not implied by reachability.
- Newly added menu destinations are reachable through the role-specific “Danh mục theo vai trò” entry from Profile; remaining gaps are listed in `MOBILE_UI_PHASE1.md` and the parity completion report.

## 10. Accessibility result

**Partial improvement; device screen-reader audit NOT RUN.**

- Important icon-only actions (back, notifications, password visibility, attach, send) have labels.
- Chat composer send state exposes disabled state; progress exposes an accessible label/value.
- Notification items and attendance status controls expose labels/state.
- Status badges include words, not color alone.
- No TalkBack/VoiceOver audit was possible in this environment.

## 11. Mock architecture status

**PASS — local mock only.**

- `src/services/mockService.ts` returns local mock data; it never performs HTTP, socket, database or storage operations.
- QA loading/empty/error mode is gated by `__DEV__` and the development variable `EXPO_PUBLIC_MOBILE_UI_QA_STATE`; it does not select a production behavior or make network requests.
- Named UI fixtures use the same development-only variable. Restart Expo after selecting a state; all fixture data remains local:

| State | QA focus |
|---|---|
| `attendance-pending`, `attendance-overdue` | Teacher attendance within the grace window and overdue makeup-request modal |
| `notification-25-items` | Pagination at 20 entries/page, unread/read filters and category behavior |
| `evaluation-not-eligible`, `evaluation-eligible`, `evaluation-existing`, `evaluation-course-ended` | Below/at eligibility threshold, previously saved rating/edit and course-end lock |
| `assignment-submitted`, `assignment-graded` | Student homework status, score and teacher feedback |
| `grades-no-grade`, `grades-completed` | Empty and completed learning/grade progress |
| `chat-empty`, `chat-group`, `chat-unread` | Empty inbox and Teacher group/unread conversation subsets |
| `quiz-empty`, `quiz-draft`, `quiz-results` | Empty, draft and populated quiz result states |
| `finance-empty`, `finance-populated` | Empty and populated finance transaction lists |
| `feed-empty`, `feed-multiple`, `news-empty`, `news-multiple` | Empty and multi-item feed/news states |

- This sweep runtime-tested notification pagination, overdue attendance, Student Profile and all three evaluation branches (not eligible, existing rating, course ended). Other named fixtures are available for follow-up QA but were not all traversed in the browser.
- No `fetch`, Axios client, production API URL, Socket.IO, WebSocket, push, payment, native exam or camera integration was added.
- Login and sign-out remain demo-only.

## 12. Dependency audit

`npm audit` reports **5 High**, 0 Critical, 0 Moderate and 0 Low. `npm audit --omit=dev` also reports the same toolchain dependency paths.

| Package | Severity | Direct / transitive | Affects mobile runtime? | Fix available | Breaking risk |
|---|---|---|---|---|---|
| `expo` | High | Direct package; advisory is through nested `@expo/cli` | The listed vulnerability path is Expo CLI/tooling rather than the app's screen/runtime logic; Expo SDK remains a core project/build dependency | npm's suggested fix is `expo@44.0.6` | **High / unacceptable**: would downgrade across many SDK generations and break current SDK compatibility |
| `@expo/cli` | High | Transitive, under `expo` | Development/build tooling, not shipped app UI runtime | No safe compatible fix identified by npm; suggested Expo downgrade | **High**: suggested route is a major Expo downgrade |
| `@expo/code-signing-certificates` | High | Transitive under Expo CLI | Toolchain/signing utility; no evidence of use by app runtime | No safe compatible fix identified by npm | **High/unknown**; do not override Expo's dependency graph without compatibility evidence |
| `node-forge` | High | Transitive under Expo CLI and code-signing certificates | Toolchain dependency; no direct app import | Advisory says affected versions `<=1.4.0`; npm does not offer a non-breaking compatible graph fix | **Unknown**: forced transitive override may affect CLI/signing behavior |
| `zod` | High | Transitive under Expo CLI | Toolchain dependency; no app runtime import found | Advisory range `<4.6.6`; npm's proposed resolution is an Expo downgrade | **High/unknown**: changing major transitive version without Expo support is not safe |

### Vulnerability advisories and decision

- `node-forge`: GHSA-86w9-cpqp-85rv — RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements.
- `zod`: GHSA-mrhx-c7xc-m3w5 — potential memory exhaustion when validating oversized constrained collections.
- `npm ls expo @expo/cli @expo/code-signing-certificates node-forge zod --all` traces the vulnerable packages beneath Expo CLI; no direct import from app source was found.
- `npm audit fix` proposes installing `expo@44.0.6` and explicitly identifies that as a breaking change. No audit fix, forced downgrade, package override, or dependency change was made.
- `expo` is a direct manifest dependency and is included in npm's vulnerability record, but the vulnerable paths shown by npm are its nested CLI/toolchain packages. No vulnerable direct HTTP, chat, payment, or native camera runtime dependency was identified.

## 13. Packages changed

**None.** `package.json` and the mobile lockfile were not changed during QA. No package install or audit remediation was performed for this task.

## 14. TypeScript

**PASS:** `npm run typecheck` (`tsc --noEmit`).

## 15. Expo dependency compatibility

**PASS:** `npx expo install --check` reports dependencies up to date/compatible with the current Expo SDK.

## 16. Remaining UI issues and parity gaps

- Native Android and iOS layout/keyboard/safe-area/back behavior remains unverified.
- The parity matrix identifies web functionality that remains partial. Important gaps include actual video/LMS progress, enrollment-based schedule and learner data, file upload/download, result/grade history, evaluation milestones, feed/news/center content, attendance gates, complete quiz authoring/results, training media, finance records and profile persistence.
- Student/Teacher exams remain **WEB-ONLY TẠM THỜI**. This includes attempts, camera/proctor/fullscreen behavior and certification exam player.
- Mock values and copy are illustrative and do not come from the live website/backend; review the parity matrix before treating data/content as approved.
- The Teacher mobile screen named `Grades` is not confirmed as an independent web screen; the web's related grades/progress are distributed across overview, students and assignments.
- Local attendance choices and demo profile/sign-out are not equivalent to web business actions.
- The development error fixture uses a generic error state; individual screens' recovery and state transitions should be checked on device after UI scope is approved.

## 17. Screenshots / test notes

Visual inspection was performed through the integrated browser. Browser checks exercised Student/Teacher login, Student Learning, Teacher assignment detail and four viewport widths. No image artifact was saved. Browser QA is not represented as Android/iOS evidence.

## 18. Recommendation before API integration

1. Review and approve the WEB → MOBILE FUNCTION PARITY status table in `MOBILE_UI_PHASE1.md`; decide which web gaps belong to a later UI phase.
2. Keep exam and proctor flows on web until a separate native design and device POC are approved.
3. Run native Android and iOS smoke tests on supported devices, specifically keyboard/composer, safe areas, back navigation, touch targets and font scaling.
4. Assess the Expo CLI dependency advisories through a compatible Expo SDK maintenance path before release; do not use the suggested Expo 44 downgrade or forced audit fix.
5. Only after UI and authentication integration are explicitly approved, plan a separate API integration phase.

## 19. Readiness

**UI NEEDS MORE WORK before backend integration.**

The implemented mock prototype typechecks and passes Expo Web smoke checks, but it is not parity-complete with the current web app, has unresolved Expo toolchain High advisories, and has not been tested on native Android/iOS devices. This is not a production-readiness statement.
