# Web → Mobile Screen Parity Matrix

## Scope and classification

- Prompt 11 closure: all 22 previously named UI gaps were implemented and rechecked; 53 entries are ALIGNED, 0 PARTIAL, 0 MISSING, and 2 WEB-ONLY.
- Scope: current Student and active Teacher screens in the existing Expo app. The five-tab navigation and role split are retained.
- This matrix classifies visible UI/UX only. Mock data, missing persistence/network integrations, and Android/iOS not being run are recorded separately and do not create a UI gap.
- QA-only profile, tuition, video-order and grade examples are enabled only by `EXPO_PUBLIC_MOBILE_UI_QA_STATE`; they are not default account data.
- `ALIGNED` means the mobile screen exposes the current web-visible sections, labels, controls, states and local UI flow in a mobile-adapted layout. It does not assert pixel identity or production readiness.
- `PARTIAL` requires an exact visible field, control, state, layout or route omission in the final column.
- `WEB-ONLY` is reserved for web-only exam/certification attempts and Teacher onboarding.
- Backend for all in-scope mobile screens: `NOT CONNECTED (mock only)`. Native QA: `NOT RUN`.
- Gap Type is limited to `NONE`, `VISUAL`, `CONTROL`, `STATE`, `FLOW`, `ROUTE`, `WEB-ONLY`. Backend and native readiness are not gap types.

## Student (S01–S24)

| ID | Screen / web source → mobile | UI/UX | Backend | Gap Type | Exact Remaining Gap |
|---|---|---|---|---|---|
| S01 | Tổng quan học viên — `StudentOverviewTab.jsx` → Home | ALIGNED | NOT CONNECTED | NONE | — |
| S02 | Lịch học theo tuần — `StudentScheduleTab.jsx`, `StudentWeeklyScheduleGrid.jsx` → Schedule | ALIGNED | NOT CONNECTED | NONE | — |
| S03 | Chi tiết buổi học — `StudentScheduleView.jsx` → Schedule detail | ALIGNED | NOT CONNECTED | NONE | — |
| S04 | Nhật ký học tập / ghi chú — `StudentScheduleView.jsx`, `StudentAttendanceConfirmModal.jsx` → Schedule diary | ALIGNED | NOT CONNECTED | NONE | — |
| S05 | Hộp thư — `Inbox.jsx` → Messages | ALIGNED | NOT CONNECTED | NONE | — |
| S06 | Hội thoại — `Inbox.jsx` → Conversation | ALIGNED | NOT CONNECTED | NONE | — |
| S07 | Khóa học / luyện tập — `LessonPracticeCatalogPage.jsx` → StudentLearning | ALIGNED | NOT CONNECTED | NONE | — |
| S08 | Cấu trúc khóa / chương — `StudentTrainingLMS.jsx`, `LessonPracticeCatalogPage.jsx` → StudentLearning | ALIGNED | NOT CONNECTED | NONE | — |
| S09 | Chi tiết bài học — `StudentTrainingLMS.jsx`, lesson-practice route → LearningLesson | ALIGNED | NOT CONNECTED | NONE | — |
| S10 | Tài liệu học tập — `StudentMaterialsTab.jsx` → Materials | ALIGNED | NOT CONNECTED | NONE | — |
| S11 | Phần mềm khóa học — `StudentMaterialsTab.jsx` → SoftwareLinks | ALIGNED | NOT CONNECTED | NONE | — |
| S12 | Bài tập — `StudentMaterialsTab.jsx` → Assignments | ALIGNED | NOT CONNECTED | NONE | — |
| S13 | Chi tiết / nộp bài — `StudentMaterialsTab.jsx` → Assignment detail/submission | ALIGNED | NOT CONNECTED | NONE | — |
| S14 | Điểm / kết quả học tập — `StudentOverviewTab.jsx` → Grades | ALIGNED | NOT CONNECTED | NONE | — |
| S15 | Thi, quiz attempt, chứng chỉ — `/student/exam/*`, `/student/cert-prep/*` → StudentExam inventory | WEB-ONLY | NOT CONNECTED | WEB-ONLY | Attempt, certification, proctoring and official exam results remain website-only by scope. |
| S16 | Bảng tin trao đổi — `FeedBoard.jsx` → Feed | ALIGNED | NOT CONNECTED | NONE | — |
| S17 | Tin tức — `NewsPage.jsx` → News | ALIGNED | NOT CONNECTED | NONE | — |
| S18 | Chi tiết tin tức — `NewsPage.jsx` → NewsDetail | ALIGNED | NOT CONNECTED | NONE | — |
| S19 | Đánh giá Trung tâm / giảng viên — `StudentEvaluationView.jsx` → Evaluations | ALIGNED | NOT CONNECTED | NONE | — |
| S20 | Thông tin Trung tâm — `CenterInfoPage` → CenterInfo | ALIGNED | NOT CONNECTED | NONE | — |
| S21 | Hồ sơ cá nhân — `StudentProfileTab.jsx` → Profile | ALIGNED | NOT CONNECTED | NONE | — |
| S22 | Cập nhật hồ sơ / mật khẩu — `StudentProfileUpdateModal.jsx`, `StudentProfileTab.jsx` → Profile edit | ALIGNED | NOT CONNECTED | NONE | — |
| S23 | Học phí / đơn mua khóa video — `StudentProfileTab.jsx`, `TuitionPaymentModal.jsx` → Tuition | ALIGNED | NOT CONNECTED | NONE | — |
| S24 | Thông báo — `NotificationCenterPage.jsx` → Notifications | ALIGNED | NOT CONNECTED | NONE | — |

