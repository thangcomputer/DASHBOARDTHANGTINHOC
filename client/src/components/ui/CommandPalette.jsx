import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowUp,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  CornerDownLeft,
  DollarSign,
  FileText,
  Gamepad2,
  GraduationCap,
  Headphones,
  History,
  LayoutDashboard,
  Lock,
  Maximize2,
  MessageSquare,
  Moon,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Sun,
  Target,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  Users,
  Video,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import AiUsageIndicator from './AiUsageIndicator';
import { useLanguage } from '../../context/LanguageContext';
import { aiSupportAPI } from '../../services/api';
import { useTheme } from '../../utils/theme';
import { prefetchRouteByPath } from '../../utils/routePrefetch';
import { OPEN_LEARNING_GOAL_EVENT } from '../../utils/learningGoal';
import { PIN_SETTINGS_EVENT } from '../../utils/pinLock';
import { isSoundMuted, toggleSoundMuted, SOUND_MUTE_CHANGED_EVENT } from '../../utils/sound';
import { useFocusMode } from '../../utils/focusMode';
import { isPracticeSessionActive, usePracticeSessionActive } from '../../utils/practiceSessionMode';
import { readLastStudySession } from '../../utils/resumeLearning';
import {
  isLikelyQuestion,
  matchLocalOfficeMemory,
  normalizeQuickQuery,
} from '../../../../shared/ai/quickSearchMemory.mjs';
import {
  SESSION_LIST_PREVIEW,
  activateQuickAskSession,
  beginNewQuickAskSession,
  formatSessionRelativeTime,
  isQuickAskPersistenceRole,
  listQuickAskSessions,
  loadQuickAskSessionArchive,
  rememberQuickAskQuestion,
  syncQuickAskSessions,
} from '../../utils/quickAskRecentHistory';

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

const STARTER_PROMPTS = {
  student: [
    'Excel: SUMIFS nhiều điều kiện thế nào?',
    'Word: tạo mục lục tự động từng bước',
    'LMS: xem lịch học và nộp bài trắc nghiệm',
  ],
  teacher: [
    'Excel: SUMIFS khác SUMIF như thế nào?',
    'PowerPoint: chỉnh Slide Master nhanh',
    'LMS: xem lịch dạy và điểm danh',
  ],
  admin: [
    'Excel: tạo PivotTable từ bảng dữ liệu',
    'Word: chỉnh lề theo Nghị định 30',
    'Excel: VLOOKUP báo #N/A — sửa sao?',
  ],
};

const AI_COMPOSER_HINTS = {
  student: {
    vi: {
      initial: 'VD: Hàm này để làm gì và cách sử dụng',
      continue: 'Hỏi tiếp: nêu phần mềm (Word/Excel/PPT) và bước bạn đang kẹt…',
      attach: 'Mô tả lỗi hoặc đề trên ảnh (VD: Excel #N/A, Word lệch lề)…',
    },
    en: {
      initial: 'What is this function used for, and how do I use it?',
      continue: 'Follow up: name the app (Word/Excel/PPT) and the step you’re stuck on…',
      attach: 'Describe the error or task in the image (e.g. Excel #N/A)…',
    },
  },
  teacher: {
    vi: {
      initial: 'VD: Hàm này để làm gì và cách sử dụng',
      continue: 'Hỏi tiếp: nêu phần mềm và bối cảnh lớp/bài bạn đang soạn…',
      attach: 'Mô tả màn hình cần xử lý (bảng điểm, slide, lỗi Office)…',
    },
    en: {
      initial: 'EWhat is this function used for, and how do I use it?',
      continue: 'Follow up: app name + class/material context…',
      attach: 'Describe the screen to fix (grade sheet, slide, Office error)…',
    },
  },
  admin: {
    vi: {
      initial: 'VD: Hàm này để làm gì và cách sử dụng',
      continue: 'Hỏi tiếp: nêu công cụ và thao tác cụ thể…',
      attach: 'Mô tả nội dung ảnh/tệp cần kiểm tra…',
    },
    en: {
      initial: 'What is this function used for, and how do I use it?',
      continue: 'Follow up: tool name + exact action…',
      attach: 'Describe what to check in the attachment…',
    },
  },
};

function getAiComposerPlaceholder(roleKey, lang, mode = 'initial') {
  const key = ['student', 'teacher', 'admin'].includes(roleKey) ? roleKey : 'student';
  const pack = AI_COMPOSER_HINTS[key] || AI_COMPOSER_HINTS.student;
  const loc = String(lang || '').toLowerCase().startsWith('en') ? 'en' : 'vi';
  return pack[loc]?.[mode] || pack.vi.initial;
}

function DewSkillAiOrb({ size = 44 }) {
  return (
    <img
      src="/dewskill-ai-icon.webp"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 object-contain"
    />
  );
}

function renderCodeOrPlain(text, keyPrefix = '') {
  return String(text || '')
    .split(/(`[^`]+`)/g)
    .map((seg, i) => {
      if (seg.startsWith('`') && seg.endsWith('`') && seg.length > 2) {
        return (
          <code
            key={`${keyPrefix}-c-${i}`}
            className="rounded-md bg-emerald-50 dark:bg-emerald-950/70 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70"
          >
            {seg.slice(1, -1)}
          </code>
        );
      }
      return <span key={`${keyPrefix}-t-${i}`}>{seg}</span>;
    });
}

function renderInlineMarkdown(text) {
  const parts = String(text || '').split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={idx} className="font-bold text-slate-900 dark:text-white">{renderCodeOrPlain(part.slice(2, -2), `b-${idx}`)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={idx} className="italic text-slate-600 dark:text-slate-300">{renderCodeOrPlain(part.slice(1, -1), `i-${idx}`)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={idx}
          className="rounded-md bg-emerald-50 dark:bg-emerald-950/70 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function isTableSeparatorLine(line) {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(String(line || '').trim());
}

function parseTableRowCells(line) {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function parseMarkdownBlocks(rawText) {
  const lines = String(rawText || '').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced code block (``` ... ```)
    if (trimmed.startsWith('```')) {
      const lang = trimmed.slice(3).trim();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: 'code', lang, content: codeLines.join('\n') });
      continue;
    }

    // Markdown table (header row + separator row + 1+ body rows)
    if (trimmed.includes('|') && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1])) {
      const headers = parseTableRowCells(trimmed);
      const rows = [];
      i += 2;
      while (i < lines.length) {
        const rowTrim = lines[i].trim();
        if (!rowTrim || !rowTrim.includes('|')) break;
        rows.push(parseTableRowCells(rowTrim));
        i += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    blocks.push({ type: 'line', text: line });
    i += 1;
  }

  return blocks;
}

