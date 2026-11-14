import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { vnTodayKey } from '../../../utils/dailyPractice';
import { gameSounds } from '../../../utils/sound';
import Mascot from './Mascot';

const SHOW_MS = 3000;

function welcomeDayKey() {
  let id = '';
  try {
    const user = JSON.parse(localStorage.getItem('student_user') || '{}');
    id = user._id || user.id || '';
  } catch { /* ignore */ }
  return `cms_practice_welcome:${id || 'student'}`;
}

/** Lần bấm đầu tiên trong ngày mới hiện ô chào. Gọi là đã tính lần đó. */
export function takeWelcomeBackTurn() {
  const key = welcomeDayKey();
  const today = vnTodayKey();
  try {
    if (localStorage.getItem(key) === today) return false;
    localStorage.setItem(key, today);
  } catch { /* vẫn cho hiện nếu trình duyệt chặn lưu */ }
  return true;
}

/** Ô vuông chào 3 giây rồi tự vào bài. */
export default function WelcomeBackModal({
  unitIndex,
  unitTitle,
  lessonLabel,
  onEnter,
}) {
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  useEffect(() => {
    gameSounds.win();
    const timer = window.setTimeout(() => onEnterRef.current?.(), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const where = [
    unitIndex ? `Chặng ${unitIndex}` : '',
    unitTitle || '',
    lessonLabel || '',
  ].filter(Boolean).join(' · ');

  return createPortal(
    <div className="fixed inset-0 z-[9400] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]" role="presentation">
      <style>{`@keyframes dp-welcome-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
      <div
        className="cms-goal-in relative flex aspect-square w-[min(92vw,420px)] flex-col items-center justify-center overflow-hidden rounded-[32px] bg-gradient-to-br from-amber-50 via-white to-orange-50 px-6 text-center shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dp-welcome-title"
      >
        <span className="dp-twinkle absolute left-5 top-5 text-lg text-amber-400" aria-hidden="true">✦</span>
        <span className="dp-twinkle dp-twinkle-late absolute right-6 top-8 text-sm text-orange-400" aria-hidden="true">✦</span>
        <span className="dp-twinkle absolute bottom-12 right-5 text-xs text-red-400 [animation-delay:0.3s]" aria-hidden="true">✦</span>
        <div className="dp-fly-in relative">
          <span className="absolute inset-2 animate-ping rounded-full bg-amber-200/50" aria-hidden="true" />
          <Mascot mood="energy" size={156} className="relative" />
        </div>
        <p className="relative mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white">
          <Sparkles size={12} aria-hidden="true" /> Quay lại luyện tập
        </p>
        <h2 id="dp-welcome-title" className="relative mt-2 text-2xl font-black leading-tight text-slate-900">Chào mừng bạn quay lại</h2>
        <p className="relative mt-1.5 text-sm font-semibold leading-snug text-slate-600">Hãy cố gắng chinh phục bài giảng tiếp theo nào.</p>
        {where && (
          <p className="relative mt-3 line-clamp-2 max-w-full rounded-2xl bg-white/80 px-3 py-2 text-xs font-black leading-snug text-slate-800 ring-1 ring-amber-100">
            {where}
          </p>
        )}
        <span className="absolute inset-x-0 bottom-0 h-1.5 bg-amber-100" aria-hidden="true">
          <span className="block h-full origin-left bg-red-500" style={{ animation: 'dp-welcome-bar 3s linear forwards' }} />
        </span>
      </div>
    </div>,
    document.body,
  );
}
