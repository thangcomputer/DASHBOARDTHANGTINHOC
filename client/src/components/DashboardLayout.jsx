import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import BranchFilterDropdown from './BranchFilterDropdown';
import { LmsGuideHost } from './LmsGuideTour';
import FloatingMessenger from './FloatingMessenger';
import { FloatingMessengerProvider } from '../context/FloatingMessengerContext';
import { useData } from '../context/DataContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../utils/toast';
import api, { setTokens, csrfFetch } from '../services/api';
import { 
  Bell, LogOut, CheckCircle2, Clock, X, Lock, MoreVertical,
  Calendar, DollarSign, UserPlus, Zap, BookOpen, Award,
} from 'lucide-react';

import { formatNotificationStudentMask } from '../utils/studentMask';
import { getMessagingRole } from '../lib/messagingRoles';

const PAGE_TITLES = {
  dashboard: 'Tổng quan',
  students: 'Học viên',
  teachers: 'Giảng viên',
  evaluations: 'Đánh giá',
  finance: 'Tài chính',
  training: 'Đào tạo GV',
  'student-training': 'Đào tạo HV',
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
  if (pathname.includes('/test')) return 'Bài test';
  if (pathname.includes('/finance')) return 'Tài chính';
  if (role === 'admin') return 'Quản trị';
  if (role === 'teacher') return 'Giảng dạy';
  return 'Học tập';
}

