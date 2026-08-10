# MESSAGING BUSINESS DECISIONS — Phase 3

**Status:** Conflict resolution / freeze for owner approval  
**Date:** 2026-08-10  
**Application code changed:** NO  
**Sources (no reinterpretation):**

- `docs/messaging/MESSAGING_BASELINE.md`
- `docs/messaging/ROLE_DEPENDENCY_MAP.md`
- `docs/messaging/MESSAGING_POLICY.md`
- `docs/messaging/MESSAGING_MATRIX.md`
- `docs/messaging/MESSAGING_ARCHITECTURE_REFACTOR_PLAN.md`
- `docs/messaging/pairing-matrix-824.md` (LIVE send ACL)
- `docs/messaging/contact-visibility-824b.md` (LIVE discovery)

---

## Governing principle (already documented)

Phase 8.24B states explicitly:

```text
Pairing send ACL remains Phase 8.24.
Contacts only control discovery.
```

Therefore **discover ≠ send is an intentional dual-layer**, not an accidental bug — until the owner chooses to converge them.

**Interim freeze for Phase 4 (if approved without further owner input):**

```text
canDiscoverContacts  ← contacts matrix (8.24B)
canSendMessage       ← pairing matrix (8.24)
canStartConversation ← discoverable OR existing participant + canSend
```

Anything that would **change** either matrix (expand discover, tighten send, invent BRANCH SUPPORT) remains **REQUIRES OWNER DECISION**.

---

# C1 — STUDENT → SUPER_ADMIN

```text
Decision ID: C1
Current behavior:
  Discover: NO — contact-visibility-824b: Student does not see SUPER in danh bạ.
  Send:     YES — pairing-matrix-824: STUDENT → SUPER/HIGH allow.
  Receive:  YES if message targeted at student (user room) or legacy paths involving admin mailbox.
  Start from danh bạ: NO (not discoverable).
  Start via known id / deep link / legacy thread: possible if canSend succeeds.

Business rule (DOCUMENTED INTENT — FREEZE):
  SUPER is not a student directory contact.
  Send ACL still allows STUDENT → elevated admin if recipient is resolved.
  Do not invent a new rule that forces discover==send without owner approval.

Allowed:
  Send to SUPER when recipient id resolves and pairing allows.
  Receive replies on that thread.

Denied:
  SUPER appearing in Student contacts list (8.24B).

Discoverable: NO
Branch scope: none (elevated)
Tenant scope: n/a (not enforced on live DM Message)

Reason:
  Explicit note in contact-visibility-824b.md separating discovery from send;
  student/teacher/support/staff do not see SUPER (except HIGH sees SUPER).

Affected APIs:
  GET /api/messages/contacts
  POST /api/messages (pairing)
  GET history / sync for existing threads

Affected Socket events:
  message:send → sendCanonicalMessage
  message:receive (user-specific; admin legacy may use admin + ALL_ADMIN)

Affected frontend:
  Inbox contacts / tabs must not seed SUPER for students.
  FE must not “fix” by adding SUPER to student danh bạ.

Migration risk: LOW if freeze; HIGH if converging (tighten send or expand discover).

STATUS: RESOLVED — FREEZE DOCUMENTED DUAL-LAYER
OWNER FOLLOW-UP (optional): converge discover↔send? STATUS = REQUIRES OWNER DECISION
```

---

# C2 — STUDENT → HIGH_ADMIN

```text
Decision ID: C2
Current behavior:
  Discover: NO — student contacts row lists STAFF (same branch), SUPPORT, assigned teachers only.
              HIGH is not in the student contacts table (8.24B).
  Send:     YES — pairing STUDENT → SUPER/HIGH allow.
  Receive:  YES on targeted threads.
  Start from danh bạ: NO.
  Note: TEACHER does discover HIGH; STUDENT does not — asymmetric by design in 8.24B table.

Business rule (DOCUMENTED INTENT — FREEZE):
  HIGH_ADMIN is not a student directory contact under 8.24B.
  Pairing still allows send to elevated product roles.

Allowed: send if recipient resolved; receive on thread
Denied: HIGH in Student contacts
Discoverable: NO
Branch scope: none
Tenant scope: n/a (not enforced)

Reason: contact-visibility-824b student row + pairing allow-list dual-layer.

Affected APIs: /contacts, POST /, conversation history
Affected Socket events: message:send / message:receive (user room / elevated delivery rules)
Affected frontend: no student HIGH seed; do not invent HIGH tab for students
Migration risk: LOW if freeze; MEDIUM if owner wants students to discover HIGH

STATUS: RESOLVED — FREEZE DOCUMENTED DUAL-LAYER
OWNER FOLLOW-UP: Should students discover HIGH_ADMIN? STATUS = REQUIRES OWNER DECISION
```

