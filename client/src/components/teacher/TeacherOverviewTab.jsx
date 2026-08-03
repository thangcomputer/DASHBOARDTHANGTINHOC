import React from 'react';
import {
  Calendar, ChevronRight, BookOpen, Award, Star, Zap, UserCheck, Clipboard,
  MessageSquare, GraduationCap, Users, Activity,
} from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';
import TeacherRatingDisplay from './TeacherRatingDisplay';

export default function TeacherOverviewTab({
  navigate, totalMonthlyIncome, completed, totalDone, teacherName, currentTeacher,
  teacherRating, students, totalSess, avgGrade, mySchedules, myNotifs, RATING_CRITERIA,
}) {
  const initials = (teacherName || 'GV').substring(0, 2).toUpperCase();
  const avatarTone = currentTeacher?.color || 'bg-indigo-600';

  return (
    <div className="px-4 md:px-8 py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">

      {/* ── Income + Profile ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
        <div className="md:col-span-2 xl:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white relative overflow-hidden shadow-lg shadow-slate-900/15">
          <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 md:gap-8 h-full">
            <div className="space-y-3 sm:space-y-4 min-w-0">
              <div>
                <p className="text-slate-300 text-xs sm:text-sm font-bold uppercase tracking-wider mb-1">
                  Thu nhập tháng {new Date().getMonth() + 1}
                </p>
                <h3 className="text-xl sm:text-3xl md:text-4xl font-black tabular-nums tracking-tight">
                  {totalMonthlyIncome.toLocaleString('vi-VN')}{' '}
                  <span className="text-base sm:text-xl font-bold">đ</span>
                </h3>
              </div>
              <div className="flex items-stretch gap-3 sm:gap-6">
                <div className="flex flex-col min-w-0">
                  <span className="text-slate-300 text-xs sm:text-sm font-bold uppercase tracking-wide">Học viên hoàn thành</span>
                  <span className="text-lg sm:text-2xl font-black text-emerald-400 tabular-nums mt-0.5">
                    {completed} <span className="text-xs text-slate-300 font-bold">người</span>
                  </span>
                </div>
                <div className="w-px self-stretch bg-white/10" aria-hidden="true" />
                <div className="flex flex-col min-w-0">
                  <span className="text-slate-300 text-xs sm:text-sm font-bold uppercase tracking-wide">Buổi dạy đã xong</span>
                  <span className="text-lg sm:text-2xl font-black text-sky-400 tabular-nums mt-0.5">
                    {totalDone} <span className="text-xs text-slate-300 font-bold">buổi</span>
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/teacher/finance')}
              className="w-full md:w-auto shrink-0 bg-white/10 hover:bg-white/15 border border-white/10 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 group min-h-11"
            >
              Chi tiết thu nhập
              <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="md:col-span-2 xl:col-span-1 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 to-orange-300" aria-hidden="true" />
          <div className={`w-14 h-14 sm:w-20 sm:h-20 ${avatarTone} rounded-full sm:rounded-2xl flex items-center justify-center text-white text-lg sm:text-3xl font-black shadow-md mb-3 sm:mb-4`}>
            {initials}
          </div>
          <h4 className="text-base sm:text-xl font-black text-slate-800 mb-0.5 truncate max-w-full px-2">{teacherName}</h4>
          <p className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 sm:mb-4">Giảng viên chuyên môn</p>
          <div className="bg-amber-50/80 px-4 sm:px-6 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-amber-100/80 w-full">
            <div className="flex items-center justify-center gap-0.5 mb-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={16}
                  className={star <= Math.round(teacherRating.avg) ? 'text-amber-500 fill-amber-500' : 'text-slate-200'}
                  aria-hidden="true"
                />
              ))}
            </div>
            <p className="text-xl sm:text-2xl font-black text-amber-600 leading-none tabular-nums">{teacherRating.avg || '—'}</p>
            <p className="text-xs sm:text-sm font-bold text-amber-600 uppercase tracking-wide mt-1.5">
              {teacherRating.count} lượt đánh giá từ học viên
            </p>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[
          { icon: Users, label: 'Đang dạy', value: students.length, sub: 'học viên', color: 'from-indigo-500 to-indigo-600', bg: 'bg-indigo-50' },
          { icon: BookOpen, label: 'Lộ trình', value: `${totalDone}/${totalSess}`, sub: 'tổng số buổi', color: 'from-violet-500 to-purple-600', bg: 'bg-violet-50' },
          { icon: Award, label: 'Điểm TB', value: avgGrade, sub: '/ 10 điểm', color: 'from-amber-500 to-orange-500', bg: 'bg-orange-50' },
          { icon: Star, label: 'Uy tín', value: teacherRating.avg, sub: `${teacherRating.count} đánh giá`, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50' },
        ].map(({ icon: Icon, label, value, sub, color, bg }) => (
          <div
            key={label}
            className="bg-white rounded-2xl p-3.5 sm:p-5 shadow-sm border border-slate-100 hover:shadow-md transition-all group overflow-hidden relative min-w-0"
          >
            <div className={`absolute -right-3 -bottom-3 w-14 h-14 sm:w-20 sm:h-20 ${bg} rounded-full opacity-40 group-hover:scale-125 transition-transform duration-500 pointer-events-none`} aria-hidden="true" />
            <div className={`w-8 h-8 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-2.5 sm:mb-3.5 shadow-sm relative z-10`}>
              <Icon size={16} className="text-white sm:hidden" aria-hidden="true" />
              <Icon size={20} className="text-white hidden sm:block" aria-hidden="true" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-slate-600 uppercase tracking-wide mb-0.5 relative z-10">{label}</p>
            <p className="text-lg sm:text-2xl md:text-3xl font-black text-slate-800 relative z-10 truncate tabular-nums">{value}</p>
            <p className="text-xs font-medium text-slate-500 mt-1 relative z-10">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Quick actions ── */}
      <div className="bg-gradient-to-br from-slate-900 via-zinc-900 to-slate-800 rounded-2xl p-3.5 sm:p-5 md:p-6 text-white shadow-lg shadow-slate-900/20">
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <Zap size={16} className="text-amber-300 shrink-0" aria-hidden="true" />
          <h3 className="font-bold text-sm sm:text-base">Công việc cần xử lý ngay</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            {
              icon: UserCheck,
              label: 'Điểm danh',
              sub: `${mySchedules.filter((s) => s.status === 'scheduled' && new Date(s.date).toDateString() === new Date().toDateString()).length} buổi hôm nay`,
              tint: 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-400/20',
              action: () => navigate('/teacher#students'),
            },
            {
              icon: Clipboard,
              label: 'Chấm điểm',
              sub: `${students.filter((s) => !s.lastGrade || s.lastGrade === 0).length} HV chưa có điểm`,
              tint: 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/20',
              action: () => navigate('/teacher#students'),
            },
            {
              icon: MessageSquare,
              label: 'Tin nhắn',
              sub: `${myNotifs} chưa đọc`,
              tint: 'bg-violet-500/15 hover:bg-violet-500/25 border-violet-400/20',
              action: () => navigate('/teacher/inbox'),
            },
            {
              icon: Calendar,
              label: 'Xếp lịch',
              sub: 'Thêm buổi dạy mới',
              tint: 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-400/20',
              action: () => { navigate('/teacher#schedule'); },
            },
          ].map(({ icon: Icon, label, sub, tint, action }) => (
            <button
              key={label}
              type="button"
              onClick={action}
              className={`${tint} border rounded-xl p-3 sm:p-4 text-left transition-all active:scale-[0.98] min-h-[4.25rem]`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon size={16} className="text-white/90 shrink-0" aria-hidden="true" />
                <p className="font-bold text-xs sm:text-sm text-white truncate">{label}</p>
              </div>
              <p className="text-[10px] sm:text-xs text-white/55 leading-snug pl-0 sm:pl-0">{sub}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Students */}
        <div className="lg:col-span-7 space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2 min-w-0">
              <GraduationCap size={16} className="text-indigo-600 shrink-0" aria-hidden="true" />
              <span className="truncate">Học viên được phân công</span>
            </h3>
          </div>
          {students.map((s) => {
            const done = s.totalSessions - s.remainingSessions;
            const pct = Math.round((done / s.totalSessions) * 100) || 0;
            return (
              <div
                key={s.id}
                className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm border border-slate-100 flex items-center gap-3 sm:gap-4 hover:shadow-md transition group"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden flex-shrink-0 bg-slate-50 shadow-sm border border-slate-100">
                  <img src={resolveAvatarUrl({ role: 'student' })} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{s.name}</p>
                  <p className="text-[10px] sm:text-xs text-slate-400 truncate mt-0.5">{s.course}</p>
                  <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden max-w-[11rem] sm:max-w-none">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-amber-400' : 'bg-indigo-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm sm:text-lg font-black text-slate-800 tabular-nums">{pct}%</p>
                  <p className="text-[10px] sm:text-xs text-slate-400 tabular-nums">{done}/{s.totalSessions}</p>
                </div>
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => navigate('/teacher#students')}
            className="w-full text-xs sm:text-sm font-bold text-indigo-600 bg-indigo-50 py-2.5 sm:py-3 rounded-xl hover:bg-indigo-100 transition flex items-center justify-center gap-1 min-h-11"
          >
            Quản lý chi tiết <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>

        {/* Right column */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-5">
          <TeacherRatingDisplay rating={teacherRating} RATING_CRITERIA={RATING_CRITERIA} students={students} />

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <h4 className="font-bold text-slate-700 text-xs sm:text-sm flex items-center gap-2 min-w-0">
                <Calendar size={14} className="text-indigo-500 shrink-0" aria-hidden="true" />
                <span className="truncate">Lịch dạy sắp tới</span>
              </h4>
              <button
                type="button"
                onClick={() => navigate('/teacher#schedule')}
                className="text-[10px] sm:text-xs text-indigo-600 font-bold hover:underline shrink-0"
              >
                Xem tất cả →
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {mySchedules.filter((s) => s.status === 'scheduled').slice(0, 3).length === 0 && (
                <p className="px-4 sm:px-5 py-4 text-xs text-slate-400 text-center">Chưa có lịch dạy.</p>
              )}
              {mySchedules.filter((s) => s.status === 'scheduled').slice(0, 3).map((s) => (
                <div key={s.id} className="px-4 sm:px-5 py-3 flex items-center gap-3 hover:bg-indigo-50/30 transition">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 flex flex-col items-center justify-center text-indigo-600 flex-shrink-0">
                    <span className="text-sm font-black tabular-nums">{new Date(s.date).getDate()}</span>
                    <span className="text-[8px] font-bold opacity-60">T{new Date(s.date).getMonth() + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">{s.topic}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 truncate">{s.startTime} · {s.studentName}</p>
                  </div>
                  <span className="text-[10px] sm:text-xs text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-lg flex-shrink-0">
                    {s.startTime}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-zinc-900 rounded-2xl p-4 sm:p-5 text-white shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Activity size={15} className="text-sky-400 shrink-0" aria-hidden="true" />
              <h4 className="font-bold text-xs sm:text-sm">Tóm tắt hoạt động</h4>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:gap-2.5">
              {[
                { label: 'Tổng buổi dạy đã hoàn thành', value: mySchedules.filter((s) => s.status === 'completed').length, color: 'text-emerald-400' },
                { label: 'Đánh giá trung bình', value: `${teacherRating?.avg || '—'} ★`, color: 'text-amber-300' },
                { label: 'HV đã hoàn thành KH', value: completed, color: 'text-sky-400' },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center gap-3 text-[11px] sm:text-xs">
                  <span className="text-slate-400 min-w-0">{item.label}</span>
                  <span className={`font-black tabular-nums shrink-0 ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
