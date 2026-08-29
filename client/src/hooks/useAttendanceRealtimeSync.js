import { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useScheduleContext } from '../context/ScheduleContext';
import { useStudentsContext } from '../context/StudentsContext';
import { useDataActions } from '../context/DataContext';
import { applyAttendanceProgressToStudents } from '../utils/attendanceProgressPatch';

function scheduleKey(sch) {
  return String(sch?._id || sch?.id || '');
}

function applyAttendanceSocketToSchedules(prev, eventName, payload) {
  const list = Array.isArray(prev) ? prev : [];
  if (!payload) return list;

  // schedule:updated đôi khi gửi full document
  if (eventName === 'schedule:updated' && (payload._id || payload.id) && payload.studentConfirmStatus != null) {
    const sid = scheduleKey(payload);
    let found = false;
    const next = list.map((sch) => {
      if (scheduleKey(sch) !== sid) return sch;
      found = true;
      return { ...sch, ...payload, id: sch.id || payload._id || payload.id };
    });
    return found ? next : list;
  }

  const scheduleId = String(payload.scheduleId || payload._id || payload.id || '');
  if (!scheduleId) return list;

  const patch = {};
  if (eventName === 'attendance:awaiting-confirm') {
    patch.status = 'scheduled';
    patch.studentConfirmStatus = 'pending';
    if (payload.note) patch.attendancePendingNote = payload.note;
  } else if (eventName === 'attendance:confirmed') {
    patch.status = 'completed';
    patch.studentConfirmStatus = payload.studentConfirmStatus || 'accepted';
    patch.studentConfirmedAt = payload.studentConfirmedAt || new Date().toISOString();
  } else if (eventName === 'attendance:disputed') {
    patch.status = 'scheduled';
    patch.studentConfirmStatus = 'disputed';
    patch.studentConfirmedAt = payload.studentConfirmedAt || new Date().toISOString();
  } else if (eventName === 'attendance:rejected') {
    patch.status = 'cancelled';
    patch.studentConfirmStatus = 'admin_rejected';
  } else {
    return list;
  }

  let found = false;
  const next = list.map((sch) => {
    if (scheduleKey(sch) !== scheduleId) return sch;
    found = true;
    return { ...sch, ...patch };
  });
  return found ? next : list;
}

/**
 * GV/Admin: cập nhật lịch điểm danh ngay từ socket — không chờ sync 15s.
 */
export function useAttendanceRealtimeSync({ enabled, myId, role }) {
  const { socket } = useSocket() || {};
  const { setSchedulesLocal, refreshSchedules } = useScheduleContext();
  const { setStudentsLocal, refreshStudents } = useStudentsContext();
  const { triggerBackgroundSync } = useDataActions();

  useEffect(() => {
    if (!enabled || !socket || !myId) return undefined;

    const mine = (payload) => {
      if (!payload) return false;
      const tid = String(payload.teacherId?._id || payload.teacherId || '');
      if (tid && tid === String(myId)) return true;
      if (role === 'admin' || role === 'staff') return true;
      return Boolean(payload.scheduleId || payload._id || payload.id);
    };

    const bumpStudentProgress = (payload, { revert = false, incrementIfMissing = false, lockCheckIn = false, skipProgress = false } = {}) => {
      if (!payload?.studentId || typeof setStudentsLocal !== 'function') return;
      setStudentsLocal((prev) => applyAttendanceProgressToStudents(prev, payload, {
        revert,
        incrementIfMissing,
        lockCheckIn,
        skipProgress,
      }));
    };

    const onEvent = (eventName) => (payload) => {
      if (!mine(payload)) return;
      setSchedulesLocal((prev) => applyAttendanceSocketToSchedules(prev, eventName, payload));

      if (eventName === 'attendance:awaiting-confirm') {
        bumpStudentProgress(payload, { lockCheckIn: true, skipProgress: true });
      } else if (eventName === 'attendance:confirmed') {
        bumpStudentProgress(payload);
      } else if (eventName === 'attendance:disputed' || eventName === 'attendance:rejected') {
        bumpStudentProgress(payload, { revert: true });
      }

      if (eventName === 'attendance:confirmed' && typeof refreshStudents === 'function') {
        Promise.resolve(refreshStudents()).catch(() => {});
      }

      if (typeof triggerBackgroundSync === 'function') {
        Promise.resolve(triggerBackgroundSync({ force: true })).catch(() => {});
      } else if (typeof refreshSchedules === 'function') {
        Promise.resolve(refreshSchedules()).catch(() => {});
      }
    };

    const handlers = {
      'attendance:awaiting-confirm': onEvent('attendance:awaiting-confirm'),
      'attendance:confirmed': onEvent('attendance:confirmed'),
      'attendance:disputed': onEvent('attendance:disputed'),
      'attendance:rejected': onEvent('attendance:rejected'),
      'schedule:updated': onEvent('schedule:updated'),
    };

    Object.entries(handlers).forEach(([ev, fn]) => socket.on(ev, fn));
    return () => {
      Object.entries(handlers).forEach(([ev, fn]) => socket.off(ev, fn));
    };
  }, [
    enabled,
    socket,
    myId,
    role,
    setSchedulesLocal,
    refreshSchedules,
    refreshStudents,
    triggerBackgroundSync,
    setStudentsLocal,
  ]);
}
