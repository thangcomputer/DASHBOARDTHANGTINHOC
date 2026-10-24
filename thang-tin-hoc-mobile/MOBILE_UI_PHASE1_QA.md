# Mobile UI Phase 1 — QA, Device Test & Dependency Audit

**Phạm vi:** rà soát prototype React Native/Expo cho Student/Teacher, đối chiếu UI với source web, chỉ dùng mock. Không kết nối API/auth thật, MongoDB, Redis, Socket.IO, push, payment hoặc exam; không bật `MOBILE_MULTI_SESSION_AUTH`. Không sửa website/backend.

**Lưu ý cập nhật:** Các kết quả giai đoạn ban đầu bên dưới được giữ làm lịch sử; phần 20 là QA parity mới nhất và thay thế các số lượng/gap cũ ở những mục trước.

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
- The Prompt 11 closure and current UI-only classification are in `MOBILE_PARITY_SCREEN_MATRIX.md`: Student 23 ALIGNED / 0 PARTIAL / 1 WEB-ONLY; Teacher 30 ALIGNED / 0 PARTIAL / 1 WEB-ONLY.
- All 22 concrete UI gaps from the previous matrix were implemented and reclassified; no current row is PARTIAL or MISSING.
- Backend persistence, live data, upload/download, export and native QA remain separate from UI classification.
- Student/Teacher exams remain **WEB-ONLY TẠM THỜI**. This includes attempts, camera/proctor/fullscreen behavior and certification exam player.
- Mock values remain local demo data; they are not production account data.
- The mobile grade-history view aggregates web-visible grade/progress information from overview, student and assignment surfaces; it does not claim a separate web route.
- Local attendance choices and demo profile/sign-out remain backend limitations, not UI/UX parity gaps.
- Route review found no orphan or wrong-role route in the registered role-gated stack/menu inventory. Unknown notification destinations remain on safe notification detail.

## 17. Screenshots / test notes

Visual inspection was performed through the integrated browser. Browser checks exercised Student/Teacher login, Student Learning, Teacher assignment detail and four viewport widths. No image artifact was saved. Browser QA is not represented as Android/iOS evidence.

## 18. Recommendation before API integration

1. Keep the two explicitly WEB-ONLY exam/onboarding flows on the web until a separate native design and device POC are approved.
2. Run native Android and iOS smoke tests separately, specifically keyboard/composer, safe areas, back navigation, touch targets and font scaling.
3. Assess Expo CLI dependency advisories through a compatible Expo SDK maintenance path before release; do not use the suggested Expo 44 downgrade or forced audit fix.
4. Do not begin backend integration as part of this UI parity task.

## 19. Readiness

**`MOBILE UI/UX PARITY READY`** — current matrix: 53 ALIGNED, 0 PARTIAL, 0 MISSING, 2 WEB-ONLY. Backend remains `NOT CONNECTED`; Android/iOS native QA remains `NOT RUN`, and neither status is used to determine the UI parity result.

This is a web-to-mobile UI/UX classification, not a production-readiness statement.

## 20. Prompt 11 parity closure QA

### Results

- Student: 23 ALIGNED, 0 PARTIAL, 1 WEB-ONLY.
- Teacher: 30 ALIGNED, 0 PARTIAL, 1 WEB-ONLY.
- Previous PARTIAL rows moved to ALIGNED: 22.
- WEB-ONLY remains Student exam/certification attempts and Teacher onboarding test.
- Backend connected: **NO**. Website/backend modified: **NO**. Dependency files changed: **NO**.
- Android/iOS native QA: **NOT RUN**.

### Flows exercised in Expo Web

- Teacher chat: local GIF picker selection and sent-state rendering.
- Teacher feed fixture: older-post pagination, threaded reply and locally created owned post with edit/delete controls.
- Student assignment: file picker, selected-file state, demo submit and submitted/disabled state.
- News fixture: search/topic/sort/period and list/grid controls; author/excerpt and attachment detail rendering.
- Teacher quiz form: course-based targets, learner search, select-all-visible and clear selection.
- 25-item notifications: page 1/page 2 (20 + 5) and category controls.
- Student Profile/Tuition: `student-profile-populated` shows multiple explicitly labelled QA-only enrollments, tuition amounts and paid/pending video orders; payment confirmation updates only local UI state. Default mode displays no fixture amounts/orders, uses `—` for unknown tuition and shows the empty video-order state.
- Student grade history: `grades-completed` shows explicitly labelled QA-only results; default mode returns no grade records.
- Student Profile/Tuition and payment confirmation modal: default and populated QA states at 320/360/375/390/412/430/768 CSS px; document/body widths matched every viewport.
- Password form: mismatch error and local matching-password completion.
- Responsive widths 320/360/375/390/412/430/768 CSS px: Feed, NewsDetail and Conversation document/body widths matched the viewport.
- `npm run typecheck`: **PASS**.
- `npx expo install --check`: **PASS** — dependencies up to date.
- `git diff --check` and explicit trailing-whitespace scan of edited mobile source/docs: **PASS**.
- Full all-screen responsive traversal and all-55-row screenshot comparison: **NOT RUN**.

QA monetary values, enrollments and scores are isolated behind `EXPO_PUBLIC_MOBILE_UI_QA_STATE` and are not part of the default Student mock account.

The final summary and classifications are maintained in `MOBILE_WEB_UI_UX_FINAL_AUDIT.md`.