---

# C3 — SUPPORT SCOPE (GLOBAL vs BRANCH)

```text
Decision ID: C3
Current behavior:
  Product code does NOT define distinct types “GLOBAL SUPPORT” vs “BRANCH SUPPORT”.
  Pairing: SUPPORT sender has no branch scope (assertPairScope early-allow).
  Contacts (SUPPORT caller): loads ALL students, ALL teachers, ALL STAFF, HIGH — no branch filter.
  Contacts (other callers discovering SUPPORT): often soft-include SUPPORT with
    same branch OR null/missing branchId.
  Transport: SUPPORT → staff (compatibility; unchanged).

Business rule:
  Cannot invent BRANCH SUPPORT product semantics from existing docs alone.
  Documented live intent = SUPPORT operates as globally scoped for send + SUPPORT’s own contact list.

Questions for owner (not answered by docs):
  Can global SUPPORT contact all students?          → live YES; confirm product
  Can branch SUPPORT contact only its branch?       → type does not exist in docs
  Can branch SUPPORT contact teachers in branch?    → type does not exist
  Can SUPPORT contact another SUPPORT?              → live YES (pairing + contacts)
  Can SUPPORT contact STAFF?                        → live YES
  Student → Support receive globally or branch?     → send ACL global; discover soft-branch

Allowed (FREEZE LIVE until owner defines BRANCH SUPPORT):
  SUPPORT ↔ STUDENT / TEACHER / STAFF / SUPPORT / HIGH (per pairing + contacts)
  SUPPORT does not discover SUPER (8.24B); send to SUPER still pairing-allow (dual-layer)

Denied (live discovery):
  SUPER in SUPPORT danh bạ

Discoverable: per 8.24B SUPPORT row
Branch scope: none for SUPPORT-as-sender (pairing); soft for others discovering SUPPORT
Tenant scope: n/a (not enforced)

Reason: live pairing + contacts; no documented BRANCH SUPPORT entity.

Affected APIs: /contacts, POST /, pairing assertPairScope
Affected Socket events: private DM user rooms only (not ALL_SUPPORT for 1:1)
Affected frontend: Support inbox sees wide contact set from API
Migration risk: HIGH if introducing BRANCH SUPPORT (contacts + pairing + tests)

STATUS: PARTIAL FREEZE (live = global SUPPORT)
         BRANCH SUPPORT product model = REQUIRES OWNER DECISION
         Soft discover filter (null OR same branch) for Student/Teacher/Staff → SUPPORT
           confirm intentional = REQUIRES OWNER DECISION
```

---

# C4 — STAFF ↔ SUPPORT

```text
Decision ID: C4
Current behavior:
  STAFF → SUPPORT:
    Discover: YES (contacts; SUPPORT with same branch OR null branch)
    Send:     YES (pairing; no branch restriction vs SUPPORT)
    Receive:  YES (user-specific thread)
  SUPPORT → STAFF:
    Discover: YES (SUPPORT contacts load adminRole STAFF)
    Send:     YES
    Receive:  YES
  Branch scope: discover soft for STAFF→SUPPORT; send unrestricted both ways
  Tenant scope: n/a (not enforced)

Business rule (DOCUMENTED / LIVE ALIGNED — FREEZE):
  STAFF and SUPPORT may discover and message each other.
  Private threads are per-user (staff_<id>), not ALL_STAFF / ALL_SUPPORT.

Allowed:
  STAFF ↔ SUPPORT discover, start, send, receive

Denied:
  Using role rooms for private STAFF↔SUPPORT DM

Discoverable: YES (both directions per 8.24B)
Branch scope: soft on STAFF discovering SUPPORT (null branch included); send unrestricted
Tenant scope: n/a (not enforced)

Reason: pairing allow + contact-visibility STAFF/SUPPORT rows agree on allow.

Affected APIs: /contacts, POST /
Affected Socket events: message:send/receive via notifyUser(userId)
Affected frontend: Staff / Support tabs (display only)
Migration risk: LOW

STATUS: RESOLVED — FREEZE LIVE ALIGNED RULES
OWNER FOLLOW-UP: Must STAFF only see SUPPORT in same branch (exclude null)? 
                 STATUS = REQUIRES OWNER DECISION (tighten discover only)
```

