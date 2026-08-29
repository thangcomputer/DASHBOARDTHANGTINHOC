import { useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { useToast } from './toast';

export const ATTENDANCE_CONFIRM_MS = 10_000;
const STORAGE_KEY = 'cms_attendance_confirm_pending';

let cache = null;
const listeners = new Set();
let timeoutId = null;
let commitHandler = null;
let handlerTeacherId = '';
/** Tránh flush trùng khi commit đang chạy */
const inFlightKeys = new Set();

export function attendanceConfirmKey(student) {
  return String(student?._enrollmentKey || student?._id || student?.id || '');
}

function readMap() {
  if (cache) return cache;
  if (typeof sessionStorage === 'undefined') {
    cache = {};
    return cache;
  }
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
    cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    cache = {};
  }
  return cache;
}

function writeMap(next) {
  cache = next;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      /* ignore subscriber errors */
    }
  });
  scheduleNext();
}

export function getAttendanceConfirm(key) {
  if (!key) return null;
  return readMap()[key] || null;
}

export function upsertAttendanceConfirm(key, payload) {
  if (!key || !payload) return;
  writeMap({ ...readMap(), [key]: payload });
}

export function removeAttendanceConfirm(key) {
  if (!key) return;
  const curr = readMap();
  if (!(key in curr)) return;
  const next = { ...curr };
  delete next[key];
  writeMap(next);
}

export function takeAttendanceConfirm(key) {
  const curr = readMap();
  const item = curr[key];
  if (!item) return null;
  const next = { ...curr };
  delete next[key];
  writeMap(next);
  return item;
}

export function subscribeAttendanceConfirm(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function scheduleNext() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  if (!commitHandler) return;
  let earliestAt = Infinity;
  for (const [key, item] of Object.entries(readMap())) {
    if (inFlightKeys.has(key) || item?.committing) continue;
    const at = Number(item?.endsAt) || 0;
    if (at > 0 && at < earliestAt) earliestAt = at;
  }
  if (!Number.isFinite(earliestAt)) return;
  timeoutId = setTimeout(() => {
    timeoutId = null;
    flushDueAttendanceConfirms();
  }, Math.max(0, earliestAt - Date.now()));
}

export function flushDueAttendanceConfirms() {
  if (!commitHandler) return;
  const now = Date.now();
  const dueKeys = Object.entries(readMap())
    .filter(([key, item]) => {
      if (!item || Number(item.endsAt) > now) return false;
      if (inFlightKeys.has(key) || item.committing) return false;
      // Chỉ bỏ qua nếu chắc chắn là GV khác (cùng browser đăng nhập nhiều tài khoản)
      if (
        handlerTeacherId
        && item.teacherId
        && String(item.teacherId) !== handlerTeacherId
      ) {
        return false;
      }
      return true;
    })
    .map(([key]) => key);

  dueKeys.forEach((key) => {
    const item = getAttendanceConfirm(key);
    if (!item || inFlightKeys.has(key)) return;
    inFlightKeys.add(key);
    // Giữ pending trong UI tới khi commit xong (tránh hiện lại ĐIỂM DANH + HỦY CA giữa chừng)
    upsertAttendanceConfirm(key, { ...item, committing: true });

    Promise.resolve(commitHandler({ ...item, committing: true, _confirmKey: key }))
      .then(() => {
        removeAttendanceConfirm(key);
      })
      .catch(() => {
        // Fail → xóa pending để GV bấm lại Điểm danh
        removeAttendanceConfirm(key);
      })
      .finally(() => {
        inFlightKeys.delete(key);
        scheduleNext();
      });
  });
}

export function registerAttendanceConfirmHandler(fn, teacherId = '') {
  commitHandler = fn;
  handlerTeacherId = String(teacherId || '');
  flushDueAttendanceConfirms();
  scheduleNext();
  return () => {
    if (commitHandler === fn) {
      commitHandler = null;
      handlerTeacherId = '';
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}

if (typeof window !== 'undefined') {
  const onResume = () => flushDueAttendanceConfirms();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onResume();
  });
  window.addEventListener('focus', onResume);
}

/** Commit điểm danh đã hết cửa sổ hủy (10s) kể cả khi GV đang ở tab khác (inbox, lịch…). */
export function useAttendanceConfirmFlush({ enabled, teacherId }) {
  const { markAttendance } = useData();
  const toast = useToast();
  const markRef = useRef(markAttendance);
  const toastRef = useRef(toast);
  markRef.current = markAttendance;
  toastRef.current = toast;

  useEffect(() => {
    if (!enabled) return undefined;
    return registerAttendanceConfirmHandler(async (entry) => {
      try {
        await markRef.current(
          entry.studentId,
          entry.note,
          Number(entry.grade),
          entry.courseName,
          entry.scheduleId || undefined,
        );
        toastRef.current.success('Đã gửi điểm danh — đang chờ học viên xác nhận.');
      } catch (err) {
        if (err?.cooldown) {
          toastRef.current.error(err.message || 'Học viên này đã được điểm danh. Vui lòng thử lại sau 12 tiếng.');
        } else {
          toastRef.current.error(err?.message || 'Lỗi khi điểm danh. Vui lòng thử lại.');
        }
        throw err;
      }
    }, teacherId);
  }, [enabled, teacherId]);
}
