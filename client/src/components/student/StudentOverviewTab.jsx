import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlayCircle, Clock, CheckCircle, MessageSquare, Download,
  BookOpen, Star, TrendingUp, Zap, Calendar, Video,
  ClipboardList, ChevronRight, XCircle,
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
                    onClick: () => navigate('/student#materials'),
                    tone: 'bg-orange-50/70 border-orange-100 text-orange-600',
                    icon: ClipboardList,
                    title: 'Bài tập về nhà',
                    meta: `${pendingHw} bài cần nộp`,
                    metaClass: 'text-orange-600',
                  },
                  {
                    onClick: () => navigate('/student#schedule'),
                    tone: 'bg-blue-50/70 border-blue-100 text-blue-600',
                    icon: Calendar,
                    title: 'Lịch học sắp tới',
                    meta: `${upcomingScheduleCount} buổi sắp tới`,
                    metaClass: 'text-blue-600',
                  },
                  {
                    onClick: () => setSupportOpen(true),
                    tone: 'bg-purple-50/70 border-purple-100 text-purple-600',
                    icon: MessageSquare,
                    title: 'Tin nhắn & Phản hồi',
                    meta: `${myUnreadMsgs} tin nhắn mới`,
                    metaClass: 'text-purple-600',
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
                      <h4 className="cms-sd-card-title !text-[15px] leading-snug">{item.title}</h4>
                      <p className={`cms-sd-caption font-semibold mt-1 ${item.metaClass}`}>{item.meta}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Study log */}
            <section className="cms-sd-card !p-0 overflow-hidden">
              <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between gap-2 min-w-0">
                <h3 className="cms-sd-section-title flex items-center gap-2 min-w-0">
                  <Clock size={20} className="text-blue-500 shrink-0" aria-hidden="true" />
                  Nhật ký học tập
                </h3>
                <span className="cms-sd-caption shrink-0 tabular-nums">{studyLogs.length} sự kiện</span>
              </div>
              <div className="divide-y divide-slate-50">
                {studyLogs.map((item, idx) => {
                  const isCancelled = item.type === 'cancelled';
                  return (
                    <div
                      key={idx}
                      className={`px-4 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-4 ${
                        isCancelled ? 'bg-red-50/30' : 'hover:bg-slate-50'
                      } transition-colors duration-200`}
                    >
                      <div className="flex items-start md:items-center gap-3 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${
                            isCancelled ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'
                          }`}
                        >
                          {isCancelled ? <XCircle size={18} aria-hidden="true" /> : <CheckCircle size={18} aria-hidden="true" />}
                        </div>
                        <div className="min-w-0">
                          <p className={`cms-sd-body font-bold truncate ${isCancelled ? 'text-red-700' : 'text-slate-800'}`}>
                            {item.index ? `Buổi ${item.index} — ` : ''}{item.date}{item.time ? ` (${item.time})` : ''}
                          </p>
                          <p className="cms-sd-caption italic truncate mt-1">{item.note}</p>
                        </div>
                      </div>
                      {!isCancelled && item.grade != null && (
                        <div className="flex items-center gap-2 md:text-right shrink-0 ml-13 md:ml-0 pl-[52px] md:pl-0">
                          <span className={`text-[15px] font-extrabold tabular-nums ${getGradeTextClasses(item.grade)}`}>
                            {item.grade}
                          </span>
                          <span className="cms-sd-caption">/ 10</span>
                          <span className={`cms-sd-caption font-bold px-2 py-0.5 rounded-full ${getGradePillClasses(item.grade)}`}>
                            {getGradeLabel(item.grade) || 'TB'}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {studyLogs.length === 0 && (
                  <div className="cms-sd-empty">
                    <div className="cms-sd-empty__icon">
                      <Clock size={22} aria-hidden="true" />
                    </div>
                    <p className="cms-sd-body font-semibold text-slate-600">Chưa có sự kiện nào được ghi nhận.</p>
                    <p className="cms-sd-caption max-w-[18rem]">
                      Dữ liệu sẽ xuất hiện sau khi bắt đầu học.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/student#schedule')}
                      className="cms-sd-btn mt-2 bg-slate-900 text-white hover:bg-slate-800"
                    >
                      Xem lịch học
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="lg:col-span-4 cms-sd-stack min-w-0">
            <section className="rounded-[16px] p-4 text-white shadow-[0_6px_20px_rgba(0,0,0,0.06)] bg-slate-700">
              <h3 className="cms-sd-caption font-bold uppercase tracking-wide text-slate-300 flex items-center gap-2 mb-3">
                <Download size={16} aria-hidden="true" /> Tài liệu
              </h3>
              <div className="space-y-2">
                {docs.length === 0 ? (
                  <div className="cms-sd-empty !py-5 !gap-1.5">
                    <p className="cms-sd-caption text-slate-300">Chưa có tài liệu.</p>
                  </div>
                ) : (
                  docs.map((m) => (
                    <div
                      key={m.id}
                      className="flex justify-between items-center bg-slate-600/45 p-3 rounded-[12px] hover:bg-slate-600 transition-colors duration-200 cursor-pointer min-h-[44px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`cms-sd-caption font-extrabold px-1.5 py-0.5 rounded shrink-0 ${
                            m.type === 'PDF' ? 'bg-red-500' : m.type === 'XLSX' ? 'bg-green-500' : 'bg-orange-500'
                          }`}
                        >
                          {m.type}
                        </span>
                        <span className="cms-sd-body text-white truncate">{m.name}</span>
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

            <div className="hidden lg:flex flex-col gap-4">
              <button
                type="button"
                onClick={() => {
                  if (studentData.teacherId) {
                    openSiteChat({
                      id: String(studentData.teacherId),
                      name: studentData.teacherName || 'Giảng viên',
                      role: 'teacher',
                    });
                  } else {
                    setSupportOpen(true);
                  }
                }}
                className="cms-sd-btn w-full bg-white border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-600"
              >
                <MessageSquare size={18} aria-hidden="true" /> Nhắn tin Giảng viên
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