---

# C5 — LEGACY `admin_admin` vs PER-USER ELEVATED ADMIN

```text
Decision ID: C5
Current behavior:
  pairing-matrix-824:
    Legacy admin_admin__student_* remains SUPER/HIGH shared mailbox.
    STAFF/SUPPORT never inherit it.
    Per-peer MongoId elevated admins use admin_<mongoId> tokens.
    Read alias admin_<mongoId> ↔ staff_<mongoId> for mislabelled history.
  utils/chatConversationId.js still special-cases student↔transport admin
    into shared admin_admin mailbox (compatibility surface).
  Phase 8.24 goal: one conversation per real peer pair for non-legacy cases.

Business rule (DOCUMENTED — FREEZE COMPATIBILITY):
  KEEP legacy admin_admin for SUPER/HIGH shared student mailbox.
  KEEP per-user elevated threads for real MongoId HIGH/SUPER peers.
  DO NOT delete legacy compatibility until replacement proven.
  DO NOT migrate Message documents in this phase.

Allowed:
  SUPER/HIGH access to legacy admin_admin threads
  Per-user admin_<id> threads with concrete elevated users

Denied:
  STAFF/SUPPORT inheriting admin_admin mailbox
  Blind bulk rewrite of conversationIds

Discoverable: N/A (mailbox identity, not contact row)
Branch scope: none for legacy mailbox
Tenant scope: n/a

Reason: pairing-matrix-824 anti-duplicate + out-of-scope “no bulk delete”.

Affected APIs: GET conversation, PUT read, alias expansion, POST send conversationId build
Affected Socket events: typing/read peer rooms → admin + ALL_ADMIN for legacy token
Affected frontend: must not map STAFF/SUPPORT into admin_admin
Migration risk: CRITICAL if removed early

STATUS: RESOLVED — KEEP LEGACY + PER-USER SIDE BY SIDE
OWNER FOLLOW-UP: Should student↔admin special-case in buildConversationId eventually
                 route only to per-user HIGH, never shared mailbox?
                 STATUS = REQUIRES OWNER DECISION (future cleanup only)
```

---

# C6 — JWT `role=admin` + `adminRole` undefined

```text
Decision ID: C6
Current behavior:
  messagingPairing.resolveProductRole:
    role=admin && !adminRole → treated as SUPER_ADMIN product hint.
  messagingIdentity: role=admin without adminRole and id≠admin → display UNKNOWN
    (does not elevate to SUPER by transport alone when id is MongoId).
  Authentication / JWT issuance: OUT OF SCOPE — do not change.

Business rule (MESSAGING INTERPRETATION ONLY — FREEZE):
  For messaging productRole resolution: keep current pairing interpretation
  (admin without adminRole ≈ SUPER_ADMIN hint) until owner changes messaging policy.
  Do not change auth middleware or JWT claims in messaging phases.

Allowed: current resolveProductRole behavior continues
Denied: changing JWT / auth to “fix” messaging in this phase
Discoverable: depends on resolved productRole after interpretation
Branch scope: n/a
Tenant scope: n/a

Reason: documented in pairing code + architecture plan conflict C6; auth frozen.

Affected APIs: any path calling resolveProductRole / getMessagingRole
Affected Socket events: register room joins if user hits this shape
Affected frontend: displayRole may show UNKNOWN while productRole elevates — known tension
Migration risk: MEDIUM (ambiguous accounts)

STATUS: RESOLVED — FREEZE CURRENT MESSAGING INTERPRETATION (NO AUTH CHANGE)
OWNER FOLLOW-UP: Prefer DENY / UNKNOWN productRole when adminRole missing?
                 STATUS = REQUIRES OWNER DECISION
```

---

# C7 — GROUP UNREAD (per-user read state)

