# Mobile Auth Integration Contract

Contract này ghi nhận hành vi được xác minh từ auth implementation hiện tại và test tích hợp cô lập. Không bao gồm API giả định hoặc Mobile client implementation.

## Feature flag và role

- `MOBILE_MULTI_SESSION_AUTH` mặc định OFF; `.env.example` đặt `false`, và giá trị không có cũng được coi là OFF.
- Khi OFF, `POST /api/auth/login/mobile` trả `404` với `code: "MOBILE_SESSION_AUTH_DISABLED"`.
- Khi bật, mobile login chỉ chấp nhận role `student` hoặc `teacher`; `admin`/`staff` bị từ chối.
- Teacher `inactive`, `suspended`, hoặc đang bị khóa bị chặn. Teacher `pending` hiện được phép login theo cùng status rule với legacy public login; role vẫn là `teacher`.

## CSRF acquisition và request

1. Gọi `GET /api/auth/csrf-token`.
2. Lấy `csrfToken` từ JSON và cookie `csrf_token` từ `Set-Cookie`.
3. Với mọi request thay đổi dữ liệu dưới `/api`, gửi cookie cùng header `X-CSRF-Token` có cùng giá trị.

Cookie CSRF hiện được cấu hình `httpOnly: false`, `sameSite: lax`, `path: /`, `secure` khi production và tuổi thọ 24 giờ. Mobile login, refresh, logout và DELETE session không được miễn CSRF. Thiếu/mismatch cookie-header trả `403 CSRF_INVALID`.

## Mobile login

`POST /api/auth/login/mobile`

Request fields:

```json
{
  "identifier": "<phone>",
  "password": "<password>",
  "role": "student",
  "platform": "android",
  "deviceLabel": "<optional, max 100 chars>",
  "appVersion": "<optional, max 50 chars>"
}
```

`phone` có thể thay cho `identifier`. `platform` phải là `android` hoặc `ios`. `clientType` không lấy từ request; server lưu session là `mobile`.

Thành công trả `200`:

```json
{
  "success": true,
  "data": {
    "user": { "_id": "<id>", "role": "student" },
    "accessToken": "<JWT>",
    "refreshToken": "<JWT>",
    "sessionId": "<sid>"
  }
}
```

Các token được trả trong JSON, không phải auth cookie. Access và refresh JWT có `aud: "mobile"`, `sid` và `jti`; refresh JTI hash được lưu trong AuthSession. Session expiry tuyệt đối được đặt theo expiry của refresh token ban đầu; refresh không kéo dài thời hạn tuyệt đối. TTL mặc định do cấu hình token hiện tại quyết định (access `8h`, refresh `30d` nếu không override).

Lỗi được xác minh/đọc từ handler:

| HTTP | Code/behavior |
| --- | --- |
| 400 | Thiếu phone/password hoặc platform không hợp lệ |
| 401 | Sai credentials: `INVALID_CREDENTIALS` |
| 403 | Role không hỗ trợ: `MOBILE_ROLE_NOT_ALLOWED`; account inactive/suspended/locked cũng bị 403 |
| 404 | Mobile feature flag OFF: `MOBILE_SESSION_AUTH_DISABLED` |

## Access token

Gửi access token như sau:

```http
Authorization: Bearer <accessToken>
```

Với JWT có `sid`, server yêu cầu `aud=mobile`, feature flag đang bật, session còn hiệu lực/chưa bị revoke, đúng owner/role và account còn khả dụng. Token bị blacklist trả `401 TOKEN_REVOKED`; session không còn hợp lệ trả `401 SESSION_REVOKED`. Token mobile có thể dùng làm Socket.IO handshake token theo phần Socket.IO bên dưới.

## Refresh

`POST /api/auth/refresh`, kèm CSRF:

```json
{ "refreshToken": "<refresh JWT>" }
```

Response mobile thành công:

```json
{
  "success": true,
  "accessToken": "<rotated access JWT>",
  "refreshToken": "<rotated refresh JWT>",
  "sessionId": "<same sid>"
}
```

Mỗi session có current refresh JTI hash riêng; compare-and-swap Mongo bảo đảm chỉ một refresh cạnh tranh thắng. Token cũ không dùng lại được. Nếu request đồng thời thua CAS khi token chưa được blacklist, handler trả `401 REFRESH_REPLAY`; nếu blacklist check thắng race trước, response có thể là `401` thông báo phiên không hợp lệ mà không có code. Client nên gom refresh song song thành một lần (single-flight).

## Logout hiện tại

`POST /api/auth/logout`, kèm CSRF:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{ "refreshToken": "<refresh JWT>" }
```

Server revoke session được xác định từ signed `sid` trong access hoặc refresh token, blacklist các token được gửi và yêu cầu ngắt `session:<sid>`. Với session mobile, logout một thiết bị không xóa session của thiết bị khác. Thành công trả `200 { "success": true, ... }`.

## Session list và revoke

`GET /api/auth/sessions`

- Cần bearer access token; chỉ Student/Teacher được dùng.
- Trả `{ "success": true, "data": [...] }`.
- Mỗi item có `sessionId`, `clientType`, `platform`, `deviceLabel`, `appVersion`, `createdAt`, `lastUsedAt`, `absoluteExpiresAt`, `status`.
- `status` là `active`, `revoked`, hoặc `expired`.
- Không có boolean `isCurrent`; client đối chiếu `sessionId` với JWT `sid`.
- Response không tiết lộ refresh token, refresh JTI hash hoặc refresh family ID.

`DELETE /api/auth/sessions/:sessionId`, kèm bearer token và CSRF:

- Chỉ revoke session khớp `sessionId`, owner và role của caller.
- Session không thuộc caller/không còn active trả `404`; không tiết lộ owner khác.
- Thành công trả `200 { "success": true, ... }` và ngắt socket trong room tương ứng.
- Không có API “revoke all other sessions” trong implementation hiện tại.

## Socket.IO

Client gửi access JWT qua handshake:

```js
{ auth: { token: accessToken } }
```

Không dùng cookie cho Socket.IO auth. Server xác minh signature, blacklist, `aud`, feature flag, Mongo session và trạng thái account; khi hợp lệ, gán session ID và join room `session:<sid>`. Khi Redis adapter hoạt động, test đã xác minh disconnect nhắm đúng session từ một Socket.IO instance tới socket ở instance khác mà không ngắt session còn lại.

Ứng dụng production cần cấu hình `REDIS_URL` để có distributed room operations. Redis-down fallback không được xác nhận trong lượt này; không nên coi memory fallback là multi-instance safe.

## Legacy Web và giới hạn đã biết

- Legacy Web login/refresh/logout tiếp tục dùng token audience `public`, không có `sid`, và được kiểm tra hồi quy khi flag OFF.
- Mobile presence hiện không được tổng hợp vào legacy presence store một-socket/user; đây là giới hạn presence riêng, không được hiểu là auth/session validation.
- Không có API contract nào ở đây cho Mobile exam, file transfer, push, payment hoặc các endpoint chưa được kiểm thử.
