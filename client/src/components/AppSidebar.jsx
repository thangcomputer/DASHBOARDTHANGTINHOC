import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard, BookOpen, Calendar, MessageSquare,
  Trophy, FileText, Bell, LogOut, ChevronLeft, ChevronRight, ChevronDown,
  GraduationCap, Users, DollarSign, ClipboardList, X,
  Settings, User, Star, AlertTriangle, Lock, Volume2, VolumeX, BarChart3, HardDrive, Archive, Activity, Sparkles, GitBranch, FormInput, Building2,
  Newspaper, PlayCircle, Award, FileBox, Link2,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { isSoundMuted, setSoundMuted } from '../utils/sound';
import { PERMISSIONS } from '../constants/permissions';
import { resolveAvatarUrl } from '../utils/defaultAvatars';
import { hasLearningAccessEnrollment, isUnpaidTuitionAlertStudent } from '../utils/enrollments';
import EditableAvatar from './EditableAvatar';
import api from '../services/api';

const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  if (diffMs < 60000) return 'Vừa xong';
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} phút trước`;
  if (diffMs < 86400000) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

// ─── Cấu hình menu theo role ──────────────────────────────────────────────────
const MENU_CONFIG = {
  student: {
    brand: { label: 'HỌC VIÊN', color: 'from-slate-900 to-indigo-950' },
    items: [
      { key: 'dashboard',  icon: LayoutDashboard, label: 'Tổng quan', path: '/student', requiresLearningAccess: true },
      { key: 'feed',       icon: Newspaper,        label: 'Bảng tin',  path: '/student/feed' },
      { key: 'inbox',      icon: MessageSquare,    label: 'Hộp thư',   path: '/student/inbox' },
      {
        key: 'exam-group',
        label: 'Ôn thi',
        icon: Trophy,
        isGroup: true,
        children: [
          { key: 'exam',        icon: Trophy,        label: 'Phòng Thi',      path: '/student/exam', requiresLearningAccess: true },
          { key: 'cert-prep',   icon: GraduationCap, label: 'Ôn thi MOS/IC3', path: '/student/cert-prep', requiresLearningAccess: true },
          { key: 'exam-scores', icon: Award,         label: 'Điểm thi',       path: '/student', hash: 'exam-scores', requiresLearningAccess: true },
        ],
      },
      {
        key: 'schedule-materials-group',
        label: 'Lịch và học tập',
        icon: Calendar,
        isGroup: true,
        children: [
          { key: 'schedule',              icon: Calendar,      label: 'Lịch học',        path: '/student', hash: 'schedule', requiresLearningAccess: true },
          { key: 'materials-files',       icon: FileBox,       label: 'Tài liệu',        path: '/student', hash: 'materials-files', requiresLearningAccess: true },
          { key: 'materials-software',    icon: Link2,         label: 'Tải phần mềm',   path: '/student', hash: 'materials-software', requiresLearningAccess: true },
          { key: 'materials-videos',      icon: PlayCircle,    label: 'Video học tập',   path: '/student', hash: 'materials-videos', requiresLearningAccess: true },
          { key: 'materials-assignments', icon: ClipboardList, label: 'Bài tập về nhà',  path: '/student', hash: 'materials-assignments', requiresLearningAccess: true },
        ],
      },
      {
        key: 'news-evaluation-group',
        label: 'Tin tức & đánh giá',
        icon: FileText,
        isGroup: true,
        children: [
          { key: 'news',       icon: FileText, label: 'Tin tức',  path: '/student/news' },
          { key: 'evaluation', icon: Star,     label: 'Đánh giá', path: '/student', hash: 'evaluation', requiresLearningAccess: true },
        ],
      },
      { key: 'center-info', icon: Building2, label: 'Thông tin trung tâm', path: '/student/center-info' },
    ],
    bottomItems: [
      { key: 'profile',   icon: User,    label: 'Hồ sơ',      path: '/student', hash: 'profile' },
      { key: 'logout',    icon: LogOut,  label: 'Đăng xuất',  isLogout: true },
    ],
    accentColor: 'bg-red-600',
    activeClass: 'bg-white/15 text-white shadow-sm backdrop-blur-md',
  },
  teacher: {
    brand: { label: 'GIẢNG VIÊN', color: 'from-slate-900 to-indigo-950' },
    items: [
      { key: 'dashboard', icon: LayoutDashboard, label: 'Tổng quan', path: '/teacher' },
      { key: 'feed',      icon: Newspaper,        label: 'Bảng tin',  path: '/teacher/feed' },
      { key: 'inbox',     icon: MessageSquare,    label: 'Hộp thư',   path: '/teacher/inbox' },
      {
        key: 'teaching-group',
        label: 'Giảng dạy',
        icon: Users,
        isGroup: true,
        children: [
          { key: 'students',    icon: Users,         label: 'Quản lý học viên',           path: '/teacher', hash: 'students' },
          { key: 'assignments', icon: ClipboardList, label: 'Tạo trắc nghiệm & bài tập', path: '/teacher', hash: 'assignments' },
          { key: 'schedule',    icon: Calendar,      label: 'Lịch dạy',                   path: '/teacher', hash: 'schedule' },
        ],
      },
      { key: 'finance', icon: DollarSign, label: 'Tài chính', path: '/teacher/finance' },
      {
        key: 'news-training-group',
        label: 'Tin tức & đào tạo',
        icon: FileText,
        isGroup: true,
        children: [
          { key: 'news',     icon: FileText, label: 'Tin tức', path: '/teacher/news' },
          { key: 'training', icon: BookOpen, label: 'Đào tạo', path: '/teacher', hash: 'training' },
          { key: 'software-links', icon: Link2, label: 'Tải phần mềm', path: '/teacher', hash: 'software-links' },
        ],
      },
      { key: 'center-info', icon: Building2, label: 'Thông tin trung tâm', path: '/teacher/center-info' },
    ],
    bottomItems: [
      { key: 'profile', icon: User,   label: 'Hồ sơ', path: '/teacher', hash: 'profile' },
      { key: 'logout',  icon: LogOut, label: 'Đăng xuất',      isLogout: true },
    ],
    accentColor: 'bg-red-600',
    activeClass: 'bg-white/15 text-white shadow-sm backdrop-blur-md',
  },
  admin: {
    brand: { label: 'QUẢN TRỊ', color: 'from-slate-900 to-indigo-950' },
    items: [
      { key: 'dashboard', icon: LayoutDashboard, label: 'Tổng quan', path: '/admin', hash: 'dashboard', permission: [
        PERMISSIONS.MANAGE_STUDENTS, PERMISSIONS.VIEW_TEACHERS, PERMISSIONS.MANAGE_SCHEDULE,
        PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.MANAGE_TRAINING, PERMISSIONS.MANAGE_HR,
        PERMISSIONS.SYSTEM_SETTINGS, PERMISSIONS.VIEW_BRANCH_REVENUE
      ]},
      { key: 'feed',      icon: Newspaper,       label: 'Bảng tin',  path: '/admin/feed',  permission: [PERMISSIONS.MANAGE_BLOG, PERMISSIONS.MANAGE_MESSAGES] },
      { key: 'news',      icon: FileText,        label: 'Tin tức',   path: '/admin/news',  permission: [PERMISSIONS.MANAGE_BLOG, PERMISSIONS.MANAGE_MESSAGES] },
      { key: 'inbox',     icon: MessageSquare,   label: 'Hộp thư',   path: '/admin/inbox', permission: PERMISSIONS.MANAGE_MESSAGES },
      {
        key: 'manage-train-group',
        label: 'Quản lý và đào tạo',
        icon: Users,
        isGroup: true,
        children: [
          {
            key: 'students-hub',
            label: 'Học viên',
            icon: Users,
            isGroup: true,
            children: [
              { key: 'students',         icon: Users,         label: 'Học viên',       path: '/admin', hash: 'students',         permission: PERMISSIONS.MANAGE_STUDENTS },
              { key: 'student-training', icon: BookOpen,      label: 'Đào tạo HV',     path: '/admin', hash: 'student-training', permission: PERMISSIONS.MANAGE_STUDENT_TRAINING },
              { key: 'cert-prep',        icon: Trophy,        label: 'Ôn thi MOS/IC3', path: '/admin', hash: 'cert-prep',        permission: PERMISSIONS.MANAGE_CERT_PREP },
            ],
          },
          {
            key: 'teachers-hub',
            label: 'Giảng viên',
            icon: GraduationCap,
            isGroup: true,
            children: [
              { key: 'teachers',    icon: GraduationCap,  label: 'Giảng viên',      path: '/admin', hash: 'teachers',    permission: PERMISSIONS.VIEW_TEACHERS },
              { key: 'training',    icon: BookOpen,       label: 'Đào tạo GV',      path: '/admin', hash: 'training',    permission: PERMISSIONS.MANAGE_TRAINING },
              { key: 'evaluations', icon: AlertTriangle,  label: 'Đánh giá nội bộ', path: '/admin', hash: 'evaluations', permission: PERMISSIONS.VIEW_EVALUATIONS },
            ],
          },
          {
            key: 'staff-hub',
            label: 'Nhân viên',
            icon: ClipboardList,
            isGroup: true,
            children: [
              { key: 'staff', icon: Users,         label: 'Phân quyền NV',   path: '/admin', hash: 'staff', permission: PERMISSIONS.MANAGE_STAFF },
              { key: 'hr',    icon: ClipboardList, label: 'Nhân sự & Lương', path: '/admin', hash: 'hr',    permission: PERMISSIONS.MANAGE_HR },
            ],
          },
        ],
      },
      {
        key: 'finance-group',
        label: 'Tài chính',
        icon: DollarSign,
        isGroup: true,
        children: [
          { key: 'finance',   icon: DollarSign, label: 'Tài chính',         path: '/admin', hash: 'finance', permission: PERMISSIONS.MANAGE_FINANCE },
          { key: 'analytics', icon: BarChart3,  label: 'Báo cáo doanh thu', path: '/admin', hash: 'analytics', permission: [PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_BRANCH_REVENUE] },
          { key: 'bi',        icon: BarChart3,  label: 'BI Dashboard',      path: '/admin/bi',              permission: [PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_BRANCH_REVENUE] },
        ],
      },
      {
        key: 'system-group',
        label: 'Hệ thống',
        icon: Settings,
        isGroup: true,
        children: [
          { key: 'settings',   icon: Settings,  label: 'Cài đặt hệ thống', path: '/admin', hash: 'settings', permission: PERMISSIONS.SYSTEM_SETTINGS },
          { key: 'logs',       icon: Lock,      label: 'Nhật ký hệ thống', path: '/admin', hash: 'logs',     permission: PERMISSIONS.VIEW_LOGS },
          { key: 'files',      icon: HardDrive, label: 'Quản lý file',     path: '/admin/files',             permission: PERMISSIONS.SYSTEM_SETTINGS },
          { key: 'backups',    icon: Archive,   label: 'Sao lưu dữ liệu',  path: '/admin/backups',           superAdminOnly: true },
          { key: 'monitoring', icon: Activity,  label: 'Monitoring',       path: '/admin/monitoring',        permission: PERMISSIONS.VIEW_LOGS },
          { key: 'ai',         icon: Sparkles,  label: 'AI Center',        path: '/admin/ai',                permission: PERMISSIONS.SYSTEM_SETTINGS },
          { key: 'workflows',  icon: GitBranch, label: 'Workflow',         path: '/admin/workflows',         permission: PERMISSIONS.SYSTEM_SETTINGS },
          { key: 'builder',    icon: FormInput, label: 'Form & Report',    path: '/admin/builder',           permission: PERMISSIONS.SYSTEM_SETTINGS },
          { key: 'tenants',    icon: Building2, label: 'Multi-tenant',     path: '/admin/tenants',           superAdminOnly: true },
        ],
      },
      { key: 'center-info', icon: Building2, label: 'Thông tin trung tâm', path: '/admin/center-info' },
    ],
    bottomItems: [
      { key: 'logout', icon: LogOut, label: 'Đăng xuất', isLogout: true },
    ],
    accentColor: 'bg-red-600',
    activeClass: 'bg-white/15 text-white shadow-sm backdrop-blur-md font-bold',
  },
};

/** Mở 1 nhóm → đóng các sibling cùng cấp */
const SIDEBAR_GROUP_SIBLINGS = {
  'manage-train-group': ['finance-group', 'system-group'],
  'finance-group': ['manage-train-group', 'system-group'],
  'system-group': ['manage-train-group', 'finance-group'],
  'students-hub': ['teachers-hub', 'staff-hub'],
  'teachers-hub': ['students-hub', 'staff-hub'],
  'staff-hub': ['students-hub', 'teachers-hub'],
  'exam-group': ['schedule-materials-group', 'news-evaluation-group'],
  'schedule-materials-group': ['exam-group', 'news-evaluation-group'],
  'news-evaluation-group': ['exam-group', 'schedule-materials-group'],
  'teaching-group': ['news-training-group'],
  'news-training-group': ['teaching-group'],
};

const NESTED_ACTIVE_CLASS = 'bg-white/10 text-red-400 font-semibold';

// ─── AppSidebar Component ─────────────────────────────────────────────────────
const AppSidebar = ({
  session,
  role = 'student',
  userName = '',
  userAvatar = '',
  notifications = 0,
  onLogout,
  activeKey,
  onNavigateItem,
  teacherPending = false,
  adminRole = null,       // 'SUPER_ADMIN' | 'STAFF' | null
  userPermissions = [],   // ['manage_students', ...]
  mobileOpen: mobileOpenProp,
  onMobileOpenChange,
}) => {
  const SIDEBAR_COLLAPSE_KEY = 'cms_sidebar_collapsed';
  // Tablet / laptop hẹp (< xl 1200px): rail + overlay khi mở rộng
  const TABLET_RAIL_MQ = '(min-width: 768px) and (max-width: 1199.98px)';
  const DESKTOP_MQ = '(min-width: 1200px)';

  const readDesktopCollapsedPreference = () => {
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSE_KEY);
      if (saved === '1' || saved === '0') return saved === '1';
    } catch { /* ignore */ }
    return false;
  };

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (window.matchMedia(DESKTOP_MQ).matches) {
      return readDesktopCollapsedPreference();
    }
    return true;
  });
  const [mobileOpenInternal, setMobileOpenInternal] = useState(false);
  const isMobileNavControlled = typeof onMobileOpenChange === 'function';
  const mobileOpen = isMobileNavControlled ? Boolean(mobileOpenProp) : mobileOpenInternal;
  const setMobileOpen = (next) => {
    const value = typeof next === 'function' ? next(mobileOpen) : next;
    if (isMobileNavControlled) onMobileOpenChange(value);
    else setMobileOpenInternal(value);
  };
  const [tabletRail, setTabletRail] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(TABLET_RAIL_MQ).matches
  ));

  useEffect(() => {
    const mq = window.matchMedia(TABLET_RAIL_MQ);
    const sync = () => setTabletRail(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Desktop ↔ tablet: desktop mặc định giãn (hoặc theo localStorage); tablet mặc định thu rail
  useEffect(() => {
    const desktopMq = window.matchMedia(DESKTOP_MQ);
    const syncViewport = () => {
      if (desktopMq.matches) {
        setCollapsed(readDesktopCollapsedPreference());
      } else if (window.matchMedia(TABLET_RAIL_MQ).matches) {
        setCollapsed(true);
      }
    };
    desktopMq.addEventListener('change', syncViewport);
    return () => desktopMq.removeEventListener('change', syncViewport);
  }, []);

  const setCollapsedPersist = (next) => {
    setCollapsed(next);
    if (typeof window !== 'undefined' && window.matchMedia(DESKTOP_MQ).matches) {
      try { localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? '1' : '0'); } catch { /* ignore */ }
    }
  };

  // Chỉ tablet (rail overlay): bấm nội dung bên phải → thu sidebar.
  // Desktop/laptop (≥ xl): giữ mở cho đến khi user bấm nút ẩn.
  useEffect(() => {
    const main = document.getElementById('main-content');
    if (!main) return undefined;
    const collapseOnContentInteract = () => {
      if (typeof window === 'undefined') return;
      if (!window.matchMedia(TABLET_RAIL_MQ).matches) return;
      setCollapsed(true);
    };
    main.addEventListener('pointerdown', collapseOnContentInteract);
    return () => main.removeEventListener('pointerdown', collapseOnContentInteract);
  }, []);

  const navigate = useNavigate();
  const location = useLocation();

  // Đổi trang trên tablet → thu sidebar (không ghi localStorage — tránh ảnh hưởng desktop)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.matchMedia(TABLET_RAIL_MQ).matches) return;
    setCollapsed(true);
  }, [location.pathname, location.hash]);

  const [openGroups, setOpenGroups] = useState(() => {
    const defaults = {
      'manage-train-group': false,
      'students-hub': false,
      'teachers-hub': false,
      'staff-hub': false,
      'finance-group': false,
      'system-group': false,
      'exam-group': false,
      'schedule-materials-group': false,
      'news-evaluation-group': false,
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
  const [flyoutHubKey, setFlyoutHubKey] = useState(null);
  const [flyoutPos, setFlyoutPos] = useState({ top: 0, left: 0 });
  const { 
    students, teachers, staffs, getPrivateEvaluationsForAdmin, getConversations, triggerBackgroundSync,
    notifications: allNotifications, markNotificationRead
  } = useData();

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
    const nextGender = session.gender || selfProfile?.gender || '';
    const nextAvatar = session.avatar || selfProfile?.avatar || '';
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

  const [muted, setMutedState] = useState(() => isSoundMuted());
  const [dynamicLogo, setDynamicLogo] = useState('');
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
          setDynamicLogo(url.startsWith('http') ? url : `${API}${url}`);
        }
      })
      .catch(() => {});
  }, []);

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

  const canSeeItem = (item) => {
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
        return (getConversations(session.id) || []).reduce((sum, c) => sum + (c.unread || 0), 0);
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
    if (item.isLogout) { onLogout?.(); return; }
    if (item.isChangePassword) { 
      window.dispatchEvent(new CustomEvent('open-change-password-modal'));
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
      if (currentHash === item.hash) return true;
      // /admin không hash = Tổng quan (dashboard)
      if (!currentHash && item.hash === 'dashboard' && item.path === '/admin') return true;
      return false;
    }
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
    if (item.path?.endsWith('/cert-prep')) {
      const onCert = location.pathname === item.path
        || location.pathname.startsWith(`${item.path}/`);
      return onCert && !currentHash;
    }
    // Các trang lá khác: khớp path tuyệt đối
    return location.pathname === item.path && !currentHash;
  };

  // Điều hướng → mở exclusive nhóm/hub chứa trang active
  useEffect(() => {
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
  }, [location.pathname, location.hash, role]);

  const initials = userName ? userName.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() : 'HV';
  const avatarUrl = resolveAvatarUrl({
    avatar: effectiveAvatar,
    role,
    adminRole: session?.id === 'admin' ? 'SUPER_ADMIN' : adminRole,
    gender: effectiveGender,
  });

  // Trả về element (không khai báo component con) — tránh unmount/remount mỗi lần data refresh → sidebar nhảy cuộn
  const renderSidebarContent = () => (
    <div className={`flex flex-col h-full bg-gradient-to-b ${config.brand.color} text-white overflow-x-hidden`}>

      {/* ── Logo + Collapse / Close ── */}
      <div
        className={`relative flex items-center border-b border-white/10 ${
          (collapsed && !mobileOpen) ? 'px-3 py-4 justify-center' : 'px-3 py-3.5'
        }`}
      >
        {(!collapsed || mobileOpen) ? (
          <>
            <span className="w-11 h-11 shrink-0" aria-hidden="true" />
            <button
              type="button"
              className="flex-1 min-w-0 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity bg-transparent border-0 p-0 px-1"
              onClick={() => {
                navigate(config.items[0].path);
                triggerBackgroundSync();
                if (mobileOpen) setMobileOpen(false);
              }}
              title="Làm mới bảng điều khiển"
              aria-label="Về trang tổng quan"
            >
              <img
                src={dynamicLogo || '/logo-thang-tin-hoc.svg'}
                alt="Thắng Tin Học"
                className="h-8 max-w-[min(100%,152px)] object-contain"
                style={dynamicLogo ? { maxHeight: '32px' } : { filter: 'brightness(0) invert(1)' }}
              />
            </button>
            {mobileOpen ? (
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="w-11 h-11 shrink-0 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white border border-white/20 lg:hidden"
                aria-label="Đóng menu"
              >
                <X size={18} />
              </button>
            ) : (
              <span className="w-11 h-11 shrink-0" aria-hidden="true" />
            )}
          </>
        ) : null}
        <button
          type="button"
          onClick={() => setCollapsedPersist(!collapsed)}
          aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 items-center justify-center flex-shrink-0 transition-all z-10"
        >
          {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronLeft size={14} aria-hidden="true" />}
        </button>
      </div>

      {/* ── User info ── */}
      {(!collapsed || mobileOpen) && (
        <div className="px-5 pt-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <EditableAvatar
              avatar={effectiveAvatar}
              name={userName}
              role={role}
              adminRole={session?.adminRole}
              gender={effectiveGender}
              className="w-10 h-10 rounded-full border-2 border-white/40 bg-white shadow-sm flex-shrink-0"
            />
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate">{userName || 'Người dùng'}</p>
              <p className="text-white/60 text-xs font-semibold tracking-wide">
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
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden overscroll-contain" aria-label="Menu chính" style={{ overflowAnchor: 'none' }}>
      {filterItems(config.items)
        .filter(item => {
          // Ẩn mục 'Bài Test' khi GV đã được kích hoạt giảng dạy
          if (role === 'teacher' && item.key === 'test' && !teacherPending) return false;
          return true;
        })
        .map(item => {
          const renderNavButton = (navItem, { nested = false } = {}) => {
            const Icon = navItem.icon;
            const active = isActive(navItem);
            const isLocked = teacherPending && navItem.key !== 'test';
            return (
              <div key={navItem.key} className="relative group/nav">
                <button
                  type="button"
                  onClick={() => !isLocked && handleClick(navItem)}
                  disabled={isLocked}
                  aria-current={active ? 'page' : undefined}
                  title={isLocked ? 'Bạn chưa phải là giáo viên chính thức nên chưa được mở' : (collapsed && !mobileOpen ? navItem.label : undefined)}
                  className={`w-full flex items-center gap-3 rounded-xl transition-all min-w-0
                    ${(collapsed && !mobileOpen) ? 'justify-center px-2 py-3' : nested ? 'px-4 py-2.5 pl-9' : 'px-4 py-3'}
                    ${isLocked
                      ? 'text-white/40 cursor-not-allowed'
                      : active
                        ? (nested ? NESTED_ACTIVE_CLASS : config.activeClass)
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }
                  `}
                >
                  <Icon size={nested ? 16 : 18} className="flex-shrink-0" aria-hidden="true" />
                  {(!collapsed || mobileOpen) && <span className={`font-medium truncate ${nested ? 'text-[13px]' : 'text-sm'}`}>{navItem.label}</span>}
                  {(!collapsed || mobileOpen) && isLocked && (
                    <Lock size={13} className="ml-auto text-white/40 flex-shrink-0" aria-hidden="true" />
                  )}
                  {(!collapsed || mobileOpen) && !isLocked && getBadgeCount(navItem.key) > 0 && (
                    <span className="ml-auto px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-black leading-none drop-shadow-md shadow-red-500/50" aria-label={`${getBadgeCount(navItem.key)} thông báo`}>
                      {getBadgeCount(navItem.key) > 99 ? '99+' : getBadgeCount(navItem.key)}
                    </span>
                  )}
                  {(collapsed && !mobileOpen) && !isLocked && getBadgeCount(navItem.key) > 0 && (
                    <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 border border-white" aria-hidden="true" />
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
            // Mobile drawer + tablet overlay: accordion hub; desktop mở rộng: hover flyout
            const hubsAsAccordion = mobileOpen || tabletRail;

            const renderMidHub = (hub) => {
              const HubIcon = hub.icon;
              const hubActive = itemOrDescendantActive(hub);
              const hubBadge = collectGroupBadge(hub.children);
              const hubOpen = !!openGroups[hub.key];
              const showFlyout = !hubsAsAccordion && flyoutHubKey === hub.key;

              if (hubsAsAccordion) {
                return (
                  <div key={hub.key} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => toggleGroup(hub.key)}
                      aria-expanded={hubOpen}
                      className={`w-full flex items-center gap-3 rounded-xl transition-all px-4 py-2.5 pl-9
                        ${hubActive ? 'text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
                      `}
                    >
                      <HubIcon size={16} className="flex-shrink-0" aria-hidden="true" />
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
              }

              return (
                <div
                  key={hub.key}
                  className="relative"
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    // Sát mép hub (không để khe hở) để hover không bị mất khi kéo sang flyout
                    setFlyoutPos({ top: rect.top, left: rect.right - 2 });
                    setFlyoutHubKey(hub.key);
                  }}
                  onMouseLeave={() => setFlyoutHubKey((k) => (k === hub.key ? null : k))}
                >
                  <button
                    type="button"
                    aria-expanded={showFlyout}
                    aria-haspopup="menu"
                    className={`w-full flex items-center gap-3 rounded-xl transition-all px-4 py-2.5 pl-9
                      ${hubActive || showFlyout ? 'text-white bg-white/10' : 'text-white/70 hover:text-white hover:bg-white/10'}
                    `}
                  >
                    <HubIcon size={16} className="flex-shrink-0" aria-hidden="true" />
                    <span className="text-[13px] font-semibold flex-1 text-left truncate">{hub.label}</span>
                    {hubBadge > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-black leading-none">
                        {hubBadge > 99 ? '99+' : hubBadge}
                      </span>
                    )}
                    <ChevronRight size={14} className="flex-shrink-0 text-white/50" aria-hidden="true" />
                  </button>
                  {showFlyout && (
                    <div
                      role="menu"
                      className="fixed z-[80] min-w-[11.5rem] rounded-xl border border-white/15 bg-slate-950/95 py-1.5 shadow-2xl backdrop-blur-md"
                      style={{ top: flyoutPos.top, left: flyoutPos.left }}
                    >
                      {hub.children.map((leaf) => {
                        const LeafIcon = leaf.icon;
                        const leafActive = isActive(leaf);
                        const leafBadge = getBadgeCount(leaf.key);
                        return (
                          <button
                            key={leaf.key}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              handleClick(leaf);
                              setFlyoutHubKey(null);
                            }}
                            className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors
                              ${leafActive ? NESTED_ACTIVE_CLASS : 'text-white/75 hover:bg-white/10 hover:text-white'}
                            `}
                          >
                            <LeafIcon size={15} className="flex-shrink-0" aria-hidden="true" />
                            <span className="text-[13px] font-medium truncate flex-1">{leaf.label}</span>
                            {leafBadge > 0 && (
                              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black leading-none">
                                {leafBadge > 99 ? '99+' : leafBadge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            };

            // Sidebar thu gọn: hiện thẳng các lá (icon)
            if (collapsed && !mobileOpen) {
              return (
                <div key={item.key} className="space-y-1 pb-1 mb-1 border-b border-white/10 last:border-b-0 last:mb-0 last:pb-0">
                  {flattenLeaves(item.children).map((leaf) => renderNavButton(leaf, { nested: true }))}
                </div>
              );
            }

            return (
              <div key={item.key} className="pb-1 mb-1 border-b border-white/10 last:border-b-0 last:mb-0 last:pb-0">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.key)}
                  aria-expanded={isOpen}
                  className={`w-full flex items-center gap-3 rounded-xl transition-all px-4 py-3
                    ${childActive ? 'text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
                  `}
                >
                  <GroupIcon size={18} className="flex-shrink-0" aria-hidden="true" />
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
            <div key={item.key} className="pb-1 mb-1 border-b border-white/10 last:border-b-0 last:mb-0 last:pb-0">
              {renderNavButton(item)}
            </div>
          );
        })}

      </nav>

      {/* ── Bottom items ── */}
      <div className="px-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] space-y-0.5 border-t border-white/10 pt-2.5">
        {config.bottomItems.map(item => {
          const Icon = item.icon;
          const active = !item.isLogout && !item.isChangePassword && isActive(item);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => handleClick(item)}
              className={`w-full flex items-center gap-3 rounded-xl transition-all min-h-11 box-border
                ${(collapsed && !mobileOpen) ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
                ${item.isLogout
                  ? 'text-white/50 hover:text-red-300 hover:bg-red-500/10'
                  : active ? config.activeClass : 'text-white/65 hover:text-white hover:bg-white/10'}
              `}
              title={(collapsed && !mobileOpen) ? item.label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" aria-hidden="true" />
              {(!collapsed || mobileOpen) && <span className="text-sm font-medium truncate">{item.label}</span>}
            </button>
          );
        })}

        {/* ── Nút Bật/Tắt Âm Thanh ── */}
        <button
          type="button"
          onClick={handleToggleMute}
          title={(collapsed && !mobileOpen) ? (muted ? "Bật âm báo" : "Tắt âm báo") : undefined}
          className={`w-full flex items-center gap-3 rounded-xl transition-all text-white/50 hover:text-white hover:bg-white/10 min-h-11 box-border
            ${(collapsed && !mobileOpen) ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'}
          `}
        >
          {muted ? <VolumeX size={18} className="flex-shrink-0" aria-hidden="true" /> : <Volume2 size={18} className="flex-shrink-0" aria-hidden="true" />}
          {(!collapsed || mobileOpen) && <span className="text-sm font-medium truncate">{muted ? "Bật âm thanh" : "Tắt âm thanh"}</span>}
        </button>
      </div>
    </div>
  );

  const overlayExpand = tabletRail && !collapsed;

  return (
    <>
      {/* Tablet: nền mờ khi mở rộng sidebar (overlay, không đẩy co layout) */}
      {overlayExpand && (
        <button
          type="button"
          className="hidden md:block xl:hidden fixed inset-0 z-[55] bg-black/40 border-0 cursor-default"
          aria-label="Đóng menu"
          onClick={() => setCollapsedPersist(true)}
        />
      )}

      {/* ── Desktop / Tablet Sidebar ── */}
      <div className={`hidden md:flex flex-col fixed left-0 top-0 h-[100dvh] max-h-[100dvh] transition-all duration-300
        ${collapsed ? 'w-16' : 'w-64'}
        ${overlayExpand ? 'z-[60] shadow-2xl' : 'z-30'}
      `}>
        {renderSidebarContent()}
      </div>

      {/* ── Mobile: Overlay drawer (hamburger nằm trong header) ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Menu điều hướng">
          <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-[100dvh] max-h-[100dvh] w-[min(85vw,300px)] max-w-[300px] animate-in slide-in-from-left duration-300 shadow-[8px_0_32px_rgba(0,0,0,0.28)] pt-[env(safe-area-inset-top,0px)]">
            <div className="h-full relative overflow-hidden">
              {renderSidebarContent()}
            </div>
          </div>
        </div>
      )}

      {/* Spacer: tablet luôn giữ rail icon (w-16); desktop mới đẩy theo collapsed */}
      <div className={`hidden md:block flex-shrink-0 transition-all duration-300 ${collapsed || tabletRail ? 'w-16' : 'w-64'}`} />
    </>
  );
};

export default AppSidebar;
