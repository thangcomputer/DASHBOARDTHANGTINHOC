/**
 * Cấu hình giám sát thi (eKYC-style): ưu tiên giảm false positive qua
 * confirm duration + điểm rủi ro cộng dồn, không kết luận gian lận từ 1 sự kiện.
 */
export const PROCTOR_CONFIG = {
  MAX_FACE_VIOLATIONS: 5,
  MAX_TAB_WARNINGS: 2,

  /** Lấy mẫu frame — ~3.5 Hz (đủ ổn định, nhẹ CPU) */
  SAMPLE_INTERVAL_MS: 280,

  FACE_ABSENT_CONFIRM_MS: 2500,
  FACE_ABSENT_MIN_FRAMES: 6,
  EYE_MISS_CONFIRM_MS: 2200,
  EYE_MISS_MIN_FRAMES: 6,
  GAZE_MISS_CONFIRM_MS: 2000,
  GAZE_MISS_MIN_FRAMES: 5,
  MULTI_FACE_CONFIRM_MS: 1800,
  MULTI_FACE_MIN_FRAMES: 5,
  LENS_BLOCK_CONFIRM_MS: 1500,
  LENS_BLOCK_MIN_FRAMES: 4,

  MOTION_STALE_MS: 32000,
  MOTION_GRACE_MS: 10000,
  MOTION_LUMA_DELTA: 12,
  MOTION_CHANGED_RATIO: 0.014,

  WARN_COOLDOWN_MS: 5500,
  SOFT_WARN_COOLDOWN_MS: 8000,

  GAZE_CENTER_MIN: 0.38,
  GAZE_CENTER_MAX: 0.62,
  OVAL_CX: 0.5,
  OVAL_CY: 0.43,
  OVAL_RX: 0.21,
  OVAL_RY: 0.3,
  GAZE_CY_MAX: 0.48,
  GAZE_CY_MIN: 0.18,

  DETECT_W: 320,
  DETECT_H: 240,
  MIN_FACE_AREA_RATIO: 0.028,
  MIN_FACE_BOX_ASPECT: 0.42,
  MAX_FACE_BOX_ASPECT: 1.22,
  MIN_FACE_SKIN_RATIO: 0.052,
  MIN_EYE_SKIN_RATIO: 0.038,
  MIN_BBOX_SKIN_RATIO: 0.075,
  GRID_COLS: 18,
  GRID_ROWS: 14,

  /** Độ phân giải tối thiểu (track settings / video element) */
  MIN_VIDEO_WIDTH: 320,
  MIN_VIDEO_HEIGHT: 240,
  /** FPS ước lượng dưới ngưỡng → cảnh báo mềm */
  MIN_STABLE_FPS: 8,
  LOW_LIGHT_AVG_L: 28,
  GOOD_LIGHT_AVG_L: 45,

  /** Điểm rủi ro — chỉ hard-violation khi vượt ngưỡng + confirm */
  RISK_DECAY_PER_SEC: 0.35,
  RISK_SOFT_THRESHOLD: 25,
  RISK_HARD_THRESHOLD: 70,
  RISK_WEIGHTS: {
    face_absent: 12,
    multi_face: 18,
    lens_blocked: 16,
    eye_miss: 10,
    gaze_off: 8,
    motion_stale: 14,
    tab_blur: 20,
    camera_lost: 22,
    camera_flap: 10,
    low_res: 4,
    low_fps: 3,
    low_light: 5,
    network_offline: 15,
    device_change: 12,
  },

  /** Gửi audit batch lên server (ms); 0 = tắt */
  AUDIT_FLUSH_MS: 12000,
  AUDIT_MAX_BUFFER: 80,
  /** Không lưu frame/video trừ khi bật tường minh */
  ALLOW_SNAPSHOT_CAPTURE: false,
};

export default PROCTOR_CONFIG;