## Teacher (T01–T31)

| ID | Screen / web source → mobile | UI/UX | Backend | Gap Type | Exact Remaining Gap |
|---|---|---|---|---|---|
| T01 | Tổng quan giảng viên — `TeacherOverviewTab.jsx` → Home | ALIGNED | NOT CONNECTED | NONE | — |
| T02 | Lịch dạy / xếp lịch tuần — `TeacherScheduleTab.jsx`, `TeacherWeeklySlotGrid.jsx` → Schedule | ALIGNED | NOT CONNECTED | NONE | — |
| T03 | Lịch tháng — `TeacherScheduleTab.jsx`, `TeacherMonthlyCalendar.jsx` (feature disabled) → no active screen | ALIGNED — NOT APPLICABLE CURRENT WEB | NOT CONNECTED | NONE | — |
| T04 | Nhật ký giảng dạy / bộ lọc — `TeacherTeachingLog.jsx` → Schedule diary | ALIGNED | NOT CONNECTED | NONE | — |
| T05 | Điểm danh buổi học — `TeacherTeachingLog.jsx`, `TeacherScheduleTab.jsx` → Attendance | ALIGNED | NOT CONNECTED | NONE | — |
| T06 | Yêu cầu điểm danh bù — `AttendanceMakeupRequestModal.jsx` → Attendance overdue modal | ALIGNED | NOT CONNECTED | NONE | — |
| T07 | Học viên được phân công — `TeacherStudentsTab.jsx` → Students | ALIGNED | NOT CONNECTED | NONE | — |
| T08 | Chi tiết học viên — `TeacherStudentsTab.jsx` → Student detail | ALIGNED | NOT CONNECTED | NONE | — |
| T09 | Hộp thư — `Inbox.jsx` → Messages | ALIGNED | NOT CONNECTED | NONE | — |
| T10 | Hội thoại — `Inbox.jsx` → Conversation | ALIGNED | NOT CONNECTED | NONE | — |
| T11 | Tạo nhóm hội thoại — `Inbox.jsx` → Messages group flow | ALIGNED | NOT CONNECTED | NONE | — |
| T12 | Bảng tin trao đổi & Hỏi bài — `FeedBoard.jsx` → Feed | ALIGNED | NOT CONNECTED | NONE | — |
| T13 | Bài tập về nhà — `TeacherAssignmentsView.jsx` → Assignments | ALIGNED | NOT CONNECTED | NONE | — |
| T14 | Tạo/giao bài tập — `TeacherAssignmentsView.jsx` → Assignment create form | ALIGNED | NOT CONNECTED | NONE | — |
| T15 | Danh sách bài nộp — `TeacherAssignmentsView.jsx` → Submission detail | ALIGNED | NOT CONNECTED | NONE | — |
| T16 | Chấm bài / phản hồi — `TeacherAssignmentsView.jsx` → Grading controls | ALIGNED | NOT CONNECTED | NONE | — |
| T17 | Bài thi Trắc nghiệm — `TeacherQuizManager.jsx` → TeacherQuizzes list | ALIGNED | NOT CONNECTED | NONE | — |
| T18 | Tạo bài trắc nghiệm — `TeacherQuizManager.jsx` → TeacherQuizzes authoring | ALIGNED | NOT CONNECTED | NONE | — |
| T19 | Kết quả trắc nghiệm — `TeacherQuizManager.jsx` → Quiz result detail | ALIGNED | NOT CONNECTED | NONE | — |
| T20 | Khóa đào tạo — `TeacherTrainingLMS.jsx` → TeacherTraining | ALIGNED | NOT CONNECTED | NONE | — |
| T21 | Quy trình đào tạo — `TeacherTrainingLMS.jsx` → TeacherTraining process tab | ALIGNED | NOT CONNECTED | NONE | — |
| T22 | Tài liệu đào tạo — `TeacherTrainingLMS.jsx` → TeacherTraining materials tab | ALIGNED | NOT CONNECTED | NONE | — |
| T23 | Phần mềm — `TeacherMaterialsTab.jsx` → SoftwareLinks | ALIGNED | NOT CONNECTED | NONE | — |
| T24 | Tài chính — `TeacherFinanceAndTraining.jsx` → TeacherFinance | ALIGNED | NOT CONNECTED | NONE | — |
| T25 | Lịch sử chuyển tiền / giao dịch — `TeacherFinanceAndTraining.jsx` → TeacherFinance history | ALIGNED | NOT CONNECTED | NONE | — |
| T26 | Tin tức — `NewsPage.jsx` → News | ALIGNED | NOT CONNECTED | NONE | — |
| T27 | Chi tiết tin tức — `NewsPage.jsx` → NewsDetail | ALIGNED | NOT CONNECTED | NONE | — |
| T28 | Thông tin Trung tâm — `CenterInfoPage` → CenterInfo | ALIGNED | NOT CONNECTED | NONE | — |
| T29 | Hồ sơ giảng viên — `TeacherProfileTab.jsx` → Profile | ALIGNED | NOT CONNECTED | NONE | — |
| T30 | Thông báo — `NotificationCenterPage.jsx` → Notifications | ALIGNED | NOT CONNECTED | NONE | — |
| T31 | Teacher onboarding / bài kiểm tra đầu vào — `/teacher/test`, `TeacherTest.jsx` → role menu website-only entry | WEB-ONLY | NOT CONNECTED | WEB-ONLY | Teacher onboarding test remains website-only by scope. |

