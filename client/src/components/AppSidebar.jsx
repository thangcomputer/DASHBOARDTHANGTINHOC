import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, Home, BookOpen, Calendar, CalendarDays, MessageSquare, MessageCircle, UserRound,
  Trophy, FileText, Download, Video, Bell, LogOut, ChevronDown, ChevronUp,
  GraduationCap, Users, DollarSign, ClipboardList, CheckSquare, Pin, PinOff,
  Settings, User, Star, AlertTriangle, Lock, Volume2, VolumeX, BarChart3, HardDrive, Archive, Activity, Sparkles, GitBranch, FormInput, Building2,
  Newspaper, Radio, Award, FileBox, Headphones, Link2, WalletCards, KeyRound, Gamepad2, CalendarClock, Ticket, Crown,
} from 'lucide-react';
import { PIN_SETTINGS_EVENT } from '../utils/pinLock';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { isSoundMuted, setSoundMuted } from '../utils/sound';
import { PERMISSIONS } from '../constants/permissions';
import { hasLearningAccessEnrollment, isFreePortalSelfRegistrationStudent, isUnpaidTuitionAlertStudent } from '../utils/enrollments';
import { visibleInboxUnread } from '../lib/inboxUnread';
import { useStudentSubscription } from './student/subscription/subscriptionContext';
import FreeFeatureLock, { useFreePortalLock, useFreePortalMenu, FREE_HIDDEN_KEYS } from './student/dailyPractice/FreeFeatureLock';
import { hasFeedPostAccess, resolveTodayXpSidebar, subscriptionShortLabel } from '../utils/subscription';
import dailyPracticeApi, { DAILY_PRACTICE_STATS_EVENT } from '../services/dailyPracticeApi';
import EditableAvatar from './EditableAvatar';
import api from '../services/api';

const INBOX_FOOTER_HIDE_MS = 1500;

/** Màu icon ô neumorphic — khớp TAB_ICON_TONES trong thang-tin-hoc-mobile. */
const MOBILE_NAV_TONE_HEX = {
  schedule: '#2563EB',
  inbox: '#7C3AED',
  feed: '#D97706',
  dashboard: '#059669',
  finance: '#059669',
  'daily-practice': '#059669',
  'lesson-practice': '#0891B2',
  support: '#0891B2',
  profile: '#4F46E5',
};

function mobileNavTileStyle(tone) {
  const hex = tone || '#64748B';
  return {
    borderColor: `${hex}28`,
    borderBottomColor: `${hex}45`,
    backgroundImage: `linear-gradient(135deg, ${hex}14 0%, #FFFFFF 100%)`,
    boxShadow: `0 3px 8px ${hex}1c, inset 0 1px 1px rgba(255, 255, 255, 0.9)`,
  };
}

/** Icon footer khớp TAB_ICONS trong thang-tin-hoc-mobile. */
const MOBILE_FOOTER_ICONS = {
  schedule: CalendarDays,
  inbox: MessageCircle,
  feed: Newspaper,
  dashboard: Home,
  finance: DollarSign,
  'daily-practice': Gamepad2,
  support: Headphones,
  'lesson-practice': BookOpen,
  profile: UserRound,
};

