# Contact visibility matrix — Phase 8.24B

Authority: `GET /api/chat/contacts` in [`routes/messageRoutes.js`](../../routes/messageRoutes.js).

| Caller | Sees in danh bạ |
|---|---|
| **STUDENT** | STAFF cùng chi nhánh, SUPPORT, GV được phân công |
| **TEACHER** | HIGH_ADMIN, STAFF, SUPPORT, HV được phân công |
| **SUPPORT** | STAFF (admin chi nhánh), HIGH_ADMIN, GV, HV |
| **STAFF** | SUPPORT, GV (+ HV cùng CN), HIGH_ADMIN |
| **SUPER_ADMIN** | chỉ HIGH_ADMIN |
| **HIGH_ADMIN** | toàn bộ (SUPER, STAFF, SUPPORT, GV, HV, HIGH khác) |

Notes:

- Student / Teacher / Support / Staff **không** thấy SUPER trong danh bạ (trừ HIGH thấy SUPER).
- STAFF vẫn thấy HV cùng chi nhánh để làm nghiệp vụ (bổ sung so với mô tả chữ nếu thiếu).
- Pairing send ACL vẫn theo Phase 8.24; contacts chỉ điều khiển discovery.