const getNotifStyle = (type) => {
  switch (type) {
    case 'finance':  return { icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', label: 'Tài chính' };
    case 'student':  
    case 'COURSE':   return { icon: UserPlus,   color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100',    label: 'Khóa học' };
    case 'SCHEDULE':
    case 'schedule': return { icon: Calendar,   color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-100',  label: 'Lịch dạy' };
    case 'EXAM':     return { icon: Award,      color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-100',  label: 'Thi' };
    case 'admin':    return { icon: Zap,        color: 'text-red-600',     bg: 'bg-red-50',     border: 'border-red-100',     label: 'Admin' };
    case 'news':     return { icon: Bell,       color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-100',    label: 'Tin tức' };
    case 'training': return { icon: BookOpen,   color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-100',  label: 'Đào tạo' };
    case 'grade':    return { icon: Award,      color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-100',  label: 'Đánh giá' };
    default:         return { icon: Bell,       color: 'text-gray-600',    bg: 'bg-gray-50',    border: 'border-gray-100',    label: 'Thông báo' };
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
  const { socket } = useSocket() || {};
  const { students, teachers, isRefetching, triggerBackgroundSync, notifications: allNotifications, markNotificationRead } = useData();
  const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || "");
  const myId = String(session?.id || session?._id || '');

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

  // Admin/staff lần đầu: mở đổi MK ngay.
  // HV/GV: chờ hoàn thành hướng dẫn (LmsGuideHost) rồi mới mở.
  useEffect(() => {
    if (session?.isFirstLogin !== true) return;
    if (role === 'student' || role === 'teacher') return;
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('open-change-password-modal'));
    }, 500);
    return () => clearTimeout(timer);
  }, [session?.isFirstLogin, role]);

  const handleLogout = () => onLogout?.();

  const [showNotif, setShowNotif] = React.useState(false);
  const [notifLimit, setNotifLimit] = React.useState(5);
  const notifRef = React.useRef(null);
  const bellRef = React.useRef(null);

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
      const recs = n.receivers;
      const isAdminRole = role === 'admin' || role === 'staff';
      if (recs.includes('ALL_ADMIN') && !isAdminRole) return false;
      if (recs.includes('ALL_TEACHER') && role !== 'teacher') return false;
      if (recs.includes('ALL_STUDENT') && role !== 'student') return false;

      const isForMe = (myId && recs.includes(myId)) ||
                      recs.includes(role) ||
                      (isAdminRole && recs.includes('ALL_ADMIN')) ||
                      (role === 'teacher' && recs.includes('ALL_TEACHER')) ||
                      (role === 'student' && recs.includes('ALL_STUDENT')) ||
                      recs.includes('GLOBAL') ||
                      recs.includes('ALL');
      if (!isForMe) return false;
    }
    return ((myId && String(n.userId) === myId) || !n.userId) && 
           (n.role === role || !n.role);
  }).sort((a, b) => new Date(b.time || Date.now()) - new Date(a.time || Date.now()));


  const unreadCount = myNotifications.filter(n => !n.read).length;

  useEffect(() => {
    triggerBackgroundSync();
  }, [triggerBackgroundSync]);

  const displayName = role === 'teacher'
    ? (currentTeacher?.name && !/^\d+$/.test(currentTeacher.name)
        ? currentTeacher.name
        : currentTeacher?.email || currentTeacher?.phone || session?.name || 'Giảng viên')
    : (session?.name || 'Admin');
  const pageTitle = resolvePageTitle(role, location.pathname, location.hash);
  const adminHash = (location.hash || '').replace('#', '') || (location.pathname === '/admin' ? 'dashboard' : '');
  const isStudentsTab = adminHash === 'students';
  const isInboxPage = location.pathname.includes('/inbox');
  const isBiPage = location.pathname.includes('/bi');
  const isImmersivePage =
    isInboxPage || isBiPage || (role === 'teacher' && location.pathname === '/teacher/test');
  const showAdminBranch = role === 'admin';
  const roleLabel = role === 'admin'
    ? (session?.adminRole === 'SUPER_ADMIN' ? 'Super Admin' : session?.adminRole === 'HIGH_ADMIN' ? 'Admin cấp cao' : session?.adminRole === 'SUPPORT' ? 'Chuyên viên Hỗ trợ' : session?.adminRole === 'STAFF' ? 'Staff' : 'admin')
    : role;

  return (
    <FloatingMessengerProvider
      currentUserId={myId}
      currentUserRole={getMessagingRole(session) || role}
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
      />

      <main id="main-content" className="flex-1 min-w-0 flex flex-col h-[100dvh] max-w-full overflow-hidden" tabIndex={-1}>
        <header className={`cms-topbar-glass flex flex-col border-b border-slate-100/80 flex-shrink-0 z-40 safe-pad-top ${
          role === 'teacher' && location.pathname === '/teacher/test' ? 'hidden' : ''
        }`}>
          <div className="h-14 sm:h-16 flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-3 pl-[max(5.5rem,calc(env(safe-area-inset-left,0px)+3.75rem))] sm:pl-[max(6rem,calc(env(safe-area-inset-left,0px)+4.25rem))] md:pl-6 lg:pl-6 pr-2 sm:pr-4 min-w-0">
            <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-3">
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 truncate leading-tight">{pageTitle}</h1>
              {/* Tên user đẩy khỏi nav khi có hamburger (mobile/tablet hẹp); hiện từ md+ */}
              <p className="hidden md:block text-[11px] sm:text-[12px] text-slate-500 truncate leading-none mt-0.5 sm:mt-0">
                <span className="font-medium text-slate-600">{displayName}</span>
                <span className="text-slate-300 mx-1">·</span>
                <span>{roleLabel}</span>
              </p>
            </div>

            <div className="flex items-center flex-nowrap justify-end gap-0.5 sm:gap-2 min-w-0 flex-shrink-0">
              {showAdminBranch && (
                <div className={isStudentsTab ? 'hidden lg:block' : 'hidden md:block'}>
                  <BranchFilterDropdown />
                </div>
              )}

              {(role === 'student' || role === 'teacher') && (
                <LmsGuideHost
                  role={role}
                  userId={session?.id || session?._id || ''}
                  pathname={location.pathname}
                  hash={location.hash}
                  hideButton
                  isFirstLogin={session?.isFirstLogin === true}
                />
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

                {showNotif && (
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
                            {myNotifications.slice(0, notifLimit).map(n => {
                              const style = getNotifStyle(n.type);
                              const Icon = style.icon;
                              return (
                                <div 
                                  key={n.id || n._id} 
                                  onClick={() => { 
                                    markNotificationRead(n.id || n._id); 
                                    if (n.payload?.action === 'RESET_PASSWORD') {
                                      window.dispatchEvent(new CustomEvent('open-reset-pw', { detail: n.payload }));
                                    } else if (n.payload?.action === 'blog_published' && n.payload?.slug) {
                                      const base = role === 'teacher' ? '/teacher' : role === 'student' ? '/student' : '/admin';
                                      navigate(`${base}/news/${n.payload.slug}`);
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
                                      
                                      navigate(targetPath); 
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
                                       {formatNotificationStudentMask(n.text || n.message || n.content, students)}
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
                  </>
                )}
              </div>

              <div className="h-8 w-px bg-slate-100 mx-0.5 hidden md:block" />

              {/* Desktop logout */}
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Đăng xuất"
                className="hidden md:inline-flex h-11 px-3 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors duration-200 items-center gap-1.5"
              >
                <LogOut size={15} aria-hidden="true" />
                <span>Đăng xuất</span>
              </button>

              {/* Mobile overflow: logout */}
              <details className="relative md:hidden">
                <summary
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center list-none cursor-pointer [&::-webkit-details-marker]:hidden"
                  aria-label="Thêm tùy chọn"
                >
                  <MoreVertical size={18} aria-hidden="true" />
                </summary>
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[160px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_6px_20px_rgba(15,23,42,0.08)]">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full min-h-11 px-3 rounded-lg text-left text-sm font-semibold text-slate-800 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <LogOut size={15} aria-hidden="true" /> Đăng xuất
                  </button>
                </div>
              </details>
            </div>
          </div>

          {/* Mobile: branch full-width row (not students — students keeps prior lg-only behavior) */}
          {showAdminBranch && !isStudentsTab && (
            <div className="md:hidden w-full pl-[max(5.5rem,calc(env(safe-area-inset-left,0px)+3.75rem))] sm:pl-[max(6rem,calc(env(safe-area-inset-left,0px)+4.25rem))] pr-3 pb-2.5">
              <BranchFilterDropdown fullWidth />
            </div>
          )}
        </header>

        <div
          className={
            isInboxPage || isBiPage
              // Hộp thư / BI: full-height + padding ngang giống Tài chính
              ? 'flex-1 min-h-0 w-full overflow-hidden flex flex-col px-2.5 py-1.5 sm:px-4 sm:py-3 md:px-6 md:py-4 lg:px-8 lg:py-6 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]'
              : isImmersivePage
                ? 'flex-1 min-h-0 w-full overflow-hidden flex flex-col p-0'
                : role === 'student'
                  ? 'flex-1 min-h-0 px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-4 lg:px-6 lg:py-5 w-full max-w-full overflow-x-hidden overflow-y-auto pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] sm:pb-6'
                  : 'flex-1 min-h-0 px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-4 lg:px-6 lg:py-5 w-full max-w-full overflow-x-hidden overflow-y-auto pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] sm:pb-6'
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

      <ChangePasswordModal session={session} role={role} />

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

  // Đang xem hướng dẫn thì không chồng popup đổi MK lên menu
  React.useEffect(() => {
    const onGuide = (e) => {
      if (e?.detail?.open) setIsOpen(false);
    };
    window.addEventListener('lms-guide-visibility', onGuide);
    return () => window.removeEventListener('lms-guide-visibility', onGuide);
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
