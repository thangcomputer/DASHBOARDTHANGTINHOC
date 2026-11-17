/**
 * Helpers dùng chung (web + mobile) cho thời điểm bật câu hỏi mốc video
 * và mốc giây tiếp theo sau khi học viên trả lời đúng.
 */

/**
 * @template {{ id?: string, _id?: string, atSec?: number }} T
 * @param {T | null | undefined} check
 * @returns {string}
 */
export function videoCheckKey(check) {
  return String(check?.id ?? check?._id ?? '').trim();
}

/**
 * @template {{ id?: string, _id?: string, atSec?: number }} T
 * @param {readonly T[]} [checks]
 * @returns {T[]}
 */
export function sortVideoChecksAsc(checks = []) {
  return (Array.isArray(checks) ? checks : [])
    .slice()
    .sort((a, b) => (Number(a?.atSec) || 0) - (Number(b?.atSec) || 0));
}

/**
 * Tìm mốc câu hỏi tiếp theo đã đến thời điểm mở.
 * Chỉ kích hoạt khi `currentTime >= atSec` để đồng hồ phát đã thực sự chạm mốc
 * thay vì bật sớm ở giây trước (`atSec - 0.3`) rồi khi trả lời đúng lại tiếp tục ở giây trước.
 * @template {{ id?: string, _id?: string, atSec?: number }} T
 * @param {readonly T[]} [pendingChecks]
 * @param {number} [currentTime]
 * @returns {T | null}
 */
export function findTriggeredVideoCheck(pendingChecks = [], currentTime = 0) {
  const time = Number(currentTime);
  if (!Number.isFinite(time) || time < 0) return null;
  const sorted = sortVideoChecksAsc(pendingChecks);
  return sorted.find((item) => {
    const at = Math.max(0, Number(item?.atSec) || 0);
    return time >= at;
  }) || null;
}

/**
 * Sau khi trả lời đúng 1 mốc ở `checkAtSec`:
 * - Nếu còn câu hỏi khác ở cùng giây `Math.floor(checkAtSec)`: mở tiếp câu đó, giữ nguyên vị trí.
 * - Ngược lại: tiếp tục phát ở giây tiếp theo (`Math.floor(checkAtSec) + 1`, hoặc giữ `currentTime` nếu đã vượt qua),
 *   tránh kẹt/giật lùi về giây trước mốc.
 * @template {{ id?: string, _id?: string, atSec?: number }} T
 * @param {{
 *   checkAtSec?: number,
 *   currentTime?: number,
 *   duration?: number,
 *   remainingPendingChecks?: readonly T[],
 * }} [params]
 * @returns {{ action: 'open_check', check: T, seekToSec: null } | { action: 'resume', check: null, seekToSec: number }}
 */
export function resolveVideoCheckResumeTarget({
  checkAtSec = 0,
  currentTime = 0,
  duration = 0,
  remainingPendingChecks = /** @type {const} */ ([]),
} = {}) {
  const at = Math.max(0, Number(checkAtSec) || 0);
  const atFloor = Math.floor(at);
  const sameSecondCheck = sortVideoChecksAsc(remainingPendingChecks).find(
    (item) => Math.max(0, Math.floor(Number(item?.atSec) || 0)) === atFloor,
  );
  if (sameSecondCheck) {
    return { action: 'open_check', check: sameSecondCheck, seekToSec: null };
  }

  const cur = Number.isFinite(Number(currentTime)) ? Math.max(0, Number(currentTime)) : 0;
  const dur = Number.isFinite(Number(duration)) ? Math.max(0, Number(duration)) : 0;
  const nextSec = atFloor + 1;

  let seekToSec = Math.max(cur, nextSec);
  if (dur > 0 && nextSec >= dur) {
    // Mốc đặt ở giây cuối cùng của video: giữ sát cuối thay vì lùi về `dur - 1`.
    seekToSec = Math.min(dur, Math.max(cur, Math.min(at, Math.max(0, dur - 0.15))));
  }

  return { action: 'resume', check: null, seekToSec };
}

/**
 * Kiểm tra phần tử `<video>` có hỗ trợ tua tới `targetSec` hay không.
 * Tránh gán `currentTime` trên luồng WebM live (`duration = Infinity`, `seekable.end = 0`)
 * khiến trình duyệt giật lùi video về 0s sau khi trả lời đúng.
 * @param {{ duration?: number, seekable?: { length: number, start: (i: number) => number, end: (i: number) => number } } | null | undefined} media
 * @param {number} [targetSec]
 * @returns {boolean}
 */
export function canMediaSeekTo(media, targetSec = 0) {
  const target = Number(targetSec);
  if (!media || !Number.isFinite(target) || target < 0) return false;
  const seekable = media.seekable;
  if (!seekable || typeof seekable.length !== 'number' || seekable.length === 0) {
    return Number.isFinite(media.duration) && media.duration > 0;
  }
  for (let i = 0; i < seekable.length; i += 1) {
    if (target >= seekable.start(i) && target <= seekable.end(i) + 0.05) {
      return true;
    }
  }
  return false;
}
