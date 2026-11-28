# Web và mobile

Hai client gọi cùng prefix `/api`. Khác nhau ở chỗ lưu token và một header.

| | Web | Mobile |
| --- | --- | --- |
| Client | `client/src/services/api.js` | `thang-tin-hoc-mobile/src/services/apiClient.ts` |
| Nền tảng | không gửi | `X-Client-Platform: mobile` |
| Token | localStorage theo vai trò | SecureStore |
| CSRF | cookie + header | cookie jar + header |
| GET đang bay | `shareInflight` | map trong `mobileApiRequest` |
| Cache danh sách | SWR 30 giây ở context admin | `coalesceCached` cho vài GET |
| Socket | `SocketContext.jsx` | `socketService.ts` |

## Thêm một API cho cả hai

1. Thêm handler trong `routes/`.
2. Thêm hàm trong service web nếu màn web cần.
3. Thêm hàm trong `*Api.ts` của mobile nếu màn app cần.
4. Giữ method, path, tên field. Mobile bản đã cài không tự cập nhật.

## Không làm

- Không cho mobile một database hoặc một công thức XP riêng.
- Không cache điểm, tin nhắn, hoặc kết quả thanh toán quá thời gian request đang bay.
- Không đổi path chỉ trên một client.
