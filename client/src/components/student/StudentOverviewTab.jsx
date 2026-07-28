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
  return (
    <>
            {/* Greeting */}
            <div className="px-1 sm:px-4 md:px-8 pt-3 sm:pt-5 pb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between min-w-0">
              <div className="min-w-0">
                <h2 className="text-lg md:text-xl font-black text-slate-800 truncate">Chào mừng, {studentData.name}! 👋</h2>
                <p className="text-slate-400 text-xs md:text-sm italic">"Học hôm nay, thành công mai sau."</p>
              </div>
              <div className="text-left sm:text-right shrink-0">
                <p className="text-xs font-bold text-red-600 uppercase tracking-widest">Trung Tâm Thắng Tin Học</p>
              </div>
            </div>

            <div className="w-full max-w-7xl mx-auto px-1 sm:px-4 md:px-8 lg:px-12 py-3 sm:py-4 md:py-6">
              <CourseSwitcher
                courses={enrollments}
                activeCourseName={activeCourseName || viewStudent.course}
                onChange={setActiveCourseName}
              />
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* ═══ CỘT CHÍNH ═══ */}
                <div className="lg:col-span-8 space-y-6">

                  {/* Banner */}
                  <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl md:rounded-3xl p-6 md:p-10 text-white shadow-xl relative overflow-hidden">
                    <div className="relative z-10">
                      <p className="text-red-200 text-xs md:text-xs font-bold uppercase mb-2 tracking-widest flex items-center gap-1">
                        <Zap size={12} /> Lớp học sắp diễn ra
                      </p>
                      <h2 className="text-xl md:text-3xl font-black mb-2 md:mb-4 uppercase tracking-tight">{viewStudent.course}</h2>
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1">
                          <p className="text-sm opacity-90 mb-2 md:mb-4 flex items-center gap-2">
                            <Calendar size={14} className="flex-shrink-0" />
                            <span className="truncate">
                              {viewStudent.nextClass} | GV: {viewStudent.teacher}
                              {!isNew && teacherRatingData.count > 0 && (
                                <span className="ml-2 inline-flex items-center gap-0.5 bg-yellow-400 text-red-700 px-1.5 py-0.5 rounded-lg text-xs cms-min-text-xs font-black shadow-sm">
                                  <Star size={10} className="fill-red-700" /> {teacherRatingData.avg}
                                </span>
                              )}
                            </span>
                          </p>
                          <p className="text-xs font-bold bg-white/20 inline-block px-3 py-1 rounded-full uppercase">Sắp diễn ra</p>
                        </div>
                        <a href={viewStudent.joinClassUrl || '#'} target="_blank" rel="noreferrer"
                          className={`w-full md:w-auto ${viewStudent.joinClassUrl && viewStudent.isLikelyLiveClass ? 'bg-indigo-600 text-white animate-pulse shadow-indigo-500/50 hover:bg-indigo-700' : 'bg-white text-red-600'} px-8 py-4 rounded-xl md:rounded-2xl font-black text-center shadow-lg active:scale-95 transition transform hover:scale-105 flex items-center justify-center gap-3`}>
                          <Video size={22} /> {viewStudent.joinClassUrl && viewStudent.isLikelyLiveClass ? '🔴 THAM GIA LỚP TRỰC TUYẾN' : 'VÀO LỚP NGAY'}
                        </a>
                      </div>
                    </div>
                    <PlayCircle size={200} className="absolute -right-10 -bottom-10 text-white opacity-10 hidden md:block" />
                  </div>

                  {/* Stats */}
                  <div className="cms-stat-grid gap-3">
                    <StatCard icon={BookOpen} label="Đã học" value={viewStudent.completedSessions} sub={`/ ${viewStudent.totalSessions}`} color="from-blue-500 to-blue-600" />
                    <StatCard icon={Clock} label="Còn lại" value={viewStudent.remainingSessions} sub="buổi" color="from-[#1E3A8A] to-[#203DB5]" />
                    <StatCard icon={Star} label="Điểm TB" value={viewStudent.avgGrade} sub="/ 10" color="from-orange-400 to-orange-500" />
                    <StatCard icon={TrendingUp} label="Tiến độ" value={`${progressPct}%`} sub="hoàn thành" color="from-emerald-400 to-emerald-500" />
                  </div>

                  {/* QUICK ACTIONS / Việc cần làm */}
                  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 cursor-pointer mb-6 relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />
                     <div className="flex items-center gap-2 mb-5 relative z-10">
                        <Zap size={20} className="text-yellow-500 fill-yellow-500" />
                        <h3 className="font-extrabold text-slate-800 uppercase tracking-tight">Việc cần làm hôm nay</h3>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
                         <div className="bg-orange-50/50 hover:bg-orange-50 border border-orange-100 p-4 rounded-2xl flex flex-col gap-3 transition-colors group/card" onClick={() => navigate('/student#materials')}>
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-orange-600 shadow-sm border border-orange-100/50 group-hover/card:scale-110 transition-transform">
                              <ClipboardList size={20} />
                            </div>
                            <div>
                               <h4 className="font-bold text-slate-800 text-sm">Bài tập về nhà</h4>
                               <p className="text-orange-600 text-xs font-semibold mt-1">
                                 {myAssignments ? myAssignments.filter(a => !a.mySubmission).length : 0} bài cần nộp
                               </p>
                            </div>
                         </div>
                         
                         <div className="bg-blue-50/50 hover:bg-blue-50 border border-blue-100 p-4 rounded-2xl flex flex-col gap-3 transition-colors group/card" onClick={() => navigate('/student#schedule')}>
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-blue-100/50 group-hover/card:scale-110 transition-transform">
                              <Calendar size={20} />
                            </div>
                            <div>
                               <h4 className="font-bold text-slate-800 text-sm">Lịch học sắp tới</h4>
                               <p className="text-blue-600 text-xs font-semibold mt-1">
                                 {upcomingScheduleCount} buổi sắp tới
                               </p>
                            </div>
                         </div>

                         <div className="bg-purple-50/50 hover:bg-purple-50 border border-purple-100 p-4 rounded-2xl flex flex-col gap-3 transition-colors group/card" onClick={() => navigate('/student/inbox')}>
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-purple-600 shadow-sm border border-purple-100/50 group-hover/card:scale-110 transition-transform">
                              <MessageSquare size={20} />
                            </div>
                            <div>
                               <h4 className="font-bold text-slate-800 text-sm">Tin nhắn & Phản hồi</h4>
                               <p className="text-purple-600 text-xs font-semibold mt-1">{myUnreadMsgs} tin nhắn mới</p>
                            </div>
                         </div>
                     </div>
                  </div>

                  {/* Nhật ký */}
                  <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 min-w-0">
                      <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm md:text-base min-w-0">
                        <Clock size={16} className="text-blue-500 shrink-0" /> NHẬT KÝ HỌC TẬP
                      </h3>
                      <span className="text-xs md:text-xs text-gray-400 shrink-0">{studyLogs.length} sự kiện</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {studyLogs.map((item, idx) => {
                        const isCancelled = item.type === 'cancelled';
                        return (
                        <div key={idx} className={`px-4 md:px-6 py-3 md:py-4 flex flex-col md:flex-row md:items-center justify-between ${isCancelled ? 'bg-red-50/30' : 'hover:bg-gray-50'} transition-colors gap-2 md:gap-4`}>
                          <div className="flex items-start md:items-center gap-3">
                            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 md:mt-0 ${isCancelled ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                              {isCancelled ? <XCircle size={16} /> : <CheckCircle size={16} />}
                            </div>
                            <div className="min-w-0">
                              <p className={`font-bold text-sm truncate ${isCancelled ? 'text-red-700' : 'text-slate-800'}`}>
                                {item.index ? `Buổi ${item.index} — ` : ''}{item.date} {item.time ? `(${item.time})` : ''}
                              </p>
                              <p className="text-xs md:text-xs text-slate-400 italic truncate">{item.note}</p>
                            </div>
                          </div>
                          {!isCancelled && item.grade != null && (
                            <div className="flex items-center gap-2 md:text-right flex-shrink-0 ml-12 md:ml-0">
                              <span className={`text-lg font-black ${getGradeTextClasses(item.grade)}`}>
                                {item.grade}
                              </span>
                              <span className="text-xs text-gray-400">/ 10</span>
                              <span className={`text-xs cms-min-text-xs md:text-xs font-bold px-2 py-0.5 rounded-full ml-1 ${getGradePillClasses(item.grade)}`}>
                                {getGradeLabel(item.grade) || 'TB'}
                              </span>
                            </div>
                          )}
                        </div>
                      )})}
                      {studyLogs.length === 0 && (
                        <div className="px-6 py-12 text-center text-gray-400 text-sm">Chưa có sự kiện nào được ghi nhận.</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ═══ CỘT PHỤ ═══ */}
                <div className="lg:col-span-4 space-y-6">

                  {/* Tiến độ */}
                  <div className="grid grid-cols-2 lg:grid-cols-1 gap-4">
                    <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-3">Tiến độ</p>
                      <div className="relative w-20 h-20 md:w-28 md:h-28 mx-auto">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                          <circle cx="50" cy="50" r="42" fill="none" stroke="url(#grad)" strokeWidth="8"
                            strokeLinecap="round" strokeDasharray={`${progressPct * 2.64} 264`} className="transition-all duration-1000" />
                          <defs>
                            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" style={{ stopColor: '#ef4444' }} />
                              <stop offset="100%" style={{ stopColor: '#f97316' }} />
                            </linearGradient>
                          </defs>
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div>
                            <p className="text-lg md:text-2xl font-black text-gray-800">{progressPct}%</p>
                            <p className="text-[8px] md:text-xs text-gray-400">hoàn thành</p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 md:mt-4 flex justify-between text-xs md:text-xs text-gray-500">
                        <span>Đã: <strong className="text-gray-800">{studentData.completedSessions}</strong></span>
                        <span>Còn: <strong className="text-gray-800">{studentData.remainingSessions}</strong></span>
                      </div>
                    </div>

                    <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 text-center flex flex-col justify-center">
                      <p className="text-xs font-bold text-gray-400 uppercase mb-1">Điểm TB</p>
                      <p className="text-4xl md:text-5xl font-black text-blue-600">{studentData.avgGrade}</p>
                      <p className="text-xs text-gray-400 mt-1">/ 10 điểm</p>
                      <div className={`mt-2 text-xs font-bold px-2 py-0.5 rounded-full mx-auto ${
                        studentData.avgGrade >= 8 ? 'bg-green-100 text-green-700' : studentData.avgGrade >= 6 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {studentData.avgGrade >= 8 ? 'GIỎI' : studentData.avgGrade >= 6 ? 'KHÁ' : 'TRUNG BÌNH'}
                      </div>
                    </div>
                  </div>



                  {/* Tài liệu nhanh */}
                  <div className="bg-slate-800 p-5 md:p-6 rounded-2xl text-white">
                    <h3 className="font-bold text-xs md:text-sm mb-3 md:mb-4 uppercase text-slate-400 flex items-center gap-2">
                      <Download size={14} /> Tài liệu
                    </h3>
                    <div className="space-y-2">
                      {materials.filter(m => m.category === 'document').slice(0, 3).map(m => (
                        <div key={m.id} className="flex justify-between items-center bg-slate-700/50 p-3 rounded-xl hover:bg-slate-700 transition cursor-pointer">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-[8px] md:text-xs cms-min-text-xs font-black px-1.5 py-0.5 rounded flex-shrink-0 ${
                              m.type === 'PDF' ? 'bg-red-500' : m.type === 'XLSX' ? 'bg-green-500' : 'bg-orange-500'
                            }`}>{m.type}</span>
                            <span className="text-xs md:text-xs truncate">{m.name}</span>
                          </div>
                          <Download size={14} className="text-blue-400 flex-shrink-0 ml-2" />
                        </div>
                      ))}
                    </div>
                    <button onClick={() => navigate('/student#materials')}
                      className="w-full mt-3 text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center justify-center gap-1 py-2 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition">
                      Xem tất cả <ChevronRight size={12} />
                    </button>
                  </div>

                  {/* Contact */}
                  <div className="hidden lg:block space-y-3">
                    <button 
                      onClick={() => navigate('/student/inbox', { state: { selectUserId: studentData.teacherId } })}
                      className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 p-4 rounded-2xl font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition group shadow-sm">
                      <MessageSquare className="group-hover:animate-bounce" size={18} /> Nhắn tin Giảng viên
                    </button>
                    <a href="tel:0935758462"
                      className="w-full flex items-center justify-center gap-3 bg-red-50 border-2 border-red-100 p-4 rounded-2xl font-bold text-red-600 hover:bg-red-100 transition shadow-sm text-sm">
                      <Phone size={16} /> Gọi Hotline hỗ trợ
                    </a>
                  </div>
                </div>
              </div>
            </div>
    </>
  );
}
