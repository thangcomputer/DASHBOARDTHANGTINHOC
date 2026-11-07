import { CalendarDays, GraduationCap, Presentation, Sparkles, Video } from 'lucide-react';
import studentHero from '../assets/student-hero.png';
import teacherHero from '../assets/teacher-hero.png';

const VARIANTS = {
  student: {
    image: studentHero,
    eyebrow: 'Trung tâm Thắng Tin Học',
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
      'Thành thạo tin học — mở rộng cơ hội.',
      'Kiên trì là chìa khóa của thành công.',
    ],
  },
  teacher: {
    image: teacherHero,
    eyebrow: 'Không gian giảng dạy',
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
 * nút vào lớp trên đầu nhân vật — sáng khi có link, mờ khi chưa.
 * chips: [{ icon, label, tone?: 'live' }]
 */
export default function WelcomeHero({ role = 'student', name, chips = [], joinUrl = '', joinHint = 'Chưa có link học', onJoin }) {
  const variant = VARIANTS[role] || VARIANTS.student;
  const { hour, date, dayIndex } = vnNow();
  const quote = variant.quotes[dayIndex % variant.quotes.length];
  const EyebrowIcon = variant.eyebrowIcon;

  return (
    <section className="relative min-w-0 flex-1 overflow-hidden rounded-[28px] bg-gradient-to-br from-white via-red-50/80 to-amber-50 shadow-[0_10px_30px_rgba(185,28,28,0.08)] ring-1 ring-red-100">
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]" aria-hidden="true">
        <span className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-gradient-to-br from-red-500/20 via-orange-400/15 to-amber-300/25" />
        <span className="absolute -bottom-10 right-10 h-44 w-44 rounded-full border-[10px] border-white/70" />
        <span className="absolute -left-10 -top-12 h-40 w-40 rounded-full bg-red-200/30 blur-2xl" />
        <span className="cms-goal-droplet left-[46%] top-5 h-5 w-5" />
        <span className="cms-goal-droplet cms-goal-droplet--amber left-[58%] bottom-6 h-3.5 w-3.5 [animation-delay:1.2s]" />
        <span
          className="absolute inset-y-0 right-0 w-1/2 opacity-[0.35]"
          style={{ backgroundImage: 'radial-gradient(rgba(220,38,38,0.25) 1px, transparent 1px)', backgroundSize: '14px 14px', maskImage: 'linear-gradient(90deg, transparent, black 60%)', WebkitMaskImage: 'linear-gradient(90deg, transparent, black 60%)' }}
        />
      </div>

      <div className="relative min-h-[226px] min-w-0 px-5 py-5 pr-[148px] sm:min-h-[248px] sm:px-7 sm:py-6 sm:pr-[200px] lg:pr-[290px]">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-red-600 ring-1 ring-red-100">
          <EyebrowIcon size={13} aria-hidden="true" /> {variant.eyebrow}
        </p>
        <p className="mt-3 text-sm font-bold text-slate-500">{greetingFor(hour)} 👋</p>
        <h1 className="mt-0.5 break-words text-[26px] font-black leading-tight tracking-tight sm:text-[32px]">
          <span className="bg-gradient-to-r from-red-700 via-red-600 to-orange-500 bg-clip-text text-transparent">{name || variant.fallbackName}</span>
        </h1>
        <p className="mt-1.5 flex items-start gap-1.5 text-sm italic text-slate-500">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-amber-500" aria-hidden="true" /> “{quote}”
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-slate-600 shadow-sm ring-1 ring-slate-100">
            <CalendarDays size={13} className="text-red-500" aria-hidden="true" />
            <span className="first-letter:uppercase">{date}</span>
          </span>
          {chips.filter((chip) => chip?.label).map(({ icon: Icon, label, tone }) => (
            <span
              key={label}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 shadow-sm ring-1 ${tone === 'live' ? 'bg-red-600 text-white ring-red-600' : 'bg-white text-slate-600 ring-slate-100'}`}
            >
              {tone === 'live'
                ? <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-emerald-300" aria-hidden="true" />
                : Icon && <Icon size={13} className="shrink-0 text-red-500" aria-hidden="true" />}
              <span className="truncate">{label}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 right-3 flex flex-col items-center sm:right-6">
        {(onJoin || joinUrl || joinHint) && <div className="mb-1.5">
          {onJoin || joinUrl ? (
            onJoin ? (
              <button
                type="button"
                onClick={onJoin}
                className="relative isolate flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-b from-red-500 to-red-700 px-3.5 py-2 text-xs font-black text-white shadow-[0_8px_18px_rgba(185,28,28,0.45),inset_0_1px_2px_rgba(255,255,255,0.45)] ring-2 ring-white transition hover:scale-105 sm:text-sm"
              >
                <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-red-400/60" aria-hidden="true" />
                <Video size={15} aria-hidden="true" /> {variant.joinLabel}
              </button>
            ) : (
            <a
              href={joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="relative isolate flex items-center gap-1.5 whitespace-nowrap rounded-full bg-gradient-to-b from-red-500 to-red-700 px-3.5 py-2 text-xs font-black text-white shadow-[0_8px_18px_rgba(185,28,28,0.45),inset_0_1px_2px_rgba(255,255,255,0.45)] ring-2 ring-white transition hover:scale-105 sm:text-sm"
            >
              <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-red-400/60" aria-hidden="true" />
              <Video size={15} aria-hidden="true" /> {variant.joinLabel}
            </a>
            )
          ) : (
            <span
              aria-disabled="true"
              title={joinHint}
              className="flex cursor-not-allowed items-center gap-1.5 whitespace-nowrap rounded-full bg-white/35 px-3.5 py-2 text-xs font-black text-slate-700 ring-1 ring-white/80 sm:text-sm"
            >
              <Video size={15} className="opacity-70" aria-hidden="true" /> {joinHint}
            </span>
          )}
        </div>}
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute right-[88%] top-12 hidden whitespace-nowrap rounded-2xl rounded-br-sm bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-md ring-1 ring-slate-100 lg:block">
            {onJoin || joinUrl ? variant.bubbleLive : variant.bubbleIdle}
          </span>
          <span aria-hidden="true" className="pointer-events-none absolute bottom-1 left-1/2 h-3 w-20 -translate-x-1/2 rounded-full bg-slate-900/15 blur-[3px]" />
          <img src={variant.image} alt="" aria-hidden="true" className="pointer-events-none relative h-[168px] w-auto drop-shadow-[0_10px_14px_rgba(15,23,42,0.18)] sm:h-[192px]" />
        </div>
      </div>
    </section>
  );
}
