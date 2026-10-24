# Web → Mobile Screen Parity Matrix

## Scope and evidence

- Audit scope: current Student and active Teacher UI in the existing Expo project. The existing five-tab navigation and screen structure are retained.
- Web source is authoritative. Runtime data failures (including 502/503) are not treated as web UI behavior and no authenticated account data is copied into mobile fixtures.
- “Functional UI parity” means that the corresponding mobile UI/control is represented; it does not mean that server-backed actions are live. Mobile remains mock-only.
- Visual parity is marked `PARTIAL` unless the exact web screen has been compared against a reference screenshot at matching responsive sizes. A successful render alone is not visual parity.
- Statuses: `ALIGNED` = verified against the current enabled web UI; `PARTIAL` = screen exists but has known/unverified differences; `MISSING` = web function has no mobile UI; `WEB-ONLY` = explicitly retained in the inventory but not implemented natively.
- Teacher monthly calendar is feature-flagged off in the current web schedule. It is not treated as a missing active web function.

## Student (S01–S24)

| ID | Screen / web function | Web route / source | Mobile screen | Status | Visual parity | Functional UI parity | Remaining difference |
|---|---|---|---|---|---|---|---|
| S01 | Tổng quan học viên | `/student`; `StudentOverviewTab.jsx` | Home | PARTIAL | PARTIAL — hierarchy source-reviewed; screenshot comparison incomplete | PARTIAL — greeting, KPI, actions and schedule/learning summaries use mock | Enrollment-specific values and all web actions are not represented by verified live data. |
| S02 | Lịch học theo tuần | `/student#schedule`; `StudentScheduleTab.jsx`, `StudentWeeklyScheduleGrid.jsx` | Schedule | PARTIAL | PARTIAL — no complete screenshot comparison | PARTIAL — week navigation, course filter, schedule grid and summary | Live schedule, all web filters and small-screen control fit are unverified. |
| S03 | Chi tiết buổi học | `StudentScheduleView.jsx` | Schedule detail | PARTIAL | PARTIAL — native card/modal differs from web | PARTIAL — session details and local confirmation | Confirmation, joining class and status do not persist/sync with web. |
| S04 | Nhật ký học tập / ghi chú | `StudentScheduleView.jsx`, `StudentAttendanceConfirmModal.jsx` | Schedule diary | PARTIAL | PARTIAL — reference comparison incomplete | PARTIAL — local diary/filter/note controls | Web-sourced learning notes, feedback and attendance state are not connected. |
| S05 | Hộp thư | `/student/inbox`; `Inbox.jsx` | Messages | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — search, categories and conversation list | Web conversation data, unread state, permissions and realtime are absent. |
| S06 | Hội thoại | `Inbox.jsx` | Conversation | PARTIAL | PARTIAL — native thread layout differs | PARTIAL — reply, reaction, sticker, attachment placeholder, recall/pin affordances | No server send/read state, actual files or verified complete web action parity. |
| S07 | Khóa học / luyện tập | `/student/lesson-practice/*`; `LessonPracticeCatalogPage.jsx` | StudentLearning | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — course list, filters and progress | Web enrollment/gating and progress are not synchronized. |
| S08 | Cấu trúc khóa / chương | `StudentTrainingLMS.jsx`, `LessonPracticeCatalogPage.jsx` | StudentLearning | PARTIAL | PARTIAL — native cards replace web layout | PARTIAL — units and lessons represented by mock | Course ordering, source content and locked-state rules are not verified end-to-end. |
| S09 | Chi tiết bài học | `StudentTrainingLMS.jsx`, lesson-practice route | LearningLesson | PARTIAL | PARTIAL — placeholder player is not the web player | PARTIAL — lesson detail and local completion action | Real video/player, LMS gate and progress updates are intentionally absent. |
| S10 | Tài liệu học tập | `/student#materials-files`; `StudentMaterialsView.jsx` | Materials | PARTIAL | PARTIAL — exact screenshot comparison incomplete | PARTIAL — material list/filter and category navigation | Download/opening and live material availability are not connected. |
| S11 | Phần mềm khóa học | `/student#materials-software`; `StudentMaterialsView.jsx` | SoftwareLinks | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — source categories/names and empty state | No verified external launch/download behavior or live links. |
| S12 | Bài tập | `/student#materials-assignments`; `StudentMaterialsView.jsx` | Assignments | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — assignment list, deadline/status and local submission state | File upload, submitted content and server state are absent. |
| S13 | Chi tiết / nộp bài | `StudentMaterialsView.jsx` | Assignment detail/submission | PARTIAL | PARTIAL — mobile detail presentation differs | PARTIAL — local submit/detail controls | No actual attachment selection, upload, or web submission confirmation. |
| S14 | Điểm / kết quả học tập | `/student#exam-scores`; `StudentOverviewTab.jsx` | Grades | PARTIAL | PARTIAL — no reference screenshot comparison | PARTIAL — progress/grade presentation | Official exam scores, history and web-specific result actions remain unavailable. |
| S15 | Thi, quiz attempt, chứng chỉ | `/student/exam/*`, `/student/cert-prep/*`; exam-room sources | StudentExam inventory | WEB-ONLY | WEB-ONLY — no native attempt UI | WEB-ONLY — inventory and website-only notice only | Exam attempt, camera/proctoring, fullscreen and official result stay on web. |
| S16 | Bảng tin trao đổi | `/student/feed`; `FeedBoard` | Feed | PARTIAL | PARTIAL — no screen-level screenshot comparison | PARTIAL — post list, comment/reaction affordances | Content, audience rules, image upload and persistence are not connected. |
| S17 | Tin tức | `/student/news`; `NewsPage.jsx` | News | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — search, topic/sort/time and list/grid controls | Live article data, filters and source metadata are unverified. |
| S18 | Chi tiết tin tức | `/student/news/:slug`; `NewsPage.jsx` | NewsDetail | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — local article detail | Live article body, author/media and navigation state are not connected. |
| S19 | Đánh giá Trung tâm / giảng viên | `/student#evaluation`; `StudentEvaluationView.jsx` | Evaluations | PARTIAL | PARTIAL — criteria/form screenshot comparison incomplete | PARTIAL — private/public tabs, source criteria, half-course gate, existing rating/edit, course-end lock and local derived star score; QA verified 4/12 blocked, existing 4.5★ editable, and course-ended locked | Evaluations and edits remain local; current server rating/eligibility is not synchronized. |
| S20 | Thông tin Trung tâm | `/student/center-info`; `CenterInfoPage` | CenterInfo | PARTIAL | PARTIAL — source sections reviewed; screenshot comparison incomplete | PARTIAL — overview and section inventory | Published descriptions, contact data and section details are not available in the mock. |
| S21 | Hồ sơ cá nhân | `/student#profile`; `StudentProfileTab.jsx` | Profile | PARTIAL | PARTIAL — expanded structure is mobile-adapted; screenshot comparison incomplete | PARTIAL — hero KPIs, personal fields, enrolled-course progress, tuition/payment status and video-order empty state are represented; Student Profile rendered and passed overflow checks at 320/360/375/390/412/430/768 px | Payment/order history and account fields remain `—` when mock source has no values; no update persistence; web screenshot comparison incomplete. |
| S22 | Cập nhật hồ sơ / mật khẩu | `StudentProfileUpdateModal.jsx`, `StudentProfileTab.jsx` | Profile edit modal | PARTIAL | PARTIAL — modal layout is mobile-adapted | PARTIAL — email, other phone and address are editable locally; password route is notice-only | Web account update and password action are not connected; no persistence. |
| S23 | Học phí / đơn mua khóa video | `StudentProfileTab.jsx`, `TuitionPaymentModal.jsx` | Tuition | PARTIAL | PARTIAL — source screenshot comparison incomplete | PARTIAL — tuition summary/action is mock-only | Course-linked payment statuses/order history are incomplete; no payment or order API. |
| S24 | Thông báo | `/student/notifications`; `NotificationCenterPage.jsx` | Notifications | PARTIAL | PARTIAL — no screenshot comparison | PARTIAL — read/unread, category, detail, related action, and page controls (20/page); 25-item fixture reached both pages | Local state only; complete destination behavior and screenshot parity remain unverified. |

