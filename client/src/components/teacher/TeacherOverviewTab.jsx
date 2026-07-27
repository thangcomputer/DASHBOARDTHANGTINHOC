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
  return (
          <div className="px-4 md:px-8 py-6 md:py-8 space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
            
            {/* ── HIGHLIGHT HERO SECTION ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
               {/* Income & Performance Card */}
               <div className="md:col-span-2 xl:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 rounded-[40px] p-6 sm:p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-900/20">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8 h-full">
                     <div className="space-y-4">
                        <div>
                           <p className="text-blue-300 text-xs font-black uppercase tracking-widest mb-1">Thu nhập tháng {new Date().getMonth()+1}</p>
                           <h3 className="text-2xl sm:text-4xl font-black">{totalMonthlyIncome.toLocaleString('vi-VN')} <span className="text-lg sm:text-xl">đ</span></h3>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="flex flex-col">
                              <span className="text-slate-400 text-xs font-black uppercase tracking-widest">Học viên hoàn thành</span>
                              <span className="text-2xl font-black text-emerald-400">{completed} <span className="text-xs text-slate-400">người</span></span>
                           </div>
                           <div className="w-[1px] h-10 bg-white/10" />
                           <div className="flex flex-col">
                              <span className="text-slate-400 text-xs font-black uppercase tracking-widest">Buổi dạy đã xong</span>
                              <span className="text-2xl font-black text-blue-400">{totalDone} <span className="text-xs text-slate-400">buổi</span></span>
                           </div>
                        </div>
                     </div>
                     <button onClick={() => navigate('/teacher/finance')} 
                        className="bg-white/10 hover:bg-white/20 border border-white/10 px-8 py-4 rounded-3xl text-sm font-black uppercase tracking-widest transition-all flex items-center gap-2 group">
                        Chi tiết thu nhập <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                     </button>
                  </div>
               </div>

               {/* Rating & Identity Card */}
               <div className="md:col-span-2 xl:col-span-1 bg-white rounded-[40px] p-8 border border-gray-100 shadow-xl shadow-gray-200/50 flex flex-col items-center justify-center text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-400 to-amber-300" />
                  <div className={`w-20 h-20 ${(currentTeacher?.color || 'bg-blue-600')} rounded-3xl flex items-center justify-center text-white text-3xl font-black shadow-lg mb-4`}>
                    {teacherName.substring(0, 2).toUpperCase()}
                  </div>
                  <h4 className="text-lg font-black text-gray-800 mb-1">{teacherName}</h4>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Giảng viên Chuyên môn</p>
                  
                  {/* STAR RATING DISPLAY */}
                  <div className="bg-orange-50 px-6 py-4 rounded-[32px] border border-orange-100 w-full">
                     <div className="flex items-center justify-center gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map(star => (
                           <Star key={star} size={20} className={star <= Math.round(teacherRating.avg) ? "text-orange-500 fill-orange-500" : "text-gray-200"} />
                        ))}
                     </div>
                     <p className="text-2xl font-black text-orange-600 leading-none">{teacherRating.avg || '—'}</p>
                     <p className="text-xs font-black text-orange-400 uppercase tracking-widest mt-1">{teacherRating.count} lượt đánh giá từ học viên</p>
                  </div>
               </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 min-[576px]:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {[
                { icon: Users, label: 'Đang dạy', value: students.length, sub: 'học viên', color: 'from-blue-500 to-blue-600', bg: 'bg-blue-50' },
                { icon: BookOpen, label: 'Lộ trình', value: `${totalDone}/${totalSess}`, sub: 'tổng số buổi', color: 'from-purple-500 to-purple-600', bg: 'bg-purple-50' },
                { icon: Award, label: 'Điểm TB', value: avgGrade, sub: '/ 10 điểm', color: 'from-amber-500 to-orange-500', bg: 'bg-orange-50' },
                { icon: Star, label: 'Uy tín', value: teacherRating.avg, sub: `${teacherRating.count} đánh giá`, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50' },
              ].map(({ icon: Icon, label, value, sub, color, bg }) => (
                <div key={label} className="bg-white rounded-2xl sm:rounded-[32px] p-4 sm:p-6 shadow-sm border border-gray-100 hover:shadow-xl hover:scale-[1.02] transition-all group overflow-hidden relative min-w-0">
                  <div className={`absolute -right-4 -bottom-4 w-20 h-20 ${bg} rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700`} />
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg group-hover:rotate-12 transition-transform`}>
                    <Icon size={24} className="text-white" />
                  </div>
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1 relative z-10">{label}</p>
                  <p className="text-2xl sm:text-3xl font-black text-gray-800 relative z-10 truncate">{value}</p>
                  <p className="text-xs font-bold text-gray-400 mt-1 relative z-10">{sub}</p>
                </div>
              ))}
            </div>

            {/* ── QUICK ACTIONS ── */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-3xl p-6 text-white shadow-xl shadow-blue-900/20">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={18} className="text-yellow-300" />
                <h3 className="font-black text-base">Công việc cần xử lý ngay</h3>
              </div>
              <div className="grid grid-cols-1 min-[576px]:grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    icon: UserCheck,
                    label: 'Điểm danh',
                    sub: `${mySchedules.filter(s => s.status === 'scheduled' && new Date(s.date).toDateString() === new Date().toDateString()).length} buổi hôm nay`,
                    color: 'bg-green-500/20 hover:bg-green-500/30 border-green-400/30',
                    action: () => navigate('/teacher#students'),
                  },
                  {
                    icon: Clipboard,
                    label: 'Chấm điểm',
                    sub: `${students.filter(s => !s.lastGrade || s.lastGrade === 0).length} HV chưa có điểm`,
                    color: 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-400/30',
                    action: () => navigate('/teacher#students'),
                  },
                  {
                    icon: MessageSquare,
                    label: 'Tin nhắn',
                    sub: `${myNotifs} chưa đọc`,
                    color: 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-400/30',
                    action: () => navigate('/teacher/inbox'),
                  },
                  {
                    icon: Calendar,
                    label: 'Xếp lịch',
                    sub: 'Thêm buổi dạy mới',
                    color: 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-400/30',
                    action: () => { navigate('/teacher#schedule'); },
                  },
                ].map(({ icon: Icon, label, sub, color, action }) => (
                  <button
                    key={label}
                    onClick={action}
                    className={`${color} border rounded-2xl p-4 text-left transition-all hover:scale-[1.02] active:scale-[0.98]`}
                  >
                    <Icon size={22} className="text-white mb-2" />
                    <p className="font-bold text-sm text-white">{label}</p>
                    <p className="text-xs text-white/60 mt-0.5">{sub}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Student cards (compact) */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <GraduationCap size={18} className="text-blue-600" /> Học viên được phân công
                  </h3>
                </div>
                {students.map(s => {
                  const done = s.totalSessions - s.remainingSessions;
                  const pct = Math.round((done / s.totalSessions) * 100);
                  return (
                    <div key={s.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition group">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 bg-white shadow-sm">
                        <img src={resolveAvatarUrl({ role: 'student' })} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800">{s.name}</p>
                        <p className="text-xs text-gray-400">{s.course}</p>
                        <div className="h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-yellow-400' : 'bg-blue-400'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-black text-gray-800">{pct}%</p>
                        <p className="text-xs text-gray-400">{done}/{s.totalSessions}</p>
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => navigate('/teacher#students')}
                  className="w-full text-sm font-bold text-blue-600 bg-blue-50 py-3 rounded-xl hover:bg-blue-100 transition flex items-center justify-center gap-1">
                  Quản lý chi tiết <ChevronRight size={14} />
                </button>
              </div>

              {/* Right sidebar */}
              <div className="lg:col-span-5 space-y-6">
                {/* Rating summary */}
                <TeacherRatingDisplay rating={teacherRating} RATING_CRITERIA={RATING_CRITERIA} />

                {/* Upcoming schedule */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h4 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                      <Calendar size={14} className="text-blue-500" /> Lịch dạy sắp tới
                    </h4>
                    <button onClick={() => navigate('/teacher#schedule')} className="text-xs text-blue-600 font-bold hover:underline">
                      Xem tất cả →
                    </button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {mySchedules.filter(s => s.status === 'scheduled').slice(0, 3).length === 0 && (
                      <p className="px-5 py-4 text-xs text-gray-400 text-center">Chưa có lịch dạy.</p>
                    )}
                    {mySchedules.filter(s => s.status === 'scheduled').slice(0, 3).map(s => (
                      <div key={s.id} className="px-5 py-3 flex items-center gap-3 hover:bg-blue-50/30 transition group">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex flex-col items-center justify-center text-blue-600 flex-shrink-0">
                          <span className="text-sm font-black">{new Date(s.date).getDate()}</span>
                          <span className="text-[8px] font-bold opacity-60">T{new Date(s.date).getMonth()+1}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">{s.topic}</p>
                          <p className="text-xs text-gray-400">{s.startTime} • {s.studentName}</p>
                        </div>
                        <span className="text-xs text-blue-500 font-bold bg-blue-50 px-2 py-0.5 rounded-lg flex-shrink-0">{s.startTime}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Activity summary */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
                  <div className="flex items-center gap-2 mb-3">
                    <Activity size={16} className="text-blue-400" />
                    <h4 className="font-bold text-sm">Tóm tắt hoạt động</h4>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'Tổng buổi dạy đã hoàn thành', value: mySchedules.filter(s => s.status === 'completed').length, color: 'text-green-400' },
                      { label: 'Đánh giá trung bình', value: `${teacherRating?.avg || '—'} ⭐`, color: 'text-yellow-400' },
                      { label: 'HV đã hoàn thành KH', value: completed, color: 'text-blue-400' },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">{item.label}</span>
                        <span className={`font-black ${item.color}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
  );
}
