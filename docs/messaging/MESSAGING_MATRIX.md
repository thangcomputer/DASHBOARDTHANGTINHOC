# MESSAGING MATRIX — Phase 3

**Status:** Derived from live code + Phase 8.24 / 8.24B docs. **No invented business rules.**  
**Legend:**

| Cell | Meaning |
|---|---|
| Y | Allowed by live pairing and/or contacts |
| N | Denied |
| Y* | Allowed with scope (branch / assignment) |
| D≠S | Discover ≠ Send (different rules) |
| CONFLICT | Contradictory sources — needs business decision |
| n/a | Not applicable / not modeled |

**ADMIN** in this matrix means elevated product roles **SUPER_ADMIN ∪ HIGH_ADMIN** unless a row splits them.

**Columns per pair:** discover | start | send | receive | notification | branch scope | tenant scope

- **start** ≈ may open/create thread (today: send succeeds or contact seed exists).
- **notification** = realtime chat receive (no persistent Notification on DM path).
- **tenant scope** = not enforced on live Message DM schema → recorded as `n/a (not enforced)`.

---

## 1. STUDENT → *

| Pair | discover | start | send | receive | notification | branch scope | tenant scope |
|---|---|---|---|---|---|---|---|
| STUDENT → TEACHER | Y* assigned | Y* | Y* assigned | Y | Y (realtime) | via assignment, not branch matrix | n/a (not enforced) |
| STUDENT → SUPPORT | Y (contacts; null-branch SUPPORT included) | Y | Y | Y | Y | send: unrestricted for SUPPORT peer; discover: soft branch OR null | n/a |
| STUDENT → STAFF | Y* same branch | Y* | Y* same branch | Y | Y | same branch (empty soft-allow on send) | n/a |
| STUDENT → ADMIN (HIGH) | **CONFLICT — REQUIRES BUSINESS DECISION** (pairing send Y; contacts 8.24B student does **not** list HIGH/SUPER) | CONFLICT | Y (pairing) | Y | Y | none | n/a |
| STUDENT → ADMIN (SUPER) | **CONFLICT** (contacts hide SUPER; pairing allow) | CONFLICT | Y (pairing) | Y (legacy mailbox paths exist) | Y | none | n/a |
| STUDENT → STUDENT | N | N | N | N | N | — | — |

---

## 2. TEACHER → *

| Pair | discover | start | send | receive | notification | branch scope | tenant scope |
|---|---|---|---|---|---|---|---|
| TEACHER → STUDENT | Y* assigned | Y* | Y* assigned | Y | Y | assignment | n/a |
| TEACHER → SUPPORT | Y | Y | Y | Y | Y | discover soft branch OR null; send unrestricted | n/a |
| TEACHER → STAFF | Y | Y | Y* same branch | Y | Y | same branch (empty soft-allow) | n/a |
| TEACHER → ADMIN (HIGH) | Y (contacts) | Y | Y | Y | Y | none | n/a |
| TEACHER → ADMIN (SUPER) | N discover (contacts: teacher does not load SUPER) / **CONFLICT** with pairing allow | CONFLICT | Y (pairing) | Y | Y | none | n/a |
| TEACHER → TEACHER | N | N | N | N | N | — | — |

---

## 3. SUPPORT → *

| Pair | discover | start | send | receive | notification | branch scope | tenant scope |
|---|---|---|---|---|---|---|---|
| SUPPORT → STUDENT | Y (all HV in contacts) | Y | Y | Y | Y | none (pairing) | n/a |
| SUPPORT → TEACHER | Y | Y | Y | Y | Y | none | n/a |
| SUPPORT → SUPPORT | Y (via staff list split — peers with SUPPORT) | Y | Y | Y | Y | none | n/a |
| SUPPORT → STAFF | Y | Y | Y | Y | Y | none | n/a |
| SUPPORT → ADMIN (HIGH) | Y | Y | Y | Y | Y | none | n/a |
| SUPPORT → ADMIN (SUPER) | N discover / **CONFLICT** pairing allow | CONFLICT | Y | Y | Y | none | n/a |

**Transport note:** SUPPORT↔* conversation tokens use `staff_<supportId>` on SUPPORT side.

---

## 4. STAFF → *

