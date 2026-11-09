import React, { useState, useEffect } from 'react';
import {
  CheckCircle, User, Settings, BookOpen,
  Mail, Phone, MapPin, ChevronRight, ChevronDown,
  GraduationCap, KeyRound, Target, Camera, Bell, LogOut,
  CalendarClock, Crown, History, Zap, Wallet, Receipt, Shield,
  Award,
} from 'lucide-react';
import EditableAvatar from '../EditableAvatar';
import { openPinLockSettings } from '../../utils/pinLock';
import { openLearningGoal } from '../../utils/learningGoal';
import api from '../../services/api';
import lessonPracticeApi from '../../services/lessonPracticeApi';
import { readOwnedVideoCourseCache } from '../../utils/lmsDeepLink';
import { isFreePortalCourseName } from '../../utils/enrollments';
import { useStudentSubscription } from './subscription/subscriptionContext';
import { formatExpiryDate, formatVnd } from '../../utils/subscription';
import { useData } from '../../context/DataContext';
import { useToast } from '../../utils/useToast';

function openChangePassword() {
  window.dispatchEvent(new CustomEvent('open-change-password-modal'));
}

function normalizeVideoOrders(rows) {
  const byCourse = new Map();
  for (const o of rows || []) {
    const cid = String(o.courseId || '');
    if (!cid) continue;
    const prev = byCourse.get(cid);
    if (!prev) {
      byCourse.set(cid, o);
      continue;
    }
    if (o.status === 'paid') byCourse.set(cid, o);
    else if (prev.status !== 'paid') byCourse.set(cid, o);
  }
  return [...byCourse.values()].sort(
    (a, b) => new Date(b.paidAt || b.createdAt || 0) - new Date(a.paidAt || a.createdAt || 0),
  );
}

function normalizeCourseName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function formatDateDisplay(d) {
  if (!d) return '';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('vi-VN');
  } catch {
    return String(d);
  }
}

