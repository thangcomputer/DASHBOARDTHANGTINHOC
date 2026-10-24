# MOBILE WEB UI / FUNCTION PARITY REAUDIT

## Scope and source of truth

This audit re-checks the current Mobile app against the live Web app as the source of truth.

Rules applied:
- Do not rely on older "ALIGNED" conclusions unless verified in the current Web runtime.
- Treat Web screen labels, ordering, section structure, filters, actions, and states as the reference.
- Keep existing real API integrations and feature flags intact; do not rollback working Mobile integrations only to force a UI parity change.
- Separate UI/function parity from backend connectivity. A feature may be real-data enabled and still be `PARTIAL` in the web-parity review.
- Keep exam/certification attempts and Teacher onboarding/test flows in `WEB-ONLY` unless a separate native design/POC is approved.

## Status summary

Overall result: `PARTIAL`

The current Mobile app has a valid base structure and navigation for many Student/Teacher surfaces, but the live Web app still exposes more exact sections, filters, metadata, state handling, and actions than Mobile currently provides. This is a parity gap, not a backend readiness failure.

## Matrix

| Role | Feature | Web source | Mobile source | UI | Function | Data source | Gap | Result |
|---|---|---|---|---|---|---|---|---|
| Student | Overview / Home | Current Web dashboard and Student home sections | Mobile Home overview screen | PARTIAL | PARTIAL | MOCK | Order, detail blocks, KPI grouping, and course/account linkage do not fully match the live Web structure | PARTIAL |
| Student | Schedule | Web schedule calendar + day/session cards + filters | Mobile schedule screen | PARTIAL | PARTIAL | MOCK | Missing some exact filters, session metadata, navigation detail, and day/week ordering parity | PARTIAL |
| Student | Learning / Lessons | Student learning catalog and lesson detail flow | Mobile learning screen(s) | PARTIAL | PARTIAL | MIXED | Real API layer exists but still not fully mapped to current Web labels, modules, status semantics, and empty/error states | PARTIAL |
| Student | Notifications | Web notifications list and action flows | Mobile notifications screen | MATCHED | MATCHED | REAL REST API | Functional parity is acceptable for the in-scope list/filter/mutation flow; still separate from native QA | MATCHED |
| Student | Messages / Inbox | Shared Web inbox and messaging flow | Mobile messages screen | PARTIAL | PARTIAL | MOCK | Message actions, read state, attachments, and route parity are not complete compared to Web | PARTIAL |
| Student | Assignments / Materials | Web assignments/resources/materials sections | Mobile materials/assignment surfaces | PARTIAL | PARTIAL | MOCK | Missing exact labels, upload/submit flow, status states, and detail depth | PARTIAL |
| Student | Evaluation | Web evaluation/private/public feedback flow | Mobile evaluation screen | PARTIAL | PARTIAL | MOCK | Eligibility, rating/edit flow, and completion state still do not fully match Web | PARTIAL |
| Student | Profile / Tuition | Web profile and tuition pages | Mobile profile/tuition flows | PARTIAL | PARTIAL | MIXED | Financial and course progress detail still diverge from Web fields and empty-state handling | PARTIAL |
| Student | Feed / News / Center | Web feed/news/center information panels | Mobile feed/news/center areas | PARTIAL | PARTIAL | MOCK | Content depth and action destinations remain incomplete; not fully source-backed | PARTIAL |
| Student | Exam / Certification attempt | Official exam and certification attempt flow | Mobile menu/informational destination only | WEB-ONLY | WEB-ONLY | WEB-ONLY | Native attempt, camera, proctor, fullscreen and result flow remain website-only by explicit scope | WEB-ONLY |
| Teacher | Overview / Home | Web teacher overview with KPIs, next session, learner focus | Teacher home screen | PARTIAL | PARTIAL | MOCK | KPI ordering and metric detail do not match current Web output exactly | PARTIAL |
| Teacher | Schedule / Attendance | Web teacher schedule, attendance and makeup views | Mobile teacher schedule/attendance screens | PARTIAL | PARTIAL | MOCK | Attendance states, overdue/makeup details, and schedule filters are still partial compared to Web | PARTIAL |
| Teacher | Students | Web learner management and student profile actions | Mobile students screen | PARTIAL | PARTIAL | MOCK | Search/status/course/progress and detail actions are incomplete compared to Web | PARTIAL |
| Teacher | Messages | Shared web inbox teacher view | Mobile message screen | PARTIAL | PARTIAL | MOCK | Full inbox actions and message state parity are not fully implemented | PARTIAL |
| Teacher | Assignments | Web assignment creation, detail, submissions, grading | Mobile assignment screen | PARTIAL | PARTIAL | MOCK | Missing exact action flow, submission state, grading state, and file behavior | PARTIAL |
| Teacher | Quiz / Test tools | Web quiz authoring, question count, Excel import, template, results | Mobile quiz UI | PARTIAL | PARTIAL | MOCK | Demo controls exist but no real AI/file workflow or live result behavior | PARTIAL |
| Teacher | Training / LMS | Web teacher training and LMS screens | Mobile training area | PARTIAL | PARTIAL | MOCK | Flow is incomplete compared to the Web learning-management view | PARTIAL |
| Teacher | Finance | Web finance totals, history, filters, export | Mobile financial screen | PARTIAL | PARTIAL | MOCK | Source-backed totals and export hooks remain absent | PARTIAL |
| Teacher | Feed / News / Center / Profile / Notifications | Matching web modules | Mobile equivalents | PARTIAL | PARTIAL | MOCK | These screens remain partly aligned but lack exact field coverage and action parity | PARTIAL |
| Teacher | Onboarding / Test | Web teacher onboarding assessment and camera-based checks | Mobile route not used | WEB-ONLY | WEB-ONLY | WEB-ONLY | Not implemented on Mobile; kept website-only due to device and proctoring requirements | WEB-ONLY |
| Admin | Admin / staff surfaces | Web admin dashboards and permission gates | None in this Mobile scope | MISSING | MISSING | N/A | Outside the current Mobile scope; not a Mobile parity gap by mandate | MISSING |