// ─── Cấu hình menu theo role ──────────────────────────────────────────────────
const MENU_CONFIG = {
  student: {
    brand: { label: 'Học viên', color: 'from-[#0D1524] to-[#0D1524]' },
    items: [
      { key: 'dashboard', icon: Home, label: 'Tổng quan', sectionLabel: 'KHÔNG GIAN HỌC TẬP', path: '/student', requiresLearningAccess: true },
      { key: 'daily-practice', icon: Gamepad2, label: 'Luyện tập hằng ngày', path: '/student/daily-practice', mobileLabel: 'Luyện tập', requiresLearningAccess: true },
      { key: 'lesson-practice', icon: BookOpen, label: 'Bài giảng', path: '/student/lesson-practice', altHashes: ['materials-videos'], requiresLearningAccess: true },
      { key: 'inbox', icon: MessageCircle, label: 'Hộp thư', path: '/student/inbox' },
      { key: 'schedule', icon: CalendarDays, label: 'Lịch học', path: '/student', hash: 'schedule', requiresLearningAccess: true },
      { key: 'materials-files', icon: FileBox, label: 'Bài tập và tài nguyên', path: '/student', hash: 'materials-files', altHashes: ['materials-software'], requiresLearningAccess: true },
      { key: 'exam', icon: GraduationCap, label: 'Phòng thi', path: '/student/exam', requiresLearningAccess: true },
      { key: 'feed', icon: Newspaper, label: 'Bảng tin', sectionLabel: 'THÔNG TIN & HỖ TRỢ', path: '/student/feed' },
      { key: 'news', icon: Newspaper, label: 'Tin tức', path: '/student/news' },
      { key: 'evaluation', icon: Star, label: 'Đánh giá giảng viên', path: '/student', hash: 'evaluation', requiresLearningAccess: true },
      { key: 'center-info', icon: Building2, label: 'Liên hệ Trung tâm', path: '/student/center-info' },
      { key: 'support', icon: Headphones, label: 'Hỗ trợ', mobileLabel: 'Hỗ trợ', path: '/student/support' },
    ],
    bottomItems: [
      { key: 'profile', icon: UserRound, label: 'Hồ sơ', path: '/student', hash: 'profile' },
      { key: 'logout', icon: LogOut, label: 'Đăng xuất', isLogout: true },
    ],
    accentColor: 'bg-red-600',
    activeClass: 'cms-sidebar-glass__nav-active',
  },
  teacher: {
    brand: { label: 'Giảng viên', color: 'from-[#0D1524] to-[#0D1524]' },
    items: [
      { key: 'dashboard', icon: LayoutDashboard, label: 'Tổng quan', mobileLabel: 'Tổng quan', sectionLabel: 'KHÔNG GIAN LÀM VIỆC', path: '/teacher' },
      { key: 'inbox', icon: MessageCircle, label: 'Hộp thư', mobileLabel: 'Tin nhắn', path: '/teacher/inbox' },
      { key: 'students', icon: Users, label: 'Quản lý học viên', path: '/teacher', hash: 'students' },
      { key: 'schedule', icon: CalendarDays, label: 'Lịch dạy', sidebarLabel: 'Lịch dạy & điểm danh', mobileLabel: 'Lịch', path: '/teacher', hash: 'schedule' },
      { key: 'assignments', icon: CheckSquare, label: 'Giao bài tập & kiểm tra', sidebarLabel: 'Bài tập & kiểm tra', sectionLabel: 'QUẢN LÝ ĐÀO TẠO', path: '/teacher', hash: 'assignments', altHashes: ['quizzes', 'test'] },
      { key: 'training', icon: BookOpen, label: 'Khóa đào tạo', path: '/teacher', hash: 'training' },
      { key: 'finance', icon: DollarSign, label: 'Tài chính', mobileLabel: 'Tài chính', path: '/teacher/finance' },
      { key: 'feed', icon: Newspaper, label: 'Bảng tin', mobileLabel: 'Bảng tin', sectionLabel: 'THÔNG TIN', path: '/teacher/feed' },
      { key: 'news', icon: Newspaper, label: 'Tin tức', path: '/teacher/news' },
      { key: 'center-info', icon: Building2, label: 'Thông tin Trung tâm', path: '/teacher/center-info' },
      { key: 'support', icon: Headphones, label: 'Hỗ trợ', mobileLabel: 'Hỗ trợ', path: '/teacher/support' },
    ],
    bottomItems: [
      { key: 'profile', icon: UserRound, label: 'Hồ sơ', mobileLabel: 'Hồ sơ', path: '/teacher', hash: 'profile' },
      { key: 'logout', icon: LogOut, label: 'Đăng xuất', isLogout: true },
    ],
    accentColor: 'bg-emerald-600',
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
      { key: 'lesson-practice', section: 'HỌC VIÊN', icon: BookOpen, label: 'Bài giảng', path: '/admin', hash: 'lesson-practice', permission: PERMISSIONS.MANAGE_STUDENT_TRAINING },
      { key: 'student-resources', section: 'HỌC VIÊN', icon: FileText, label: 'Tài liệu & Phần mềm', path: '/admin', hash: 'student-resources', permission: PERMISSIONS.MANAGE_STUDENT_TRAINING },
      { key: 'student-training', section: 'HỌC VIÊN', icon: Trophy, label: 'Phòng thi', path: '/admin', hash: 'student-training', permission: PERMISSIONS.MANAGE_STUDENT_TRAINING },
      { key: 'cert-prep', section: 'HỌC VIÊN', icon: Trophy, label: 'Ôn thi MOS/IC3', path: '/admin', hash: 'cert-prep', permission: PERMISSIONS.MANAGE_CERT_PREP },

      { key: 'daily-practice', section: 'TÀI KHOẢN MIỄN PHÍ', icon: Gamepad2, label: 'Luyện tập & Tài nguyên', path: '/admin', hash: 'daily-practice', permission: PERMISSIONS.MANAGE_STUDENT_TRAINING },
      { key: 'subscription-codes', section: 'TÀI KHOẢN MIỄN PHÍ', icon: Ticket, label: 'Mã kích hoạt & Gói', path: '/admin', hash: 'subscription-codes', permission: PERMISSIONS.MANAGE_STUDENTS },
      { key: 'meet-classes', section: 'TÀI KHOẢN MIỄN PHÍ', icon: Video, label: 'Lịch Meet', path: '/admin', hash: 'meet-classes', permission: PERMISSIONS.MANAGE_STUDENTS },

      { key: 'teachers', section: 'GIẢNG VIÊN', icon: GraduationCap, label: 'Giảng viên', path: '/admin', hash: 'teachers', permission: PERMISSIONS.VIEW_TEACHERS },
      { key: 'training-videos', section: 'GIẢNG VIÊN', icon: Video, label: 'Video đào tạo', path: '/admin', hash: 'training-videos', permission: PERMISSIONS.MANAGE_TRAINING },
      { key: 'training-resources', section: 'GIẢNG VIÊN', icon: FileText, label: 'Tài liệu & Phần mềm', path: '/admin', hash: 'training-resources', permission: PERMISSIONS.MANAGE_TRAINING },
      { key: 'training-exam-room', section: 'GIẢNG VIÊN', icon: Trophy, label: 'Phòng thi', path: '/admin', hash: 'training-exam-room', permission: PERMISSIONS.MANAGE_TRAINING },
      { key: 'training-guides-evaluations', section: 'GIẢNG VIÊN', icon: FileText, label: 'Quy trình & Đánh giá', path: '/admin', hash: 'training-guides-evaluations', permission: [PERMISSIONS.MANAGE_TRAINING, PERMISSIONS.VIEW_EVALUATIONS] },

      { key: 'staff', section: 'NHÂN SỰ', icon: Users, label: 'Phân quyền NV', path: '/admin', hash: 'staff', permission: PERMISSIONS.MANAGE_STAFF },
      { key: 'hr', section: 'NHÂN SỰ', icon: ClipboardList, label: 'Nhân sự & Lương', path: '/admin', hash: 'hr', permission: PERMISSIONS.MANAGE_HR },

      { key: 'finance', section: 'TÀI CHÍNH', icon: DollarSign, label: 'Tài chính', path: '/admin', hash: 'finance', permission: PERMISSIONS.MANAGE_FINANCE },
      { key: 'analytics', section: 'TÀI CHÍNH', icon: BarChart3, label: 'Báo cáo doanh thu', path: '/admin', hash: 'analytics', permission: [PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_BRANCH_REVENUE] },
      { key: 'bi', section: 'TÀI CHÍNH', icon: BarChart3, label: 'BI Dashboard', path: '/admin/bi', permission: [PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_BRANCH_REVENUE] },

      { key: 'settings', section: 'HỆ THỐNG', icon: Settings, label: 'Cài đặt hệ thống', path: '/admin', hash: 'settings', permission: PERMISSIONS.SYSTEM_SETTINGS },
      { key: 'center-info', section: 'HỆ THỐNG', icon: Building2, label: 'Thông tin trung tâm', path: '/admin/center-info' },
      {
        key: 'system-group',
        section: 'HỆ THỐNG',
        label: 'Công cụ & Vận hành',
        icon: HardDrive,
        isGroup: true,
        children: [
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
  const [dpSidebarStats, setDpSidebarStats] = useState(null);

  useEffect(() => {
    if (session?.role !== 'student') return undefined;
    let alive = true;
    dailyPracticeApi.student.overview()
      .then((data) => {
        if (alive && data?.stats) setDpSidebarStats(data.stats);
      })
      .catch(() => {});
    const onStats = (event) => {
      if (event?.detail) setDpSidebarStats((prev) => ({ ...prev, ...event.detail }));
    };
    const refetchOverview = () => {
      dailyPracticeApi.student.overview()
        .then((data) => {
          if (data?.stats) setDpSidebarStats(data.stats);
        })
        .catch(() => {});
    };
    window.addEventListener(DAILY_PRACTICE_STATS_EVENT, onStats);
    window.addEventListener('cms:subscription-updated', refetchOverview);
    return () => {
      alive = false;
      window.removeEventListener(DAILY_PRACTICE_STATS_EVENT, onStats);
      window.removeEventListener('cms:subscription-updated', refetchOverview);
    };
  }, [session?.role]);

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

        // Chỉ thử /api/staff khi có quyền manage_staff hoặc super_admin (tránh 403 ồn console cho SUPPORT/staff thường)
        const canManageStaff = adminRole === 'SUPER_ADMIN' || (Array.isArray(userPermissions) && userPermissions.includes('manage_staff'));
        if (!g && role !== 'student' && role !== 'teacher' && canManageStaff) {
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

  const studentHasLearningAccess = (() => {
    if (role !== 'student') return true;
    const sid = session?.id || session?._id;
    if (!sid || !Array.isArray(students)) return false;
    const me = students.find((s) => String(s?.id || s?._id) === String(sid));
    return hasLearningAccessEnrollment(me);
  })();

  const freeMenu = useFreePortalMenu(session) || isFreePortalSelfRegistrationStudent(session);
  const isStudentNav = role === 'student';
  const isTeacherNav = role === 'teacher';
  const isCourseStudent = isStudentNav && !freeMenu;
  const isFreeStudent = isStudentNav && freeMenu;
  const freePortalStudentNav = isFreeStudent;
  const sidebarShellProps = isTeacherNav
    ? { 'data-role-teacher': true }
    : (isFreeStudent
      ? { 'data-free-portal-student': true }
      : (isCourseStudent ? { 'data-course-student': true } : {}));
  const navIconShellClass = (active) => {
    if (!active) {
      return (isStudentNav || isTeacherNav) ? 'bg-white/[0.06] text-[#A8B6CC]' : '';
    }
    if (isCourseStudent) {
      return '!bg-[#EF4444] !text-white !shadow-none';
    }
    if (isFreeStudent || isTeacherNav) {
      return '!bg-[#10B981] !text-white !shadow-none';
    }
    return '';
  };
  const freeLocked = useFreePortalLock(session) && freeMenu;
  const freeLockKeys = new Set(['inbox', 'feed', 'materials-files', 'exam', 'support']);
  const itemFreeLocked = (item) => freeLocked && freeLockKeys.has(item?.key);
  const studentSubContext = useStudentSubscription();
  const feedLocked = role === 'student' && !hasFeedPostAccess({
    role,
    session,
    subscription: studentSubContext?.subscription,
  });

  const FREE_PORTAL_STUDENT_ITEMS = useMemo(() => [
    { key: 'dashboard', icon: Home, label: 'Tổng quan', sectionLabel: 'KHÔNG GIAN HỌC TẬP', path: '/student', requiresLearningAccess: true },
    { key: 'daily-practice', icon: Gamepad2, label: 'Luyện tập', mobileLabel: 'Luyện tập', path: '/student/daily-practice', requiresLearningAccess: true },
    { key: 'inbox', icon: MessageCircle, label: 'Hộp thư', path: '/student/inbox' },
    { key: 'materials-files', icon: FileBox, label: 'Bài tập và tài nguyên', path: '/student', hash: 'materials-files', altHashes: ['materials-software'], requiresLearningAccess: true },
    { key: 'exam', icon: GraduationCap, label: 'Phòng thi', path: '/student/exam', requiresLearningAccess: true },
    { key: 'feed', icon: Newspaper, label: 'Bảng tin', sectionLabel: 'THÔNG TIN & HỖ TRỢ', path: '/student/feed' },
    { key: 'support', icon: Headphones, label: 'Hỗ trợ', mobileLabel: 'Hỗ trợ', path: '/student/support' },
  ], []);
  const effectiveSourceItems = freePortalStudentNav ? FREE_PORTAL_STUDENT_ITEMS : config.items;

  const mobilePrimaryKeys = role === 'teacher'
    ? ['schedule', 'inbox', 'feed', 'dashboard', 'finance', 'support', 'profile']
    : role === 'admin' || role === 'staff'
      ? ['students', 'finance', 'dashboard', 'inbox', 'feed']
      : freeMenu
        ? ['inbox', 'daily-practice', 'dashboard', 'feed', 'profile']
        : ['schedule', 'inbox', 'feed', 'dashboard', 'daily-practice', 'lesson-practice', 'profile'];

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

  // ── Filter menu theo permissions (RBAC) - đệ quy nhóm 3 cấp ─────────────────
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
  const flatVisibleItems = flattenLeaves(filterItems(effectiveSourceItems));
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
    if (item?.key === 'feed') {
      navigate(item.path || '/student/feed');
      setMobileOpen(false);
      return;
    }
    if (item.key === 'support') {
      navigate(item.path);
      setMobileOpen(false);
      return;
    }
    window.dispatchEvent(new CustomEvent('cms:exit-support-page'));
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
    // Base dashboard (Tổng quan) - chỉ active đúng path gốc, không active trên /student/feed, /teacher/finance…
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
      walk(filterItems(effectiveSourceItems));
      if (!changed) return prev;
      return persistOpenGroups(next);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.hash, role]);

  // Trả về element (không khai báo component con) - tránh unmount/remount mỗi lần data refresh → sidebar nhảy cuộn
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
            mobileStyle={isStudentNav}
            className={isStudentNav
              ? 'w-[46px] h-[46px] rounded-full border-2 border-white/[0.22] bg-[#334155] flex-shrink-0'
              : 'w-[46px] h-[46px] rounded-full border-2 border-white/15 bg-slate-700 shadow-sm flex-shrink-0'}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[#F8FAFC] font-extrabold text-[14px] truncate">{userName || 'Người dùng'}</p>
            <p className={isStudentNav
              ? 'mt-1 inline-flex rounded-full bg-[#60A5FA]/[0.12] px-[9px] py-[3px] text-[#93C5FD] text-[11px] font-bold tracking-[0.6px]'
              : 'mt-1 inline-flex rounded-full bg-blue-400/10 px-2 py-0.5 text-blue-300 text-[10px] font-bold tracking-wide'}
            >
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
        {role === 'student' && studentSubscription?.subscription && (() => {
          const sub = studentSubscription.subscription;
          const freePortalAccount = session?.freePortal === true;
          const hasActivePaid = (sub.state === 'active' || sub.state === 'expiring') || Boolean(sub.meetLifetime);
          const isLifetime = sub.state === 'lifetime' && (Boolean(sub.meetLifetime) || !freePortalAccount);
          const isFree = !hasActivePaid && !isLifetime;
          const expiring = sub.state === 'expiring';
          const shortLabel = subscriptionShortLabel(sub, { freePortal: freePortalAccount, isCourseStudent });
          const freeXpText = resolveTodayXpSidebar(dpSidebarStats, sub).line;
          const daysLeftNum = sub.daysLeft != null ? Number(sub.daysLeft) : null;
          const isNearExpiry = daysLeftNum != null ? daysLeftNum <= 7 : expiring;
          const actionLabel = isFree ? 'Nâng cấp' : isNearExpiry ? 'Gia hạn' : 'Đổi gói';
          const rawPlanLabel = String(sub.planLabel || 'học').trim();
          const planTitle = isFree
            ? 'Gói miễn phí'
            : isCourseStudent
              ? 'Gói Khóa học'
              : isLifetime
                ? 'Gói Vĩnh viễn'
                : rawPlanLabel.toLowerCase().startsWith('gói')
                  ? rawPlanLabel
                  : `Gói ${rawPlanLabel}`;
          const daysLine = isFree
            ? freeXpText
            : isCourseStudent
              ? 'Khóa chính thức'
              : isLifetime
                ? freeXpText
                : `Còn ${sub.daysLeft ?? 0} ngày`;

          if (isStudentNav) {
            const iconChip = (
              <span
                className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${
                  isCourseStudent
                    ? 'bg-[#EF4444]/20'
                    : isLifetime
                      ? 'bg-[#F59E0B]/20'
                      : expiring
                        ? 'bg-[#FB923C]/20'
                        : 'bg-[#34D399]/20'
                }`}
              >
                {isCourseStudent ? (
                  <CalendarClock size={13} className="text-[#F87171]" />
                ) : isLifetime ? (
                  <Crown size={13} className="text-[#FBBF24]" />
                ) : (
                  <CalendarClock size={13} className={expiring ? 'text-[#FB923C]' : 'text-[#34D399]'} />
                )}
              </span>
            );
            const actionChip = (isCourseStudent || isLifetime) ? null : (
              <button
                type="button"
                onClick={studentSubscription.openRenew}
                className="shrink-0 min-h-[24px] rounded-[8px] border px-2 py-0.5 text-[10px] font-extrabold leading-none text-white transition hover:brightness-105 active:translate-y-px !shadow-none cursor-pointer bg-[#10B981] border-[#34D399] border-b-2 border-b-[#059669]"
              >
                {actionLabel}
              </button>
            );
            return (
              <div
                title={shortLabel}
                className={`cms-sidebar-sub-chip mt-2.5 grid grid-cols-[22px_minmax(0,1fr)] grid-rows-[auto_auto] items-center gap-x-2 gap-y-0.5 rounded-[12px] border px-3 py-2 ${
                  isCourseStudent
                    ? 'border-[#EF4444]/35 bg-[#EF4444]/[0.12]'
                    : isLifetime
                      ? 'border-[#F59E0B]/40 bg-[#F59E0B]/[0.14]'
                      : expiring
                        ? 'border-[#FB923C]/45 bg-[#FB923C]/[0.16]'
                        : 'border-white/[0.14] bg-white/[0.08]'
                }`}
              >
                <div className="row-span-2 flex items-center justify-center self-center">{iconChip}</div>
                <p className={`col-start-2 row-start-1 min-w-0 text-[11px] font-extrabold leading-[14px] ${
                  isCourseStudent ? 'text-[#FEE2E2]' : isLifetime ? 'text-[#FEF3C7]' : 'text-[#F8FAFC]'
                }`}
                >
                  {planTitle}
                </p>
                <div className="col-start-2 row-start-2 flex min-h-[24px] min-w-0 items-baseline justify-between gap-1.5">
                  <p className={`min-w-0 text-[11px] font-bold leading-[14px] tabular-nums ${
                    isCourseStudent ? 'text-[#F87171]' : isLifetime ? 'text-[#FDE68A]' : 'text-[#34D399]'
                  }`}
                  >
                    {daysLine}
                  </p>
                  {actionChip}
                </div>
              </div>
            );
          }

          if (isFree) {
            return (
              <div title={shortLabel} className="mt-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] px-2.5 py-1.5 transition hover:border-emerald-500/30">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] font-bold text-emerald-100 leading-tight truncate">{planTitle}</p>
                  <button
                    type="button"
                    onClick={studentSubscription.openRenew}
                    className="shrink-0 rounded-md bg-emerald-600/90 hover:bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white transition cursor-pointer active:scale-95 !shadow-none"
                  >
                    {actionLabel}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Sparkles size={11} className="shrink-0 text-emerald-400/70" />
                  <p className="text-[10px] font-semibold text-emerald-400 leading-tight tabular-nums whitespace-nowrap">{daysLine}</p>
                </div>
              </div>
            );
          }

          if (isLifetime) {
            return (
              <div title={shortLabel} className="mt-2.5 rounded-xl border border-amber-400/25 bg-amber-400/10 px-2.5 py-1.5 transition">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] font-bold text-amber-100 leading-tight truncate">{planTitle}</p>
                  <span className="shrink-0 rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-200">
                    VĨNH VIỄN
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Crown size={11} className="shrink-0 text-emerald-400/80" />
                  <p className="text-[10px] font-semibold text-emerald-400 leading-tight">{daysLine}</p>
                </div>
              </div>
            );
          }

          if (expiring) {
            return (
              <div title={shortLabel} className="mt-2.5 rounded-xl border border-orange-400/30 bg-orange-500/15 px-2.5 py-1.5 transition">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] font-bold text-orange-200 leading-tight truncate">{planTitle}</p>
                  <button
                    type="button"
                    onClick={studentSubscription.openRenew}
                    className="shrink-0 rounded-md bg-gradient-to-r from-orange-500 to-red-500 px-2 py-0.5 text-[10px] font-bold text-white transition hover:brightness-110 active:scale-95 !shadow-none cursor-pointer"
                  >
                    {actionLabel}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <CalendarClock size={11} className="shrink-0 text-emerald-400/80" />
                  <p className="text-[10px] font-semibold text-emerald-400 leading-tight">{daysLine}</p>
                </div>
              </div>
            );
          }

          return (
            <div title={shortLabel} className="mt-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-1.5 transition hover:border-white/15">
              <div className="flex items-center justify-between gap-1">
                <p className="text-[11px] font-bold text-slate-100 leading-tight truncate">{planTitle}</p>
                <button
                  type="button"
                  onClick={studentSubscription.openRenew}
                  className="shrink-0 rounded-md bg-emerald-600/90 hover:bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white transition active:scale-95 !shadow-none cursor-pointer"
                >
                  {actionLabel}
                </button>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <CalendarClock size={11} className="shrink-0 text-emerald-400/70" />
                <p className="text-[10px] font-semibold text-emerald-400 leading-tight">{daysLine}</p>
              </div>
            </div>
          );
        })()}
      </div>

      <nav className="flex-1 px-4 py-1.5 space-y-0 overflow-y-auto overflow-x-hidden overscroll-contain" aria-label="Menu chính" style={{ overflowAnchor: 'none' }}>
        {filterItems(effectiveSourceItems)
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
                className={isStudentNav
                  ? 'px-2 pt-3 pb-1 text-[11px] font-black tracking-[1.1px] text-[#94A3B8]'
                  : 'px-1 pt-3 pb-1 text-[10px] font-black tracking-[0.12em] text-slate-400'}
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
              const showFreeLock = itemFreeLocked(navItem) || (navItem.key === 'feed' && feedLocked);
              return (
                <div key={navItem.key} className="relative group/nav">
                  <button
                    type="button"
                    onClick={() => !isLocked && handleClick(navItem)}
                    disabled={isLocked}
                    aria-current={active ? 'page' : undefined}
                    title={isLocked ? 'Bạn chưa phải là giáo viên chính thức nên chưa được mở' : undefined}
                    className={`cms-sidebar-glass__nav-item w-full flex items-center rounded-[14px] transition-all min-h-11 min-w-0
                    ${isStudentNav ? 'gap-[10px] px-[10px] py-2' : `${nested ? 'px-3 py-1.5 pl-6' : 'px-3 py-1.5'} gap-3`}
                    ${isLocked
                        ? 'text-white/40 cursor-not-allowed'
                        : active
                          ? (nested ? NESTED_ACTIVE_CLASS : config.activeClass)
                          : 'text-[#D5DCE7]'
                      }
                  `}
                  >
                    <span className={`flex shrink-0 items-center justify-center transition-colors ${isStudentNav ? 'h-[34px] w-[34px] rounded-[12px]' : 'h-8 w-8 rounded-[11px]'} ${navIconShellClass(active)}`}>
                      <Icon size={nested ? 16 : 18} className="flex-shrink-0" aria-hidden="true" />
                    </span>
                    <span className={`truncate ${isStudentNav ? `text-[15px] ${active ? 'font-black text-white' : 'font-bold text-[#D5DCE7]'}` : `font-medium ${nested ? 'text-[13px]' : 'text-sm'}`}`}>
                      {navItem.sidebarLabel || navItem.label}
                    </span>
                    {isLocked && (
                      <Lock size={13} className="ml-auto text-white/40 flex-shrink-0" aria-hidden="true" />
                    )}
                    {showFreeLock && (
                      <Lock size={isStudentNav ? 14 : 13} className={`ml-auto flex-shrink-0 ${isStudentNav ? 'text-[#FBBF24]' : 'text-amber-200'}`} aria-label="Đang khóa" />
                    )}
                    {!isLocked && getBadgeCount(navItem.key) > 0 && (
                      <span className={`ml-auto px-1.5 py-0.5 rounded-full text-white text-xs font-black leading-none drop-shadow-md ${isCourseStudent ? 'bg-[#EF4444] shadow-red-500/50' : (isFreeStudent || isTeacherNav) ? 'bg-[#059669] shadow-emerald-500/50' : 'bg-red-500 shadow-red-500/50'}`} aria-label={`${getBadgeCount(navItem.key)} thông báo`}>
                        {getBadgeCount(navItem.key) > 99 ? '99+' : getBadgeCount(navItem.key)}
                      </span>
                    )}
                    {isStudentNav && active && !isLocked && !showFreeLock && getBadgeCount(navItem.key) === 0 && (
                      <span className={`ml-auto h-[7px] w-[7px] shrink-0 rounded-full ${isCourseStudent ? 'bg-[#F87171]' : 'bg-[#34D399]'}`} aria-hidden="true" />
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
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${navIconShellClass(hubActive)}`}>
                        <HubIcon size={16} className="flex-shrink-0" aria-hidden="true" />
                      </span>
                      <span className="text-[13px] font-semibold flex-1 text-left truncate">{hub.label}</span>
                      {hubBadge > 0 && (
                        <span className={`px-1.5 py-0.5 rounded-full text-white text-xs font-black leading-none ${isTeacherNav ? 'bg-[#059669]' : 'bg-red-500'}`}>
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
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${navIconShellClass(childActive)}`}>
                      <GroupIcon size={18} className="flex-shrink-0" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold flex-1 text-left">{item.label}</span>
                    {groupBadge > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-full text-white text-xs font-black leading-none ${isTeacherNav ? 'bg-[#059669]' : 'bg-red-500'}`}>
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
      <div className="cms-sidebar-glass__footer shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] space-y-0.5 border-t border-slate-400/15 pt-2">
        {config.bottomItems.map(item => {
          const Icon = isStudentNav && item.key === 'profile' ? UserRound : item.icon;
          const active = !item.isLogout && !item.isChangePassword && !item.isPinLock && isActive(item);
          const footerIconClass = isStudentNav
            ? `flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[12px] ${item.isLogout
              ? 'bg-white/[0.06] text-[#FCA5A5]'
              : active
                ? (isCourseStudent ? '!bg-[#EF4444] !text-white !shadow-none' : '!bg-[#10B981] !text-white !shadow-none')
                : 'bg-white/[0.06] text-[#A8B6CC]'
            }`
            : `flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${navIconShellClass(active)}`;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleClick(item)}
              className={`cms-sidebar-glass__nav-item w-full flex items-center rounded-[14px] transition-all min-h-11 box-border
                ${isStudentNav ? 'gap-[10px] px-[10px] py-2' : 'gap-3 px-3 py-1.5'}
                ${item.isLogout
                  ? (isStudentNav ? 'text-[#F87171]' : 'text-red-300')
                  : active ? config.activeClass : 'text-[#D5DCE7]'}
              `}
            >
              <span className={footerIconClass}>
                <Icon size={18} className="flex-shrink-0" aria-hidden="true" />
              </span>
              <span className={`truncate ${isStudentNav ? `text-[15px] ${active ? 'font-black text-white' : 'font-bold'}` : 'text-sm font-medium'}`}>{item.label}</span>
              {isStudentNav && active && (
                <span className={`ml-auto h-[7px] w-[7px] shrink-0 rounded-full ${isCourseStudent ? 'bg-[#F87171]' : 'bg-[#34D399]'}`} aria-hidden="true" />
              )}
            </button>
          );
        })}

        {/* ── Nút Bật/Tắt Âm Thanh ── */}
        <button
          type="button"
          onClick={handleToggleMute}
          className={`cms-sidebar-glass__nav-item w-full flex items-center rounded-[14px] transition-all min-h-11 box-border
            ${isStudentNav ? 'gap-[10px] px-[10px] py-2 text-[#D5DCE7]' : 'gap-3 px-3 py-1.5 text-[#A8B6CC]'}
          `}
        >
          <span className={`flex shrink-0 items-center justify-center ${isStudentNav ? 'h-[34px] w-[34px] rounded-[12px] bg-white/[0.06] text-[#A8B6CC]' : 'h-8 w-8 rounded-[11px]'}`}>
            {muted ? <VolumeX size={18} className="flex-shrink-0" aria-hidden="true" /> : <Volume2 size={18} className="flex-shrink-0" aria-hidden="true" />}
          </span>
          <span className={`truncate ${isStudentNav ? 'text-[15px] font-bold text-[#D5DCE7]' : 'text-sm font-medium'}`}>{muted ? "Bật âm thanh" : "Tắt âm thanh"}</span>
        </button>
        <button
          type="button"
          onClick={toggleMenuPin}
          aria-pressed={menuPinned}
          aria-label={menuPinned ? 'Bỏ ghim menu' : 'Ghim menu'}
          className={`cms-sidebar-glass__nav-item ${isLaptopOrLarger ? 'flex' : 'hidden'} w-full min-h-11 items-center rounded-[14px] transition-all
            ${isStudentNav ? 'gap-[10px] px-[10px] py-2 text-[#D5DCE7]' : 'gap-3 px-3 py-1.5 text-[#A8B6CC]'}
          `}
        >
          <span className={`flex shrink-0 items-center justify-center ${isStudentNav ? 'h-[34px] w-[34px] rounded-[12px] bg-white/[0.06] text-[#A8B6CC]' : 'h-8 w-8 rounded-[11px]'}`}>
            {menuPinned
              ? <PinOff size={18} className="flex-shrink-0" aria-hidden="true" />
              : <Pin size={18} className="flex-shrink-0" aria-hidden="true" />}
          </span>
          <span className={`truncate ${isStudentNav ? 'text-[15px] font-bold text-[#D5DCE7]' : 'text-sm font-medium'}`}>{menuPinned ? 'Bỏ ghim menu' : 'Ghim menu'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Responsive navigation drawer ── */}
      {pinnedSidebarVisible ? (
        <>
          <aside
            className="cms-sidebar-glass flex fixed left-0 top-0 z-30 h-[100dvh] max-h-[100dvh] w-[284px] overflow-hidden"
            {...sidebarShellProps}
          >
            {renderSidebarContent()}
          </aside>
          <div className="w-[284px] shrink-0" aria-hidden="true" />
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
          <div
            className={`cms-mobile-drawer-panel cms-sidebar-glass absolute left-0 top-0 h-[100dvh] max-h-[100dvh] w-[min(82vw,292px)] max-w-[292px] overflow-hidden rounded-r-[26px] pt-[env(safe-area-inset-top,0px)] ${mobileOpen ? 'is-open' : ''}`}
            {...sidebarShellProps}
          >
            <div className="h-full relative overflow-hidden">
              {renderSidebarContent()}
            </div>
          </div>
        </div>
      )}

      {mobileNavItems.length > 0 && !pinnedSidebarVisible && (
        <nav
          className={`cms-mobile-bottom-nav cms-mobile-bottom-nav--dock ${isCourseStudent ? 'cms-mobile-bottom-nav--brand' : ''} ${isTabletOrLarger ? '' : 'md:hidden'} ${footerShown ? 'pointer-events-auto' : 'pointer-events-none'}`}
          aria-label="Điều hướng chính"
          aria-hidden={!footerShown}
          {...((freePortalStudentNav || isTeacherNav) ? { 'data-free-portal-student': true } : {})}
          style={{
            ...(isTabletOrLarger
              ? {
                left: '50%',
                right: 'auto',
                width: 'min(47.5rem, calc(100vw - 2rem))',
                transform: footerShown
                  ? 'translateX(-50%)'
                  : 'translate(-50%, calc(100% + 1rem))',
              }
              : {
                left: 'max(0.75rem, env(safe-area-inset-left, 0px))',
                right: 'max(0.75rem, env(safe-area-inset-right, 0px))',
                width: 'auto',
                transform: footerShown ? 'translateY(0)' : 'translateY(calc(100% + 0.5rem))',
              }),
            opacity: footerShown ? 1 : 0,
            visibility: footerShown ? 'visible' : 'hidden',
            transition: `transform 450ms cubic-bezier(0.22, 1, 0.36, 1), opacity 350ms ease, visibility 0s linear ${footerShown ? '0s' : '450ms'}`,
          }}
        >
          <div
            className="cms-mobile-bottom-nav__track"
            onMouseEnter={isInboxRoute ? keepInboxFooter : undefined}
            onMouseLeave={isInboxRoute ? scheduleInboxFooterHide : undefined}
            onFocus={isInboxRoute ? keepInboxFooter : undefined}
            onBlur={isInboxRoute ? scheduleInboxFooterHide : undefined}
            onTouchStart={isInboxRoute ? scheduleInboxFooterHide : undefined}
          >
            {mobileNavItems.map((item) => {
              const Icon = MOBILE_FOOTER_ICONS[item.key] || item.mobileIcon || item.icon || LayoutDashboard;
              const active = isActive(item);
              const isHome = item.key === 'dashboard';
              const badgeCount = getBadgeCount(item.key);
              const tone = MOBILE_NAV_TONE_HEX[item.key] || '#64748B';
              const iconColor = isHome ? '#FFFFFF' : (active ? '#FFFFFF' : tone);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleClick(item)}
                  aria-current={active ? 'page' : undefined}
                  aria-label={item.label}
                  tabIndex={footerShown ? 0 : -1}
                  className={`cms-mobile-bottom-nav__item ${isHome ? 'cms-mobile-bottom-nav__item--home' : 'cms-mobile-bottom-nav__item--card'} ${!isHome && active ? 'cms-mobile-bottom-nav__item--active' : ''}`}
                >
                  <span
                    className={`cms-mobile-bottom-nav__tile ${isHome ? 'cms-mobile-bottom-nav__tile--home' : ''} ${!isHome && active ? 'cms-mobile-bottom-nav__tile--active' : ''}`}
                    style={!isHome && !active ? mobileNavTileStyle(tone) : undefined}
                  >
                    <Icon size={isHome ? 28 : 20} color={iconColor} strokeWidth={isHome || active ? 2.5 : 2} aria-hidden="true" />
                    {badgeCount > 0 ? (
                      <span className="cms-mobile-bottom-nav__badge">{badgeCount > 99 ? '99+' : badgeCount}</span>
                    ) : null}
                    {(itemFreeLocked(item) || (item.key === 'feed' && feedLocked)) ? (
                      <span className="cms-mobile-bottom-nav__lock" aria-hidden="true">
                        <Lock size={10} strokeWidth={2.5} />
                      </span>
                    ) : null}
                  </span>
                  {isHome ? null : (
                    <span className={`cms-mobile-bottom-nav__label ${active ? 'cms-mobile-bottom-nav__label--active' : ''}`}>
                      {item.mobileLabel || item.label}
                    </span>
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
