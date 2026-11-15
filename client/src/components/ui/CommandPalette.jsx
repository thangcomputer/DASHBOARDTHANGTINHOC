import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CornerDownLeft,
  DollarSign,
  FileText,
  Gamepad2,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  Lock,
  Maximize2,
  MessageSquare,
  Moon,
  Newspaper,
  Search,
  Settings,
  Sparkles,
  Sun,
  Target,
  Ticket,
  Users,
  Video,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useTheme } from '../../utils/theme';
import { prefetchRouteByPath } from '../../utils/routePrefetch';
import { OPEN_LEARNING_GOAL_EVENT } from '../../utils/learningGoal';
import { PIN_SETTINGS_EVENT } from '../../utils/pinLock';
import { isSoundMuted, toggleSoundMuted, SOUND_MUTE_CHANGED_EVENT } from '../../utils/sound';
import { useFocusMode } from '../../utils/focusMode';
import { readLastStudySession } from '../../utils/resumeLearning';

export const OPEN_COMMAND_PALETTE_EVENT = 'cms:open-command-palette';

const ROLE_COMMANDS = {
  admin: [
    { id: 'adm-dash', label: 'Tổng quan hệ thống', hint: 'Trang chủ quản trị', path: '/admin', icon: LayoutDashboard, keywords: 'tong quan dashboard home' },
    { id: 'adm-stu', label: 'Quản lý Học viên', hint: 'Danh sách & hồ sơ HV', path: '/admin#students', icon: GraduationCap, keywords: 'hoc vien students' },
    { id: 'adm-tea', label: 'Quản lý Giảng viên', hint: 'Danh sách & duyệt GV', path: '/admin#teachers', icon: Users, keywords: 'giang vien teachers' },
    { id: 'adm-meet', label: 'Lịch học Meet', hint: 'Lịch dạy & ca học', path: '/admin#meet-classes', icon: Calendar, keywords: 'lich meet schedule' },
    { id: 'adm-fin', label: 'Tài chính & Chi trả', hint: 'Thu chi & lương GV', path: '/admin#finance', icon: DollarSign, keywords: 'tai chinh finance luong' },
    { id: 'adm-ana', label: 'Phân tích Doanh thu (BI)', hint: 'Biểu đồ & KPI', path: '/admin#analytics', icon: BarChart3, keywords: 'doanh thu analytics bi' },
    { id: 'adm-eval', label: 'Đánh giá học tập', hint: 'Nhận xét giảng viên', path: '/admin#evaluations', icon: FileText, keywords: 'danh gia evaluation' },
    { id: 'adm-trn', label: 'Đào tạo Giảng viên', hint: 'Giáo trình & kiểm tra GV', path: '/admin#training', icon: BookOpen, keywords: 'dao tao giang vien' },
    { id: 'adm-strn', label: 'Đào tạo Học viên', hint: 'Khóa video & tài liệu HV', path: '/admin#student-training', icon: Video, keywords: 'dao tao hoc vien video' },
    { id: 'adm-lp', label: 'Thực hành theo bài', hint: 'Bài giảng tương tác', path: '/admin#lesson-practice', icon: BookOpen, keywords: 'bai giang thuc hanh' },
    { id: 'adm-dp', label: 'Luyện tập hằng ngày', hint: 'Quản lý lộ trình XP', path: '/admin#daily-practice', icon: Gamepad2, keywords: 'luyen tap hang ngay xp' },
    { id: 'adm-cert', label: 'Ôn thi MOS / IC3', hint: 'Ngân hàng đề chứng nhận', path: '/admin#cert-prep', icon: Award, keywords: 'chung chi mos ic3' },
    { id: 'adm-sub', label: 'Mã kích hoạt & Gói Meet', hint: 'Gia hạn & mã thẻ', path: '/admin#subscription-codes', icon: Ticket, keywords: 'ma kich hoat goi meet' },
    { id: 'adm-inbox', label: 'Hộp thư & Hỗ trợ', hint: 'Nhắn tin trực tiếp', path: '/admin/inbox', icon: MessageSquare, keywords: 'tin nhan inbox chat' },
    { id: 'adm-feed', label: 'Bảng tin cộng đồng', hint: 'Bài đăng & tương tác', path: '/admin/feed', icon: Activity, keywords: 'bang tin feed' },
    { id: 'adm-news', label: 'Tin tức & Bài viết', hint: 'Quản lý tin tức', path: '/admin/news', icon: Newspaper, keywords: 'tin tuc news' },
    { id: 'adm-notif', label: 'Trung tâm Thông báo', hint: 'Toàn bộ thông báo', path: '/admin/notifications', icon: Bell, keywords: 'thong bao notifications' },
    { id: 'adm-set', label: 'Cài đặt hệ thống', hint: 'Cấu hình chung & bảo mật', path: '/admin#settings', icon: Settings, keywords: 'cai dat settings' },
  ],
  teacher: [
    { id: 'tea-dash', label: 'Tổng quan Giảng viên', hint: 'Lịch dạy & thu nhập tháng', path: '/teacher', icon: LayoutDashboard, keywords: 'tong quan teacher' },
    { id: 'tea-stu', label: 'Học viên phụ trách', hint: 'Theo dõi tiến độ HV', path: '/teacher#students', icon: GraduationCap, keywords: 'hoc vien students' },
    { id: 'tea-fin', label: 'Tài chính & Đào tạo', hint: 'Bảng kê thu nhập & video', path: '/teacher/finance', icon: DollarSign, keywords: 'tai chinh thu nhap luong' },
    { id: 'tea-inbox', label: 'Tin nhắn', hint: 'Trao đổi với HV & trung tâm', path: '/teacher/inbox', icon: MessageSquare, keywords: 'tin nhan inbox chat' },
    { id: 'tea-feed', label: 'Bảng tin cộng đồng', hint: 'Cập nhật bài viết', path: '/teacher/feed', icon: Activity, keywords: 'bang tin feed' },
    { id: 'tea-news', label: 'Tin tức', hint: 'Thông báo từ trung tâm', path: '/teacher/news', icon: Newspaper, keywords: 'tin tuc news' },
    { id: 'tea-notif', label: 'Thông báo', hint: 'Thông báo hệ thống', path: '/teacher/notifications', icon: Bell, keywords: 'thong bao notifications' },
    { id: 'tea-sup', label: 'Trung tâm hỗ trợ', hint: 'FAQ & hướng dẫn', path: '/teacher/support', icon: Headphones, keywords: 'ho tro support' },
  ],
  student: [
    { id: 'stu-dash', label: 'Trang chủ học tập', hint: 'Lộ trình & lịch học', path: '/student', icon: LayoutDashboard, keywords: 'trang chu dashboard home' },
    { id: 'stu-dp', label: 'Luyện tập hằng ngày', hint: 'Cày XP & giữ chuỗi Streak', path: '/student/daily-practice', icon: Gamepad2, keywords: 'luyen tap hang ngay xp streak' },
    { id: 'stu-lp', label: 'Bài giảng & Thực hành', hint: 'Video & bài tập từng bài', path: '/student/lesson-practice', icon: BookOpen, keywords: 'bai giang thuc hanh video' },
    { id: 'stu-cert', label: 'Ôn thi MOS / IC3', hint: 'Đề thi thử chứng nhận', path: '/student/cert-prep', icon: Award, keywords: 'on thi chung chi mos ic3' },
    { id: 'stu-exam', label: 'Phòng thi & Kiểm tra', hint: 'Làm bài kiểm tra chính thức', path: '/student/exam', icon: Sparkles, keywords: 'phong thi kiem tra exam' },
    { id: 'stu-inbox', label: 'Tin nhắn & Trợ lý AI', hint: 'Hỏi đáp giảng viên & AI', path: '/student/inbox', icon: MessageSquare, keywords: 'tin nhan chat hoi dap' },
    { id: 'stu-feed', label: 'Bảng tin cộng đồng', hint: 'Chia sẻ & thi đua', path: '/student/feed', icon: Activity, keywords: 'bang tin feed' },
    { id: 'stu-news', label: 'Tin tức trung tâm', hint: 'Mẹo tin học & lịch khai giảng', path: '/student/news', icon: Newspaper, keywords: 'tin tuc news' },
    { id: 'stu-notif', label: 'Thông báo', hint: 'Lịch học & nhắc nhở', path: '/student/notifications', icon: Bell, keywords: 'thong bao notifications' },
    { id: 'stu-sup', label: 'Hỗ trợ kỹ thuật', hint: 'Liên hệ & hướng dẫn', path: '/student/support', icon: Headphones, keywords: 'ho tro support' },
  ],
};