| Pair | discover | start | send | receive | notification | branch scope | tenant scope |
|---|---|---|---|---|---|---|---|
| STAFF → STUDENT | Y* same CN | Y* | Y* same branch | Y | Y | same branch | n/a |
| STAFF → TEACHER | Y* same CN | Y* | Y* same branch | Y | Y | same branch | n/a |
| STAFF → SUPPORT | Y (null-branch SUPPORT allowed in contacts) | Y | Y | Y | Y | discover soft; send unrestricted | n/a |
| STAFF → ADMIN (HIGH) | Y | Y | Y | Y | Y | none | n/a |
| STAFF → ADMIN (SUPER) | N discover / **CONFLICT** pairing allow | CONFLICT | Y | Y | Y | none | n/a |
| STAFF → STAFF | Partial (not primary contacts focus) / send allow | Y | Y | Y | Y | none | n/a |

---

## 5. ADMIN (elevated) → * (summary)

| Pair | discover | start | send | receive | notification | branch | tenant |
|---|---|---|---|---|---|---|---|
| SUPER → HIGH | Y (only HIGH in SUPER contacts) | Y | Y | Y | Y | none | n/a |
| SUPER → STAFF/SUPPORT/TEACHER/STUDENT | N in SUPER contacts matrix | **CONFLICT** vs pairing allow-all | Y (pairing) | Y | Y | none | n/a |
| HIGH → * | Y (full matrix) | Y | Y | Y | Y | optional query branch filter on contacts | n/a |

---

## 6. Broadcast (not private DM)

| Action | SUPPORT receives? | STAFF receives? | Notes |
|---|---|---|---|
| Admin → presence `users:online` full list | Y (`ALL_SUPPORT`) | Y (`ALL_STAFF`) | Presence, not DM |
| Socket broadcast `ALL_STUDENTS` | N (unless also student) | N | `ALL_STUDENT` room |
| Socket broadcast `ALL_TEACHERS` | N | N | `ALL_TEACHER` |
| Socket `ALL_BRANCH_*` | Y if in `ALL_SUPPORT_{code}` | Y if in `ALL_STAFF_{code}` | Branch rooms |
| Private DM | **Only exact recipient user room** | Same | Must not use ALL_* |

**Do not assume** Admin→ALL_SUPPORT vs ALL_STAFF exclusivity for product broadcasts until an explicit broadcast matrix is approved. Current register joins mean SUPPORT also sits in `ALL_STAFF` because transport is `staff` — **CONFLICT — REQUIRES BUSINESS DECISION** for any future “STAFF-only” broadcast intent.

---

## 7. Support A vs Support B (same student)

From architecture (delivery + conversationId):

| Check | Expected from design |
|---|---|
| Correct recipient | Message `receiverId` = Support A id; `notifyUser` → A's user room |
| Support B receives? | **No** (unless B is also a participant / wrong fan-out bug) |
| Unread independent | For 1:1 DM yes (separate `receiverId`). For group: **No** with global `isRead` |
| Inbox ordering | Per conversationId `staff_<A>__student_<S>` vs `staff_<B>__student_<S>` |
| Reconnect | Offline messages via sync/history; socket re-register rejoins `{userId}` |

Automated coverage: extend Phase 14 tests; isolation_fix / hardening cover staff distinct threads partially.

---

## 8. Branch examples

| Scenario | Policy source | Outcome |
|---|---|---|
| Student Branch A → Support (null or A) | contacts + pairing | Allow |
| Student Branch A → Support Branch B only | contacts may exclude if SUPPORT has other branch and no null OR; pairing still allow send to SUPPORT | **CONFLICT / soft** — document after product call |
| Student A → Staff Branch B | pairing deny; contacts deny | N |
| Student A → Staff Branch A | Y | Y |

---

## 9. Matrix authority stack

```text
1. pairing-matrix-824.md + messagingPairing.js     → SEND
2. contact-visibility-824b.md + GET /contacts      → DISCOVER
3. messagingRoles canAccessDirectConversation      → VIEW / TYPING / READ ACK
4. notifyUser user rooms                           → RECEIVE (private)
```

When 1 and 2 disagree → **CONFLICT — REQUIRES BUSINESS DECISION** (do not “fix” by inventing FE rules).
