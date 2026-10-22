import React, { useEffect, useState } from 'react';
import { isEnrollmentCompleted } from '../../utils/enrollments';
import lessonPracticeApi from '../../services/lessonPracticeApi';

export const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="cms-sd-card !p-4 h-full flex flex-col min-w-0">
    <div
      className={`w-10 h-10 rounded-[12px] bg-gradient-to-br ${color} flex items-center justify-center mb-3 shadow-sm shrink-0`}
    >
      <Icon size={20} className="text-white" aria-hidden="true" />
    </div>
    <p className="text-xs sm:text-sm font-bold text-slate-600 truncate">{label}</p>
    <p className="mt-1.5 text-lg sm:text-2xl font-black text-slate-900 leading-none tabular-nums flex items-baseline gap-1">
      <span>{value}</span>
      {sub != null && sub !== '' && (
        <span className="text-xs font-medium text-slate-500">{sub}</span>
      )}
    </p>
  </div>
);

export const CourseSwitcher = ({ courses, activeCourseName, onChange }) => {
  const [videoProgress, setVideoProgress] = useState({ loading: true, error: '', byId: new Map(), byName: new Map() });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setVideoProgress((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const res = await lessonPracticeApi.student.subjects();
        if (cancelled) return;
        const byId = new Map();
        const byName = new Map();
        (res.data?.courses || [])
          .filter((course) => course.enrolled && course.deliveryMode === 'video')
          .forEach((course) => {
            const progress = {
              completed: Number(course.completedLessonCount) || 0,
              total: Number(course.lessonCount) || 0,
            };
            byId.set(String(course.id), progress);
            byName.set(normalizeCourseName(course.name), progress);
          });
        setVideoProgress({ loading: false, error: '', byId, byName });
      } catch (err) {
        if (!cancelled) {
          setVideoProgress({
            loading: false,
            error: err.message || 'Không tải được tiến độ bài học',
            byId: new Map(),
            byName: new Map(),
          });
        }
      }
    };
    const refresh = () => load();
    load();
    window.addEventListener('focus', refresh);
    window.addEventListener('lesson-practice-progress-updated', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('lesson-practice-progress-updated', refresh);
    };
  }, []);

  if (!courses || courses.length <= 1) return null;
  const orderedCourses = [...courses].sort(
    (a, b) => Number(isEnrollmentCompleted(a)) - Number(isEnrollmentCompleted(b)),
  );
  const progressForCourse = (course) => {
    const courseId = String(course.courseId || '');
    return (courseId && videoProgress.byId.get(courseId))
      || videoProgress.byName.get(normalizeCourseName(course.courseName || course.name))
      || null;
  };
  return (
    <section className="min-w-0">
      <p className="cms-sd-caption font-semibold uppercase tracking-wide mb-3 text-slate-400">
        Khóa học của bạn
      </p>
      {videoProgress.error && (
        <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Không đồng bộ được tiến độ bài học: {videoProgress.error}
        </p>
      )}
      <div className="flex gap-4 overflow-x-auto overscroll-x-contain pb-1 -mx-1 px-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {orderedCourses.map((c) => {
          const name = c.courseName || c.name;
          const lessonProgress = progressForCourse(c);
          const isVideoCourse = Boolean(lessonProgress);
          const total = isVideoCourse ? lessonProgress.total : (c.totalSessions ?? 12);
          const done = isVideoCourse ? lessonProgress.completed : (c.completedSessions ?? 0);
          const completed = isVideoCourse
            ? total > 0 && done >= total
            : isEnrollmentCompleted(c);
          const active = name === activeCourseName;
          const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
          return (
            <button
              key={c.enrollmentId || c.id || name}
              type="button"
              onClick={() => onChange(name)}
              title={name}
              className={`snap-start shrink-0 w-[min(calc(100vw-40px),20rem)] sm:w-[17rem] text-left p-4 rounded-[16px] border transition-all duration-200 active:scale-[0.98] min-h-[44px] ${
                active
                  ? 'border-blue-500 bg-blue-50/80 shadow-[0_6px_20px_rgba(0,0,0,0.06)] ring-1 ring-blue-100'
                  : completed
                    ? 'border-slate-200 bg-white hover:border-blue-300 shadow-[0_6px_20px_rgba(0,0,0,0.06)]'
                    : 'border-slate-100 bg-white hover:border-slate-200 shadow-[0_6px_20px_rgba(0,0,0,0.06)]'
              }`}
            >
              <p
                className={`cms-sd-card-title line-clamp-2 ${
                  active ? 'text-blue-800' : 'text-slate-800'
                }`}
              >
                {name}
              </p>
              {completed && (
                <span className="inline-flex mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  Đã hoàn thành
                </span>
              )}
              <p className="cms-sd-caption mt-2 truncate">
                GV: {c.teacherName || 'Chưa phân công'}
              </p>
              <div className="mt-3">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      active ? 'bg-blue-500' : completed ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="cms-sd-caption font-semibold text-slate-500 tabular-nums">
                    {videoProgress.loading && c.deliveryMode === 'video'
                      ? 'Đang đồng bộ bài học'
                      : `${done}/${total} ${isVideoCourse || c.deliveryMode === 'video' ? 'bài' : 'buổi'}`}
                  </span>
                  <span className="cms-sd-caption font-bold text-slate-600 tabular-nums">
                    {pct}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

function normalizeCourseName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export {
  getGradeTextClasses,
  getGradePillClasses,
  getGradeLabel,
} from '../../utils/gradeColors';