## Before → Fix → After

| Area | Before | Fix | After |
|---|---|---|---|
| Student home | Screen exists but not fully aligned to web hierarchy and metric labeling | Re-check source hierarchy and keep exact order/sections in the mobile layout | Still `PARTIAL`; not yet fully matched |
| Student schedule | Calendar and cards are present, but filters and detail states are incomplete | Match the current Web day/week/session ordering and states | Still `PARTIAL` |
| Student learning | Real API path supported, but mismatch remains in module/lesson metadata and empty/error states | Align labels and states to the current Web subject/unit flow | Still `PARTIAL` |
| Student notifications | Functional list/filter/mutation parity is acceptable in-scope | Preserve the working real API path and keep the feature as matched | `MATCHED` |
| Teacher home | Basic overview exists but not source-accurate | Reconcile KPI ordering and summary content to the current Web dashboard | Still `PARTIAL` |
| Teacher assignment/quiz | Demo UI exists but not live workflow parity | Do not claim live functionality without actual backend support; keep clear UI/notice boundaries | Still `PARTIAL` |
| Exam/certification | Mobile route is informational only | Keep `WEB-ONLY` and do not fake attempts | `WEB-ONLY` |
| Teacher onboarding/test | Not implemented on Mobile | Keep website-only and do not route or fake a native assessment | `WEB-ONLY` |

## Result by status

- `MATCHED`: Student notifications, within current scope
- `PARTIAL`: Most Student and Teacher dashboard, schedule, learning, messaging, assignments, evaluation, profile, feed/news/center and teacher admin-like features
- `MISSING`: Admin / staff screens outside current scope
- `WEB-ONLY`: Student exam/certification attempts and Teacher onboarding/test flows

## Batch 1 student parity review

Feature:
Student Home

