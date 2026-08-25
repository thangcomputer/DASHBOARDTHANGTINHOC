import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import BranchFilterDropdown from './BranchFilterDropdown';
import FloatingMessenger from './FloatingMessenger';
import { FloatingMessengerProvider } from '../context/FloatingMessengerContext';
import { useData } from '../context/DataContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../utils/toast';
import api, { setTokens, csrfFetch } from '../services/api';
import { 
  Bell, LogOut, CheckCircle2, Clock, X, Lock,
  Calendar, DollarSign, UserPlus, Zap, BookOpen, Award, Menu, Star,
} from 'lucide-react';

import { formatNotificationStudentMask } from '../utils/studentMask';
import { getMessagingRole } from '../lib/messagingRoles';
import StudentQuizInviteHost from './student/StudentQuizInviteHost';
import StudentAttendanceConfirmModal from './student/StudentAttendanceConfirmModal';
import StudentAssignedTeacherModal from './student/StudentAssignedTeacherModal';
import AdminAttendanceDisputeModal from './admin/shared/AdminAttendanceDisputeModal';
import WelcomeCelebrationOverlay from './WelcomeCelebrationOverlay';
import { useAttendanceConfirmFlush } from '../utils/attendanceConfirmStore';
import { useAttendanceRealtimeSync } from '../hooks/useAttendanceRealtimeSync';
import TeacherRatingDetailModal, {
  getEvaluationIdFromNotif,
  isTeacherRatingNotif,
} from './teacher/TeacherRatingDetailModal';
import { RATING_CRITERIA } from '../context/useDataRatings';

const PAGE_TITLES = {
  dashboard: 'Tổng quan',
  students: 'Học viên',
  teachers: 'Giảng viên',
  evaluations: 'Đánh giá',
  finance: 'Tài chính',
  training: 'Đào tạo GV',
  'student-training': 'Đào tạo HV',
  'cert-prep': 'Ôn thi MOS/IC3',
  staff: 'Phân quyền',
  hr: 'Nhân sự',
  analytics: 'Doanh thu',
  settings: 'Cài đặt',
  logs: 'Nhật ký',
  schedule: 'Lịch học',
  materials: 'Tài liệu',
  evaluation: 'Đánh giá',
  profile: 'Hồ sơ',
};

function resolvePageTitle(role, pathname, hash) {
  const key = (hash || '').replace('#', '');
  if (key && PAGE_TITLES[key]) return PAGE_TITLES[key];
  if (pathname.includes('/inbox')) return 'Hộp thư';
  if (pathname.includes('/feed')) return 'Bảng tin';
  if (pathname.includes('/news')) return 'Tin tức';
  if (pathname.includes('/notifications')) return 'Thông báo';
  if (pathname.includes('/bi')) return 'BI Dashboard';
  if (pathname.includes('/files')) return 'Quản lý file';
  if (pathname.includes('/backups')) return 'Sao lưu';
  if (pathname.includes('/monitoring')) return 'Monitoring';
  if (pathname.includes('/ai')) return 'AI Center';
  if (pathname.includes('/workflows')) return 'Workflow';
  if (pathname.includes('/builder')) return 'Form & Report';
  if (pathname.includes('/tenants')) return 'Multi-tenant';
  if (pathname.includes('/exam')) return 'Phòng thi';
  if (pathname.includes('/cert-prep')) return 'Ôn thi MOS/IC3';
  if (pathname.includes('/test')) return 'Bài test';
  if (pathname.includes('/finance')) return 'Tài chính';
  if (role === 'admin') return 'Quản trị';
  if (role === 'teacher') return 'Giảng dạy';
  return 'Học tập';
}

