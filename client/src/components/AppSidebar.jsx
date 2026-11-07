import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, Home, BookOpen, Calendar, MessageSquare,
  Trophy, FileText, Download, Video, Bell, LogOut, ChevronDown, ChevronUp,
  GraduationCap, Users, DollarSign, ClipboardList, Pin, PinOff,
  Settings, User, Star, AlertTriangle, Lock, Volume2, VolumeX, BarChart3, HardDrive, Archive, Activity, Sparkles, GitBranch, FormInput, Building2,
  Newspaper, Award, FileBox, Headphones, Link2, WalletCards, KeyRound, Gamepad2, CalendarClock, Ticket,
} from 'lucide-react';
import { PIN_SETTINGS_EVENT } from '../utils/pinLock';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { isSoundMuted, setSoundMuted } from '../utils/sound';
import { PERMISSIONS } from '../constants/permissions';
import { hasLearningAccessEnrollment, isUnpaidTuitionAlertStudent } from '../utils/enrollments';
import { visibleInboxUnread } from '../lib/inboxUnread';
import { useStudentSubscription } from './student/subscription/subscriptionContext';
import FreeFeatureLock, { useFreePortalLock, useFreePortalMenu, FREE_HIDDEN_KEYS } from './student/dailyPractice/FreeFeatureLock';
import { subscriptionShortLabel } from '../utils/subscription';
import EditableAvatar from './EditableAvatar';
import api from '../services/api';

const INBOX_FOOTER_HIDE_MS = 1500;

const MOBILE_NAV_ICON_TONES = {
  schedule: 'border-blue-100/80 from-blue-50 to-white text-blue-600',
  inbox: 'border-violet-100/80 from-violet-50 to-white text-violet-600',
  feed: 'border-amber-100/80 from-amber-50 to-white text-amber-600',
  dashboard: 'border-red-100/80 from-red-50 to-white text-red-600',
  finance: 'border-emerald-100/80 from-emerald-50 to-white text-emerald-600',
  support: 'border-cyan-100/80 from-cyan-50 to-white text-cyan-600',
  profile: 'border-indigo-100/80 from-indigo-50 to-white text-indigo-600',
};

