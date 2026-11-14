import { CalendarDays, GraduationCap, Presentation, Sparkles, Video } from 'lucide-react';
import studentHero from '../assets/student-hero.png';
import teacherHero from '../assets/teacher-hero.png';

const VARIANTS = {
  student: {
    image: studentHero,
    eyebrow: 'Trung tâm Thắng Tin Học',
    eyebrowFree: 'TRUNG TÂM THẮNG TIN HỌC',
    eyebrowIcon: GraduationCap,
    fallbackName: 'Học viên',
    joinLabel: 'Vào học ngay',
    bubbleIdle: 'Cùng học nào! 🚀',
    bubbleLive: 'Vào lớp thôi! 🎉',
    quotes: [
      'Học hôm nay, thành công mai sau.',
      'Mỗi ngày một chút, giỏi lên từng ngày.',
      'Kiến thức là hành trang theo bạn suốt đời.',
      'Chăm chỉ hôm nay là tự tin ngày mai.',
      'Không có gì là khó nếu bạn bắt đầu.',
      'Thành thạo tin học - mở rộng cơ hội.',
      'Kiên trì là chìa khóa của thành công.',
    ],
  },
  teacher: {
    image: teacherHero,
    eyebrow: 'Không gian giảng dạy',
    eyebrowFree: 'KHÔNG GIAN GIẢNG DẠY',
    eyebrowIcon: Presentation,
    fallbackName: 'Giảng viên',
    joinLabel: 'Vào dạy ngay',
    bubbleIdle: 'Sẵn sàng lên lớp! 📚',
    bubbleLive: 'Học viên đang chờ! 🎉',
    quotes: [
      'Mỗi buổi dạy là một hạt giống tri thức.',
      'Người thầy giỏi thắp lên niềm đam mê học tập.',
      'Dạy bằng tâm, học viên sẽ nhớ bằng tim.',
      'Một lời khen đúng lúc giúp học viên tiến xa.',
      'Kiên nhẫn là phẩm chất quý nhất của người thầy.',
      'Học viên tiến bộ là niềm vui của người dạy.',
      'Truyền cảm hứng trước, truyền kiến thức sau.',
    ],
  },
};

/** Màu thẻ chào: brand = LMS đỏ; emerald = cổng tự đăng ký & giảng viên (khớp mobile). */
const ACCENT = {
  brand: {
    section: 'bg-gradient-to-br from-white via-red-50/80 to-amber-50 shadow-[0_10px_30px_rgba(185,28,28,0.08)] ring-red-100',
    blob: 'bg-gradient-to-br from-emerald-500/20 via-orange-400/15 to-amber-300/25',
    glow: 'bg-red-200/30',
    dotGrid: 'rgba(220,38,38,0.25)',
    eyebrow: 'text-red-700 bg-red-50 border border-red-200',
    name: 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-orange-500 bg-clip-text text-transparent',
    chipIcon: 'text-red-500',
    chipLive: 'bg-red-600 text-white border border-red-500 border-b-2 border-b-red-800 font-black',
    join: 'bg-emerald-600 border border-emerald-500 border-b-4 border-b-red-800',
    joinPing: 'bg-red-400/60',
  },
  emerald: {
    section: 'border border-emerald-200/70 bg-gradient-to-br from-white via-[#ECFDF5] to-[#D1FAE5]/40 shadow-[0_10px_24px_rgba(4,120,87,0.06)] ring-1 ring-emerald-100',
    blob: 'bg-gradient-to-br from-emerald-500/20 via-emerald-400/15 to-teal-300/20',
    glow: 'bg-emerald-200/30',
    dotGrid: 'rgba(5,150,105,0.18)',
    eyebrow: 'text-emerald-800 bg-emerald-50 border border-emerald-200/90',
    name: 'bg-gradient-to-r from-emerald-800 via-emerald-600 to-teal-600 bg-clip-text text-transparent',
    chipIcon: 'text-emerald-600',
    chipLive: 'bg-[#10B981] text-white border border-[#34D399] border-b-2 border-b-[#059669] font-black',
    join: 'bg-[#10B981] border border-[#34D399] border-b-4 border-b-[#059669]',
    joinPing: 'bg-emerald-400/55',
  },
};

function vnNow() {
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }).format(now));
  const date = now.toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
  });
  const dayIndex = Math.floor((now.getTime() + 7 * 3600e3) / 86400e3);
  return { hour, date, dayIndex };
}

function greetingFor(hour) {
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 13) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

/**
 * Thẻ chào mừng trang Tổng quan (học viên / giảng viên): tên đầy đủ, hình hoạt hình theo vai trò,
 * nút vào lớp trên đầu nhân vật - sáng khi có link, mờ khi chưa.
 * chips: [{ icon, label, tone?: 'live' }]
 * accent: 'brand' | 'emerald' — emerald cho học viên cổng tự đăng ký.
 */
