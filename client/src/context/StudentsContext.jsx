import { createContext, useContext, useMemo, useCallback, useState, useEffect } from 'react';
import useSWR from 'swr';
import api from '../services/api';
import { mapStudent } from '../lib/entityMaps';
import { useSocket } from './SocketContext';

const StudentsContext = createContext(null);

const EMPTY_PAGINATION = { totalRecords: 0, totalPages: 1, currentPage: 1 };

function studentsKey(user, query) {
  if (!user?.role) return null;
  const id = user.id || user._id;
  if (user.role === 'admin' || user.role === 'staff') {
    return query ? ['students', 'admin', query] : null;
  }
  if (user.role === 'teacher') return ['students', 'teacher', id];
  if (user.role === 'student') return ['students', 'self', id];
  return null;
}

async function fetchStudents([, scope, arg]) {
  if (scope === 'admin') {
    const q = arg;
    const params = { page: q.page || 1, limit: q.limit || 10 };
    if (q.search) params.search = q.search;
    if (q.paid !== undefined && q.paid !== 'all') params.paid = q.paid === 'paid' ? 'true' : 'false';
    if (q.course && q.course !== 'all') params.course = q.course;
    if (q.branch_id && q.branch_id !== 'all') params.branch_id = q.branch_id;
    const res = await api.students.getAll(params);
    if (!res?.success) return { students: [], pagination: EMPTY_PAGINATION };
    return {
      students: res.data.map(mapStudent),
      pagination: {
        totalRecords: res.totalRecords || 0,
        totalPages: res.totalPages || 1,
        currentPage: res.currentPage || 1,
      },
    };
  }
  if (scope === 'teacher') {
    const res = await api.students.getAll({ limit: 1000 });
    return {
      students: res?.success ? res.data.map(mapStudent) : [],
      pagination: EMPTY_PAGINATION,
    };
  }
  if (scope === 'self') {
    const res = await api.students.getById(arg);
    return {
      students: res?.success ? [mapStudent(res.data)] : [],
      pagination: EMPTY_PAGINATION,
    };
  }
  return { students: [], pagination: EMPTY_PAGINATION };
}

export function StudentsProvider({ user, children }) {
  const [adminQuery, setAdminQuery] = useState(null);
  const key = studentsKey(user, adminQuery);
  const { socket } = useSocket();

  useEffect(() => {
    setAdminQuery(null);
  }, [user?.id, user?.role]);

  const { data, mutate, isValidating } = useSWR(
    key,
    fetchStudents,
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  );

  const students = data?.students ?? [];
  const studentsPagination = data?.pagination ?? EMPTY_PAGINATION;

  const fetchStudentsPaginated = useCallback(async (params = {}) => {
    const q = {
      page: params.page || 1,
      limit: params.limit || 10,
      search: params.search || '',
      paid: params.paid,
      course: params.course,
      branch_id: params.branch_id,
    };
    setAdminQuery(q);
    const res = await api.students.getAll({
      page: q.page,
      limit: q.limit,
      ...(q.search ? { search: q.search } : {}),
      ...(q.paid !== undefined && q.paid !== 'all' ? { paid: q.paid === 'paid' ? 'true' : 'false' } : {}),
      ...(q.course && q.course !== 'all' ? { course: q.course } : {}),
      ...(q.branch_id && q.branch_id !== 'all' ? { branch_id: q.branch_id } : {}),
    });
    if (res?.success) {
      await mutate({
        students: res.data.map(mapStudent),
        pagination: {
          totalRecords: res.totalRecords || 0,
          totalPages: res.totalPages || 1,
          currentPage: res.currentPage || 1,
        },
      }, { revalidate: false });
    }
    return res;
  }, [mutate]);

  const refreshStudents = useCallback(() => mutate(), [mutate]);

  const patchStudent = useCallback((studentId, updates) => {
    mutate((current) => {
      if (!current?.students) return current;
      return {
        ...current,
        students: current.students.map((s) =>
          String(s.id) === String(studentId) ? { ...s, ...updates } : s
        ),
      };
    }, { revalidate: false });
  }, [mutate]);

  const setStudentsLocal = useCallback((updater) => {
    mutate((current) => {
      const base = current || { students: [], pagination: EMPTY_PAGINATION };
      const nextStudents = typeof updater === 'function' ? updater(base.students) : updater;
      return { ...base, students: nextStudents };
    }, { revalidate: false });
  }, [mutate]);

  useEffect(() => {
    if (!socket) return;
    const handleAttendanceLocked = (payload) => {
      patchStudent(payload.studentId, {
        can_check_in: false,
        remaining_cooldown_hours: 12,
        last_attendance_at: payload.attendedAt,
      });
    };
    socket.on('attendance:locked', handleAttendanceLocked);
    return () => socket.off('attendance:locked', handleAttendanceLocked);
  }, [socket, patchStudent]);

  const value = useMemo(() => ({
    students,
    studentsPagination,
    fetchStudentsPaginated,
    refreshStudents,
    patchStudent,
    setStudentsLocal,
    isStudentsLoading: isValidating,
  }), [students, studentsPagination, fetchStudentsPaginated, refreshStudents, patchStudent, setStudentsLocal, isValidating]);

  return (
    <StudentsContext.Provider value={value}>
      {children}
    </StudentsContext.Provider>
  );
}

export function useStudentsContext() {
  const ctx = useContext(StudentsContext);
  if (!ctx) {
    return {
      students: [],
      studentsPagination: EMPTY_PAGINATION,
      fetchStudentsPaginated: async () => {},
      refreshStudents: async () => {},
      patchStudent: () => {},
      setStudentsLocal: () => {},
      isStudentsLoading: false,
    };
  }
  return ctx;
}
