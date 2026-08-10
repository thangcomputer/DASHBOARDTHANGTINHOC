# MESSAGING RUNTIME FREEZE — LOCKED

**Status:** LOCKED — do not change messaging code unless the owner explicitly unlocks  
**Date:** 2026-08-11  
**Owner instruction:** *「Hiện tại luồng tin nhắn ổn định — khóa lại không sửa nữa」*

---

## 1. Scope of freeze

Frozen surfaces (no edits without unlock):

| Area | Canonical path |
|---|---|
| Send ACL | `services/messagingPolicy.js` → `canSendMessage` / `assertCanDirectMessage` |
| Pairing / peer resolve | `services/messagingPairing.js` |
| Contacts discover | `services/messagingContactsService.js` + `canDiscoverContacts` |
| Private DM delivery | `services/directMessageService.js` (`sendCanonicalMessage`) |
| REST messages | `routes/messageRoutes.js` + cutover `middleware/messagesCutoverGate.js` |
| Socket send / typing / read | `server.js` messaging handlers |
| Presence broadcast | `server.js` `broadcastOnlinePresence` + register rooms |
| FE inbox / send / toast | `client/src/components/Inbox.jsx`, `useDataMessaging.js`, `api.js` messages |
| Transport identity | SUPPORT remains `transportRole=staff` |

Out of freeze (may continue elsewhere): Redis/cache, finance, RBAC enterprise shadow, Phase 12 ERP — **unless they touch the files above**.

---

## 2. Locked runtime behavior (proven live)

| Pair | Send | Notes |
|---|---|---|
| STAFF ↔ SUPPORT | ALLOW | Org-wide SUPPORT tenant soft-align |
| STAFF ↔ TEACHER / STUDENT | ALLOW* | Soft-allow empty branch; tenant soft-align; hard cross-branch DENY |
| TEACHER ↔ STUDENT | ALLOW* | Assignment ACL; tenant soft-align if branch/tenant missing |
| TEACHER / STUDENT → SUPPORT | ALLOW | Discover + send; unscoped actor may inherit SUPPORT tenant |
| Cross **real** Tenant ObjectId | DENY | Fail-closed; soft-align never coerces two real tenants |
| STUDENT ↔ STUDENT / TEACHER ↔ TEACHER | DENY | Structural |

\* Same-branch / soft-branch / assigned as per Phase 8.24 pairing — not a redesign.

**Presence:** STAFF / SUPPORT / SUPER / HIGH receive **full** `users:online` via `ALL_*` and must **not** join `presence_*` (avoids overwrite that hid branchless teachers from Staff).

**Cutover:** `POLICY_CUTOVER` for `messages` stays on; DM deny may surface policy `message` text to FE.

---

## 3. Known data caveats (ops, not code)

- Teacher without `branchId` / `branchCode` is **supported** by soft-align; still recommended to assign a branch in admin.
- `Challenge.exe` (or similar) may bind `127.0.0.1:5000`; Vite proxy uses `[::1]:5000` — do not “fix” by rewriting presence/messaging for that.

---

## 4. Unlock rule

To change messaging again, the owner must explicitly say e.g. **「mở khóa messaging」** or **「unlock messaging freeze」** and name the defect/feature.

Until then:

```text
NO messaging policy / pairing / contacts / DM / presence / inbox-send patches.
NO Phase 12 messaging redesign.
Regression tests for the locked paths may be added only if they assert current behavior (no behavior change).
```

---

## 5. Related authorities (unchanged)

- `docs/messaging/MESSAGING_BUSINESS_DECISIONS.md`
- `docs/messaging/pairing-matrix-824.md`
- `docs/messaging/contact-visibility-824b.md`
- Phase 4–10 reports under `docs/messaging/`

## 6. Allowed exception (2026-08-11)

Owner reported SUPPORT avatar/badge mismatch (sidebar male vs inbox list female + AD).
**UI-only** fix allowed under freeze: `defaultAvatars.js` (SUPPORT brand ignores leftover gender), Inbox badge HT, shared `Avatar.jsx` SUPPORT ring/badge. No send/pairing/policy changes.