// ─── Cấu hình menu theo role ──────────────────────────────────────────────────
const MENU_CONFIG = {
  student: {
    brand: { label: 'Học viên', color: 'from-[#0D1524] to-[#0D1524]' },
    items: [
      { key: 'dashboard', icon: LayoutDashboard, label: 'Tổng quan', sectionLabel: 'KHÔNG GIAN HỌC TẬP', path: '/student', requiresLearningAccess: true },
      { key: 'daily-practice', icon: Gamepad2, label: 'Luyện tập hằng ngày', path: '/student/daily-practice', requiresLearningAccess: true },
      { key: 'inbox', icon: MessageSquare, label: 'Hộp thư', path: '/student/inbox' },
      { key: 'lesson-practice', icon: BookOpen, label: 'Bài giảng', path: '/student/lesson-practice', altHashes: ['materials-videos'], requiresLearningAccess: true },
      { key: 'schedule', icon: Calendar, label: 'Lịch học', path: '/student', hash: 'schedule', requiresLearningAccess: true },
      { key: 'materials-files', icon: FileBox, label: 'Bài tập và tài nguyên', path: '/student', hash: 'materials-files', altHashes: ['materials-software'], requiresLearningAccess: true },
      { key: 'exam', icon: Trophy, label: 'Phòng thi', path: '/student/exam', requiresLearningAccess: true },
      { key: 'feed', icon: Newspaper, label: 'Bảng tin', sectionLabel: 'THÔNG TIN & HỖ TRỢ', path: '/student/feed' },
      { key: 'news', icon: FileText, label: 'Tin tức', path: '/student/news' },
      { key: 'evaluation', icon: Star, label: 'Đánh giá GV', path: '/student', hash: 'evaluation', requiresLearningAccess: true },
      { key: 'center-info', icon: Building2, label: 'Liên hệ Trung tâm', path: '/student/center-info' },
      { key: 'support', icon: Headphones, label: 'Hỗ trợ', mobileLabel: 'Hỗ trợ', path: '/student/support' },
    ],
    bottomItems: [
      { key: 'profile', icon: User, label: 'Hồ sơ', path: '/student', hash: 'profile' },
      { key: 'logout', icon: LogOut, label: 'Đăng xuất', isLogout: true },
    ],
    accentColor: 'bg-red-600',
    activeClass: 'cms-sidebar-glass__nav-active',
  },
  teacher: {
    brand: { label: 'Giảng viên', color: 'from-[#0D1524] to-[#0D1524]' },
    items: [
      { key: 'dashboard', icon: LayoutDashboard, label: 'Tổng quan', mobileLabel: 'Tổng quan', sectionLabel: 'KHÔNG GIAN LÀM VIỆC', path: '/teacher' },
      { key: 'inbox', icon: MessageSquare, label: 'Hộp thư', mobileLabel: 'Tin nhắn', path: '/teacher/inbox' },
      { key: 'students', icon: Users, label: 'Quản lý học viên', path: '/teacher', hash: 'students' },
      { key: 'schedule', icon: Calendar, label: 'Lịch dạy', sidebarLabel: 'Lịch dạy & điểm danh', mobileLabel: 'Lịch', path: '/teacher', hash: 'schedule' },
      { key: 'assignments', icon: ClipboardList, label: 'Giao bài tập & kiểm tra', sidebarLabel: 'Bài tập & kiểm tra', sectionLabel: 'QUẢN LÝ ĐÀO TẠO', path: '/teacher', hash: 'assignments', altHashes: ['quizzes', 'test'] },
      { key: 'training', icon: BookOpen, label: 'Khóa đào tạo', path: '/teacher', hash: 'training' },
      { key: 'finance', icon: DollarSign, label: 'Tài chính', mobileLabel: 'Tài chính', path: '/teacher/finance' },
      { key: 'feed', icon: Newspaper, label: 'Bảng tin', mobileLabel: 'Bảng tin', sectionLabel: 'THÔNG TIN', path: '/teacher/feed' },
      { key: 'news', icon: FileText, label: 'Tin tức', path: '/teacher/news' },
      { key: 'center-info', icon: Building2, label: 'Thông tin Trung tâm', path: '/teacher/center-info' },
      { key: 'support', icon: Headphones, label: 'Hỗ trợ', mobileLabel: 'Hỗ trợ', path: '/teacher/support' },
    ],
    bottomItems: [
      { key: 'profile', icon: User, label: 'Hồ sơ', mobileLabel: 'Hồ sơ', path: '/teacher', hash: 'profile' },
      { key: 'logout', icon: LogOut, label: 'Đăng xuất', isLogout: true },
    ],
    accentColor: 'bg-red-600',
    activeClass: 'cms-sidebar-glass__nav-active',
  },
  admin: {
    brand: { label: 'Quản trị', color: 'from-[#0D1524] to-[#0D1524]' },
    items: [
      {
        key: 'dashboard', section: 'KHÔNG GIAN LÀM VIỆC', icon: LayoutDashboard, label: 'Tổng quan', path: '/admin', hash: 'dashboard', permission: [
          PERMISSIONS.MANAGE_STUDENTS, PERMISSIONS.VIEW_TEACHERS, PERMISSIONS.MANAGE_SCHEDULE,
          PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.MANAGE_TRAINING, PERMISSIONS.MANAGE_HR,
          PERMISSIONS.SYSTEM_SETTINGS, PERMISSIONS.VIEW_BRANCH_REVENUE
        ]
      },
      { key: 'news', section: 'KHÔNG GIAN LÀM VIỆC', icon: FileText, label: 'Tin tức', path: '/admin/news', permission: [PERMISSIONS.MANAGE_BLOG, PERMISSIONS.MANAGE_MESSAGES] },
      { key: 'feed', section: 'KHÔNG GIAN LÀM VIỆC', icon: Newspaper, label: 'Bảng tin', path: '/admin/feed', permission: [PERMISSIONS.MANAGE_BLOG, PERMISSIONS.MANAGE_MESSAGES] },
      { key: 'inbox', section: 'KHÔNG GIAN LÀM VIỆC', icon: MessageSquare, label: 'Hộp thư', path: '/admin/inbox', permission: PERMISSIONS.MANAGE_MESSAGES },

      { key: 'students', section: 'HỌC VIÊN', icon: Users, label: 'Học viên', path: '/admin', hash: 'students', permission: PERMISSIONS.MANAGE_STUDENTS },
      { key: 'student-training', section: 'HỌC VIÊN', icon: Trophy, label: 'Phòng thi', path: '/admin', hash: 'student-training', permission: PERMISSIONS.MANAGE_STUDENT_TRAINING },
      { key: 'student-resources', section: 'HỌC VIÊN', icon: FileText, label: 'Tài liệu & link phần mềm', path: '/admin', hash: 'student-resources', permission: PERMISSIONS.MANAGE_STUDENT_TRAINING },
      { key: 'lesson-practice', section: 'HỌC VIÊN', icon: BookOpen, label: 'Bài giảng', path: '/admin', hash: 'lesson-practice', permission: PERMISSIONS.MANAGE_STUDENT_TRAINING },
      { key: 'daily-practice', section: 'HỌC VIÊN', icon: Gamepad2, label: 'Luyện tập hằng ngày', path: '/admin', hash: 'daily-practice', permission: PERMISSIONS.MANAGE_STUDENT_TRAINING },
      { key: 'cert-prep', section: 'HỌC VIÊN', icon: Trophy, label: 'Ôn thi MOS/IC3', path: '/admin', hash: 'cert-prep', permission: PERMISSIONS.MANAGE_CERT_PREP },
      { key: 'subscription-codes', section: 'HỌC VIÊN', icon: Ticket, label: 'Mã kích hoạt & gói', path: '/admin', hash: 'subscription-codes', permission: PERMISSIONS.MANAGE_STUDENTS },
      { key: 'meet-classes', section: 'HỌC VIÊN', icon: Video, label: 'Lịch Meet', path: '/admin', hash: 'meet-classes', permission: PERMISSIONS.MANAGE_STUDENTS },

      { key: 'teachers', section: 'GIẢNG VIÊN', icon: GraduationCap, label: 'Giảng viên', path: '/admin', hash: 'teachers', permission: PERMISSIONS.VIEW_TEACHERS },
      { key: 'training-videos', section: 'GIẢNG VIÊN', icon: Video, label: 'Luyện tập', path: '/admin', hash: 'training-videos', permission: PERMISSIONS.MANAGE_TRAINING },
      { key: 'training-guides-evaluations', section: 'GIẢNG VIÊN', icon: FileText, label: 'Quy trình & đánh giá nội bộ', path: '/admin', hash: 'training-guides-evaluations', permission: [PERMISSIONS.MANAGE_TRAINING, PERMISSIONS.VIEW_EVALUATIONS] },
      { key: 'training-resources', section: 'GIẢNG VIÊN', icon: FileText, label: 'Tài liệu & link phần mềm', path: '/admin', hash: 'training-resources', permission: PERMISSIONS.MANAGE_TRAINING },
      { key: 'training-exam-room', section: 'GIẢNG VIÊN', icon: Trophy, label: 'Phòng thi', path: '/admin', hash: 'training-exam-room', permission: PERMISSIONS.MANAGE_TRAINING },

      { key: 'staff', section: 'NHÂN SỰ', icon: Users, label: 'Phân quyền NV', path: '/admin', hash: 'staff', permission: PERMISSIONS.MANAGE_STAFF },
      { key: 'hr', section: 'NHÂN SỰ', icon: ClipboardList, label: 'Nhân sự & Lương', path: '/admin', hash: 'hr', permission: PERMISSIONS.MANAGE_HR },

      { key: 'finance', section: 'TÀI CHÍNH', icon: DollarSign, label: 'Tài chính', path: '/admin', hash: 'finance', permission: PERMISSIONS.MANAGE_FINANCE },
      { key: 'analytics', section: 'TÀI CHÍNH', icon: BarChart3, label: 'Báo cáo doanh thu', path: '/admin', hash: 'analytics', permission: [PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_BRANCH_REVENUE] },
      { key: 'bi', section: 'TÀI CHÍNH', icon: BarChart3, label: 'BI Dashboard', path: '/admin/bi', permission: [PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_BRANCH_REVENUE] },

      {
        key: 'system-group',
        section: 'HỆ THỐNG',
        label: 'Cài đặt & vận hành',
        icon: Settings,
        isGroup: true,
        children: [
          { key: 'settings', icon: Settings, label: 'Cài đặt hệ thống', path: '/admin', hash: 'settings', permission: PERMISSIONS.SYSTEM_SETTINGS },
          { key: 'logs', icon: Lock, label: 'Nhật ký hệ thống', path: '/admin', hash: 'logs', permission: PERMISSIONS.VIEW_LOGS },
          { key: 'files', icon: HardDrive, label: 'Quản lý file', path: '/admin/files', permission: PERMISSIONS.SYSTEM_SETTINGS },
          { key: 'backups', icon: Archive, label: 'Sao lưu dữ liệu', path: '/admin/backups', superAdminOnly: true },
          { key: 'monitoring', icon: Activity, label: 'Monitoring', path: '/admin/monitoring', permission: PERMISSIONS.VIEW_LOGS },
          { key: 'ai', icon: Sparkles, label: 'AI Center', path: '/admin/ai', permission: PERMISSIONS.SYSTEM_SETTINGS },
          { key: 'workflows', icon: GitBranch, label: 'Workflow', path: '/admin/workflows', permission: PERMISSIONS.SYSTEM_SETTINGS },
          { key: 'builder', icon: FormInput, label: 'Form & Report', path: '/admin/builder', permission: PERMISSIONS.SYSTEM_SETTINGS },
          { key: 'tenants', icon: Building2, label: 'Multi-tenant', path: '/admin/tenants', superAdminOnly: true },
        ],
      },
      { key: 'center-info', section: 'HỆ THỐNG', icon: Building2, label: 'Thông tin trung tâm', path: '/admin/center-info' },
    ],
    bottomItems: [
      { key: 'pin-lock', icon: KeyRound, label: 'Khóa mã PIN', isPinLock: true },
      { key: 'logout', icon: LogOut, label: 'Đăng xuất', isLogout: true },
    ],
    accentColor: 'bg-red-600',
    activeClass: 'cms-sidebar-glass__nav-active font-bold',
  },
};