export default function WelcomeHero({
  role = 'student',
  name,
  chips = [],
  joinUrl = '',
  joinHint = 'Chưa có link học',
  onJoin,
  showJoin = true,
  accent,
}) {
  const isFreePortal = (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-free-portal-student'));
  const effectiveAccent = accent || (role === 'teacher' || isFreePortal ? 'emerald' : 'brand');
  const variant = VARIANTS[role] || VARIANTS.student;
  const theme = ACCENT[effectiveAccent] || ACCENT.brand;
  const { hour, date, dayIndex } = vnNow();
  const quote = variant.quotes[dayIndex % variant.quotes.length];
  const EyebrowIcon = variant.eyebrowIcon;
  const eyebrowLabel = effectiveAccent === 'emerald' ? variant.eyebrowFree : variant.eyebrow;
  const joinClass = `relative isolate flex items-center gap-1.5 whitespace-nowrap rounded-2xl ${theme.join} px-4 py-2 text-xs font-black text-white hover:brightness-105 active:translate-y-[2px] active:border-b-2 shadow-xs transition-all sm:text-sm cursor-pointer`;

  return (
    <section className={`relative min-w-0 flex-1 overflow-hidden rounded-[26px] ring-1 ${theme.section}`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]" aria-hidden="true">
        <span className={`absolute -bottom-24 -right-16 h-72 w-72 rounded-full ${theme.blob}`} />
        <span className="absolute -bottom-10 right-10 h-44 w-44 rounded-full border-[10px] border-white/70" />
        <span className={`absolute -left-10 -top-12 h-40 w-40 rounded-full blur-2xl ${theme.glow}`} />
        <span
          className="absolute inset-y-0 right-0 w-1/2 opacity-[0.35]"
          style={{
            backgroundImage: `radial-gradient(${theme.dotGrid} 1px, transparent 1px)`,
            backgroundSize: '14px 14px',
            maskImage: 'linear-gradient(90deg, transparent, black 60%)',
            WebkitMaskImage: 'linear-gradient(90deg, transparent, black 60%)',
          }}
        />
      </div>

      <div className="relative min-h-[226px] min-w-0 px-5 py-5 pr-[148px] sm:min-h-[248px] sm:px-7 sm:py-6 sm:pr-[200px] lg:pr-[290px]">
        <p className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-black tracking-wider shadow-xs ${theme.eyebrow} ${effectiveAccent === 'emerald' ? 'uppercase' : ''}`}>
          <EyebrowIcon size={13} aria-hidden="true" className={effectiveAccent === 'emerald' ? 'text-emerald-700' : 'text-red-700'} /> {eyebrowLabel}
        </p>
        <p className="mt-3 text-sm font-bold text-slate-500">{greetingFor(hour)} 👋</p>
        <h1 className="mt-0.5 break-words text-[26px] font-black leading-tight tracking-tight sm:text-[32px]">
          <span className={theme.name}>{name || variant.fallbackName}</span>
        </h1>
        <p className="mt-1.5 flex items-start gap-1.5 text-sm italic text-slate-500">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" /> “{quote}”
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 border-b-2 border-b-slate-200 bg-white px-3 py-1.5 text-slate-700 font-extrabold shadow-xs">
            <CalendarDays size={13} className={theme.chipIcon} aria-hidden="true" />
            <span className="first-letter:uppercase">{date}</span>
          </span>
          {chips.filter((chip) => chip?.label).map(({ icon: Icon, label, tone }) => (
            <span
              key={label}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-xl px-3 py-1.5 shadow-xs ${
                tone === 'live' ? theme.chipLive : 'bg-white text-slate-700 border border-slate-200/90 border-b-2 border-b-slate-200 font-bold'
              }`}
            >
              {tone === 'live'
                ? <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-white" aria-hidden="true" />
                : Icon && <Icon size={13} className={`shrink-0 ${theme.chipIcon}`} aria-hidden="true" />}
              <span className="truncate">{label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 right-3 flex flex-col items-center sm:right-6">
        {showJoin && (onJoin || joinUrl) && <div className="mb-1.5">
          {onJoin ? (
            <button type="button" onClick={onJoin} className={joinClass}>
              <Video size={15} aria-hidden="true" /> {variant.joinLabel}
            </button>
          ) : (
            <a href={joinUrl} target="_blank" rel="noopener noreferrer" className={joinClass}>
              <Video size={15} aria-hidden="true" /> {variant.joinLabel}
            </a>
          )}
        </div>}
        <div className="relative">
          {showJoin ? (
            <span aria-hidden="true" className="pointer-events-none absolute right-[88%] top-12 hidden whitespace-nowrap rounded-2xl rounded-br-sm bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-md ring-1 ring-slate-100 lg:block">
              {onJoin || joinUrl ? variant.bubbleLive : variant.bubbleIdle}
            </span>
          ) : null}
          <span aria-hidden="true" className="pointer-events-none absolute bottom-1 left-1/2 h-3 w-20 -translate-x-1/2 rounded-full bg-slate-900/15 blur-[3px]" />
          <img src={variant.image} alt="" aria-hidden="true" className="pointer-events-none relative h-[168px] w-auto drop-shadow-[0_10px_14px_rgba(15,23,42,0.18)] sm:h-[192px]" />
        </div>
      </div>
    </section>
  );
}
