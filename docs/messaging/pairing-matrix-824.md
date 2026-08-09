# Messaging pairing matrix — Phase 8.24

**Status:** LIVE messaging ACL  
**Enterprise:** untouched / SHADOW ONLY  

## Goal

One conversation per real peer pair; allow-list who may message whom; never trust client `receiverRole` for `conversationId`.

## Transport map

| Product role | Transport (`conversationId`) |
|---|---|
| SUPER_ADMIN / HIGH_ADMIN / `id=admin` | `admin` |
| STAFF | `staff` |
| SUPPORT | `staff` (+ `adminRole: SUPPORT` on identity) |
| TEACHER | `teacher` |
| STUDENT | `student` |

## Pairing allow-list

| Sender \ Peer | SUPER/HIGH | STAFF | SUPPORT | TEACHER | STUDENT |
|---|---|---|---|---|---|
| SUPER/HIGH | allow | allow | allow | allow | allow (`admin_admin` mailbox) |
| STAFF | allow | allow | allow | same branch | same branch |
| SUPPORT | allow | allow | allow | allow | allow |
| TEACHER | allow | same branch | allow | **deny** | assigned only |
| STUDENT | allow | same branch | allow | assigned only | **deny** |

## Anti-duplicate rules

1. `resolveCanonicalPeer` loads peer from DB → `getMessagingRole(peer)`.
2. `sendCanonicalMessage` builds id via `buildCanonicalConversationId` — **ignores wrong client role**.
3. Client sending `receiverRole: 'admin'` for a STAFF MongoId still yields `staff_<id>__…`.
4. Read alias: `admin_<mongoId>__…` ↔ `staff_<mongoId>__…` on GET/read (no DB migrate).
5. Legacy `admin_admin__student_*` remains SUPER/HIGH shared mailbox; STAFF/SUPPORT never inherit it.

## Code

- [`services/messagingPairing.js`](../../services/messagingPairing.js)
- [`services/chatAccessService.js`](../../services/chatAccessService.js) → delegates to pairing
- [`services/directMessageService.js`](../../services/directMessageService.js)
- Contacts + Inbox tabs: Admin / Staff / Support

## Out of scope

- New transport role `support` (would rewrite all IDs)
- Bulk delete of legacy mislabelled messages
- Enterprise PRIMARY