const getNotifStyle = (type) => {
  switch (String(type || '').toUpperCase()) {
    case 'FINANCE':
      return { icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', label: 'Tài chính' };
    case 'STUDENT':
    case 'COURSE':
      return { icon: UserPlus, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', label: 'Khóa học' };
    case 'SCHEDULE':
      return { icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', label: 'Lịch dạy' };
    case 'EXAM':
      return { icon: Award, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', label: 'Thi' };
    case 'EVALUATION':
    case 'GRADE':
      return { icon: Star, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', label: 'Đánh giá' };
    case 'ADMIN':
      return { icon: Zap, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', label: 'Admin' };
    case 'SYSTEM':
      return { icon: Zap, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100', label: 'Hệ thống' };
    case 'NEWS':
      return { icon: Bell, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', label: 'Tin tức' };
    case 'TRAINING':
      return { icon: BookOpen, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', label: 'Đào tạo' };
    default:
      return { icon: Bell, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-100', label: 'Thông báo' };
  }
};

const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date); 
  const now = new Date();
  const diffMs = now - d;
  if (diffMs < 0) return 'Vừa xong';
  if (diffMs < 60000) return 'Vừa xong';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} phút trước`;
  if (diffMs < 86400000) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const getGreetingTime = () => {
  const currentHour = new Date().getHours();
  if (currentHour < 11) return 'buổi sáng';
  if (currentHour < 14) return 'buổi trưa';
  if (currentHour < 18) return 'buổi chiều';
  return 'buổi tối';
};

const DashboardLayout = ({ role, session, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [ratingDetail, setRatingDetail] = useState(null);
  const [ratingDetailLoading, setRatingDetailLoading] = useState(false);
  const [ratingDetailError, setRatingDetailError] = useState('');
  const [adminQuickPopup, setAdminQuickPopup] = useState(null);
  const { socket } = useSocket() || {};
  const { students, teachers, isRefetching, triggerBackgroundSync, notifications: allNotifications, markNotificationRead, getConversations } = useData();
  const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || "");
  const myId = String(session?.id || session?._id || '');
  useAttendanceConfirmFlush({
    enabled: role === 'teacher',
    teacherId: myId,
  });
  useAttendanceRealtimeSync({
    enabled: role === 'teacher' || role === 'admin' || role === 'staff',
    myId,
    role,
  });

  const openTeacherRatingDetail = async (notifOrIds = {}) => {
    const evaluationId = notifOrIds.evaluationId
      || getEvaluationIdFromNotif(notifOrIds)
      || null;
    const studentId = notifOrIds.studentId || notifOrIds.payload?.studentId || null;
    const teacherId = myId;
    if (!teacherId) return;

    setRatingDetailLoading(true);
    setRatingDetailError('');
    setRatingDetail(null);
    try {
      const res = await api.evaluations.getByTeacher(teacherId);
      const list = (res?.success && Array.isArray(res.data)) ? res.data : [];
      const found = list.find((e) => String(e.id || e._id) === String(evaluationId))
        || list.find((e) => studentId && String(e.studentId) === String(studentId))
        || (list.length === 1 ? list[0] : null);
      if (!found) {
        setRatingDetailError('Không tìm thấy nội dung đánh giá.');
      } else {
        setRatingDetail(found);
      }
    } catch {
      setRatingDetailError('Không tải được đánh giá. Thử lại sau.');
    } finally {
      setRatingDetailLoading(false);
    }
  };

  useEffect(() => {
    const onOpen = (e) => {
      openTeacherRatingDetail(e.detail || {});
    };
    window.addEventListener('open-teacher-rating', onOpen);
    return () => window.removeEventListener('open-teacher-rating', onOpen);
  }, [myId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link ?evaluationId= từ thông báo
  useEffect(() => {
    if (role !== 'teacher' || !myId) return;
    try {
      const params = new URLSearchParams(location.search || '');
      const evaluationId = params.get('evaluationId');
      if (!evaluationId) return;
      openTeacherRatingDetail({ evaluationId });
      params.delete('evaluationId');
      const next = params.toString();
      navigate({ pathname: location.pathname, search: next ? `?${next}` : '', hash: location.hash }, { replace: true });
    } catch { /* ignore */ }
  }, [role, myId, location.search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.documentElement.classList.add('cms-app-shell');
    document.body.classList.add('cms-app-shell');
    return () => {
      document.documentElement.classList.remove('cms-app-shell');
      document.body.classList.remove('cms-app-shell');
    };
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const onBlog = (payload) => {
      if (payload?.targetAudience) {
        if (role === 'teacher' && payload.targetAudience === 'student') return;
        if (role === 'student' && payload.targetAudience === 'teacher') return;
      }
      const title = payload?.title ? `Có bài viết mới: '${payload.title}'` : 'Có bài viết mới';
      toast.info(title);
    };
    socket.on('blog:published', onBlog);
    return () => socket.off('blog:published', onBlog);
  }, [socket, toast, role]);

  useEffect(() => {
    const key = `${role}_user`;
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      if (stored && !stored.token && session?.sbd) {
        if (stored.refreshToken) {
          csrfFetch(`${API}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: stored.refreshToken }),
          }).then(r => r.json()).then(res => {
            if (res.success && res.accessToken) {
              const nextRefresh = res.refreshToken || stored.refreshToken;
              localStorage.setItem(key, JSON.stringify({ ...stored, token: res.accessToken, accessToken: res.accessToken, refreshToken: nextRefresh }));
              setTokens(res.accessToken, nextRefresh, role);
            }
          }).catch(() => {});
        }
      }
    } catch {}
  }, []);

  const sessionTeacherId = session?.id || session?._id;

  const currentTeacher = role === 'teacher' && sessionTeacherId
    ? teachers.find(t => String(t.id) === String(sessionTeacherId))
    : null;

  // ⭐ Fix: Chuyển sang logic "Pessimistic" (Mặc định là Pending trừ khi có bằng chứng là Active)
  // Việc này giúp tránh bị "Flash" mở khóa menu khi login (do data chưa load kịp)
  const isTeacherPending = (role === 'teacher' && sessionTeacherId) ? (
     String(session?.status || '').toLowerCase() !== 'active' && 
     (!currentTeacher || String(currentTeacher.status || '').toLowerCase() !== 'active')
  ) : false;

  const isTeacherActive = (role === 'teacher' && sessionTeacherId) ? (
     String(session?.status || '').toLowerCase() === 'active' || 
     (currentTeacher && String(currentTeacher.status || '').toLowerCase() === 'active')
  ) : false;

  useEffect(() => {
    if (role !== 'teacher' || !sessionTeacherId) return;
    if (window.location.pathname.includes('/teacher/test')) return;
    
    // Nếu hệ thống đang tải hoặc currentTeacher chưa có nhưng session lại nói là active/pending thì CHỜ.
    const isLocalStatusValid = ['pending', 'active', 'locked'].includes(String(session?.status).toLowerCase());
    if (isRefetching || (!currentTeacher && isLocalStatusValid)) return;
    
    const currentStatus = currentTeacher?.status || session?.status;
    if (currentStatus === undefined || currentStatus === '') return;
    
    const allowed = ['pending', 'active'];
    const s = String(currentStatus).toLowerCase();
    
    // Khóa / chờ chấm: chuyển sang trang test thay vì đá ra login
    if (!allowed.includes(s)) {
      navigate('/teacher/test', { replace: true });
    }
  }, [currentTeacher, role, session, sessionTeacherId, isRefetching, navigate]);

  useEffect(() => {
    if (role !== 'teacher' || !sessionTeacherId) return;
    
    const isLocalStatusValid = String(session?.status).toLowerCase();
    if (isRefetching || (!currentTeacher && isLocalStatusValid)) return;

    const status = String(currentTeacher?.status || session?.status || '').toLowerCase();
    if (!status) return;

    const path = location.pathname || '';
    const onTest = path.includes('/teacher/test');

    // Pending / locked: chỉ được trang bài test
    if ((status === 'pending' || status === 'locked') && !onTest) {
      navigate('/teacher/test', { replace: true });
      return;
    }
    // Active: không ở trang Test
    if (status === 'active' && onTest) {
      navigate('/teacher', { replace: true });
    }
  }, [currentTeacher?.status, session?.status, role, sessionTeacherId, navigate, isRefetching, location.pathname]);

  // Admin/staff lần đầu: mở đổi MK ngay. HV/GV: không auto — đổi thủ công ở Hồ sơ/menu.
  useEffect(() => {
    if (session?.isFirstLogin !== true) return;
    if (role === 'student' || role === 'teacher') return;
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-change-password-modal'));
    }, 500);
    return () => clearTimeout(timer);
  }, [session?.isFirstLogin, role]);

  const [showWelcomeCelebration, setShowWelcomeCelebration] = useState(false);
  const welcomeMarkedRef = React.useRef(false);
  const [courseCelebration, setCourseCelebration] = useState(null);
  const courseCelebrationTimerRef = React.useRef(null);
  const [starBonusCelebration, setStarBonusCelebration] = useState(null);
  const starBonusShownRef = React.useRef(new Set());
  const [attendanceConfirm, setAttendanceConfirm] = useState(null);
  const [attendanceConfirmBusy, setAttendanceConfirmBusy] = useState(false);
  const [attendanceDispute, setAttendanceDispute] = useState(null);
  const [attendanceDisputeBusy, setAttendanceDisputeBusy] = useState(false);

  const starBonusSeenKey = React.useCallback((teacherId, month) => (
    `star_bonus_celeb_${teacherId}_${month}`
  ), []);

  const markStarBonusSeen = React.useCallback((teacherId, month) => {
    if (!teacherId || !month) return;
    const key = starBonusSeenKey(teacherId, month);
    starBonusShownRef.current.add(key);
    try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
  }, [starBonusSeenKey]);

  const hasSeenStarBonus = React.useCallback((teacherId, month) => {
    if (!teacherId || !month) return true;
    const key = starBonusSeenKey(teacherId, month);
    if (starBonusShownRef.current.has(key)) return true;
    try {
      if (localStorage.getItem(key) === '1') {
        starBonusShownRef.current.add(key);
        return true;
      }
    } catch { /* ignore */ }
    return false;
  }, [starBonusSeenKey]);

  const queueStarBonusCelebration = React.useCallback((raw) => {
    if (!raw?.month) return;
    const teacherId = String(raw.teacherId || myId || '');
    if (teacherId && myId && teacherId !== myId) return;
    if (hasSeenStarBonus(myId || teacherId, raw.month)) return;
    setStarBonusCelebration({
      month: String(raw.month),
      monthLabel: raw.monthLabel || '',
      amount: Number(raw.amount) || 0,
      minStudents: raw.minStudents,
      minStars: raw.minStars,
      teacherId: myId || teacherId,
    });
  }, [myId, hasSeenStarBonus]);

  const queueCourseCelebration = React.useCallback((raw) => {
    if (!raw) return;
    if (courseCelebrationTimerRef.current) {
      clearTimeout(courseCelebrationTimerRef.current);
      courseCelebrationTimerRef.current = null;
    }
    const payload = {
      courseName: raw.courseName || raw.course || 'khóa học',
      enrollmentId: raw.enrollmentId || null,
      completedSessions: raw.completedSessions,
      totalRequired: raw.totalRequired,
      showAfter: raw.showAfter || null,
    };
    const afterMs = payload.showAfter ? new Date(payload.showAfter).getTime() : 0;
    const delay = Number.isFinite(afterMs) ? Math.max(0, afterMs - Date.now()) : 0;
    if (delay <= 0) {
      setCourseCelebration(payload);
      return;
    }
    courseCelebrationTimerRef.current = setTimeout(() => {
      courseCelebrationTimerRef.current = null;
      setCourseCelebration(payload);
    }, delay);
  }, []);

  useEffect(() => () => {
    if (courseCelebrationTimerRef.current) clearTimeout(courseCelebrationTimerRef.current);
  }, []);

  useEffect(() => {
    if (role !== 'student' && role !== 'teacher') return;
    if (session?.showWelcomeCelebration !== true) return;
    setShowWelcomeCelebration(true);
  }, [role, session?.showWelcomeCelebration, session?.id, session?._id]);

  useEffect(() => {
    if (role !== 'student') return;
    const pending = session?.pendingCourseCelebration;
    if (!pending?.courseName && !pending?.enrollmentId) return;
    if (showWelcomeCelebration) return;
    queueCourseCelebration(pending);
  }, [role, session?.pendingCourseCelebration, showWelcomeCelebration, session?.id, session?._id, queueCourseCelebration]);

  useEffect(() => {
    if (!socket || role !== 'student') return undefined;
    const onCourseCelebration = (payload) => {
      if (!payload) return;
      if (String(payload.studentId || '') && myId && String(payload.studentId) !== myId) return;
      queueCourseCelebration(payload);
    };
    socket.on('course:celebration', onCourseCelebration);
    return () => { socket.off('course:celebration', onCourseCelebration); };
  }, [socket, role, myId, queueCourseCelebration]);

  useEffect(() => {
    if (!socket || role !== 'teacher') return undefined;
    const onStarBonus = (payload) => {
      if (!payload) return;
      queueStarBonusCelebration(payload);
    };
    socket.on('teacher:star-bonus-celebration', onStarBonus);
    return () => { socket.off('teacher:star-bonus-celebration', onStarBonus); };
  }, [socket, role, queueStarBonusCelebration]);

  // HV: modal xác nhận điểm danh (blocking)
  useEffect(() => {
    if (role !== 'student' || !myId) return undefined;
    let cancelled = false;
    const loadPending = async () => {
      try {
        const res = await api.schedules.getPendingConfirm();
        if (cancelled) return;
        const list = Array.isArray(res?.data) ? res.data : [];
        // Chỉ auto-mở khi còn bắt buộc xác nhận (pending). Disputed → không chặn.
        const firstPending = list.find((p) => (
          String(p?.studentConfirmStatus || '').toLowerCase() === 'pending'
        ));
        if (firstPending?.scheduleId) {
          setAttendanceConfirm({ ...firstPending, resolved: false, waiting: false });
        }
      } catch { /* ignore */ }
    };
    loadPending();

    if (!socket) return () => { cancelled = true; };
    const onAwait = (payload) => {
      if (!payload) return;
      if (payload.studentId && String(payload.studentId) !== myId) return;
      setAttendanceConfirm({ ...payload, resolved: false, waiting: false });
    };
    const onResolved = (payload, outcome) => {
      if (!payload?.scheduleId) return;
      if (payload.studentId && String(payload.studentId) !== myId) return;
      setAttendanceConfirm((prev) => {
        const same = prev && String(prev.scheduleId) === String(payload.scheduleId);
        const st = String(payload.studentConfirmStatus || '').toLowerCase();
        const isAdminResolve = outcome === 'rejected'
          || st === 'admin_approved'
          || st === 'admin_rejected';
        // HV tự Đồng ý: đã đóng modal → không mở lại «Đã giải quyết»
        if (!same && !isAdminResolve) return prev || null;
        return {
          ...payload,
          resolved: true,
          waiting: false,
          resolveOutcome: outcome === 'rejected' ? 'rejected' : 'approved',
          studentConfirmStatus: outcome === 'rejected'
            ? 'admin_rejected'
            : (payload.studentConfirmStatus || 'admin_approved'),
        };
      });
    };
    const onConfirmed = (p) => onResolved(p, 'approved');
    const onRejected = (p) => onResolved(p, 'rejected');
    const onDisputed = (payload) => {
      if (!payload?.scheduleId) return;
      if (payload.studentId && String(payload.studentId) !== myId) return;
      // Sau khi HV gửi tranh chấp: đóng modal chặn; có thể mở lại dạng chờ khi bấm thông báo
      setAttendanceConfirm((prev) => (
        prev && String(prev.scheduleId) === String(payload.scheduleId) ? null : prev
      ));
    };
    socket.on('attendance:awaiting-confirm', onAwait);
    socket.on('attendance:confirmed', onConfirmed);
    socket.on('attendance:disputed', onDisputed);
    socket.on('attendance:rejected', onRejected);
    return () => {
      cancelled = true;
      socket.off('attendance:awaiting-confirm', onAwait);
      socket.off('attendance:confirmed', onConfirmed);
      socket.off('attendance:disputed', onDisputed);
      socket.off('attendance:rejected', onRejected);
    };
  }, [socket, role, myId]);

  // Admin: tranh chấp → chỉ toast + badge chuông (không auto-mở modal, tránh chen thao tác)
  useEffect(() => {
    if (!socket || (role !== 'admin' && role !== 'staff')) return undefined;
    const onDispute = (payload) => {
      if (!payload?.scheduleId) return;
      toast.info(
        `Tranh chấp điểm danh: ${payload.studentName || 'HV'} — buổi ${payload.sessionNumber || '?'}. Bấm chuông để xử lý.`,
      );
    };
    socket.on('attendance:disputed', onDispute);
    return () => { socket.off('attendance:disputed', onDispute); };
  }, [socket, role, toast]);

  const handleStudentAttendanceDecision = React.useCallback(async (decision) => {
    const sid = attendanceConfirm?.scheduleId;
    if (!sid) return;
    setAttendanceConfirmBusy(true);
    try {
      const res = await api.schedules.studentConfirm(sid, decision);
      if (!res?.success) {
        toast.error(res?.message || 'Không gửi được xác nhận');
        return;
      }
      setAttendanceConfirm(null);
      if (res.disputed) {
        toast.info('Đã gửi tranh chấp — chờ Admin giải quyết. Buổi chưa được tính.');
      } else {
        toast.success('Đã xác nhận điểm danh — buổi học được tính.');
      }
      if (typeof triggerBackgroundSync === 'function') {
        Promise.resolve(triggerBackgroundSync({ force: true })).catch(() => {});
      }
    } catch (e) {
      toast.error(e?.message || 'Lỗi kết nối');
    } finally {
      setAttendanceConfirmBusy(false);
    }
  }, [attendanceConfirm, toast, triggerBackgroundSync]);

  /** Mở modal HV từ thông báo: luôn check trạng thái thật (tránh mở Đồng ý khi đã xong). */
  const openStudentAttendanceFromNotif = React.useCallback(async (rawPayload, opts = {}) => {
    const base = rawPayload && typeof rawPayload === 'object' ? { ...rawPayload } : {};
    const scheduleId = base.scheduleId || opts.scheduleId;
    const forceResolved = opts.forceResolved === true;
    const forceRejected = opts.forceRejected === true;

    if (forceResolved || forceRejected) {
      setAttendanceConfirm({
        ...base,
        scheduleId,
        sessionNumber: base.sessionNumber || base.completedSessions || '?',
        totalSessions: base.totalSessions || base.totalRequired,
        resolved: true,
        waiting: false,
        resolveOutcome: forceRejected ? 'rejected' : 'approved',
        studentConfirmStatus: forceRejected
          ? 'admin_rejected'
          : (base.studentConfirmStatus || 'admin_approved'),
        kind: forceRejected ? 'attendance_rejected' : (base.kind || 'attendance_taken'),
      });
      return;
    }

    if (!scheduleId) {
      // Không có scheduleId (vd. «Đã điểm danh buổi học») → chỉ xem đã giải quyết + thoát
      setAttendanceConfirm({
        ...base,
        sessionNumber: base.sessionNumber || base.completedSessions || '?',
        totalSessions: base.totalSessions || base.totalRequired,
        resolved: true,
        waiting: false,
        kind: base.kind || 'attendance_taken',
        studentConfirmStatus: 'accepted',
      });
      return;
    }

    try {
      const res = await api.schedules.getPendingConfirm();
      const list = Array.isArray(res?.data) ? res.data : [];
      const live = list.find((p) => String(p?.scheduleId) === String(scheduleId));
      const st = String(live?.studentConfirmStatus || '').toLowerCase();
      if (live && st === 'pending') {
        setAttendanceConfirm({ ...live, resolved: false, waiting: false });
        return;
      }
      if (live && st === 'disputed') {
        setAttendanceConfirm({ ...live, resolved: false, waiting: true });
        return;
      }
      setAttendanceConfirm({
        ...base,
        ...(live || {}),
        scheduleId,
        sessionNumber: base.completedSessions
          || live?.sessionNumber
          || base.sessionNumber
          || '?',
        totalSessions: base.totalRequired
          || base.totalSessions
          || live?.totalSessions,
        resolved: true,
        waiting: false,
        studentConfirmStatus: base.studentConfirmStatus || 'accepted',
        kind: base.kind || 'attendance_taken',
      });
    } catch {
      setAttendanceConfirm({ ...base, scheduleId, resolved: false, waiting: false });
    }
  }, []);

  const handleAdminDisputeDecision = React.useCallback(async (decision) => {
    const sid = attendanceDispute?.scheduleId;
    if (!sid) return;
    setAttendanceDisputeBusy(true);
    try {
      const res = await api.schedules.resolveDispute(sid, decision);
      if (!res?.success) {
        toast.error(res?.message || 'Không xử lý được tranh chấp');
        return;
      }
      setAttendanceDispute(null);
      if (res.rejected) {
        toast.success('Đã từ chối — buổi không tính. Đã báo GV và HV.');
      } else {
        toast.success('Đã chấp thuận — buổi được tính.');
      }
      if (typeof triggerBackgroundSync === 'function') {
        Promise.resolve(triggerBackgroundSync({ force: true })).catch(() => {});
      }
    } catch (e) {
      toast.error(e?.message || 'Lỗi kết nối');
    } finally {
      setAttendanceDisputeBusy(false);
    }
  }, [attendanceDispute, toast, triggerBackgroundSync]);

  const dismissWelcomeCelebration = React.useCallback(async () => {
    setShowWelcomeCelebration(false);
    if (welcomeMarkedRef.current) return;
    welcomeMarkedRef.current = true;
    try {
      await api.auth.markWelcomeCelebrationSeen();
      const key = role === 'staff' ? 'staff' : role;
      const stored = JSON.parse(localStorage.getItem(`${key}_user`) || '{}');
      localStorage.setItem(`${key}_user`, JSON.stringify({ ...stored, showWelcomeCelebration: false }));
    } catch {
      welcomeMarkedRef.current = false;
    }
  }, [role]);

  const dismissCourseCelebration = React.useCallback(async () => {
    const current = courseCelebration;
    setCourseCelebration(null);
    if (!current) return;
    try {
      await api.auth.markCourseCelebrationSeen({
        enrollmentId: current?.enrollmentId,
        courseName: current?.courseName,
      });
      const key = 'student';
      const stored = JSON.parse(localStorage.getItem(`${key}_user`) || '{}');
      localStorage.setItem(`${key}_user`, JSON.stringify({ ...stored, pendingCourseCelebration: null }));
    } catch { /* lần sau /me sẽ hiện lại nếu chưa lưu */ }
  }, [courseCelebration]);

  const dismissStarBonusCelebration = React.useCallback(() => {
    const current = starBonusCelebration;
    setStarBonusCelebration(null);
    if (!current?.month) return;
    markStarBonusSeen(current.teacherId || myId, current.month);
    // Đánh dấu notif thưởng sao tháng đó đã đọc (nếu còn unread)
    try {
      const hit = (allNotifications || []).find((n) => (
        n?.payload?.kind === 'star_bonus_eligible'
        && String(n.payload?.month) === String(current.month)
        && !n.read
      ));
      if (hit && typeof markNotificationRead === 'function') {
        markNotificationRead(hit.id || hit._id);
      }
    } catch { /* ignore */ }
  }, [starBonusCelebration, markStarBonusSeen, myId, allNotifications, markNotificationRead]);

  const handleLogout = () => onLogout?.();

  const [showNotif, setShowNotif] = React.useState(false);
  const [notifLimit, setNotifLimit] = React.useState(5);
  const [notifPos, setNotifPos] = React.useState({ top: 72, right: 16 });
  const [assignedTeacherModal, setAssignedTeacherModal] = React.useState({
    open: false,
    loading: false,
    teacher: null,
  });
  const notifRef = React.useRef(null);
  const bellRef = React.useRef(null);

  const openAssignedTeacherFromNotif = React.useCallback(async (payload = {}) => {
    const teacherId = String(payload?.teacherId || '').trim();
    const fallback = {
      id: teacherId,
      name: payload?.teacherName || 'Giảng viên',
      specialty: payload?.specialty || '',
      averageRating: Number(payload?.averageRating) || 0,
      ratingCount: Number(payload?.ratingCount) || 0,
      voiceRegion: payload?.voiceRegion || '',
      avatar: payload?.avatar || '',
    };
    setAssignedTeacherModal({ open: true, loading: Boolean(teacherId), teacher: fallback });
    if (!teacherId) {
      setAssignedTeacherModal({ open: true, loading: false, teacher: fallback });
      return;
    }
    try {
      const res = await api.teachers.getPublicCard(teacherId);
      if (res?.success && res?.data) {
        setAssignedTeacherModal({
          open: true,
          loading: false,
          teacher: { ...fallback, ...res.data },
        });
        return;
      }
    } catch { /* keep fallback */ }
    setAssignedTeacherModal({ open: true, loading: false, teacher: fallback });
  }, []);

  useLayoutEffect(() => {
    if (!showNotif) return undefined;
    const updatePos = () => {
      const el = bellRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setNotifPos({
        top: Math.round(r.bottom + 8),
        right: Math.max(12, Math.round(window.innerWidth - r.right)),
      });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showNotif]);

  React.useEffect(() => {
    if (!showNotif) return;
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target) &&
          bellRef.current && !bellRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotif]);

  const myNotifications = allNotifications.filter(n => {
    // Nếu có mảng receivers, kiểm tra quyền
    if (Array.isArray(n.receivers) && n.receivers.length > 0) {
      const recs = n.receivers.map((r) => String(r));
      const myIdStr = myId != null ? String(myId) : '';
      const isAdminRole = role === 'admin' || role === 'staff';
      if (recs.includes('ALL_ADMIN') && !isAdminRole) return false;
      if (recs.includes('ALL_TEACHER') && role !== 'teacher') return false;
      if (recs.includes('ALL_STUDENT') && role !== 'student') return false;

      const isForMe = (myIdStr && recs.includes(myIdStr)) ||
                      (role && recs.includes(String(role))) ||
                      (isAdminRole && recs.includes('ALL_ADMIN')) ||
                      (role === 'teacher' && recs.includes('ALL_TEACHER')) ||
                      (role === 'student' && recs.includes('ALL_STUDENT')) ||
                      recs.includes('GLOBAL') ||
                      recs.includes('ALL');
      if (!isForMe) return false;
    }
    return ((myId && String(n.userId) === String(myId)) || !n.userId) && 
           (n.role === role || !n.role);
  }).sort((a, b) => new Date(b.time || Date.now()) - new Date(a.time || Date.now()));


  const unreadCount = myNotifications.filter(n => !n.read).length;

  // GV offline lúc đạt mốc → hiện popup khi vào lại (notif chưa xem + chưa celeb)
  useEffect(() => {
    if (role !== 'teacher' || !myId) return;
    if (showWelcomeCelebration || starBonusCelebration) return;
    const hit = myNotifications.find((n) => (
      n?.payload?.kind === 'star_bonus_eligible'
      && n?.payload?.month
      && !n.read
      && !hasSeenStarBonus(myId, n.payload.month)
    ));
    if (!hit) return;
    queueStarBonusCelebration({
      teacherId: myId,
      month: hit.payload.month,
      monthLabel: hit.payload.monthLabel,
      amount: hit.payload.amount,
      minStudents: hit.payload.minStudents,
      minStars: hit.payload.minStars,
    });
  }, [
    role,
    myId,
    myNotifications,
    showWelcomeCelebration,
    starBonusCelebration,
    hasSeenStarBonus,
    queueStarBonusCelebration,
  ]);

  useEffect(() => {
    triggerBackgroundSync();
  }, [triggerBackgroundSync]);

  const displayName = role === 'teacher'
    ? (currentTeacher?.name && !/^\d+$/.test(currentTeacher.name)
        ? currentTeacher.name
        : currentTeacher?.email || currentTeacher?.phone || session?.name || 'Giảng viên')
    : (session?.name || 'Admin');
  const pageTitle = resolvePageTitle(role, location.pathname, location.hash);
  const activeHash = (location.hash || '').replace('#', '').split('?')[0];
  const adminHash = activeHash || (location.pathname === '/admin' ? 'dashboard' : '');
  // GV Tổng quan = /teacher (không hash) — KHÔNG immersive; chỉ #students mới khóa scroll như split-pane.
  const isTeacherStudentsTab =
    role === 'teacher' && location.pathname === '/teacher' && activeHash === 'students';
  const isStudentsTab = adminHash === 'students' || isTeacherStudentsTab;
  const isInboxPage = location.pathname.includes('/inbox');
  const isBiPage = location.pathname.includes('/bi');
  const isImmersivePage =
    isInboxPage
    || isBiPage
    || (role === 'teacher' && location.pathname === '/teacher/test')
    || isTeacherStudentsTab;
  const showAdminBranch = role === 'admin';
  const roleLabel = role === 'admin'
    ? (session?.adminRole === 'SUPER_ADMIN' ? 'Super Admin' : session?.adminRole === 'HIGH_ADMIN' ? 'Admin cấp cao' : session?.adminRole === 'SUPPORT' ? 'Chuyên viên Hỗ trợ' : session?.adminRole === 'STAFF' ? 'Staff' : 'admin')
    : role;

  return (
    <FloatingMessengerProvider
      currentUserId={myId}
      currentUserRole={getMessagingRole(session) || role}
      getConversations={getConversations}
    >
    <div className="flex h-[100dvh] max-h-[100dvh] bg-[#f8fafc] relative font-sans overflow-hidden">
      {isRefetching ? (
        <div className="sr-only" role="status" aria-live="polite">
          Đang đồng bộ dữ liệu
        </div>
      ) : null}

      <AppSidebar
        session={session}
        role={role}
        userName={displayName}
        userAvatar={session?.avatar || session?.avatarUrl || ''}
        onLogout={handleLogout}
        teacherPending={isTeacherPending}
        adminRole={session?.adminRole || null}
        userPermissions={session?.permissions || []}
        mobileOpen={mobileNavOpen}
        onMobileOpenChange={setMobileNavOpen}
      />

      <main id="main-content" className="flex-1 min-w-0 flex flex-col h-[100dvh] max-h-[100dvh] max-w-full overflow-hidden" tabIndex={-1}>
        <header className={`cms-topbar flex flex-col ${
          !isImmersivePage ? 'cms-shell-gutter' : ''
        } ${
          role === 'teacher' && location.pathname === '/teacher/test' ? 'hidden' : ''
        }`}>
          <div className="cms-topbar__row">
            <button
              type="button"
              className="cms-topbar__menu"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Mở menu điều hướng"
              aria-expanded={mobileNavOpen}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1 flex flex-col md:flex-row md:items-center md:gap-3 overflow-hidden">
              <h1 className="cms-topbar__title">{pageTitle}</h1>
              <p className="hidden md:block text-[11px] sm:text-[12px] text-slate-500 truncate leading-none mt-0.5 sm:mt-0">
                <span className="font-medium text-slate-600">{displayName}</span>
                <span className="text-slate-300 mx-1">·</span>
                <span>{roleLabel}</span>
              </p>
            </div>

            <div className="flex items-center flex-nowrap justify-end gap-0.5 sm:gap-2 shrink-0">
              {showAdminBranch && (
                <div className={isStudentsTab ? 'hidden lg:block' : 'hidden md:block'}>
                  <BranchFilterDropdown />
                </div>
              )}

              <div className="relative">
                <button 
                  ref={bellRef}
                  type="button"
                  onClick={() => { setShowNotif(!showNotif); setNotifLimit(5); }}
                  aria-label={unreadCount > 0 ? `Thông báo, ${unreadCount} chưa đọc` : 'Thông báo'}
                  aria-expanded={showNotif}
                  aria-haspopup="dialog"
                  className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-colors duration-200 ${showNotif ? 'bg-red-600 text-white' : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                >
                  <Bell size={18} aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white" aria-hidden="true">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>

              <div className="h-8 w-px bg-slate-100 mx-0.5 hidden md:block" />

              {/* Desktop / large tablet+: logout in topbar (mobile+tablet dùng sidebar) */}
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Đăng xuất"
                className="hidden lg:inline-flex h-11 px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors duration-200 items-center gap-1.5"
              >
                <LogOut size={15} aria-hidden="true" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>

          {/* Mobile: branch full-width row (not students — students keeps prior lg-only behavior) */}
          {showAdminBranch && !isStudentsTab && (
            <div className="md:hidden w-full cms-page-gutter pb-2.5">
              <BranchFilterDropdown fullWidth />
            </div>
          )}
        </header>

        <div
          className={
            isInboxPage || isBiPage
              ? 'flex-1 min-h-0 w-full overflow-hidden flex flex-col cms-page-gutter py-3 sm:py-3 md:py-4 pb-[env(safe-area-inset-bottom,0px)]'
              : isImmersivePage
                ? 'flex-1 min-h-0 w-full overflow-hidden flex flex-col p-0'
                : 'flex-1 min-h-0 cms-page-gutter cms-shell-gutter py-3 sm:py-4 w-full max-w-full overflow-x-hidden overflow-y-auto overscroll-y-contain pb-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:pb-6'
          }
        >
          <div
            className={
              isInboxPage || isBiPage
                ? 'cms-page min-w-0 w-full max-w-full flex-1 min-h-0 h-full flex flex-col overflow-hidden'
                : isImmersivePage
                  ? 'cms-page min-w-0 flex-1 min-h-0 h-full flex flex-col overflow-hidden'
                  : 'cms-page min-w-0 w-full max-w-full'
            }
          >
            <Outlet context={{ session, role }} />
          </div>
        </div>
      </main>

      {role === 'student' ? <StudentQuizInviteHost /> : null}

      <WelcomeCelebrationOverlay
        open={showWelcomeCelebration}
        role={role}
        name={displayName || session?.name || ''}
        variant="welcome"
        onClose={dismissWelcomeCelebration}
      />
      <WelcomeCelebrationOverlay
        open={!showWelcomeCelebration && !!courseCelebration}
        role="student"
        name={displayName || session?.name || ''}
        variant="course_complete"
        courseName={courseCelebration?.courseName || ''}
        onClose={dismissCourseCelebration}
      />
      <WelcomeCelebrationOverlay
        open={!showWelcomeCelebration && !courseCelebration && !!starBonusCelebration}
        role="teacher"
        name={displayName || session?.name || ''}
        variant="star_bonus"
        starBonus={starBonusCelebration}
        onClose={dismissStarBonusCelebration}
      />
      <StudentAttendanceConfirmModal
        open={role === 'student' && !!attendanceConfirm}
        payload={attendanceConfirm}
        busy={attendanceConfirmBusy}
        onAccept={() => handleStudentAttendanceDecision('accept')}
        onDispute={() => handleStudentAttendanceDecision('dispute')}
        onDismiss={() => setAttendanceConfirm(null)}
      />
      <StudentAssignedTeacherModal
        open={role === 'student' && assignedTeacherModal.open}
        teacher={assignedTeacherModal.teacher}
        loading={assignedTeacherModal.loading}
        onClose={() => setAssignedTeacherModal({ open: false, loading: false, teacher: null })}
      />
      <AdminAttendanceDisputeModal
        open={(role === 'admin' || role === 'staff') && !!attendanceDispute}
        payload={attendanceDispute}
        busy={attendanceDisputeBusy}
        onApprove={() => handleAdminDisputeDecision('approve')}
        onReject={() => handleAdminDisputeDecision('reject')}
        onClose={() => setAttendanceDispute(null)}
      />

      {showNotif && typeof document !== 'undefined' && createPortal(
        <>
          <div
            className="cms-notif-backdrop md:hidden"
            aria-hidden="true"
            onClick={() => setShowNotif(false)}
          />
          <div
            ref={notifRef}
            role="dialog"
            aria-modal="true"
            aria-label="Danh sách thông báo"
            className="cms-notif-sheet"
            style={{
              '--notif-top': `${notifPos.top}px`,
              '--notif-right': `${notifPos.right}px`,
            }}
          >
            <div className="md:hidden flex justify-center pt-2 pb-1" aria-hidden="true">
              <span className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-shrink-0">
              <h3 className="font-semibold text-slate-900 text-base">Thông báo mới</h3>
              <button
                type="button"
                onClick={() => setShowNotif(false)}
                aria-label="Đóng thông báo"
                className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors duration-200"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {myNotifications.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Bell size={28} className="text-slate-300" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-semibold text-slate-400">Không có thông báo mới nào</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {myNotifications.slice(0, notifLimit).map((n, idx) => {
                    const style = getNotifStyle(n.type);
                    const Icon = style.icon;
                    return (
                      <div
                        key={`${n.id || n._id}-${idx}`}
                        onClick={() => {
                          markNotificationRead(n.id || n._id);
                          if (n.payload?.action === 'RESET_PASSWORD') {
                            window.dispatchEvent(new CustomEvent('open-reset-pw', { detail: n.payload }));
                          } else if (n.payload?.action === 'blog_published' && n.payload?.slug) {
                            const base = role === 'teacher' ? '/teacher' : role === 'student' ? '/student' : '/admin';
                            navigate(`${base}/news/${n.payload.slug}`);
                          } else if (n.payload?.kind === 'lms_qa' && n.payload?.qaId) {
                            const qaId = n.payload.qaId;
                            if (role === 'admin' || role === 'staff') {
                              navigate(`/admin/notifications?qaId=${encodeURIComponent(qaId)}`);
                            } else if (role === 'teacher') {
                              navigate(`/teacher/notifications?qaId=${encodeURIComponent(qaId)}`);
                            } else if (role === 'student') {
                              const p = n.path || `/student#materials?tab=qa&qaId=${encodeURIComponent(qaId)}`;
                              navigate(p.includes('#') ? p : `/student#materials?tab=qa&qaId=${encodeURIComponent(qaId)}`);
                            }
                          } else if (n.payload?.kind === 'attendance_dispute' && (role === 'admin' || role === 'staff')) {
                            setShowNotif(false);
                            (async () => {
                              const fallback = {
                                scheduleId: n.payload.scheduleId,
                                studentName: n.payload.studentName,
                                teacherName: n.payload.teacherName,
                                course: n.payload.course,
                                sessionNumber: n.payload.sessionNumber,
                                totalSessions: n.payload.totalSessions,
                                weekday: n.payload.weekday,
                                dateLabel: n.payload.dateLabel,
                                timeRange: n.payload.timeRange,
                              };
                              try {
                                const res = await api.schedules.getDisputes();
                                const live = (Array.isArray(res?.data) ? res.data : []).find(
                                  (p) => String(p?.scheduleId) === String(n.payload.scheduleId),
                                );
                                setAttendanceDispute(live || fallback);
                              } catch {
                                setAttendanceDispute(fallback);
                              }
                            })();
                          } else if (n.payload?.kind === 'attendance_confirm_pending' && role === 'student') {
                            setShowNotif(false);
                            openStudentAttendanceFromNotif(n.payload);
                          } else if (
                            role === 'student'
                            && (n.payload?.kind === 'attendance_admin_approved'
                              || n.payload?.kind === 'attendance_confirmed'
                              || n.payload?.kind === 'attendance_taken')
                          ) {
                            setShowNotif(false);
                            openStudentAttendanceFromNotif(n.payload, { forceResolved: true });
                          } else if (
                            role === 'student'
                            && n.payload?.kind === 'attendance_rejected'
                          ) {
                            setShowNotif(false);
                            openStudentAttendanceFromNotif(n.payload, { forceRejected: true });
                          } else if (
                            role === 'student'
                            && n.payload?.kind === 'attendance_dispute'
                          ) {
                            setShowNotif(false);
                            openStudentAttendanceFromNotif({
                              ...n.payload,
                              studentConfirmStatus: 'disputed',
                              waiting: true,
                            });
                          } else if (
                            role === 'student'
                            && (
                              String(n.title || '').includes('Đã điểm danh buổi học')
                              || String(n.title || '').includes('Điểm danh đã được chấp thuận')
                            )
                          ) {
                            setShowNotif(false);
                            openStudentAttendanceFromNotif({
                              ...(n.payload || {}),
                              course: n.payload?.course,
                              sessionNumber: n.payload?.completedSessions || n.payload?.sessionNumber,
                              totalSessions: n.payload?.totalRequired || n.payload?.totalSessions,
                              teacherName: n.payload?.teacherName,
                            }, { forceResolved: true });
                          } else if (
                            role === 'student'
                            && (
                              n.payload?.kind === 'teacher_assigned'
                              || n.payload?.kind === 'teacher_reassigned'
                              || String(n.title || '').includes('Phân công giảng viên')
                              || String(n.title || '').includes('Giảng viên khóa học đã đổi')
                            )
                          ) {
                            setShowNotif(false);
                            openAssignedTeacherFromNotif(n.payload || {});
                          } else if (n.payload?.kind === 'star_bonus_eligible' && role === 'teacher') {
                            setShowNotif(false);
                            setStarBonusCelebration({
                              month: String(n.payload.month || ''),
                              monthLabel: n.payload.monthLabel || '',
                              amount: Number(n.payload.amount) || 0,
                              minStudents: n.payload.minStudents,
                              minStars: n.payload.minStars,
                              teacherId: myId,
                            });
                          } else if (n.payload?.kind === 'lms_course_update') {
                            const action = n.payload?.action || '';
                            const isSoftware = String(action).startsWith('software_link');
                            const fallback = role === 'teacher'
                              ? (isSoftware ? '/teacher#software-links' : `/teacher#training?courseId=${encodeURIComponent(n.payload?.courseId || '')}`)
                              : (isSoftware ? '/student#materials-software' : `/student#materials-videos?courseId=${encodeURIComponent(n.payload?.courseId || '')}`);
                            const p = n.path || fallback;
                            if (String(p).includes('#')) {
                              const [pathPart, hashPart] = String(p).split('#');
                              navigate(pathPart || (role === 'teacher' ? '/teacher' : '/student'));
                              window.location.hash = hashPart || '';
                            } else {
                              navigate(p);
                            }
                          } else if (n.payload?.kind === 'lms_review') {
                            navigate(n.path || `/admin/notifications?reviewId=${encodeURIComponent(n.payload?.reviewId || '')}`);
                          } else if (role === 'teacher' && isTeacherRatingNotif(n)) {
                            openTeacherRatingDetail({
                              evaluationId: getEvaluationIdFromNotif(n),
                              studentId: n.payload?.studentId,
                              ...n,
                            });
                      } else if (role === 'teacher' && n.payload?.quizId) {
                        // Popup chi tiết kết quả trắc nghiệm (đúng/sai, thời điểm làm, số câu đúng/sai...)
                        navigate('/teacher#students');
                        window.setTimeout(() => {
                          window.dispatchEvent(new CustomEvent('open-teacher-quiz-detail', {
                            detail: {
                              quizId: n.payload?.quizId,
                              studentId: n.payload?.studentId,
                              payload: n.payload,
                            },
                          }));
                        }, 250);
                          } else if (role === 'teacher' && (n.payload?.type === 'schedule' || n.type === 'schedule')) {
                            // Chuyển hướng đến tab lịch học của giảng viên khi nhận thông báo ghi chú từ học viên
                            navigate('/teacher#schedule');
                          } else if (
                            (role === 'admin' || role === 'staff')
                            && (n.payload?.kind === 'admin_feedback'
                              || String(n.type || '').toUpperCase() === 'EVALUATION')
                          ) {
                            navigate('/admin#evaluations');
                          } else if ((role === 'admin' || role === 'staff' || session?.adminRole === 'SUPER_ADMIN' || session?.adminRole === 'STAFF') && (n.title?.includes('Học viên mới đăng ký') || n.title?.includes('Điểm danh buổi học'))) {

                            const openPopup = (studentData) => {
                              setAdminQuickPopup({
                                type: n.title?.includes('Học viên mới đăng ký') ? 'register' : 'attendance',
                                notif: n,
                                student: studentData,
                              });
                            };

                            if (n.payload?.studentId) {
                              api.students.getById(n.payload.studentId)
                                .then(res => {
                                  if (res?.success && res?.data) {
                                    openPopup(res.data);
                                  } else {
                                    // fallback to local state
                                    const st = students.find((s) => String(s._id || s.id) === String(n.payload?.studentId));
                                    if (st) openPopup(st);
                                    else if (n.path) navigate(n.path);
                                  }
                                })
                                .catch(() => {
                                  const st = students.find((s) => String(s._id || s.id) === String(n.payload?.studentId));
                                  if (st) openPopup(st);
                                  else if (n.path) navigate(n.path);
                                });
                            } else {
                              const st = students.find((s) => String(s._id || s.id) === String(n.payload?.studentId));
                              if (st) openPopup(st);
                              else if (n.path) navigate(n.path);
                            }
                          } else if (n.path) {
                            let targetPath = n.path;

                            if (targetPath.startsWith('http')) {
                              try {
                                const urlObj = new URL(targetPath);
                                targetPath = urlObj.pathname + urlObj.search + urlObj.hash;
                              } catch (e) {}
                            }

                            if (targetPath.startsWith('/admin/') && targetPath !== '/admin/inbox' && targetPath !== '/admin/news' && !targetPath.includes('/news/') && !targetPath.includes('#')) {
                              targetPath = '/admin#' + targetPath.replace('/admin/', '');
                            } else if (targetPath.startsWith('/student/') && !['/student/exam', '/student/inbox', '/student/news'].includes(targetPath) && !targetPath.includes('/news/') && !targetPath.includes('#')) {
                              targetPath = '/student#' + targetPath.replace('/student/', '');
                            } else if (targetPath.startsWith('/teacher/') && !['/teacher/test', '/teacher/finance', '/teacher/inbox', '/teacher/profile', '/teacher/news'].includes(targetPath) && !targetPath.includes('/news/') && !targetPath.includes('#')) {
                              targetPath = '/teacher#' + targetPath.replace('/teacher/', '');
                            }

                            // /teacher?evaluationId=… → mở popup thay vì chỉ về trang chủ
                            if (role === 'teacher' && String(targetPath).includes('evaluationId=')) {
                              openTeacherRatingDetail({ path: targetPath, payload: n.payload });
                            } else {
                              if (role === 'student' && String(n.type).toLowerCase() === 'exam' && n.payload?.quizId) {
                                targetPath = '/student/exam';
                              }
                              navigate(targetPath);
                            }
                          }
                          setShowNotif(false);
                        }}
                        className={`px-4 py-3 hover:bg-slate-50 active:bg-slate-50 transition-colors duration-200 cursor-pointer flex gap-3 border-l-[3px] min-w-0 ${!n.read ? `bg-white ${style.border.replace('border-', 'border-l-')}` : 'bg-white border-l-transparent opacity-80'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 relative ${style.bg} ${style.color}`}>
                          <Icon size={18} aria-hidden="true" />
                          {!n.read && (
                            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-red-500" aria-hidden="true" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className={`text-[11px] font-semibold ${style.color}`}>{style.label}</span>
                            <span className="text-[11px] text-slate-400 font-medium flex-shrink-0">{formatTime(n.time || n.createdAt || n.timestamp)}</span>
                          </div>
                          {n.title && <h4 className={`text-sm font-semibold mb-0.5 break-anywhere ${!n.read ? 'text-slate-900' : 'text-slate-600'}`}>{n.title}</h4>}
                          <p className={`text-[13px] leading-snug break-anywhere ${!n.read && !n.title ? 'text-slate-900 font-semibold' : !n.read ? 'text-slate-700' : 'text-slate-500'}`}>
                            {formatNotificationStudentMask(n.text || n.message || n.content, students, role !== 'teacher')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2 flex-shrink-0">
              <button type="button" onClick={() => markNotificationRead()} className="text-[12px] font-semibold text-slate-500 hover:text-red-600 transition-colors duration-200">Đọc tất cả</button>
              <button
                type="button"
                onClick={() => {
                  setShowNotif(false);
                  const base = role === 'teacher' ? '/teacher' : role === 'student' ? '/student' : '/admin';
                  navigate(`${base}/notifications`);
                }}
                className="text-[12px] font-semibold text-red-600 hover:underline"
              >
                Xem tất cả
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      <ChangePasswordModal session={session} role={role} />

      {(ratingDetailLoading || ratingDetail || ratingDetailError) && role === 'teacher' ? (
        <TeacherRatingDetailModal
          rating={ratingDetail}
          loading={ratingDetailLoading}
          error={ratingDetailError}
          students={students}
          criteriaConfig={RATING_CRITERIA}
          onClose={() => {
            setRatingDetail(null);
            setRatingDetailError('');
            setRatingDetailLoading(false);
          }}
        />
      ) : null}
      {adminQuickPopup && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 flex items-center gap-2 text-base">
                {adminQuickPopup.type === 'register' ? '🎉 Học viên mới đăng ký' : '📋 Điểm danh buổi học'}
              </h3>
              <button type="button" onClick={() => setAdminQuickPopup(null)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4 text-sm font-medium">
              {adminQuickPopup.type === 'register' ? (
                <>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Cơ sở:</span>
                    <span className="font-black text-slate-800">{adminQuickPopup.student.branchId?.name || adminQuickPopup.student.branchCode || adminQuickPopup.student.createdByBranch || 'Không rõ'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Học viên:</span>
                    <span className="font-bold text-slate-800">{adminQuickPopup.student.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Môn học:</span>
                    <span className="font-bold text-blue-700">{adminQuickPopup.student.course}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Thời gian:</span>
                    <span className="font-bold text-slate-800">{formatTime(adminQuickPopup.notif.time || adminQuickPopup.notif.createdAt)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">SĐT:</span>
                    <span className="font-bold text-slate-800">{adminQuickPopup.student.phone || adminQuickPopup.student.zalo || 'Không có'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Thanh toán:</span>
                    <span className="font-bold text-emerald-600">{adminQuickPopup.student.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Người lập phiếu:</span>
                    <span className="font-bold text-slate-800">
                      {adminQuickPopup.notif.payload?.creatorName 
                        ? `${adminQuickPopup.notif.payload.creatorName} (${adminQuickPopup.notif.payload.creatorRole})` 
                        : 'Hệ thống'}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Học viên:</span>
                    <span className="font-bold text-slate-800">{adminQuickPopup.student.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Môn học:</span>
                    <span className="font-bold text-blue-700">{adminQuickPopup.notif.payload?.course || adminQuickPopup.student.course}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Giảng viên:</span>
                    <span className="font-bold text-slate-800">{adminQuickPopup.notif.payload?.teacherName || 'Không rõ'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Tiến độ:</span>
                    <span className="font-black text-emerald-600">Buổi {adminQuickPopup.notif.payload?.completedSessions || '?'} / {adminQuickPopup.notif.payload?.totalRequired || '?'}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Thời gian:</span>
                    <span className="font-bold text-slate-800">{formatTime(adminQuickPopup.notif.time || adminQuickPopup.notif.createdAt)}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">SĐT Học viên:</span>
                    <span className="font-bold text-slate-800">{adminQuickPopup.student.phone || adminQuickPopup.student.zalo || 'Không có'}</span>
                  </div>
                </>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setAdminQuickPopup(null)}
                className="flex-1 py-2.5 rounded-xl font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  setAdminQuickPopup(null);
                  if (adminQuickPopup.type === 'register') {
                    navigate(`/admin#students?studentId=${adminQuickPopup.student._id || adminQuickPopup.student.id}`);
                  } else {
                    navigate(`/admin#students?studentId=${adminQuickPopup.student._id || adminQuickPopup.student.id}&tab=attendance`);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition"
              >
                Xem chi tiết
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Chat nổi toàn site — mặc định hỗ trợ online, nhiều tab kiểu Facebook */}
      <FloatingMessenger session={session} role={role} />
    </div>
    </FloatingMessengerProvider>
  );
};

const ChangePasswordModal = ({ session, role }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [oldPassword, setOldPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
      setSuccess(false);
    };
    window.addEventListener('open-change-password-modal', handleOpen);
    return () => window.removeEventListener('open-change-password-modal', handleOpen);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isFirst = session?.isFirstLogin === true;
    if ((!isFirst && !oldPassword) || !newPassword || !confirmPassword) return setError('Vui lòng nhập đầy đủ thông tin.');
    if (newPassword !== confirmPassword) return setError('Mật khẩu mới không khớp.');
    if (newPassword.length < 6) return setError('Mật khẩu mới phải có ít nhất 6 ký tự.');

    setLoading(true); setError('');
    try {
      const res = await api.auth.changePassword(oldPassword, newPassword);
      if (res.success) {
        setSuccess(true);
        // Cập nhật lại session local storage nếu là first login
        if (session?.isFirstLogin === true) {
           const key = `${role}_user`;
           try {
             const stored = JSON.parse(localStorage.getItem(key) || '{}');
             localStorage.setItem(key, JSON.stringify({ ...stored, isFirstLogin: false }));
             // Dispatch event để App.jsx biết session đã thay đổi (nếu cần)
             window.dispatchEvent(new Event('storage'));
           } catch {}
        }
        setTimeout(() => setIsOpen(false), 2000);
      } else {
        setError(res.message || 'Lỗi khi đổi mật khẩu.');
      }
    } catch {
      setError('Lỗi kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cms-modal-shell" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
      <div className="cms-modal-panel max-w-sm">
        <div className="bg-gradient-to-r from-red-600 to-red-600 px-6 py-5 flex items-center justify-between">
          <h3 id="change-password-title" className="text-white font-black text-lg flex items-center gap-2">
            <Lock size={20} aria-hidden="true" /> {session?.isFirstLogin === true ? 'Tạo mật khẩu cá nhân' : 'Đổi mật khẩu'}
          </h3>
          <button type="button" onClick={() => setIsOpen(false)} aria-label="Đóng" className="text-white/80 hover:text-white transition"><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="p-6">
          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={32} className="text-emerald-600" aria-hidden="true" />
              </div>
              <p className="font-bold text-gray-800 text-lg">Đổi mật khẩu thành công!</p>
              <p className="text-gray-600 text-sm mt-1">Sử dụng mật khẩu mới cho lần đăng nhập sau.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div role="alert" className="bg-red-50 text-red-700 text-xs font-bold p-3 rounded-xl border border-red-100">{error}</div>}
              {session?.isFirstLogin !== true && (
                <div>
                  <label htmlFor="cms-old-password" className="text-xs font-bold text-slate-600 uppercase block mb-1">Mật khẩu hiện tại</label>
                  <input id="cms-old-password" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} autoComplete="current-password"
                    className="input-field" />
                </div>
              )}
              <div>
                <label htmlFor="cms-new-password" className="text-xs font-bold text-slate-600 uppercase block mb-1">Mật khẩu mới</label>
                <input id="cms-new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password"
                  className="input-field" />
              </div>
              <div>
                <label htmlFor="cms-confirm-password" className="text-xs font-bold text-slate-600 uppercase block mb-1">Nhập lại mật khẩu mới</label>
                <input id="cms-confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password"
                  className="input-field" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full btn-primary-blue py-3">
                {loading ? 'Đang xử lý...' : 'Xác nhận đổi'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;