/** Mở 1 nhóm → đóng các sibling cùng cấp */
const SIDEBAR_GROUP_SIBLINGS = {
  'teaching-group': ['news-training-group'],
  'news-training-group': ['teaching-group'],
};

const NESTED_ACTIVE_CLASS = 'cms-sidebar-glass__nav-active font-semibold';

// ─── AppSidebar Component ─────────────────────────────────────────────────────
const AppSidebar = ({
  session,
  role = 'student',
  userName = '',
  userAvatar = '',
  onLogout,
  activeKey,
  onNavigateItem,
  teacherPending = false,
  adminRole = null,       // 'SUPER_ADMIN' | 'STAFF' | null
  userPermissions = [],   // ['manage_students', ...]
  mobileOpen: mobileOpenProp,
  onMobileOpenChange,
  mobileNavVisible = true,
  mobileFooterVisible = true,
  onBrandLogoChange,
}) => {
  const PINNED_MENU_KEY = 'cms_sidebar_pinned';
  const LAPTOP_MQ = '(min-width: 992px)';
  const TABLET_MQ = '(min-width: 768px)';
  const [mobileOpenInternal, setMobileOpenInternal] = useState(false);
  const isMobileNavControlled = typeof onMobileOpenChange === 'function';
  const mobileOpen = isMobileNavControlled ? Boolean(mobileOpenProp) : mobileOpenInternal;
  const [isLaptopOrLarger, setIsLaptopOrLarger] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(LAPTOP_MQ).matches
  ));
  const [isTabletOrLarger, setIsTabletOrLarger] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(TABLET_MQ).matches
  ));
  const [menuPinned, setMenuPinned] = useState(() => {
    try {
      return localStorage.getItem(PINNED_MENU_KEY) !== '0';
    } catch {
      return true;
    }
  });
  const pinnedSidebarVisible = isLaptopOrLarger && menuPinned;
  const setMobileOpen = (next) => {
    const value = typeof next === 'function' ? next(mobileOpen) : next;
    if (isMobileNavControlled) onMobileOpenChange(value);
    else setMobileOpenInternal(value);
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia(LAPTOP_MQ);
    const syncViewport = () => setIsLaptopOrLarger(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(TABLET_MQ);
    const syncViewport = () => setIsTabletOrLarger(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);
    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('cms-sidebar-pinned', pinnedSidebarVisible);
    return () => document.documentElement.classList.remove('cms-sidebar-pinned');
  }, [pinnedSidebarVisible]);

  const toggleMenuPin = () => {
    const nextPinned = !menuPinned;
    setMenuPinned(nextPinned);
    try {
      localStorage.setItem(PINNED_MENU_KEY, nextPinned ? '1' : '0');
    } catch { /* ignore unavailable storage */ }
    if (nextPinned) setMobileOpen(false);
  };
  const navigate = useNavigate();
  const location = useLocation();
  const isInboxRoute = location.pathname.includes('/inbox');
  const [inboxFooterOpen, setInboxFooterOpen] = useState(false);
  const inboxFooterTimerRef = useRef(null);
  const footerShown = mobileFooterVisible && (!isInboxRoute || inboxFooterOpen);
  const keepInboxFooter = () => {
    window.clearTimeout(inboxFooterTimerRef.current);
  };
  const scheduleInboxFooterHide = () => {
    window.clearTimeout(inboxFooterTimerRef.current);
    inboxFooterTimerRef.current = window.setTimeout(() => setInboxFooterOpen(false), INBOX_FOOTER_HIDE_MS);
  };
  const revealInboxFooter = () => {
    setInboxFooterOpen(true);
    scheduleInboxFooterHide();
  };
  useEffect(() => {
    setInboxFooterOpen(false);
    return () => window.clearTimeout(inboxFooterTimerRef.current);
  }, [isInboxRoute]);

  const [openGroups, setOpenGroups] = useState(() => {
    const defaults = {
      'system-group': false,
      'exam-group': false,
      'schedule-materials-group': false,
      'teaching-group': false,
      'news-training-group': false,
      // legacy keys (localStorage cũ)
      'people-group': false,
      'training-group': false,
    };
    try {
      const saved = localStorage.getItem('cms_sidebar_groups');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });
  const {
    students, teachers, staffs, getPrivateEvaluationsForAdmin, getConversations,
  } = useData();
  const studentSubscription = useStudentSubscription();

  // Session login/me có thể thiếu gender → bổ sung từ hồ sơ self (mọi role)
  const selfProfile = useMemo(() => {
    if (!session) return null;
    const sid = String(session.id || session._id || '');
    if (!sid || sid === 'admin') return null;
    const pools = [
      ...(Array.isArray(students) ? students : []),
      ...(Array.isArray(teachers) ? teachers : []),
      ...(Array.isArray(staffs) ? staffs : []),
    ];
    return pools.find((p) => String(p?.id || p?._id) === sid) || null;
  }, [session, students, teachers, staffs]);

  const effectiveGender = session?.gender || selfProfile?.gender || '';
  const effectiveAvatar = session?.avatar || selfProfile?.avatar || userAvatar || '';

  const sessionStorageKey = (() => {
    if (!session) return null;
    if (session.adminRole === 'STAFF' || session.role === 'staff') return 'staff_user';
    return `${session.role || 'admin'}_user`;
  })();

  // Persist: giữ gender session nếu đã có; chỉ bổ sung từ self khi session thiếu
  useEffect(() => {
    if (!session || !sessionStorageKey) return;
    const nextGender = selfProfile?.gender || session.gender || '';
    const nextAvatar = selfProfile?.avatar || session.avatar || '';
    if (!nextGender && !nextAvatar) return;
    if ((session.gender || '') === (nextGender || '') && (session.avatar || '') === (nextAvatar || '')) return;
    const patched = {
      ...session,
      gender: nextGender || '',
      avatar: nextAvatar || session.avatar || '',
    };
    try {
      localStorage.setItem(sessionStorageKey, JSON.stringify(patched));
      window.dispatchEvent(new CustomEvent('cms:session-patched', { detail: patched }));
    } catch { /* ignore */ }
  }, [session, selfProfile, sessionStorageKey]);

  // Fallback: /me + teachers/staff profile khi thiếu gender (SUPPORT/HIGH/GV)
  useEffect(() => {
    if (!session || session.gender || !sessionStorageKey) return;
    const sid = session.id || session._id;
    if (!sid || sid === 'admin') return;
    let cancelled = false;
    const snap = session;
    (async () => {
      try {
        let g = '';
        let a = '';
        let res = null;

        try {
          res = await api.auth.me();
        } catch { /* ignore */ }
        if (res?.success && res.data) {
          if (Object.prototype.hasOwnProperty.call(res.data, 'gender') && res.data.gender) {
            g = res.data.gender;
          }
          if (res.data.avatar) a = res.data.avatar;
        }

        if (!g && role !== 'student') {
          try {
            const tRes = await api.teachers.getById(sid);
            if (tRes?.success && tRes.data) {
              if (tRes.data.gender) g = tRes.data.gender;
              if (!a && tRes.data.avatar) a = tRes.data.avatar;
            }
          } catch { /* ignore */ }
        }

        // Teacher không có quyền /api/staff — chỉ thử khi admin/staff (tránh 403 ồn console)
        if (!g && role !== 'student' && role !== 'teacher') {
          try {
            const sRes = await api.staff.getAll();
            const list = Array.isArray(sRes?.data) ? sRes.data : [];
            const self = list.find((x) => String(x.id || x._id) === String(sid));
            if (self?.gender) g = self.gender;
            if (!a && self?.avatar) a = self.avatar;
          } catch { /* ignore */ }
        }

        if (!g && role === 'student') {
          try {
            const st = await api.students.getById(sid);
            if (st?.success && st.data?.gender) g = st.data.gender;
            if (!a && st?.data?.avatar) a = st.data.avatar;
          } catch { /* ignore */ }
        }

        if (cancelled || (!g && !a)) return;
        const patched = {
          ...snap,
          ...(res?.data || {}),
          gender: g || snap.gender || '',
          avatar: a || snap.avatar || '',
        };
        localStorage.setItem(sessionStorageKey, JSON.stringify(patched));
        window.dispatchEvent(new CustomEvent('cms:session-patched', { detail: patched }));
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when identity/gender key changes
  }, [session?.id, session?.gender, sessionStorageKey, role]);

  const [freeLockOpen, setFreeLockOpen] = useState(false);
  const [muted, setMutedState] = useState(() => isSoundMuted());
  const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || "");

  useEffect(() => {
    if (!mobileOpen) {
      document.documentElement.classList.remove('cms-menu-open');
      document.body.classList.remove('cms-menu-open');
      return;
    }
    document.documentElement.classList.add('cms-menu-open');
    document.body.classList.add('cms-menu-open');
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.documentElement.classList.remove('cms-menu-open');
      document.body.classList.remove('cms-menu-open');
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  // Fetch dynamic logo from web settings
  useEffect(() => {
    fetch(`${API}/api/settings/web`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data?.logoUrl) {
          const url = res.data.logoUrl;
          const resolvedLogo = url.startsWith('http') ? url : `${API}${url}`;
          onBrandLogoChange?.(resolvedLogo);
        }
      })
      .catch(() => { });
  }, [API, onBrandLogoChange]);

  const handleToggleMute = () => {
    const newState = !muted;
    setSoundMuted(newState);
    setMutedState(newState);
  };

  const config = MENU_CONFIG[role] || MENU_CONFIG.student;
  const mobilePrimaryKeys = role === 'teacher'
    ? ['schedule', 'inbox', 'feed', 'dashboard', 'finance', 'support', 'profile']
    : role === 'admin' || role === 'staff'
      ? ['students', 'finance', 'dashboard', 'inbox', 'feed']
      : ['schedule', 'inbox', 'dashboard', 'feed', 'support', 'lesson-practice', 'profile'];

  const studentHasLearningAccess = (() => {
    if (role !== 'student') return true;
    const sid = session?.id || session?._id;
    if (!sid || !Array.isArray(students)) return false;
    const me = students.find((s) => String(s?.id || s?._id) === String(sid));
    return hasLearningAccessEnrollment(me);
  })();

  const freeMenu = useFreePortalMenu(session);
  const freeLocked = useFreePortalLock(session) && freeMenu;
  const freeLockKeys = new Set(['inbox', 'materials-files', 'exam', 'support']);
  const itemFreeLocked = (item) => freeLocked && freeLockKeys.has(item?.key);

  const canSeeItem = (item) => {
    if (role === 'student' && freeMenu && FREE_HIDDEN_KEYS.has(item.key)) return false;
    if (role === 'student' && item.requiresLearningAccess && !studentHasLearningAccess) return false;
    if (role !== 'admin' && role !== 'staff') return true;
    if (session?.id === 'admin' || adminRole === 'SUPER_ADMIN') return true;
    // HIGH_ADMIN: check permissions (không bypass toàn quyền)
    if (adminRole === 'HIGH_ADMIN') {
      if (item.superAdminOnly) return false;
      if (!item.permission) return true;
      // Nhật ký thêm/xóa/tài chính/đổi TT HV–GV: luôn hiện cho HIGH_ADMIN
      const wantsLogs = item.permission === PERMISSIONS.VIEW_LOGS
        || (Array.isArray(item.permission) && item.permission.includes(PERMISSIONS.VIEW_LOGS));
      if (wantsLogs) return true;
      if (Array.isArray(item.permission)) {
        return item.permission.some((p) => userPermissions.includes(p));
      }
      return userPermissions.includes(item.permission);
    }
    if (item.superAdminOnly) return false;
    if (!item.permission) return true;
    if (Array.isArray(item.permission)) {
      return item.permission.some((p) => userPermissions.includes(p));
    }
    return userPermissions.includes(item.permission);
  };

  // ── Filter menu theo permissions (RBAC) — đệ quy nhóm 3 cấp ─────────────────
  const filterItems = (items) => {
    return (items || [])
      .map((item) => {
        if (item.isGroup && Array.isArray(item.children)) {
          const children = filterItems(item.children);
          if (children.length === 0) return null;
          return { ...item, children };
        }
        return canSeeItem(item) ? item : null;
      })
      .filter(Boolean);
  };

  const itemOrDescendantActive = (node) => {
    if (!node) return false;
    if (node.isGroup && Array.isArray(node.children)) {
      return node.children.some((c) => itemOrDescendantActive(c));
    }
    return isActive(node);
  };

  const collectGroupBadge = (nodes) => (nodes || []).reduce((sum, c) => {
    if (c.isGroup && Array.isArray(c.children)) return sum + collectGroupBadge(c.children);
    return sum + getBadgeCount(c.key);
  }, 0);

  const flattenLeaves = (nodes) => {
    const out = [];
    (nodes || []).forEach((n) => {
      if (n.isGroup && Array.isArray(n.children)) out.push(...flattenLeaves(n.children));
      else out.push(n);
    });
    return out;
  };
  const flatVisibleItems = flattenLeaves(filterItems(config.items));
  const mobileItems = [
    ...flatVisibleItems,
    ...(config.bottomItems || []).filter((item) => item.key === 'profile'),
  ];
  const visibleMobileNavItems = mobilePrimaryKeys
    .map((key) => mobileItems.find((item) => item.key === key))
    .filter(Boolean);
  const mobileHomeItem = visibleMobileNavItems.find((item) => item.key === 'dashboard');
  const mobileOtherItems = visibleMobileNavItems.filter((item) => item.key !== 'dashboard');
  const mobileHomeIndex = Math.ceil(mobileOtherItems.length / 2);
  const mobileNavItems = mobileNavVisible
    ? mobileHomeItem
      ? [
        ...mobileOtherItems.slice(0, mobileHomeIndex),
        mobileHomeItem,
        ...mobileOtherItems.slice(mobileHomeIndex),
      ]
      : visibleMobileNavItems
    : [];

  const persistOpenGroups = (next) => {
    try { localStorage.setItem('cms_sidebar_groups', JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  };

  const toggleGroup = (groupKey) => {
    setOpenGroups((prev) => {
      const opening = !prev[groupKey];
      const next = { ...prev, [groupKey]: opening };
      if (opening) {
        (SIDEBAR_GROUP_SIBLINGS[groupKey] || []).forEach((sib) => {
          next[sib] = false;
        });
      }
      return persistOpenGroups(next);
    });
  };

  const getBadgeCount = (itemKey) => {
    if (itemKey === 'inbox' && session?.id) {
      try {
        return visibleInboxUnread(getConversations(session.id), {
          userId: session.id,
          adminRole: role === 'admin' ? (adminRole || session?.adminRole || '') : '',
        });
      } catch {
        return 0;
      }
    }
    if (role === 'admin') {
      if (itemKey === 'students') {
        return (students || []).filter((s) => isUnpaidTuitionAlertStudent(s)).length;
      }
      if (itemKey === 'teachers') {
        return (teachers || []).filter(t => {
          if (!t) return false;
          const s = String(t.status || '').toLowerCase();
          const p = String(t.practicalStatus || '').toLowerCase();
          return s === 'pending' || p === 'pending' || p === 'submitted';
        }).length;
      }
      if (itemKey === 'evaluations') {
        return (getPrivateEvaluationsForAdmin?.() || []).filter(e => !e.read).length;
      }
    }
    return 0;
  };

  const handleClick = (item) => {
    if (itemFreeLocked(item)) {
      setFreeLockOpen(true);
      setMobileOpen(false);
      return;
    }
    if (item.key === 'support') {
      navigate(item.path);
      setMobileOpen(false);
      return;
    }
    if (item.isLogout) { onLogout?.(); return; }
    if (item.isChangePassword) {
      window.dispatchEvent(new CustomEvent('open-change-password-modal'));
      setMobileOpen(false);
      return;
    }
    if (item.isPinLock) {
      window.dispatchEvent(new CustomEvent(PIN_SETTINGS_EVENT));
      setMobileOpen(false);
      return;
    }
    if (onNavigateItem) { onNavigateItem(item); setMobileOpen(false); return; }
    // Navigate with hash if present (e.g. /teacher#students)
    const target = item.hash ? `${item.path}#${item.hash}` : item.path;
    navigate(target);
    setMobileOpen(false);
  };

  const isActive = (item) => {
    if (activeKey) return item.key === activeKey;
    // Hash có thể kèm query: #students?studentId=… → chỉ lấy phần tab
    const currentHash = (location.hash?.replace('#', '') || '').split(/[?#]/)[0];

    // Item has a hash → active when path matches AND (hash khớp, hoặc hash rỗng với tab mặc định dashboard)
    if (item.hash) {
      if (location.pathname !== item.path) return false;
      if (currentHash === item.hash || item.altHashes?.includes(currentHash)) return true;
      // /admin không hash = Tổng quan (dashboard)
      if (!currentHash && item.hash === 'dashboard' && item.path === '/admin') return true;
      return false;
    }
    if (
      role === 'teacher'
      && item.key === 'dashboard'
      && location.pathname === '/teacher'
      && currentHash === 'software-links'
    ) return true;
    // Base dashboard (Tổng quan) — chỉ active đúng path gốc, không active trên /student/feed, /teacher/finance…
    const basePaths = ['/student', '/teacher', '/admin'];
    if (basePaths.includes(item.path)) {
      return location.pathname === item.path && !currentHash;
    }
    // Tin tức + slug chi tiết
    if (item.path?.endsWith('/news')) {
      const onNews = location.pathname === item.path
        || location.pathname.startsWith(`${item.path}/`);
      return onNews && !currentHash;
    }
    // Phòng thi + môn thi fullscreen
    if (item.path?.endsWith('/exam')) {
      const onExam = location.pathname === item.path
        || location.pathname.startsWith(`${item.path}/`);
      return onExam && !currentHash;
    }
    if (item.altHashes?.includes(currentHash) && location.pathname === '/student') return true;
    if (item.path?.endsWith('/cert-prep') || item.path?.endsWith('/lesson-practice')) {
      const onSection = location.pathname === item.path
        || location.pathname.startsWith(`${item.path}/`);
      return onSection && !currentHash;
    }
    // Các trang lá khác: khớp path tuyệt đối
    return location.pathname === item.path && !currentHash;
  };

  // Điều hướng → mở exclusive nhóm/hub chứa trang active
  useEffect(() => {
    // This route-driven synchronization must update the persisted menu state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenGroups((prev) => {
      const next = { ...prev };
      let changed = false;
      const activateExclusive = (key) => {
        if (!next[key]) {
          next[key] = true;
          changed = true;
        }
        (SIDEBAR_GROUP_SIBLINGS[key] || []).forEach((sib) => {
          if (next[sib]) {
            next[sib] = false;
            changed = true;
          }
        });
      };
      const walk = (nodes) => {
        (nodes || []).forEach((n) => {
          if (!n?.isGroup || !Array.isArray(n.children)) return;
          if (itemOrDescendantActive(n)) {
            activateExclusive(n.key);
            walk(n.children);
          }
        });
      };
      walk(filterItems(config.items));
      if (!changed) return prev;
      return persistOpenGroups(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.hash, role]);

  // Trả về element (không khai báo component con) — tránh unmount/remount mỗi lần data refresh → sidebar nhảy cuộn
  const renderSidebarContent = () => (
    <div className="cms-sidebar-glass__content flex flex-col h-full text-white overflow-x-hidden">

      {/* ── User info ── */}
      <div className="cms-sidebar-glass__profile mx-4 mt-2 mb-2 rounded-[20px] border border-slate-400/15 bg-[#151F30] p-3">
        <div className="flex items-center gap-3">
          <EditableAvatar
            avatar={effectiveAvatar}
            name={userName}
            role={role}
            adminRole={session?.adminRole}
            gender={effectiveGender}
            className="w-[46px] h-[46px] rounded-full border-2 border-white/15 bg-slate-700 shadow-sm flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-slate-50 font-extrabold text-sm truncate">{userName || 'Người dùng'}</p>
            <p className="mt-1 inline-flex rounded-full bg-blue-400/10 px-2 py-0.5 text-blue-300 text-[10px] font-bold tracking-wide">
              {(() => {
                if (role === 'teacher') return 'GIẢNG VIÊN';
                if (role === 'student') return 'HỌC VIÊN';
                if (session?.id === 'admin' || session?.adminRole === 'SUPER_ADMIN') return 'QUẢN TRỊ';
                if (session?.adminRole === 'HIGH_ADMIN') return 'ADMIN CẤP CAO';
                if (session?.adminRole === 'SUPPORT') return 'CHUYÊN VIÊN HỖ TRỢ';
                const perms = Array.isArray(session?.permissions) ? session.permissions : [];
                if (perms.length === 1 && perms.includes('manage_messages')) {
                  return 'CHUYÊN VIÊN HỖ TRỢ';
                }
                return 'ADMIN-STAFF';
              })()}
            </p>
          </div>
        </div>
        {role === 'student' && studentSubscription?.subscription && (
          <div
            className={`mt-2.5 flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-[11px] font-bold ${
              studentSubscription.subscription.state === 'expiring'
                ? 'bg-amber-400/15 text-amber-200'
                : 'bg-white/5 text-slate-300'
            }`}
          >
            <CalendarClock size={13} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{subscriptionShortLabel(studentSubscription.subscription, { freePortal: session?.freePortal === true })}</span>
            {studentSubscription.subscription.state !== 'lifetime' && (
              <button
                type="button"
                onClick={studentSubscription.openRenew}
                className="shrink-0 rounded-lg bg-red-600 px-2 py-0.5 text-[10px] font-black text-white transition hover:bg-red-500 !shadow-none"
              >
                Gia hạn
              </button>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 px-4 py-1.5 space-y-0 overflow-y-auto overflow-x-hidden overscroll-contain" aria-label="Menu chính" style={{ overflowAnchor: 'none' }}>
        {filterItems(config.items)
          .filter(item => {
            // Ẩn mục 'Bài Test' khi GV đã được kích hoạt giảng dạy
            if (role === 'teacher' && item.key === 'test' && !teacherPending) return false;
            return true;
          })
          .map((item, index, visibleItems) => {
            // Tiêu đề phần: GV/HV khai báo ở mục đầu; admin theo `section`, hiện khi phần đổi giữa các mục đang hiển thị.
            const sectionHeading = (role === 'teacher' || role === 'student')
              ? item.sectionLabel || ''
              : (item.section && item.section !== visibleItems[index - 1]?.section ? item.section : '');
            const headingEl = sectionHeading ? (
              <div
                className="px-1 pt-3 pb-1 text-[10px] font-black tracking-[0.12em] text-slate-400"
                role="heading"
                aria-level={2}
              >
                {sectionHeading}
              </div>
            ) : null;
            const renderNavButton = (navItem, { nested = false } = {}) => {
              const Icon = navItem.icon;
              const active = isActive(navItem);
              const isLocked = teacherPending && navItem.key !== 'test';
              const showFreeLock = itemFreeLocked(navItem);
              return (
                <div key={navItem.key} className="relative group/nav">
                  <button
                    type="button"
                    onClick={() => !isLocked && handleClick(navItem)}
                    disabled={isLocked}
                    aria-current={active ? 'page' : undefined}
                    title={isLocked ? 'Bạn chưa phải là giáo viên chính thức nên chưa được mở' : undefined}
                    className={`cms-sidebar-glass__nav-item w-full flex items-center gap-3 rounded-[14px] transition-all min-h-11 min-w-0
                    ${nested ? 'px-3 py-1.5 pl-6' : 'px-3 py-1.5'}
                    ${isLocked
                        ? 'text-white/40 cursor-not-allowed'
                        : active
                          ? (nested ? NESTED_ACTIVE_CLASS : config.activeClass)
                          : 'text-[#D5DCE7]'
                      }
                  `}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] transition-colors ${active ? 'bg-red-600' : ''}`}>
                      <Icon size={nested ? 16 : 18} className="flex-shrink-0" aria-hidden="true" />
                    </span>
                    <span className={`font-medium truncate ${nested ? 'text-[13px]' : 'text-sm'}`}>{navItem.sidebarLabel || navItem.label}</span>
                    {isLocked && (
                      <Lock size={13} className="ml-auto text-white/40 flex-shrink-0" aria-hidden="true" />
                    )}
                    {showFreeLock && (
                      <Lock size={13} className="ml-auto text-amber-200 flex-shrink-0" aria-label="Đang khóa" />
                    )}
                    {!isLocked && getBadgeCount(navItem.key) > 0 && (
                      <span className="ml-auto px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-black leading-none drop-shadow-md shadow-red-500/50" aria-label={`${getBadgeCount(navItem.key)} thông báo`}>
                        {getBadgeCount(navItem.key) > 99 ? '99+' : getBadgeCount(navItem.key)}
                      </span>
                    )}
                  </button>
                </div>
              );
            };

            if (item.isGroup && item.children?.length) {
              const GroupIcon = item.icon;
              const childActive = itemOrDescendantActive(item);
              const isOpen = !!openGroups[item.key];
              const groupBadge = collectGroupBadge(item.children);
              const renderMidHub = (hub) => {
                const HubIcon = hub.icon;
                const hubActive = itemOrDescendantActive(hub);
                const hubBadge = collectGroupBadge(hub.children);
                const hubOpen = !!openGroups[hub.key];

                return (
                  <div key={hub.key} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => toggleGroup(hub.key)}
                      aria-expanded={hubOpen}
                      className={`cms-sidebar-glass__nav-item w-full flex items-center gap-3 rounded-[14px] transition-all px-3 py-1.5 pl-6 min-h-11
                      ${hubActive ? 'cms-sidebar-glass__nav-active text-white' : 'text-[#D5DCE7]'}
                    `}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${hubActive ? 'bg-red-600' : ''}`}>
                        <HubIcon size={16} className="flex-shrink-0" aria-hidden="true" />
                      </span>
                      <span className="text-[13px] font-semibold flex-1 text-left truncate">{hub.label}</span>
                      {hubBadge > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-black leading-none">
                          {hubBadge > 99 ? '99+' : hubBadge}
                        </span>
                      )}
                      <ChevronDown
                        size={14}
                        className={`flex-shrink-0 text-white/50 transition-transform ${hubOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>
                    {hubOpen && (
                      <div className="space-y-0.5">
                        {hub.children.map((leaf) => (
                          <div key={leaf.key} className="pl-3">
                            {renderNavButton(leaf, { nested: true })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div key={item.key}>
                  {headingEl}
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.key)}
                    aria-expanded={isOpen}
                    className={`cms-sidebar-glass__nav-item w-full flex items-center gap-3 rounded-[14px] transition-all px-3 py-1.5 min-h-11
                    ${childActive ? 'cms-sidebar-glass__nav-active text-white' : 'text-[#D5DCE7]'}
                  `}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${childActive ? 'bg-red-600' : ''}`}>
                      <GroupIcon size={18} className="flex-shrink-0" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold flex-1 text-left">{item.label}</span>
                    {groupBadge > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-black leading-none">
                        {groupBadge > 99 ? '99+' : groupBadge}
                      </span>
                    )}
                    <ChevronDown
                      size={16}
                      className={`flex-shrink-0 text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <div className="mt-0.5 space-y-0.5">
                      {item.children.map((child) => (
                        child.isGroup && child.children?.length
                          ? renderMidHub(child)
                          : renderNavButton(child, { nested: true })
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={item.key} className="pb-0.5">
                {headingEl}
                {renderNavButton(item)}
              </div>
            );
          })}

      </nav>

      {/* ── Bottom items ── */}
      <div className="cms-sidebar-glass__footer px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] space-y-0 border-t border-slate-400/15 pt-2">
        {config.bottomItems.map(item => {
          const Icon = item.icon;
          const active = !item.isLogout && !item.isChangePassword && !item.isPinLock && isActive(item);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleClick(item)}
              className={`cms-sidebar-glass__nav-item w-full flex items-center gap-3 rounded-[14px] transition-all min-h-11 box-border
                px-3 py-1.5
                ${item.isLogout
                  ? 'text-red-300'
                  : active ? config.activeClass : 'text-[#D5DCE7]'}
              `}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${active ? 'bg-red-600' : ''}`}>
                <Icon size={18} className="flex-shrink-0" aria-hidden="true" />
              </span>
              <span className="text-sm font-medium truncate">{item.label}</span>
            </button>
          );
        })}

        {/* ── Nút Bật/Tắt Âm Thanh ── */}
        <button
          type="button"
          onClick={handleToggleMute}
          className={`cms-sidebar-glass__nav-item w-full flex items-center gap-3 rounded-[14px] transition-all text-[#A8B6CC] min-h-11 box-border
            px-3 py-1.5
          `}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px]">
            {muted ? <VolumeX size={18} className="flex-shrink-0" aria-hidden="true" /> : <Volume2 size={18} className="flex-shrink-0" aria-hidden="true" />}
          </span>
          <span className="text-sm font-medium truncate">{muted ? "Bật âm thanh" : "Tắt âm thanh"}</span>
        </button>
        <button
          type="button"
          onClick={toggleMenuPin}
          aria-pressed={menuPinned}
          aria-label={menuPinned ? 'Bỏ ghim menu' : 'Ghim menu'}
          className="cms-sidebar-glass__nav-item hidden lg:flex w-full min-h-11 items-center gap-3 rounded-[14px] px-3 py-1.5 text-[#A8B6CC] transition-all"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px]">
            {menuPinned
              ? <PinOff size={18} className="flex-shrink-0" aria-hidden="true" />
              : <Pin size={18} className="flex-shrink-0" aria-hidden="true" />}
          </span>
          <span className="text-sm font-medium truncate">{menuPinned ? 'Bỏ ghim menu' : 'Ghim menu'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Responsive navigation drawer ── */}
      {pinnedSidebarVisible ? (
        <>
          <aside className="cms-sidebar-glass hidden lg:flex fixed left-0 top-0 z-30 h-[100dvh] max-h-[100dvh] w-[264px] overflow-hidden">
            {renderSidebarContent()}
          </aside>
          <div className="hidden lg:block w-[264px] shrink-0" aria-hidden="true" />
        </>
      ) : (
        <div
          className={`cms-mobile-drawer-shell fixed inset-0 z-[100] ${mobileOpen ? '' : 'pointer-events-none'}`}
          role="dialog"
          aria-modal={mobileOpen}
          aria-hidden={!mobileOpen}
          aria-label="Menu điều hướng"
        >
          <div
            className={`cms-mobile-drawer-backdrop absolute inset-0 bg-black/50 ${mobileOpen ? 'is-open' : ''}`}
            onClick={() => setMobileOpen(false)}
          />
          <div className={`cms-mobile-drawer-panel cms-sidebar-glass absolute left-0 top-0 h-[100dvh] max-h-[100dvh] w-[min(72vw,280px)] max-w-[280px] overflow-hidden rounded-r-[26px] pt-[env(safe-area-inset-top,0px)] ${mobileOpen ? 'is-open' : ''}`}>
            <div className="h-full relative overflow-hidden">
              {renderSidebarContent()}
            </div>
          </div>
        </div>
      )}

      {mobileNavItems.length > 0 && !pinnedSidebarVisible && (
        <nav
          className={`${isTabletOrLarger ? '' : 'md:hidden'} fixed bottom-2 left-3 right-3 z-40 rounded-[1.5rem] border border-white/80 bg-white/65 shadow-[0_-8px_32px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl pt-1.5 pointer-events-none`}
          aria-label="Điều hướng chính"
          aria-hidden={!footerShown}
          style={{
            ...(isTabletOrLarger ? {
              left: '50%',
              right: 'auto',
              bottom: '1rem',
              width: 'min(48rem, calc(100vw - 2rem))',
              padding: '0.625rem 0.75rem 0.25rem',
              border: '1px solid rgba(255, 255, 255, 0.88)',
              borderRadius: '1.25rem',
              background: 'linear-gradient(145deg, rgba(255,255,255,0.84), rgba(241,245,249,0.66))',
              boxShadow: '0 12px 36px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.95)',
              backdropFilter: 'blur(24px) saturate(1.45)',
              WebkitBackdropFilter: 'blur(24px) saturate(1.45)',
              transform: footerShown
                ? 'translateX(-50%)'
                : 'translate(-50%, calc(100% + 1rem))',
            } : {
              bottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
              padding: '0.625rem 0.25rem 0.375rem',
              transform: footerShown ? 'translateY(0)' : 'translateY(calc(100% + 0.5rem))',
            }),
            opacity: footerShown ? 1 : 0,
            visibility: footerShown ? 'visible' : 'hidden',
            transition: `transform 450ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms ease, visibility 0s linear ${footerShown ? '0s' : '450ms'}`,
          }}
        >
          <div
            className="pointer-events-auto mx-auto flex h-[5.25rem] w-full max-w-[48rem] items-stretch gap-2 px-1"
            onMouseEnter={isInboxRoute ? keepInboxFooter : undefined}
            onMouseLeave={isInboxRoute ? scheduleInboxFooterHide : undefined}
            onFocus={isInboxRoute ? keepInboxFooter : undefined}
            onBlur={isInboxRoute ? scheduleInboxFooterHide : undefined}
            onTouchStart={isInboxRoute ? scheduleInboxFooterHide : undefined}
          >
            {mobileNavItems.map((item) => {
              const Icon = item.key === 'dashboard' ? Home : item.mobileIcon || item.icon || LayoutDashboard;
              const active = isActive(item);
              const isHome = item.key === 'dashboard';
              const badgeCount = getBadgeCount(item.key);
              const iconTone = MOBILE_NAV_ICON_TONES[item.key] || 'border-slate-200/80 from-slate-50 to-white text-slate-600';
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleClick(item)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  tabIndex={footerShown ? 0 : -1}
                  className={`group relative flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 rounded-2xl border px-1.5 py-1 text-[10px] font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-500 ${isHome
                      ? 'border-transparent bg-transparent text-red-600'
                      : active
                        ? 'border-red-300/80 bg-gradient-to-b from-white/90 to-red-50/80 text-red-600 shadow-[inset_2px_2px_6px_rgba(220,38,38,0.12),inset_-2px_-2px_5px_rgba(255,255,255,0.96)]'
                        : 'border-white/70 bg-white/45 text-slate-500 hover:border-white/90 hover:bg-white/60 hover:text-slate-800'
                    }`}
                >
                  <span className={`relative flex items-center justify-center transition-all duration-200 ${isHome
                      ? 'h-14 w-14 rounded-full border-[3px] border-white bg-gradient-to-b from-red-400 via-red-600 to-red-800 text-white shadow-[0_5px_16px_rgba(185,28,28,0.32),0_0_0_3px_rgba(254,202,202,0.6),inset_0_3px_5px_rgba(255,255,255,0.5),inset_0_-5px_8px_rgba(127,29,29,0.5)] group-hover:scale-105 group-active:scale-95'
                      : `h-10 w-10 rounded-xl border ${active
                        ? 'border-red-500/20 bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[inset_2px_2px_5px_rgba(127,29,29,0.32),inset_-2px_-2px_5px_rgba(255,255,255,0.18)]'
                        : `${iconTone} bg-gradient-to-br shadow-[inset_2px_2px_5px_rgba(71,85,105,0.14),inset_-2px_-2px_5px_rgba(255,255,255,0.96)]`
                      }`
                    }`}>
                    <Icon size={isHome ? 28 : 20} strokeWidth={isHome || active ? 2.5 : 2} aria-hidden="true" />
                    {badgeCount > 0 && (
                      <span className="absolute -right-1 -top-1 min-w-[1.05rem] rounded-full bg-red-600 px-1 text-center text-[9px] font-bold leading-[1.05rem] text-white">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                    {itemFreeLocked(item) && (
                      <Lock size={12} className="absolute -left-1 -top-1 rounded-full bg-slate-900 p-0.5 text-amber-200" aria-hidden="true" />
                    )}
                  </span>
                  {isHome ? null : (
                    <span className="flex h-6 w-full items-center justify-center text-center leading-3">{item.mobileLabel || item.label}</span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {mobileNavItems.length > 0 && !pinnedSidebarVisible && isInboxRoute && mobileFooterVisible && !inboxFooterOpen && (
        <button
          type="button"
          onMouseEnter={revealInboxFooter}
          onFocus={revealInboxFooter}
          onClick={revealInboxFooter}
          aria-label="Hiện thanh điều hướng"
          title="Hiện thanh điều hướng"
          className={`${isTabletOrLarger ? '' : 'md:hidden'} cms-inbox-footer-peek fixed bottom-0 left-1/2 z-40 flex h-8 w-32 -translate-x-1/2 items-center justify-center rounded-t-2xl border border-b-0 border-white/80 bg-white/85 text-slate-500 backdrop-blur-xl transition-colors hover:text-red-600`}
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            boxShadow: '0 -6px 18px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.95)',
          }}
        >
          <ChevronUp size={20} strokeWidth={2.5} aria-hidden="true" />
        </button>
      )}

      {freeLockOpen && (
        <div className="fixed inset-0 z-[9600] flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onClick={() => setFreeLockOpen(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <FreeFeatureLock session={session} onClose={() => setFreeLockOpen(false)} />
          </div>
        </div>
      )}

    </>
  );
};

export default AppSidebar;
