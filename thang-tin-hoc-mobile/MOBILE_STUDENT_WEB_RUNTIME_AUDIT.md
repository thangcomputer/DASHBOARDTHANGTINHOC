# Student Web Runtime Audit → Mobile UI

**Date:** 2026-10-24
**Web:** local `http://localhost:5173`
**Purpose:** inspect the current Student role screens and safe UI interactions, then apply source-backed UI structure to the existing Expo mobile app.

## Safety and test method

- Logged into the local web app using the Student credentials supplied by the user. Credentials and account identifiers are intentionally not recorded here or in mobile fixtures.
- Only navigated screens, read visible content, changed view-only filters, and opened then cancelled the schedule-note dialog.
- Did not send a note/message/post, submit homework, start an exam, mark/dismiss notifications, change profile/payment data, or save anything.
- Several web API requests returned `502`/`503`; runtime-visible empty/loading states are recorded separately from source-defined behavior. The mobile app remains mock-only.

## Runtime observations

| Web area / route | Observed UI and safe test | Result / limitation |
|---|---|---|
| Student overview `/student` | Greeting/motto; current class panel; completed/remaining/average/progress KPIs; todo cards for class quiz, homework, upcoming schedule and messages; materials section; learning log/grades | Rendered. Current account showed a class in progress and no join link. These account-specific values are not copied into the mobile mock. |
| Schedule `/student#schedule` | `Quản lý Lịch học & Điểm danh`; monthly completed/upcoming/cancelled KPIs; week table with course rows and seven day columns; `Nhật ký học tập` period/status filters; schedule note action | Rendered. Opened note dialog and cancelled without sending. The session was currently marked `Đang diễn ra`; do not hardcode the session/date into mock data. |
| Homework and resources `/student#materials-assignments` | Tabs `Tài liệu`, `Phần mềm`, `Bài tập`; homework heading and empty-state copy | Rendered; no homework requiring submission for the logged-in user at test time. |
| Course/video learning `/student/lesson-practice` | Enrolled course and self-study video/catalog groupings; course cards and lesson path | Navigation/catalog UI rendered. No purchase or lesson attempt was made. Background API failures occurred during the session. |
| Exam `/student/exam` | Four destinations: lesson quizzes, certificate exam, scores, MOS/IC3; quiz section and empty state | Rendered. No exam or attempt was started; certificate/MOS/IC3 attempts remain web-only in this mobile phase. |
| Inbox `/student/inbox` | Search by name/phone; filters `Tất cả`, `Giảng viên`, `Tuyển sinh`, `Hỗ trợ`, `Nhóm`; contacts show role, online state and last message/time | Rendered with available contacts. Filter state was viewed; no conversation message was sent. Some contact/message requests returned service errors. |
| Feed `/student/feed` | `Bảng tin trao đổi & Hỏi bài`; composer, public audience selector, image action (up to six), post action | Composer rendered, but post list/data could not be verified due 502 responses. Did not post or attach images. |
| News `/student/news` | Search, topic, sort, time filter and article cards | Search/filter/list UI and available articles rendered. No edit action was used. |
| Evaluation `/student#evaluation` | Separate `Phản hồi Trung tâm` and `Đánh giá GV` flows; course-linked private feedback view | Form/entry structure rendered. Did not submit feedback. |
| Center information `/student/center-info` | Sections `Tổng quan`, `Nhân sự`, `Chi nhánh`, `Mạng xã hội`, `Dịch vụ đào tạo`, `Địa điểm thi`, `Chứng chỉ` | Route rendered an explicit “Nội dung đang được cập nhật” message; source runtime data was unavailable. |
| Notifications `/student/notifications` | Notification center, unread count, `Đọc tất cả`, all/unread filters and timestamped categories | List rendered. Read/dismiss actions were not used. |
| Profile `/student#profile` | Profile hero; progress/grade/remaining lessons; personal details/update; learning summary; teacher, enrollment, tuition/payment and course summary; password change entry | Read-only inspection. No personal details, password or payment action was changed. |

## Mobile changes applied

Updated `src/screens/HomeScreen.tsx` to follow the web overview hierarchy:

- Retained the existing course/session summary and made its destination open the learning catalog instead of the grades screen.
- Changed Student quick-action labels to the corresponding web menu names (`Video khóa học`, `Bài tập và tài nguyên`, `Đánh giá GV`, `Phòng thi`).
- Added the web overview's `Trắc nghiệm buổi học` task and message unread count, using existing local mock services only.
- Added `Tài liệu` and `Nhật ký học tập & Điểm số` sections, with explicit empty/loading states and existing stack destinations.
- Removed the unsupported “Tài liệu mới đã sẵn sàng / Giáo trình Word nâng cao” promotion from Home. Documents now appear only from the mock resource list.
- Prevented missing session data from becoming invented `0/0`, `0` remaining, or `0%` KPI values; missing source data displays `—`.
- Added the optional `meetingUrl` field to the local schedule type so an online class with no mock link can display the same missing-link state as web.

This is structural/label parity only. Mock account values remain synthetic and are not the authenticated web user's data. No web or backend source was modified.

## Verification

- Student web pages and safe navigation were exercised as listed above; write actions were intentionally not performed.
- Expo Web Student demo login and Home rendered after the update; the `Video khóa học` quick action opened the existing learning catalog.
- Expo Web Home document/body width matched viewport at 320, 360, 375, 390, 412, 430 and 768 CSS px.
- `npm run typecheck`: **PASS**.
- `npx expo install --check`: **PASS** — dependencies up to date; no dependency changes.
- `git diff --check`: **PASS**.
- Android/iOS native testing: **NOT RUN**.
- This is not a claim of full functional or visual parity. API failures, mock-only mobile data, and untested native behavior remain limitations.

## Subsequent parity continuation

- Student schedule diary now displays the full local schedule inventory and has the web's combined `Tất cả`, `Ngày`, `Tuần`, `Tháng`, `Chưa điểm danh`, and `Lịch hủy` filters. Available status, score and note fields are shown; missing values remain absent or `—`.
- Student evaluation now separates private Center feedback from public Teacher rating, uses the current web's four rating criteria/options and half-course eligibility threshold, and keeps submission local. Course-end edit locking and screenshot parity remain unverified.
- Student notifications now expose local category filtering, read-all, hide, detail, refresh and category-based mock navigation. Destination parity for individual web notification payloads remains unverified.
- These code changes do not alter the recorded historical web-runtime observations and were not submitted to the web or backend.
