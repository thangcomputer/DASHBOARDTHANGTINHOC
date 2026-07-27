import { createContext, useContext, useMemo, useCallback } from 'react';
import useSWR from 'swr';
import api from '../services/api';
import { mapSchedule } from '../lib/entityMaps';

const ScheduleContext = createContext(null);

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

export function ScheduleProvider({ user, children }) {
  const { data = [], mutate, isValidating } = useSWR(
    scheduleKey(user),
    fetchSchedules,
    { revalidateOnFocus: false, dedupingInterval: 45_000 }
  );

  const setSchedulesLocal = useCallback((updater) => {
    mutate((current = []) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      return Array.isArray(next) ? next : current;
    }, { revalidate: false });
  }, [mutate]);

  const value = useMemo(() => ({
    schedules: data,
    refreshSchedules: mutate,
    setSchedulesLocal,
    isSchedulesLoading: isValidating,
  }), [data, mutate, setSchedulesLocal, isValidating]);

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
