import { createContext, useContext, useMemo, useCallback, useEffect, useRef } from 'react';
import useSWR from 'swr';
import api from '../services/api';
import { mapSchedule } from '../lib/entityMaps';
import { useSocket } from './SocketContext';

const ScheduleContext = createContext(null);

const SCHEDULE_SOCKET_EVENTS = [
  'schedule:new',
  'schedule:updated',
  'schedule:completed',
  'schedule:cancelled',
];

function scheduleKey(user) {
  if (!user?.role) return null;
  const id = user.id || user._id;
  if (user.role === 'student') return ['schedules', 'student', id];
  if (['admin', 'staff', 'teacher'].includes(user.role)) return ['schedules', user.role, id];
  return null;
}

async function fetchSchedules([, role, userId]) {
  if (role === 'student') {
    const res = await api.schedules.getByStudent(userId);
    return res?.success ? res.data.map(mapSchedule) : [];
  }
  const res = await api.schedules.getAll({ limit: 500 });
  return res?.success ? res.data.map(mapSchedule) : [];
}

function shouldRefreshSchedules(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const type = String(payload.type || '').toLowerCase();
  if (type === 'schedule' || type === 'schedules') return true;
  const ev = String(payload.eventName || '');
  return ev.startsWith('schedule:');
}

export function ScheduleProvider({ user, children }) {
  const { socket, onDataRefresh } = useSocket();
  const userRef = useRef(user);
  userRef.current = user;
  const refreshDebounceRef = useRef(null);

  const key = scheduleKey(user);
  const { data = [], mutate, isValidating } = useSWR(
    key,
    fetchSchedules,
    { revalidateOnFocus: false, dedupingInterval: 45_000 }
  );

  // Force fetch — tránh kẹt cache SWR / sync 15s khi Admin xếp/hủy lịch.
  const refreshSchedules = useCallback(() => {
    const k = scheduleKey(userRef.current);
    if (!k) return mutate();
    return mutate(async () => fetchSchedules(k), { revalidate: false, populateCache: true });
  }, [mutate]);

  const scheduleSchedulesRefresh = useCallback(() => {
    if (!scheduleKey(userRef.current)) return;
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = setTimeout(() => {
      refreshDebounceRef.current = null;
      Promise.resolve(refreshSchedules()).catch(() => {});
    }, 150);
  }, [refreshSchedules]);

  const setSchedulesLocal = useCallback((updater) => {
    mutate((current = []) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return Array.isArray(next) ? next : current;
    }, { revalidate: false });
  }, [mutate]);

  useEffect(() => {
    if (!socket || !key) return undefined;
    const onEvt = (eventName) => (payload) => {
      // Patch tức thì — HV thấy hủy/đổi lịch trước khi refetch xong
      if (eventName === 'schedule:cancelled' && payload) {
        const sid = String(payload.scheduleId || payload._id || payload.id || '');
        if (sid) {
          setSchedulesLocal((prev) => (prev || []).map((sch) => {
            if (String(sch._id || sch.id) !== sid) return sch;
            return {
              ...sch,
              status: 'cancelled',
              note: payload.reason || payload.note || sch.note,
              ...(payload.date ? { date: payload.date } : {}),
              ...(payload.startTime ? { startTime: payload.startTime } : {}),
              ...(payload.endTime ? { endTime: payload.endTime } : {}),
            };
          }));
        }
      } else if (eventName === 'schedule:updated' && payload && typeof payload === 'object') {
        const sid = String(payload._id || payload.id || payload.scheduleId || '');
        if (sid) {
          const mapped = mapSchedule(payload);
          setSchedulesLocal((prev) => {
            let found = false;
            const next = (prev || []).map((sch) => {
              if (String(sch._id || sch.id) !== sid) return sch;
              found = true;
              return { ...sch, ...mapped, id: sch.id || mapped.id };
            });
            return found ? next : prev;
          });
        }
      } else if (eventName === 'schedule:new' && payload && typeof payload === 'object') {
        const mapped = mapSchedule(payload);
        const sid = String(mapped._id || mapped.id || '');
        if (sid) {
          setSchedulesLocal((prev) => {
            if ((prev || []).some((sch) => String(sch._id || sch.id) === sid)) {
              return (prev || []).map((sch) => (
                String(sch._id || sch.id) === sid ? { ...sch, ...mapped, id: sch.id || mapped.id } : sch
              ));
            }
            return [...(prev || []), { ...mapped, id: mapped.id || sid }];
          });
        }
      }
      scheduleSchedulesRefresh();
    };
    const handlers = SCHEDULE_SOCKET_EVENTS.map((ev) => [ev, onEvt(ev)]);
    handlers.forEach(([ev, fn]) => socket.on(ev, fn));
    return () => {
      handlers.forEach(([ev, fn]) => socket.off(ev, fn));
    };
  }, [socket, key, scheduleSchedulesRefresh, setSchedulesLocal]);

  useEffect(() => {
    if (!onDataRefresh || !key) return undefined;
    const unsub = onDataRefresh((payload) => {
      if (shouldRefreshSchedules(payload)) scheduleSchedulesRefresh();
    });
    return () => {
      unsub();
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
    };
  }, [onDataRefresh, key, scheduleSchedulesRefresh]);

  const value = useMemo(() => ({
    schedules: data,
    refreshSchedules,
    setSchedulesLocal,
    isSchedulesLoading: isValidating,
  }), [data, refreshSchedules, setSchedulesLocal, isValidating]);

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}

export function useScheduleContext() {
  const ctx = useContext(ScheduleContext);
  if (!ctx) {
    return { schedules: [], refreshSchedules: async () => {}, setSchedulesLocal: () => {}, isSchedulesLoading: false };
  }
  return ctx;
}
