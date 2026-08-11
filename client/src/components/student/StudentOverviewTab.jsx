import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlayCircle, Clock, CheckCircle, MessageSquare, Download,
  BookOpen, Star, TrendingUp, Zap, Calendar, Video,
  ClipboardList, ChevronRight, XCircle, Trophy, Award,
} from 'lucide-react';
import { CourseSwitcher, StatCard } from './StudentShared';
import { getGradeTextClasses, getGradePillClasses, getGradeLabel } from '../../utils/gradeColors';
import { openSiteChat } from '../FloatingMessenger';
import { useFloatingMessenger } from '../../context/FloatingMessengerContext';

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
  const { setSupportOpen } = useFloatingMessenger();
  const pendingHw = myAssignments ? myAssignments.filter((a) => !a.mySubmission).length : 0;
  const joinLive = Boolean(viewStudent.joinClassUrl && viewStudent.isLikelyLiveClass);
  const docs = materials.filter((m) => m.category === 'document').slice(0, 3);

  return (
    <div className="cms-sd cms-sd-stack min-w-0">
      <header className="cms-sd-page !py-0 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="cms-sd-h1 truncate">Chào mừng, {studentData.name}! 👋</h2>
          <p className="cms-sd-caption italic mt-1.5">
            &quot;Học hôm nay, thành công mai sau.&quot;
          </p>
        </div>
        <p className="cms-sd-caption font-bold text-red-600 uppercase tracking-wide shrink-0">
          Trung tâm Thắng Tin Học
        </p>
      </header>

      <div className="cms-sd-page !pt-0 cms-sd-stack">
        <CourseSwitcher
          courses={enrollments}
          activeCourseName={activeCourseName || viewStudent.course}
          onChange={setActiveCourseName}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-w-0">
          <div className="lg:col-span-8 cms-sd-stack min-w-0">
            {/* Upcoming class */}
            <section className="bg-gradient-to-br from-red-600 to-red-700 rounded-[16px] p-4 text-white shadow-[0_6px_20px_rgba(0,0,0,0.06)] relative overflow-hidden">
              <div className="relative z-10 space-y-3">
                <p className="cms-sd-caption font-bold uppercase tracking-wide text-red-100 flex items-center gap-1.5">
                  <Zap size={14} className="shrink-0" aria-hidden="true" />
                  Lớp học sắp diễn ra
                </p>
                <h2 className="cms-sd-card-title sm:text-lg md:text-xl font-extrabold uppercase tracking-tight leading-snug line-clamp-2 text-white">
                  {viewStudent.course}
                </h2>
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="cms-sd-body text-white/90 flex items-center gap-2 min-w-0">
                      <Calendar size={16} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {viewStudent.nextClass} | GV: {viewStudent.teacher}
                        {!isNew && teacherRatingData.count > 0 && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 bg-yellow-400 text-red-700 px-1.5 py-0.5 rounded-md text-[11px] font-extrabold">
                            <Star size={10} className="fill-red-700" aria-hidden="true" /> {teacherRatingData.avg}
                          </span>
                        )}
                      </span>
                    </p>
                    <span className="inline-flex items-center cms-sd-caption font-bold bg-white/20 px-2.5 py-1 rounded-full uppercase tracking-wide">
                      Sắp diễn ra
                    </span>
                  </div>
                  <a
                    href={viewStudent.joinClassUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className={`cms-sd-btn w-full md:w-auto ${
                      joinLive
                        ? 'bg-red-600 text-white animate-pulse hover:bg-red-700'
                        : 'bg-white text-red-600 hover:bg-red-50'
                    }`}
                  >
                    <Video size={20} aria-hidden="true" />
                    {joinLive ? '🔴 THAM GIA LỚP TRỰC TUYẾN' : 'VÀO LỚP NGAY'}
                  </a>
                </div>
              </div>
              <PlayCircle size={140} className="absolute -right-8 -bottom-8 text-white opacity-10 hidden md:block pointer-events-none" aria-hidden="true" />
            </section>

            <div className="cms-sd-stat-grid">
              <StatCard icon={BookOpen} label="Đã học" value={viewStudent.completedSessions} sub={`/ ${viewStudent.totalSessions}`} color="from-red-500 to-red-600" />
              <StatCard icon={Clock} label="Còn lại" value={viewStudent.remainingSessions} sub="buổi" color="from-[#1E3A8A] to-[#203DB5]" />
              <StatCard icon={Star} label="Điểm TB" value={viewStudent.avgGrade} sub="/ 10" color="from-orange-400 to-orange-500" />
              <StatCard icon={TrendingUp} label="Tiến độ" value={`${progressPct}%`} sub="hoàn thành" color="from-emerald-400 to-emerald-500" />
            </div>

            {/* To-do */}
            <section className="cms-sd-card relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 blur-2xl rounded-full pointer-events-none" aria-hidden="true" />
              <div className="flex items-center gap-2 mb-4 relative z-10">
                <Zap size={20} className="text-yellow-500 fill-yellow-500 shrink-0" aria-hidden="true" />
                <h3 className="cms-sd-section-title">Việc cần làm hôm nay</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                {[
                  {
                    onClick: () => navigate('/student/exam'),
                    tone: 'bg-red-50/80 border-red-100 text-red-600',
                    icon: Trophy,
                    title: 'Trắc nghiệm buổi học',
                    meta: 'Bài thi từ Giảng viên',
                    metaClass: 'text-red-600 font-bold',
                  },
                  {
                    onClick: () => navigate('/student#materials'),
                    tone: 'bg-orange-50/70 border-orange-100 text-orange-600',
                    icon: ClipboardList,
                    title: 'Bài tập về nhà',
                    meta: `${pendingHw} bài cần nộp`,
                    metaClass: 'text-orange-600 font-bold',
                  },
                  {
                    onClick: () => navigate('/student#schedule'),
                    tone: 'bg-blue-50/70 border-blue-100 text-blue-600',
                    icon: Calendar,
                    title: 'Lịch học sắp tới',
                    meta: `${upcomingScheduleCount} buổi sắp tới`,
                    metaClass: 'text-blue-600 font-bold',
                  },
                  {
                    onClick: () => setSupportOpen(true),
                    tone: 'bg-purple-50/70 border-purple-100 text-purple-600',
                    icon: MessageSquare,
                    title: 'Tin nhắn & Phản hồi',
                    meta: `${myUnreadMsgs} tin nhắn mới`,
                    metaClass: 'text-purple-600 font-bold',
                  },
                ].map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    onClick={item.onClick}
                    className={`${item.tone} border p-4 rounded-[16px] flex items-center gap-3 text-left min-h-[44px] transition-all duration-200 active:scale-[0.98]`}
                  >
                    <div className="w-10 h-10 bg-white rounded-[12px] flex items-center justify-center shadow-sm border border-white/80 shrink-0">
                      <item.icon size={20} aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm sm:text-[15px] font-bold text-slate-900 leading-snug">{item.title}</h4>
                      <p className={`text-xs font-bold mt-1 ${item.metaClass}`}>{item.meta}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="lg:col-span-4 cms-sd-stack min-w-0">
            {/* Tài liệu */}
            <section className="rounded-[16px] p-4 text-white shadow-[0_6px_20px_rgba(0,0,0,0.06)] bg-slate-700">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wide text-slate-300 flex items-center gap-2 mb-3">
                <Download size={16} aria-hidden="true" /> Tài liệu
              </h3>
              <div className="space-y-2">
                {docs.length === 0 ? (
                  <div className="cms-sd-empty !py-5 !gap-1.5">
                    <p className="text-xs text-slate-300 font-medium">Chưa có tài liệu.</p>
                  </div>
                ) : (
                  docs.map((m) => (
                    <div
                      key={m.id}
                      className="flex justify-between items-center bg-slate-600/45 p-3 rounded-[12px] hover:bg-slate-600 transition-colors duration-200 cursor-pointer min-h-[44px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`text-xs font-extrabold px-1.5 py-0.5 rounded shrink-0 ${
                            m.type === 'PDF' ? 'bg-red-500' : m.type === 'XLSX' ? 'bg-green-500' : 'bg-orange-500'
                          }`}
                        >
                          {m.type}
                        </span>
                        <span className="text-sm font-semibold text-white truncate">{m.name}</span>
                      </div>
                      <Download size={16} className="text-sky-300 shrink-0 ml-2" aria-hidden="true" />
                    </div>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={() => navigate('/student#materials')}
                className="cms-sd-btn w-full mt-3 bg-slate-600/50 text-sky-200 hover:bg-slate-600 hover:text-white"
              >
                Xem tất cả <ChevronRight size={16} aria-hidden="true" />
              </button>
            </section>

            {/* Nhật ký học tập — Nằm dưới phần Tài liệu ở cột bên phải */}
            <section className="cms-sd-card !p-0 overflow-hidden">
              <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2 min-w-0">
                <h3 className="cms-sd-section-title flex items-center gap-2 min-w-0">
                  <Clock size={18} className="text-blue-500 shrink-0" aria-hidden="true" />
                  Nhật ký học tập
                </h3>
                <span className="text-xs font-bold text-slate-500 shrink-0 tabular-nums">{studyLogs.length} sự kiện</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                {studyLogs.map((item, idx) => {
                  const isCancelled = item.type === 'cancelled';
                  const isScheduled = item.type === 'scheduled';
                  const isPastPending = item.type === 'past_pending';
                  const isHomework = item.type === 'homework';
                  const isQuiz = item.type === 'quiz';
                  const isAttendance = item.type === 'attendance';

                  return (
                    <div
                      key={idx}
                      className={`px-3.5 py-3 flex flex-col justify-between gap-1.5 ${
                        isCancelled ? 'bg-red-50/30' : isPastPending ? 'bg-slate-50/80' : isScheduled ? 'bg-blue-50/30' : isQuiz ? 'bg-amber-50/20' : 'hover:bg-slate-50'
                      } transition-colors duration-200`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5 ${
                            isCancelled
                              ? 'bg-red-100 text-red-600'
                              : isPastPending
                              ? 'bg-slate-200 text-slate-600'
                              : isScheduled
                              ? 'bg-blue-100 text-blue-600'
                              : isHomework
                              ? 'bg-purple-100 text-purple-600'
                              : isQuiz
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-emerald-100 text-emerald-600'
                          }`}
                        >
                          {isCancelled ? (
                            <XCircle size={15} aria-hidden="true" />
                          ) : isPastPending || isScheduled ? (
                            <Calendar size={15} aria-hidden="true" />
                          ) : isHomework ? (
                            <ClipboardList size={15} aria-hidden="true" />
                          ) : isQuiz ? (
                            <Award size={15} aria-hidden="true" />
                          ) : (
                            <CheckCircle size={15} aria-hidden="true" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className={`text-xs font-bold truncate ${isCancelled ? 'text-red-700' : isPastPending ? 'text-slate-700' : isScheduled ? 'text-blue-900' : 'text-slate-800'}`}>
                              {item.index ? `Buổi ${item.index} — ` : ''}{item.date}{item.time ? ` (${item.time})` : ''}
                            </p>
                            {isScheduled && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase tracking-wide shrink-0">
                                {item.displayKind === 'ongoing' ? 'ĐANG DIỄN RA' : 'SẮP TỚI'}
                              </span>
                            )}
                            {isPastPending && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 uppercase tracking-wide shrink-0">
                                ĐÃ QUA
                              </span>
                            )}
                            {isCancelled && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-red-100 text-red-700 uppercase tracking-wide shrink-0">
                                HỦY
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{item.note}</p>
                        </div>
                      </div>

                      {!isCancelled && item.grade != null && (
                        <div className="flex items-center justify-end gap-1.5 shrink-0 pl-10">
                          <span className={`text-xs font-extrabold tabular-nums ${getGradeTextClasses(item.grade)}`}>
                            {item.grade} / 10
                          </span>
                          <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                            isQuiz
                              ? (item.isPassed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200')
                              : getGradePillClasses(item.grade)
                          }`}>
                            {isQuiz ? (item.isPassed ? 'ĐẠT' : 'CHƯA ĐẠT') : (getGradeLabel(item.grade) || 'TB')}
                          </span>
                        </div>
                      )}
                      {!isCancelled && item.grade == null && isAttendance && (
                        <div className="flex items-center justify-end pl-10">
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase tracking-wide shrink-0">
                            Đã hoàn thành
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {studyLogs.length === 0 && (
                  <div className="cms-sd-empty !py-6">
                    <div className="cms-sd-empty__icon">
                      <Clock size={20} aria-hidden="true" />
                    </div>
                    <p className="text-xs font-bold text-slate-600">Chưa có sự kiện nào.</p>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
