# Mobile Web UI/UX Parity Closure

## Result

**`MOBILE UI/UX PARITY READY`**

The 22 concrete UI gaps recorded in Prompt 10 were addressed in the Expo app and reclassified only after their corresponding controls, content or flows were added. The existing five-tab navigation and Student/Teacher role split remain unchanged.

| Role | Total | ALIGNED | PARTIAL | WEB-ONLY | MISSING |
|---|---:|---:|---:|---:|---:|
| Student | 24 | 23 | 0 | 1 | 0 |
| Teacher | 31 | 30 | 0 | 1 | 0 |
| **Total** | **55** | **53** | **0** | **2** | **0** |

The row-by-row classification is in [`MOBILE_PARITY_SCREEN_MATRIX.md`](./MOBILE_PARITY_SCREEN_MATRIX.md).

## Prompt 10 gaps closed

| IDs | Changes |
|---|---|
| S06, T10 | Added local mock chat attachment, sticker, GIF and reaction pickers with visible sent/selected state. No file or media upload is performed. |
| S11, T23 | Added pressable software link rows; missing demo links show an explicit unavailable response rather than a dead action. |
| S13 | Added sample-file selection, selected-file/removal state and a local submission state; the assignment's attached source file is kept separate from the learner's submission. |
| S14 | Added course-grouped grade and assessment history with empty/loading/error states. |
| S16, T12 | Enabled the Student feed composer; Teacher feed supports current-user post edit/delete confirmation, threaded replies, reactions and multi-post pagination. |
| S17 | Exposed News search, topic, sort, period and list/grid controls to Student as well as Teacher. |
| S18, T27 | Added news author/excerpt metadata and typed image/video/file attachment rows with safe demo-open responses. |
| S20 | Made Student Center section navigation interactive and aligned section labels to the current web sections. |
| S21 | Added enrollment and video-order UI; numeric enrollment, tuition and video-order examples are isolated to an explicitly labelled QA fixture. Default mock accounts show only available course context, `—` for unverified tuition/grades and an empty video-order state. |
| S22, T29 | Added role-visible password-change form, minimum-length and confirmation validation, and a local-only completion state. |
| S23 | Added per-enrollment tuition, paid amount, outstanding amount and payment state, with an explicit confirmation modal for a demo-only state update. |
| S24, T30 | Added web notification category aliases and explicit supported routes; unsupported/unknown destinations remain on the notification detail with an explanatory message instead of routing to CenterInfo. |
| T14 | Added the optional “Link File đề bài (Google Drive...)” field and a visible local link preview action. |
| T15, T22 | Added explicit file open actions for assignment submissions and training materials; missing links are stated rather than presented as working downloads. |
| T18 | Added learner search, select-all-visible and clear-selection controls to quiz targeting. |

## QA evidence

| Check | Result |
|---|---|
| Expo Web app load and role flows | PASS — demo Teacher and Student sessions opened their role-specific screens; five tabs remained visible. |
| Chat picker | PASS — Teacher conversation exposed attachment/sticker/GIF/reaction actions; selecting a GIF rendered a local message with sent state. |
| Feed | PASS — `feed-multiple` rendered the older-post action and threaded replies; composer created an owned post with edit/delete controls. Edit entry opened its editor. |
| Student assignment | PASS — sample file picker → selected filename → demo submit → submitted status and disabled repeat submission. |
| News | PASS — `news-multiple` exposed filters/layout controls; detail rendered author, excerpt and typed attachment action. |
| Teacher quiz targeting | PASS — course-based student list, search, select-all-visible and clear-selection updated visible selected markers. |
| Notifications | PASS — 25-item fixture paged 20 + 5 records and exposed web categories; unknown routes retain safe detail. |
| Student Profile/Tuition | PASS — `student-profile-populated` rendered multiple QA-only enrollments and video orders with a visible fixture notice; payment confirmation updated only local UI state. Without that fixture, the default account showed `—` for tuition and an empty video-order state, with no fixture amounts or orders. |
| Student grade history | PASS — `grades-completed` rendered its explicitly labelled QA-only records; default mode showed no grade records. |
| Password form | PASS — mismatch validation displayed; matching demo input completed the local form flow. |
| Representative responsive regression | PASS — Feed, NewsDetail and Conversation at 320, 360, 375, 390, 412, 430 and 768 CSS px; document/body widths matched each viewport. |
| Student Profile/Tuition responsive regression | PASS — default and populated QA Profile, Tuition cards and payment confirmation modal at 320, 360, 375, 390, 412, 430 and 768 CSS px; document/body widths matched each viewport. |
| Complete responsive traversal of every screen | NOT RUN — responsive coverage is representative, not exhaustive. |
| Full screenshot-by-screenshot comparison of all 55 rows | NOT RUN — classification is based on source/component/field/control/state/flow inventory and representative visual review. |
| TypeScript | PASS — `npm run typecheck`. |
| Expo compatibility | PASS — `npx expo install --check` reports dependencies up to date. |
| Whitespace | PASS — `git diff --check` and explicit trailing-whitespace scan of edited mobile source/docs. |
| Dead actions found in newly reviewed flows | 0 observed; demo-only and unavailable-link actions show a local state, dialog or explanation. |
| Android/iOS native QA | NOT RUN. |
| Backend / production auth / API / Socket.IO / upload / payment / export connected | NO. |
| Website/backend modified | NO. |
| Student scope changed beyond the requested Student parity work | NO. |
| Dependency manifest or lockfile changed | NO. |
| Git add/commit/push/merge | NO. |

`WEB-ONLY` remains for Student exam/certification attempts and Teacher onboarding test. `Backend = NOT CONNECTED` and `Native QA = NOT RUN` are separate readiness gates and do not make UI/UX PARTIAL.

The Expo Web checks are not Android/iOS device verification and do not claim pixel-perfect parity. QA-only sample scores and monetary values are not default account data. No backend integration work was started.
