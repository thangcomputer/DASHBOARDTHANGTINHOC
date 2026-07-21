import { useCallback } from 'react';
import api from '../services/api';

export const RATING_CRITERIA = {
  teaching: {
    label: 'Phương pháp dạy', options: [
      { key: 'effective', label: 'Hiệu quả', score: 5 },
      { key: 'normal', label: 'Bình thường', score: 3 },
      { key: 'limited', label: 'Kiến thức còn hạn chế', score: 1 },
    ]
  },
  voice: {
    label: 'Giọng nói', options: [
      { key: 'good', label: 'Ổn', score: 5 },
      { key: 'hard', label: 'Khó nghe', score: 2 },
    ]
  },
  guidance: {
    label: 'Hướng dẫn', options: [
      { key: 'fast', label: 'Nhanh', score: 4 },
      { key: 'ok', label: 'Ổn', score: 5 },
      { key: 'slow', label: 'Chậm', score: 2 },
    ]
  },
  support: {
    label: 'Hỗ trợ học viên', options: [
      { key: 'enthusiastic', label: 'Nhiệt tình', score: 5 },
      { key: 'moderate', label: 'Tương đối', score: 3 },
      { key: 'none', label: 'Không hỗ trợ', score: 1 },
    ]
  }
};

/**
 * Teacher ratings (criteria-based) for DataProvider.
 */
export function useDataRatings({ students, teachers, setTeachers, triggerBackgroundSync, addNotification }) {
  const rateTeacher = useCallback(async (teacherId, studentId, criteria, comment) => {
    const previousTeachers = [...teachers];
    const student = students.find(s => (String(s.id) === String(studentId) || String(s._id) === String(studentId)));

    const scores = Object.entries(criteria || {}).map(([cat, key]) => {
      const opt = RATING_CRITERIA[cat]?.options.find(o => o.key === key);
      return opt ? opt.score : 3;
    });
    const stars = Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10;

    setTeachers(prev => prev.map(t => {
      if (String(t.id) !== String(teacherId) && String(t._id) !== String(teacherId)) return t;
      const ratings = t.ratings || [];
      const existingIdx = ratings.findIndex(r => String(r.studentId) === String(studentId));
      const newRating = {
        studentId, studentName: student?.name || '', stars, criteria, comment,
        date: new Date().toISOString().split('T')[0],
      };
      const newRatings = [...ratings];
      if (existingIdx >= 0) newRatings[existingIdx] = newRating;
      else newRatings.push(newRating);
      return { ...t, ratings: newRatings };
    }));

    try {
      const res = await api.evaluations.submit({
        studentId,
        studentName: student?.name || '',
        targetTeacherId: teacherId,
        type: 'teacher_rating',
        criteria: { ...criteria, stars },
        content: comment
      });
      if (res && res.success === false) throw new Error(res.message);
      addNotification(teacherId, 'teacher', `${student?.name || 'Học viên'} đã đánh giá bạn ${stars}/5 sao`);
      triggerBackgroundSync();
    } catch (err) {
      setTeachers(previousTeachers);
      throw err;
    }
  }, [students, teachers, setTeachers, triggerBackgroundSync, addNotification]);

  const getTeacherRating = useCallback((teacherId) => {
    const teacher = teachers.find(t => String(t.id) === String(teacherId));
    if (!teacher || !teacher.ratings?.length) return { avg: 0, count: 0, ratings: [] };
    const avg = Math.round((teacher.ratings.reduce((s, r) => s + (r.criteria?.stars || 0), 0) / teacher.ratings.length) * 10) / 10;
    return { avg, count: teacher.ratings.length, ratings: teacher.ratings };
  }, [teachers]);

  return {
    RATING_CRITERIA,
    rateTeacher,
    getTeacherRating,
  };
}
