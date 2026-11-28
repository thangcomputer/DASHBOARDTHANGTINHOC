import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Crown, Loader2, Play, Sparkles } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';
import { QUESTION_STAKE_XP } from '../../../utils/dailyPractice';
import { dewClass, getDewSkillThemeAttr } from '../../../utils/dewskillTheme';
import useAIQuota, { dispatchOpenAiPackagesModal } from '../../../hooks/useAIQuota';
import { deriveSidebarAiPlan } from '../../../utils/sidebarAiPlan';
import Mascot from './Mascot';

/** Modal chuẩn bị vào luyện tập phong cách Giọt Nước 3D (Dewdrop Glossy). */
export default function PracticeReadyModal({
  variant = 'rematch',
  stakeXp = 50,
  xpTotal,
  starting = false,
  testOut = false,
  testOutLocked = false,
  review = false,
  isFreeTier: _isFreeTier = false,
  questionStakeXp = QUESTION_STAKE_XP,
  countdownSeconds = 3,
  onStay,
  onGo,
  onOpenMeet,
}) {
  const isStart = variant === 'start';
  const aiQuota = useAIQuota({ autoFetch: true });
  const aiPlanInfo = deriveSidebarAiPlan({
    aiQuotaPercent: aiQuota.aiQuotaPercent,
    aiPlan: aiQuota.aiPlan,
    isPaidUnlimited: aiQuota.isPaidUnlimited,
  });
  const notEnoughXp = typeof xpTotal === 'number' && xpTotal < stakeXp;
  const isBlockedFreeTestOut = testOut && testOutLocked;
  const canAutoStart = !isBlockedFreeTestOut && !notEnoughXp;

  const COUNTDOWN_MS = Math.max(1, Number(countdownSeconds) || 3) * 1000;
  const [remainingMs, setRemainingMs] = useState(COUNTDOWN_MS);

  const timerRef = useRef(null);
  const triggeredRef = useRef(false);
  const onGoRef = useRef(onGo);
  onGoRef.current = onGo;
  const onStayRef = useRef(onStay);
  onStayRef.current = onStay;

  const titleId = isStart ? 'dp-stake-start-title' : 'dp-rematch-title';

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStartNow = useCallback(() => {
    if (starting || triggeredRef.current) return;
    triggeredRef.current = true;
    clearTimer();
    gameSounds.win();
    onGoRef.current?.();
  }, [starting, clearTimer]);

  const handleCancel = useCallback(() => {
    if (starting) return;
    triggeredRef.current = true;
    clearTimer();
    onStayRef.current?.();
  }, [starting, clearTimer]);

  useEffect(() => {
    gameSounds.pick();
  }, []);

  useEffect(() => {
    if (!canAutoStart || starting) return undefined;
    triggeredRef.current = false;
    setRemainingMs(COUNTDOWN_MS);
    const startedAt = Date.now();
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const left = Math.max(0, COUNTDOWN_MS - elapsed);
      setRemainingMs(left);
      if (left <= 0 && !triggeredRef.current) {
        triggeredRef.current = true;
        clearTimer();
        gameSounds.win();
        onGoRef.current?.();
      }
    }, 50);
    return clearTimer;
  }, [canAutoStart, starting, COUNTDOWN_MS, clearTimer]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && !starting) {
        handleCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleCancel, starting]);

  let title = 'Bắt đầu lượt luyện?';
  let body = '';
  if (isBlockedFreeTestOut) {
    title = 'Đặc quyền học viên đã đăng ký khóa';
    body = 'Kiểm tra vượt chặng dành riêng cho học viên đã đăng ký khóa học. Vui lòng đăng ký khóa để mở khóa đặc quyền này!';
  } else if (review || stakeXp === 0) {
    title = 'Chuẩn bị ôn lại';
    body = 'Ôn lại bài đã qua hoàn toàn miễn phí, không ảnh hưởng XP Học tập.';
  } else if (notEnoughXp) {
    title = 'Cần nâng cấp gói Hỗ trợ AI';
    body = 'Nâng cấp gói Hỗ trợ AI để tiếp tục luyện tập nâng cao và hỏi Trợ lý AI không giới hạn (XP Học tập tích lũy luôn được giữ nguyên).';
  } else if (isStart) {
    title = testOut ? 'Kiểm tra vượt chặng?' : 'Chuẩn bị vào luyện tập';
    body = testOut
      ? 'Hoàn thành bài kiểm tra vượt chặng để mở khóa chặng tiếp theo và nhận thưởng +40 XP Học tập.'
      : `Hoàn thành đạt yêu cầu để nhận thưởng +${questionStakeXp} XP/câu đúng vào XP Học tập & Chuỗi học.`;
  } else {
    title = 'Làm lại lượt luyện tập?';
    body = `Hoàn thành đạt yêu cầu để nhận thưởng +${questionStakeXp} XP/câu đúng vào XP Học tập & Chuỗi học.`;
  }

  const pct = Math.max(0, Math.min(100, (remainingMs / COUNTDOWN_MS) * 100));
  const secondsLeft = remainingMs <= 0 ? 0 : Math.max(1, Math.ceil(remainingMs / 1000));
  const showStatGrid = !(review || stakeXp === 0);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      data-theme={getDewSkillThemeAttr()}
      className="fixed inset-0 z-[9500] flex items-center justify-center overflow-hidden bg-slate-950/55 p-4 backdrop-blur-md"
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !starting) {
          handleCancel();
        }
      }}
    >
      <div className="relative w-full max-w-md">
        {/* Các giọt nước 3D trang trí nhẹ quanh modal */}
        <span
          aria-hidden="true"
          className="dew-water-orb pointer-events-none absolute -left-4 top-16 z-20 hidden h-10 w-10 opacity-85 sm:block"
        />
        <span
          aria-hidden="true"
          className="dew-water-orb pointer-events-none absolute -right-4 top-20 z-20 hidden h-9 w-9 opacity-80 sm:block"
        />
        <span
          aria-hidden="true"
          className="dew-water-orb pointer-events-none absolute -bottom-3 right-8 z-20 hidden h-11 w-11 opacity-80 sm:block"
        />
        <span
          aria-hidden="true"
          className="dew-water-orb pointer-events-none absolute bottom-10 -left-3 z-20 hidden h-7 w-7 opacity-75 sm:block"
        />

        <div
          className="dew-modal cms-goal-in relative w-full max-w-md overflow-hidden rounded-[32px] border border-white bg-white/95 p-6 text-center shadow-[0_28px_70px_-12px_rgba(4,120,87,0.3),inset_0_2px_0_#fff] backdrop-blur-2xl md:p-7"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          {/* Thanh nhấn 4px xanh ngọc → vàng cam trên cùng */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#10B981] via-[#34D399] to-[#F59E0B]"
          />

          {/* Vòng cầu kính tỏa sáng + Mascot đeo băng đô */}
          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-white bg-gradient-to-b from-[#ECFDF5] to-[#FEF3C7]/70 shadow-[0_12px_30px_rgba(16,185,129,0.22),inset_0_2px_4px_#fff]">
            <Mascot
              mood={isBlockedFreeTestOut || notEnoughXp ? 'thinking' : 'determined'}
              size={98}
              className="relative"
            />
          </div>

          <h3 id={titleId} className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {body}
          </p>

          {/* 3 Ô thông số XP kính mờ */}
          {showStatGrid && (
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-2 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                <p className="text-sm font-black text-emerald-700 tabular-nums">
                  {testOut ? `${stakeXp} XP` : `+${questionStakeXp} XP`}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-emerald-700/85">
                  {testOut ? 'Phí vượt chặng' : 'XP học tập/câu'}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-2 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                <p className="text-sm font-black text-amber-800 tabular-nums">
                  {testOut ? `+${stakeXp} XP` : `Tối đa +${stakeXp} XP`}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-amber-800/85">
                  {testOut ? 'Hoàn ví khi đạt' : 'Thưởng học tập'}
                </p>
              </div>

              <div
                title={aiPlanInfo.isSubscribed ? 'Không giới hạn' : 'Dung lượng Hỗ trợ AI hôm nay'}
                className="rounded-2xl border border-sky-200/80 bg-sky-50/90 px-2 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
              >
                <p className="text-sm font-black text-sky-700 tabular-nums">
                  {aiPlanInfo.isSubscribed ? 'Unlimited' : `${aiPlanInfo.quotaPercent}%`}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-sky-700/85">
                  Hỗ trợ AI
                </p>
              </div>
            </div>
          )}

          {/* Thanh đếm ngược tự động */}
          {canAutoStart && (
            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5 text-left">
              <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
                <span className="flex items-center gap-1.5 text-emerald-800">
                  {starting || remainingMs <= 0 ? (
                    <Loader2 size={13} className="animate-spin text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Play size={13} className="fill-emerald-600 text-emerald-600" aria-hidden="true" />
                  )}
                  <span>{starting || remainingMs <= 0 ? 'Đang vào bài luyện…' : 'Tự động vào luyện sau'}</span>
                </span>
                <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[11px] font-black tabular-nums text-white shadow-xs">
                  {secondsLeft}s
                </span>
              </div>
              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#059669] via-[#10B981] to-[#34D399] transition-[width] duration-75 ease-linear"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {/* Cụm nút đáy */}
          <div className="mt-5 space-y-2.5">
            {canAutoStart ? (
              <>
                <button
                  type="button"
                  onClick={handleStartNow}
                  disabled={starting}
                  className={dewClass(
                    'dew-btn-primary inline-flex w-full items-center justify-center gap-2 py-3.5 text-base font-extrabold cursor-pointer disabled:opacity-60',
                    'inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 text-base font-extrabold shadow-md cursor-pointer disabled:opacity-60',
                  )}
                >
                  {starting ? (
                    <>
                      <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                      <span>Đang khởi tạo...</span>
                    </>
                  ) : (
                    <>
                      <span>Bắt đầu ngay</span>
                      <ArrowRight size={17} aria-hidden="true" />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={starting}
                  className="w-full py-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-700 cursor-pointer disabled:opacity-50"
                >
                  Để sau
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    handleCancel();
                    if (isBlockedFreeTestOut && typeof onOpenMeet === 'function') {
                      onOpenMeet();
                    } else {
                      dispatchOpenAiPackagesModal();
                    }
                  }}
                  className={dewClass(
                    'dew-btn-primary inline-flex w-full items-center justify-center gap-2 py-3.5 text-base font-extrabold cursor-pointer',
                    'inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 text-base font-extrabold shadow-md cursor-pointer',
                  )}
                >
                  {isBlockedFreeTestOut ? (
                    <>
                      <Crown size={17} className="text-amber-300" aria-hidden="true" />
                      <span>Đăng ký khóa học</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={17} className="text-amber-200" aria-hidden="true" />
                      <span>Nâng cấp gói AI</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-full py-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-700 cursor-pointer"
                >
                  Để sau
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
