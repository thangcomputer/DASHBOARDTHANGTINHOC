import React, { useMemo, useState, useEffect } from 'react';
import {
  Calendar, ChevronRight, BookOpen, Award, Star, Zap, UserCheck, Clipboard,
  MessageSquare, GraduationCap, Users, Activity, Video, AlertTriangle, Bell,
  CheckCircle2, ArrowRight, History
} from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';
import api, { blogAPI, resolveMediaUrl } from '../../services/api';
import TeacherRatingDisplay from './TeacherRatingDisplay';
import { isScheduleOngoingNow } from '../../utils/scheduleTime';

export default function TeacherOverviewTab({
  navigate, totalMonthlyIncome, completed, totalDone, teacherName, currentTeacher,
  teacherRating, students, totalSess, avgGrade, mySchedules = [], myNotifs, RATING_CRITERIA,
}) {
  const [activityTab, setActivityTab] = useState('recent'); // 'recent' | 'announcements'
  const [centerAnnouncements, setCenterAnnouncements] = useState([
    {
      id: 1,
      title: 'Quy trình Điểm danh & Nhập điểm số tự động ghi nhận nhật ký học viên',
      date: '01/08/2026',
      tag: 'Quy định trung tâm',
    },
    {
      id: 2,
      title: 'Cập nhật tính năng Đổi lịch dạy & Ghi chú trao đổi 2 chiều',
      date: '28/07/2026',
      tag: 'Hệ thống LMS',
    }
  ]);
  const [banners, setBanners] = useState([]);
  const [bannerSpeed, setBannerSpeed] = useState(5);

  useEffect(() => {
    let unmounted = false;
    if (blogAPI?.list) {
      blogAPI.list({ limit: 6, target: 'teacher' })
        .then(res => {
          if (!unmounted && res?.success && Array.isArray(res.data) && res.data.length > 0) {
            setCenterAnnouncements(res.data.map(p => ({
              id: p.id || p._id,
              title: p.title,
              date: p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('vi-VN') : '',
              tag: p.targetAudience === 'teacher' ? 'Dành cho Giảng viên' : 'Thông báo chung',
              slug: p.slug,
            })));
          }
        })
        .catch(() => {});
    }
    return () => { unmounted = true; };
  }, []);

  // Fetch Banners
  useEffect(() => {
    let unmounted = false;
    api.settings.getWeb()
      .then((res) => {
        if (res?.success && !unmounted) {
          setBanners(res.data.teacherBanners || []);
          setBannerSpeed(res.data.teacherBannerSpeed || 5);
        }
      })
      .catch(() => {});
    return () => { unmounted = true; };
  }, []);

  const [bannerIdx, setBannerIdx] = useState(0);
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      setBannerIdx((prev) => (prev + 1) % banners.length);
    }, bannerSpeed * 1000);
    return () => clearInterval(t);
  }, [banners, bannerSpeed]);

  const initials = (teacherName || 'GV').substring(0, 2).toUpperCase();
  const avatarTone = currentTeacher?.color || 'bg-indigo-600';

  // Check if there is a live schedule right now
  const ongoingSchedule = useMemo(() => {
    return (mySchedules || []).find(s => s.status === 'scheduled' && isScheduleOngoingNow(s));
  }, [mySchedules]);

  // Filter students needing attention (grade < 5 or missing grade)
  const attentionStudents = useMemo(() => {
    return (students || []).filter(s => !s.lastGrade || s.lastGrade < 5);
  }, [students]);

  // Generate real dynamic activity logs from teacher's actions
  const teacherActivities = useMemo(() => {
    const list = [];

    // 1. From completed schedules
    (mySchedules || []).filter(s => s.status === 'completed').forEach(s => {
      const d = new Date(s.date);
      const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
      list.push({
        id: 'comp-' + (s._id || s.id),
        type: 'attendance',
        title: `Đã hoàn thành ca dạy ${s.startTime}${s.endTime ? ' - ' + s.endTime : ''}`,
        desc: `Học viên: ${s.studentName || 'Học viên'} • Khóa: ${s.course}`,
        date: dateStr,
        timestamp: new Date(s.date).getTime(),
        badge: 'Đã điểm danh',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      });
    });

    // 2. From upcoming/created schedules
    (mySchedules || []).filter(s => s.status === 'scheduled').forEach(s => {
      const d = new Date(s.date);
      const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
      list.push({
        id: 'sched-' + (s._id || s.id),
        type: 'schedule',
        title: `Lên lịch ca dạy ngày ${dateStr}`,
        desc: `Ca ${s.startTime} • Học viên: ${s.studentName || s.course}`,
        date: dateStr,
        timestamp: new Date(s.date).getTime(),
        badge: 'Lịch dạy mới',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
      });
    });

    // 3. From students with grades
    (students || []).filter(s => s.lastGrade > 0).forEach(s => {
      list.push({
        id: 'grade-' + s.id + '-' + (s.courseId || s.course || ''),
        type: 'grade',
        title: `Ghi nhận điểm số ${s.lastGrade}/10 cho học viên ${s.name}`,
        desc: `Khóa học: ${s.course}`,
        date: 'Gần đây',
        timestamp: Date.now() - 3600000,
        badge: 'Điểm số',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200'
      });
    });

    // Sort by timestamp descending
    return list.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [mySchedules, students]);

  return (
    <div className="py-3 sm:py-5 md:py-6 space-y-4 sm:space-y-5 md:space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700 w-full min-w-0 max-w-full overflow-x-hidden pb-4">
      
      {/* ── HEADER & BANNER ── */}
      <header className="flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between mb-1 min-w-0">
        <div className="min-w-0 w-full lg:max-w-[36%] lg:shrink-0">
          <h2 className="text-lg sm:text-xl md:text-2xl font-black text-slate-800 break-words">
            Chào mừng, {teacherName || 'Giảng viên'}! 👋
          </h2>
          <p className="text-sm font-medium italic mt-1.5 mb-1 text-gray-500">
            &quot;Nỗ lực hôm nay, thành công mai sau.&quot;
          </p>
          <p className="text-xs font-bold text-sky-600 uppercase tracking-wide">
            Trung tâm Thắng Tin Học
          </p>
        </div>
        
        {banners.length > 0 && (
          <div 
            className="relative w-full lg:flex-1 lg:max-w-[800px] h-28 sm:h-32 md:aspect-[5/1] md:h-auto bg-gray-50 rounded-xl overflow-hidden shrink-0 shadow-sm border border-gray-200 cursor-pointer group"
            onClick={() => banners[bannerIdx]?.linkUrl && window.open(banners[bannerIdx].linkUrl, '_blank')}
          >
            {banners.map((b, i) => (
              <img 
                key={i}
                src={resolveMediaUrl(b.imageUrl)} 
                alt="Banner" 
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${i === bannerIdx ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
              />
            ))}
            {banners.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-10">
                {banners.map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === bannerIdx ? 'bg-white shadow-sm' : 'bg-white/40'}`} />
                ))}
              </div>
            )}
          </div>
        )}
      </header>

      {/* ── LIVE ONGOING SCHEDULE BANNER (Hiển thị nổi bật khi có lớp đang diễn ra) ── */}
      {ongoingSchedule && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-indigo-700 text-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xl shadow-red-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 border border-red-400/30 animate-pulse">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Video size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-black uppercase tracking-wider text-red-100">CA DẠY ĐANG DIỄN RA</span>
              </div>
              <h4 className="text-sm sm:text-base font-black text-white truncate mt-0.5">
                👤 {ongoingSchedule.studentName || 'Học viên'} &bull; <span className="text-yellow-300">{ongoingSchedule.course}</span>
              </h4>
              <p className="text-xs text-red-100 font-medium">
                Thời gian: {ongoingSchedule.startTime} - {ongoingSchedule.endTime}
              </p>
            </div>
          </div>

          {ongoingSchedule.linkHoc && (
            <a
              href={ongoingSchedule.linkHoc}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-5 py-2.5 bg-white text-red-600 hover:bg-red-50 rounded-xl text-xs sm:text-sm font-black shadow-lg transition active:scale-95 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <Video size={16} /> VÀO LỚP NGAY
            </a>
          )}
        </div>
      )}

      {/* ── Income + Profile ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-5 min-w-0">
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 text-white relative overflow-hidden shadow-lg shadow-slate-900/15 min-w-0">
          <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 h-full min-w-0">
            <div className="space-y-3 sm:space-y-4 min-w-0 flex-1">
              <div className="min-w-0">
                <p className="text-slate-300 text-xs sm:text-sm font-bold uppercase tracking-wider mb-1">
                  Thu nhập tháng {new Date().getMonth() + 1}
                </p>
                <h3 className="text-xl sm:text-3xl md:text-4xl font-black tabular-nums tracking-tight break-words">
                  {totalMonthlyIncome.toLocaleString('vi-VN')}{' '}
                  <span className="text-base sm:text-xl font-bold">đ</span>
                </h3>
              </div>
              <div className="flex items-stretch gap-3 sm:gap-6 min-w-0">
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-slate-300 text-[10px] sm:text-sm font-bold uppercase tracking-wide">Học viên hoàn thành</span>
                  <span className="text-lg sm:text-2xl font-black text-emerald-400 tabular-nums mt-0.5">
                    {completed} <span className="text-xs text-slate-300 font-bold">người</span>
                  </span>
                </div>
                <div className="w-px self-stretch bg-white/10 shrink-0" aria-hidden="true" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-slate-300 text-[10px] sm:text-sm font-bold uppercase tracking-wide">Buổi dạy đã xong</span>
                  <span className="text-lg sm:text-2xl font-black text-sky-400 tabular-nums mt-0.5">
                    {totalDone} <span className="text-xs text-slate-300 font-bold">buổi</span>
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/teacher/finance')}
              className="w-full sm:w-auto shrink-0 bg-white/10 hover:bg-white/15 border border-white/10 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 group min-h-11 cursor-pointer"
            >
              Chi tiết thu nhập
              <ChevronRight size={15} className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-1 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center relative overflow-hidden min-w-0">
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

      {/* ── Stats Summary Cards ── */}
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
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            {
              icon: UserCheck,
              label: 'Điểm danh',
              sub: `${mySchedules.filter((s) => s.status === 'scheduled' && new Date(s.date).toDateString() === new Date().toDateString()).length} buổi hôm nay`,
              tint: 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-400/20',
              action: () => {
                const todaySchedules = mySchedules.filter((s) => s.status === 'scheduled' && new Date(s.date).toDateString() === new Date().toDateString());
                if (todaySchedules.length > 0) {
                  // Chọn lịch cũ nhất trong ngày (nếu có 2 cái)
                  const oldest = todaySchedules.sort((a, b) => {
                    const timeA = a.startTime ? a.startTime.replace(':', '') : '0000';
                    const timeB = b.startTime ? b.startTime.replace(':', '') : '0000';
                    return Number(timeA) - Number(timeB);
                  })[0];
                  const stId = oldest.studentId?._id || oldest.studentId?.id || oldest.studentId;
                  if (stId) {
                    navigate(`/teacher#students?studentId=${stId}&course=${encodeURIComponent(oldest.course || oldest.courseName || '')}`);
                    return;
                  }
                }
                navigate('/teacher#students');
              },
            },
            {
              icon: Clipboard,
              label: 'Chấm điểm',
              sub: `${students.filter((s) => !s.lastGrade || s.lastGrade === 0).length} HV chưa có điểm`,
              tint: 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-400/20',
              action: () => navigate('/teacher#assignments'),
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
              className={`${tint} border rounded-xl p-3 sm:p-4 text-left transition-all active:scale-[0.98] min-h-[4.25rem] cursor-pointer min-w-0`}
            >
              <div className="flex items-center gap-2 mb-1 min-w-0">
                <Icon size={16} className="text-white/90 shrink-0" aria-hidden="true" />
                <p className="font-bold text-xs sm:text-sm text-white truncate">{label}</p>
              </div>
              <p className="text-[10px] sm:text-xs text-white/55 leading-snug break-words">{sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── 2-COLUMN BALANCED CONTENT GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
        
        {/* CỘT TRÁI (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-5 flex flex-col justify-between">
          
          {/* Card 1: Học viên được phân công */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2 min-w-0 pb-2 border-b border-slate-100">
              <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2 min-w-0">
                <GraduationCap size={18} className="text-indigo-600 shrink-0" aria-hidden="true" />
                <span className="truncate">Học viên được phân công ({students.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => navigate('/teacher#students')}
                className="text-[11px] font-bold text-indigo-600 hover:underline shrink-0 cursor-pointer"
              >
                Xem chi tiết →
              </button>
            </div>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {students.map((s) => {
                const done = s.totalSessions - s.remainingSessions;
                const pct = Math.round((done / s.totalSessions) * 100) || 0;
                const studentId = s._id || s.id;
                const enrollmentKey = s._enrollmentKey || studentId;
                const openStudent = () => {
                  const q = new URLSearchParams();
                  if (studentId) q.set('studentId', String(studentId));
                  if (enrollmentKey) q.set('enrollmentKey', String(enrollmentKey));
                  if (s.course) q.set('course', String(s.course));
                  navigate(`/teacher#students?${q.toString()}`);
                };
                return (
                  <button
                    type="button"
                    key={enrollmentKey}
                    onClick={openStudent}
                    className="w-full text-left bg-slate-50/80 rounded-xl p-3 border border-slate-100 flex items-center gap-3 hover:bg-indigo-50/60 hover:border-indigo-200 transition group cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-white shadow-sm border border-slate-200">
                      <img src={resolveAvatarUrl({ avatar: s.avatar, role: 'student', gender: s.gender })} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{s.name}</p>
                      <p className="text-[10px] sm:text-xs text-slate-400 truncate">{s.course}</p>
                      <div className="h-1.5 bg-slate-200/60 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs sm:text-sm font-black text-slate-800 tabular-nums">{pct}%</p>
                      <p className="text-[10px] text-slate-400 tabular-nums">{done}/{s.totalSessions} buổi</p>
                    </div>
                    <ChevronRight size={15} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition shrink-0" />
                  </button>
                );
              })}

              {students.length === 0 && (
                <div className="py-6 text-center text-slate-400 text-xs font-medium">Chưa được phân công học viên nào.</div>
              )}
            </div>
          </div>

          {/* Card 2: Bảng tin Hoạt động gần đây & Thông báo từ Trung tâm */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 p-4 sm:p-5 shadow-sm space-y-3 min-h-[220px] max-h-[320px] sm:h-[260px] sm:max-h-none shrink-0 flex flex-col min-w-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-100 pb-2 gap-2 shrink-0 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <History size={16} />
                </div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                  Nhật ký hoạt động &amp; Bảng tin
                </h4>
              </div>

              {/* Sub tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold w-full sm:w-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActivityTab('recent')}
                  className={`flex-1 sm:flex-none px-2 py-1.5 rounded-md transition cursor-pointer whitespace-nowrap ${activityTab === 'recent' ? 'bg-white text-indigo-600 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Hoạt động ({teacherActivities.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActivityTab('announcements')}
                  className={`flex-1 sm:flex-none px-2 py-1.5 rounded-md transition cursor-pointer whitespace-nowrap ${activityTab === 'announcements' ? 'bg-white text-indigo-600 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Thông báo ({centerAnnouncements.length})
                </button>
              </div>
            </div>

            {/* TAB 1: Real Dynamic Activity Logs */}
            {activityTab === 'recent' && (
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {teacherActivities.map((act) => (
                  <div
                    key={act.id}
                    onClick={() => {
                      if (act.type === 'grade') navigate('/teacher#students');
                      else navigate('/teacher#schedule');
                    }}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/50 transition flex items-center justify-between gap-2 cursor-pointer group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${act.badgeColor}`}>
                          {act.badge}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">{act.date}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{act.title}</p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{act.desc}</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition shrink-0" />
                  </div>
                ))}

                {teacherActivities.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs font-medium py-4">
                    Chưa có nhật ký hoạt động nào gần đây.
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Center Announcements */}
            {activityTab === 'announcements' && (
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {centerAnnouncements.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(item.slug ? `/teacher/news/${item.slug}` : '/teacher/news')}
                    className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-300 hover:bg-blue-50/50 transition flex items-center justify-between gap-2 cursor-pointer group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                          {item.tag}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">{item.date}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 leading-snug group-hover:text-blue-600 transition-colors">{item.title}</p>
                    </div>
                    <ChevronRight size={14} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 3: Cảnh báo & Lưu ý học viên */}
          {attentionStudents.length > 0 && (
            <div className="bg-amber-50/80 rounded-2xl border border-amber-200/80 p-3.5 sm:p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                <h4 className="text-xs sm:text-sm font-black">Học viên cần lưu ý điểm số ({attentionStudents.length})</h4>
              </div>
              <p className="text-[11px] text-amber-700 font-medium">
                Các học viên sau chưa có điểm bài nộp hoặc điểm trung bình cần được cải thiện:
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {attentionStudents.map((st) => (
                  <span key={`${st.id}_${st.courseId || st.course || ''}`} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-white border border-amber-200 text-amber-900 shadow-2xs">
                    👤 {st.name} ({st.course})
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* CỘT PHẢI (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-5 flex flex-col justify-between">
          {/* Đánh giá từ học viên */}
          <TeacherRatingDisplay rating={teacherRating} RATING_CRITERIA={RATING_CRITERIA} students={students} />

          {/* Lịch dạy sắp tới */}
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
              <h4 className="font-bold text-slate-700 text-xs sm:text-sm flex items-center gap-2 min-w-0">
                <Calendar size={14} className="text-indigo-500 shrink-0" aria-hidden="true" />
                <span className="truncate">Lịch dạy sắp tới trong tuần</span>
              </h4>
              <button
                type="button"
                onClick={() => navigate('/teacher#schedule')}
                className="text-[10px] sm:text-xs text-indigo-600 font-bold hover:underline shrink-0 cursor-pointer"
              >
                Xem tất cả →
              </button>
            </div>
            <div className="divide-y divide-slate-50 max-h-[220px] overflow-y-auto pr-1">
              {mySchedules.filter((s) => s.status === 'scheduled').slice(0, 4).length === 0 && (
                <p className="px-4 sm:px-5 py-4 text-xs text-slate-400 text-center">Chưa có lịch dạy sắp tới.</p>
              )}
              {mySchedules.filter((s) => s.status === 'scheduled').slice(0, 4).map((s) => (
                <div key={s._id || s.id} className="px-4 sm:px-5 py-2.5 flex items-center gap-3 hover:bg-indigo-50/30 transition">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 flex flex-col items-center justify-center text-indigo-600 flex-shrink-0">
                    <span className="text-xs font-black tabular-nums">{new Date(s.date).getDate()}</span>
                    <span className="text-[7px] font-bold opacity-60">T{new Date(s.date).getMonth() + 1}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-800 truncate">{s.studentName || s.course}</p>
                    <p className="text-[10px] text-slate-400 truncate">{s.startTime} · {s.course}</p>
                  </div>
                  <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-lg flex-shrink-0">
                    {s.startTime}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tóm tắt hoạt động */}
          <div className="bg-gradient-to-br from-slate-800 to-zinc-900 rounded-2xl sm:rounded-3xl p-4 sm:p-5 text-white shadow-sm">
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