export default function StudentProfileTab({
  studentData,
  progressPct = 0,
  setShowUpdateProfileModal,
  setShowTuitionModal,
  sessionGender = '',
}) {
  const toast = useToast();
  const { onLogout } = useData();
  const subCtx = useStudentSubscription();
  const subscription = subCtx?.subscription;
  const isLifetime = subscription?.state === 'lifetime';
  const freePortalAccount = (() => {
    try { return JSON.parse(localStorage.getItem('student_user') || '{}')?.freePortal === true; } catch { return false; }
  })();
  const freeTier = subscription?.freeTier === true || (freePortalAccount && isLifetime && !subscription?.meetLifetime);
  const history = subCtx?.overview?.history || [];

  const [openSections, setOpenSections] = useState({
    personalInfo: true,
    summary: true,
    courses: true,
    subscription: true,
    history: false,
    videoOrders: false,
  });
  const [videoOrders, setVideoOrders] = useState([]);
  const [lessonProgress, setLessonProgress] = useState({ loading: true, error: '', byId: new Map(), byName: new Map() });
  const studentId = String(
    studentData?.id || studentData?._id || (() => {
      try { return JSON.parse(localStorage.getItem('student_user') || '{}').id; } catch { return ''; }
    })(),
  );
  const [ownedCourseIds, setOwnedCourseIds] = useState(() => readOwnedVideoCourseCache(studentId));

  const syncOwnedFromServer = async (orders) => {
    const owned = readOwnedVideoCourseCache(studentId);
    const pending = (orders || []).filter((o) => o.status !== 'paid');
    await Promise.all(pending.map(async (o) => {
      const cid = String(o.courseId || '');
      if (!cid || owned.has(cid)) return;
      try {
        const res = await api.trainingLms.getLessons(cid);
        if (res?.meta?.owned) owned.add(cid);
      } catch { /* ignore */ }
    }));
    setOwnedCourseIds(new Set(owned));
    return owned;
  };

  const isOrderPaid = (order, ownedSet = ownedCourseIds) => {
    const cid = String(order?.courseId || '');
    return order?.status === 'paid' || (cid && ownedSet.has(cid));
  };

  useEffect(() => {
    setOwnedCourseIds(readOwnedVideoCourseCache(studentId));
  }, [studentId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.trainingLms.listVideoPurchases();
        if (cancelled || !res?.success) return;
        const rows = normalizeVideoOrders(res.data);
        await syncOwnedFromServer(rows);
        if (!cancelled) setVideoOrders(rows);
      } catch { /* ignore */ }
    };
    const onRefresh = () => {
      setOwnedCourseIds(readOwnedVideoCourseCache(studentId));
      load();
    };
    load();
    window.addEventListener('focus', onRefresh);
    window.addEventListener('lms-video-owned-updated', onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onRefresh);
      window.removeEventListener('lms-video-owned-updated', onRefresh);
    };
  }, [studentId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLessonProgress((prev) => ({ ...prev, loading: true, error: '' }));
      try {
        const res = await lessonPracticeApi.student.subjects();
        if (cancelled) return;
        const enrolledVideoCourses = (res.data?.courses || []).filter(
          (course) => course.enrolled && course.deliveryMode === 'video',
        );
        const byId = new Map();
        const byName = new Map();
        enrolledVideoCourses.forEach((course) => {
          const progress = {
            completed: Number(course.completedLessonCount) || 0,
            total: Number(course.lessonCount) || 0,
          };
          byId.set(String(course.id), progress);
          byName.set(normalizeCourseName(course.name), progress);
        });
        setLessonProgress({ loading: false, error: '', byId, byName });
      } catch (err) {
        if (!cancelled) {
          setLessonProgress({ loading: false, error: err.message || 'Không tải được tiến độ bài học', byId: new Map(), byName: new Map() });
        }
      }
    };
    const refresh = () => load();
    load();
    window.addEventListener('focus', refresh);
    window.addEventListener('lesson-practice-progress-updated', refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('lesson-practice-progress-updated', refresh);
    };
  }, [studentId]);

  const toggleSection = (key) => setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleResumeVideoPay = (order) => {
    if (!order?.courseId) return;
    window.location.hash = `materials-videos?courseId=${encodeURIComponent(order.courseId)}&resumePay=1`;
  };

  const handleContinueVideoLearning = (order) => {
    if (!order?.courseId) return;
    window.location.hash = `materials-videos?courseId=${encodeURIComponent(order.courseId)}`;
  };

  const profileGender = studentData?.gender || sessionGender || '';

  const teacherValue = Array.isArray(studentData?.teacherNames) && studentData.teacherNames.length
    ? studentData.teacherNames.join(', ')
    : (Array.isArray(studentData?.teacher)
      ? studentData.teacher.filter(Boolean).join(', ')
      : (studentData?.teacher || 'Chưa phân công'));

  const courses = Array.isArray(studentData?.courses) ? studentData.courses : [];
  const progressForCourse = (course) => {
    const courseId = String(course.courseId || '');
    return (courseId && lessonProgress.byId.get(courseId))
      || lessonProgress.byName.get(normalizeCourseName(course.courseName || course.name))
      || null;
  };

  const handleEnableNotification = async () => {
    if (!('Notification' in window)) {
      toast.error('Trình duyệt không hỗ trợ thông báo.');
      return;
    }
    try {
      const res = await Notification.requestPermission();
      if (res === 'granted') {
        toast.success('Đã bật quyền thông báo cho trình duyệt này!');
      } else if (res === 'denied') {
        toast.error('Quyền thông báo đang bị chặn. Vui lòng cho phép trong cài đặt trình duyệt.');
      } else {
        toast.info('Bạn chưa xác nhận quyền thông báo.');
      }
    } catch {
      toast.error('Không thể kích hoạt thông báo.');
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.clear();
      window.location.href = '/login';
    }
  };

  // Tính số buổi còn lại
  const remainingSessions = (() => {
    if (studentData?.remainingSessions != null) return studentData.remainingSessions;
    const total = Number(studentData?.totalSessions) || 12;
    const done = Number(studentData?.completedSessions) || 0;
    return Math.max(0, total - done);
  })();

  // Điểm trung bình
  const avgGrade = studentData?.avgGrade ?? studentData?.overallScore ?? studentData?.gpa ?? 0;

  // Tên gói hiển thị
  const planName = freeTier
    ? 'Tài khoản miễn phí'
    : subscription
      ? (isLifetime ? 'Gói Vĩnh viễn' : `Gói ${subscription.planLabel}`)
      : 'Tài khoản học viên';

  return (
    <div className="max-w-2xl mx-auto space-y-3.5 sm:space-y-4 py-3 px-2 sm:px-4 animate-in fade-in duration-300">
      {/* ── 1. Thẻ Hero hồ sơ cá nhân (Đồng bộ chuẩn Mobile App) ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0c6b5b] via-[#0a584b] to-[#073d34] text-white p-5 sm:p-6 shadow-md relative overflow-hidden">
        {/* Họa tiết trang trí mờ phía sau */}
        <div className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -right-4 -top-8 w-28 h-28 rounded-full bg-emerald-400/10 pointer-events-none" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="relative shrink-0">
            <EditableAvatar
              avatar={studentData?.avatar}
              name={studentData?.name}
              role="student"
              gender={profileGender}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl border-2 border-white/20 bg-white/10 shadow-lg cursor-pointer"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0FAF9F] border-2 border-[#0a584b] flex items-center justify-center text-white shadow pointer-events-none">
              <CheckCircle size={13} className="text-white fill-white/20" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wide truncate">
              {studentData?.name || studentData?.phone || 'HỌC VIÊN'}
            </h2>
            <p className="text-xs sm:text-sm font-medium text-emerald-100/90 truncate mt-0.5">
              {planName}
            </p>
          </div>
        </div>

        {/* 3 Chỉ số KPI chuẩn Mobile */}
        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/15 text-center relative z-10">
          <div>
            <p className="text-lg sm:text-2xl font-black text-white leading-tight">
              {progressPct || 0}%
            </p>
            <p className="text-[11px] sm:text-xs text-emerald-100/75 font-medium mt-0.5">
              Tiến độ
            </p>
          </div>
          <div className="border-x border-white/10">
            <p className="text-lg sm:text-2xl font-black text-white leading-tight">
              {avgGrade}
            </p>
            <p className="text-[11px] sm:text-xs text-emerald-100/75 font-medium mt-0.5">
              Điểm TB
            </p>
          </div>
          <div>
            <p className="text-lg sm:text-2xl font-black text-white leading-tight">
              {remainingSessions}
            </p>
            <p className="text-[11px] sm:text-xs text-emerald-100/75 font-medium mt-0.5">
              Buổi còn lại
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. Menu Bảo mật & Tiện ích (Ngay dưới Hero theo đúng Mobile) ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-100">
        <button
          type="button"
          onClick={openChangePassword}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 border border-rose-100 flex items-center justify-center shrink-0">
            <Shield size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Đổi mật khẩu</p>
            <p className="text-xs text-slate-500 mt-0.5">Bảo mật tài khoản đăng nhập</p>
          </div>
          <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </button>

        <button
          type="button"
          onClick={openPinLockSettings}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-xs">
            <KeyRound size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Khóa mã PIN</p>
            <p className="text-xs text-slate-500 mt-0.5">Tự khóa màn hình khi không thao tác</p>
          </div>
          <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </button>

        <button
          type="button"
          onClick={openLearningGoal}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 sm:px-5 sm:py-4 text-left hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <span className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Target size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Mục tiêu học</p>
            <p className="text-xs text-slate-500 mt-0.5">Đặt hoặc đổi số giờ học mỗi ngày</p>
          </div>
          <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </button>
      </div>

      {/* ── 3. Thông tin cá nhân (Chuẩn Mobile) ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <User size={18} className="text-[#0FAF9F]" />
            <h3 className="text-sm sm:text-base font-bold text-slate-800">Thông tin cá nhân</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUpdateProfileModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-colors cursor-pointer"
            >
              <Settings size={13} />
              <span>Cập nhật</span>
            </button>
            <button
              type="button"
              onClick={() => toggleSection('personalInfo')}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              aria-label="Thu gọn thông tin cá nhân"
            >
              <ChevronDown size={18} className={`transition-transform duration-200 ${openSections.personalInfo ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        {openSections.personalInfo && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <Mail size={16} className="text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-400">Email</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                  {studentData?.email || 'Chưa cập nhật'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <Phone size={16} className="text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-400">Số điện thoại</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 font-mono">
                  {studentData?.phone || 'Chưa cập nhật'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <Phone size={16} className="text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-400">SĐT Khác</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 font-mono">
                  {studentData?.otherPhone || studentData?.secondaryPhone || studentData?.parentPhone || studentData?.phone || 'Chưa cập nhật'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <MapPin size={16} className="text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-400">Địa chỉ</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                  {studentData?.address || 'Chưa cập nhật'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Tóm tắt học tập (Chuẩn Mobile) ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-sm p-4 sm:p-5">
        <button
          type="button"
          onClick={() => toggleSection('summary')}
          className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-blue-600" />
            <h3 className="text-sm sm:text-base font-bold text-slate-800">Tóm tắt học tập</h3>
          </div>
          <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${openSections.summary ? 'rotate-180' : ''}`} />
        </button>

        {openSections.summary && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3.5 mt-2 border-t border-slate-100">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <GraduationCap size={16} className="text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-400">Giáo viên</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                  {teacherValue}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <Award size={16} className="text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-400">Trạng thái</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                  {studentData?.status || 'Đang học'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <Receipt size={16} className="text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-400">Học phí theo khóa</p>
                <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                  {freeTier
                    ? 'Tài khoản miễn phí: 0đ'
                    : studentData?.tuition
                      ? `${studentData?.courseName || 'Khóa học'}: ${formatVnd(studentData.tuition)}đ`
                      : 'Tài khoản miễn phí: 0đ'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
              <CheckCircle size={16} className="text-emerald-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-slate-400">Thanh toán</p>
                <p className="text-xs sm:text-sm font-bold text-emerald-600 truncate">
                  Đã đóng học phí
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Khóa học (Chuẩn Mobile) ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-sm p-4 sm:p-5">
        <button
          type="button"
          onClick={() => toggleSection('courses')}
          className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-blue-600" />
            <h3 className="text-sm sm:text-base font-bold text-slate-800">Khóa học</h3>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {courses.length || (freeTier ? 1 : 0)}
            </span>
          </div>
          <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${openSections.courses ? 'rotate-180' : ''}`} />
        </button>

        {openSections.courses && (
          <div className="space-y-2.5 pt-3.5 mt-2 border-t border-slate-100">
            {courses.length === 0 && freeTier && (
              <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-blue-600 truncate">Tài khoản miễn phí</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    GV: {teacherValue} · {new Date().toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { window.location.hash = 'lesson-practice'; }}
                  className="px-3.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 shrink-0 cursor-pointer"
                >
                  Học
                </button>
              </div>
            )}

            {courses.length === 0 && !freeTier && (
              <p className="text-xs text-slate-400 text-center py-4">Chưa có khóa học nào được đăng ký.</p>
            )}

            {courses.map((c) => {
              const title = c.courseName || c.name || 'Khóa học';
              const freeCourse = isFreePortalCourseName(title);
              const videoProgress = progressForCourse(c);
              const isVideoCourse = Boolean(videoProgress);
              const total = isVideoCourse ? videoProgress.total : (Number(c.totalSessions) || 12);
              const done = isVideoCourse ? videoProgress.completed : (Number(c.completedSessions) || 0);
              const isCompleted = !freeCourse && (c.status === 'completed' || (isVideoCourse && total > 0 && done >= total));
              const pct = freeCourse ? 0 : (Math.round((done / total) * 100) || 0);

              return (
                <div key={c.id || c.enrollmentId || title} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-900 truncate">{title}</h4>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700">
                      {isCompleted ? 'Đã xong' : 'Đang học'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    GV: {c.teacherName || teacherValue} {c.registeredAt ? `· ${formatDateDisplay(c.registeredAt)}` : ''}
                  </p>
                  {!freeCourse && (
                    <>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-2.5">
                        <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5">
                        <span>{done}/{total} buổi · Tiến độ {pct}%</span>
                        <span className="font-bold text-slate-700">{c.avgGrade ?? 0} TB</span>
                      </div>
                    </>
                  )}
                  {freeCourse && (
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={() => { window.location.hash = 'lesson-practice'; }}
                        className="px-3.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 cursor-pointer"
                      >
                        Học
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 6. Gói học Meet / Gói tự học (Chuẩn Mobile) ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Crown size={18} className="text-amber-500" />
          <h3 className="text-sm sm:text-base font-bold text-slate-800">Gói học Meet</h3>
        </div>

        {/* Thẻ hiển thị gói hiện tại */}
        <div className="mt-3.5 p-3.5 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-xs text-white ${
              isLifetime ? 'bg-gradient-to-br from-rose-500 to-rose-600' : 'bg-emerald-600'
            }`}>
              <CalendarClock size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-bold text-slate-900 truncate">
                {planName}
              </h4>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {isLifetime
                  ? 'Không giới hạn thời gian'
                  : freeTier
                    ? '60 XP mỗi ngày'
                    : subscription
                      ? `Hạn: ${formatExpiryDate(subscription.expiresAt)} · còn ${subscription.daysLeft} ngày`
                      : 'Kích hoạt hoặc gia hạn để học tiếp'}
              </p>
            </div>
          </div>
          {!isLifetime && (
            <button
              type="button"
              onClick={subCtx?.openRenew || (() => setShowTuitionModal(true))}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-xs whitespace-nowrap transition-colors cursor-pointer shrink-0"
            >
              Gia hạn
            </button>
          )}
        </div>

        {/* Lịch sử gia hạn */}
        {history.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-2">
              <History size={14} />
              <span>Lịch sử gia hạn</span>
            </div>
            <div className="space-y-1.5 divide-y divide-slate-100">
              {history.map((h, idx) => (
                <div key={idx} className="pt-2 flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-semibold text-slate-700 truncate">
                      Thanh toán · {h.planLabel || h.planId || 'Gói học'} {h.amount ? `· ${formatVnd(h.amount)}đ` : ''}
                    </p>
                  </div>
                  <span className="text-slate-400 font-mono shrink-0">
                    {h.createdAt ? new Date(h.createdAt).toLocaleDateString('vi-VN') : '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 7. Đơn mua khóa video (nếu có) ── */}
      {videoOrders.length > 0 && (
        <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-sm p-4 sm:p-5">
          <button
            type="button"
            onClick={() => toggleSection('videoOrders')}
            className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-violet-600" />
              <h3 className="text-sm sm:text-base font-bold text-slate-800">Đơn mua khóa video</h3>
              <span className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                {videoOrders.length}
              </span>
            </div>
            <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${openSections.videoOrders ? 'rotate-180' : ''}`} />
          </button>
          {openSections.videoOrders && (
            <div className="space-y-2 pt-3.5 mt-2 border-t border-slate-100">
              {videoOrders.map((order) => {
                const paid = isOrderPaid(order);
                return (
                  <div key={order._id || order.id || order.orderCode} className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 truncate">{order.courseTitle || order.courseName || 'Khóa học video'}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Mã: {order.orderCode || '-'} {order.amount ? `· ${formatVnd(order.amount)}đ` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {paid ? 'Đã thanh toán' : 'Chờ TT'}
                      </span>
                      {paid ? (
                        <button
                          type="button"
                          onClick={() => handleContinueVideoLearning(order)}
                          className="px-2.5 py-1 rounded bg-blue-600 text-white font-bold text-[11px] hover:bg-blue-700 cursor-pointer"
                        >
                          Vào học
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleResumeVideoPay(order)}
                          className="px-2.5 py-1 rounded bg-amber-500 text-white font-bold text-[11px] hover:bg-amber-600 cursor-pointer"
                        >
                          Thanh toán
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 8. Cài đặt và hỗ trợ (Chuẩn Mobile) ── */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-100 shadow-sm p-4 sm:p-5">
        <h4 className="text-sm sm:text-base font-bold text-slate-800 mb-3">Cài đặt và hỗ trợ</h4>
        <button
          type="button"
          onClick={handleEnableNotification}
          className="w-full flex items-center gap-3.5 text-left hover:bg-slate-50 p-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Bell size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-800">Bật thông báo trên thiết bị</p>
            <p className="text-xs text-slate-500 mt-0.5">Bật quyền thông báo cho trình duyệt này</p>
          </div>
          <ChevronRight size={18} className="text-slate-300 shrink-0" />
        </button>
        <p className="text-xs text-slate-400 italic mt-3 pt-3 border-t border-slate-100">
          Liên kết quyền riêng tư, điều khoản và hỗ trợ đang chờ Trung tâm cấu hình.
        </p>
      </div>

      {/* ── 9. Nút Đăng xuất (Chuẩn Mobile) ── */}
      <div className="pt-2 pb-6 flex justify-center">
        <button
          type="button"
          onClick={handleLogout}
          className="min-w-[180px] py-2.5 px-6 rounded-full border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          <LogOut size={16} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}
