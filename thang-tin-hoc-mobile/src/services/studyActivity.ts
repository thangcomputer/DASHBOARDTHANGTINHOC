/** Tín hiệu "đang học thật" cho bộ đếm phút học của mục tiêu học. */
const IDLE_MS = 3 * 60 * 1000;
/** Trình phát gửi tiến độ liên tục khi đang phát; quá khoảng này coi như đã dừng. */
const MEDIA_STALE_MS = 15 * 1000;

let lastTouchAt = Date.now();
let lastMediaPlayingAt = 0;

/** Gọi khi người dùng chạm màn hình. */
export function noteStudyActivity() {
  lastTouchAt = Date.now();
}

/** Gọi từ trình phát video mỗi lần báo tiến độ. */
export function noteStudyMediaProgress(playing: boolean) {
  if (playing) lastMediaPlayingAt = Date.now();
}

export function isStudyMediaPlaying(now = Date.now()) {
  return now - lastMediaPlayingAt <= MEDIA_STALE_MS;
}

/** Video đang phát, hoặc có chạm màn hình trong 3 phút gần nhất. */
export function isActivelyStudying(now = Date.now()) {
  return isStudyMediaPlaying(now) || now - lastTouchAt <= IDLE_MS;
}
