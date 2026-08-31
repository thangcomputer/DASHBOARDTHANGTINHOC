import { createContext, useContext, useMemo, useCallback, useState, useEffect, useRef } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import api from '../services/api';
import { mapStudent } from '../lib/entityMaps';
import { useSocket } from './SocketContext';
import { applyAttendanceProgressToStudents } from '../utils/attendanceProgressPatch';

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
    if (q.paid !== undefined && q.paid !== 'all') {
      // Pass semantic filters: paid | unpaid | refunded (legacy true/false kept)
      if (q.paid === 'paid' || q.paid === true || q.paid === 'true') params.paid = 'paid';
      else if (q.paid === 'unpaid') params.paid = 'unpaid';
      else if (q.paid === 'refunded' || q.paid === false || q.paid === 'false') params.paid = 'refunded';
      else params.paid = q.paid;
    }
    if (q.course && q.course !== 'all') params.course = q.course;
    if (q.branch_id && (q.branch_id !== 'all' || q.forceBranchIdAll)) {
      params.branch_id = q.branch_id;
    }
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
    const res = await api.students.getAll({ limit: 300 });
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
  const adminQueryRef = useRef(null);
  const key = studentsKey(user, adminQuery);
  const { socket, onDataRefresh } = useSocket();
  const refreshDebounceRef = useRef(null);

  useEffect(() => {
    adminQueryRef.current = adminQuery;
  }, [adminQuery]);

  useEffect(() => {
    setAdminQuery(null);
  }, [user?.id, user?.role]);

  const { data, mutate, isValidating, isLoading } = useSWR(
    key,
    fetchStudents,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
      // Đổi filter/page không được flash danh sách rỗng trong lúc chờ API
      keepPreviousData: true,
    }
  );

  const students = data?.students ?? [];
  const studentsPagination = data?.pagination ?? EMPTY_PAGINATION;
  // First fetch for this key: block learning gate until settled
  const isStudentsLoading = Boolean(key) && (isLoading || (data == null && isValidating));
  const userRef = useRef(user);
  userRef.current = user;

  const fetchStudentsPaginated = useCallback(async (params = {}) => {
    const prev = adminQueryRef.current;
    // Merge với query hiện tại — gọi chỉ { page } không được xóa branch/filter
    const q = {
      page: params.page != null ? params.page : (prev?.page || 1),
      limit: params.limit != null ? params.limit : (prev?.limit || 10),
      search: params.search !== undefined ? params.search : (prev?.search || ''),
      paid: params.paid !== undefined ? params.paid : prev?.paid,
      course: params.course !== undefined ? params.course : prev?.course,
      branch_id: params.branch_id !== undefined ? params.branch_id : prev?.branch_id,
      forceBranchIdAll: params.forceBranchIdAll !== undefined
        ? !!params.forceBranchIdAll
        : !!prev?.forceBranchIdAll,
    };
    const nextKey = studentsKey(userRef.current, q);
    setAdminQuery(q);
    adminQueryRef.current = q;
    const paidParam = q.paid !== undefined && q.paid !== 'all'
      ? (q.paid === 'paid' || q.paid === true || q.paid === 'true'
        ? 'paid'
        : q.paid === 'unpaid'
          ? 'unpaid'
          : q.paid === 'refunded' || q.paid === false || q.paid === 'false'
            ? 'refunded'
            : q.paid)
      : undefined;
    const res = await api.students.getAll({
      page: q.page,
      limit: q.limit,
      ...(q.search ? { search: q.search } : {}),
      ...(paidParam !== undefined ? { paid: paidParam } : {}),
      ...(q.course && q.course !== 'all' ? { course: q.course } : {}),
      ...(q.branch_id && (q.branch_id !== 'all' || q.forceBranchIdAll)
        ? { branch_id: q.branch_id }
        : {}),
    });
    if (res?.success) {
      const mapped = res.data.map(mapStudent);
      const payload = {
        students: mapped,
        pagination: {
          totalRecords: res.totalRecords || 0,
          totalPages: res.totalPages || 1,
          currentPage: res.currentPage || 1,
        },
      };
      // Hook mutate gắn key SWR hiện tại (null khi F5) — ghi đúng key sắp đọc.
      if (nextKey) {
        await globalMutate(nextKey, payload, { revalidate: false });
      } else {
        await mutate(payload, { revalidate: false });
      }
    }
    return res;
  }, [mutate]);

  // Force fetch — tránh kẹt cache SWR (dedupe 30s) khi Admin điểm danh bù.
  const refreshStudents = useCallback(() => {
    const role = userRef.current?.role;
    const q = adminQueryRef.current;
    const k = studentsKey(userRef.current, q);
    if (!k) return mutate();
    // Admin giữ mutate() thường — danh sách phân trang do fetchStudentsPaginated / useAdminStudents lo.
    if (role === 'admin' || role === 'staff') return mutate();
    return mutate(async () => fetchStudents(k), { revalidate: false, populateCache: true });
  }, [mutate]);

  const scheduleStudentsRefresh = useCallback(() => {
    const role = userRef.current?.role;
    if (role !== 'teacher' && role !== 'student') return;
    if (refreshDebounceRef.current) clearTimeout(refreshDebounceRef.current);
    refreshDebounceRef.current = setTimeout(() => {
      refreshDebounceRef.current = null;
      Promise.resolve(refreshStudents()).catch(() => {});
    }, 120);
  }, [refreshStudents]);

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
      const awaiting = payload.awaitingConfirm === true;
      setStudentsLocal((prev) => applyAttendanceProgressToStudents(prev, {
        studentId: payload.studentId,
        course: payload.course,
        completedSessions: awaiting ? undefined : payload.meta?.completedSessions,
        totalSessions: payload.meta?.totalSessions,
        attendedAt: payload.attendedAt,
      }, { lockCheckIn: true, skipProgress: awaiting }));
      // Điểm danh bù / hoàn tất: refetch số buổi GV (optimistic patch có thể miss enrollment).
      if (!awaiting) scheduleStudentsRefresh();
    };
    socket.on('attendance:locked', handleAttendanceLocked);
    return () => socket.off('attendance:locked', handleAttendanceLocked);
  }, [socket, setStudentsLocal, scheduleStudentsRefresh]);

  // Gán GV / reset lịch sử / student:updated — không luôn kèm type: 'student' trên payload.
  useEffect(() => {
    if (!socket) return undefined;
    if (user?.role !== 'teacher' && user?.role !== 'student') return undefined;
    const onStudentListEvt = () => scheduleStudentsRefresh();
    const events = ['student:assigned', 'student:history_reset', 'student:new', 'student:updated'];
    events.forEach((ev) => socket.on(ev, onStudentListEvt));
    return () => {
      events.forEach((ev) => socket.off(ev, onStudentListEvt));
    };
  }, [socket, user?.role, scheduleStudentsRefresh]);

  // data:refresh type student — Admin makeup đã emit; GV trước đây bỏ qua (useDataSync không refetch students).
  useEffect(() => {
    if (!onDataRefresh) return undefined;
    const role = user?.role;
    if (role !== 'teacher' && role !== 'student') return undefined;
    const unsub = onDataRefresh((payload) => {
      const type = payload?.type;
      if (type === 'student' || type === 'students') {
        scheduleStudentsRefresh();
        return;
      }
      const ev = String(payload?.eventName || '');
      if (
        ev === 'student:assigned'
        || ev === 'student:history_reset'
        || ev === 'student:new'
        || ev === 'student:updated'
      ) {
        scheduleStudentsRefresh();
      }
    });
    return () => {
      unsub();
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
        refreshDebounceRef.current = null;
      }
    };
  }, [onDataRefresh, user?.role, scheduleStudentsRefresh]);

  const value = useMemo(() => ({
    students,
    studentsPagination,
    fetchStudentsPaginated,
    refreshStudents,
    patchStudent,
    setStudentsLocal,
    isStudentsLoading,
  }), [students, studentsPagination, fetchStudentsPaginated, refreshStudents, patchStudent, setStudentsLocal, isStudentsLoading]);

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
