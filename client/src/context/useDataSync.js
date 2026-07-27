import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { mapStudent, mapTeacher, mapTransaction, mapSchedule } from '../lib/entityMaps';
import { useSocket } from './SocketContext';
import { loadState } from './dataStorage';

/**
 * Background sync, system logs for DataProvider.
 * Entity lists (students/teachers/schedules/transactions) are updated via SWR context setters.
 */
export function useDataSync({
  currentUser, onLogout,
  setStudents, setTeachers, setTransactions, setStaffs,
  setSchedulesRef, setExamResultsRef, setGroupsRef,
  setTrainingData, setStudentTrainingData, setQuestions, setTeacherExamTimeLimitMinutes,
  applyStudentExamConfigFromServer,
  setPrivateEvaluations,
}) {
  const { onDataRefresh } = useSocket();

  const [isRefetching, setIsRefetching] = useState(false);
  const [systemLogs, setSystemLogs] = useState(() => loadState('thvp_systemLogs', []));

  useEffect(() => {
    localStorage.setItem('thvp_systemLogs', JSON.stringify(systemLogs));
  }, [systemLogs]);

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
        // Admin: students handled by StudentsContext.fetchStudentsPaginated, skip here
        promises.push(api.schedules.getAll({ limit: 500 }).catch(() => ({ success: false })));
      } else if (isTeacher) {
        // Teacher: can hoc vien da gan — gioi han de tranh payload lon
        promises.push(api.students.getAll({ limit: 300 }).catch(() => ({ success: false })));
        promises.push(api.schedules.getAll({ limit: 500 }).catch(() => ({ success: false })));
      }

      if (isAdmin) {
        promises.push(api.teachers.getAll().catch(() => ({ success: false })));
        promises.push(api.staff.getAll().catch(() => ({ success: false })));
        promises.push(api.transactions.getAll({ limit: 200 }).catch(() => ({ success: false })));
        promises.push(api.examResults.getAll({ limit: 200 }).catch(() => ({ success: false })));
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

      if (isAdmin) {
        const schedulesRes = results[idx++];
        if (schedulesRes?.success) setSchedulesRef.current(schedulesRes.data.map(mapSchedule));
      } else if (isTeacher) {
        const studentsRes = results[idx++];
        if (studentsRes?.success) {
          setStudents((studentsRes.data || []).filter(Boolean).map(mapStudent));
        }
        const schedulesRes = results[idx++];
        if (schedulesRes?.success) setSchedulesRef.current(schedulesRes.data.map(mapSchedule));
      }

      if (isAdmin) {
        const teachersRes = results[idx++];
        if (teachersRes?.success) setTeachers(teachersRes.data.map(mapTeacher));
        const staffRes = results[idx++];
        if (staffRes?.success) setStaffs(staffRes.data.map(st => ({ ...st, id: st._id })));
        const transactionsRes = results[idx++];
        if (transactionsRes?.success) setTransactions(transactionsRes.data.map(mapTransaction));
        const examResultsRes = results[idx++];
        if (Array.isArray(examResultsRes)) setExamResultsRef.current(examResultsRes.map(r => ({ ...r, id: r._id || r.id })));
        const evalsRes = results[idx++];
        if (evalsRes?.success) {
          setPrivateEvaluations(evalsRes.data.map((e) => ({
            ...e,
            id: e._id || e.id,
            comment: e.content || e.comment || '',
          })));
        }
      } else if (isTeacher) {
        const transactionsRes = results[idx++];
        if (transactionsRes?.success) setTransactions(transactionsRes.data.map(mapTransaction));
        const teacherSelfRes = results[idx++];
        if (teacherSelfRes?.success) setTeachers([mapTeacher(teacherSelfRes.data)]);
      }

      if (isStudent) {
        const studentRes = results[idx++];
        if (studentRes?.success) setStudents([mapStudent(studentRes.data)]);
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

    document.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      clearInterval(interval);
      if (offDataRefresh) offDataRefresh();
      document.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [triggerBackgroundSync, onDataRefresh]);

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
    triggerBackgroundSync,
    systemLogs,
    addSystemLog,
  };
}
