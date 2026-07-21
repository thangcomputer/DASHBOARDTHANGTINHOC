import { createContext, useContext, useMemo } from 'react';
import useSWR from 'swr';
import api from '../services/api';
import { mapTeacher } from '../lib/entityMaps';

const TeachersContext = createContext(null);

function teachersKey(user) {
  if (!user?.role) return null;
  const id = user.id || user._id;
  if (user.role === 'admin' || user.role === 'staff') return ['teachers', 'admin'];
  if (user.role === 'teacher') return ['teachers', 'self', id];
  return null;
}

async function fetchTeachers(key) {
  const [, scope, teacherId] = key;
  if (scope === 'admin') {
    const res = await api.teachers.getAll();
    return res?.success ? res.data.map(mapTeacher) : [];
  }
  const res = await api.teachers.getById(teacherId);
  return res?.success ? [mapTeacher(res.data)] : [];
}

export function TeachersProvider({ user, children }) {
  const { data = [], mutate, isValidating } = useSWR(
    teachersKey(user),
    fetchTeachers,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const value = useMemo(() => ({
    teachers: data,
    refreshTeachers: mutate,
    isTeachersLoading: isValidating,
  }), [data, mutate, isValidating]);

  return (
    <TeachersContext.Provider value={value}>
      {children}
    </TeachersContext.Provider>
  );
}

export function useTeachersContext() {
  const ctx = useContext(TeachersContext);
  if (!ctx) {
    return { teachers: [], refreshTeachers: async () => {}, isTeachersLoading: false };
  }
  return ctx;
}
