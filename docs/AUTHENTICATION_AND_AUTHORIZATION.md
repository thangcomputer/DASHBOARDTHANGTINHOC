# Xác thực và phân quyền

## Token

`authRoutes.js` cấp access token và refresh token sau khi mật khẩu khớp. Web lưu theo tiền tố vai trò trong `localStorage` (`student_access_token`, `teacher_access_token`, …). `getRolePrefix()` ưu tiên vai trò khớp URL để không dùng token admin khi đang ở `/student`.

Mobile lưu bộ token trong SecureStore, key `thang-tin-hoc.mobile-session.v1`.

401 gọi refresh đúng một promise (`tryRefreshAccessToken` trên web, `refreshPromise` trên mobile). Mã auth chết thì xóa token và đưa về đăng nhập. Mất mạng lúc refresh không đá phiên.

CSRF là cookie `csrf_token` cộng header `X-CSRF-Token` cho request ghi. `GET /api/auth/csrf-token` cấp token.

## Vai trò

Học viên là document `Student`. Giáo viên, admin và staff là document `Teacher`.

`adminRole`: `SUPER_ADMIN`, `HIGH_ADMIN`, `STAFF`, `SUPPORT`. Quyền chi tiết là mảng `permissions` (`manage_students`, `manage_schedule`, `manage_finance`, `manage_training`, `system_settings`, `manage_staff`). Catalog: `constants/permissions.js`.

Middleware chặn ở server. Ẩn nút trên UI không thay cho kiểm tra này.

Enterprise RBAC trong `shared/` đang ở chế độ quan sát. Quyết định cho qua hay chặn vẫn là middleware live.

## Hai thiết bị

Code: `services/registeredDeviceService.js`. Collection: `RegisteredDevice`.

- Mỗi cặp tài khoản và vai trò (`student` hoặc `teacher`) có tối đa hai thiết bị `active`, slot 1 và 2.
- Thiết bị đã có, kèm secret đúng, được vào lại đúng slot.
- Thiết bị thứ ba nhận `DEVICE_NOT_REGISTERED_LIMIT_REACHED` và thông báo liên hệ trung tâm.
- Đăng xuất và hết hạn token không xóa thiết bị đã đăng ký. Phiên nằm ở `UserDeviceSession`, khác với thiết bị đã gắn.
- Cài lại app chỉ vào lại được nếu còn `deviceKey` và secret hợp lệ. Mất secret thì `DEVICE_PROOF_INVALID`.
- Gỡ thiết bị chỉ qua admin: `revokeByAdmin` hoặc `resetAllForAccount`.

Đã kiểm trên database test: slot 1, slot 2, thiết bị thứ ba bị từ chối, đăng nhập lại thiết bị 1 vẫn còn hai bản ghi active.

## Không sửa khi refactor

Không tăng giới hạn lên ba. Không xóa thiết bị trong logout. Không gộp `RegisteredDevice` với `UserDeviceSession`.
