import React from 'react';

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
  if (!courses || courses.length <= 1) return null;
  return (
    <section className="min-w-0">
      <p className="cms-sd-caption font-semibold uppercase tracking-wide mb-3 text-slate-400">
        Khóa học của bạn
      </p>
      <div className="flex gap-4 overflow-x-auto overscroll-x-contain pb-1 -mx-1 px-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {courses.map((c) => {
          const name = c.courseName || c.name;
          const active = name === activeCourseName;
          const total = c.totalSessions ?? 12;
          const done = c.completedSessions ?? 0;
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
              <p className="cms-sd-caption mt-2 truncate">
                GV: {c.teacherName || 'Chưa phân công'}
              </p>
              <div className="mt-3">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      active ? 'bg-blue-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="cms-sd-caption font-semibold text-slate-500 tabular-nums">
                    {done}/{total} buổi
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

export {
  getGradeTextClasses,
  getGradePillClasses,
  getGradeLabel,
} from '../../utils/gradeColors';
