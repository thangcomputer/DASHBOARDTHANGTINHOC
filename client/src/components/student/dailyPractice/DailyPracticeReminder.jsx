import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CalendarX2, Flame, Gamepad2, Play, Trophy, Users, X, Zap } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';
import { reminderCopy } from '../../../utils/dailyPractice';
import Mascot from './Mascot';

/** Popup nhắc luyện tập hằng ngày — hiện tối đa một lần mỗi ngày khi HV chưa luyện tập. */
export default function DailyPracticeReminder({ stats, topicCount, onStart, onClose }) {
  const copy = reminderCopy(stats, topicCount);
  const lost = stats?.streakState === 'lost';
  const players = stats?.todayPlayers || 0;

  useEffect(() => {
    if (lost) gameSounds.sad();
    else gameSounds.hint();
  }, [lost]);

  const tiles = lost
    ? [
      { icon: CalendarX2, value: stats?.missedDays || 0, label: 'ngày đã nghỉ', tone: 'bg-slate-100 text-slate-600', iconTone: 'text-slate-500' },
      { icon: Flame, value: stats?.lostStreak || 0, label: 'chuỗi vừa mất', tone: 'bg-orange-50 text-orange-600', iconTone: 'fill-orange-200 text-orange-400' },
      { icon: Trophy, value: stats?.bestStreak || 0, label: 'kỷ lục chuỗi', tone: 'bg-red-50 text-red-600', iconTone: 'text-red-500' },
    ]
    : [
      { icon: Flame, value: stats?.streak || 0, label: 'ngày liên tiếp', tone: 'bg-orange-50 text-orange-600', iconTone: 'fill-orange-300 text-orange-500' },
      { icon: Zap, value: stats?.xpTotal || 0, label: 'tổng XP', tone: 'bg-amber-50 text-amber-600', iconTone: 'fill-amber-300 text-amber-500' },
      { icon: Trophy, value: stats?.bestStreak || 0, label: 'kỷ lục chuỗi', tone: 'bg-red-50 text-red-600', iconTone: 'text-red-500' },
    ];

  return createPortal(
    <div className="fixed inset-0 z-[9400] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]" role="presentation">
      <div className="cms-goal-in relative w-full max-w-sm overflow-hidden rounded-[28px] bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="daily-reminder-title">
        <div className={`relative overflow-hidden px-6 pb-5 pt-7 text-center ${lost ? 'bg-gradient-to-br from-sky-50 via-white to-slate-100' : 'bg-gradient-to-br from-red-50 via-white to-amber-50'}`}>
          <span className="cms-goal-droplet left-5 top-6 h-6 w-6" aria-hidden="true" />
          <span className="cms-goal-droplet cms-goal-droplet--amber right-12 top-10 h-4 w-4 [animation-delay:1s]" aria-hidden="true" />
          <span className="cms-goal-droplet -right-3 bottom-2 h-12 w-12 [animation-delay:2s]" aria-hidden="true" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Để sau"
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-slate-500 hover:bg-white hover:text-slate-900"
          >
            <X size={18} />
          </button>
          <Mascot mood={copy.mood} size={104} className="relative mx-auto" />
          <p className={`relative mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white ${lost ? 'bg-slate-700' : 'bg-red-600'}`}>
            <Gamepad2 size={13} aria-hidden="true" /> {copy.badge}
          </p>
          <h2 id="daily-reminder-title" className="relative mt-2 text-xl font-black text-slate-900">{copy.title}</h2>
          <p className="relative mt-1.5 text-sm text-slate-600">{copy.text}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 px-5 pt-4">
          {tiles.map(({ icon: Icon, value, label, tone, iconTone }) => (
            <div key={label} className={`rounded-2xl p-2.5 text-center ${tone}`}>
              <Icon size={18} className={`mx-auto ${iconTone}`} aria-hidden="true" />
              <p className="mt-0.5 text-lg font-black tabular-nums">{value}</p>
              <p className="text-[10px] font-semibold text-slate-500">{label}</p>
            </div>
          ))}
        </div>

        {players > 0 && (
          <p className="mx-5 mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
            <Users size={14} aria-hidden="true" /> {players} học viên đã luyện tập hôm nay — đừng để bị bỏ lại!
          </p>
        )}

        <div className="flex gap-2 p-5">
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline flex-1">Để sau</button>
          <button type="button" onClick={onStart} className="cms-btn cms-btn-primary flex-[1.6]">
            <Play size={16} /> {copy.cta}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
