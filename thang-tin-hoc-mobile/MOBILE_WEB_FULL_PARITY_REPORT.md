# Full Web → Mobile Parity Audit Report

## Executive result

**Overall: PARTIAL — `TEACHER MOBILE UI STILL NEEDS PARITY WORK`; Student is also PARTIAL.**

The source audit identified current web roles, route families, permission-sensitive areas, and major Student/Teacher workflows. The existing mobile app has mock screens for the primary Student and Teacher areas, with five role-specific bottom tabs and stack/menu destinations. Screen presence is not full visual or functional parity. No `ALIGNED` claim is made for the complete app.

## Scope and evidence

- **Web source reviewed:** route/role guards in `client/src/App.jsx`; sidebar navigation in `AppSidebar.jsx`; Student and Teacher dashboard/module sources; shared inbox, notifications, feed, news and center-info pages; Admin dashboard, permission catalog and lazy tab routing.
- **Mobile source reviewed:** current navigation types/root navigator, screen components, mock data and mock service boundary; existing Student/Teacher parity/QA reports.
- **Runtime evidence:** prior local Teacher runtime work is recorded in `MOBILE_TEACHER_WEB_PARITY_UI.md`. The current Student role was also logged into and safely inspected across overview, schedule, resources/homework, learning, exam, inbox, feed, news, evaluation, center-info, notifications and profile; details are in `MOBILE_STUDENT_WEB_RUNTIME_AUDIT.md`. These checks do not establish every server workflow or successful backend data state.
- **No account credentials or real user data are included in this report.**

## Role and scope findings

| Role / flow | Web status | Mobile disposition |
|---|---|---|
| Student | Dashboard plus learning, schedule, assignments/resources, exams, evaluation, communication, news/feed, center, profile/payment and notifications | Screens exist for most function families; all remain `PARTIAL` because source data, business rules and server actions are mock-only. Exam/cert attempts are `WEB-ONLY`. |
| Active Teacher | Overview, schedule/calendar, attendance, assigned students, assignments/quizzes, LMS/training, finance, communication, feed/news, center, profile and notifications | Main screens/entry paths exist; most are `PARTIAL`. Makeup request flow is locally exercised; server-backed gates and data synchronization remain absent. |
| Pending/locked Teacher | `/teacher/test` onboarding/assessment and status restrictions | `WEB-ONLY`; this is a Teacher state, not a separate role. No camera/native assessment is implemented. |
| Admin and Admin Staff | Shared permission-filtered dashboard; areas include students, teachers, staff/HR, finance/BI, system, logs, files, backup, monitoring, AI, workflows, builders, tenants and center management | `WEB-ONLY CURRENT SCOPE`; no Admin mobile code is requested in this phase. |

## Screen status summary

| Area | Status | Principal remaining gaps |
|---|---|---|
| Student Home | `PARTIAL` | Web-aligned overview order/labels, resource and grade sections are now in place; mock values remain synthetic, and linked course/account data is not synchronized. |
| Student Schedule | `PARTIAL` | Monthly KPIs, week navigation, course/day grid, session details, local note and six web-aligned diary filters are present; direct screenshot and field/action comparison remain open. |
| Student Learning / Materials / Assignments | `PARTIAL` | LMS gates, media/files, submission and server status. |
| Student Grades / Exams / Certification | `PARTIAL` / `WEB-ONLY` | Official history/score data absent; no native exam attempt/camera/proctor. |
| Student Inbox / Chat | `PARTIAL` | Realtime, unread/read receipts, actual attachments and complete web action parity. |
| Student Evaluation / Profile / Tuition | `PARTIAL` | Evaluation eligibility, existing-rating edit and course-end lock are fixture-tested; Profile now contains KPIs, personal fields, learning/course progress, tuition and video-order empty state. Screenshot parity and real save/payment workflows remain unverified. |
| Student Feed / News / Center / Notifications | `PARTIAL` | Source data, permission/destination actions and status synchronization. |
| Teacher Home | `PARTIAL` | Exact source metrics/order and authenticated data. |
| Teacher Schedule / Attendance | `PARTIAL` | Schedule-backed diary, attendance selection and a local-only overdue makeup request dialog are present; overdue detail/cancel/demo-submit path was tested. Source visual verification and server persistence remain incomplete. Monthly calendar is disabled on current web. |
| Teacher Students | `PARTIAL` | Full profile actions, last-access data and assigned-student source. |
| Teacher Inbox / Chat | `PARTIAL` | Group/message operations, realtime state and complete action handling. |
| Teacher Assignments / Quizzes | `PARTIAL` | Quiz authoring now represents AI count/difficulty and Excel import/template/export controls as non-operational demo UI; no AI/file operation, full live workflow or actual submissions are integrated. |
| Teacher Training / Finance | `PARTIAL` | LMS state, finance data and real export are intentionally not connected. |
| Teacher Feed / News / Center / Profile / Notifications | `PARTIAL` | Permission/status/detail/action parity and source-backed content; notification page controls were tested with a 25-item local fixture. |
| Teacher onboarding test | `WEB-ONLY` | Camera, practical upload, attempt/result and pending/locked status workflow. |
| Admin / Admin Staff | `WEB-ONLY` | Entirely outside this phase. |