```text
Decision ID: C7
Current behavior:
  Message.isRead / readAt / receiverId — message-level global flag.
  Acceptable for strict 1:1 DM (single receiverId).
  Groups: marking read can affect shared message state — NOT independent per participant.
  Architecture plan: design ConversationParticipant; do NOT migrate yet.

Business rule:
  1:1 DM: KEEP Message.isRead temporarily (compatibility).
  Multi-participant / group: IF product requires independent unread, target
    ConversationParticipant { conversationId, userId, role, lastReadAt, unreadCount }
  but DO NOT implement migration until owner confirms need and Phase 10 approved.

Required acceptance intent (from master plan — design target, not live):
  Support A read ≠ Support B read when both are participants.
  Non-participants must stay unreadCount 0.

Allowed (now): 1:1 unread via isRead
Denied (now): claiming group unread is per-user correct
Discoverable: n/a
Branch scope: n/a
Tenant scope: n/a

Reason: baseline + architecture plan Phase 10; no schema change without dedicated phase.

Affected APIs (future): /read, /unread, conversations.unreadCount
Affected Socket events (future): message:read / read_ack
Affected frontend (future): badges from participant unread
Migration risk: HIGH

STATUS: DESIGN HOLD — NO MIGRATION
         Product requirement “groups need per-user unread” = REQUIRES OWNER DECISION
```

---

# C8 — SUPPORT joins ALL_STAFF (broadcast coupling)

*(Related conflict from matrix §6; not private DM leakage by design.)*

```text
Decision ID: C8
Current behavior:
  SUPPORT transportRole=staff → register also joins ALL_STAFF.
  SUPPORT also joins ALL_SUPPORT via adminRole.
  Private DM must not use these rooms (notifyUser user-specific).

Business rule:
  KEEP room joins until Phase 12 proves safe removal.
  Do NOT assume private DM leakage without failing isolation tests.

Allowed: presence / system broadcast consumers as today
Denied: using ALL_STAFF for student→one support DM
Owner question: Must “STAFF-only” broadcasts exclude SUPPORT?
STATUS: REQUIRES OWNER DECISION (product broadcast exclusivity)
         Technical keep = FREEZE until Phase 12 + tests
```

---

# C9 — SUPER discover asymmetry (non-student callers)

```text
Decision ID: C9
Current behavior:
  TEACHER / SUPPORT / STAFF: do not discover SUPER; pairing still allow send.
  SUPER contacts: only HIGH_ADMIN (cannot discover STAFF/SUPPORT/TEACHER/STUDENT in danh bạ)
    while pairing allows SUPER → all.

Business rule (DOCUMENTED DUAL-LAYER — FREEZE):
  Same principle as C1: contacts stricter than send; intentional per 8.24B notes.

STATUS: RESOLVED — FREEZE DOCUMENTED DUAL-LAYER
OWNER FOLLOW-UP: Should SUPER danh bạ expand, or send tighten to match contacts?
                 STATUS = REQUIRES OWNER DECISION
```

---

## Summary table

| ID | Topic | STATUS |
|---|---|---|
| C1 | STUDENT → SUPER | **RESOLVED** freeze dual-layer; converge = owner |
| C2 | STUDENT → HIGH | **RESOLVED** freeze dual-layer; discover HIGH = owner |
| C3 | SUPPORT global vs branch | **PARTIAL**; BRANCH SUPPORT = **OWNER** |
| C4 | STAFF ↔ SUPPORT | **RESOLVED** freeze allow both ways |
| C5 | admin_admin vs per-user | **RESOLVED** keep both; future cleanup = owner |
| C6 | JWT admin w/o adminRole | **RESOLVED** freeze messaging interpretation; prefer DENY = owner |
| C7 | Group unread | **DESIGN HOLD**; need per-user = **OWNER** |
| C8 | SUPPORT on ALL_STAFF | **FREEZE** joins; STAFF-only broadcast = **OWNER** |
| C9 | SUPER discover asymmetry | **RESOLVED** freeze dual-layer; converge = owner |

---

## What Phase 4 may encode without further owner input

If owner approves this document **as freeze**:

1. Keep SUPPORT `transportRole = staff`.
2. Keep `sendCanonicalMessage` as sole private DM service.
3. Implement MessagingPolicy wrappers that **delegate**:
   - discover → 8.24B contacts rules
   - send → 8.24 pairing rules
4. Do **not** invent BRANCH SUPPORT.
5. Do **not** migrate unread / Conversation collection.
6. Do **not** remove `admin_admin` compatibility.
7. Do **not** change JWT/auth.

## What Phase 4 must NOT assume

- Discover always equals send
- BRANCH SUPPORT exists
- SUPPORT excluded from ALL_STAFF for product “staff-only” broadcasts
- Group per-user unread is live
- Student danh bạ should list HIGH or SUPER

---

## Approval gate

```text
Next required action:
  APPROVE BUSINESS MATRIX (this file)

Until explicitly approved:
  DO NOT start Phase 4 application code
```
