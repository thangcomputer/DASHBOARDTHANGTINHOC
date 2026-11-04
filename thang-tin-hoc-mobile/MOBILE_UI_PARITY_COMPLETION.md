# Mobile UI — Web Parity Work Completion

## Scope and safety

- Continued the existing Expo project; no navigation, shared UI, theme, or mock-service foundations were removed.
- Implemented UI/navigation and local fixtures only. Authentication API, website API, MongoDB, Redis, Socket.IO, push, payment, file upload/download, camera, and exam attempts remain **OFF**.
- `MOBILE_MULTI_SESSION_AUTH` remains disabled.
- No website/backend, database, `.env`, package manifest, or lockfile was changed. No package was installed or updated. No commit, push, or deploy was performed.
- Admin/Staff remains outside this mobile phase.

## Student screens and flows reviewed

| Web function | Mobile surface | Current parity |
|---|---|---|
| Tổng quan | Home | Partial: next class, course progress, assignment, unread notice and role-appropriate shortcuts use local mock data. |
| Hộp thư | Messages, Conversation | Partial: local inbox/search/thread, reply, reaction, pin, recall and sample attachment affordance; no server state or realtime. |
| Video khóa học / luyện tập | StudentLearning, LearningLesson | Partial: course → unit → lesson hierarchy, progress, locked/completed states and placeholder lesson detail; no real video player or LMS progress gate. |
| Lịch học | Schedule | Partial: filters, detail and local attendance confirmation; enrollment history, note/feedback and web-sourced schedule data remain absent. |
| Bài tập, tài liệu, phần mềm | Assignments, Materials, SoftwareLinks | Partial: filters/details, local submission status, material list and software list; no file transfer or live submission. |
| Kết quả / điểm thi | Grades | Partial: displays mock course/lesson progress. Exam scores and history remain on web. |
| Đánh giá giảng viên | Evaluations | Partial: private/public mock form and a public-review half-course threshold. Full web milestones/eligibility and persistence remain absent. |
| Bảng tin | Feed | Partial: mock post, local comment and reaction controls; no feed permissions or media integration. |
| Tin tức | News, NewsDetail | Partial: local list/search/detail; no live content or attachment access. |
| Liên hệ Trung tâm | CenterInfo | Partial: center overview and section inventory; published content and section detail navigation are not connected. |
| Hồ sơ / học phí | Profile, Tuition | Partial: local profile edit fields and a tuition route. Payment and profile persistence are not enabled. |
| Thông báo | Notifications | Partial: local all/unread/read filters and read state; no synchronized state or target navigation. |
| Thi / chứng chỉ | MobileMenu notice | **WEB-ONLY TẠM THỜI**. No attempt, camera, proctor, fullscreen, or exam session is implemented. |

## Teacher screens and flows reviewed

| Web function | Mobile surface | Current parity |
|---|---|---|
| Tổng quan | Home | Partial: today's schedule, next class, students needing attention, grading queue and shortcuts are mock-driven. |
| Hộp thư | Messages, Conversation | Partial: same local mock controls as Student; no server state or realtime. |
| Lịch dạy | Schedule | Partial: filters/detail and local create/edit/cancel; calendar, time-gated check-in and web confirmation rules remain absent. |
| Quản lý học viên | Students | Partial: search by name/phone, enrollment-status filter, progress/attendance detail, local note and message shortcut. Permissions and complete web actions remain absent. |
| Điểm danh | Attendance | Partial: local status choices; no check-in time gate, reason workflow, or completion confirmation. |
| Giao bài / chấm bài | Assignments | Partial: create mock assignment, list submissions, local grade/feedback; no actual enrollment assignment or file workflow. |
| Trắc nghiệm theo buổi | TeacherQuizzes | Partial: mock quiz list/results and local single-question authoring. No student attempt, automatic scoring, live question bank or full web authoring. |
| Khóa đào tạo | TeacherTraining | Partial: mock course progress, lessons, files and notices; no video/LMS service. |
| Tài liệu/phần mềm | SoftwareLinks | Partial: local category/name/description list; no external URL launch or downloads. |
| Tài chính | TeacherFinance | Partial: synthetic period summary/list; no authoritative payment data or transactions. |
| Bảng tin / Tin tức / Trung tâm | Feed, News/NewsDetail, CenterInfo | Partial: local mock presentation and interactions only. |
| Hồ sơ | Profile | Partial: local Zalo/age form; password/account-sensitive changes remain on web. |
| Bài kiểm tra đầu vào | MobileMenu notice | **WEB-ONLY TẠM THỜI**. |

