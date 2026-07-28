import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlayCircle, Clock, CheckCircle, MessageSquare, Download,
  BookOpen, Star, TrendingUp, Zap, Calendar, Video,
  ClipboardList, ChevronRight, XCircle, Phone,
} from 'lucide-react';
import { CourseSwitcher, StatCard } from './StudentShared';
import { getGradeTextClasses, getGradePillClasses, getGradeLabel } from '../../utils/gradeColors';

export default function StudentOverviewTab({
  studentData,
  enrollments,
  activeCourseName,
  setActiveCourseName,
  viewStudent,
  progressPct,
  teacherRatingData,
  isNew,
  myAssignments,
  upcomingScheduleCount,
  myUnreadMsgs,
  studyLogs,
  materials,
}) {
  const navigate = useNavigate();
  const pendingHw = myAssignments ? myAssignments.filter((a) => !a.mySubmission).length : 0;
  const joinLive = Boolean(viewStudent.joinClassUrl && viewStudent.isLikelyLiveClass);

  return (
    <div className="cms-sd space-y-4 sm:space-y-5 min-w-0">
      {/* Greeting */}
      <div className="px-0.5 sm:px-4 md:px-8 pt-1 sm:pt-3 flex flex-col gap-1 sm:gap-2 sm:flex-row sm:items-end sm:justify-between min-w-0">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-slate-900 truncate leading-tight">
            Chào mừng, {studentData.name}! 👋
          </h2>
          <p className="text-xs text-slate-400 italic mt-1 leading-snug">
            &quot;Học hôm nay, thành công mai sau.&quot;
          </p>
        </div>
        <p className="text-xs font-bold text-red-600 uppercase tracking-wide shrink-0">
          Trung tâm Thắng Tin Học
        </p>
      </div>

      <div className="w-full max-w-7xl mx-auto px-0.5 sm:px-4 md:px-8 lg:px-12">
        <CourseSwitcher
          courses={enrollments}
          activeCourseName={activeCourseName || viewStudent.course}
          onChange={setActiveCourseName}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-6">
          {/* ═══ CỘT CHÍNH ═══ */}
          <div className="lg:col-span-8 space-y-4 sm:space-y-5">

            {/* Banner lớp sắp diễn ra */}
            <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-4 sm:p-6 md:p-8 text-white shadow-md relative overflow-hidden">
              <div className="relative z-10 space-y-2.5 sm:space-y-3">
                <p className="text-red-100 text-xs font-bold uppercase tracking-wide flex items-center gap-1.5">
                  <Zap size={12} className="shrink-0" aria-hidden="true" />
                  Lớp học sắp diễn ra
                </p>
                <h2 className="text-base sm:text-xl md:text-3xl font-black uppercase tracking-tight leading-snug line-clamp-2">
                  {viewStudent.course}
                </h2>
                <div className="flex flex-col gap-2.5 sm:gap-3 md:flex-row md:items-center">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm opacity-90 flex items-center gap-2 min-w-0">
                      <Calendar size={14} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {viewStudent.nextClass} | GV: {viewStudent.teacher}
                        {!isNew && teacherRatingData.count > 0 && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 bg-yellow-400 text-red-700 px-1.5 py-0.5 rounded-md text-xs font-black">
                            <Star size={10} className="fill-red-700" aria-hidden="true" /> {teacherRatingData.avg}
                          </span>
                        )}
                      </span>
                    </p>
                    <span className="inline-flex items-center text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      Sắp diễn ra
                    </span>
                  </div>
                  <a
                    href={viewStudent.joinClassUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className={`w-full md:w-auto min-h-11 px-5 py-2.5 sm:py-3 rounded-xl font-bold text-sm text-center shadow-md active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 ${
                      joinLive
                        ? 'bg-red-600 text-white animate-pulse shadow-red-500/40 hover:bg-red-700'
                        : 'bg-white text-red-600 hover:bg-red-50'
                    }`}
                  >
                    <Video size={18} aria-hidden="true" />
                    {joinLive ? '🔴 THAM GIA LỚP TRỰC TUYẾN' : 'VÀO LỚP NGAY'}
                  </a>
                </div>
              </div>
              <PlayCircle size={160} className="absolute -right-8 -bottom-8 text-white opacity-10 hidden md:block pointer-events-none" aria-hidden="true" />
            </div>

            {/* Stats 2 cột */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard icon={BookOpen} label="Đã học" value={viewStudent.completedSessions} sub={`/ ${viewStudent.totalSessions}`} color="from-red-500 to-red-600" />
              <StatCard icon={Clock} label="Còn lại" value={viewStudent.remainingSessions} sub="buổi" color="from-[#1E3A8A] to-[#203DB5]" />
              <StatCard icon={Star} label="Điểm TB" value={viewStudent.avgGrade} sub="/ 10" color="from-orange-400 to-orange-500" />
              <StatCard icon={TrendingUp} label="Tiến độ" value={`${progressPct}%`} sub="hoàn thành" color="from-emerald-400 to-emerald-500" />
            </div>

            {/* Việc cần làm */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-2xl rounded-full pointer-events-none" aria-hidden="true" />
              <div className="flex items-center gap-2 mb-3 relative z-10">
                <Zap size={18} className="text-yellow-500 fill-yellow-500 shrink-0" aria-hidden="true" />
                <h3 className="text-base font-extrabold text-slate-800 uppercase tracking-tight">
                  Việc cần làm hôm nay
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 relative z-10">
                <button
                  type="button"
                  onClick={() => navigate('/student#materials')}
                  className="bg-orange-50/60 hover:bg-orange-50 border border-orange-100 p-3.5 rounded-2xl flex flex-row sm:flex-col items-center sm:items-start gap-3 text-left transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-orange-600 shadow-sm border border-orange-100/50 shrink-0">
                    <ClipboardList size={18} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-800 text-sm leading-snug">Bài tập về nhà</h4>
                    <p className="text-orange-600 text-xs font-semibold mt-0.5">{pendingHw} bài cần nộp</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/student#schedule')}
                  className="bg-blue-50/60 hover:bg-blue-50 border border-blue-100 p-3.5 rounded-2xl flex flex-row sm:flex-col items-center sm:items-start gap-3 text-left transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50 shrink-0">
                    <Calendar size={18} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-800 text-sm leading-snug">Lịch học sắp tới</h4>
                    <p className="text-blue-600 text-xs font-semibold mt-0.5">{upcomingScheduleCount} buổi sắp tới</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/student/inbox')}
                  className="bg-purple-50/60 hover:bg-purple-50 border border-purple-100 p-3.5 rounded-2xl flex flex-row sm:flex-col items-center sm:items-start gap-3 text-left transition-all duration-200 active:scale-[0.98]"
                >
                  <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-purple-600 shadow-sm border border-purple-100/50 shrink-0">
                    <MessageSquare size={18} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-800 text-sm leading-snug">Tin nhắn &amp; Phản hồi</h4>
                    <p className="text-purple-600 text-xs font-semibold mt-0.5">{myUnreadMsgs} tin nhắn mới</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Nhật ký */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 min-w-0">
                <h3 className="text-base font-bold text-slate-700 flex items-center gap-2 min-w-0">
                  <Clock size={16} className="text-blue-500 shrink-0" aria-hidden="true" />
                  Nhật ký học tập
                </h3>
                <span className="text-xs text-gray-400 shrink-0 tabular-nums">{studyLogs.length} sự kiện</span>
              </div>
              <div className="divide-y divide-gray-50">
                {studyLogs.map((item, idx) => {
                  const isCancelled = item.type === 'cancelled';
                  return (
                    <div
                      key={idx}
                      className={`px-4 py-3 flex flex-col md:flex-row md:items-center justify-between ${
                        isCancelled ? 'bg-red-50/30' : 'hover:bg-gray-50'
                      } transition-colors duration-200 gap-2 md:gap-4`}
                    >
                      <div className="flex items-start md:items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            isCancelled ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                          }`}
                        >
                          {isCancelled ? <XCircle size={16} aria-hidden="true" /> : <CheckCircle size={16} aria-hidden="true" />}
                        </div>
                        <div className="min-w-0">
                          <p className={`font-bold text-sm truncate ${isCancelled ? 'text-red-700' : 'text-slate-800'}`}>
                            {item.index ? `Buổi ${item.index} — ` : ''}{item.date}{item.time ? ` (${item.time})` : ''}
                          </p>
                          <p className="text-xs text-slate-400 italic truncate mt-0.5">{item.note}</p>
                        </div>
                      </div>
                      {!isCancelled && item.grade != null && (
                        <div className="flex items-center gap-2 md:text-right flex-shrink-0 ml-12 md:ml-0">
                          <span className={`text-lg font-black tabular-nums ${getGradeTextClasses(item.grade)}`}>
                            {item.grade}
                          </span>
                          <span className="text-xs text-gray-400">/ 10</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ml-1 ${getGradePillClasses(item.grade)}`}>
                            {getGradeLabel(item.grade) || 'TB'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {studyLogs.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <div className="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                      <Clock size={22} className="text-slate-300" aria-hidden="true" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500">Chưa có sự kiện nào được ghi nhận.</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[18rem] mx-auto leading-relaxed">
                      Dữ liệu sẽ xuất hiện sau khi bắt đầu học.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══ CỘT PHỤ ═══ */}
          <div className="lg:col-span-4 space-y-4 sm:space-y-5">

            {/* Tiến độ + Điểm TB */}
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center min-h-[9.5rem]">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Tiến độ</p>
                <div className="relative w-[4.5rem] h-[4.5rem] sm:w-24 sm:h-24 mx-auto">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      fill="none"
                      stroke="url(#grad)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${progressPct * 2.64} 264`}
                      className="transition-all duration-1000"
                    />
                    <defs>
                      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" style={{ stopColor: '#ef4444' }} />
                        <stop offset="100%" style={{ stopColor: '#f97316' }} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div>
                      <p className="text-lg font-black text-gray-800 tabular-nums leading-none">{progressPct}%</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">hoàn thành</p>
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 w-full flex justify-between text-xs text-gray-500 px-0.5">
                  <span>Đã: <strong className="text-gray-800 tabular-nums">{studentData.completedSessions}</strong></span>
                  <span>Còn: <strong className="text-gray-800 tabular-nums">{studentData.remainingSessions}</strong></span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col items-center justify-center min-h-[9.5rem]">
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">Điểm TB</p>
                <p className="text-4xl font-black text-blue-600 tabular-nums leading-none">{studentData.avgGrade}</p>
                <p className="text-xs text-gray-400 mt-1.5">/ 10 điểm</p>
                <div
                  className={`mt-2 text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    studentData.avgGrade >= 8
                      ? 'bg-green-100 text-green-700'
                      : studentData.avgGrade >= 6
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {studentData.avgGrade >= 8 ? 'GIỎI' : studentData.avgGrade >= 6 ? 'KHÁ' : 'TRUNG BÌNH'}
                </div>
              </div>
            </div>

            {/* Tài liệu */}
            <div className="bg-slate-700 p-4 rounded-2xl text-white shadow-sm">
              <h3 className="font-bold text-xs uppercase tracking-wide text-slate-300 flex items-center gap-2 mb-2.5">
                <Download size={14} aria-hidden="true" /> Tài liệu
              </h3>
              <div className="space-y-1.5">
                {materials.filter((m) => m.category === 'document').slice(0, 3).map((m) => (
                  <div
                    key={m.id}
                    className="flex justify-between items-center bg-slate-600/50 p-2.5 rounded-xl hover:bg-slate-600 transition-colors duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`text-[10px] font-black px-1.5 py-0.5 rounded flex-shrink-0 ${
                          m.type === 'PDF' ? 'bg-red-500' : m.type === 'XLSX' ? 'bg-green-500' : 'bg-orange-500'
                        }`}
                      >
                        {m.type}
                      </span>
                      <span className="text-xs truncate">{m.name}</span>
                    </div>
                    <Download size={14} className="text-sky-300 flex-shrink-0 ml-2" aria-hidden="true" />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => navigate('/student#materials')}
                className="w-full mt-2.5 min-h-10 text-xs font-bold text-sky-300 hover:text-white flex items-center justify-center gap-1 py-2 rounded-xl bg-slate-600/40 hover:bg-slate-600 transition-all duration-200 active:scale-[0.98]"
              >
                Xem tất cả <ChevronRight size={12} aria-hidden="true" />
              </button>
            </div>

            {/* Contact */}
            <div className="hidden lg:block space-y-3">
              <button
                type="button"
                onClick={() => navigate('/student/inbox', { state: { selectUserId: studentData.teacherId } })}
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-all duration-200 group shadow-sm"
              >
                <MessageSquare className="group-hover:animate-bounce" size={18} aria-hidden="true" /> Nhắn tin Giảng viên
              </button>
              <a
                href="tel:0935758462"
                className="w-full flex items-center justify-center gap-3 bg-red-50 border-2 border-red-100 p-4 rounded-2xl font-bold text-red-600 hover:bg-red-100 transition-all duration-200 shadow-sm text-sm"
              >
                <Phone size={16} aria-hidden="true" /> Gọi Hotline hỗ trợ
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
