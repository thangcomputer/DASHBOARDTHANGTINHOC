import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { loadState } from './dataStorage';

/**
 * Private evaluations (hidden from teachers) for DataProvider.
 */
export function useDataEvaluations({ students, teachers, triggerBackgroundSync, addNotification }) {
  const [privateEvaluations, setPrivateEvaluations] = useState(() => loadState('thvp_privateEvaluations', []));

  useEffect(() => {
    localStorage.setItem('thvp_privateEvaluations', JSON.stringify(privateEvaluations));
  }, [privateEvaluations]);

  const submitPrivateEvaluation = useCallback(async (data) => {
    const previousEvals = [...privateEvaluations];
    const student = students.find(s => (String(s.id) === String(data.studentId) || String(s._id) === String(data.studentId)));
    const teacher = teachers.find(t => (String(t.id) === String(data.teacherId) || String(t._id) === String(data.teacherId)));

    const evalData = {
      ...data,
      studentName: student?.name || 'Học viên',
      teacherName: teacher?.name || 'Giảng viên',
      branchId: student?.branchId || null,
      branchCode: student?.branchCode || '',
      type: 'admin_feedback',
      targetTeacherId: data.teacherId,
      content: data.comment || '',
    };

    setPrivateEvaluations(prev => {
      const existingIdx = prev.findIndex(ev =>
        String(ev.studentId) === String(data.studentId) &&
        ev.courseName === data.courseName &&
        ev.milestone === data.milestone
      );

      const optimisticData = {
        ...evalData,
        id: existingIdx >= 0 ? prev[existingIdx].id : Date.now() + Math.random(),
        date: new Date().toISOString().split('T')[0],
        read: false
      };

      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = optimisticData;
        return next;
      }
      return [...prev, optimisticData];
    });

    try {
      const res = await api.evaluations?.submit(evalData);
      if (res && res.success === false) throw new Error(res.message);
      addNotification(null, 'admin', `📢 Đánh giá RIÊNG mới từ HV ${student?.name || 'Học viên'}`);
      triggerBackgroundSync();
    } catch (err) {
      setPrivateEvaluations(previousEvals);
      throw err;
    }
  }, [students, teachers, privateEvaluations, triggerBackgroundSync, addNotification]);

  const getPrivateEvaluationsForAdmin = useCallback(() => {
    return [...privateEvaluations].sort((a, b) => b.id - a.id);
  }, [privateEvaluations]);

  const markEvaluationRead = useCallback(async (evalId) => {
    setPrivateEvaluations(prev => prev.map(ev => ev.id === evalId ? { ...ev, read: true } : ev));
    try {
      await api.evaluations?.markRead(evalId);
    } catch (e) {}
  }, []);

  return {
    privateEvaluations,
    setPrivateEvaluations,
    submitPrivateEvaluation,
    getPrivateEvaluationsForAdmin,
    markEvaluationRead,
  };
}
