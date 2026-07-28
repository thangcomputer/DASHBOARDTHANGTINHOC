import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard, BookOpen, Calendar, MessageSquare,
  Trophy, FileText, Bell, LogOut, ChevronLeft, ChevronRight, ChevronDown,
  GraduationCap, Users, DollarSign, ClipboardList, Menu, X,
  Settings, User, Star, AlertTriangle, Lock, Volume2, VolumeX, BarChart3, HardDrive, Archive, Activity, Sparkles, GitBranch, FormInput, Building2,
  HelpCircle, Newspaper,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { isSoundMuted, setSoundMuted } from '../utils/sound';
import { PERMISSIONS } from '../constants/permissions';
import { resolveAvatarUrl } from '../utils/defaultAvatars';

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
      { key: 'dashboard',  icon: LayoutDashboard, label: 'Tổng quan',      path: '/student' },
      { key: 'feed',       icon: Newspaper,        label: 'Bảng tin',       path: '/student/feed' },
      { key: 'exam',       icon: Trophy,           label: 'Phòng Thi',      path: '/student/exam' },
      { key: 'schedule',   icon: Calendar,         label: 'Lịch học',       path: '/student', hash: 'schedule' },
      { key: 'materials',  icon: BookOpen,          label: 'Tài liệu',      path: '/student', hash: 'materials' },
      { key: 'inbox',      icon: MessageSquare,     label: 'Hộp thư',       path: '/student/inbox' },
      { key: 'evaluation', icon: Star,              label: 'Đánh giá',      path: '/student', hash: 'evaluation' },
    ],
    bottomItems: [
      { key: 'help', icon: HelpCircle, label: 'Trợ giúp', isHelp: true },
      { key: 'profile',   icon: User,    label: 'Hồ sơ',      path: '/student', hash: 'profile' },
      { key: 'changepassword', icon: Lock, label: 'Đổi mật khẩu', isChangePassword: true },
      { key: 'logout',    icon: LogOut,  label: 'Đăng xuất',  isLogout: true },
    ],
    accentColor: 'bg-indigo-600',
    activeClass: 'bg-white/20 text-white shadow-lg backdrop-blur-md border-r-4 border-white',
  },
  teacher: {
    brand: { label: 'GIẢNG VIÊN', color: 'from-slate-900 to-indigo-950' },
    items: [
      { key: 'dashboard',  icon: LayoutDashboard, label: 'Tổng quan',      path: '/teacher' },
      { key: 'feed',       icon: Newspaper,        label: 'Bảng tin',       path: '/teacher/feed' },
      { key: 'students',   icon: Users,            label: 'Quản lý học viên', path: '/teacher', hash: 'students' },
      { key: 'schedule',   icon: Calendar,         label: 'Lịch dạy',      path: '/teacher', hash: 'schedule' },
      { key: 'test',       icon: ClipboardList,    label: 'Bài Test',       path: '/teacher/test' },
      { key: 'finance',    icon: DollarSign,       label: 'Tài chính',      path: '/teacher/finance' },
      {key: 'training',   icon: BookOpen,          label: 'Đào tạo',        path: '/teacher', hash: 'training' },
      { key: 'inbox',      icon: MessageSquare,    label: 'Hộp thư',        path: '/teacher/inbox' },
    ],
    bottomItems: [
      { key: 'help', icon: HelpCircle, label: 'Trợ giúp', isHelp: true },
      { key: 'profile', icon: User,   label: 'Hồ sơ cá nhân', path: '/teacher', hash: 'profile' },
      { key: 'changepassword', icon: Lock, label: 'Đổi mật khẩu', isChangePassword: true },
      { key: 'logout',  icon: LogOut, label: 'Đăng xuất',      isLogout: true },
    ],
    accentColor: 'bg-indigo-600',
    activeClass: 'bg-white/20 text-white shadow-lg backdrop-blur-md border-r-4 border-white',
  },
  admin: {
    brand: { label: 'QUẢN TRỊ', color: 'from-slate-900 to-indigo-950' },
    items: [
      { key: 'dashboard', icon: LayoutDashboard, label: 'Tổng quan', path: '/admin', hash: 'dashboard' },
      { key: 'feed',      icon: Newspaper,       label: 'Bảng tin',  path: '/admin/feed' },
      { key: 'inbox',     icon: MessageSquare,   label: 'Hộp thư',   path: '/admin/inbox' },
      {
        key: 'people-group',
        label: 'Quản lý',
        icon: Users,
        isGroup: true,
        children: [
          { key: 'students', icon: Users,         label: 'Học Viên',       path: '/admin', hash: 'students', permission: PERMISSIONS.MANAGE_STUDENTS },
          { key: 'teachers', icon: GraduationCap, label: 'Giảng Viên',     path: '/admin', hash: 'teachers', permission: PERMISSIONS.VIEW_TEACHERS },
          { key: 'staff',    icon: Users,         label: 'Phân quyền NV',  path: '/admin', hash: 'staff',    superAdminOnly: true, permission: PERMISSIONS.MANAGE_STAFF },
          { key: 'hr',       icon: ClipboardList, label: 'Nhân sự & Lương', path: '/admin', hash: 'hr',     permission: PERMISSIONS.MANAGE_HR },
        ],
      },
      {
        key: 'training-group',
        label: 'Đào tạo',
        icon: BookOpen,
        isGroup: true,
        children: [
          { key: 'training',         icon: BookOpen,      label: 'Đào tạo GV',       path: '/admin', hash: 'training',         permission: PERMISSIONS.MANAGE_TRAINING },
          { key: 'student-training', icon: BookOpen,      label: 'Đào tạo HV',       path: '/admin', hash: 'student-training', permission: PERMISSIONS.MANAGE_STUDENT_TRAINING },
          { key: 'evaluations',      icon: AlertTriangle, label: 'Đánh giá nội bộ',  path: '/admin', hash: 'evaluations',      permission: PERMISSIONS.VIEW_EVALUATIONS },
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
          { key: 'workflows',  icon: GitBranch, label: 'Workflow',         path: '/admin/workflows',         permission: PERMISSIONS.MANAGE_STUDENTS },
          { key: 'builder',    icon: FormInput, label: 'Form & Report',    path: '/admin/builder',           permission: PERMISSIONS.SYSTEM_SETTINGS },
          { key: 'tenants',    icon: Building2, label: 'Multi-tenant',     path: '/admin/tenants',           superAdminOnly: true },
        ],
      },
    ],
    bottomItems: [
      { key: 'changepassword', icon: Lock, label: 'Đổi mật khẩu', isChangePassword: true },
      { key: 'logout', icon: LogOut, label: 'Đăng xuất', isLogout: true },
    ],
    accentColor: 'bg-indigo-600',
    activeClass: 'bg-white/10 text-white shadow-xl backdrop-blur-lg border-r-[4px] border-white font-bold',
  },
};

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
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Tour hướng dẫn cần thấy đủ menu (mở mobile / bỏ thu gọn)
  useEffect(() => {
    const openForGuide = () => {
      setCollapsed(false);
      if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
        setMobileOpen(true);
      }
    };
    window.addEventListener('lms-guide-open-nav', openForGuide);
    return () => window.removeEventListener('lms-guide-open-nav', openForGuide);
  }, []);
  const [openGroups, setOpenGroups] = useState(() => {
    const defaults = {
      'people-group': false,
      'training-group': false,
      'finance-group': false,
      'system-group': false,
    };
    try {
      const saved = localStorage.getItem('cms_sidebar_groups');
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    students, teachers, getPrivateEvaluationsForAdmin, getConversations, triggerBackgroundSync,
    notifications: allNotifications, markNotificationRead
  } = useData();
  const [muted, setMutedState] = useState(() => isSoundMuted());
  const [dynamicLogo, setDynamicLogo] = useState('');
  const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || "");

  useEffect(() => {
    if (!mobileOpen) {
      document.body.classList.remove('cms-menu-open');
      return;
    }
    document.body.classList.add('cms-menu-open');
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
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

  const canSeeItem = (item) => {
    if (role !== 'admin' && role !== 'staff') return true;
    if (session?.id === 'admin' || adminRole === 'SUPER_ADMIN') return true;
    if (item.superAdminOnly) return false;
    if (!item.permission) return true;
    if (Array.isArray(item.permission)) {
      return item.permission.some((p) => userPermissions.includes(p));
    }
    return userPermissions.includes(item.permission);
  };

  // ── Filter menu theo permissions (RBAC) ──────────────────────────────────────
  const filterItems = (items) => {
    return items
      .map((item) => {
        if (item.isGroup && Array.isArray(item.children)) {
          const children = item.children.filter(canSeeItem);
          if (children.length === 0) return null;
          return { ...item, children };
        }
        return canSeeItem(item) ? item : null;
      })
      .filter(Boolean);
  };

  const toggleGroup = (groupKey) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [groupKey]: !prev[groupKey] };
      try { localStorage.setItem('cms_sidebar_groups', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const getBadgeCount = (itemKey) => {
    if (itemKey === 'inbox' && session?.id) {
      return getConversations(session.id).reduce((sum, c) => sum + (c.unread || 0), 0);
    }
    if (role === 'admin') {
      if (itemKey === 'students') {
        return (students || []).filter(s => s && !s.paid).length;
      }
      if (itemKey === 'teachers') {
        return (teachers || []).filter(t => {
          if (!t) return false;
          const s = String(t.status || '').toLowerCase();
          const p = String(t.practicalStatus || '').toLowerCase();
          return s === 'pending' || p === 'pending';
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
    if (item.isHelp) {
      try {
        window.dispatchEvent(new CustomEvent('lms-guide-open', { detail: { mode: 'menu' } }));
      } catch { /* ignore */ }
      setMobileOpen(false);
      return;
    }
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
    const pathMatches = location.pathname === item.path;
    const currentHash = location.hash?.replace('#', '') || '';

    // Item has a hash → only active when path AND hash both match
    if (item.hash) {
      return pathMatches && currentHash === item.hash;
    }
    // Base dashboard items (no hash) → active only when path matches AND no hash in URL
    const basePaths = ['/student', '/teacher', '/admin'];
    if (basePaths.includes(item.path) && pathMatches) {
      return !currentHash;
    }
    // Other items (e.g. /teacher/finance) → path match AND no hash in URL
    return pathMatches && !currentHash;
  };

  const initials = userName ? userName.split(' ').map(w => w[0]).slice(-2).join('').toUpperCase() : 'HV';
  const avatarUrl = resolveAvatarUrl({
    avatar: userAvatar,
    role,
    adminRole: session?.id === 'admin' ? 'SUPER_ADMIN' : adminRole,
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
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 items-center justify-center flex-shrink-0 transition-all"
        >
          {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronLeft size={14} aria-hidden="true" />}
        </button>
      </div>

      {/* ── User info ── */}
      {(!collapsed || mobileOpen) && (
        <div data-guide-key="welcome" className="px-5 pt-8 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src={avatarUrl}
              alt={userName || initials}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-white/40 bg-white shadow-sm"
            />
            <div className="min-w-0">
              <p className="text-white font-bold text-sm truncate">{userName || 'Người dùng'}</p>
              <p className="text-white/50 text-xs">{config.brand.label}</p>
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
            const isLocked = teacherPending && navItem.key !== 'test' && navItem.key !== 'feed';
            return (
              <div key={navItem.key} className="relative group/nav" data-guide-key={navItem.key}>
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
                      : active ? config.activeClass : 'text-white/70 hover:text-white hover:bg-white/10'
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
            const childActive = item.children.some((c) => isActive(c));
            const isOpen = openGroups[item.key] || childActive;
            const groupBadge = item.children.reduce((sum, c) => sum + getBadgeCount(c.key), 0);

            // Sidebar thu gọn: hiện thẳng các mục con (icon)
            if (collapsed && !mobileOpen) {
              return (
                <div key={item.key} className="space-y-1 pt-1 mt-1 border-t border-white/10">
                  {item.children.map((child) => renderNavButton(child))}
                </div>
              );
            }

            return (
              <div key={item.key} className="pt-1 mt-1 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.key)}
                  className={`w-full flex items-center gap-3 rounded-xl transition-all px-4 py-3
                    ${childActive ? 'text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}
                  `}
                >
                  <GroupIcon size={18} className="flex-shrink-0" />
                  <span className="text-sm font-semibold flex-1 text-left">{item.label}</span>
                  {groupBadge > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-black leading-none">
                      {groupBadge > 99 ? '99+' : groupBadge}
                    </span>
                  )}
                  <ChevronDown
                    size={16}
                    className={`flex-shrink-0 text-white/50 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="mt-0.5 space-y-0.5">
                    {item.children.map((child) => renderNavButton(child, { nested: true }))}
                  </div>
                )}
              </div>
            );
          }

          return renderNavButton(item);
        })}

      </nav>

      {/* ── Bottom items ── */}
      <div className="px-3 pb-4 space-y-1 border-t border-white/10 pt-3">
        {config.bottomItems.map(item => {
          const Icon = item.icon;
          const active = !item.isLogout && !item.isHelp && isActive(item);
          return (
            <button
              key={item.key}
              data-guide-key={item.key}
              onClick={() => handleClick(item)}
              className={`w-full flex items-center gap-3 rounded-xl transition-all
                ${(collapsed && !mobileOpen) ? 'justify-center px-2 py-3' : 'px-4 py-3'}
                ${item.isLogout
                  ? 'text-white/50 hover:text-red-400 hover:bg-red-500/10'
                  : item.isHelp
                    ? 'text-amber-200 hover:text-white hover:bg-amber-500/20 border border-amber-400/30'
                    : active ? config.activeClass : 'text-white/60 hover:text-white hover:bg-white/10'}
              `}
              title={(collapsed && !mobileOpen) ? item.label : undefined}
            >
              <Icon size={18} className="flex-shrink-0" />
              {(!collapsed || mobileOpen) && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          );
        })}

        {/* ── Nút Bật/Tắt Âm Thanh ── */}
        <button
          onClick={handleToggleMute}
          title={(collapsed && !mobileOpen) ? (muted ? "Bật âm báo" : "Tắt âm báo") : undefined}
          className={`w-full flex items-center gap-3 rounded-xl transition-all text-white/50 hover:text-white hover:bg-white/10
            ${(collapsed && !mobileOpen) ? 'justify-center px-2 py-3' : 'px-4 py-3'}
          `}
        >
          {muted ? <VolumeX size={18} className="flex-shrink-0" /> : <Volume2 size={18} className="flex-shrink-0" />}
          {(!collapsed || mobileOpen) && <span className="text-sm font-medium">{muted ? "Bật âm thanh" : "Tắt âm thanh"}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <div className={`hidden lg:flex flex-col fixed left-0 top-0 h-screen z-30 transition-all duration-300
        ${collapsed ? 'w-16' : 'w-60'}
      `}>
        {renderSidebarContent()}
      </div>

      {/* ── Mobile: Hamburger button (ẩn khi drawer đang mở để không che logo) ── */}
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="lg:hidden fixed z-[70] w-11 h-11 min-w-[2.75rem] min-h-[2.75rem] bg-white rounded-xl shadow-lg border border-gray-100 flex items-center justify-center text-gray-600 active:scale-95 transition-transform"
          style={{
            top: 'max(0.75rem, env(safe-area-inset-top, 0px))',
            left: 'max(0.75rem, env(safe-area-inset-left, 0px))',
          }}
          aria-label="Mở menu điều hướng"
          aria-expanded={false}
        >
          <Menu size={20} />
        </button>
      )}

      {/* ── Mobile: Overlay (above header/branch dropdown) ── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Menu điều hướng">
          <div className="absolute inset-0 bg-black/50 transition-opacity" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[min(88vw,300px)] max-w-[300px] animate-in slide-in-from-left duration-300 pt-[env(safe-area-inset-top,0px)]">
            <div className="h-full relative shadow-2xl overflow-hidden">
              {renderSidebarContent()}
            </div>
          </div>
        </div>
      )}

      {/* ── Spacer for main content ── */}
      <div className={`hidden lg:block flex-shrink-0 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`} />
    </>
  );
};

export default AppSidebar;