## Teacher (T01–T31)

| ID | Screen / web function | Web route / source | Mobile screen | Status | Visual parity | Functional UI parity | Remaining difference |
|---|---|---|---|---|---|---|---|
| T01 | Tổng quan giảng viên | `/teacher`; `TeacherOverviewTab.jsx` | Home | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — greeting, immediate tasks, KPI/quick actions and assigned learners | Exact web data and unsupported KPI values are not live; no account values copied into fixtures. |
| T02 | Lịch dạy / xếp lịch tuần | `/teacher#schedule`; `TeacherScheduleTab.jsx`, `TeacherWeeklySlotGrid.jsx` | Schedule | PARTIAL | PARTIAL — no complete responsive screenshot comparison | PARTIAL — week navigation, roster filters/search/sort and slot selection | Slot controls/conflict validation use local mock records; no web persistence. |
| T03 | Lịch tháng | `TeacherScheduleTab.jsx`; `TeacherMonthlyCalendar.jsx` (flag off) | No active mobile screen | ALIGNED | ALIGNED — current web feature disabled | ALIGNED — no active web behavior to reproduce | Revisit only if the web feature flag is enabled. |
| T04 | Nhật ký giảng dạy / bộ lọc | `TeacherTeachingLog.jsx` | Schedule diary | PARTIAL | PARTIAL — mobile list/cards differ | PARTIAL — diary/status controls represented | Exact web filter state and all diary actions are not fully verified. |
| T05 | Điểm danh buổi học | `TeacherTeachingLog.jsx`, `TeacherScheduleTab.jsx` | Attendance | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — schedule-backed student/session selection, overdue state and local status/save; overdue state verified with development fixture | Live schedule/attendance and server save are absent; non-overdue timing edge cases and visual comparison remain. |
| T06 | Yêu cầu điểm danh bù | `TeacherTeachingLog.jsx`, `AttendanceMakeupRequestModal.jsx` | Attendance — overdue-session modal | PARTIAL | PARTIAL — source-informed native modal; direct screenshot comparison incomplete | PARTIAL — session details, one-hour overdue notice, responsibility text, modal cancel/close and local pending state; open/detail/demo-submit path verified | Request is local only and never contacts Admin/student; responsive screenshot comparison and real server approval state are unavailable. |
| T07 | Học viên được phân công | `/teacher#students`; `TeacherStudentsTab.jsx` | Students | PARTIAL | PARTIAL — compact rows; no screenshot comparison | PARTIAL — search, enrollment filters, avatar/course/last access/chat affordance | Live assigned roster and last-access data are unavailable. |
| T08 | Chi tiết học viên | `TeacherStudentsTab.jsx` | Student detail | PARTIAL | PARTIAL — native detail card differs | PARTIAL — progress, attendance, notes and contact affordance | Some result/note actions are alert-based/local and complete web field parity is unverified. |
| T09 | Hộp thư | `/teacher/inbox`; `Inbox.jsx` | Messages | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — search, teacher categories and conversation list | Web list, online state, unread/read state and group permissions are not connected. |
| T10 | Hội thoại | `Inbox.jsx` | Conversation | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — reply/reaction/sticker/attachment placeholder/recall/pin | No live delivery, actual attachment, realtime or server status. |
| T11 | Tạo nhóm hội thoại | `Inbox.jsx` | Conversation/group flow | PARTIAL | PARTIAL — dialog differs | PARTIAL — local participant selection and group creation UI | No server group creation, roles or membership synchronization. |
| T12 | Bảng tin trao đổi & Hỏi bài | `/teacher/feed`; `FeedBoard` | Feed | PARTIAL | PARTIAL — composer/post layout adapted; no screen comparison | PARTIAL — author/role/privacy/content/image placeholder/post/reaction/comment | Media and audience are local placeholders; no live content/persistence. |
| T13 | Bài tập về nhà | `/teacher#assignments`; `TeacherAssignmentsView.jsx` | Assignments | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — assignment list and local submission/grading entry | Live assignments and web state transitions are absent. |
| T14 | Tạo/giao bài tập | `TeacherAssignmentsView.jsx` | Assignment create form | PARTIAL | PARTIAL — mobile modal/form differs | PARTIAL — course, target learners and deadline mock controls | No real creation, upload, delivery or notification. |
| T15 | Danh sách bài nộp | `TeacherAssignmentsView.jsx` | Submission list/detail | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — demo submission rows and status | No real files or live submitted-at/status data. |
| T16 | Chấm bài / phản hồi | `TeacherAssignmentsView.jsx` | Grading controls | PARTIAL | PARTIAL — mobile form differs | PARTIAL — local score and feedback UI | No web validation/state synchronization; no server save. |
| T17 | Bài thi Trắc nghiệm | `/teacher#quizzes`; `TeacherQuizManager.jsx` | TeacherQuizzes list | PARTIAL | PARTIAL — card/list presentation differs | PARTIAL — quiz cards, metrics and local actions | No live quiz records/results; actions are demo-only. |
| T18 | Tạo bài trắc nghiệm | `TeacherQuizManager.jsx` | TeacherQuizzes authoring form | PARTIAL | PARTIAL — native form differs | PARTIAL — quiz fields/questions plus AI count/difficulty and Excel import/template/export controls represented as non-operational demo notices | No AI generation, Excel file processing, assignment API or server persistence. |
| T19 | Kết quả trắc nghiệm | `TeacherQuizManager.jsx` | Quiz result detail | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — local result summary/detail | No live submissions, official scores, or verified result workflow. |
| T20 | Khóa đào tạo | `/teacher#training`; `TeacherTrainingLMS.jsx` | TeacherTraining | PARTIAL | PARTIAL — course banner/cards adapted | PARTIAL — course list/progress mock | Live course/progress data and LMS updates absent. |
| T21 | Quy trình đào tạo | `TeacherTrainingLMS.jsx` | TeacherTraining process tab | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — tab/section represented | Process steps/actions are not verified against runtime source content. |
| T22 | Tài liệu đào tạo | `TeacherTrainingLMS.jsx` | TeacherTraining materials tab | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — list/controls are mock | No real open/download or live content. |
| T23 | Phần mềm | `/teacher#materials-software`; `TeacherMaterialsTab.jsx` | SoftwareLinks | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — source-category mock list | External launch/download and live link behavior are not connected. |
| T24 | Tài chính | `/teacher/finance`; `TeacherFinanceAndTraining.jsx` | TeacherFinance | PARTIAL | PARTIAL — summary/chart hierarchy adapted | PARTIAL — totals/chart/export affordances | Unknown values remain mock/`—`; export controls do not create files. |
| T25 | Lịch sử chuyển tiền / giao dịch | `TeacherFinanceAndTraining.jsx` | TeacherFinance history | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — local transaction history/filter | No account transaction data, PDF/CSV output, or server state. |
| T26 | Tin tức | `/teacher/news`; `NewsPage.jsx` | News | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — search/topic/sort/time/list-grid controls | Live news data and metadata are not connected. |
| T27 | Chi tiết tin tức | `/teacher/news/:slug`; `NewsPage.jsx` | NewsDetail | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — local article detail | No live article content/author/media or verified navigation. |
| T28 | Thông tin Trung tâm | `/teacher/center-info`; `CenterInfoPage` | CenterInfo | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — title, section inventory and source-shaped summary | Descriptions/contact values are empty in mock; complete source content not reproduced. |
| T29 | Hồ sơ giảng viên | `/teacher#profile`; `TeacherProfileTab.jsx` | Profile | PARTIAL | PARTIAL — hero and field grouping are source-informed | PARTIAL — hero, personal/bank/account status sections and local edit form | Status, skills/tags and personal/bank values are unavailable mock fields; exact web field comparison remains. |
| T30 | Thông báo | `/teacher/notifications`; `NotificationCenterPage.jsx` | Notifications | PARTIAL | PARTIAL — screenshot comparison incomplete | PARTIAL — read/unread/category/detail/related action and 20-item pagination; 25-item fixture verified across pages 1 and 2 | Only local mock data; full category/destination/action parity and screenshot comparison unverified. |
| T31 | Teacher onboarding / bài kiểm tra đầu vào | `/teacher/test`; `TeacherTest.jsx` | Role menu website-only entry | WEB-ONLY | WEB-ONLY — no onboarding screen | WEB-ONLY — explicit website-only inventory notice | Not in active Teacher phase; no test/camera/upload/proctoring UI. |