function AiMarkdownMessage({ text }) {
  const blocks = useMemo(() => parseMarkdownBlocks(text), [text]);
  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed text-slate-800 dark:text-slate-100">
      {blocks.map((block, idx) => {
        if (block.type === 'code') {
          return (
            <div key={`code-${idx}`} className="my-1.5 overflow-x-auto rounded-xl border border-emerald-200/80 dark:border-emerald-900/70 bg-slate-900 dark:bg-slate-950 px-3 py-2.5">
              <pre className="font-mono text-[12px] leading-relaxed text-emerald-200 whitespace-pre">
                <code>{block.content}</code>
              </pre>
            </div>
          );
        }
        if (block.type === 'table') {
          return (
            <div key={`tbl-${idx}`} className="my-2 overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900/80">
              <table className="min-w-full border-collapse text-left text-[12.5px]">
                <thead>
                  <tr className="bg-emerald-50/90 dark:bg-emerald-950/60 border-b border-slate-200 dark:border-slate-700">
                    {block.headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-2.5 py-1.5 font-bold text-emerald-900 dark:text-emerald-200 whitespace-nowrap">
                        {renderInlineMarkdown(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={rIdx % 2 === 1 ? 'bg-slate-50/70 dark:bg-slate-800/40' : ''}
                    >
                      {block.headers.map((_, cIdx) => (
                        <td key={cIdx} className="border-t border-slate-100 dark:border-slate-800 px-2.5 py-1.5 text-slate-700 dark:text-slate-200 align-top">
                          {renderInlineMarkdown(row[cIdx] || '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        const trimmed = String(block.text || '').trim();
        if (!trimmed) return <div key={idx} className="h-1" />;
        const headingMatch = /^#{1,4}\s+(.+)$/.exec(trimmed);
        if (headingMatch) {
          return (
            <div key={idx} className="pt-1 font-extrabold text-[13.5px] text-slate-900 dark:text-white">
              {renderInlineMarkdown(headingMatch[1])}
            </div>
          );
        }
        const bulletMatch = /^[-•*]\s+(.+)$/.exec(trimmed);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <div className="min-w-0 flex-1">{renderInlineMarkdown(bulletMatch[1])}</div>
            </div>
          );
        }
        const numberedMatch = /^(\d+)\.\s+(.+)$/.exec(trimmed);
        if (numberedMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                {numberedMatch[1]}
              </span>
              <div className="min-w-0 flex-1">{renderInlineMarkdown(numberedMatch[2])}</div>
            </div>
          );
        }
        return <p key={idx}>{renderInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

function QuickAiFeedbackBar({ msg, language = 'vi' }) {
  const [submittedRating, setSubmittedRating] = useState(null);
  const [showReasonBox, setShowReasonBox] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [errorText, setErrorText] = useState('');
  const [lastAttempt, setLastAttempt] = useState(null);
  const reasonFormRef = useRef(null);

  useEffect(() => {
    if (showReasonBox && reasonFormRef.current) {
      window.setTimeout(() => {
        reasonFormRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
      }, 20);
    }
  }, [showReasonBox]);

  const isEn = language === 'en';

  const sendFeedback = useCallback(async (rating, commentText = '') => {
    if (submitting) return;
    if (submittedRating === rating && rating === 'helpful' && !errorText) return;
    setSubmitting(true);
    setErrorText('');
    setLastAttempt({ rating, comment: commentText });
    try {
      const resp = await aiSupportAPI.submitQuickAskFeedback({
        responseId: msg.id,
        rating,
        comment: commentText,
        question: msg.question || '',
        answer: msg.text || '',
        source: msg.source || 'ai',
        model: msg.model || '',
      });
      setSubmittedRating(rating);
      setShowReasonBox(false);
      if (resp?.data?.deduplicated && !resp?.data?.updated) {
        setStatusText(isEn ? 'Feedback already recorded.' : 'Bạn đã đánh giá câu trả lời này rồi.');
      } else if (rating === 'inaccurate') {
        setStatusText(isEn ? 'Sent for Admin review. Thank you!' : 'Đã gửi góp ý để Admin kiểm tra. Cảm ơn bạn!');
      } else {
        setStatusText(isEn ? 'Thanks for your feedback!' : 'Cảm ơn bạn đã đánh giá hữu ích!');
      }
    } catch (err) {
      setErrorText(err?.message || (isEn ? 'Could not submit feedback. Please retry.' : 'Chưa gửi được phản hồi. Vui lòng thử lại.'));
    } finally {
      setSubmitting(false);
    }
  }, [errorText, isEn, msg.id, msg.model, msg.question, msg.source, msg.text, submittedRating, submitting]);

  return (
    <div className="mt-2.5 border-t border-slate-200/75 dark:border-slate-700/75 pt-2" data-testid="ai-feedback-bar">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={submitting || (submittedRating === 'helpful' && !errorText)}
          onClick={() => {
            setShowReasonBox(false);
            void sendFeedback('helpful', '');
          }}
          aria-pressed={submittedRating === 'helpful'}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${submittedRating === 'helpful'
            ? 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 cursor-default'
            : 'border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer'
            } disabled:opacity-70`}
        >
          <ThumbsUp size={11} />
          <span>{isEn ? 'Helpful' : 'Hữu ích'}</span>
        </button>

        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setErrorText('');
            setShowReasonBox((prev) => !prev);
          }}
          aria-pressed={submittedRating === 'inaccurate' || showReasonBox}
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${submittedRating === 'inaccurate' || showReasonBox
            ? 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
            : 'border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-rose-300 hover:text-rose-700 dark:hover:text-rose-300'
            } cursor-pointer disabled:opacity-70`}
        >
          <ThumbsDown size={11} />
          <span>{isEn ? 'Inaccurate' : 'Chưa chính xác'}</span>
        </button>

        {submitting ? (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {isEn ? 'Sending…' : 'Đang gửi…'}
          </span>
        ) : null}

        {!submitting && statusText && !errorText ? (
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300" role="status">
            {statusText}
          </span>
        ) : null}
      </div>

      {showReasonBox ? (
        <form
          ref={reasonFormRef}
          className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:items-center"
          onSubmit={(e) => {
            e.preventDefault();
            void sendFeedback('inaccurate', reason.trim());
          }}
        >
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder={isEn ? 'Short reason (optional, e.g. wrong Office version)…' : 'Lý do ngắn (tùy chọn, VD: sai phiên bản Office, thiếu bước)…'}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[12px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-rose-400"
          />
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1 rounded-xl bg-rose-600 px-2.5 py-1.5 text-[11.5px] font-bold text-white hover:bg-rose-700 transition cursor-pointer disabled:opacity-60"
            >
              <Send size={11} />
              <span>{isEn ? 'Send' : 'Gửi'}</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setShowReasonBox(false)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              {isEn ? 'Cancel' : 'Hủy'}
            </button>
          </div>
        </form>
      ) : null}

      {errorText ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-rose-600 dark:text-rose-300" role="alert">
          <span>{errorText}</span>
          {lastAttempt ? (
            <button
              type="button"
              onClick={() => void sendFeedback(lastAttempt.rating, lastAttempt.comment)}
              className="inline-flex items-center gap-1 underline hover:text-rose-800 cursor-pointer"
            >
              <RefreshCw size={10} />
              <span>{isEn ? 'Retry' : 'Thử gửi lại'}</span>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const QUICK_IMAGE_EXT_RE = /\.(png|jpe?g|webp|gif|bmp)$/i;
const QUICK_TEXT_EXT_RE = /\.(txt|csv|tsv|json|md|markdown|xml|html|htm|css|js|jsx|ts|tsx|py|sql|log|yml|yaml|ini|conf)$/i;
const QUICK_PDF_EXT_RE = /\.pdf$/i;
const QUICK_OFFICE_EXT_RE = /\.(docx?|xlsx?|pptx?|odt|ods|odp)$/i;
const MAX_QUICK_PDF_BYTES = 3.5 * 1024 * 1024;
const MAX_QUICK_TEXT_BYTES = 2 * 1024 * 1024;

function formatQuickFileSize(bytes) {
  const size = Number(bytes || 0);
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không đọc được tệp đã chọn'));
    reader.readAsDataURL(file);
  });
}

function readFileAsTextContent(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không đọc được nội dung tệp'));
    reader.readAsText(file, 'utf-8');
  });
}

function compressQuickImageDataUrl(dataUrl, originalMime, originalSize) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1400;
      let { width, height } = img;
      const needsResize = width > maxDim || height > maxDim || originalSize > 450 * 1024;
      if (!needsResize && originalMime) {
        resolve({ previewUrl: dataUrl, mimeType: originalMime });
        return;
      }
      if (width > maxDim || height > maxDim) {
        const scale = Math.min(maxDim / width, maxDim / height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Không khởi tạo được bộ xử lý ảnh'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const outMime = originalMime === 'image/png' && originalSize <= 350 * 1024 ? 'image/png' : 'image/jpeg';
      const outUrl = canvas.toDataURL(outMime, 0.84);
      resolve({ previewUrl: outUrl, mimeType: outMime });
    };
    img.onerror = () => reject(new Error('Không đọc được dữ liệu hình ảnh'));
    img.src = dataUrl;
  });
}

async function processQuickAttachFile(file) {
  if (!file) return null;
  const name = String(file.name || 'image.png').trim();
  const mime = String(file.type || '').toLowerCase();
  const size = Number(file.size || 0);

  if (mime.startsWith('image/') || QUICK_IMAGE_EXT_RE.test(name)) {
    const rawUrl = await readFileAsDataUrl(file);
    const { previewUrl, mimeType } = await compressQuickImageDataUrl(rawUrl, mime || 'image/png', size);
    const dataBase64 = previewUrl.includes(',') ? previewUrl.split(',')[1] : previewUrl;
    return {
      name: name || 'pasted-image.png',
      mimeType,
      dataBase64,
      previewUrl,
      isImage: true,
      size,
    };
  }

  if (mime === 'application/pdf' || QUICK_PDF_EXT_RE.test(name)) {
    if (size > MAX_QUICK_PDF_BYTES) {
      throw new Error('Tệp PDF quá lớn (tối đa 3.5 MB).');
    }
    const rawUrl = await readFileAsDataUrl(file);
    const dataBase64 = rawUrl.includes(',') ? rawUrl.split(',')[1] : rawUrl;
    return {
      name,
      mimeType: 'application/pdf',
      dataBase64,
      isImage: false,
      size,
    };
  }

  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml' || QUICK_TEXT_EXT_RE.test(name)) {
    if (size > MAX_QUICK_TEXT_BYTES) {
      throw new Error('Tệp văn bản quá lớn (tối đa 2 MB).');
    }
    const textContent = (await readFileAsTextContent(file)).slice(0, 15000);
    return {
      name,
      mimeType: mime || 'text/plain',
      textContent,
      isImage: false,
      size,
    };
  }

  if (QUICK_OFFICE_EXT_RE.test(name)) {
    return {
      name,
      mimeType: mime || 'application/octet-stream',
      textContent: `[Tệp Office đính kèm: ${name}]`,
      isImage: false,
      size,
    };
  }

  throw new Error('Hỗ trợ ảnh (PNG, JPG, WEBP), PDF, TXT, CSV, JSON, MD hoặc tệp Office.');
}

export default function CommandPalette({ role = 'student', userId = '', isFreeTierStudent = false }) {
  const safeUserId = String(userId || '').trim();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const dataCtx = useData?.() || {};
  const { students = [], teachers = [], studentTrainingData = [] } = dataCtx;
  const { isDark, toggle } = useTheme();
  const { focusMode, toggle: toggleFocus } = useFocusMode();
  const practiceSessionActive = usePracticeSessionActive();
  const [soundMuted, setSoundMutedState] = useState(isSoundMuted);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [messages, setMessages] = useState([]);
  const [asking, setAsking] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [attachError, setAttachError] = useState('');
  const [aiDailyQuota, setAiDailyQuota] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [sessionArchive, setSessionArchive] = useState({ activeSessionId: '', sessions: [] });
  const [activeSessionId, setActiveSessionId] = useState('');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatScrollRef = useRef(null);
  const activeSessionIdRef = useRef('');

  const syncSessionArchive = useCallback((thread, sessionIdOverride = '') => {
    if (!isQuickAskPersistenceRole(role)) return;
    const sid = sessionIdOverride || activeSessionIdRef.current;
    if (!sid || !Array.isArray(thread) || thread.length === 0) return;
    const nextArchive = syncQuickAskSessions(thread, role, safeUserId, sid);
    setSessionArchive(nextArchive);
  }, [role, safeUserId]);

  useEffect(() => {
    if (practiceSessionActive) setOpen(false);
  }, [practiceSessionActive]);

  useEffect(() => {
    if (!open || (role !== 'student' && role !== 'teacher')) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await aiSupportAPI.status();
        if (!cancelled && res?.success && res?.data?.dailyQuota) {
          setAiDailyQuota(res.data.dailyQuota);
        }
      } catch {
        /* quota display optional */
      }
    })();
    return () => { cancelled = true; };
  }, [open, role]);

  useEffect(() => {
    if (!open || !isQuickAskPersistenceRole(role)) return;
    setSessionArchive(loadQuickAskSessionArchive(role, safeUserId));
  }, [open, role, safeUserId]);

  useEffect(() => {
    if (!isQuickAskPersistenceRole(role)) return;
    if (messages.length > 0 && activeSessionIdRef.current) {
      syncSessionArchive(messages, activeSessionIdRef.current);
    }
  }, [messages, syncSessionArchive, role, safeUserId]);

  useEffect(() => {
    const onUnload = () => {
      if (!isQuickAskPersistenceRole(role)) return;
      if (messages.length > 0 && activeSessionIdRef.current) {
        syncSessionArchive(messages, activeSessionIdRef.current);
      }
    };
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.removeEventListener('pagehide', onUnload);
    };
  }, [messages, syncSessionArchive, role, safeUserId]);

  useEffect(() => {
    const syncSound = () => setSoundMutedState(isSoundMuted());
    syncSound();
    window.addEventListener(SOUND_MUTE_CHANGED_EVENT, syncSound);
    return () => window.removeEventListener(SOUND_MUTE_CHANGED_EVENT, syncSound);
  }, [open]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'k') {
        if (isPracticeSessionActive()) return;
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (e.key === 'Escape') {
        setOpen((prev) => {
          if (!prev) return prev;
          e.preventDefault();
          return false;
        });
      }
    };
    const onOpenEvent = () => {
      if (isPracticeSessionActive()) return;
      setOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      activeSessionIdRef.current = '';
      setActiveSessionId('');
      setMessages([]);
      setShowAllHistory(false);
      setQuery('');
      setActiveIndex(0);
      setAsking(false);
      setAttachment(null);
      setAttachError('');
      setIsDraggingOver(false);
      return;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (messages.length && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages.length, asking]);

  const roleKey = role === 'staff' ? 'admin' : (ROLE_COMMANDS[role] ? role : 'student');

  const navigatePath = useCallback((rawPath) => {
    const [pathname, hash] = String(rawPath || '').split('#');
    prefetchRouteByPath(pathname);
    if (hash) {
      navigate({ pathname, hash });
      window.location.hash = hash;
    } else {
      navigate(pathname);
    }
  }, [navigate]);

  const items = useMemo(() => {
    const q = normalizeQuickQuery(query);
    const navItems = (ROLE_COMMANDS[roleKey] || []).map((cmd) => ({
      ...cmd,
      group: 'Điều hướng nhanh',
      run: () => navigatePath(cmd.path),
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
        run: () => navigatePath(lastStudy.href),
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
            const hay = normalizeQuickQuery(`${s?.name || ''} ${s?.phone || ''} ${s?.course || ''} ${s?.sbd || ''}`);
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
                navigatePath('/teacher#students');
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
          .filter((t) => normalizeQuickQuery(`${t?.name || ''} ${t?.phone || ''} ${t?.email || ''}`).includes(q))
          .slice(0, 4);
        matchedTeachers.forEach((t) => {
          dataMatches.push({
            id: `tea-${t._id || t.id}`,
            group: 'Giảng viên',
            label: t.name || t.email || 'Giảng viên',
            hint: [t.phone, t.email].filter(Boolean).join(' · ') || 'Mở danh sách giảng viên',
            icon: Users,
            run: () => navigatePath('/admin#teachers'),
          });
        });
      }

      const matchedCourses = (Array.isArray(studentTrainingData) ? studentTrainingData : [])
        .filter((c) => normalizeQuickQuery(`${c?.title || ''} ${c?.category || ''}`).includes(q))
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
              navigatePath('/admin#student-training');
            } else if (role === 'teacher') {
              navigatePath('/teacher/finance');
            } else {
              navigatePath('/student/lesson-practice');
            }
          },
        });
      });
    }

    const baseList = [...quickActions, ...navItems].filter((item) => {
      if (!q) return true;
      return normalizeQuickQuery(`${item.label} ${item.hint} ${item.keywords || ''}`).includes(q);
    });

    return [...dataMatches, ...baseList].slice(0, 12);
  }, [open, query, role, roleKey, students, teachers, studentTrainingData, isDark, toggle, soundMuted, focusMode, toggleFocus, navigatePath]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length, query]);

  const normalizedRole = String(role || '').trim().toLowerCase();
  const questionQuotaApplies = Boolean(
    aiDailyQuota?.questionQuota?.applies ?? (normalizedRole === 'student' || normalizedRole === 'teacher'),
  );
  const rawPercentLeft = aiDailyQuota?.questionQuota?.percentLeft ?? aiDailyQuota?.questionQuota?.remaining;
  const questionQuotaLeft = rawPercentLeft != null
    ? Math.max(0, Math.min(100, Number(rawPercentLeft)))
    : 100;
  const questionQuotaBlocked = questionQuotaApplies && !(questionQuotaLeft > 0);
  const rawImageLimit = aiDailyQuota?.imageQuota?.limit;
  const imageQuotaLimit = rawImageLimit !== null
    && rawImageLimit !== undefined
    && rawImageLimit !== ''
    && Number.isFinite(Number(rawImageLimit))
    ? Number(rawImageLimit)
    : (isFreeTierStudent ? 0 : 100);
  const imageUploadDisallowed = Boolean(
    normalizedRole === 'student'
    && (aiDailyQuota?.imageQuota
      ? (aiDailyQuota.imageQuota.allowed === false || imageQuotaLimit === 0)
      : isFreeTierStudent),
  );
  const rawImgPercentLeft = aiDailyQuota?.imageQuota?.percentLeft ?? aiDailyQuota?.imageQuota?.remaining;
  const imageQuotaLeft = rawImgPercentLeft != null
    ? Math.max(0, Math.min(100, Number(rawImgPercentLeft)))
    : (imageUploadDisallowed ? 0 : questionQuotaLeft);
  const isVisionAttachment = Boolean(attachment?.isImage || attachment?.mimeType === 'application/pdf');
  const imageQuotaBlocked = Boolean(
    isVisionAttachment
    && (imageUploadDisallowed || (aiDailyQuota?.imageQuota && !(imageQuotaLeft > 0))),
  );
  const freeStudentImageBlockMsg = t(
    'Tài khoản miễn phí không hỗ trợ gửi hình ảnh cho DewSkill AI. Bạn có thể hỏi bằng chữ hoặc nâng cấp gói.',
  );

  const handlePickedQuickFile = useCallback(async (file) => {
    if (!file) return;
    setAttachError('');
    const pickedName = String(file.name || '').trim();
    const pickedMime = String(file.type || '').toLowerCase();
    const isPickedVision = pickedMime.startsWith('image/')
      || QUICK_IMAGE_EXT_RE.test(pickedName)
      || pickedMime === 'application/pdf'
      || QUICK_PDF_EXT_RE.test(pickedName);
    if (imageUploadDisallowed && isPickedVision) {
      setAttachError(freeStudentImageBlockMsg);
      return;
    }
    try {
      const processed = await processQuickAttachFile(file);
      if (processed) {
        setAttachment(processed);
        window.setTimeout(() => inputRef.current?.focus(), 20);
      }
    } catch (err) {
      setAttachError(err?.message || t('Không đọc được tệp đã chọn'));
    }
  }, [freeStudentImageBlockMsg, imageUploadDisallowed, t]);

  const handleFileInputChange = useCallback((e) => {
    const file = e.target?.files?.[0];
    if (file) {
      void handlePickedQuickFile(file);
    }
    if (e.target) {
      e.target.value = '';
    }
  }, [handlePickedQuickFile]);

  const handlePaste = useCallback((e) => {
    const dt = e?.clipboardData;
    if (!dt) return;
    let pickedFile = null;
    if (dt.items && dt.items.length) {
      for (let i = 0; i < dt.items.length; i += 1) {
        const item = dt.items[i];
        if (item.kind === 'file') {
          const f = item.getAsFile?.();
          if (f) {
            pickedFile = f;
            break;
          }
        }
      }
    }
    if (!pickedFile && dt.files && dt.files.length) {
      pickedFile = dt.files[0];
    }
    if (!pickedFile) return;
    e.preventDefault();
    void handlePickedQuickFile(pickedFile);
  }, [handlePickedQuickFile]);

  const askAiQuestion = useCallback(async (rawText, rawAttachment = attachment) => {
    const question = String(rawText || '').trim();
    const activeAttachment = rawAttachment || null;
    if ((!question && !activeAttachment) || asking) return;
    if (questionQuotaBlocked) {
      setAttachError(t('Bạn đã dùng hết 100% hạn mức AI hôm nay (còn 0%) — tự động reset lúc 00:00.'));
      return;
    }
    const activeIsVision = Boolean(activeAttachment?.isImage || activeAttachment?.mimeType === 'application/pdf');
    if (activeIsVision && (imageUploadDisallowed || (aiDailyQuota?.imageQuota && !(imageQuotaLeft > 0)))) {
      setAttachError(
        imageUploadDisallowed
          ? freeStudentImageBlockMsg
          : t('Bạn đã dùng hết 100% hạn mức AI hôm nay (còn 0%) — tự động reset lúc 00:00.'),
      );
      return;
    }

    const isNewThread = messages.length === 0;
    let targetSessionId = activeSessionIdRef.current || activeSessionId;
    if (!targetSessionId && isQuickAskPersistenceRole(role)) {
      const rotated = beginNewQuickAskSession(role, safeUserId);
      targetSessionId = rotated.activeSessionId;
      activeSessionIdRef.current = targetSessionId;
      setActiveSessionId(targetSessionId);
      setSessionArchive(rotated);
    }

    const userMsg = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: question,
      ...(activeAttachment ? { attachment: activeAttachment } : {}),
    };
    const priorHistory = messages.slice(-8).map((m) => ({
      role: m.role,
      text: m.text || (m.attachment?.name ? `[Đính kèm: ${m.attachment.name}]` : ''),
    }));
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    syncSessionArchive(nextHistory, targetSessionId);
    setQuery('');
    setAttachment(null);
    setAttachError('');
    setAsking(true);

    const touchRecentQuestion = (q) => {
      if (!isNewThread) return;
      const text = String(q || '').trim();
      if (!text) return;
      rememberQuickAskQuestion(text, role, safeUserId);
    };

    let failedErrorType = null;
    try {
      const res = await aiSupportAPI.quickAsk({
        question,
        history: priorHistory,
        preferredLang: language,
        attachment: activeAttachment,
      });
      if (res?.success === false) {
        failedErrorType = 'other';
        const quotaCode = res?.code;
        if (quotaCode === 'AI_QUESTION_QUOTA' || quotaCode === 'AI_IMAGE_QUOTA') {
          setMessages(messages);
          if (messages.length > 0) {
            syncSessionArchive(messages, targetSessionId);
          } else if (isQuickAskPersistenceRole(role)) {
            setSessionArchive(loadQuickAskSessionArchive(role, safeUserId));
          }
          setQuery(question);
          if (activeAttachment && quotaCode === 'AI_QUESTION_QUOTA') {
            setAttachment(activeAttachment);
          }
          setAttachError(res?.message || 'Bạn đã dùng hết 100% hạn mức AI hôm nay.');
          setAiDailyQuota((prev) => {
            const base = prev || {};
            const nextQuestionQuota = res?.questionQuota || base.questionQuota;
            const nextImageQuota = res?.imageQuota || base.imageQuota;
            if (quotaCode === 'AI_QUESTION_QUOTA') {
              return {
                ...base,
                questionQuota: {
                  ...(nextQuestionQuota || {}),
                  applies: true,
                  mode: 'percent',
                  limit: 100,
                  remaining: 0,
                  percentLeft: 0,
                  used: 100,
                  percentUsed: 100,
                },
                ...(nextImageQuota ? { imageQuota: nextImageQuota } : {}),
              };
            }
            const rawImgLim = nextImageQuota?.limit;
            const imgLim = rawImgLim !== null && rawImgLim !== undefined && rawImgLim !== '' && Number.isFinite(Number(rawImgLim))
              ? Number(rawImgLim)
              : (isFreeTierStudent ? 0 : 100);
            const nextLeft = imgLim === 0 ? 0 : (nextImageQuota?.percentLeft ?? nextImageQuota?.remaining ?? 0);
            return {
              ...base,
              ...(nextQuestionQuota ? { questionQuota: nextQuestionQuota } : {}),
              imageQuota: {
                ...(nextImageQuota || {}),
                applies: true,
                mode: 'percent',
                allowed: nextImageQuota?.allowed !== undefined ? nextImageQuota.allowed : imgLim > 0,
                limit: imgLim,
                remaining: nextLeft,
                percentLeft: nextLeft,
                used: imgLim === 0 ? 100 : (nextImageQuota?.used ?? 100),
              },
            };
          });
          return;
        }
      } else {
        const payload = res?.data || res;
        const answerText = String(payload?.answer || '').trim();
        if (payload?.questionQuota || payload?.imageQuota) {
          setAiDailyQuota({
            questionQuota: payload.questionQuota,
            imageQuota: payload.imageQuota,
          });
        }
        if (answerText) {
          touchRecentQuestion(question);
          setMessages((prev) => {
            const next = [
              ...prev,
              {
                id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                role: 'assistant',
                text: answerText,
                question,
                source: payload?.source || 'ai',
                model: payload?.model || '',
                actions: Array.isArray(payload?.actions) ? payload.actions : [],
              },
            ];
            syncSessionArchive(next, targetSessionId);
            return next;
          });
          return;
        }
      }
    } catch (err) {
      const msgStr = String(err?.message || err?.name || '').toLowerCase();
      failedErrorType = /timeout|abort/.test(msgStr) ? 'timeout' : 'network';
      void aiSupportAPI.reportQuickAskClientError({ errorType: failedErrorType });
    } finally {
      setAsking(false);
    }

    const localFallback = question ? matchLocalOfficeMemory(question, language) : null;
    if (localFallback) touchRecentQuestion(question);
    setMessages((prev) => {
      const next = [
        ...prev,
        localFallback
          ? {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            role: 'assistant',
            text: localFallback.answer,
            question,
            source: 'memory',
            model: '',
            actions: localFallback.actions || [],
          }
          : {
            id: `a_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            role: 'assistant',
            text: failedErrorType === 'timeout'
              ? (language === 'en'
                ? 'Request to DewSkill AI timed out. Please try again.'
                : 'Yêu cầu tới DewSkill AI bị quá thời gian chờ. Bạn bấm thử lại nhé.')
              : (language === 'en'
                ? 'Unable to connect to DewSkill AI right now. Please try again shortly.'
                : 'Chưa kết nối được DewSkill AI lúc này. Bạn vui lòng thử lại sau ít giây nhé.'),
            question,
            source: 'fallback',
            retryQuestion: question,
            retryAttachment: activeAttachment,
            actions: [],
          },
      ];
      syncSessionArchive(next, targetSessionId);
      return next;
    });
  }, [
    activeSessionId,
    aiDailyQuota,
    asking,
    attachment,
    freeStudentImageBlockMsg,
    imageQuotaLeft,
    imageUploadDisallowed,
    isFreeTierStudent,
    language,
    messages,
    questionQuotaBlocked,
    role,
    safeUserId,
    syncSessionArchive,
    t,
  ]);

  const starterPrompts = STARTER_PROMPTS[roleKey] || STARTER_PROMPTS.student;
  const sessionList = useMemo(
    () => listQuickAskSessions(sessionArchive, {
      includeAll: showAllHistory,
      previewLimit: SESSION_LIST_PREVIEW,
    }),
    [sessionArchive, showAllHistory],
  );

  const primaryNavItems = useMemo(() => {
    const resumeItem = items.find((item) => item.id === 'act-resume-last');
    const navOnly = items.filter((item) => item.group === 'Điều hướng nhanh');
    if (resumeItem) return [resumeItem, ...navOnly.slice(0, 2)];
    return navOnly.slice(0, 3);
  }, [items]);

  const landingListItems = useMemo(() => {
    const q = query.trim();
    if (q || attachment) return items.slice(0, 8);
    return primaryNavItems;
  }, [items, primaryNavItems, query, attachment]);

  if (!open || typeof document === 'undefined') return null;

  const isChatMode = messages.length > 0 || asking;
  const trimmedQuery = query.trim();
  const canSend = Boolean(trimmedQuery || attachment) && !asking && !questionQuotaBlocked && !imageQuotaBlocked;
  const composerPlaceholder = getAiComposerPlaceholder(roleKey, language, 'initial');
  const composerContinuePlaceholder = getAiComposerPlaceholder(roleKey, language, 'continue');
  const composerAttachPlaceholder = getAiComposerPlaceholder(roleKey, language, 'attach');

  const executeItem = (item) => {
    if (!item) return;
    setOpen(false);
    item.run?.();
  };

  const openSavedSession = (session) => {
    if (!session) return;
    const nextArchive = isQuickAskPersistenceRole(role)
      ? activateQuickAskSession(session.id, role, safeUserId)
      : sessionArchive;
    setSessionArchive(nextArchive);
    activeSessionIdRef.current = session.id;
    setActiveSessionId(session.id);
    setMessages(Array.isArray(session.messages) ? session.messages : []);
    setShowAllHistory(false);
    setQuery('');
    setAttachment(null);
    setAttachError('');
    setAsking(false);
    window.setTimeout(() => {
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      }
      inputRef.current?.focus();
    }, 40);
  };

  const startNewChat = () => {
    if (isQuickAskPersistenceRole(role)) {
      setSessionArchive(beginNewQuickAskSession(role, safeUserId));
    }
    activeSessionIdRef.current = '';
    setActiveSessionId('');
    setMessages([]);
    setShowAllHistory(false);
    setQuery('');
    setAttachment(null);
    setAttachError('');
    setAsking(false);
    window.setTimeout(() => inputRef.current?.focus(), 20);
  };

  const returnToLanding = () => {
    if (isQuickAskPersistenceRole(role)) {
      setSessionArchive(loadQuickAskSessionArchive(role, safeUserId));
    }
    activeSessionIdRef.current = '';
    setActiveSessionId('');
    setMessages([]);
    setShowAllHistory(false);
    setQuery('');
    setAttachment(null);
    setAttachError('');
    setAsking(false);
    window.setTimeout(() => inputRef.current?.focus(), 20);
  };

  const handleDragOver = (e) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e) => {
    if (e.dataTransfer?.files?.length) {
      e.preventDefault();
      setIsDraggingOver(false);
      void handlePickedQuickFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (!isChatMode && trimmedQuery && !attachment) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (items.length ? (prev - 1 + items.length) % items.length : 0));
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!trimmedQuery && !attachment) return;
      if (attachment || isChatMode || items.length === 0 || isLikelyQuestion(trimmedQuery)) {
        void askAiQuestion(trimmedQuery, attachment);
      } else if (items[activeIndex]) {
        executeItem(items[activeIndex]);
      } else {
        void askAiQuestion(trimmedQuery, attachment);
      }
    }
  };

  const renderComposerPill = (placeholderText) => (
    <div>
      <div className="rounded-[24px] border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 shadow-[0_8px_30px_rgba(15,23,42,0.08)] focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 dark:focus-within:ring-emerald-950/60 transition">
        <input
          ref={fileInputRef}
          type="file"
          accept={imageUploadDisallowed
            ? '.txt,.csv,.tsv,.json,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx'
            : 'image/*,.pdf,.txt,.csv,.tsv,.json,.md,.doc,.docx,.xls,.xlsx,.ppt,.pptx'}
          onChange={handleFileInputChange}
          className="hidden"
        />
        {attachment ? (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/40 px-2.5 py-1.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {attachment.isImage && attachment.previewUrl ? (
                <img
                  src={attachment.previewUrl}
                  alt={attachment.name || 'Ảnh đính kèm'}
                  className="h-11 w-11 shrink-0 rounded-xl border border-emerald-200/70 object-cover bg-white"
                />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-700 dark:text-emerald-300">
                  <FileText size={18} />
                </span>
              )}
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                  {attachment.name || t('Ảnh đính kèm')}
                </div>
                <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                  {[attachment.isImage ? t('Hình ảnh') : t('Tệp đính kèm'), formatQuickFileSize(attachment.size)]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setAttachment(null);
                setAttachError('');
              }}
              aria-label={t('Gỡ tệp đính kèm')}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/90 dark:bg-slate-800 text-slate-500 hover:text-rose-600 transition cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
        ) : null}
        {attachError ? (
          <div className="mb-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-[11.5px] font-semibold text-rose-600 dark:text-rose-300">
            {attachError}
          </div>
        ) : null}
        {attachment?.isImage && !attachError ? (
          <p className="mb-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            {t('Mẹo: chụp rõ màn hình + một câu mô tả — mỗi lần gửi có ảnh tính 1 lượt AI và 1 lần gửi ảnh.')}
          </p>
        ) : null}
        <div className="flex items-center gap-2.5">
          <Search size={17} className="shrink-0 text-slate-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={attachment ? composerAttachPlaceholder : placeholderText}
            className="w-full min-w-0 bg-transparent text-[14px] font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
          />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title={t('Đính kèm ảnh hoặc tệp (hoặc dán Ctrl+V)')}
              aria-label={t('Đính kèm ảnh hoặc tệp')}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-100 hover:text-emerald-700 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <Plus size={15} />
            </button>
            <span className="truncate text-[11px] font-medium text-slate-400">
              {imageUploadDisallowed
                ? t('Đính kèm tệp văn bản (tài khoản miễn phí không gửi ảnh)')
                : t('Dán ảnh | Tệp tin (Bấm dấu cột hoặc CTRL + V)')}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden sm:inline text-[11px] font-medium text-slate-400">
              Ctrl / ⌘ + K
            </span>
            <button
              type="button"
              disabled={!canSend}
              onClick={() => void askAiQuestion(trimmedQuery, attachment)}
              aria-label="Gửi câu hỏi cho AI"
              className={`flex h-8 w-8 items-center justify-center rounded-full transition ${canSend
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm cursor-pointer'
                : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-400 cursor-not-allowed'
                }`}
            >
              <ArrowUp size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
      <AiUsageIndicator
        applies={questionQuotaApplies}
        percentLeft={questionQuotaLeft}
        resetInMs={aiDailyQuota?.questionQuota?.resetInMs}
        resetsAt={aiDailyQuota?.questionQuota?.resetsAt}
        imageDisallowed={imageUploadDisallowed}
        isFreeTier={isFreeTierStudent}
        isEn={language === 'en'}
        className="mt-1.5 pl-2.5"
      />
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-900/50 px-3 py-4 backdrop-blur-xs"
      onClick={() => setOpen(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="DewSkill AI, trợ lý cá nhân và tìm kiếm nhanh"
        onClick={(e) => e.stopPropagation()}
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border bg-[var(--cms-surface,#ffffff)] shadow-2xl max-h-[84vh] transition ${isDraggingOver
          ? 'border-emerald-500 ring-4 ring-emerald-400/25'
          : 'border-slate-200/90 dark:border-slate-800'
          }`}
      >
        {isChatMode ? (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <DewSkillAiOrb size={28} />
                <div className="flex items-center gap-1.5">
                  <span className="text-[15px] font-extrabold text-slate-900 dark:text-white">DewSkill AI</span>
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white" aria-hidden="true">
                    <Check size={10} strokeWidth={3} />
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={returnToLanding}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <History size={12} />
                  <span>{language === 'en' ? 'History' : 'Lịch sử'}</span>
                </button>
                <button
                  type="button"
                  onClick={startNewChat}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition cursor-pointer"
                >
                  <Plus size={12} />
                  <span>{language === 'en' ? 'New chat' : 'Chat mới'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Đóng bảng lệnh"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 transition cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.map((msg) => (
                msg.role === 'user' ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[82%] rounded-[20px] bg-emerald-600 px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-xs">
                      {msg.attachment ? (
                        msg.attachment.isImage && msg.attachment.previewUrl ? (
                          <img
                            src={msg.attachment.previewUrl}
                            alt={msg.attachment.name || 'Ảnh đính kèm'}
                            className={`max-h-48 max-w-full rounded-xl object-contain bg-white/10 ${msg.text ? 'mb-2' : ''}`}
                          />
                        ) : (
                          <div className={`inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-2.5 py-1 text-xs font-bold ${msg.text ? 'mb-2' : ''}`}>
                            <FileText size={13} />
                            <span className="truncate max-w-[220px]">{msg.attachment.name || t('Tệp đính kèm')}</span>
                          </div>
                        )
                      ) : null}
                      {msg.text ? <div>{msg.text}</div> : null}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex justify-start">
                    <div className="min-w-0 max-w-[90%] rounded-[20px] bg-slate-100/90 dark:bg-slate-800/90 px-4 py-3.5">
                      <div className="mb-1.5 flex items-center gap-1.5">
                        {msg.source === 'memory' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300">
                            <Zap size={10} />
                            <span>Bộ nhớ nhanh</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 dark:bg-sky-950/80 px-2 py-0.5 text-[10.5px] font-bold text-sky-700 dark:text-sky-300">
                            <Sparkles size={10} />
                            <span>DewSkill AI</span>
                          </span>
                        )}
                      </div>
                      <AiMarkdownMessage text={msg.text} />
                      {Array.isArray(msg.actions) && msg.actions.length > 0 ? (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {msg.actions.map((act) => {
                            const actionPath = act.path || act.href;
                            return (
                              <button
                                key={`${actionPath}-${act.label}`}
                                type="button"
                                onClick={() => {
                                  setOpen(false);
                                  if (actionPath) navigatePath(actionPath);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition cursor-pointer"
                              >
                                <span>{act.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      {msg.source === 'fallback' && (msg.retryQuestion || msg.retryAttachment) ? (
                        <div className="mt-2.5">
                          <button
                            type="button"
                            disabled={asking}
                            onClick={() => void askAiQuestion(msg.retryQuestion || '', msg.retryAttachment || null)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition cursor-pointer disabled:opacity-60"
                          >
                            <RefreshCw size={12} />
                            <span>{language === 'en' ? 'Retry' : 'Thử lại'}</span>
                          </button>
                        </div>
                      ) : null}
                      {msg.source !== 'fallback' ? (
                        <QuickAiFeedbackBar msg={msg} language={language} />
                      ) : null}
                    </div>
                  </div>
                )
              ))}

              {asking ? (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-[20px] bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <Sparkles size={14} className="animate-pulse text-emerald-600" />
                    <span>DewSkill AI đang suy nghĩ…</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/50 dark:bg-slate-950/40">
              {renderComposerPill(composerContinuePlaceholder)}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng bảng lệnh"
              className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 transition cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="overflow-y-auto px-5 pb-5 pt-6 max-h-[min(72vh,640px)]">
              <div className="mx-auto flex max-w-xl items-center gap-3">
                <DewSkillAiOrb size={40} />
                <div className="min-w-0 text-left">
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    DewSkill AI
                  </h2>
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {language === 'en'
                      ? 'Personal IT & LMS assistant · 30-day history'
                      : 'Trợ lý cá nhân · lịch sử lưu 30 ngày'}
                  </p>
                </div>
              </div>

              <div className="mx-auto mt-3 max-w-xl">
                {renderComposerPill(composerPlaceholder)}
              </div>

              {!trimmedQuery && !attachment && sessionList.totalCount > 0 ? (
                <div className="mx-auto mt-3.5 max-w-xl">
                  <div className="mb-1.5 flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {language === 'en' ? 'Recent chats' : 'Lịch sử gần đây'}
                    </span>
                    {showAllHistory ? (
                      <span className="text-[11px] font-medium text-slate-400">
                        {language === 'en' ? `Last 30 days (${sessionList.totalCount})` : `Trong 30 ngày (${sessionList.totalCount})`}
                      </span>
                    ) : null}
                  </div>
                  <div className={`space-y-1 ${showAllHistory ? 'max-h-60 overflow-y-auto pr-0.5' : ''}`}>
                    {sessionList.items.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => openSavedSession(session)}
                        className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/60 px-3 py-2 text-left hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30 transition cursor-pointer"
                      >
                        <span className="flex min-w-0 items-center gap-2.5">
                          <History size={14} className="shrink-0 text-slate-400" />
                          <span className="truncate text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                            {session.preview}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2 text-[11px] text-slate-400">
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-semibold text-slate-500 dark:text-slate-300">
                            {language === 'en'
                              ? `${session.messages.length} msgs`
                              : `${session.messages.length} tin`}
                          </span>
                          <span>{formatSessionRelativeTime(session.updatedAt, language)}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                  {sessionList.hasMore ? (
                    <button
                      type="button"
                      onClick={() => setShowAllHistory((prev) => !prev)}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-1 text-[11.5px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                    >
                      {showAllHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      <span>
                        {showAllHistory
                          ? (language === 'en' ? 'Show less' : 'Thu gọn')
                          : (language === 'en'
                            ? `View more (${sessionList.hiddenCount} in 30 days)`
                            : `Xem thêm (${sessionList.hiddenCount} lịch sử trong 30 ngày)`)}
                      </span>
                    </button>
                  ) : null}
                </div>
              ) : null}

              {!trimmedQuery && !attachment && sessionList.totalCount === 0 ? (
                <div className="mx-auto mt-4 max-w-xl">
                  <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {language === 'en' ? 'Example prompts' : 'Gợi ý câu hỏi mẫu'}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {starterPrompts.map((promptText) => (
                      <button
                        key={promptText}
                        type="button"
                        onClick={() => void askAiQuestion(promptText)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/40 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition cursor-pointer"
                      >
                        <Sparkles size={12} className="shrink-0" />
                        <span>{promptText}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mx-auto mt-4 max-w-xl">
                {trimmedQuery || attachment ? (
                  <button
                    type="button"
                    onClick={() => void askAiQuestion(trimmedQuery, attachment)}
                    className="mb-2 flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/50 px-3.5 py-2.5 text-left transition hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60 cursor-pointer"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
                        <Sparkles size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-emerald-900 dark:text-emerald-100">
                          {trimmedQuery
                            ? `Hỏi DewSkill AI: “${trimmedQuery}”`
                            : t('Phân tích ảnh/tệp đính kèm với DewSkill AI')}
                        </span>
                        <span className="block truncate text-xs text-emerald-700/80 dark:text-emerald-300/80">
                          {attachment
                            ? (attachment.name || t('Ảnh đính kèm'))
                            : (language === 'en' ? 'Quick memory, then AI' : 'Bộ nhớ nhanh, rồi AI')}
                        </span>
                      </span>
                    </span>
                    <CornerDownLeft size={14} className="shrink-0 text-emerald-600" />
                  </button>
                ) : null}

                {landingListItems.length > 0 ? (
                  !trimmedQuery && !attachment ? (
                    <div>
                      <div className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {language === 'en' ? 'Quick navigation' : 'Điều hướng nhanh'}
                      </div>
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                        {landingListItems.map((item) => {
                          const Icon = item.icon || Search;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => executeItem(item)}
                              className="flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/50 px-2.5 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 transition cursor-pointer"
                            >
                              <Icon size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                              <span className="truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <ul role="listbox" className="space-y-0.5">
                      {landingListItems.map((item, idx) => {
                        const Icon = item.icon || Search;
                        const active = idx === activeIndex;
                        const showGroupHeader = idx === 0 || landingListItems[idx - 1].group !== item.group;
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
                              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition cursor-pointer ${active
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-100'
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                }`}
                            >
                              <span className="flex min-w-0 items-center gap-3">
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300'
                                    }`}
                                >
                                  <Icon size={15} aria-hidden="true" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-bold leading-tight">{item.label}</span>
                                  {item.hint ? (
                                    <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">{item.hint}</span>
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
                  )
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