## Completeness and visual parity

- **Screen reachability:** main Student/Teacher destinations are represented in the existing tabs, role menu, quick actions or stack; this does not prove every nested route/action is reachable in the same circumstances as web.
- **Screen matrix:** [`MOBILE_PARITY_SCREEN_MATRIX.md`](./MOBILE_PARITY_SCREEN_MATRIX.md) records 24 Student and 31 Teacher entries: 1 `ALIGNED`, 52 `PARTIAL`, 0 `MISSING`, and 2 `WEB-ONLY` (exam/certification attempts and Teacher onboarding test).
- **Visual parity:** source-informed component structures exist, but screenshot comparison is incomplete. Existing reports explicitly note that most screens have no direct web screenshot comparison; no screen is upgraded to `ALIGNED` on render-only evidence.
- **Responsive parity:** Teacher Schedule document/body width matched all seven requested widths in the latest Expo Web check, but nested content and the complete per-screen/per-width sweep are not verified.
- **Focused QA fixtures:** `EXPO_PUBLIC_MOBILE_UI_QA_STATE` is development-only. Runtime-tested states include 25-item notifications, overdue Teacher attendance, Student evaluation not-eligible/existing/course-ended, and Student Profile at all seven requested widths. Other named fixtures are documented but not all traversed.
- **Data integrity:** any metric lacking a verifiable mock source must stay `—`; demo fixtures must not be described as actual account data.
- **Mobile-only features:** no additional business module was identified in the current inventory. Local mock actions are UI simulations, not synchronized features. Student quiz attempt UI was removed; the exam destination is informational and actual attempts remain `WEB-ONLY`. A routing audit also corrected Student materials/software menu destinations and removed the Teacher test → quiz-authoring misroute.

## Validation and boundary

| Requirement | Result |
|---|---|
| Existing mobile project/navigation retained | PASS |
| Student screens changed based on the runtime audit/parity QA | YES — Home overview and Schedule UI; no credentials or account-specific values copied to fixtures |
| Website changed | NO |
| Backend changed | NO |
| Real API/auth/database/Redis/Socket.IO/push/payment connected | NO |
| Native exam/camera/proctor implemented | NO |
| `npm run typecheck` | PASS — run for this audit |
| `npx expo install --check` | PASS — dependencies are up to date; no dependency changes |
| `git diff --check` | PASS |
| Expo Web smoke | PARTIAL PASS — 25-item notification pagination, overdue attendance local request, Student evaluation eligibility/existing/locked states and Student Profile sections/responsive widths, plus prior Home/Schedule/Feed/quiz smoke. This is not full route/action QA. |
| Full Student/Teacher UI-flow QA across all routes | NOT RUN / NOT ESTABLISHED |
| Expo Web responsive checks (320/360/375/390/412/430/768) | PARTIAL — Student evaluation document/body width equality checked at all seven sizes; prior schedule checks recorded. Nested overflow/per-control fit for all screens is NOT COMPLETE. |
| Android native QA | NOT RUN |
| iOS native QA | NOT RUN |

The Expo Web smoke is only a render/navigation spot-check and does not establish visual parity, full workflow coverage, responsive overflow across all screens, or native behavior. See `MOBILE_WEB_UI_UX_FINAL_AUDIT.md` for the current screen-by-screen UI/backend split and exact remaining gaps.

## Required follow-up before declaring readiness

1. Compare each existing screen directly with current web screenshots/source, checking section order, field names, actions, status, filters and roles.
2. Complete the responsive sweep at 320, 360, 375, 390, 412, 430 and 768 px for each relevant screen and record actual per-screen results.
3. Close UI-only gaps for Student and Teacher without introducing unsupported functions or values.
4. Keep Student exams/certification and Teacher onboarding exam `WEB-ONLY` until a separately approved native design/technical scope exists.
5. Keep Admin/Admin Staff `WEB-ONLY CURRENT SCOPE`.
6. Typecheck and run Expo compatibility/diff checks on the final code state.

## Conclusion

**`MOBILE UI/UX PARITY NOT READY`**

No website/backend changes were made and no real backend integration was added. This report is an inventory and gap assessment, not release or native-device certification.