## Navigation and mock architecture

- Bottom tabs remain at five per role: Student uses Home, Schedule, Messages, Notifications, Profile; Teacher uses Home, Schedule, Students, Messages, Profile.
- Additional functions are stack destinations listed under Profile → “Danh mục theo vai trò”; no role-specific module was added to the tab bar.
- New domain fixtures are served through `src/services/mockService.ts`; screens do not import mock arrays directly.
- Mock state-changing controls are local to the screen/session and explicitly labeled as demo. No backend URL or production data is present.
- Mobile screen labels/actions follow the web inventory; layout uses native lists/cards and stack detail screens rather than reproducing desktop tables/sidebar.

## Validation

| Check | Result | Notes |
|---|---|---|
| TypeScript | **PASS** | `npm run typecheck` (`tsc --noEmit`) |
| Expo dependency compatibility | **PASS** | `npx expo install --check` |
| Expo Web | **PASS — smoke only** | Student/Teacher demo login, Student Learning catalog, Teacher assignment/submission detail and stack navigation rendered. |
| Responsive browser viewport | **PASS — limited** | Browser document/body width matched viewport at 320, 375, 430 and 768 CSS px for the screen checked. |
| Android native | **NOT RUN** | No local Android SDK/ADB or attached device; no large SDK/tool installation attempted. |
| iOS native | **NOT RUN** | Windows environment; no iOS simulator/device available. |
| Native keyboard/safe area/touch/back | **NOT RUN** | Expo Web does not establish native-device behavior. |
| Backend/API/database/socket/push/payment/exam | **OFF** | Source review found no added network client/API invocation. |
| Package changes | **None** | No dependency or lockfile changes. |
| `git diff --check` | **PASS** | Checked after edits. |

## Dependency audit carry-over

The existing QA audit reports **5 High** findings: `expo`, `@expo/cli`, `@expo/code-signing-certificates`, `node-forge`, and `zod`. The reported paths are Expo CLI/toolchain transitive dependencies; `expo` is a direct manifest dependency but the cited vulnerable path is in its CLI tree. The npm-suggested Expo downgrade is incompatible with the current SDK generation. No safe Expo-compatible remediation was established, so no audit fix/force, override, downgrade, or package change was made. See `MOBILE_UI_PHASE1_QA.md` for the recorded package path/advisory analysis.

## Remaining gaps

- This is not full function parity: every partial row above still needs validation against exact current web behavior and role/enrollment permissions.
- Mock fields and values are synthetic; they are not copied from a live website session or backend records.
- Video playback/progress, real schedule and attendance rules, full evaluation milestones, file transfer, result history, feed/news/center content, quiz authoring/results, finance and profile persistence require further product/API decisions.
- Android and iOS native rendering, keyboard, safe-area, back gesture, touch targets and accessibility still require device testing.
- Exam/certification attempts and camera/proctor functions remain web-only pending a separately approved native design and real-device POC.

## Readiness

**UI NEEDS MORE WORK.** The requested parity UI surfaces have been added to the existing mock-only app and typecheck/dependency compatibility pass, but this work does not establish full web parity, native-device readiness, backend readiness, or production readiness. Stop here; no API integration or feature work beyond the approved web inventory was started.
