import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, CalendarDays, Check, Clock3, Flame, Loader2, PlayCircle, Sparkles, Sprout, Target, Trophy, X } from 'lucide-react';
import lessonPracticeApi from '../../services/lessonPracticeApi';
import { useToast } from '../../utils/useToast';
import {
  LEARNING_GOAL_CHANGED_EVENT,
  LEARNING_GOAL_HOURS,
  LEARNING_GOAL_LEVELS,
  LEARNING_GOAL_PERIODS,
  goalEndDateLabel,
  goalMotivation,
  lessonResumeUrl,
} from '../../utils/learningGoal';

const PERIOD_ICONS = { week: Sprout, month: Flame, quarter: Trophy };
const CONFETTI_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#0EA5E9', '#A855F7', '#F97316'];
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2;
  const distance = 95 + (i % 3) * 28;
  return {
    dx: `${Math.round(Math.cos(angle) * distance)}px`,
    dy: `${Math.round(Math.sin(angle) * distance)}px`,
    rot: `${(i % 2 ? 1 : -1) * (180 + i * 25)}deg`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: `${(i % 4) * 40}ms`,
  };
});
const CELEBRATE_MS = 3000;

/** Popup giữa màn hình: HV chọn 1 tuần / 1 tháng / 3 tháng và 1–5 giờ mỗi ngày. */
export default function LearningGoalModal({ open, currentGoal, onClose, onSaved }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [period, setPeriod] = useState('month');
  const [hours, setHours] = useState(2);
  const [saving, setSaving] = useState(false);
  const [celebrate, setCelebrate] = useState(null);
  /** undefined = đang tải; null = chưa có bài học dở. */
  const [resume, setResume] = useState(undefined);
  const currentGoalRef = useRef(currentGoal);
  const onSavedRef = useRef(onSaved);
  currentGoalRef.current = currentGoal;
  onSavedRef.current = onSaved;

  // Chỉ khởi tạo lại khi popup vừa mở - lưu xong currentGoal đổi nhưng phải giữ màn chúc mừng.
  useEffect(() => {
    if (!open) return;
    const goal = currentGoalRef.current;
    setCelebrate(null);
    setResume(undefined);
    setPeriod(goal?.period && !goal.expired ? goal.period : 'month');
    setHours(goal?.hoursPerDay && !goal.expired ? goal.hoursPerDay : 2);
  }, [open]);

  useEffect(() => {
    if (!celebrate) return undefined;
    let alive = true;
    lessonPracticeApi.student.resumePoint()
      .then((res) => { if (alive) setResume(res?.data?.unitId ? res.data : null); })
      .catch(() => { if (alive) setResume(null); });
    return () => { alive = false; };
  }, [celebrate]);

  // Có bài học dở thì giữ popup để HV bấm học tiếp; không có thì tự đóng sau vài giây.
  useEffect(() => {
    if (!celebrate || resume !== null) return undefined;
    const timer = setTimeout(() => onSavedRef.current?.(celebrate.data), CELEBRATE_MS);
    return () => clearTimeout(timer);
  }, [celebrate, resume]);

  const continueLearning = () => {
    if (!resume) return;
    onSaved?.(celebrate?.data);
    navigate(lessonResumeUrl(resume));
  };

  if (!open) return null;

  const selectedPeriod = LEARNING_GOAL_PERIODS.find((p) => p.id === period) || LEARNING_GOAL_PERIODS[1];
  const level = LEARNING_GOAL_LEVELS[hours] || LEARNING_GOAL_LEVELS[2];
  const editing = Boolean(currentGoal && !currentGoal.expired);
  const endDate = goalEndDateLabel(selectedPeriod.days);

  const save = async () => {
    setSaving(true);
    try {
      const res = await lessonPracticeApi.student.setLearningGoal(period, hours);
      window.dispatchEvent(new CustomEvent(LEARNING_GOAL_CHANGED_EVENT, { detail: res?.data || null }));
      setCelebrate({ data: res?.data || null, label: `${hours} giờ/ngày · ${selectedPeriod.label}`, endDate });
    } catch (err) {
      toast.error(err.message || 'Không lưu được mục tiêu');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9400] flex items-center justify-center bg-slate-950/55 p-2.5 sm:p-4 backdrop-blur-[2px]" role="presentation">
      <div
        className="cms-goal-in relative flex max-h-[94dvh] w-full max-w-sm sm:max-w-md flex-col overflow-hidden rounded-[22px] sm:rounded-[26px] bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="learning-goal-title"
      >
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-red-50 via-white to-amber-50 px-4 sm:px-6 pb-3.5 sm:pb-4 pt-4 sm:pt-5 text-center">
          <span className="cms-goal-droplet left-5 top-4 h-5 w-5 opacity-60" aria-hidden="true" />
          <span className="cms-goal-droplet cms-goal-droplet--amber left-12 top-10 h-2.5 w-2.5 opacity-60 [animation-delay:1.4s]" aria-hidden="true" />
          <span className="cms-goal-droplet right-12 top-8 h-3 w-3 opacity-60 [animation-delay:0.7s]" aria-hidden="true" />
          <span className="cms-goal-droplet cms-goal-droplet--amber -right-2 bottom-2 h-8 w-8 opacity-40 [animation-delay:2.1s]" aria-hidden="true" />
          <span className="cms-goal-droplet -left-3 bottom-0 h-7 w-7 opacity-40 [animation-delay:3s]" aria-hidden="true" />
          {!celebrate && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Để sau"
              className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-white/80 text-slate-500 hover:bg-white hover:text-slate-900 transition-colors"
            >
              <X size={16} />
            </button>
          )}
          <div className="relative mx-auto h-11 w-11 sm:h-13 sm:w-13">
            {!celebrate && <span className="cms-goal-ring" aria-hidden="true" />}
            {!celebrate && <span className="cms-goal-ring cms-goal-ring--late" aria-hidden="true" />}
            <div className={`relative flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center rounded-full text-white ${celebrate ? 'cms-goal-pop bg-gradient-to-b from-emerald-400 to-emerald-600 shadow-[0_8px_18px_rgba(5,150,105,0.35),inset_0_2px_3px_rgba(255,255,255,0.45),inset_0_-3px_5px_rgba(6,78,59,0.45)]' : 'bg-gradient-to-b from-emerald-500 to-emerald-700 shadow-[0_8px_18px_rgba(185,28,28,0.35),inset_0_2px_3px_rgba(255,255,255,0.4),inset_0_-3px_5px_rgba(127,29,29,0.5)]'}`}>
              {celebrate ? <Check size={22} strokeWidth={3} aria-hidden="true" /> : <Target size={22} className="sm:scale-110" aria-hidden="true" />}
            </div>
          </div>
          <h2 id="learning-goal-title" className="relative mt-2 sm:mt-2.5 text-base sm:text-lg font-black text-slate-900 leading-snug">
            {celebrate ? 'Đã đặt mục tiêu!' : editing ? 'Đổi mục tiêu học' : 'Đặt mục tiêu học'}
          </h2>
          <p className="relative mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
            {celebrate
              ? 'Hệ thống sẽ theo dõi tiến độ mỗi ngày giúp bạn. Cố lên nhé!'
              : currentGoal?.expired
                ? 'Mục tiêu trước đã kết thúc. Đặt mục tiêu mới để tiếp tục nhé!'
                : 'Chọn thời gian và số giờ học mỗi ngày, hệ thống sẽ theo dõi tiến độ giúp bạn.'}
          </p>
        </div>

        {celebrate ? (
          <div className="relative px-4 sm:px-6 pb-5 pt-2 text-center" aria-live="polite">
            {CONFETTI.map((piece, index) => (
              <span
                key={index}
                className="cms-goal-confetti"
                style={{ background: piece.color, '--dx': piece.dx, '--dy': piece.dy, '--rot': piece.rot, animationDelay: piece.delay }}
                aria-hidden="true"
              />
            ))}
            <div className="cms-goal-pop mx-auto inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-xs sm:text-sm font-black text-red-700">
              <Target size={14} aria-hidden="true" /> {celebrate.label}
            </div>
            <p className="mt-2 sm:mt-2.5 flex items-center justify-center gap-1.5 text-xs sm:text-[13px] text-slate-600">
              <CalendarCheck size={14} className="text-emerald-600" aria-hidden="true" />
              Hoàn thành dự kiến <strong className="text-slate-900">{celebrate.endDate}</strong>
            </p>
            {resume ? (
              <>
                <div className="cms-goal-pop mt-3.5 flex w-full items-center gap-2.5 rounded-xl border border-red-100 bg-red-50/70 p-2.5 text-left">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                    <PlayCircle size={20} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold text-red-600">Đang học dở · {resume.subjectName}</span>
                    <span className="block truncate text-xs sm:text-sm font-black text-slate-900">{resume.unitTitle}</span>
                    {resume.itemTitle && <span className="block truncate text-[11px] text-slate-500">{resume.itemTitle}</span>}
                  </span>
                </div>
                <button type="button" onClick={continueLearning} className="cms-btn cms-btn-primary mt-2.5 w-full !py-2 text-xs sm:text-sm">
                  <PlayCircle size={16} aria-hidden="true" />
                  {resume.kind === 'video' ? 'Tiếp tục xem video' : 'Tiếp tục bài học'}
                </button>
                <button type="button" onClick={() => onSaved?.(celebrate.data)} className="mt-1.5 w-full py-1 text-xs font-bold text-slate-500 hover:text-slate-800">
                  Để sau
                </button>
              </>
            ) : (
              <button type="button" onClick={() => onSaved?.(celebrate.data)} className="cms-btn cms-btn-primary mt-4 w-full !py-2 text-xs sm:text-sm" disabled={resume === undefined}>
                {resume === undefined ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : 'Tuyệt vời!'}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-3 sm:space-y-3.5 overflow-y-auto px-4 sm:px-5 py-3 sm:py-3.5">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-slate-500">
                  <CalendarDays size={13} aria-hidden="true" /> Thời gian mục tiêu
                </p>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-1" role="radiogroup" aria-label="Thời gian mục tiêu">
                  {LEARNING_GOAL_PERIODS.map((option) => {
                    const active = option.id === period;
                    const Icon = PERIOD_ICONS[option.id] || CalendarDays;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setPeriod(option.id)}
                        className={`relative rounded-xl border-2 px-1.5 py-1.5 sm:py-2 text-center transition ${active ? 'border-red-500 bg-red-50/80 text-red-700 shadow-2xs' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                      >
                        {option.popular && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-b from-emerald-500 to-emerald-600 px-1.5 py-0.2 text-[8px] sm:text-[8.5px] font-black uppercase tracking-wide text-white shadow-2xs">
                            Phổ biến
                          </span>
                        )}
                        <Icon size={15} className={`mx-auto mb-0.5 ${active ? 'text-red-600' : 'text-slate-400'}`} aria-hidden="true" />
                        <span className="block text-xs sm:text-sm font-black leading-tight">{option.label}</span>
                        <span className="block text-[10px] sm:text-[10.5px] font-semibold text-slate-400">{option.days} ngày</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between gap-1.5">
                  <p className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-slate-500">
                    <Clock3 size={13} aria-hidden="true" /> Mỗi ngày học
                  </p>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.2 text-[10px] sm:text-[10.5px] font-black transition-colors"
                    style={{ color: level.color, background: level.soft }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: level.color }} aria-hidden="true" />
                    {level.label}
                  </span>
                </div>
                <p className="mb-1.5 text-[10px] sm:text-[10.5px] font-medium leading-tight text-slate-500">
                  Người mới bắt đầu chọn 1 giờ. Biết cơ bản chọn 2 giờ.
                </p>
                <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Số giờ học mỗi ngày">
                  {LEARNING_GOAL_HOURS.map((value) => {
                    const active = value === hours;
                    const tone = LEARNING_GOAL_LEVELS[value];
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        aria-label={`${value} giờ mỗi ngày, ${tone.label}`}
                        onClick={() => setHours(value)}
                        className={`rounded-xl border-2 py-1.5 sm:py-2 text-center transition ${active ? 'shadow-2xs' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                        style={active ? { borderColor: tone.color, background: tone.soft, color: tone.color } : undefined}
                      >
                        <span className="block text-sm sm:text-base font-black leading-tight">{value}</span>
                        <span className="block text-[9.5px] font-semibold text-slate-400">giờ</span>
                        <span className="mx-auto mt-0.5 flex h-1.5 items-end justify-center gap-[2px]" aria-hidden="true">
                          {LEARNING_GOAL_HOURS.map((bar) => (
                            <span
                              key={bar}
                              className="w-[2.5px] rounded-full"
                              style={{ height: `${2 + bar * 1.2}px`, background: bar <= value ? tone.color : '#E2E8F0', opacity: bar <= value ? (active ? 1 : 0.55) : 1 }}
                            />
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50/60 px-3 py-2 sm:py-2.5 text-center">
                <p className="text-xs sm:text-[12.5px] text-emerald-800 leading-snug">
                  Tổng cộng <strong>{hours * selectedPeriod.days} giờ</strong> trong <strong>{selectedPeriod.days} ngày</strong>
                </p>
                <p className="mt-0.5 flex items-center justify-center gap-1 text-[10.5px] sm:text-[11px] font-semibold text-emerald-700">
                  <CalendarCheck size={12} aria-hidden="true" /> Hoàn thành dự kiến {endDate}
                </p>
                <p className="mt-1 flex items-center justify-center gap-1 text-[10px] sm:text-[10.5px] italic text-slate-500">
                  <Sparkles size={11} className="text-amber-500" aria-hidden="true" /> {goalMotivation(hours)}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 gap-2 border-t border-slate-100 p-3 sm:p-3.5">
              <button type="button" onClick={onClose} className="cms-btn cms-btn-outline flex-1 !py-2 text-xs sm:text-sm">
                Để sau
              </button>
              <button type="button" onClick={save} disabled={saving} className="cms-btn cms-btn-primary flex-1 !py-2 text-xs sm:text-sm">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Target size={15} />}
                {editing ? 'Lưu mục tiêu' : 'Bắt đầu'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
