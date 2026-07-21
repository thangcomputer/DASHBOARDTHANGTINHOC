import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { mapStudent } from '../lib/entityMaps';
import { useSocket } from './SocketContext';
import { loadState } from './dataStorage';

/**
 * Background sync, pagination, system logs, and attendance socket for DataProvider.
 */
export function useDataSync({
  currentUser, onLogout,
  setStudents, setTeachers, setTransactions, setStaffs,
  setSchedulesRef, setExamResultsRef, setGroupsRef,
  setTrainingData, setStudentTrainingData, setQuestions, setTeacherExamTimeLimitMinutes,
  applyStudentExamConfigFromServer,
  setPrivateEvaluations,
}) {
  const { onDataRefresh, socket } = useSocket();

  const [isRefetching, setIsRefetching] = useState(false);
  const [studentsPagination, setStudentsPagination] = useState({
    totalRecords: 0, totalPages: 1, currentPage: 1,
  });
  const [systemLogs, setSystemLogs] = useState(() => loadState('thvp_systemLogs', []));

  useEffect(() => {
    localStorage.setItem('thvp_systemLogs', JSON.stringify(systemLogs));
  }, [systemLogs]);

  const fetchStudentsPaginated = useCallback(async ({ page = 1, limit = 10, search = '', paid, course, branch_id } = {}) => {
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (paid !== undefined && paid !== 'all') params.paid = paid === 'paid' ? 'true' : 'false';
      if (course && course !== 'all') params.course = course;
      if (branch_id && branch_id !== 'all') params.branch_id = branch_id;
      const res = await api.students.getAll(params);
      if (res?.success) {
        setStudents((res.data || []).filter(Boolean).map(mapStudent));
        setStudentsPagination({
          totalRecords: res.totalRecords || 0,
          totalPages: res.totalPages || 1,
          currentPage: res.currentPage || 1,
        });
      }
      return res;
    } catch (err) {
    }
  }, [setStudents]);

  const triggerBackgroundSync = useCallback(async () => {
    if (!currentUser) return;
    // HV/GV phải có token mới sync, Tránh gọi bị 401 khi chưa login xong
    if (currentUser.role !== 'admin' && !localStorage.getItem(`${currentUser.role}_access_token`)) return;

    setIsRefetching(true);
    try {
      const isTeacher = currentUser.role === 'teacher';
      const isStudent = currentUser.role === 'student';
      const isAdmin = currentUser.role === 'admin' || currentUser.role === 'staff';  // ⭐ Staff cũng cần fetch teachers/transactions

      const promises = [];

      if (isAdmin) {
        // Admin: students handled by fetchStudentsPaginated, skip here
        promises.push(api.schedules.getAll().catch(() => ({ success: false })));
      } else if (isTeacher) {
        // Teacher: cần tất cả học viên đã gán — truyền limit cao
        promises.push(api.students.getAll({ limit: 1000 }).catch(() => ({ success: false })));
        promises.push(api.schedules.getAll().catch(() => ({ success: false })));
      }

      if (isAdmin) {
        promises.push(api.teachers.getAll().catch(() => ({ success: false })));
        promises.push(api.staff.getAll().catch(() => ({ success: false })));
        promises.push(api.transactions.getAll().catch(() => ({ success: false })));
        promises.push(api.examResults.getAll().catch(() => ({ success: false })));
        promises.push(api.evaluations.getPrivate().catch(() => ({ success: false })));
      } else if (isTeacher) {
        promises.push(api.transactions.getByTeacher(currentUser.id).catch(() => ({ success: false })));
        promises.push(api.teachers.getById(currentUser.id || currentUser._id).catch(() => ({ success: false })));
      }

      if (isStudent) {
        promises.push(api.students.getById(currentUser.id || currentUser._id).catch(() => ({ success: false })));
        promises.push(api.schedules.getByStudent(currentUser.id || currentUser._id).catch(() => ({ success: false })));
      }

      // Handle Groups (everyone except student has groups at this index)
      promises.push(api.messages.getGroups(currentUser.id || currentUser._id).catch(() => ({ success: false })));

      // Fetch training data for all (Admin & Teacher)
      promises.push(api.settings.getTrainingData().catch(() => ({ success: false })));

      // Fetch student training data for all (Admin & Student)
      promises.push(api.settings.getStudentTrainingData().catch(() => ({ success: false })));

      const results = await Promise.all(promises);
      let idx = 0;

      const mapSchedule = (sch) => ({
        ...sch,
        id: sch._id,
        studentId: typeof sch.studentId === 'object' && sch.studentId ? String(sch.studentId._id || sch.studentId) : String(sch.studentId || ''),
        teacherId: typeof sch.teacherId === 'object' && sch.teacherId ? String(sch.teacherId._id || sch.teacherId) : String(sch.teacherId || ''),
      });

      if (isAdmin) {
        const schedulesRes = results[idx++];
        if (schedulesRes?.success) setSchedulesRef.current(schedulesRes.data.map(mapSchedule));
      } else if (isTeacher) {
        const studentsRes = results[idx++];
        if (studentsRes?.success) setStudents((studentsRes.data || []).filter(Boolean).map(mapStudent));
        const schedulesRes = results[idx++];
        if (schedulesRes?.success) setSchedulesRef.current(schedulesRes.data.map(mapSchedule));
      }

      if (isAdmin) {
        const teachersRes = results[idx++];
        if (teachersRes?.success) setTeachers(teachersRes.data.map(t => ({ ...t, id: t._id })));
        const staffRes = results[idx++];
        if (staffRes?.success) setStaffs(staffRes.data.map(st => ({ ...st, id: st._id })));
        const transactionsRes = results[idx++];
        if (transactionsRes?.success) setTransactions(transactionsRes.data.map(tx => ({ ...tx, id: tx._id })));
        const examResultsRes = results[idx++];
        if (Array.isArray(examResultsRes)) setExamResultsRef.current(examResultsRes.map(r => ({ ...r, id: r._id || r.id })));
        const evalsRes = results[idx++];
        if (evalsRes?.success) setPrivateEvaluations(evalsRes.data.map(e => ({ ...e, id: e._id || e.id })));
      } else if (isTeacher) {
        const transactionsRes = results[idx++];
        if (transactionsRes?.success) setTransactions(transactionsRes.data.map(tx => ({ ...tx, id: tx._id })));
        const teacherSelfRes = results[idx++];
        if (teacherSelfRes?.success) setTeachers([{ ...teacherSelfRes.data, id: teacherSelfRes.data._id }]);
      }

      if (isStudent) {
        const studentRes = results[idx++];
        if (studentRes?.success) setStudents([ { ...studentRes.data, id: studentRes.data._id } ]);
        const schedulesRes = results[idx++];
        if (schedulesRes?.success) setSchedulesRef.current(schedulesRes.data.map(mapSchedule));
      }

      // Groups
      const groupsRes = results[idx++];
      if (groupsRes?.success) setGroupsRef.current?.(groupsRes.data.map(g => ({ ...g, id: g._id })));

      // Training Data is the second to last promise
      const trainingDataRes = results[idx++];
      if (trainingDataRes?.success) {
        setTrainingData(trainingDataRes.data);
      }

      // Student Training Data is the last promise
      const studentTrainingRes = results[idx++];
      if (studentTrainingRes?.success) {
        setStudentTrainingData(studentTrainingRes.data);
      }

      // Giảng viên: làm mới ngân hàng câu hỏi thi từ server khi sync
      if (isTeacher) {
        const teRes = await api.settings.getTeacherExamConfig().catch(() => null);
        if (teRes?.success && teRes.data) {
          if (teRes.data.hasTeacherExamBank) {
            setQuestions(Array.isArray(teRes.data.questions) ? teRes.data.questions : []);
          }
          const tm = teRes.data.timeLimitMinutes;
          setTeacherExamTimeLimitMinutes(
            tm != null && Number.isFinite(Number(tm)) ? Math.round(Number(tm)) : null
          );
        }
      }

      if (isStudent || isAdmin) {
        const examCfg = await api.settings.getStudentExamConfig().catch(() => null);
        if (examCfg?.success && examCfg.data) {
          applyStudentExamConfigFromServer(examCfg.data);
        }
      }
    } catch (e) {
      if (e.status === 401 && onLogout) {
        onLogout();
      }
    } finally {
      setTimeout(() => setIsRefetching(false), 500);
    }
  }, [
    currentUser, onLogout, applyStudentExamConfigFromServer,
    setStudents, setTeachers, setTransactions, setStaffs,
    setSchedulesRef, setExamResultsRef, setGroupsRef,
    setTrainingData, setStudentTrainingData, setQuestions, setTeacherExamTimeLimitMinutes,
    setPrivateEvaluations,
  ]);

  // Background sync (multi-tab & window focus)
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'thvp_transactions') setTransactions(JSON.parse(e.newValue || '[]'));
    };

    const handleSync = () => {
      if (document.visibilityState === 'visible') {
        triggerBackgroundSync();
      }
    };

    let offDataRefresh = null;
    if (onDataRefresh) {
      offDataRefresh = onDataRefresh(() => {
        triggerBackgroundSync();
      });
    }

    handleSync();

    const interval = setInterval(() => {
      handleSync();
    }, 60000);

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      clearInterval(interval);
      if (offDataRefresh) offDataRefresh();
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [triggerBackgroundSync, onDataRefresh, setTransactions]);

  // Attendance locked socket listener
  useEffect(() => {
    if (!socket) return;
    const handleAttendanceLocked = (data) => {
      setStudents(prev => prev.map(s => {
        const sid = String(s._id || s.id);
        if (sid === String(data.studentId)) {
          return {
            ...s,
            can_check_in: false,
            remaining_cooldown_hours: 12,
            last_attendance_at: data.attendedAt,
          };
        }
        return s;
      }));
    };
    socket.on('attendance:locked', handleAttendanceLocked);
    return () => {
      socket.off('attendance:locked', handleAttendanceLocked);
    };
  }, [socket, setStudents]);

  const addSystemLog = useCallback((action, target, adminName = 'Admin', color = 'bg-blue-500 text-white') => {
    setSystemLogs(prev => {
      const newLog = {
        id: Date.now(),
        action,
        target,
        admin: adminName,
        time: new Date().toLocaleString('vi-VN'),
        color,
      };
      return [newLog, ...prev].slice(0, 100);
    });
  }, []);

  return {
    isRefetching,
    studentsPagination,
    fetchStudentsPaginated,
    triggerBackgroundSync,
    systemLogs,
    addSystemLog,
  };
}