## Verification and readiness

| Role | ALIGNED | PARTIAL | MISSING | WEB-ONLY | Total |
|---|---:|---:|---:|---:|---:|
| Student | 0 | 23 | 0 | 1 | 24 |
| Teacher | 1 | 29 | 0 | 1 | 31 |
| **Total** | **1** | **52** | **0** | **2** | **55** |

| Check | Result |
|---|---|
| Existing project, five-tab navigation and mock-only boundary retained | PASS |
| Current web source inspected for the gaps changed in this sweep | PASS |
| Full S01–S24 and T01–T31 live screen/state traversal | NOT COMPLETE |
| Direct screenshot comparison for each screen | NOT COMPLETE |
| Notification pagination | PASS — 25-item Teacher QA fixture, page 1/2, unread filter, 320/360/375/390/412/430/768 px; no measured horizontal overflow |
| Teacher overdue attendance request | PASS — fixture showed overdue label, session details, one-hour notice, responsibility text, close/cancel controls and local demo-submitted state |
| Student evaluation states | PASS — 4/12 blocked below 6/12; existing 4.5★/criteria hydrated and editable; course-ended state locked |
| Student Profile | PASS — expected sections rendered; no measured horizontal overflow at 320/360/375/390/412/430/768 px |
| Other named QA fixtures (assignments, grades, chat, quiz, finance, feed, news) | AVAILABLE; NOT ALL RUNTIME-TRAVERSED |
| All screens at 320/360/375/390/412/430/768 px | NOT COMPLETE |
| Focused Expo Web smoke: Teacher quiz authoring controls and Student public evaluation demo submit | PASS — UI rendered and local-only submit state shown |
| Teacher overdue makeup-request modal | NOT RUN — no eligible overdue pending session in the current mock fixture |
| Focused viewport check: Student evaluation root/body at 320/360/375/390/412/430/768 px | PASS — document/body widths matched viewport; nested control clipping not certified |
| Android / iOS native QA | NOT RUN |
| TypeScript | PASS — `npm run typecheck` from `thang-tin-hoc-mobile/` |
| Expo compatibility | PASS — `npx expo install --check`; dependencies are up to date |
| `git diff --check` | PASS for tracked files; the mobile directory is currently untracked, so its edited files were also checked separately for trailing whitespace (PASS) |
| Website/backend changes | NO |
| Real backend/API/auth/payment/push/file/AI/Excel integration | NO |

**Readiness: `MOBILE UI/UX PARITY NOT READY`.** This report records known gaps and evidence; it does not claim full parity or production readiness.
