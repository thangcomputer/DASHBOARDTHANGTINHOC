import { useCallback } from 'react';
import api from '../services/api';
import { maskStudentPhone } from '../utils/studentMask';

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

function studentIdOf(r) {
  return String(r?.studentId?._id || r?.studentId || '');
}

/** Sao từ Evaluation / optimistic rating (criteria.stars | stars | suy từ option keys) */
export function starsFromRating(r) {
  if (!r) return 0;
  const direct = Number(r.criteria?.stars ?? r.stars);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const crit = r.criteria && typeof r.criteria === 'object' ? r.criteria : {};
  const scores = [];
  Object.entries(crit).forEach(([cat, key]) => {
    if (cat === 'stars') return;
    const opt = RATING_CRITERIA[cat]?.options?.find((o) => o.key === key);
    if (opt) scores.push(opt.score);
  });
  if (!scores.length) return Number.isFinite(direct) ? direct : 0;
  return Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10;
}

/**
 * Tính avg/count từ document GV (có thể kèm ratings từ API list).
 * Dùng trực tiếp object trong bảng Admin — không phụ thuộc TeachersContext stale.
 */
export function computeTeacherRating(teacher) {
  if (!teacher) return { avg: 0, count: 0, ratings: [] };
  const raw = Array.isArray(teacher.ratings) ? teacher.ratings : [];
  const seen = new Set();
  const uniqueRatings = [];
  for (const r of raw) {
    const sid = studentIdOf(r);
    const key = sid || String(r._id || r.id || JSON.stringify(r.criteria || {}) + String(r.createdAt || ''));
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueRatings.push(r);
  }
  if (uniqueRatings.length > 0) {
    const avg = Math.round(
      (uniqueRatings.reduce((s, r) => s + starsFromRating(r), 0) / uniqueRatings.length) * 10,
    ) / 10;
    return { avg, count: uniqueRatings.length, ratings: uniqueRatings };
  }
  const avgStored = Number(teacher.averageRating) || 0;
  const countStored = Number(teacher.ratingCount) || 0;
  if (avgStored > 0) {
    return { avg: avgStored, count: Math.max(countStored, 1), ratings: [] };
  }
  return { avg: 0, count: 0, ratings: [] };
}

/**
 * Teacher ratings (criteria-based) for DataProvider.
 */
export function useDataRatings({ students, teachers, setTeachers, triggerBackgroundSync, addNotification, refreshTeachers }) {
  const rateTeacher = useCallback(async (teacherId, studentId, criteria, comment, opts = {}) => {
    const tid = String(teacherId?._id || teacherId || '');
    const sid = String(studentId?._id || studentId || '');
    if (!tid || !sid) throw new Error('Thiếu giảng viên hoặc học viên');

    const previousTeachers = [...teachers];
    const student = students.find((s) => String(s.id) === sid || String(s._id) === sid);
    const courseName = opts.courseName || student?.course || '';

    const scores = Object.entries(criteria || {}).map(([cat, key]) => {
      const opt = RATING_CRITERIA[cat]?.options.find((o) => o.key === key);
      return opt ? opt.score : 3;
    });
    const stars = scores.length
      ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 10) / 10
      : 0;

    const existedBefore = (teachers.find((x) => String(x.id) === tid || String(x._id) === tid)?.ratings || [])
      .some((r) => studentIdOf(r) === sid);

    setTeachers((prev) => prev.map((t) => {
      if (String(t.id) !== tid && String(t._id) !== tid) return t;
      const ratings = t.ratings || [];
      const existingIdx = ratings.findIndex((r) => studentIdOf(r) === sid);
      const newRating = {
        studentId: sid,
        studentName: student?.name || '',
        stars,
        criteria: { ...criteria, stars },
        comment,
        date: new Date().toISOString().split('T')[0],
      };
      const newRatings = [...ratings];
      if (existingIdx >= 0) newRatings[existingIdx] = newRating;
      else newRatings.push(newRating);
      return {
        ...t,
        ratings: newRatings,
        averageRating: Math.round(
          (newRatings.reduce((s, r) => s + starsFromRating(r), 0) / newRatings.length) * 10,
        ) / 10,
        ratingCount: newRatings.length,
      };
    }));

    try {
      const res = await api.evaluations.submit({
        studentId: sid,
        studentName: student?.name || '',
        targetTeacherId: tid,
        type: 'teacher_rating',
        criteria: { ...criteria, stars },
        content: comment,
        ...(courseName ? { courseName } : {}),
        ...(opts.finalizeCourseEnd ? { finalizeCourseEnd: true } : {}),
      });
      if (res && res.success === false) {
        const err = new Error(res.message || 'Không gửi được đánh giá');
        err.code = res.code;
        throw err;
      }
      const studentLabel = `Học viên ${maskStudentPhone(student?.phone || student?.zalo)}`;
      const evalId = res?.data?._id || res?.data?.id;
      const isUpdate = !!res?.meta?.isUpdate || existedBefore;
      addNotification(
        tid,
        'teacher',
        isUpdate
          ? `${studentLabel} đã cập nhật lại đánh giá ${stars}/5 sao`
          : `${studentLabel} đã đánh giá bạn ${stars}/5 sao`,
        'EVALUATION',
        evalId ? `/teacher?evaluationId=${encodeURIComponent(evalId)}` : '/teacher',
      );
      if (typeof refreshTeachers === 'function') {
        Promise.resolve(refreshTeachers()).catch(() => {});
      }
      triggerBackgroundSync();
    } catch (err) {
      setTeachers(previousTeachers);
      throw err;
    }
  }, [students, teachers, setTeachers, triggerBackgroundSync, addNotification, refreshTeachers]);

  const getTeacherRating = useCallback((teacherId, teacherOverride = null) => {
    if (teacherOverride) return computeTeacherRating(teacherOverride);
    const tid = String(teacherId?._id || teacherId || '');
    const teacher = teachers.find((t) => String(t.id) === tid || String(t._id) === tid);
    return computeTeacherRating(teacher);
  }, [teachers]);

  return {
    RATING_CRITERIA,
    rateTeacher,
    getTeacherRating,
  };
}
