# Báo cáo nâng cấp module Camera giám sát thi (eKYC-style)

Ngày: 2026-07-27  
Phạm vi: client `ExamMonitor` + utils proctor + API audit `/api/proctor`

## 1. Các lỗi / hạn chế phát hiện (trước nâng cấp)

| # | Vấn đề |
|---|--------|
| 1 | Logic CV + UI nằm trong 1 file ~1135 dòng, khó bảo trì/test |
| 2 | False positive cao: mất mặt confirm ~1.2s, gaze/eye cứng → dễ hủy bài oan |
| 3 | Không phát hiện **nhiều khuôn mặt** một cách rõ ràng |
| 4 | Không đo FPS / độ phân giải thấp / flap camera bật-tắt |
| 5 | Không có **điểm rủi ro** — mọi sự kiện đều hard-violation |
| 6 | Không audit log server (JWT); sự kiện chỉ local/UI |
| 7 | Camera denied: không có nút **Thử lại** rõ ràng |
| 8 | UX trạng thái chưa chuẩn hóa (xanh/vàng/cam/đỏ) |
| 9 | Tab blur window `blur` có thể gây FP nhưng chưa tách soft vs hard |
| 10 | Không theo dõi mất mạng / đổi deviceId |

## 2. Cải tiến đã thực hiện

### Camera health
- Kiểm tra quyền / getUserMedia lỗi (denied, busy, not found) + hướng dẫn Chrome/Edge/Firefox
- Track `ended` / muted / disabled → trạng thái `lost` + nút Thử lại
- Cảnh báo độ phân giải thấp, ước lượng FPS, tạm dừng sample khi `document.hidden`
- Giải phóng `MediaStream` khi unmount / terminate

### Khuôn mặt & hành vi
- Confirm đa frame + thời gian dài hơn (mất mặt ~2.5s, multi-face ~1.8s, lens block ~1.5s)
- Multi-face qua `FaceDetector` + skin validation toàn khung
- Độ sáng oval (low light → soft warn)
- **Risk engine** cộng dồn + decay; soft warn không đếm hard; hard khi confirm hoặc risk ≥ 70
- Gaze lệch: soft trước, hard khi risk cao
- Tab visibility: hard sau 2 lần; `window.blur` / offline: soft + risk
- Đổi `deviceId`, camera flap: ghi nhận risk

### Bảo mật
- Không lưu video/frame (`ALLOW_SNAPSHOT_CAPTURE=false`)
- `POST /api/proctor/events` bắt buộc JWT; sanitize detail; allowlist type
- Admin xem `GET /api/proctor/events/:userId`

### UX
- Status: 🟢 bình thường · 🟡 đang kiểm tra · 🟠 sai vị trí/ánh sáng · 🔴 mất mặt / multi / camera lỗi
- Hiển thị risk score + FPS trên `CameraHeaderPanel`

## 3. Đề xuất nâng cấp tiếp

1. **MediaPipe Face Landmarker** (WASM) làm fallback khi không có `FaceDetector` (Firefox) — tăng độ chính xác mắt/gaze  
2. Liveness nhẹ (nháy mắt / quay đầu) trước khi vào bài — eKYC bước 1  
3. Giám thị realtime qua Socket.io (push sự kiện `critical` tới phòng giám sát)  
4. Snapshot có watermark chỉ khi `PROCTOR_ALLOW_SNAPSHOT=1` + consent  
5. Calibration oval theo từng thí sinh (30s đầu) giảm FP tư thế  
6. Playwright e2e với fake MediaStream (canvas fake faces)

## 4. File đã chỉnh / thêm

| File | Thay đổi |
|------|----------|
| `client/src/components/ExamMonitor.jsx` | Viết lại: health, risk, multi-face, UX, retry, audit |
| `client/src/utils/proctor/config.js` | **Mới** — cấu hình ngưỡng |
| `client/src/utils/proctor/vision.js` | **Mới** — CV heuristics |
| `client/src/utils/proctor/cameraHealth.js` | **Mới** — camera/FPS |
| `client/src/utils/proctor/riskEngine.js` | **Mới** — risk + confirm tracker |
| `client/src/utils/proctor/eventLog.js` | **Mới** — event log + UI status |
| `client/src/utils/proctor/index.js` | **Mới** — re-export |
| `client/src/services/api.js` | `proctorAPI` |
| `models/ProctorEvent.js` | **Mới** |
| `services/proctorAuditService.js` | **Mới** |
| `routes/proctorRoutes.js` | **Mới** |
| `server.js` | mount `/api/proctor` |
| `tests/integration/proctorEngine.test.js` | **Mới** |
| `docs/PROCTOR_CAMERA_UPGRADE.md` | Báo cáo này |

## 5. Đánh giá độ ổn định

| Tiêu chí | Đánh giá | Ghi chú |
|----------|----------|---------|
| Chrome / Edge | ★★★★★ | `FaceDetector` + getUserMedia ổn định |
| Firefox | ★★★☆☆ | Thường không có FaceDetector → heuristic skin; nên bổ sung MediaPipe |
| False positive | ★★★★☆ | Cải thiện rõ nhờ confirm dài + soft risk; vẫn phụ thuộc ánh sáng |
| CPU/RAM | ★★★★☆ | Sample ~3.5 Hz, pause khi hidden, canvas 320×240 |
| Bảo mật audit | ★★★★☆ | JWT + sanitize; chưa có retention policy / PII review đầy đủ |
| E2E gian lận nâng cao | ★★☆☆☆ | Chưa chống deepfake/photo-of-photo mạnh (cần liveness) |

**Kết luận:** Module đủ dùng production cho giám sát thi cơ bản–trung bình với rủi ro FP thấp hơn bản cũ; chưa thay thế hệ thống proctoring thương mại (ProctorU/Examity) cho kỳ thi high-stakes.