Before:
PARTIAL

Gaps:
- quick actions included web-only exam route despite the current web flow being website-only
- student home action order did not cleanly match the live web overview

Fixes applied:
- student quick actions were updated to use in-scope student flows: Learning, Schedule, Materials, Notifications
- the previous exam-linked action was removed from the primary home action set
- route handling now avoids dead shortcuts and keeps navigation to valid Mobile screens

Web checked @390:
YES

Mobile checked @390:
YES

Web checked @430:
YES

Mobile checked @430:
YES

UI:
PARTIAL

Function:
PARTIAL

Data:
MOCK

Remaining:
Home still remains partial because the full overview hierarchy and exact metric/detail ordering are not yet fully source-matched.

Feature:
Student Schedule

Before:
PARTIAL

Gaps:
- session metadata, summary order and control hierarchy remain incomplete compared to the current Web schedule

Fixes applied:
- kept the existing schedule flow and preserved the mobile-friendly hierarchy without introducing a fake backend path
- retained the week/course/status controls and localized note flows already present

Web checked @390:
YES

Mobile checked @390:
YES

Web checked @430:
YES

Mobile checked @430:
YES

UI:
PARTIAL

Function:
PARTIAL

Data:
MOCK

Remaining:
Exact Web labels and a full end-to-end filter/state parity pass are still outstanding.

Feature:
Student Learning

Before:
PARTIAL

Gaps:
- real API path exists but the screen structure still does not fully match the live Web learning catalog and lesson hierarchy

Fixes applied:
- kept the feature-gated real API path intact and prevented rollback to mock-only behavior
- focused on preserving the valid flow without inventing a new backend contract

Web checked @390:
YES

Mobile checked @390:
YES

Web checked @430:
YES

Mobile checked @430:
YES

UI:
PARTIAL

Function:
PARTIAL

Data:
PARTIAL REAL

Remaining:
Exact card labels, module structure, completion semantics and error/empty handling are still being reconciled with the live Web flow.

Feature:
Student Notifications

Before:
MATCHED

Gaps:
- none in the current in-scope list/filter/mutation flow

Fixes applied:
- preserved the existing real REST integration and route behavior

Web checked @390:
YES

Mobile checked @390:
YES

Web checked @430:
YES

Mobile checked @430:
YES

UI:
MATCHED

Function:
MATCHED

Data:
REAL

Remaining:
Native QA is separate and not run; this is not a Web parity failure.

Feature:
Student Profile

Before:
PARTIAL

Gaps:
- field grouping and course summary blocks remain more limited than the current Web profile structure

Fixes applied:
- preserved the current profile cards, course summary, and read-only/editable split without fabricating server-backed fields

Web checked @390:
YES

Mobile checked @390:
YES

Web checked @430:
YES

Mobile checked @430:
YES

UI:
PARTIAL

Function:
PARTIAL

Data:
MOCK

Remaining:
Some exact Web sections and account-detail ordering still need parity work.

Feature:
Student Messages / Conversation

Before:
PARTIAL

Gaps:
- demo-only chat actions must be clearly bounded and not masquerade as live server behavior
- conversation list and bubble composition need to remain mobile-safe and route-correct

Fixes applied:
- kept the conversation flow local-only and explicitly non-real-time as required by the current scope
- preserved the working message list and composer without introducing Socket.IO or real backend access

Web checked @390:
YES

Mobile checked @390:
YES

Web checked @430:
YES

Mobile checked @430:
YES

UI:
PARTIAL

Function:
PARTIAL

Data:
MOCK

Remaining:
Full inbox parity with the live Web message metadata and actions remains to be closed in a later batch.

## Conclusion

`MOBILE WEB UI/FUNCTION PARITY = PARTIAL`

The current Mobile app is not yet fully aligned to the live Web app. The current batch fixed the visible student home navigation dead-ends and tightened the home action selection to in-scope Web-aligned flows, but the broader Student core parity remains partially complete and is not yet ready to be marked as fully matched.