function normalizeVi(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export default function CommandPalette({ role = 'student' }) {
  const navigate = useNavigate();
  const dataCtx = useData?.() || {};
  const { students = [], teachers = [], studentTrainingData = [] } = dataCtx;
  const { isDark, toggle } = useTheme();
  const { focusMode, toggle: toggleFocus } = useFocusMode();
  const [soundMuted, setSoundMutedState] = useState(isSoundMuted);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const syncSound = () => setSoundMutedState(isSoundMuted());
    syncSound();
    window.addEventListener(SOUND_MUTE_CHANGED_EVENT, syncSound);
    return () => window.removeEventListener(SOUND_MUTE_CHANGED_EVENT, syncSound);
  }, [open]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  const roleKey = role === 'staff' ? 'admin' : (ROLE_COMMANDS[role] ? role : 'student');

  const items = useMemo(() => {
    const q = normalizeVi(query);
    const navItems = (ROLE_COMMANDS[roleKey] || []).map((cmd) => ({
      ...cmd,
      group: 'Điều hướng nhanh',
      run: () => {
        const [pathname, hash] = cmd.path.split('#');
        prefetchRouteByPath(pathname);
        if (hash) {
          navigate({ pathname, hash });
          window.location.hash = hash;
        } else {
          navigate(pathname);
        }
      },
    }));

    const lastStudy = open && role === 'student' ? readLastStudySession() : null;
    const quickActions = [
      ...(lastStudy ? [{
        id: 'act-resume-last',
        group: 'Thao tác nhanh',
        label: `Học tiếp: ${lastStudy.lessonTitle || lastStudy.unitTitle || lastStudy.courseTitle || 'Bài học gần nhất'}`,
        hint: lastStudy.courseTitle || lastStudy.subjectName || 'Quay lại đúng vị trí đang học',
        icon: Video,
        keywords: 'hoc tiep resume tiep tuc bai hoc video',
        run: () => {
          const [pathname, hash] = String(lastStudy.href || '').split('#');
          if (hash) {
            navigate({ pathname: pathname || '/student', hash });
            window.location.hash = hash;
          } else {
            navigate(lastStudy.href);
          }
        },
      }] : []),
      {
        id: 'act-theme',
        group: 'Thao tác nhanh',
        label: isDark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối (Dark Mode)',
        hint: 'Đồng bộ trên toàn bộ Web',
        icon: isDark ? Sun : Moon,
        keywords: 'dark light mode giao dien sang toi theme',
        run: () => toggle(),
      },
      {
        id: 'act-sound',
        group: 'Thao tác nhanh',
        label: soundMuted ? 'Bật âm thanh hiệu ứng & haptics' : 'Tắt âm thanh hiệu ứng',
        hint: soundMuted ? 'Đang tắt tiếng' : 'Đang bật hiệu ứng âm thanh',
        icon: soundMuted ? VolumeX : Volume2,
        keywords: 'am thanh sound mute haptics rung',
        run: () => {
          const nextMuted = toggleSoundMuted();
          setSoundMutedState(nextMuted);
        },
      },
      ...(role === 'student' ? [{
        id: 'act-focus',
        group: 'Thao tác nhanh',
        label: focusMode ? 'Tắt Chế độ Tập trung (Focus Mode)' : 'Bật Chế độ Tập trung (Focus Mode)',
        hint: focusMode ? 'Đang ẩn thanh bên khi học' : 'Ẩn sidebar & chat nổi khi làm bài',
        icon: Maximize2,
        keywords: 'focus mode che do tap trung an sidebar',
        run: () => toggleFocus(),
      }] : []),
      ...(role === 'student' ? [{
        id: 'act-goal',
        group: 'Thao tác nhanh',
        label: 'Đặt mục tiêu học tập hằng ngày',
        hint: 'Mục tiêu giờ học / XP mỗi ngày',
        icon: Target,
        keywords: 'muc tieu goal streak',
        run: () => window.dispatchEvent(new CustomEvent(OPEN_LEARNING_GOAL_EVENT)),
      }] : []),
      {
        id: 'act-pin',
        group: 'Thao tác nhanh',
        label: 'Cài đặt mã PIN bảo vệ màn hình',
        hint: 'Khóa nhanh khi rời máy',
        icon: Lock,
        keywords: 'pin lock bao mat khoa',
        run: () => window.dispatchEvent(new CustomEvent(PIN_SETTINGS_EVENT)),
      },
    ];

    const dataMatches = [];
    if (q.length >= 1) {
      if (role === 'admin' || role === 'staff' || role === 'teacher') {
        const matchedStudents = (Array.isArray(students) ? students : [])
          .filter((s) => {
            const hay = normalizeVi(`${s?.name || ''} ${s?.phone || ''} ${s?.course || ''} ${s?.sbd || ''}`);
            return hay.includes(q);
          })
          .slice(0, 5);
        matchedStudents.forEach((s) => {
          const sid = s._id || s.id;
          dataMatches.push({
            id: `stu-${sid}`,
            group: 'Học viên',
            label: s.name || s.phone || 'Học viên',
            hint: [s.phone, s.course].filter(Boolean).join(' · ') || 'Xem hồ sơ học viên',
            icon: GraduationCap,
            run: () => {
              if (role === 'teacher') {
                navigate({ pathname: '/teacher', hash: 'students' });
                window.location.hash = 'students';
              } else {
                window.dispatchEvent(new CustomEvent('open-student-detail', {
                  detail: { id: sid, tab: 'summary' },
                }));
              }
            },
          });
        });
      }

      if (role === 'admin' || role === 'staff') {
        const matchedTeachers = (Array.isArray(teachers) ? teachers : [])
          .filter((t) => normalizeVi(`${t?.name || ''} ${t?.phone || ''} ${t?.email || ''}`).includes(q))
          .slice(0, 4);
        matchedTeachers.forEach((t) => {
          dataMatches.push({
            id: `tea-${t._id || t.id}`,
            group: 'Giảng viên',
            label: t.name || t.email || 'Giảng viên',
            hint: [t.phone, t.email].filter(Boolean).join(' · ') || 'Mở danh sách giảng viên',
            icon: Users,
            run: () => {
              navigate({ pathname: '/admin', hash: 'teachers' });
              window.location.hash = 'teachers';
            },
          });
        });
      }

      const matchedCourses = (Array.isArray(studentTrainingData) ? studentTrainingData : [])
        .filter((c) => normalizeVi(`${c?.title || ''} ${c?.category || ''}`).includes(q))
        .slice(0, 4);
      matchedCourses.forEach((c) => {
        dataMatches.push({
          id: `crs-${c._id || c.id}`,
          group: 'Khóa học',
          label: c.title || 'Khóa học',
          hint: c.category || 'Mở thư viện khóa học',
          icon: BookOpen,
          run: () => {
            if (role === 'admin' || role === 'staff') {
              navigate({ pathname: '/admin', hash: 'student-training' });
              window.location.hash = 'student-training';
            } else if (role === 'teacher') {
              navigate('/teacher/finance');
            } else {
              navigate('/student/lesson-practice');
            }
          },
        });
      });
    }

    const baseList = [...quickActions, ...navItems].filter((item) => {
      if (!q) return true;
      return normalizeVi(`${item.label} ${item.hint} ${item.keywords || ''}`).includes(q);
    });

    return [...dataMatches, ...baseList].slice(0, 14);
  }, [open, query, role, roleKey, students, teachers, studentTrainingData, isDark, toggle, soundMuted, focusMode, toggleFocus, navigate]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length, query]);

  if (!open || typeof document === 'undefined') return null;

  const executeItem = (item) => {
    if (!item) return;
    setOpen(false);
    item.run?.();
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (items.length ? (prev - 1 + items.length) % items.length : 0));
    } else if (e.key === 'Enter' && items[activeIndex]) {
      e.preventDefault();
      executeItem(items[activeIndex]);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-start justify-center bg-slate-900/50 px-3 pt-[10vh] backdrop-blur-xs"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tìm kiếm và lệnh nhanh"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-[var(--cms-surface)] shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Search size={18} className="shrink-0 text-emerald-600" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Tìm trang, học viên, khóa học hoặc lệnh nhanh…"
            className="w-full min-w-0 bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 outline-none"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Đóng bảng lệnh"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[58vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm font-medium text-slate-400">
              Không tìm thấy kết quả phù hợp cho “{query}”
            </div>
          ) : (
            <ul role="listbox" className="space-y-0.5">
              {items.map((item, idx) => {
                const Icon = item.icon || Search;
                const active = idx === activeIndex;
                const showGroupHeader = idx === 0 || items[idx - 1].group !== item.group;
                return (
                  <li key={item.id}>
                    {showGroupHeader ? (
                      <div className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {item.group}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => executeItem(item)}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition cursor-pointer ${active
                          ? 'bg-emerald-50 text-emerald-900'
                          : 'text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-500'
                            }`}
                        >
                          <Icon size={16} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold leading-tight">{item.label}</span>
                          {item.hint ? (
                            <span className="mt-0.5 block truncate text-xs text-slate-500">{item.hint}</span>
                          ) : null}
                        </span>
                      </span>
                      {active ? (
                        <CornerDownLeft size={14} className="shrink-0 text-emerald-600" aria-hidden="true" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="hidden sm:flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] font-medium text-slate-400">
          <span>↑↓ di chuyển · Enter để chọn · Esc để đóng</span>
          <span className="tabular-nums">Ctrl / ⌘ + K</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