## Verification and readiness

| Role | ALIGNED | PARTIAL | MISSING | WEB-ONLY | Total |
|---|---:|---:|---:|---:|---:|
| Student | 23 | 0 | 0 | 1 | 24 |
| Teacher | 30 | 0 | 0 | 1 | 31 |
| **Total** | **53** | **0** | **0** | **2** | **55** |

| Check | Result |
|---|---|
| Existing five-tab navigation retained; no Drawer added | PASS |
| Current web source and mobile component inspected for the listed remaining gaps | PASS |
| Student evaluation states | PASS — 4/12 ineligible; existing 4.5★ editable; course-ended state locked |
| Student Profile and per-course content | PASS — multiple enrollments, per-course progress/tuition, paid/pending video orders, continue actions and password form rendered in Expo Web |
| Student assignment submission fixture/flow | PASS — file selection, selected-file state, submit and submitted/disabled state |
| Student news and detail fixture | PASS — topic, search, sort, period, layout controls; author/excerpt and image/file attachment rows rendered |
| Teacher feed fixture/flow | PASS — multi-post older-items pagination; local composer, own-post edit/delete controls, threaded reply/reaction |
| Teacher quiz learner targeting | PASS — course filtering, learner search, select-all-visible and clear-selection state |
| Teacher notification pagination fixture | PASS — 25 records, page 1/2 (20 + 5), categories and route-safe notification detail |
| Chat UI | PASS — attachment/sticker/GIF/reaction controls; selected GIF rendered with local sent state |
| Password form | PASS — mismatched confirmation validation and local success/close state |
| Representative complex-screen responsive checks | PASS — Feed, NewsDetail and Conversation at 320/360/375/390/412/430/768 CSS px; document/body widths matched each viewport |
| Teacher overdue makeup request fixture | PASS — one-hour rule, session detail, cancel/close and local pending state |
| Teacher quiz authoring and Student evaluation demo flow | PASS — previously exercised in Expo Web |
| All 55 screens directly screenshot-compared to web at 390/430 px | NOT RUN |
| Full responsive traversal of every screen at all 7 widths | NOT RUN — responsive sampling was limited to the representative complex screens above |
| Dead buttons | 0 found in reviewed surfaces; visible mock actions produce local state, alert/notice or route |
| Orphan routes | 0 found in route inventory; NotificationCenter is reached by shared error/retry UI |
| Wrong-role routes | 0 found in registered role-gated routes and role-specific menu |
| Android/iOS native QA | NOT RUN |
| Backend/API/auth/Socket.IO/payment/upload/download/AI/export integration | NO |
| Website/backend modified in this task | NO |
| Git add/commit/push/merge | NO |
| TypeScript | PASS — `npm run typecheck` |
| Expo compatibility | PASS — `npx expo install --check` |
| Whitespace check | PASS — `git diff --check` and edited mobile-document trailing-whitespace scan |

**Readiness: `MOBILE UI/UX PARITY READY`** — 53 ALIGNED, 0 PARTIAL, 0 MISSING, 2 WEB-ONLY. Backend remains `NOT CONNECTED`; Android/iOS native QA remains `NOT RUN`. Neither is counted as a UI parity gap.
