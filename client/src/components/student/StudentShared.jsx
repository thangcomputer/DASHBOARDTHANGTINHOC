import React from 'react';

export const StatCard = ({ icon: Icon, label, value, sub, color }) => (
  <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-100 min-w-0">
    <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3 shadow-md`}>
      <Icon size={18} className="text-white" />
    </div>
    <p className="text-xs text-gray-500 font-medium">{label}</p>
    <p className="text-xl sm:text-2xl font-black text-gray-800 leading-tight">
      {value} <span className="text-xs font-normal text-gray-400">{sub}</span>
    </p>
  </div>
);

export const CourseSwitcher = ({ courses, activeCourseName, onChange }) => {
  if (!courses || courses.length <= 1) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 mb-6">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Khóa học của bạn</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {courses.map((c) => {
          const name = c.courseName || c.name;
          const active = name === activeCourseName;
          return (
            <button
              key={c.enrollmentId || c.id || name}
              type="button"
              onClick={() => onChange(name)}
              className={`shrink-0 min-w-[140px] text-left px-4 py-3 rounded-xl border-2 transition-all ${
                active
                  ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-100'
                  : 'border-slate-100 bg-slate-50 hover:border-slate-200'
              }`}
            >
              <p className={`text-sm font-black truncate ${active ? 'text-blue-800' : 'text-slate-800'}`}>{name}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 truncate">GV: {c.teacherName || 'Chưa phân công'}</p>
              <p className="text-[10px] font-bold mt-1 text-slate-400">
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
