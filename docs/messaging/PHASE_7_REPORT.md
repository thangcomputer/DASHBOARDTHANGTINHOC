# Phase 7 Report

## Objective

Remove remaining **live** frontend messaging policy duplication, harden deep-link / `seedContact` so it cannot invent discoverable peers, and prove `MessagesContext.jsx` has no live execution path.

## Files inspected

- `docs/messaging/PHASE_6_REPORT.md` (+ prior phase docs)
- `client/src/components/Inbox.jsx`
- `client/src/components/FloatingMessenger.jsx`
- `client/src/utils/supportPresence.js`
- `client/src/context/FloatingMessengerContext.jsx`
- `client/src/context/useDataMessaging.js`
- `client/src/context/MessagesContext.jsx`
- `client/src/context/DataContext.jsx`
- `client/src/App.jsx`
- `client/src/components/DashboardLayout.jsx`
- Call sites: `AdminEvaluationsTab` (`selectUserId`), `openSiteChat` (teacher cards, FeedBoard import)

## Frontend policy duplication found

| Location | Class | Issue |
|---|---|---|
| Inbox `seedContact` + `selectUser` auto-select | **A** | Invented new conversation for any `location.state.selectUser` without contacts/activity check |
| `isSuperAdminViewer` used as directory mode | **A** | STAFF/SUPPORT treated as “super” → local `staffs` + online presence directory |
| FloatingMessenger `effectiveStaffs = isSuper ? staffs : fmContacts` | **A** | Staff/Support skipped `/contacts` |
| Inbox tabs / badges | **B** | Presentation only |
| `getMessagingRole` / `buildConversationId` | **C** | Transport identity for IDs |
| `getConversations` message→peer resolve | **D** | Conversation cache display |
| `MessagesContext` seeds | **E** | Unmounted |

## Frontend policy duplication removed

1. **Deep-link UX gate** — `resolveMessagingDeepLink` (client + `utils/messagingDeepLink.js`): allow open only if peer ∈ `/contacts` **or** existing DM activity.
2. **Inbox** — removed synthetic `selectConversation({...})` invent path; waits `contactsLoaded`; `seedContact` gated.
3. **`isElevatedPresenceDirectoryViewer`** — SUPER/HIGH/root only for presence directory.
4. **FloatingMessenger** — STAFF/SUPPORT/Teacher/Student fetch `/contacts`; empty → empty (no staffs fallback).
5. **`cms:open-chat` / `openSiteChat`** — gated via contacts + existing conversations (`FloatingMessengerProvider`).

## Deep-link behavior

Sources:

- `location.state.selectUser` / `selectUserId` (e.g. AdminEvaluationsTab)
- `openSiteChat` / `cms:open-chat` custom event

Flow after Phase 7:

```text
deep link
  → identify peer
  → existing conversation activity? → open (Case A)
  → peer in GET /contacts? → open (authorized contact)
  → else → do NOT invent discoverable peer (Case B)
```

UX gate only — **send** still enforced by MessagingPolicy on server.

## seedContact behavior

- Stores navigation intent only.
- Merged into list **only** when `resolveMessagingDeepLink` allows.
- Prefer contact API metadata (`productRole`, `transportRole`, `adminRole`) when present.

## Existing conversation behavior

**Case A:** Peer not in `/contacts` but present in message-derived `getConversations` → remains visible and selectable. Not treated as forbidden merely because undiscoverable.

## New conversation behavior

**Case B:** No existing activity + not in `/contacts` → frontend does not create a normal new conversation row or auto-open a synthetic thread.

## MessagesContext reachability

```text
LEGACY / UNMOUNTED / NO LIVE EXECUTION PATH
```

- Not imported by `App.jsx`
- `MessagesProvider` / `useMessagesContext` have **zero** live importers outside the file itself
- `DataProvider` uses `useDataMessaging` only
- Header comment updated Phase 7

Legacy content (documented, not copied): old student/teacher/staff contact seeds, weak role normalization, admin_admin assumptions.

## SUPPORT/STAFF handling

- Contacts API fields preserved on Inbox rows (`productRole`, `adminRole`, `transportRole`)
- Floating directory prefers `productRole` when filtering ops contacts; SUPPORT not forced to product STAFF
- `transportRole = staff` unchanged for both

## Contact empty-state

`GET /contacts = []` → Inbox contacts empty; FloatingMessenger non-elevated directory empty; no staffs/teachers/students fallback.

## Inbox ordering regression

Unchanged: `mergeConversationsById` + `sortConversationsByLastMessageAt` + message activity. Phase 823 suite **PASS**.

## Socket regression

No changes to rooms, `notifyUser`, typing/read events, or send path. Incoming `openChat` from `onMessageReceive` still direct (existing message activity).

## Tests

- **NEW** `tests/integration/phase7_frontend_messaging_policy_cleanup.test.js` — PASS
- phase4 / 5 / 5.1 / 6 / 821–824 / isolation_fix / hardening — PASS
- Frontend `vite build` — PASS

## Known environment failures

- `tests/messaging-isolation.test.js` — prior ENVIRONMENT FAILURE (401), unchanged
- Live multi-client Socket.IO browser harness — **NOT TESTED — infrastructure limitation**

## Remaining risks

1. SUPER/HIGH presence directory still lists online users (elevated intentional) — not contact-matrix scoped.
2. `isSuperAdminViewer` remains broad for FeedBoard UI chrome (not used for contact invention after Phase 7).
3. Dual-layer DISCOVER≠SEND: Student→HIGH may open via **existing** conversation or server send, but not via empty discovery invent.
4. `MessagesContext` still contains old seeds if remounted accidentally.
5. Deep-link util duplicated ESM (`client/src/utils`) + CJS (`utils/`) — keep logic aligned.

## Rollback

Revert Inbox deep-link gate, FloatingMessenger elevated split, FloatingMessengerContext open-chat gate, supportPresence elevated helper, DashboardLayout `getConversations` prop. No schema/JWT changes.

## Next phase

**STOP** — await approval for Phase 8.
