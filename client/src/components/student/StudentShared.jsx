import React from 'react';

export const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="cms-sd-stat bg-white rounded-2xl p-4 shadow-sm border border-gray-100 min-w-0 h-full flex flex-col transition-all duration-200 active:scale-[0.98] hover:shadow-md">
    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-2 shadow-sm shrink-0`}>
      <Icon size={16} className="text-white" aria-hidden="true" />
    </div>
    <p className="text-xs text-gray-500 font-medium leading-none">{label}</p>
    <p className="mt-1.5 text-xl font-black text-gray-800 leading-none tabular-nums">
      {value}
      {sub != null && sub !== '' && (
        <span className="text-xs font-normal text-gray-400 ml-1">{sub}</span>
      )}
    </p>
  </div>
);

export const CourseSwitcher = ({ courses, activeCourseName, onChange }) => {
  if (!courses || courses.length <= 1) return null;
  return (
    <div className="cms-sd-courses mb-4 sm:mb-5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 px-0.5">
        Khóa học của bạn
      </p>
      <div className="flex gap-2.5 overflow-x-auto overscroll-x-contain pb-1 -mx-0.5 px-0.5 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {courses.map((c) => {
          const name = c.courseName || c.name;
          const active = name === activeCourseName;
          return (
            <button
              key={c.enrollmentId || c.id || name}
              type="button"
              onClick={() => onChange(name)}
              title={name}
              className={`snap-start shrink-0 w-[min(88vw,20rem)] sm:w-[16rem] text-left px-4 py-3.5 rounded-2xl border-2 transition-all duration-200 active:scale-[0.98] ${
                active
                  ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-100'
                  : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'
              }`}
            >
              <p
                className={`text-sm font-bold leading-snug line-clamp-2 ${
                  active ? 'text-blue-800' : 'text-slate-800'
                }`}
              >
                {name}
              </p>
              <p className="text-xs text-slate-500 mt-1.5 truncate">
                GV: {c.teacherName || 'Chưa phân công'}
              </p>
              <p className="text-xs font-semibold mt-1 text-slate-400 tabular-nums">
                {c.completedSessions ?? 0}/{c.totalSessions ?? 12} buổi
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export {
  getGradeTextClasses,
  getGradePillClasses,
  getGradeLabel,
} from '../../utils/gradeColors';
